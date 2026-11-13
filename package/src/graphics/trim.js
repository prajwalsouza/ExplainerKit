import { flattenPath } from '../morph/contour.js';
import { assert } from '../core/validate.js';
const lengths = new WeakMap(),
  polylines = new WeakMap();
const cacheable = (commands) => Object.isFrozen(commands) && commands.every(Object.isFrozen);
/** Each subpath flattened to a polyline (closed ones end where they began), with cumulative lengths. */
function contours(commands) {
  let hit = polylines.get(commands);
  if (hit) return hit;
  const lists = [];
  let current = [];
  for (const c of commands) {
    if (c[0] === 'M' && current.length) {
      lists.push(current);
      current = [];
    }
    current.push(c);
  }
  if (current.length) lists.push(current);
  hit = [];
  let pointCount = 0;
  for (const list of lists) {
    if (list.length < 2) continue;
    assert(32768 - pointCount >= 2, 'RESOURCE_LIMIT', 'Compound trim exceeds the aggregate point budget.');
    let flat;
    try {
      flat = flattenPath(list, { tolerance: 0.05, maxPoints: 32768 - pointCount });
    } catch (e) {
      if (e.code === 'DEGENERATE_PATH' || e.code === 'INVALID_MORPH') continue;
      throw e;
    }
    const pts = flat.points.map((p) => [p.x, p.y]);
    if (flat.closed && pts.length && (pts[0][0] !== pts.at(-1)[0] || pts[0][1] !== pts.at(-1)[1])) pts.push(pts[0]);
    pointCount += pts.length;
    assert(pointCount <= 32768, 'RESOURCE_LIMIT', 'Compound trim exceeds the aggregate point budget.');
    const cum = [0];
    for (let i = 1; i < pts.length; i++)
      cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    if (cum.at(-1) > 0) hit.push({ pts, cum, length: cum.at(-1) });
  }
  if (cacheable(commands)) polylines.set(commands, hit);
  return hit;
}
/** Commands for the stretch [a, b] of the concatenated contours (distances along the whole outline). */
function cut(parts, a, b, out) {
  const emit = (command) => {
    assert(out.length < 10000, 'RESOURCE_LIMIT', 'Compound trim exceeds the10000-command output budget.');
    out.push(command);
  };
  let base = 0;
  for (const part of parts) {
    const lo = Math.max(a, base),
      hi = Math.min(b, base + part.length);
    if (hi > lo) {
      const { pts, cum } = part,
        at = (d) => {
          let i = 1;
          while (i < cum.length - 1 && cum[i] < d) i++;
          const k = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
          return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
        };
      const s = lo - base,
        e = hi - base;
      emit(['M', ...at(s)]);
      for (let i = 1; i < cum.length - 1; i++) if (cum[i] > s && cum[i] < e) emit(['L', ...pts[i]]);
      emit(['L', ...at(e)]);
    }
    base += part.length;
  }
}
/**
 * Shared authored-distance trim plan; leaves fills untouched. One contour: a dash pattern. Several contours
 * (letters, outlines with holes): renderers restart dashes on every subpath, so the visible stretch is cut as
 * geometry instead (`commands`), measured along the contours in order, so a drawing draws contour after contour.
 */
export function strokeTrim(commands, start = 0, end = 1, offset = 0) {
  if (start === 0 && end === 1) return null;
  if (end <= start || commands.length < 2) return Object.freeze({ empty: true, length: 0, visible: 0, offset: 0 });
  if (commands.filter((c) => c[0] === 'M').length > 1) {
    const parts = contours(commands),
      length = parts.reduce((s, p) => s + p.length, 0);
    if (!length) return Object.freeze({ empty: true, length: 0, visible: 0, offset: 0 });
    const a = ((((start + offset) % 1) + 1) % 1) * length,
      b = a + (end - start) * length,
      out = [];
    cut(parts, a, Math.min(b, length), out);
    if (b > length) cut(parts, 0, b - length, out);
    return Object.freeze({
      empty: out.length === 0,
      length,
      visible: (end - start) * length,
      offset: 0,
      commands: Object.freeze(out.map((c) => Object.freeze(c))),
    });
  }
  let length = lengths.get(commands);
  if (length === undefined) {
    try {
      length = flattenPath(commands, { tolerance: 0.05, maxPoints: 32768 }).length;
    } catch (e) {
      if (e.code === 'DEGENERATE_PATH') length = 0;
      else throw e;
    }
    if (cacheable(commands)) lengths.set(commands, length);
  }
  return Object.freeze({
    empty: length === 0,
    length,
    visible: (end - start) * length,
    offset: -((((start + offset) % 1) + 1) % 1) * length,
  });
}
