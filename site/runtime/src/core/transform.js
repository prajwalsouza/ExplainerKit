import { cloudBounds } from '../graphics/cloud.js';
/** Affine order: T(position) T(pivot) R skewX skewY S T(-pivot). */
export const multiplyAffine = (a, b) => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];
export const pivotKeywords = Object.freeze([
  'origin',
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
]);
const point = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
// Exact quadratic/cubic axis extrema from roots of the Bézier derivative.
function pathExtrema(commands) {
  const out = [];
  let start = [0, 0],
    at = [0, 0];
  for (const c of commands) {
    if (c[0] === 'Z') {
      at = start;
      continue;
    }
    const end = c.slice(-2);
    if (c[0] === 'M') {
      start = end;
      out.push(end);
    } else out.push(at, end);
    if (c[0] === 'Q' || c[0] === 'C') {
      const points = [at, c.slice(1, 3), ...(c[0] === 'C' ? [c.slice(3, 5)] : []), end],
        ts = [];
      for (let axis = 0; axis < 2; axis++) {
        const v = points.map((q) => q[axis]);
        if (v.length === 3) {
          const d = v[0] - 2 * v[1] + v[2];
          if (d) ts.push((v[0] - v[1]) / d);
        } else {
          const a = -v[0] + 3 * v[1] - 3 * v[2] + v[3],
            b = 2 * (v[0] - 2 * v[1] + v[2]),
            d = v[1] - v[0];
          if (Math.abs(a) < 1e-14) {
            if (b) ts.push(-d / b);
          } else {
            const disc = b * b - 4 * a * d;
            if (disc >= 0) ts.push((-b + Math.sqrt(disc)) / (2 * a), (-b - Math.sqrt(disc)) / (2 * a));
          }
        }
      }
      for (const t of ts)
        if (t > 0 && t < 1) {
          let q = points.map((v) => [...v]);
          while (q.length > 1) q = q.slice(1).map((v, i) => v.map((x, k) => q[i][k] * (1 - t) + x * t));
          out.push(q[0]);
        }
    }
    at = end;
  }
  return out;
}
/** Geometric bounds, excluding stroke and effects. */
export function localBounds(node, cache = new WeakMap()) {
  if (node && cache.has(node)) return cache.get(node);
  const p = node?.props ?? {},
    pts = [];
  if (node?.type === 'circle') {
    const r = p.r ?? 0;
    pts.push([-r, -r], [r, r]);
  } else if (node?.type === 'rect') pts.push([0, 0], [p.width ?? 0, p.height ?? 0]);
  else if (node?.type === 'line') pts.push([p.x1 ?? 0, p.y1 ?? 0], [p.x2 ?? 0, p.y2 ?? 0]);
  else if (node?.type === 'path') for (const q of pathExtrema(p.commands ?? [])) pts.push(q);
  else if (node?.type === 'cloud') {
    const b = cloudBounds(p.points, p.pointSize ?? 2);
    if (b) pts.push([b.x, b.y], [b.x + b.width, b.y + b.height]);
  } else if (node?.type === 'text' && p.textOutline) {
    for (const q of pathExtrema(p.textOutline)) pts.push(q);
  } else if (node?.type === 'text') {
    const s = p.fontSize ?? 16,
      w = p.textAdvance ?? Math.max(0, ...(p.text ?? '').split(/\r?\n/).map((line) => line.length)) * s * 0.54,
      x = p.align === 'middle' ? -w / 2 : p.align === 'end' ? -w : 0,
      y = p.baseline === 'middle' ? -s / 2 : p.baseline === 'hanging' ? 0 : -s * 0.8;
    pts.push([x, y], [x + w, y + s + ((p.text ?? '').split(/\r?\n/).length - 1) * s * (p.lineHeight ?? 1.3)]);
  }
  for (const child of node?.children ?? []) {
    const b = localBounds(child, cache),
      m = localMatrix(child.props, child, cache);
    for (const [x, y] of [
      [b.x, b.y],
      [b.x + b.width, b.y],
      [b.x, b.y + b.height],
      [b.x + b.width, b.y + b.height],
    ])
      pts.push(point(m, x, y));
  }
  if (!pts.length) return { x: 0, y: 0, width: 0, height: 0 };
  let x = Infinity,
    y = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const q of pts) {
    x = Math.min(x, q[0]);
    y = Math.min(y, q[1]);
    right = Math.max(right, q[0]);
    bottom = Math.max(bottom, q[1]);
  }
  const result = { x, y, width: right - x, height: bottom - y };
  if (node) cache.set(node, result);
  return result;
}
export function resolvePivot(node, cache = new WeakMap()) {
  const p = node?.props?.pivot;
  if (Array.isArray(p)) return p;
  if (!p || p === 'origin') return [0, 0];
  const b = localBounds(node, cache);
  return [
    b.x + b.width * (p.includes('left') ? 0 : p.includes('right') ? 1 : 0.5),
    b.y + b.height * (p.includes('top') ? 0 : p.includes('bottom') ? 1 : 0.5),
  ];
}
export function localMatrix(p, node, cache = new WeakMap()) {
  const c = Math.cos(p.rotation ?? 0),
    s = Math.sin(p.rotation ?? 0),
    sx = p.scaleX ?? 1,
    sy = p.scaleY ?? 1,
    kx = Math.tan(p.skewX ?? 0),
    ky = Math.tan(p.skewY ?? 0);
  const a = (c * (1 + kx * ky) - s * ky) * sx,
    b = (s * (1 + kx * ky) + c * ky) * sx,
    d = (c * kx - s) * sy,
    e = (s * kx + c) * sy;
  const [px, py] = Array.isArray(p.pivot) ? p.pivot : resolvePivot(node ?? { props: p }, cache);
  return [a, b, d, e, (p.x ?? 0) + px - a * px - d * py, (p.y ?? 0) + py - b * px - e * py];
}
