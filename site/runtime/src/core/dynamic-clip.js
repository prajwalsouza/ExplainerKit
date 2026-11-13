import { assert, options } from './validate.js';
import { clipPath, clipCircle } from '../graphics/index.js';
import { localMatrix, multiplyAffine } from './transform.js';
const targets = new WeakMap(),
  initialTargets = new WeakMap(),
  types = new Set(['circle', 'rect', 'path', 'group']);
export const dynamicClipId = (record) => targets.get(record)?.id;
const contains = (record, needle) =>
  record === needle || [...record.children.values()].some((child) => contains(child, needle));
export function captureHandleClip(scene, input, source = null) {
  options(input, Object.keys(input ?? {}), 'drawable properties');
  const descriptor = Object.getOwnPropertyDescriptor(input ?? {}, 'clip'),
    target = descriptor && 'value' in descriptor ? descriptor.value : null;
  if (!target?._record) return { input, target: null, present: !!descriptor };
  assert(
    target._scene === scene && !target._record.detached && scene._containsRecord(target._record),
    'INVALID_CLIP',
    'Clip target must be a live drawable of this scene.',
  );
  assert(
    types.has(target._record.type),
    'CLIP_UNSUPPORTED',
    'Handle clips support circles, rectangles, paths and groups of those shapes.',
  );
  const check = (r) => {
    assert(types.has(r.type), 'CLIP_UNSUPPORTED', 'Clip group contains an unsupported outline.');
    for (const child of r.children.values()) check(child);
  };
  check(target._record);
  if (source) {
    assert(!contains(target._record, source), 'CLIP_CYCLE', 'A clip cannot depend on itself or a group containing it.');
    const seen = new Set([source]);
    for (let r = target._record; r; r = targets.get(r)) {
      assert(!seen.has(r), 'CLIP_CYCLE', 'Clip references must be acyclic.');
      seen.add(r);
    }
  }
  return { input: { ...input, clip: null }, target: target._record, present: true };
}
export function commitHandleClip(record, captured, initial = false) {
  if (initial && captured.target) initialTargets.set(record, captured.target);
  if (captured.present) {
    if (captured.target) targets.set(record, captured.target);
    else targets.delete(record);
  }
}
export function clearHandleClip(record) {
  const target = initialTargets.get(record);
  if (target) targets.set(record, target);
  else targets.delete(record);
}
export function validateClipAdoption(parent, child) {
  const visit = (r) => {
    const target = targets.get(r);
    assert(
      !target || !contains(target, parent),
      'CLIP_CYCLE',
      'Adoption would make a clip reference its own descendant.',
    );
    for (const c of r.children.values()) visit(c);
  };
  visit(child);
}
function arc(commands, cx, cy, r, start, end, scale) {
  const span = end - start;
  let n = Math.max(1, Math.ceil(Math.abs(span) / (Math.PI / 4)));
  while ((r * scale * (Math.abs(span) / n) ** 6) / 1000 > 0.01 && n < 128) n *= 2;
  assert(
    (r * scale * (Math.abs(span) / n) ** 6) / 1000 <= 0.01,
    'CLIP_PRECISION',
    'Clip arc exceeds the bounded approximation budget.',
  );
  const step = span / n,
    k = (4 / 3) * Math.tan(step / 4);
  for (let i = 0; i < n; i++) {
    const a = start + i * step,
      b = a + step;
    commands.push([
      'C',
      cx + r * (Math.cos(a) - k * Math.sin(a)),
      cy + r * (Math.sin(a) + k * Math.cos(a)),
      cx + r * (Math.cos(b) + k * Math.sin(b)),
      cy + r * (Math.sin(b) - k * Math.cos(b)),
      cx + r * Math.cos(b),
      cy + r * Math.sin(b),
    ]);
  }
}
function outline(node, scale = 1) {
  const p = node.props;
  if (node.type === 'path') return p.commands;
  if (node.type === 'circle') {
    const r = p.r ?? 0,
      commands = [['M', r, 0]];
    arc(commands, 0, 0, r, 0, Math.PI * 2, scale);
    commands.push(['Z']);
    return commands;
  }
  if (node.type === 'rect') {
    const w = p.width ?? 0,
      h = p.height ?? 0,
      r = Math.min(p.rx ?? 0, w / 2, h / 2);
    if (!r) return [['M', 0, 0], ['L', w, 0], ['L', w, h], ['L', 0, h], ['Z']];
    const commands = [
      ['M', r, 0],
      ['L', w - r, 0],
    ];
    arc(commands, w - r, r, r, -Math.PI / 2, 0, scale);
    commands.push(['L', w, h - r]);
    arc(commands, w - r, h - r, r, 0, Math.PI / 2, scale);
    commands.push(['L', r, h]);
    arc(commands, r, h - r, r, Math.PI / 2, Math.PI, scale);
    commands.push(['L', 0, r]);
    arc(commands, r, r, r, Math.PI, Math.PI * 1.5, scale);
    commands.push(['Z']);
    return commands;
  }
  assert(node.type === 'group', 'CLIP_UNSUPPORTED', 'Unsupported sampled clip outline.');
  return [];
}
const transformCommands = (commands, m) =>
  commands.map((c) =>
    c.map((v, i) => (i === 0 ? v : i % 2 ? m[0] * v + m[2] * c[i + 1] + m[4] : m[1] * c[i - 1] + m[3] * v + m[5])),
  );
