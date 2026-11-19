// Matching rules adapted from the behavior of RhyformJS's semantic equation
// transition. This implementation works on ExplainerKit's captured outlines.
import { flattenPath } from './contour.js';

const operatorFamilies = [
  new Set(['2B', '2212', 'B1', '2213', 'D7', '22C5', 'F7']),
  new Set(['3D', '2260', '2248', '2264', '2265', '3C', '3E', '2208', '2209']),
  new Set(['28', '29', '5B', '5D', '7B', '7D', '7C']),
];

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const sameGlyph = (a, b) => a.glyph !== null && a.glyph === b.glyph;

function contains(points, point) {
  let inside = false;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a.y > point.y !== b.y > point.y && point.x < a.x + ((point.y - a.y) * (b.x - a.x)) / (b.y - a.y)) {
      inside = !inside;
    }
  }
  return inside;
}

function outlineFeatures(part) {
  const tolerance = Math.max(0.2, Math.max(part.width, part.height) / 300);
  const outlines = part.contours
    .map((contour) => ({ contour, ...flattenPath(contour.commands, { tolerance, maxPoints: 1024 }) }))
    .sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
  const topology = outlines.map((outline, i) => {
    let parent = i - 1;
    while (parent >= 0 && !contains(outlines[parent].points, outline.points[0])) parent--;
    const opposite = parent >= 0 && Math.sign(outline.area) !== Math.sign(outlines[parent].area);
    return part.fillRule === 'evenodd' ? [parent] : [parent, opposite];
  });
  const signature = outlines.flatMap(({ points }) =>
    Array.from({ length: 16 }, (_, i) => {
      const point = points[Math.floor((i * (points.length - 1)) / 16)];
      return [(point.x - part.center[0]) / part.width, (point.y - part.center[1]) / part.height];
    }),
  );
  return {
    contours: outlines.map(({ contour }, i) => ({ ...contour, id: `outline${i + 1}` })),
    topology: JSON.stringify(topology),
    signature,
  };
}

export function describeMathParts(parts, metadata) {
  if (!parts.length) return [];
  const left = Math.min(...parts.map(({ center, width }) => center[0] - width / 2));
  const top = Math.min(...parts.map(({ center, height }) => center[1] - height / 2));
  const spanX = Math.max(...parts.map(({ center, width }) => center[0] + width / 2)) - left;
  const spanY = Math.max(...parts.map(({ center, height }) => center[1] + height / 2)) - top;
  return parts.map((part) => {
    let features;
    try {
      features = outlineFeatures(part);
    } catch (error) {
      if (!['DEGENERATE_PATH', 'INVALID_MORPH', 'RESOURCE_LIMIT'].includes(error.code)) throw error;
    }
    const { glyph = null, role = null, placement = '' } = metadata.get(part.id) ?? {};
    return {
      ...part,
      ...features,
      glyph: placement.split('/').at(-1) === 'bar' && glyph === null ? 'rule' : glyph,
      role,
      placement,
      position: [(part.center[0] - left) / spanX, (part.center[1] - top) / spanY],
    };
  });
}

export function equationPartCost(a, b) {
  if (!a.signature || !b.signature || a.topology !== b.topology || a.fillRule !== b.fillRule) return Infinity;
  const identical = sameGlyph(a, b);
  if (!identical && (a.role === null || a.role !== b.role)) return Infinity;
  if (!identical && a.role === 'mo' && !operatorFamilies.some((group) => group.has(a.glyph) && group.has(b.glyph))) {
    return Infinity;
  }
  const location = distance(a.position, b.position) + (a.placement === b.placement ? 0 : 0.8);
  if (identical) return location;
  const shape = a.signature.reduce((sum, point, i) => sum + distance(point, b.signature[i]), 0) / a.signature.length;
  return 2.8 + shape + location;
}

export function equationPartAnchor(part, opposite) {
  let anchor = part.center;
  let best = Infinity;
  for (const candidate of opposite) {
    const kind = sameGlyph(part, candidate) ? 0 : part.role === candidate.role ? 1 : 2;
    const score =
      kind + (part.placement === candidate.placement ? 0 : 0.5) + distance(part.position, candidate.position);
    if (score < best) {
      best = score;
      anchor = candidate.center;
    }
  }
  return anchor;
}

export function sameMathOutline(a, b) {
  if (!sameGlyph(a, b)) return null;
  const from = a.contours.flatMap(({ commands }) => commands);
  const to = b.contours.flatMap(({ commands }) => commands);
  const project = (part, value, axis) => (value - part.center[axis]) / (axis === 0 ? part.width : part.height);
  if (
    from.length !== to.length ||
    !from.every(
      ([op, ...values], i) =>
        op === to[i][0] &&
        values.every((value, j) => Math.abs(project(a, value, j % 2) - project(b, to[i][j + 1], j % 2)) < 1e-6),
    )
  )
    return null;
  return (t) => from.map(([op, ...values], i) => [op, ...values.map((value, j) => value + (to[i][j + 1] - value) * t)]);
}
