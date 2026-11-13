import { applyHandleEffects } from './sample-effects.js';
import { scopeRegionContent } from '../camera/regions.js';
import { strokePropertySuggestion } from './stroke-hints.js';
import { ellipsePathProps } from '../graphics/ellipse.js';
import { prepareDashTrack, dashTrackValue, prepareDashKeys } from './dash-tracks.js';
import {
  captureHandleClip,
  commitHandleClip,
  clearHandleClip,
  validateClipAdoption,
  dynamicClipId,
  resolveDynamicClips,
} from './dynamic-clip.js';
import { assert, number, text, options, KitError } from './validate.js';
import { properties, validateProperty, linearScale } from './geometry.js';
import { prepareTrack, trackValue, prepareKeyframes } from './timing.js';
import { DataSource, Parameter } from './data.js';
import { presenceSpec, dimSpec, applyPresence, DIM_DURATION } from './motion.js';
import { Camera, cameraDefaults } from '../camera/index.js';
import { createSpace } from '../spatial/space.js';
import { gradeFrame } from '../look/index.js';
import { sceneLight } from '../graphics/lighting.js';
import { focusBlur, shutterTimes } from '../camera/depth.js';
import { measureNode } from '../layout/adaptive.js';
import { localMatrix } from './transform.js';
import { preparePivotTrack, pivotTrackValue, preparePivotKeys } from './coordinate-tracks.js';
import { validateRegisteredFont, resolveRegisteredText } from './fonts.js';
import { blurRadius } from '../graphics/look.js';
import { motionBlurSpec, projectedMotion } from './motion-blur.js';
import { markSampled } from './sampled.js';
import { Ambient } from './ambient.js';
import { responsiveText } from './responsive-text.js';

