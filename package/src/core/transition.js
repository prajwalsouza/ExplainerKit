import { assert, number, text, options } from './validate.js';
import { properties } from './geometry.js';
import { createMorph } from '../morph/contour.js';
import { colorInterpolator } from '../color/interpolate.js';
import { cloudPoints } from '../graphics/cloud.js';
import { sceneLight } from '../graphics/lighting.js';

const MAX_NODES = 10000;
const MAX_VALUES = 500000;
// Display wrappers may surround the separately bounded 24-level authored tree.
const MAX_DEPTH = 192;

// Snapshot input is declarative data, never executable application bindings.
// Copy descriptors before reading so getters are rejected rather than invoked.
function copyData(value, budget, depth = 0) {
  assert(
    depth <= MAX_DEPTH && ++budget.values <= MAX_VALUES,
    'RESOURCE_LIMIT',
    'State exceeds snapshot depth or value limits.',
  );
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    number(value, 'state number', -1e100, 1e100);
    return value;
  }
  // Point-cloud buffers are copied, never shared, and count as one value per 64 numbers.
  if (value instanceof Float32Array || value instanceof Float64Array) {
    budget.values += Math.ceil(value.length / 64);
    assert(budget.values <= MAX_VALUES, 'RESOURCE_LIMIT', 'State exceeds snapshot depth or value limits.');
    return new Float32Array(value);
  }
  assert(value && typeof value === 'object', 'INVALID_STATE', 'State must contain declarative data only.');
  const array = Array.isArray(value);
  assert(
    array || Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null,
    'INVALID_STATE',
    'State must contain plain objects and arrays.',
  );
  if (array) assert(value.length <= MAX_VALUES, 'RESOURCE_LIMIT', 'State array is too large.');
  const output = array ? [] : Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (array && key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    assert(
      typeof key === 'string' && descriptor.enumerable && 'value' in descriptor,
      'INVALID_STATE',
      'State properties must be enumerable values, not accessors or symbols.',
    );
    assert(!['__proto__', 'constructor', 'prototype'].includes(key), 'INVALID_STATE', 'Reserved state property.');
    if (array)
      assert(
        /^(0|[1-9]\d*)$/.test(key) && Number(key) < value.length,
        'INVALID_STATE',
        'State arrays must contain only indexed values.',
      );
    output[key] = copyData(descriptor.value, budget, depth + 1);
  }
  if (array)
    assert(
      output.length === value.length && Object.keys(output).length === value.length,
      'INVALID_STATE',
      'Sparse state arrays are unsupported.',
    );
  return output;
}

/** Capture an independent, immutable frame. Does not retain bindings or drivers. */
export function captureState(frame) {
  const input = copyData(frame, { values: 0 });
  options(input, ['width', 'height', 'children', 'light', 'motionBlur'], 'state');
  const width = number(input.width, 'state width', 1, 8192);
  const height = number(input.height, 'state height', 1, 8192);
  const ids = new Set();
  let commandCount = 0;
  function captureNode(node, depth) {
    assert(depth <= 64 && ids.size < MAX_NODES, 'RESOURCE_LIMIT', 'State exceeds node or hierarchy limits.');
    options(node, ['id', 'type', 'props', 'children', 'layerCache'], 'state node');
    const id = text(node.id, 'state node id', 300);
    assert(id.length > 0 && !ids.has(id), 'DUPLICATE_ID', 'State node IDs must be nonempty and unique.');
    ids.add(id);
    const type = text(node.type, 'state node type', 32);
    const props = Object.freeze(properties(type, node.props ?? {}));
    commandCount += (props.commands?.length ?? 0) + (props.clip?.commands?.length ?? 0);
    assert(commandCount <= 100000, 'RESOURCE_LIMIT', 'State exceeds the shared path/clip command budget.');
    const children = node.children ?? [];
    assert(Array.isArray(children), 'INVALID_STATE', 'Node children must be an array.');
    assert(type === 'group' || children.length === 0, 'INVALID_CHILDREN', 'Only group nodes may contain children.');
    let layerCache;
    if (node.layerCache) {
      const v = node.layerCache;
      options(v, ['depth', 'bounds'], 'layer cache');
      options(v.bounds, ['x', 'y', 'width', 'height'], 'layer bounds');
      assert(type === 'group', 'INVALID_LAYER', 'Only groups cache depth layers.');
      layerCache = Object.freeze({
        depth: number(v.depth ?? 1, 'layer depth', 0.05, 1000),
        bounds: Object.freeze({
          x: number(v.bounds.x, 'bounds x'),
          y: number(v.bounds.y, 'bounds y'),
          width: number(v.bounds.width, 'bounds width', 1, 8192),
          height: number(v.bounds.height, 'bounds height', 1, 8192),
        }),
      });
    }
    return Object.freeze({
      id,
      type,
      props,
      ...(layerCache ? { layerCache } : {}),
      children: Object.freeze(children.map((child) => captureNode(child, depth + 1))),
    });
  }
  assert(Array.isArray(input.children), 'INVALID_STATE', 'State children must be an array.');
  const children = Object.freeze(input.children.map((child) => captureNode(child, 0))),
    light = input.light ? sceneLight(input.light) : null;
  let motionBlur;
  if (input.motionBlur) {
    options(input.motionBlur, ['frames', 'weights'], 'motion blur');
    const { frames, weights } = input.motionBlur;
    assert(
      Array.isArray(frames) &&
        frames.length > 0 &&
        frames.length <= 16 &&
        Array.isArray(weights) &&
        weights.length === frames.length,
      'INVALID_MOTION_BLUR',
      'Use at most16 weighted exposure frames.',
    );
    assert(
      frames.every((f) => !f.motionBlur),
      'INVALID_MOTION_BLUR',
      'Nested exposures are unsupported.',
    );
    motionBlur = Object.freeze({
      frames: Object.freeze(frames.map(captureState)),
      weights: Object.freeze(weights.map((w) => number(w, 'exposure weight', 0, 1))),
    });
    assert(
      Math.abs(weights.reduce((a, b) => a + b, 0) - 1) < 1e-9,
      'INVALID_MOTION_BLUR',
      'Exposure weights must total1.',
    );
  }
  return Object.freeze({ width, height, children, ...(light ? { light } : {}), ...(motionBlur ? { motionBlur } : {}) });
}

