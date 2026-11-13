import { assert } from '../core/validate.js';
/** Convex rectangle intersection via separating axes, including rotated camera views. */
export function regionIntersects(box, matrix, width, height, mode = 'inside') {
  const points = [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x + box.width, box.y + box.height],
    [box.x, box.y + box.height],
  ].map(([x, y]) => [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]]);
  // Approach means a quarter-viewport margin on each screen edge, independent of zoom/DPR.
  const margin = mode === 'approach' ? 0.25 : 0,
    view = [
      [-width * margin, -height * margin],
      [width * (1 + margin), -height * margin],
      [width * (1 + margin), height * (1 + margin)],
      [-width * margin, height * (1 + margin)],
    ];
  const axes = [
    [1, 0],
    [0, 1],
    ...points.slice(0, 2).map((p, i) => {
      const q = points[i + 1];
      return [p[1] - q[1], q[0] - p[0]];
    }),
  ];
  return axes.every((axis) => {
    const project = (p) => p[0] * axis[0] + p[1] * axis[1],
      a = points.map(project),
      b = view.map(project);
    return Math.min(...a) <= Math.max(...b) && Math.min(...b) <= Math.max(...a);
  });
}
export function scopeRegionContent(frame, scopes, matrix, screenRoots = new Set()) {
  if (!scopes.size) return frame;
  const visibility = new Map();
  for (const { box, id, visible } of scopes.values()) {
    assert(!screenRoots.has(id), 'INVALID_REGION_CONTENT', 'Region-scoped content must remain in world space.');
    const node = frame.children.find((child) => child.id === id);
    assert(node, 'INVALID_REGION_CONTENT', 'Region-scoped content must remain a live top-level group.');
    visibility.set(id, regionIntersects(box, matrix, frame.width, frame.height, visible));
  }
  return {
    ...frame,
    children: frame.children.map((node) =>
      visibility.get(node.id) === false ? { ...node, props: { ...node.props, opacity: 0 } } : node,
    ),
  };
}