/** Resolve using one sampled frame only: no seek history, author callbacks or live handles in output. */
export function resolveDynamicClips(frame) {
  const records = new Map(),
    identity = [1, 0, 0, 1, 0, 0];
  const visit = (node, parent, parentOpacity = 1) => {
    const world = multiplyAffine(parent, localMatrix(node.props, node)),
      opacity = parentOpacity * (node.props.opacity ?? 1);
    records.set(node.id, { node, world, opacity });
    for (const child of node.children ?? []) visit(child, world, opacity);
  };
  frame.children.forEach((n) => visit(n, identity));
  let commandCount = 0;
  for (const { node, world, opacity } of records.values())
    if (node.clipTarget) {
      const target = records.get(node.clipTarget);
      assert(target, 'INVALID_CLIP', 'Clip target is no longer sampled in this scene.');
      const d = world[0] * world[3] - world[1] * world[2];
      if (opacity === 0) {
        node.props.clip = clipPath({ commands: [] });
        delete node.clipTarget;
        continue;
      }
      assert(Math.abs(d) > 1e-12, 'CLIP_SINGULAR', 'Cannot map a handle clip into a collapsed coordinate space.');
      const inv = [
          world[3] / d,
          -world[1] / d,
          -world[2] / d,
          world[0] / d,
          (world[2] * world[5] - world[3] * world[4]) / d,
          (world[1] * world[4] - world[0] * world[5]) / d,
        ],
        commands = [];
      const relative = multiplyAffine(inv, target.world),
        sx = Math.hypot(relative[0], relative[1]),
        sy = Math.hypot(relative[2], relative[3]);
      if (
        target.node.type === 'circle' &&
        Math.abs(sx - sy) <= 1e-9 * Math.max(1, sx, sy) &&
        Math.abs(relative[0] * relative[2] + relative[1] * relative[3]) <= 1e-9 * Math.max(1, sx * sy)
      ) {
        node.props.clip = clipCircle({ x: relative[4], y: relative[5], r: (target.node.props.r ?? 0) * sx });
        delete node.clipTarget;
        continue;
      }
      const gather = (entry) => {
        const m = multiplyAffine(inv, entry.world),
          own = outline(
            entry.node,
            Math.max(
              Math.hypot(m[0], m[1]),
              Math.hypot(m[2], m[3]),
              Math.hypot(entry.world[0], entry.world[1]),
              Math.hypot(entry.world[2], entry.world[3]),
            ),
          );
        for (const c of transformCommands(own, m)) commands.push(c);
        commandCount += own.length;
        assert(commandCount <= 100000, 'RESOURCE_LIMIT', 'Dynamic clip outline budget exceeded.');
        for (const child of entry.node.children ?? []) gather(records.get(child.id));
      };
      gather(target);
      node.props.clip = clipPath({ commands, fillRule: target.node.props.fillRule ?? 'nonzero' });
      delete node.clipTarget;
    }
  return frame;
}
