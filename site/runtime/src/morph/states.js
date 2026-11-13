import { captureState, createTransition } from '../core/transition.js';
import { assert, options } from '../core/validate.js';

/** Explicit enter/exit fades across identified scene states. Reparenting still rejects. */
export function createSceneTransition(from, to, spec = {}) {
  options(spec, ['discrete', 'paths', 'pathOptions', 'colors', 'unmatched'], 'scene transition');
  const policy = spec.unmatched ?? 'error';
  assert(['error', 'fade'].includes(policy), 'INVALID_TRANSITION', 'Use error or fade unmatched policy.');
  const transitionOptions = Object.fromEntries(Object.entries(spec).filter(([k]) => k !== 'unmatched'));
  if (policy === 'error') return createTransition(from, to, transitionOptions);
  const a = captureState(from),
    b = captureState(to),
    left = new Map(),
    right = new Map();
  function index(nodes, map, parent = null) {
    for (const node of nodes) {
      map.set(node.id, { node, parent });
      index(node.children, map, node.id);
    }
  }
  index(a.children, left);
  index(b.children, right);
  for (const [id, l] of left) {
    const r = right.get(id);
    if (r) assert(l.parent === r.parent, 'STATE_HIERARCHY_MISMATCH', `Node ${id} changes parent.`);
  }
  function union(nodesA, nodesB, side, parentMissing = false) {
    const am = new Map(nodesA.map((n) => [n.id, n])),
      bm = new Map(nodesB.map((n) => [n.id, n])),
      ids = [...am.keys(), ...[...bm.keys()].filter((id) => !am.has(id))];
    return ids.map((id) => {
      const l = am.get(id),
        r = bm.get(id),
        actual = side === 'left' ? l : r,
        fallback = actual ?? l ?? r,
        missing = !actual;
      const props = { ...fallback.props };
      if (missing && !parentMissing) props.opacity = 0;
      return {
        id,
        type: fallback.type,
        props,
        children: union(l?.children ?? [], r?.children ?? [], side, parentMissing || missing),
      };
    });
  }
  const prepared = createTransition(
    { width: a.width, height: a.height, children: union(a.children, b.children, 'left') },
    { width: b.width, height: b.height, children: union(a.children, b.children, 'right') },
    transitionOptions,
  );
  return Object.freeze({
    sample(progress) {
      const frame = prepared.sample(progress);
      if (progress === 0) return a;
      if (progress === 1) return b;
      return frame;
    },
  });
}