function indexState(state) {
  const index = new Map();
  function visit(node, parent) {
    index.set(node.id, { node, parent });
    for (const child of node.children) visit(child, node.id);
  }
  state.children.forEach((node) => visit(node, null));
  return index;
}

/**
 * Prepare a deterministic, linear state transition. Each endpoint is captured
 * once. Identity, type, parent and path topology must match; split/merge,
 * entering/exiting, reparenting and automatic path matching are unsupported.
 *
 * Numeric properties interpolate directly (rotation follows signed radians).
 * Text, colors and categorical descriptors switch at the end by default;
 * discrete:'start' switches immediately after progress zero. Explicit paths:morph
 * and colors:srgb/linearRGB opt into prepared contour and paint interpolation.
 * Sibling order switches only at progress one, independently of discrete policy.
 */
export function createTransition(from, to, spec = {}) {
  options(spec, ['discrete', 'paths', 'pathOptions', 'colors'], 'transition');
  const discrete = spec.discrete ?? 'end';
  assert(discrete === 'end' || discrete === 'start', 'INVALID_TRANSITION', "discrete must be 'end' or 'start'.");
  const paths = spec.paths ?? 'strict',
    colors = spec.colors ?? 'discrete';
  assert(['strict', 'morph'].includes(paths), 'INVALID_TRANSITION', 'Use strict or morph paths.');
  assert(
    ['discrete', 'srgb', 'linearRGB'].includes(colors),
    'INVALID_TRANSITION',
    'Use discrete, srgb or linearRGB colors.',
  );
  const pathOptions = spec.pathOptions ?? {};
  options(pathOptions, ['samples', 'tolerance', 'align', 'reverse', 'offset', 'landmarks'], 'transition path options');
  assert(
    paths === 'morph' || Object.keys(pathOptions).length === 0,
    'INVALID_TRANSITION',
    'pathOptions require paths:morph.',
  );
  const a = captureState(from),
    b = captureState(to);
  assert(
    !a.motionBlur && !b.motionBlur,
    'INVALID_TRANSITION',
    'Transition unexposed scene states; sample motion blur after the transition.',
  );
  const source = indexState(a),
    target = indexState(b),
    prepared = new Map();
  if (paths === 'morph') {
    const count = number(pathOptions.samples ?? 128, 'morph samples', 2, 512);
    assert(Number.isInteger(count), 'INVALID_MORPH', 'Samples must be an integer.');
    const nodes = [...source.values()].filter((e) => e.node.type === 'path');
    const clipCommands = [...source.values()].reduce(
      (n, e) =>
        n +
        Math.max(
          e.node.props.clip?.commands?.length ?? 0,
          target.get(e.node.id)?.node.props.clip?.commands?.length ?? 0,
        ),
      0,
    );
    assert(
      nodes.length * (count + 1) + clipCommands <= 100000 && nodes.length * count * count <= 8000000,
      'RESOURCE_LIMIT',
      'Transition morph exceeds output/preparation budgets. Use fewer samples or transition fewer paths.',
    );
  }
  assert(
    source.size === target.size,
    'UNMATCHED_STATE',
    'Both states must contain the same IDs; entering/exiting needs an explicit future policy.',
  );
  for (const [id, entry] of source) {
    const match = target.get(id);
    assert(match, 'UNMATCHED_STATE', `Target state has no match for ${id}.`);
    assert(entry.node.type === match.node.type, 'STATE_TYPE_MISMATCH', `Node ${id} changes shape type.`);
    assert(entry.parent === match.parent, 'STATE_HIERARCHY_MISMATCH', `Node ${id} changes parent.`);
    const numeric = [],
      categorical = [],
      paints = [];
    let commands = null,
      morph = null,
      cloud = null;
    for (const [key, value] of Object.entries(entry.node.props)) {
      const end = match.node.props[key];
      if (typeof value === 'number') numeric.push([key, value, end]);
      else if (
        (key === 'fill' || key === 'stroke') &&
        colors !== 'discrete' &&
        typeof value === 'string' &&
        typeof end === 'string' &&
        value.toLowerCase() !== 'none' &&
        end.toLowerCase() !== 'none'
      )
        paints.push([key, colorInterpolator(value, end, { space: colors })]);
      else if (key === 'points') {
        // Equal-count clouds move point by point; otherwise the cloud switches like other categorical values.
        const sameShape = value.count === end.count && !value.radii === !end.radii && !value.colors === !end.colors;
        if (sameShape) cloud = [value, end];
        else categorical.push([key, value, end]);
      } else if (key === 'commands') {
        if (paths === 'morph') {
          morph = createMorph(value, end, pathOptions);
          continue;
        }
        assert(value.length === end.length, 'PATH_TOPOLOGY_MISMATCH', `Node ${id} needs equal path command counts.`);
        commands = value.map((command, i) => {
          const other = end[i];
          assert(
            command[0] === other[0] && command.length === other.length,
            'PATH_TOPOLOGY_MISMATCH',
            `Node ${id} needs matching path commands.`,
          );
          return { opcode: command[0], from: command.slice(1), to: other.slice(1) };
        });
      } else categorical.push([key, value, end]);
    }
    prepared.set(id, { numeric, categorical, commands, morph, paints, cloud });
  }
  const lerp = (start, end, progress) => start + (end - start) * progress;
  return Object.freeze({
    sample(progress) {
      number(progress, 'transition progress', 0, 1);
      if (progress === 0) return a;
      if (progress === 1) return b;
      function sampleNode(node) {
        const plan = prepared.get(node.id),
          props = {};
        for (const [key, start, end] of plan.numeric) props[key] = lerp(start, end, progress);
        for (const [key, start, end] of plan.categorical) props[key] = discrete === 'start' ? end : start;
        for (const [key, sample] of plan.paints) props[key] = sample(progress);
        if (plan.morph) props.commands = plan.morph.sample(progress);
        if (plan.cloud) {
          const [localA1, localB2] = plan.cloud,
            mix = (x, y) => x && Float32Array.from(x, (v, i) => v + (y[i] - v) * progress);
          props.points = cloudPoints({
            positions: mix(localA1.positions, localB2.positions),
            radii: mix(localA1.radii, localB2.radii),
            colors: mix(localA1.colors, localB2.colors),
          });
        }
        if (plan.commands)
          props.commands = Object.freeze(
            plan.commands.map((command) =>
              Object.freeze([command.opcode, ...command.from.map((value, i) => lerp(value, command.to[i], progress))]),
            ),
          );
        return Object.freeze({
          id: node.id,
          type: node.type,
          props: Object.freeze(props),
          ...((discrete === 'start' ? target.get(node.id).node : node).layerCache
            ? { layerCache: (discrete === 'start' ? target.get(node.id).node : node).layerCache }
            : {}),
          children: Object.freeze(node.children.map(sampleNode)),
        });
      }
      return Object.freeze({
        width: lerp(a.width, b.width, progress),
        height: lerp(a.height, b.height, progress),
        children: Object.freeze(a.children.map(sampleNode)),
        ...((discrete === 'start' ? b.light : a.light) ? { light: discrete === 'start' ? b.light : a.light } : {}),
      });
    },
  });
}

/** One-shot convenience; reuse createTransition for repeated frame sampling. */
export function interpolateStates(from, to, progress, spec) {
  return createTransition(from, to, spec).sample(progress);
}
