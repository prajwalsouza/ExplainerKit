import { assert, number, options, safeCopy } from '../core/validate.js';
import { installHandleEffect, withoutHandleEffects } from '../core/sample-effects.js';
import { localMatrix, multiplyAffine } from '../core/transform.js';
const states = new WeakMap(),
  owners = new WeakSet(),
  sources = new WeakMap();
const smooth = (value) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
const point = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
const angle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
function inverse(m) {
  const d = m[0] * m[3] - m[1] * m[2];
  assert(Math.abs(d) > 1e-10, 'HOLD_SINGULAR', 'Holding requires an invertible parent transform.');
  return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d];
}
function base(scene, handle, context) {
  return withoutHandleEffects(
    (owner) => owners.has(owner),
    () => {
      const ctx = Object.freeze({ ...context }),
        world = scene._sampleWorld(ctx);
      let found = null;
      function visit(node, parent, layered = false) {
        layered = layered || !!node.layerCache;
        const matrix = multiplyAffine(parent, localMatrix(node.props, node));
        if (node.id === handle.id) found = { node, parent, matrix, layered };
        for (const child of node.children ?? []) visit(child, matrix, layered);
      }
      for (const node of world.children) visit(node, [1, 0, 0, 1, 0, 0]);
      assert(found, 'DETACHED_HANDLE', 'The held prop is no longer attached.');
      return found;
    },
  );
}
const socketTarget = (entry, time) => {
  const s = entry.socket(entry.hand, time),
    c = Math.cos(s.rotation),
    sn = Math.sin(s.rotation),
    offset = entry.offset;
  return {
    x: s.x + (entry.align === 'hand' ? c * offset[0] - sn * offset[1] : offset[0]),
    y: s.y + (entry.align === 'hand' ? sn * offset[0] + c * offset[1] : offset[1]),
    rotation: entry.align === 'hand' ? s.rotation : entry.upright,
  };
};
function selected(state, time) {
  return state.windows.filter((w) => !w.disposed && time >= w.from && time < w.until).at(-1);
}
function worldAt(state, time, context) {
  const entry = selected(state, time);
  if (!entry) return null;
  const target = socketTarget(entry, Math.min(time, entry.to));
  if (time < entry.from + entry.blend) {
    const k = smooth((time - entry.from) / entry.blend);
    return {
      x: entry.base.x + (target.x - entry.base.x) * k,
      y: entry.base.y + (target.y - entry.base.y) * k,
      rotation: angle(entry.base.rotation, target.rotation, k),
    };
  }
  if (time > entry.to && time < entry.to + entry.blend) {
    const moving = socketTarget(entry, time),
      k = smooth((time - entry.to) / entry.blend);
    return {
      x: moving.x + (target.x - moving.x) * k,
      y: moving.y + (target.y - moving.y) * k,
      rotation: angle(moving.rotation, target.rotation, k),
    };
  }
  return target;
}
/** Internal lifecycle preflight for glyph attachment; history before the claim remains seekable. */
export function prepareHoldAttachment(handle, from, until) {
  const state = states.get(handle?._record);
  if (!state) return () => {};
  assert(
    !state.windows.some(
      (w) => !w.disposed && (from === until ? w.from <= from : w.from < until) && w.to + w.blend > from,
    ),
    'CHANNEL_OWNED',
    'Release the prop hold before attaching its layout.',
  );
  return () => {
    for (const window of state.windows) if (window.from <= from) window.until = Math.min(window.until, from);
  };
}
/** A world-space prop attachment implemented through the existing sampled-effect boundary. */
export function holdProp(scene, actor, handle, socket, spec = {}) {
  options(spec, ['hand', 'from', 'to', 'offset', 'align', 'blend', 'anchor', 'release'], 'character hold');
  assert(
    handle?._scene === scene && typeof handle._live === 'function',
    'INVALID_HOLD',
    'Hold a live prop from this scene.',
  );
  handle._live();
  const hand = spec.hand ?? 'F';
  assert(hand === 'F' || hand === 'B', 'INVALID_HOLD', 'Choose hand F or B.');
  const from = number(spec.from ?? 0, 'hold start', 0, 86400);
  assert(
    spec.to !== undefined || scene.duration > from,
    'INVALID_HOLD',
    'Give an explicit hold end when the scene has no positive remaining horizon.',
  );
  const to = number(spec.to ?? scene.duration, 'hold end', from, 86400),
    blend = number(spec.blend ?? Math.min(0.08, (to - from) / 2, 86400 - to), 'hold blend', 0, (to - from) / 2);
  assert(to + blend <= 86400, 'INVALID_HOLD', 'Hold release exceeds the timeline limit.');
  const align = spec.align ?? 'hand';
  assert(['hand', 'upright'].includes(align), 'INVALID_HOLD', 'Hold alignment is hand or upright.');
  const release = spec.release ?? 'freeze';
  assert(
    release === 'freeze' || release === 'authored',
    'INVALID_HOLD',
    'Release freezes the prop or resumes authored motion.',
  );
  const pair = (value, label) => {
      const data = safeCopy(value ?? [0, 0]);
      assert(Array.isArray(data) && data.length === 2, 'INVALID_HOLD', `${label} is [x,y].`);
      return Object.freeze(data.map((v) => number(v, label)));
    },
    offset = pair(spec.offset, 'hold offset'),
    anchor = pair(spec.anchor, 'prop anchor');
  const dependency = (record) =>
    states.has(record) || (sources.get(record) ?? 0) > 0 || [...record.children.values()].some(dependency);
  assert(
    !states.has(actor._record) &&
      !(sources.get(handle._record) ?? 0) &&
      ![...handle._record.children.values()].some(dependency),
    'HOLD_CYCLE',
    'Held props cannot contain active hold dependencies.',
  );
  const sourcePath = scene._pathTo(actor._record),
    targetPath = scene._pathTo(handle._record);
  assert(
    sourcePath && targetPath && !sourcePath.includes(handle._record) && !targetPath.includes(actor._record),
    'HOLD_CYCLE',
    'The prop and character cannot contain each other.',
  );
  for (const record of [...sourcePath.slice(0, -1), ...targetPath.slice(0, -1)])
    assert(
      typeof record.props.pivot !== 'string' || record.props.pivot === 'origin',
      'HOLD_CYCLE',
      'Geometry-dependent ancestor pivots cannot depend on a held prop.',
    );
  socket(hand, from);
  let state = states.get(handle._record);
  assert(!state || state.windows.length < 128, 'RESOURCE_LIMIT', 'Use at most128 authored hold windows per prop.');
  assert(
    !state?.windows.some((w) => !w.disposed && from < w.to + w.blend && to + blend > w.from),
    'CHANNEL_OWNED',
    'Prop hold windows may not overlap.',
  );
  const context = scene._sampleContext({ time: from }),
    sourceBase = base(scene, actor, context),
    entryBase = base(scene, handle, context),
    existing = state && worldAt(state, from, context),
    position = point(entryBase.matrix, anchor),
    initialRotation = Math.atan2(entryBase.matrix[1], entryBase.matrix[0]),
    upright = 0;
  assert(
    !sourceBase.layered &&
      !entryBase.layered &&
      !scene.activeCamera?._isScreenRoot(sourcePath[0].id) &&
      !scene.activeCamera?._isScreenRoot(targetPath[0].id),
    'HOLD_SPACE_UNSUPPORTED',
    'Hold world-space props and actors outside screen/depth layers.',
  );
  const entry = {
    actor,
    hand,
    from,
    to,
    blend,
    offset,
    anchor,
    align,
    upright,
    socket,
    base: existing ?? { x: position[0], y: position[1], rotation: initialRotation },
    until: release === 'authored' ? to + blend : 86401,
    disposed: false,
  };
  if (!state) {
    const owner = {};
    owners.add(owner);
    state = { windows: [], remove: null };
    const current = state;
    state.remove = installHandleEffect(handle, owner, (props, ctx) => {
      const selectedWindow = selected(current, ctx.time);
      if (!selectedWindow) return {};
      const sourceRoot = scene._pathTo(selectedWindow.actor._record)?.[0],
        targetRoot = scene._pathTo(handle._record)?.[0];
      assert(
        sourceRoot &&
          targetRoot &&
          !scene.activeCamera?._isScreenRoot(sourceRoot.id) &&
          !scene.activeCamera?._isScreenRoot(targetRoot.id),
        'HOLD_SPACE_UNSUPPORTED',
        'Held branches must remain in world coordinates.',
      );
      const target = worldAt(current, ctx.time, ctx);
      if (!target) return {};
      const data = base(scene, handle, ctx);
      assert(
        !data.layered && !base(scene, selectedWindow.actor, ctx).layered,
        'HOLD_SPACE_UNSUPPORTED',
        'Held branches must remain outside depth layers.',
      );
      const inv = inverse(data.parent),
        xy = point(inv, [target.x, target.y]),
        direction = [
          inv[0] * Math.cos(target.rotation) + inv[2] * Math.sin(target.rotation),
          inv[1] * Math.cos(target.rotation) + inv[3] * Math.sin(target.rotation),
        ],
        localDirection = Math.atan2(direction[1], direction[0]),
        window = selected(current, ctx.time),
        unrotated = { ...props, x: 0, y: 0, rotation: 0 },
        basis = localMatrix(unrotated, { ...data.node, props: unrotated }),
        rotation = localDirection - Math.atan2(basis[1], basis[0]),
        zero = { ...props, x: 0, y: 0, rotation },
        matrix = localMatrix(zero, { ...data.node, props: zero }),
        origin = point(matrix, window.anchor);
      return { x: xy[0] - origin[0], y: xy[1] - origin[1], rotation };
    });
    states.set(handle._record, state);
  }
  sources.set(actor._record, (sources.get(actor._record) ?? 0) + 1);
  state.windows.push(entry);
  state.windows.sort((a, b) => a.from - b.from);
  scene._extend(Math.min(to + blend, 86400));
  scene._changed();
  return Object.freeze({
    handle,
    from,
    to,
    dispose() {
      if (entry.disposed) return;
      entry.disposed = true;
      sources.set(actor._record, Math.max(0, (sources.get(actor._record) ?? 0) - 1));
      if (state.windows.every((w) => w.disposed)) {
        state.remove();
        states.delete(handle._record);
      }
      scene._changed();
    },
  });
}