function blueprint(input, depth = 0, budget = { nodes: 0, commands: 0 }) {
  assert(++budget.nodes <= 10000, 'RESOURCE_LIMIT', 'A component is limited to 10000 nodes.');
  assert(depth <= 24, 'RESOURCE_LIMIT', 'Component nesting is limited to 24.');
  options(input, ['type', 'props', 'children']);
  const type = input.type ?? 'group',
    props = properties(type, input.props ?? {});
  budget.commands += props.commands?.length ?? 0;
  assert(budget.commands <= 100000, 'RESOURCE_LIMIT', 'Component path-command budget exceeded.');
  const children = input.children ?? {};
  options(children, Object.keys(children), 'component children');
  assert(type === 'group' || Object.keys(children).length === 0, 'INVALID_CHILDREN', 'Only groups contain children.');
  const result = { type, props: Object.freeze(props), children: Object.create(null) };
  for (const [name, child] of Object.entries(children)) {
    assert(
      /^[a-zA-Z][\w-]{0,63}$/.test(name) && !['constructor', 'prototype', '__proto__'].includes(name),
      'INVALID_PART',
      'Use a short named component part.',
    );
    result.children[name] = blueprint(child, depth + 1, budget);
  }
  return Object.freeze({ ...result, children: Object.freeze(result.children) });
}
function countParts(b) {
  return 1 + Object.values(b.children).reduce((n, c) => n + countParts(c), 0);
}
function locate(record, path) {
  let r = record;
  for (const name of path) {
    r = r.children.get(name);
    assert(r, 'UNKNOWN_PART', `Unknown component part ${name}.`);
  }
  return r;
}
function channel(record, path) {
  const parts = path.split('.');
  const property = parts.pop();
  const node = locate(record, parts);
  validateProperty(node.type, property, node.props[property]);
  return { node, property };
}
function bindingFailure(error, label) {
  let detail = 'Callback threw a non-Error value.';
  // Error values belong to trusted author code, but even their message getter may fail.
  try {
    if (error instanceof KitError) return error;
    const message = error instanceof Error ? error.message : error;
    if (typeof message === 'string') detail = message;
  } catch {
    /* Keep the diagnostic safe. */
  }
  const failure = new KitError('BINDING_FAILED', `${label}: ${detail}`);
  failure.cause = error;
  return failure;
}
function captureInputs(scene, inputs) {
  assert(
    Array.isArray(inputs) && inputs.length <= 10000,
    'INVALID_BINDING',
    'Binding inputs must be a dense array of at most 10000 scene inputs.',
  );
  const captured = [];
  for (let i = 0; i < inputs.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(inputs, i);
    assert(
      descriptor && 'value' in descriptor && scene._ownsInput(descriptor.value),
      'INVALID_BINDING',
      'Use this scene’s parameter, derived or data inputs; holes and accessors are unsupported.',
    );
    captured.push(descriptor.value);
  }
  return Object.freeze(captured);
}
/** Parameters sample by time; derived values by the whole sample context; data sources yield frozen rows. */
function readInput(input, context) {
  return input instanceof Derived
    ? input.sample(context)
    : input instanceof DataSource
      ? input.rows
      : input.sample(input instanceof Ambient ? (context.ambient ?? 0) : context.time);
}
/** A pure value computed once per sample and shared by every binding that reads it. */
export class Derived {
  #inputs;
  #map;
  #seen = null;
  #value;
  constructor(inputs, map) {
    this.#inputs = inputs;
    this.#map = map;
  }
  sample(context) {
    if (context !== this.#seen) {
      try {
        this.#value = this.#map(...this.#inputs.map((p) => readInput(p, context)), context);
      } catch (error) {
        throw bindingFailure(error, 'Derived value');
      }
      this.#seen = context;
    }
    return this.#value;
  }
}
const profiles = new WeakMap();
function evaluate(
  record,
  context,
  placement = null,
  inheritedHidden = false,
  sampleInfo = null,
  includeChildren = true,
) {
  const profile = profiles.get(context),
    started = profile?.now();
  const presence = record.presence ? { opacity: 1 } : null;
  if (presence) applyPresence(record.presence, presence, context.time);
  const hidden = inheritedHidden || presence?.opacity === 0;
  const props = { ...record.props };
  for (const [key, binding] of record.bindings) {
    if (
      (binding.active && (context.time < binding.active[0] || context.time > binding.active[1])) ||
      (binding.lazy && hidden)
    )
      continue;
    try {
      props[key] = validateProperty(record.type, key, binding(context));
    } catch (error) {
      throw bindingFailure(error, `Binding ${record.id}.${key}`);
    }
  }
  for (const [key, tracks] of record.tracks)
    props[key] = validateProperty(
      record.type,
      key,
      (key === 'pivot' ? pivotTrackValue : key === 'strokeDasharray' ? dashTrackValue : trackValue)(
        tracks,
        context.time,
        props[key],
      ),
    );
  if (placement) {
    props.x = placement.x;
    props.y = placement.y;
  }
  applyHandleEffects(record, props, context);
  if (record.presence) applyPresence(record.presence, props, context.time);
  if (profile)
    profile.nodes.push({
      id: record.id,
      type: record.type,
      selfMS: profile.now() - started,
      bindings: record.bindings.size,
      hidden,
    });
  const clipTarget = dynamicClipId(record);
  if (sampleInfo) {
    if (clipTarget) sampleInfo.dynamicClips = true;
    if (record.type === 'text') sampleInfo.text = true;
  }
  // Snapshot handles before invoking child callbacks. A binding may mutate the
  // scene; appended children belong to the next sample, as with the old map().
  const children = includeChildren && record.children.size ? [...record.children.values()] : [];
  for (let i = 0; i < children.length; i++) children[i] = evaluate(children[i], context, null, hidden, sampleInfo);
  return {
    id: record.id,
    type: record.type,
    props,
    ...(clipTarget ? { clipTarget } : {}),
    children,
  };
}
/** One record's own sampled properties, without its children. */
function evaluateOwn(record, context) {
  return evaluate(record, context, null, false, null, false);
}
const IDENTITY = Object.freeze([1, 0, 0, 1, 0, 0]);
const multiply = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
function prepareNodeTrack(record, property, spec, continuation = false) {
  assert(
    !record.bindings.has(property) && !record.collectionOwned.has(property),
    'CHANNEL_OWNED',
    'Unbind the property before animating it.',
  );
  validateProperty(record.type, property, record.props[property]);
  const tracks = record.tracks.get(property) ?? [];
  const track = (
    property === 'pivot' ? preparePivotTrack : property === 'strokeDasharray' ? prepareDashTrack : prepareTrack
  )(tracks, { property, ...spec }, record.props[property], { continuation });
  validateProperty(record.type, property, track.from);
  validateProperty(record.type, property, track.to);
  return { property, track, tracks: [...tracks, track].sort((a, b) => a.at - b.at) };
}
class NodeHandle {
  constructor(scene, record) {
    this._scene = scene;
    this._record = record;
  }
  get id() {
    return this._record.id;
  }
  _live() {
    assert(
      !this._record.detached,
      'DETACHED_HANDLE',
      'This instance was removed; look up an active key before editing.',
    );
  }
  part(name) {
    this._live();
    return new NodeHandle(this._scene, locate(this._record, name.split('.')));
  }
  add(handle) {
    this._live();
    this._scene._adopt(this, handle);
    return this;
  }
  group(p = {}) {
    this._live();
    return this._scene._child(this, 'group', p);
  }
  /** @param {{rx?:number,ry?:number,startAngle?:number,endAngle?:number,closed?:boolean,[key:string]:any}} p */
  /** @param {Record<string,any>&{rx?:number,ry?:number,startAngle?:number,endAngle?:number,closed?:boolean}} [p] */
  ellipse(p = {}) {
    return this._scene._child(this, 'path', ellipsePathProps(p));
  }
  circle(p = {}) {
    return this._scene._child(this, 'circle', p);
  }
  rect(p = {}) {
    return this._scene._child(this, 'rect', p);
  }
  path(p = {}) {
    return this._scene._child(this, 'path', p);
  }
  line(p = {}) {
    return this._scene._child(this, 'line', p);
  }
  text(p = {}) {
    return this._scene._child(this, 'text', p);
  }
  cloud(p = {}) {
    return this._scene._child(this, 'cloud', p);
  }
  instance(component) {
    assert(
      component instanceof Component && component.scene === this._scene,
      'INVALID_COMPONENT',
      'Use a component owned by this scene.',
    );
    const handle = this._scene._childDefinition(this, component.definition);
    component.instances.add(handle._record);
    return handle;
  }
  set(input) {
    this._live();
    const capturedClip = captureHandleClip(this._scene, input, this._record);
    input = capturedClip.input;
    for (const key of Object.keys(input ?? {}))
      if (strokePropertySuggestion(key)) validateProperty(this._record.type, key, undefined);
    options(
      input,
      [...Object.keys(this._record.props), ...(this._record.type === 'text' ? ['textOutline', 'textAdvance'] : [])],
      'properties',
    );
    const next = {};
    for (const [key, value] of Object.entries(input)) {
      assert(
        !this._record.bindings.has(key) && !this._record.tracks.has(key) && !this._record.collectionOwned.has(key),
        'CHANNEL_OWNED',
        `${key} is driven; unbind or clear its animation explicitly first.`,
      );
      next[key] = validateProperty(this._record.type, key, value);
    }
    commitHandleClip(this._record, capturedClip);
    Object.assign(this._record.props, next);
    for (const key of Object.keys(next)) this._record.overrides.add(key);
    this._scene._changed();
    return this;
  }
  reset(property) {
    this._live();
    assert(
      !this._record.bindings.has(property) &&
        !this._record.tracks.has(property) &&
        !this._record.collectionOwned.has(property),
      'CHANNEL_OWNED',
      'Release the property driver before resetting.',
    );
    const resetValue = validateProperty(this._record.type, property, this._record.sourceProps[property]);
    if (
      this._record.type === 'text' &&
      ['textOutline', 'textAdvance'].includes(property) &&
      !Object.hasOwn(this._record.sourceProps, property)
    )
      delete this._record.props[property];
    else this._record.props[property] = resetValue;
    if (property === 'clip') clearHandleClip(this._record);
    this._record.overrides.delete(property);
    this._scene._changed();
    return this;
  }
  /** @param {string|string[]} property @param {{inputs?: any[], map: (...values: any[]) => any,active?:[number,number],lazy?:boolean}} binding */
  bind(property, { inputs = [], map, active, lazy = false } = {}) {
    this._live();
    assert(typeof lazy === 'boolean', 'INVALID_BINDING', 'lazy must be boolean.');
    if (active !== undefined) {
      assert(Array.isArray(active) && active.length === 2, 'INVALID_BINDING', 'active is [from,until].');
      active = Object.freeze([
        number(active[0], 'binding start', 0, 86400),
        number(active[1], 'binding end', 0, 86400),
      ]);
      assert(active[1] >= active[0], 'INVALID_BINDING', 'Binding end precedes start.');
    }
    const keys = Array.isArray(property) ? [...property] : [property],
      several = Array.isArray(property);
    assert(typeof map === 'function', 'INVALID_BINDING', 'A trusted binding needs a map function.');
    inputs = captureInputs(this._scene, inputs);
    assert(keys.length > 0 && new Set(keys).size === keys.length, 'INVALID_BINDING', 'Bind each property once.');
    for (const key of keys) {
      assert(
        !this._record.tracks.has(key) && !this._record.bindings.has(key) && !this._record.collectionOwned.has(key),
        'CHANNEL_OWNED',
        `${key} already has a driver.`,
      );
      validateProperty(this._record.type, key, this._record.props[key]);
    }
    // Several properties share one evaluation per sample; each output is validated separately.
    let seen = null,
      value;
    const evaluateOnce = (context) => {
      if (context !== seen) {
        try {
          value = map(...inputs.map((p) => readInput(p, context)), context);
        } catch (error) {
          throw bindingFailure(error, `Binding ${this.id}`);
        }
        seen = context;
      }
      return value;
    };
    const missingProperties = `Binding must return an object with ${keys.join(', ')}.`;
    const pick = (key) => (context) => {
      const out = evaluateOnce(context);
      if (!several) return out;
      assert(out && typeof out === 'object' && Object.hasOwn(out, key), 'BINDING_FAILED', missingProperties);
      return out[key];
    };
    const context = this._scene._context();
    try {
      for (const key of keys) validateProperty(this._record.type, key, pick(key)(context));
    } catch (error) {
      throw bindingFailure(error, `Binding ${this.id}`);
    }
    for (const key of keys) {
      const fn = pick(key);
      fn.active = active;
      fn.lazy = lazy;
      this._record.bindings.set(key, fn);
    }
    this._scene._changed();
    return this;
  }
  unbind(property) {
    this._live();
    this._record.bindings.delete(property);
    this._scene._changed();
    return this;
  }
  animate(property, spec) {
    this._live();
    options(spec, ['from', 'to', 'at', 'duration', 'ease']);
    const prepared = prepareNodeTrack(this._record, property, spec);
    this._record.tracks.set(property, prepared.tracks);
    this._scene._extend(prepared.track.end);
    this._scene._changed();
    return this;
  }
  keys(property, keys) {
    return this._keys(property, keys, false);
  }
  replaceKeys(property, keys) {
    return this._keys(property, keys, true);
  }
  _keys(property, keys, replace) {
    this._live();
    const r = this._record;
    assert(
      !r.bindings.has(property) && !r.collectionOwned.has(property),
      'CHANNEL_OWNED',
      'Release an existing driver before keyframing.',
    );
    validateProperty(r.type, property, r.props[property]);
    const prior = replace ? [] : (r.tracks.get(property) ?? []),
      tracks =
        property === 'pivot'
          ? preparePivotKeys(prior, keys, r.props[property])
          : property === 'strokeDasharray'
            ? prepareDashKeys(prior, keys, r.props[property])
            : prepareKeyframes(prior, property, keys, r.props[property]);
    for (const t of tracks) {
      validateProperty(r.type, property, t.from);
      validateProperty(r.type, property, t.to);
    }
    r.tracks.set(property, [...tracks]);
    this._scene._extend(tracks.at(-1).end);
    this._scene._changed();
    return this;
  }
  clearAnimation(property) {
    this._live();
    this._record.tracks.delete(property);
    this._scene._changed();
    return this;
  }
  /** Move to new values at a time, starting from wherever the previous move left off. */
  to(at, patch, spec = {}) {
    this._live();
    options(patch, Object.keys(this._record.props), 'properties');
    options(spec, ['duration', 'ease']);
    const prepared = Object.entries(patch).map(([property, value]) =>
      prepareNodeTrack(
        this._record,
        property,
        { to: value, at, duration: spec.duration ?? 1.1, ease: spec.ease ?? 'easeInOut' },
        true,
      ),
    );
    for (const item of prepared) this._record.tracks.set(item.property, item.tracks);
    if (prepared.length) {
      this._scene._extend(Math.max(...prepared.map((item) => item.track.end)));
      this._scene._changed();
    }
    return this;
  }
  /** Fade in (and by default lift into place) at a time. Composes with any driver of opacity or position. */
  enter(at, spec) {
    this._live();
    const captured = presenceSpec('enter', at, spec),
      next = Object.freeze({
        ...captured,
        ...(captured.pivot !== undefined
          ? { pivot: validateProperty(this._record.type, 'pivot', captured.pivot) }
          : {}),
      });
    this._presence().enter = next;
    this._scene._extend(next.end);
    this._scene._changed();
    return this;
  }
  /** Leave the stage at a time. */
  exit(at, spec) {
    this._live();
    const captured = presenceSpec('exit', at, spec),
      next = Object.freeze({
        ...captured,
        ...(captured.pivot !== undefined
          ? { pivot: validateProperty(this._record.type, 'pivot', captured.pivot) }
          : {}),
      });
    this._presence().exit = next;
    this._scene._extend(next.end);
    this._scene._changed();
    return this;
  }
  /** Step back from focus: [[time, level], ...] with level 1 fully present and 0 gone. */
  dim(keys) {
    this._live();
    const next = dimSpec(keys);
    this._presence().dim = next;
    this._scene._extend(next.at(-1)[0] + DIM_DURATION);
    this._scene._changed();
    return this;
  }
  _presence() {
    return (this._record.presence ??= { enter: null, exit: null, dim: null });
  }
  /** Tag this node. Tags organize and select (a tag tree, as in Rhypple); they never change how a node behaves. */
  tag(...names) {
    this._live();
    for (const name of names) this._scene._tagNode(this.id, name);
    return this;
  }
  /** A hover tip and a pinned explanation, read by players. Clicking it pauses playback. */
  explain(title, body = '') {
    this._live();
    this._scene._interaction(this.id).explain = Object.freeze({
      title: text(title, 'title', 200),
      body: text(body, 'body', 2000),
    });
    return this;
  }
  /** Called with stage coordinates when this node (or a part of it) is tapped. Trusted author code. */
  onTap(fn) {
    this._live();
    assert(typeof fn === 'function', 'INVALID_INTERACTION', 'onTap needs a function.');
    this._scene._interaction(this.id).tap = fn;
    return this;
  }
  /** Called with stage coordinates while this node is dragged, then once with null on release. */
  onDrag(fn) {
    this._live();
    assert(typeof fn === 'function', 'INVALID_INTERACTION', 'onDrag needs a function.');
    this._scene._interaction(this.id).drag = fn;
    return this;
  }
}
class Component {
  constructor(scene, definition) {
    this.scene = scene;
    this.definition = definition;
    this.instances = new Set();
  }
  set(part, patch) {
    const path = part ? part.split('.') : [];
    let b = this.definition;
    for (const p of path) {
      b = b.children[p];
      assert(b, 'UNKNOWN_PART', `Unknown part ${p}.`);
    }
    options(patch, Object.keys(b.props));
    patch = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, validateProperty(b.type, k, v)]));
    const update = (node, depth) =>
      depth === path.length
        ? Object.freeze({ ...node, props: Object.freeze({ ...node.props, ...patch }) })
        : Object.freeze({
            ...node,
            children: Object.freeze({ ...node.children, [path[depth]]: update(node.children[path[depth]], depth + 1) }),
          });
    this.definition = update(this.definition, 0);
    for (const root of this.instances) {
      const r = locate(root, path);
      r.sourceProps = { ...r.sourceProps, ...patch };
      for (const [k, v] of Object.entries(patch)) if (!r.overrides.has(k) && !r.collectionOwned.has(k)) r.props[k] = v;
    }
    this.scene._changed();
    return this;
  }
}
class Collection {
  constructor(scene, component, data) {
    this.scene = scene;
    this.component = component;
    this.data = data;
    this.records = new Map();
    this.bindings = [];
    this.layoutSpec = null;
    const commit = this.prepare(data.rows);
    commit();
    this.unsubscribe = data.subscribe((rows) => this.prepare(rows));
  }
  prepare(rows) {
    const nextKeys = new Set(rows.map((row) => row[this.data.key]));
    const removed = [...this.records.keys()].filter((k) => !nextKeys.has(k));
    const additions = rows.filter((row) => !this.records.has(row[this.data.key]));
    const size = countParts(this.component.definition);
    this.scene._capacity((additions.length - removed.length) * size);
    // Validate every binding against the complete candidate dataset before any mutation.
    const computed = rows.map((row) => this.bindings.map((b) => ({ b, value: this.boundValue(b, row) })));
    const commit = () => {
      for (const k of removed) {
        const r = this.records.get(k);
        this.component.instances.delete(r);
        this.records.delete(k);
        this.scene._remove(r);
      }
      const ordered = new Map();
      rows.forEach((row, index) => {
        const key = row[this.data.key];
        let r = this.records.get(key);
        if (!r) {
          r = this.scene._instantiate(this.component.definition);
          this.component.instances.add(r);
        }
        r.row = row;
        if (this.layoutSpec) {
          r.collectionOwned.add('x');
          r.collectionOwned.add('y');
        }
        for (const { b, value } of computed[index]) {
          const { node, property } = channel(r, b.path);
          node.props[property] = value;
          node.collectionOwned.add(property);
        }
        ordered.set(key, r);
      });
      this.records = ordered;
    };
    commit.scene = this.scene;
    commit.delta = (additions.length - removed.length) * size;
    return commit;
  }
  boundValue(b, row) {
    let raw = row[b.field];
    assert(raw !== undefined, 'MISSING_FIELD', `Missing field ${b.field}.`);
    const value = b.scale ? b.scale(raw) : raw;
    const parts = b.path.split('.');
    const key = parts.pop();
    let def = this.component.definition;
    for (const part of parts) {
      def = def.children[part];
      assert(def, 'UNKNOWN_PART', `Unknown part ${part}.`);
    }
    return validateProperty(def.type, key, value);
  }
  bind(path, spec) {
    options(spec, ['field', 'scale']);
    text(spec.field, 'field', 200);
    text(path, 'path', 300);
    assert(
      !this.bindings.some((b) => b.path === path),
      'CHANNEL_OWNED',
      'Unbind an existing collection binding first.',
    );
    assert(!(this.layoutSpec && ['x', 'y'].includes(path)), 'CHANNEL_OWNED', 'Layout owns instance positions.');
    const b = {
      path,
      field: spec.field,
      scale: typeof spec.scale === 'function' ? spec.scale : spec.scale ? linearScale(spec.scale) : null,
    };
    const values = this.data.rows.map((row) => this.boundValue(b, row));
    let i = 0;
    for (const r of this.records.values()) {
      const { node, property } = channel(r, path);
      assert(
        !node.bindings.has(property) && !node.tracks.has(property),
        'CHANNEL_OWNED',
        'Instance has a competing driver.',
      );
      // Commit after checking all instances below.
    }
    for (const r of this.records.values()) {
      const { node, property } = channel(r, path);
      node.props[property] = values[i++];
      node.collectionOwned.add(property);
    }
    this.bindings.push(b);
    this.scene._changed();
    return this;
  }
  unbind(path) {
    if (!this.bindings.some((b) => b.path === path)) return this;
    this.bindings = this.bindings.filter((b) => b.path !== path);
    for (const r of this.records.values()) {
      const { node, property } = channel(r, path);
      node.collectionOwned.delete(property);
    }
    this.scene._changed();
    return this;
  }
  instance(key) {
    const r = this.records.get(key);
    assert(r, 'UNKNOWN_KEY', `No instance for ${key}.`);
    return new NodeHandle(this.scene, r);
  }
  layout(spec) {
    options(spec, ['type', 'columns', 'gap', 'cellWidth', 'cellHeight', 'x', 'y', 'padding', 'responsive']);
    assert(['grid', 'stack'].includes(spec.type), 'UNSUPPORTED_LAYOUT', 'Use grid or stack.');
    assert(
      !this.bindings.some((b) => ['x', 'y'].includes(b.path)),
      'CHANNEL_OWNED',
      'Unbind positions before adding layout.',
    );
    const next = {
      type: spec.type,
      columns: spec.columns ?? 1,
      gap: spec.gap ?? 16,
      cellWidth: spec.cellWidth ?? 60,
      cellHeight: spec.cellHeight ?? 60,
      x: spec.x ?? 0,
      y: spec.y ?? 0,
      padding: spec.padding ?? 0,
      responsive: spec.responsive ?? false,
    };
    number(next.columns, 'columns', 1, 1000);
    assert(Number.isInteger(next.columns), 'INVALID_LAYOUT', 'Columns must be an integer.');
    for (const key of ['gap', 'padding']) number(next[key], key, 0, 10000);
    for (const key of ['cellWidth', 'cellHeight']) number(next[key], key, 1, 10000);
    number(next.x, 'layout x', 0);
    number(next.y, 'layout y', 0);
    assert(typeof next.responsive === 'boolean', 'INVALID_LAYOUT', 'responsive must be boolean.');
    for (const r of this.records.values())
      for (const key of ['x', 'y'])
        assert(!r.bindings.has(key) && !r.tracks.has(key), 'CHANNEL_OWNED', 'Instance position has another driver.');
    this.layoutSpec = Object.freeze(next);
    for (const r of this.records.values()) {
      r.collectionOwned.add('x');
      r.collectionOwned.add('y');
    }
    this.scene._changed();
    return this;
  }
  sample(context, sampleInfo = null) {
    const s = this.layoutSpec,
      records = [...this.records.values()];
    if (!s) {
      // Reuse the bounded traversal snapshot as its output array. Do not iterate
      // the live Map: a trusted binding can replace/reorder its source data.
      for (let i = 0; i < records.length; i++) records[i] = evaluate(records[i], context, null, false, sampleInfo);
      return records;
    }
    let cols = s.type === 'stack' ? 1 : s.columns;
    if (s.responsive)
      cols = Math.min(
        cols,
        Math.max(1, Math.floor((context.width - s.x - 2 * s.padding + s.gap) / (s.cellWidth + s.gap))),
      );
    const rows = Math.ceil(records.length / cols);
    const requiredWidth =
      s.x +
      2 * s.padding +
      Math.min(cols, records.length) * s.cellWidth +
      Math.max(0, Math.min(cols, records.length) - 1) * s.gap;
    const requiredHeight = s.y + 2 * s.padding + rows * s.cellHeight + Math.max(0, rows - 1) * s.gap;
    assert(
      records.length === 0 || (requiredWidth <= context.width && requiredHeight <= context.height),
      'LAYOUT_OVERFLOW',
      `Layout needs ${Math.ceil(requiredWidth)}×${Math.ceil(requiredHeight)}; received ${context.width}×${context.height}. Increase space or choose a permitted layout.`,
    );
    return records.map((record, i) =>
      evaluate(
        record,
        context,
        {
          x: s.x + s.padding + (i % cols) * (s.cellWidth + s.gap),
          y: s.y + s.padding + Math.floor(i / cols) * (s.cellHeight + s.gap),
        },
        false,
        sampleInfo,
      ),
    );
  }
}
export class Scene {
  #camera = null;
  #regions = new Map();
  #regionScopes = new Map();
  #fonts = new Map();
  #ambients = new Set();
  #located = new WeakMap();
  #locating = new WeakMap();
  #grade = null;
  #light = null;
  #layers = new Map();
  #focus = null;
  #motionBlur = null;
  #notificationDepth = 0;
  #notificationPending = false;
  #roots = [];
  #collections = [];
  #entries = [];
  #sources = new Set();
  #count = 0;
  #next = 0;
  #listeners = new Set();
  #params = [];
  #controls = [];
  #duration = 0;
  #derived = new Set();
  #interactions = new Map();
  #resets = [];
  #tags = new Map();
  #tagged = new Map();
  #adaptive = Object.freeze({ together: Object.freeze([]), minText: 12, targetText: 16 });
  /** @param {{width?:number,height?:number,renderer?:'svg'|'canvas',label?:string,description?:string,maxNodes?:number,duration?:number}} spec */
  constructor(spec = {}) {
    options(spec, ['width', 'height', 'renderer', 'label', 'description', 'maxNodes', 'duration']);
    this.width = number(spec.width ?? 960, 'width', 1, 8192);
    this.height = number(spec.height ?? 540, 'height', 1, 8192);
    this.renderer = spec.renderer ?? 'svg';
    assert(['svg', 'canvas'].includes(this.renderer), 'UNSUPPORTED_RENDERER', 'Use svg or canvas.');
    this.label = text(spec.label ?? 'Interactive visual explanation', 'label', 300);
    this.description = text(spec.description ?? '', 'description', 10000);
    this.maxNodes = number(spec.maxNodes ?? 10000, 'maxNodes', 1, 10000);
    this.#duration = number(spec.duration ?? 0, 'duration', 0, 86400);
  }
  /** @param {string} name @param {ReturnType<typeof import('../import/font.js').parseFont>} face */
  registerFont(name, face) {
    const validated = validateRegisteredFont(name, face);
    this.#fonts.set(name, validated);
    this._changed();
    return this;
  }
  get duration() {
    return this.#duration;
  }
  get nodeCount() {
    return this.#count;
  }
  get controls() {
    return [...this.#controls];
  }
  get activeCamera() {
    return this.#camera;
  }
  get hasAmbient() {
    return this.#ambients.size > 0;
  }
  /** @param {{rate?:number,offset?:number}} [spec] */
  ambient(spec = {}) {
    assert(this.#ambients.size < 64, 'RESOURCE_LIMIT', 'Use at most 64 ambient inputs.');
    const input = new Ambient(spec);
    this.#ambients.add(input);
    this._changed();
    return input;
  }
  space(spec = {}) {
    return createSpace(this, spec);
  }
  light(spec = {}) {
    options(spec, ['angle', 'color', 'ambient'], 'scene light');
    const controls = { ...spec };
    for (const [_k, v] of Object.entries(controls))
      assert(
        typeof v === 'number' || typeof v === 'string' || this._ownsInput(v),
        'INVALID_BINDING',
        'Light inputs must belong to this scene.',
      );
    sceneLight(this._resolveGrade(controls, this._context()));
    this.#light = Object.freeze(controls);
    this._changed();
    return this;
  }
  focus(spec = {}) {
    options(spec, ['depth', 'aperture'], 'scene focus');
    const controls = { depth: spec.depth ?? 1, aperture: spec.aperture ?? 0 };
    for (const v of Object.values(controls))
      assert(typeof v === 'number' || this._ownsInput(v), 'INVALID_BINDING', 'Focus inputs must belong to this scene.');
    const initial = this._resolveGrade(controls, this._context());
    number(initial.depth, 'focus depth', 0.05, 1000);
    number(initial.aperture, 'focus aperture', 0, 8);
    this.#focus = Object.freeze(controls);
    this._changed();
    return this;
  }
  /** @param {{samples?:number,shutter?:number|Parameter|Derived,fps?:number,auto?:boolean|{threshold?:number},threshold?:number}} [spec] */
  motionBlur(spec = {}) {
    const next = motionBlurSpec(
      spec,
      (input) => this._ownsInput(input) && !(input instanceof DataSource),
      (input) => readInput(input, this._context()),
    );
    this.#motionBlur = next;
    this._changed();
    return this;
  }
  layer(spec = {}) {
    options(spec, ['depth', 'bounds'], 'layer');
    const depth = spec.depth ?? 1;
    assert(
      typeof depth === 'number' || this._ownsInput(depth),
      'INVALID_BINDING',
      'Use a layer depth or a scene input.',
    );
    number(typeof depth === 'number' ? depth : readInput(depth, this._context()), 'layer depth', 0.05, 1000);
    const b = spec.bounds ?? { x: 0, y: 0, width: this.width, height: this.height };
    options(b, ['x', 'y', 'width', 'height'], 'layer bounds');
    const bounds = Object.freeze({
      x: number(b.x ?? 0, 'bounds x'),
      y: number(b.y ?? 0, 'bounds y'),
      width: number(b.width, 'bounds width', 1, 8192),
      height: number(b.height, 'bounds height', 1, 8192),
    });
    assert(this.#layers.size < 32, 'RESOURCE_LIMIT', 'Use at most 32 depth layers.');
    return this._batch(() => {
      const handle = this.shape('group', { clip: { type: 'rect', ...bounds, rx: 0 } });
      handle._record.collectionOwned.add('clip');
      this.#layers.set(handle.id, { depth, bounds });
      return handle;
    });
  }
  /** Scene-wide color grade. Numeric controls take numbers or this scene's inputs; tint/shadows/highlights are colors. */
  grade(spec = {}) {
    options(
      spec,
      ['saturation', 'exposure', 'contrast', 'tint', 'tintAmount', 'shadows', 'highlights', 'duotone'],
      'scene grade',
    );
    const controls = {};
    for (const [key, value] of Object.entries(spec)) {
      if (['tint', 'shadows', 'highlights'].includes(key)) {
        controls[key] = value;
        continue;
      }
      assert(
        typeof value === 'number' || this._ownsInput(value),
        'INVALID_BINDING',
        'Use a number or an input owned by this scene.',
      );
      controls[key] = value;
    }
    gradeFrame({ width: 1, height: 1, children: [] }, this._resolveGrade(controls, this._context()));
    this.#grade = Object.freeze(controls);
    this._changed();
    return this;
  }
  _resolveGrade(controls, context) {
    return Object.fromEntries(
      Object.entries(controls).map(([k, v]) => [
        k,
        typeof v === 'number' || typeof v === 'string' ? v : readInput(v, context),
      ]),
    );
  }
  /** @param {string} name @param {{x:number,y:number,width:number,height:number}} spec @param {{content?:NodeHandle,visible?:'inside'|'approach'}} [scope] */
  region(name, spec, scope = {}) {
    assert(
      typeof name === 'string' && /^[a-zA-Z][\w-]{0,63}$/.test(name),
      'CAMERA_REGION',
      'Use a short named camera region.',
    );
    options(spec, ['x', 'y', 'width', 'height'], 'camera region');
    const region = Object.freeze({
      x: number(spec.x, 'region x'),
      y: number(spec.y, 'region y'),
      width: number(spec.width, 'region width', Number.MIN_VALUE),
      height: number(spec.height, 'region height', Number.MIN_VALUE),
    });
    assert(
      this.#regions.has(name) || this.#regions.size < 128,
      'RESOURCE_LIMIT',
      'Use at most128 named camera regions.',
    );
    options(scope, ['content', 'visible'], 'region content');
    let scoped = null;
    if (scope.content !== undefined) {
      const handle = scope.content;
      assert(
        handle instanceof NodeHandle &&
          handle._scene === this &&
          handle._record.type === 'group' &&
          this._pathTo(handle._record)?.length === 1,
        'INVALID_REGION_CONTENT',
        'Use a live top-level group owned by this scene.',
      );
      const visible = scope.visible ?? 'inside';
      assert(
        ['inside', 'approach'].includes(visible),
        'INVALID_REGION_CONTENT',
        'Region visibility is inside or approach.',
      );
      assert(
        ![...this.#regionScopes.entries()].some(([key, value]) => key !== name && value.id === handle.id),
        'INVALID_REGION_CONTENT',
        'A content group may belong to one region.',
      );
      scoped = { box: region, id: handle.id, visible };
    } else assert(scope.visible === undefined, 'INVALID_REGION_CONTENT', 'A visibility policy needs content.');
    this.#regions.set(name, region);
    if (scoped) this.#regionScopes.set(name, Object.freeze(scoped));
    else this.#regionScopes.delete(name);
    this._changed();
    return this;
  }
  _scopeRegionContent(frame, matrix = [1, 0, 0, 1, 0, 0], screenRoots) {
    return scopeRegionContent(frame, this.#regionScopes, matrix, screenRoots);
  }
  _region(name) {
    assert(
      this.#regions.has(name),
      'CAMERA_REGION',
      `Unknown camera region ${name}; register it before authoring shots.`,
    );
    return this.#regions.get(name);
  }
  /** One camera per scene. Its pose uses the same binding/track contracts as artwork. */
  camera(spec = {}) {
    if (this.#camera) {
      options(spec, [], 'existing camera');
      return this.#camera;
    }
    const defaults = cameraDefaults(this, spec);
    const b = blueprint({
      type: 'group',
      props: { x: defaults.x, y: defaults.y, scaleX: defaults.zoom, rotation: defaults.rotation },
    });
    this._capacity(1);
    const record = this._instantiate(b),
      handle = new NodeHandle(this, record);
    this.#camera = new Camera(this, handle, (context) => evaluate(record, context).props, defaults, spec);
    this._changed();
    return this.#camera;
  }
  _isRootHandle(handle) {
    return this.#entries.some(
      (entry) =>
        entry.record === handle._record ||
        (entry.collection && [...entry.collection.records.values()].includes(handle._record)),
    );
  }
  _assertLiftRoot(handle) {
    assert(
      handle instanceof NodeHandle && handle._scene === this,
      'INVALID_LAYER',
      'Lift a live drawable from this scene.',
    );
    handle._live();
    const path = this._pathTo(handle._record);
    assert(path, 'DETACHED_HANDLE', 'Use an attached drawable.');
    const root = path[0],
      at = this.#entries.findIndex((entry) => entry.record === root);
    assert(
      at >= 0 && !this.#layers.has(root.id) && ![...this.#regionScopes.values()].some((scope) => scope.id === root.id),
      'INVALID_LAYER',
      'Lifting collection, depth-layer or region content is unsupported.',
    );
    return path;
  }
  // Glyph lifecycle lifts its private placement wrapper once at authoring time.
  // Historical parent transforms remain the caller's sampled binding responsibility.
  _liftRoot(handle) {
    const path = this._assertLiftRoot(handle),
      root = path[0],
      at = this.#entries.findIndex((entry) => entry.record === root);
    if (path.length === 1) return handle;
    const parent = path.at(-2),
      key = [...parent.children].find(([, record]) => record === handle._record)?.[0];
    assert(key !== undefined, 'DETACHED_HANDLE', 'The drawable is no longer attached to its parent.');
    parent.children.delete(key);
    this.#entries.splice(at + 1, 0, { record: handle._record });
    this.#roots.splice(this.#roots.indexOf(root) + 1, 0, handle._record);
    this._changed();
    return handle;
  }
  _child(parent, type, props = {}) {
    const captured = captureHandleClip(this, props, parent._record),
      handle = this._childDefinition(parent, blueprint({ type, props: captured.input }));
    commitHandleClip(handle._record, captured, true);
    return handle;
  }
  _recordDepth(record) {
    let found = -1;
    const visit = (r, depth) => {
      if (r === record) found = depth;
      for (const child of r.children.values()) visit(child, depth + 1);
    };
    for (const e of this.#entries)
      for (const r of e.collection ? e.collection.records.values() : [e.record]) visit(r, 0);
    assert(found >= 0, 'DETACHED_HANDLE', 'Use an attached group.');
    return found;
  }
  _childDefinition(parent, definition) {
    parent._live();
    assert(
      parent._scene === this && parent._record.type === 'group',
      'INVALID_LAYER',
      'Add children to a live group in this scene.',
    );
    const height = (b) => Math.max(0, ...Object.values(b.children).map((c) => 1 + height(c)));
    assert(
      this._recordDepth(parent._record) + 1 + height(definition) <= 24,
      'RESOURCE_LIMIT',
      'Authored hierarchy exceeds24 levels.',
    );
    this._capacity(countParts(definition));
    const record = this._instantiate(definition);
    parent._record.children.set(record.id, record);
    this._changed();
    return new NodeHandle(this, record);
  }
  _adopt(parent, handle) {
    parent._live();
    assert(handle instanceof NodeHandle, 'INVALID_LAYER', 'Adopt a drawable handle from this scene.');
    handle._live();
    assert(
      parent._scene === this &&
        parent._record.type === 'group' &&
        handle?._scene === this &&
        parent !== handle &&
        this.#entries.some((e) => e.record === handle._record) &&
        !this.#layers.has(handle.id),
      'INVALID_LAYER',
      'Adopt a distinct top-level drawable; nested depth layers are unsupported.',
    );
    validateClipAdoption(parent._record, handle._record);
    const contains = (r) => r === parent._record || [...r.children.values()].some(contains);
    assert(!contains(handle._record), 'INVALID_LAYER', 'A group cannot adopt its ancestor.');
    const height = (r) => Math.max(0, ...[...r.children.values()].map((c) => 1 + height(c)));
    assert(
      this._recordDepth(parent._record) + 1 + height(handle._record) <= 24,
      'RESOURCE_LIMIT',
      'Authored hierarchy exceeds24 levels.',
    );
    this.#entries = this.#entries.filter((e) => e.record !== handle._record);
    this.#roots = this.#roots.filter((r) => r !== handle._record);
    parent._record.children.set(handle.id, handle._record);
    this._changed();
  }
  _interaction(id) {
    if (!this.#interactions.has(id)) this.#interactions.set(id, {});
    return this.#interactions.get(id);
  }
  /** Interaction records for a node ID: {explain, tap, drag}. Players use this for picking. */
  interaction(id) {
    return this.#interactions.get(id) ?? null;
  }
  /** Define a tag, optionally under a parent tag. The tree is acyclic; defining an existing tag again must agree. */
  defineTag(name, { parent = null } = {}) {
    assert(
      /^[a-zA-Z][\w-]{0,63}$/.test(name),
      'INVALID_TAG',
      'Tags are short names: a letter, then letters, digits, - or _.',
    );
    if (parent !== null) {
      assert(this.#tags.has(parent), 'UNKNOWN_TAG', `Define the parent tag ${parent} first.`);
    }
    const existing = this.#tags.get(name);
    if (existing) {
      assert(
        existing.parent === parent || parent === null,
        'INVALID_TAG',
        `${name} already sits under ${existing.parent ?? 'the root'}.`,
      );
      return this;
    }
    this.#tags.set(name, Object.freeze({ name, parent }));
    return this;
  }
  _tagNode(id, name) {
    if (!this.#tags.has(name)) this.defineTag(name);
    if (!this.#tagged.has(id)) this.#tagged.set(id, new Set());
    this.#tagged.get(id).add(name);
  }
  /** A tag and its ancestors, nearest first. */
  tagPath(name) {
    const path = [];
    for (let t = this.#tags.get(name); t; t = t.parent ? this.#tags.get(t.parent) : null) path.push(t.name);
    return path;
  }
  /** Every tag a node carries, including ancestors of its tags. */
  tagsOf(id) {
    const out = new Set();
    for (const name of this.#tagged.get(id) ?? []) for (const t of this.tagPath(name)) out.add(t);
    return [...out];
  }
  /** IDs of nodes carrying a tag or any tag beneath it. */
  tagged(name) {
    assert(this.#tags.has(name), 'UNKNOWN_TAG', `Unknown tag ${name}.`);
    return [...this.#tagged]
      .filter(([, set]) => [...set].some((t) => this.tagPath(t).includes(name)))
      .map(([id]) => id);
  }
  /**
   * How this scene may adapt to other screens. `together` lists tags whose members must stay one block,
   * never split or wrapped. Readability is in CSS pixels. Read by players through `adaptivePolicy`.
   */
  adaptive(spec) {
    options(spec, ['together', 'minText', 'targetText'], 'adaptive');
    const together = spec.together ?? [];
    assert(Array.isArray(together), 'INVALID_LAYOUT', 'together is a list of tags.');
    for (const t of together) assert(this.#tags.has(t), 'UNKNOWN_TAG', `Unknown tag ${t}.`);
    this.#adaptive = Object.freeze({
      together: Object.freeze([...together]),
      minText: number(spec.minText ?? 12, 'minText', 1, 200),
      targetText: number(spec.targetText ?? 16, 'targetText', 1, 200),
    });
    return this;
  }
  get adaptivePolicy() {
    return this.#adaptive;
  }
  /** Run after reset(), to return scene-owned data to its authored state. */
  onReset(fn) {
    assert(typeof fn === 'function', 'INVALID_INTERACTION', 'onReset needs a function.');
    this.#resets.push(fn);
    return this;
  }
  _ownsParameter(p) {
    return this.#params.includes(p);
  }
  _ownsInput(p) {
    return this.#params.includes(p) || this.#derived.has(p) || this.#sources.has(p) || this.#ambients.has(p);
  }
  _extend(end) {
    this.#duration = Math.max(this.#duration, end);
  }
  _changed() {
    if (this.#notificationDepth) {
      this.#notificationPending = true;
      return;
    }
    for (const fn of this.#listeners) fn();
  }
  _batch(callback) {
    this.#notificationDepth++;
    try {
      return callback();
    } finally {
      this.#notificationDepth--;
      if (!this.#notificationDepth && this.#notificationPending) {
        this.#notificationPending = false;
        this._changed();
      }
    }
  }
  onChange(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }
  _context() {
    return Object.freeze({ time: 0, width: this.width, height: this.height });
  }
  _capacity(extra) {
    assert(this.#count + extra <= this.maxNodes, 'RESOURCE_LIMIT', `Scene exceeds ${this.maxNodes} nodes.`);
  }
  _instantiate(b) {
    this.#count++;
    const r = {
      id: `n${++this.#next}`,
      type: b.type,
      props: { ...b.props },
      sourceProps: { ...b.props },
      children: new Map(),
      bindings: new Map(),
      tracks: new Map(),
      overrides: new Set(),
      collectionOwned: new Set(),
    };
    for (const [k, c] of Object.entries(b.children)) r.children.set(k, this._instantiate(c));
    return r;
  }
  _remove(r) {
    r.detached = true;
    this.#count--;
    for (const c of r.children.values()) this._remove(c);
  }
  shape(type, props = {}) {
    const captured = captureHandleClip(this, props),
      b = blueprint({ type, props: captured.input });
    this._capacity(1);
    const r = this._instantiate(b);
    commitHandleClip(r, captured, true);
    this.#roots.push(r);
    this.#entries.push({ record: r });
    this._changed();
    return new NodeHandle(this, r);
  }
  _isAdoptableRoot(handle) {
    return (
      handle instanceof NodeHandle &&
      handle._scene === this &&
      !handle._record.detached &&
      this.#entries.some((e) => e.record === handle._record) &&
      !this.#layers.has(handle.id)
    );
  }
  _containsRecord(record) {
    let found = false;
    const visit = (r) => {
      if (r === record) found = true;
      for (const child of r.children.values()) visit(child);
    };
    for (const e of this.#entries) for (const r of e.collection ? e.collection.records.values() : [e.record]) visit(r);
    return found;
  }
  /** @param {Record<string,any>} props @param {any[]} children */
  group(props = {}, children = []) {
    const captured = captureHandleClip(this, props);
    blueprint({ type: 'group', props: captured.input });
    assert(
      Array.isArray(children) && children.length <= 10000,
      'INVALID_GROUP',
      'Group children must be root handles.',
    );
    const records = new Set();
    const height = (r) => Math.max(0, ...[...r.children.values()].map((c) => 1 + height(c)));
    for (let i = 0; i < children.length; i++) {
      const d = Object.getOwnPropertyDescriptor(children, i),
        h = d && 'value' in d ? d.value : null;
      assert(
        h instanceof NodeHandle &&
          h._scene === this &&
          !h._record.detached &&
          this.#entries.some((e) => e.record === h._record) &&
          !this.#layers.has(h.id) &&
          !records.has(h._record),
        'INVALID_GROUP',
        'Adopt each live root of this scene once.',
      );
      assert(height(h._record) + 1 <= 24, 'RESOURCE_LIMIT', 'Grouped hierarchy exceeds24 levels.');
      records.add(h._record);
    }
    this._capacity(1);
    return this._batch(() => {
      const g = this.shape('group', props);
      for (const child of children) this._adopt(g, child);
      return g;
    });
  }
  /** Internal composition transaction: group contiguous roots without changing paint order. */
  _groupContiguous(children, props = {}) {
    assert(Array.isArray(children) && children.length > 0, 'INVALID_GROUP', 'Use a nonempty list of contiguous roots.');
    const indices = children.map((h) => this.#entries.findIndex((e) => e.record === h?._record));
    assert(
      indices.every((index, i) => index >= 0 && index === indices[0] + i),
      'INVALID_GROUP',
      'Use contiguous scene roots in their paint order.',
    );
    assert(
      !children.some((h) => [...this.#regionScopes.values()].some((scope) => scope.id === h.id)),
      'INVALID_GROUP',
      'Release region content scopes before grouping their roots.',
    );
    const at = indices[0],
      rootAt = this.#roots.indexOf(children[0]._record);
    return this._batch(() => {
      const group = this.group(props, children),
        entry = this.#entries.pop();
      this.#entries.splice(at, 0, entry);
      this.#roots.pop();
      this.#roots.splice(rootAt, 0, group._record);
      return group;
    });
  }
  /** @param {{rx?:number,ry?:number,startAngle?:number,endAngle?:number,closed?:boolean,[key:string]:any}} p */
  /** @param {Record<string,any>&{rx?:number,ry?:number,startAngle?:number,endAngle?:number,closed?:boolean}} [p] */
  ellipse(p = {}) {
    return this.shape('path', ellipsePathProps(p));
  }
  circle(p = {}) {
    return this.shape('circle', p);
  }
  rect(p = {}) {
    return this.shape('rect', p);
  }
  line(p = {}) {
    return this.shape('line', p);
  }
  path(p = {}) {
    return this.shape('path', p);
  }
  text(p = {}) {
    return this.shape('text', p);
  }
  cloud(p = {}) {
    return this.shape('cloud', p);
  }
  component(definition) {
    return new Component(this, blueprint(definition));
  }
  instance(component) {
    assert(
      component instanceof Component && component.scene === this,
      'INVALID_COMPONENT',
      'Use a component from this scene.',
    );
    this._capacity(countParts(component.definition));
    const r = this._instantiate(component.definition);
    component.instances.add(r);
    this.#roots.push(r);
    this.#entries.push({ record: r });
    this._changed();
    return new NodeHandle(this, r);
  }
  data(rows, spec) {
    options(spec, ['key', 'maxRows']);
    const d = new DataSource(rows, spec, () => this._changed());
    this.#sources.add(d);
    return d;
  }
  repeat(component, { data }) {
    assert(
      component instanceof Component && component.scene === this && this.#sources.has(data),
      'INVALID_REPEAT',
      'Repeat a scene component over a data source.',
    );
    const c = new Collection(this, component, data);
    this.#collections.push(c);
    this.#entries.push({ collection: c });
    this._changed();
    return c;
  }
  parameter(value, spec = {}) {
    options(spec, ['min', 'max']);
    const p = new Parameter(
      value,
      spec,
      () => this._changed(),
      (end) => this._extend(end),
    );
    this.#params.push(p);
    return p;
  }
  derive(inputs, map) {
    assert(typeof map === 'function', 'INVALID_BINDING', 'derive needs a map function.');
    const d = new Derived(captureInputs(this, inputs), map);
    this.#derived.add(d);
    return d;
  }
  control(parameter, spec) {
    options(spec, ['label', 'step']);
    assert(this.#params.includes(parameter), 'INVALID_CONTROL', 'Control a parameter from this scene.');
    const label = text(spec.label, 'control label', 200);
    assert(label.length > 0, 'INVALID_CONTROL', 'A control needs an accessible label.');
    const step = number(spec.step ?? 0.01, 'step', 1e-6, 1e7);
    this.#controls.push(Object.freeze({ parameter, label, step }));
    return this;
  }
  _checkpoint() {
    return this.#params.map((p) => p.checkpoint());
  }
  _restore(states) {
    this.#params.forEach((p, i) => p.restore(states[i]));
  }
  reset() {
    for (const p of this.#params) p.reset();
    for (const fn of this.#resets) fn();
    return this;
  }
  _sampleContext({
    time = 0,
    width = this.width,
    height = this.height,
    effects = true,
    ambient = 0,
    displayWidth = width,
  } = {}) {
    assert(typeof effects === 'boolean', 'INVALID_EFFECT', 'effects must be boolean.');
    number(ambient, 'ambient time', 0, 86400);
    return Object.freeze({
      time: number(time, 'time', 0, 86400),
      width: number(width, 'width', 1, 8192),
      height: number(height, 'height', 1, 8192),
      ...(displayWidth === width ? {} : { displayWidth: number(displayWidth, 'display width', 1, 16384) }),
      ...(ambient ? { ambient } : {}),
      ...(effects ? {} : { effects: false }),
    });
  }
  profile(spec = {}) {
    const context = this._sampleContext(spec),
      now = () => performance.now(),
      profile = { now, nodes: [] },
      start = now();
    profiles.set(context, profile);
    let frame;
    try {
      frame = this._sampleWorld(context);
    } finally {
      profiles.delete(context);
    }
    return Object.freeze({
      frame,
      totalMS: now() - start,
      nodes: Object.freeze(profile.nodes.sort((a, b) => b.selfMS - a.selfMS).map(Object.freeze)),
    });
  }
  _sampleWorld(context, effects = true) {
    if (effects === false && context.effects !== false) context = Object.freeze({ ...context, effects: false });
    // Collect optional work during the existing validated evaluation. This is
    // sample-local: bindings, effects, collection replacements and handle clips
    // are still reevaluated on every call, including repeated/backward times.
    const sampleInfo = { dynamicClips: false, text: false },
      children = [];
    const entries = this.#entries;
    for (let i = 0, length = entries.length; i < length; i++) {
      const entry = entries[i];
      if (entry.collection) {
        for (const node of entry.collection.sample(context, sampleInfo)) children.push(node);
      } else children.push(evaluate(entry.record, context, null, false, sampleInfo));
    }
    const frame = { width: context.width, height: context.height, children };
    if (sampleInfo.text) for (const node of frame.children) resolveRegisteredText(node, this.#fonts);
    // A full world-coordinate index is needed only when an evaluated node
    // actually refers to another scene handle as its dynamic clip.
    if (sampleInfo.dynamicClips) resolveDynamicClips(frame);
    if (this.description) frame.description = this.description;
    const focus = this.#focus ? this._resolveGrade(this.#focus, context) : null;
    for (const node of frame.children) {
      const layer = this.#layers.get(node.id);
      if (layer) {
        const depth = number(
          typeof layer.depth === 'number' ? layer.depth : readInput(layer.depth, context),
          'layer depth',
          0.05,
          1000,
        );
        node.layerCache = Object.freeze({ depth, bounds: layer.bounds });
        if (focus) {
          const radius = number(blurRadius(node.props.blur) + focusBlur(depth, focus), 'layer blur', 0, 64);
          node.props.blur = typeof node.props.blur === 'object' ? { ...node.props.blur, radius } : radius;
        }
      }
    }
    if (this.#light) frame.light = sceneLight(this._resolveGrade(this.#light, context));
    return markSampled(this.#grade === null ? frame : gradeFrame(frame, this._resolveGrade(this.#grade, context)));
  }
  sampleWorld(spec = {}) {
    return this._sampleWorld(this._sampleContext(spec));
  }
  sampleView(spec = {}) {
    const context = this._sampleContext(spec),
      sampled = this._sampleViewAt(context);
    if (this.#motionBlur) {
      const config = this.#motionBlur,
        shutter = typeof config.shutter === 'number' ? config.shutter : readInput(config.shutter, context);
      number(shutter, 'shutter fraction', 0, 1);
      // Zero shutter deliberately makes no additional scene samples or geometry probes.
      if (shutter > 0) {
        const active =
          !config.auto ||
          projectedMotion(
            this._sampleViewAt(Object.freeze({ ...context, time: Math.max(0, context.time - 1 / config.fps) })).frame,
            sampled.frame,
          ) > config.threshold;
        if (active) {
          const times = shutterTimes(context.time, { samples: config.samples, shutter, fps: config.fps });
          sampled.frame = {
            ...sampled.frame,
            motionBlur: {
              frames: times.map((time) => this._sampleViewAt(Object.freeze({ ...context, time })).frame),
              weights: times.map(() => 1 / times.length),
            },
          };
        }
      }
    }
    return sampled;
  }
  _sampleViewAt(context) {
    const frame = this._sampleWorld(context);
    if (!this.#camera)
      return {
        frame: responsiveText(this._scopeRegionContent(frame), context.displayWidth ?? context.width),
        view: null,
      };
    const { frame: projected, ...view } = this.#camera.project(frame, context);
    return { frame: responsiveText(projected, context.displayWidth ?? context.width), view: Object.freeze(view) };
  }
  sample(spec = {}) {
    return this.sampleView(spec).frame;
  }
  _evaluateOwn(record, context) {
    return evaluateOwn(record, context);
  }
  _pathTo(record) {
    const search = (r, trail) => {
      if (r === record) return [...trail, r];
      for (const c of r.children.values()) {
        const found = search(c, [...trail, r]);
        if (found) return found;
      }
      return null;
    };
    for (const e of this.#entries)
      for (const r of e.collection ? e.collection.records.values() : [e.record]) {
        const found = search(r, []);
        if (found) return found;
      }
    return null;
  }
  /**
   * Where a node is at a time, in scene (world) space before the camera: its origin, the frame-space box of
   * it and its descendants, its transform and its effective opacity. Safe inside another node's binding,
   * as long as the located node does not itself depend on that binding.
   */
  locate(handle, spec = {}) {
    assert(
      handle instanceof NodeHandle && handle._scene === this,
      'INVALID_LOCATE',
      'Locate a node handle from this scene.',
    );
    handle._live();
    options(spec, ['time', 'width', 'height', 'effects', 'ambient', 'displayWidth'], 'locate');
    assert(
      spec.effects === undefined || typeof spec.effects === 'boolean',
      'INVALID_EFFECT',
      'effects must be boolean.',
    );
    const supplied = spec.time;
    let context;
    if (supplied !== null && typeof supplied === 'object') {
      options(supplied, ['time', 'width', 'height', 'effects', 'ambient', 'displayWidth'], 'locate context');
      assert(Object.isFrozen(supplied), 'INVALID_LOCATE', 'Use the immutable context supplied to a scene binding.');
      number(supplied.time, 'time', 0, 86400);
      number(supplied.width, 'width', 1, 8192);
      number(supplied.height, 'height', 1, 8192);
      if (supplied.ambient !== undefined) number(supplied.ambient, 'ambient time', 0, 86400);
      if (supplied.displayWidth !== undefined) number(supplied.displayWidth, 'display width', 1, 16384);
      context = supplied;
    } else context = this._sampleContext(spec);
    if (spec.effects === false && context.effects !== false) context = Object.freeze({ ...context, effects: false });
    // One sample context shares results: several labels attached to one figure locate it once.
    let cache = this.#located.get(context);
    if (!cache) {
      cache = new Map();
      this.#located.set(context, cache);
    }
    if (cache.has(handle._record)) return cache.get(handle._record);
    let active = this.#locating.get(context);
    if (!active) {
      active = new Set();
      this.#locating.set(context, active);
    }
    assert(
      !active.has(handle._record),
      'LOCATE_CYCLE',
      'Located geometry depends on itself through a binding or sampled pivot.',
    );
    active.add(handle._record);
    try {
      const path = this._pathTo(handle._record);
      assert(path, 'DETACHED_HANDLE', 'The node is not attached to this scene.');
      let matrix = IDENTITY,
        opacity = 1;
      for (const r of path.slice(0, -1)) {
        const own = evaluateOwn(r, context);
        if (typeof own.props.pivot === 'string' && own.props.pivot !== 'origin')
          own.children = [...r.children.values()].map((child) => evaluate(child, context));
        if (this.#fonts.size) resolveRegisteredText(own, this.#fonts);
        matrix = multiply(matrix, localMatrix(own.props, own));
        opacity *= own.props.opacity ?? 1;
      }
      const node = evaluate(handle._record, context);
      if (this.#fonts.size) resolveRegisteredText(node, this.#fonts);
      const m = multiply(matrix, localMatrix(node.props, node)),
        measured = measureNode(node, undefined, matrix, opacity);
      const box = measured
        ? {
            x: measured.box.x0,
            y: measured.box.y0,
            width: measured.box.x1 - measured.box.x0,
            height: measured.box.y1 - measured.box.y0,
          }
        : null;
      const result = {
        x: m[4],
        y: m[5],
        box: box && Object.freeze(box),
        matrix: Object.freeze(m),
        opacity: opacity * (node.props.opacity ?? 1),
        visible: !!measured?.visible,
      };
      Object.defineProperty(result, 'parentMatrix', { value: Object.freeze(matrix) });
      Object.freeze(result);
      cache.set(handle._record, result);
      return result;
    } finally {
      active.delete(handle._record);
    }
  }
  async mount(container, localOptions1 = {}) {
    const { mount } = await import('../player/index.js');
    return mount(this, container, localOptions1);
  }
}
