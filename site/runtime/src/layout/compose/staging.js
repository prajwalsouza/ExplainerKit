import { assert, number, options, KitError } from '../../core/validate.js';
import { installHandleEffect, withoutHandleEffects } from '../../core/sample-effects.js';
import { localMatrix, multiplyAffine } from '../../core/transform.js';
import { measureNode } from '../adaptive.js';
import { invertMatrix } from '../../camera/math.js';
import { effectPlan } from '../../graphics/look.js';
import { easings } from '../../core/timing.js';
const stageClaims = new WeakMap();
const identity = [1, 0, 0, 1, 0, 0];
const cardinal = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
const stageOwner = (owner) => owner?.staging === true;
function direction(value, radial = false) {
  if (radial && value === 'radial') return 'radial';
  if (typeof value === 'string') {
    assert(Object.hasOwn(cardinal, value), 'INVALID_STAGE', 'Use down, up, left, right or an explicit direction.');
    return cardinal[value];
  }
  assert(Array.isArray(value) && value.length === 2, 'INVALID_STAGE', 'A direction needs two coordinates.');
  const x = number(Object.getOwnPropertyDescriptor(value, 0)?.value, 'stage direction x'),
    y = number(Object.getOwnPropertyDescriptor(value, 1)?.value, 'stage direction y'),
    length = Math.hypot(x, y);
  assert(length > 0, 'INVALID_STAGE', 'Stage direction cannot be zero.');
  return Object.freeze([x / length, y / length]);
}
/** Camera-aware additive staging over authored motion. No authored channel is replaced. */
export function stage(scene) {
  assert(scene && typeof scene._sampleWorld === 'function', 'INVALID_STAGE', 'Use an ExplainerKit scene.');
  const records = new Map(),
    queryCache = new WeakMap(),
    token = Object.freeze({}),
    claims = stageClaims.get(scene) ?? new Map();
  stageClaims.set(scene, claims);
  let disposed = false;
  const live = () => assert(!disposed, 'DISPOSED', 'This stage controller is disposed.');
  function handles(input) {
    assert(
      Array.isArray(input) && input.length > 0 && input.length <= 128,
      'INVALID_STAGE',
      'Use1–128 distinct scene handles.',
    );
    const list = [];
    for (let i = 0; i < input.length; i++) {
      const h = Object.getOwnPropertyDescriptor(input, i)?.value;
      assert(
        h?._scene === scene && typeof h._live === 'function' && scene._pathTo(h._record),
        'INVALID_STAGE',
        'Use live attached handles of this scene.',
      );
      h._live();
      assert(!list.some((existing) => existing._record === h._record), 'INVALID_STAGE', 'Stage each handle once.');
      list.push(h);
    }
    for (const a of list)
      for (const b of list)
        if (a !== b)
          assert(
            !scene._pathTo(b._record).slice(0, -1).includes(a._record),
            'INVALID_STAGE',
            'Stage distinct branches rather than a parent and its child.',
          );
    return list;
  }
  function query(context) {
    if (queryCache.has(context)) return queryCache.get(context);
    return withoutHandleEffects(stageOwner, () => {
      const fresh = Object.freeze({ ...context }),
        world = scene._sampleWorld(fresh),
        state = scene.activeCamera?._stagingState();
      assert(
        !state?.bindings,
        'STAGE_CAMERA_DEPENDENCY',
        'Use explicit camera tracks or region shots for guaranteed offscreen staging.',
      );
      const view = scene.activeCamera
          ? scene.activeCamera.project(world, fresh)
          : { matrix: identity, inverse: identity },
        nodes = new Map(),
        screenRoots = new Set(view.screenRoots ?? view.overlayRoots ?? []);
      function visit(node, parent, screen = false) {
        const matrix = multiplyAffine(parent, localMatrix(node.props, node)),
          measured = measureNode(node, undefined, parent);
        nodes.set(node.id, { node, parent, matrix, box: measured?.box, screen });
        for (const child of node.children ?? []) visit(child, matrix, screen);
      }
      world.children.forEach((node) => visit(node, identity, screenRoots.has(node.id)));
      function projected(node, parent) {
        const matrix = multiplyAffine(parent, localMatrix(node.props, node)),
          entry = nodes.get(node.id),
          p = node.props;
        let strokePadding =
          node.type !== 'group' && p.stroke !== 'none' && p.strokeWidth > 0
            ? (p.strokeWidth / 2) *
              ((p.strokeLinejoin ?? 'miter') === 'miter' ? (p.strokeMiterlimit ?? 4) : 1) *
              Math.hypot(...matrix.slice(0, 4))
            : 0;
        for (const child of node.children ?? []) strokePadding = Math.max(strokePadding, projected(child, matrix));
        if (entry) {
          entry.screenParent = parent;
          entry.screenBox = measureNode(node, undefined, parent)?.box ?? null;
          entry.strokePadding = strokePadding;
        }
        return strokePadding;
      }
      (view.frame ?? world).children.forEach((node) => projected(node, identity));
      const result = { nodes, view, padding: effectPlan(view.frame ?? world).padding };
      queryCache.set(context, result);
      return result;
    });
  }
  function screenBox(entry) {
    return entry?.screenBox ?? null;
  }
  function shift(handle, events, props, context) {
    let current = null,
      k = 0;
    for (const event of events) {
      if (context.time < event.at) break;
      current = event;
      if (context.time >= event.end) k = event.to;
      else {
        k = event.from + (event.to - event.from) * event.ease((context.time - event.at) / event.duration);
        break;
      }
    }
    if (!current || k === 0) return {};
    number(k, 'stage progress');
    const path = scene._pathTo(handle._record),
      claimedChild = (r) => [...r.children.values()].some((child) => claims.has(child) || claimedChild(child));
    assert(
      !path.slice(0, -1).some((r) => claims.has(r)) && !claimedChild(handle._record),
      'CHANNEL_OWNED',
      'Staged branches cannot contain each other.',
    );
    const data = query(context),
      entry = data.nodes.get(handle.id);
    assert(entry, 'DETACHED_HANDLE', 'A staged handle was removed.');
    const contains = (node, id) => node.id === id || (node.children ?? []).some((child) => contains(child, id));
    for (const id of scene.activeCamera?._stagingState().targets ?? [])
      assert(
        !contains(entry.node, id) && !scene._pathTo(handle._record).some((r) => r.id === id),
        'STAGE_CAMERA_DEPENDENCY',
        'A camera tracking the staged branch cannot let that branch leave its frame.',
      );
    const nativeText = (n, visible = true) => {
      visible = visible && (n.props.opacity ?? 1) > 0;
      return (
        visible &&
        ((n.type === 'text' && n.props.text && n.props.textOutline == null) ||
          (n.children ?? []).some((child) => nativeText(child, visible)))
      );
    };
    if (nativeText(entry.node)) {
      const failure = new KitError(
        'STAGE_UNSUPPORTED',
        'Register/import text outlines for guaranteed offscreen staging.',
      );
      failure.capability = 'text.metrics';
      throw failure;
    }
    const b = screenBox(entry, data.view);
    if (!b) return {};
    let vector = current.direction;
    if (vector === 'radial') {
      const boxes = current.parts.map((h) => screenBox(data.nodes.get(h.id), data.view)).filter(Boolean),
        cx = boxes.reduce((s, x) => s + (x.x0 + x.x1) / 2, 0) / boxes.length,
        cy = boxes.reduce((s, x) => s + (x.y0 + x.y1) / 2, 0) / boxes.length,
        dx = (b.x0 + b.x1) / 2 - cx,
        dy = (b.y0 + b.y1) / 2 - cy,
        len = Math.hypot(dx, dy),
        index = current.parts.findIndex((part) => part._record === handle._record);
      vector =
        len > 1e-8
          ? [dx / len, dy / len]
          : [
              Math.cos((index * 2 * Math.PI) / current.parts.length),
              Math.sin((index * 2 * Math.PI) / current.parts.length),
            ];
    }
    const [vx, vy] = vector,
      m = current.margin + data.padding + (entry.strokePadding ?? 0),
      distances = [];
    if (vx > 1e-12) distances.push(Math.max(0, (context.width + m - b.x0) / vx));
    if (vx < -1e-12) distances.push(Math.max(0, (b.x1 + m) / -vx));
    if (vy > 1e-12) distances.push(Math.max(0, (context.height + m - b.y0) / vy));
    if (vy < -1e-12) distances.push(Math.max(0, (b.y1 + m) / -vy));
    const distance = Math.min(...distances) * k,
      dx = vx * distance,
      dy = vy * distance,
      p = invertMatrix(entry.screenParent);
    return { x: props.x + p[0] * dx + p[2] * dy, y: props.y + p[1] * dx + p[3] * dy };
  }
  function prepare(list, to, spec = {}, radial = false) {
    options(spec, ['at', 'duration', 'direction', 'margin', 'ease', 'returnAt'], 'stage move');
    const at = number(spec.at ?? 0, 'stage at', 0, 86400),
      duration = number(spec.duration ?? 0.6, 'stage duration', 1e-6, 86400),
      end = number(at + duration, 'stage end', 0, 86400),
      margin = number(spec.margin ?? 16, 'stage margin', 0, 8192),
      name = spec.ease ?? 'smooth';
    assert(typeof name === 'string' && Object.hasOwn(easings, name), 'INVALID_EASING', 'Use a named staging easing.');
    assert(
      to === 1 || spec.returnAt === undefined,
      'INVALID_STAGE',
      'returnAt applies to an outgoing move; restore is already an incoming move.',
    );
    const restore = spec.returnAt === undefined ? null : number(spec.returnAt, 'stage return time', end, 86400);
    if (restore !== null) number(restore + duration, 'stage return end', 0, 86400);
    const plans = list.map((handle) => {
      for (const [owned, controller] of claims) {
        const a = scene._pathTo(owned),
          b = scene._pathTo(handle._record);
        if (a && b)
          assert(
            owned === handle._record ? controller === token : !a.includes(handle._record) && !b.includes(owned),
            'CHANNEL_OWNED',
            'Staging controllers must own distinct non-nested branches.',
          );
      }
      const previous = records.get(handle._record)?.events.at(-1);
      assert(
        !previous || at >= previous.end,
        'CHANNEL_OWNED',
        'Stage moves must be chronological and non-overlapping.',
      );
      assert(
        (previous?.to ?? 0) !== to,
        'CHANNEL_OWNED',
        to ? 'Restore the part before dropping it again.' : 'Only dropped parts can be restored.',
      );
      const moveMargin = to ? margin : previous.margin;
      if (!to && spec.margin !== undefined)
        assert(spec.margin === previous.margin, 'INVALID_STAGE', 'Restoration retains the original outgoing margin.');
      const selected = to ? direction(spec.direction ?? (radial ? 'radial' : 'down'), radial) : previous.direction;
      return {
        handle,
        events: [
          {
            at,
            end,
            duration,
            from: previous?.to ?? 0,
            to,
            margin: moveMargin,
            direction: selected,
            ease: easings[name],
            parts: to ? list : previous.parts,
          },
          ...(restore === null
            ? []
            : [
                {
                  at: restore,
                  end: restore + duration,
                  duration,
                  from: 1,
                  to: 0,
                  margin,
                  direction: selected,
                  ease: easings[name],
                  parts: to ? list : previous.parts,
                },
              ]),
        ],
      };
    });
    for (const plan of plans) {
      assert(
        (records.get(plan.handle._record)?.events.length ?? 0) + plan.events.length <= 128,
        'RESOURCE_LIMIT',
        'Use at most128 staging events per handle.',
      );
      const effects = plan.handle._record.effects;
      assert(
        records.has(plan.handle._record) || !effects || effects.size < 8,
        'RESOURCE_LIMIT',
        'Handle sampled-effect budget exceeded.',
      );
    }
    assert(
      records.size + plans.filter((plan) => !records.has(plan.handle._record)).length <= 128,
      'RESOURCE_LIMIT',
      'One stage controls at most128 handles.',
    );
    return plans;
  }
  function commit(plans) {
    scene._batch(() => {
      for (const plan of plans) {
        let record = records.get(plan.handle._record);
        if (!record) {
          record = { events: [], dispose: null };
          records.set(plan.handle._record, record);
          const captured = record;
          record.dispose = installHandleEffect(plan.handle, Object.freeze({ staging: true }), (props, context) =>
            shift(plan.handle, captured.events, props, context),
          );
        }
        claims.set(plan.handle._record, token);
        record.events.push(...plan.events);
        scene._extend(plan.events.at(-1).end);
      }
      scene._changed();
    });
    return api;
  }
  const api = {
    isolate(keep, spec) {
      live();
      options(spec, ['drop', 'direction', 'at', 'duration', 'margin', 'ease', 'returnAt'], 'isolate');
      const kept = handles(Array.isArray(keep) ? keep : [keep]),
        drop = handles(spec.drop);
      for (const h of drop)
        for (const retained of kept)
          assert(
            h !== retained && !scene._pathTo(retained._record).includes(h._record),
            'INVALID_STAGE',
            'A dropped branch cannot contain a retained handle.',
          );
      const { drop: _drop, ...timing } = spec;
      void _drop;
      return commit(prepare(drop, 1, timing));
    },
    explode(parts, spec = {}) {
      live();
      return commit(prepare(handles(parts), 1, spec, true));
    },
    restore(parts, spec = {}) {
      live();
      return commit(prepare(handles(Array.isArray(parts) ? parts : [parts]), 0, spec));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene._batch(() => {
        for (const [owned, record] of records) {
          record.dispose();
          if (claims.get(owned) === token) claims.delete(owned);
        }
        records.clear();
      });
    },
    get disposed() {
      return disposed;
    },
  };
  return Object.freeze(api);
}
