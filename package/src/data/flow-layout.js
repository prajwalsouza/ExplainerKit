// Layered layout for flowcharts. Nodes take ranks along the flow (longest path from the sources, with cycles broken
// by reversing back edges), are ordered within each rank by repeated barycentre sweeps so edges cross less, and are
// then spaced to fill the drawing. Each edge becomes one cubic from its source's outgoing side to its target's
// incoming side; edges sharing a side spread across it so they leave as separate strands.
import { assert, number } from '../core/validate.js';

const SWEEPS = 8;

/** Approximate box size for a label, in drawing units. */
function boxOf(node, scale) {
  const chars = Math.min(28, node.label.length);
  const lines = node.label.length > 28 ? 2 : 1;
  let w = Math.max(56, chars * 6.6 + 30) * scale,
    h = (lines === 2 ? 50 : 36) * scale;
  if (node.shape === 'circle') w = h = Math.max(w * 0.72, h * 1.5);
  if (node.shape === 'diamond') {
    w *= 1.35;
    h *= 1.45;
  }
  return { w, h, lines };
}

/**
 * @param {{direction: string, nodes: {id: string, label: string, shape: string, group: string|null}[],
 *   edges: {from: string, to: string, label: string, style: string, arrow: boolean}[],
 *   groups: {id: string, title: string, members: string[]}[]}} graph
 * @param {number} width
 * @param {number} height
 */
export function flowLayout(graph, width, height) {
  number(width, 'flow width', 64, 8192);
  number(height, 'flow height', 64, 8192);
  const ids = graph.nodes.map((n) => n.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  const n = ids.length;
  assert(n > 0, 'INVALID_FLOW', 'A flowchart needs at least one node.');
  const edges = graph.edges.filter((e) => e.from !== e.to && index.has(e.from) && index.has(e.to));

  // Break cycles: an edge back to a node still on the depth-first path is drawn backwards.
  const out = ids.map(() => []);
  edges.forEach((e, k) => out[index.get(e.from)].push([index.get(e.to), k]));
  const state = new Uint8Array(n),
    back = new Set();
  for (let root = 0; root < n; root++) {
    if (state[root]) continue;
    const path = [[root, 0]];
    state[root] = 1;
    while (path.length) {
      const top = path.at(-1);
      const next = out[top[0]][top[1]++];
      if (!next) {
        state[top[0]] = 2;
        path.pop();
        continue;
      }
      const [to, k] = next;
      if (state[to] === 1) back.add(k);
      else if (!state[to]) {
        state[to] = 1;
        path.push([to, 0]);
      }
    }
  }
  // Ranks: the longest forward path into each node.
  const rank = new Array(n).fill(0);
  const forward = edges.map((e, k) =>
    back.has(k) ? [index.get(e.to), index.get(e.from)] : [index.get(e.from), index.get(e.to)],
  );
  for (let pass = 0; pass < n; pass++) {
    let changed = false;
    for (const [a, b] of forward)
      if (rank[b] < rank[a] + 1) {
        rank[b] = rank[a] + 1;
        changed = true;
      }
    if (!changed) break;
  }
  const ranks = [];
  for (let i = 0; i < n; i++) (ranks[rank[i]] ??= []).push(i);
  for (let r = 0; r < ranks.length; r++) ranks[r] ??= [];
  // Order within ranks: barycentre of neighbours in the other ranks, alternating down and up.
  const neighbours = ids.map(() => []);
  for (const [a, b] of forward) {
    neighbours[a].push(b);
    neighbours[b].push(a);
  }
  const position = new Float64Array(n);
  const place = () => ranks.forEach((list) => list.forEach((i, k) => (position[i] = (k + 0.5) / list.length)));
  place();
  for (let s = 0; s < SWEEPS; s++) {
    const down = s % 2 === 0;
    const sequence = down ? ranks : [...ranks].reverse();
    for (const list of sequence) {
      const centre = (i) => {
        const near = neighbours[i].filter((j) => (down ? rank[j] < rank[i] : rank[j] > rank[i]));
        return near.length ? near.reduce((sum, j) => sum + position[j], 0) / near.length : position[i];
      };
      const keyed = list.map((i) => [centre(i), position[i], i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      list.splice(0, list.length, ...keyed.map(([, , i]) => i));
      list.forEach((i, k) => (position[i] = (k + 0.5) / list.length));
    }
  }

  // Coordinates: ranks along the flow, order across it, scaled to the drawing.
  const horizontal = graph.direction === 'LR' || graph.direction === 'RL';
  const reversed = graph.direction === 'BT' || graph.direction === 'RL';
  const along = horizontal ? width : height,
    across = horizontal ? height : width;
  const widest = Math.max(...ranks.map((list) => list.length));
  const scale = Math.max(
    0.6,
    Math.min(
      1.15,
      (across * 0.82) / Math.max(1, widest * (horizontal ? 70 : 150)),
      (along * 0.8) / (ranks.length * 90),
    ),
  );
  const boxes = graph.nodes.map((node) => boxOf(node, scale));
  const margin = 0.09;
  const rankAt = (r) => {
    const u = ranks.length === 1 ? 0.5 : r / (ranks.length - 1);
    return along * (margin + (1 - 2 * margin) * (reversed ? 1 - u : u));
  };
  const nodes = graph.nodes.map((node, i) => {
    const list = ranks[rank[i]],
      k = list.indexOf(i);
    const spread = Math.min(across * (1 - 2 * margin), list.length * (horizontal ? 110 : 190) * scale);
    const a = rankAt(rank[i]),
      c = across / 2 + (list.length === 1 ? 0 : (k / (list.length - 1) - 0.5) * spread);
    return {
      ...node,
      rank: rank[i],
      x: horizontal ? a : c,
      y: horizontal ? c : a,
      w: boxes[i].w,
      h: boxes[i].h,
      lines: boxes[i].lines,
    };
  });

  // Ports: edges leaving or entering one side of a node spread across that side, ordered by where they go.
  const flowDir = horizontal ? [reversed ? -1 : 1, 0] : [0, reversed ? -1 : 1];
  const sideOf = (node, sign) => [node.x + (flowDir[0] * sign * node.w) / 2, node.y + (flowDir[1] * sign * node.h) / 2];
  const ports = new Map();
  const claim = (nodeIndex, sign, k, other) => {
    const key = nodeIndex + ':' + sign;
    if (!ports.has(key)) ports.set(key, []);
    ports.get(key).push([k, other]);
  };
  edges.forEach((e, k) => {
    const a = index.get(e.from),
      b = index.get(e.to);
    if (back.has(k)) {
      claim(a, -1, k, b);
      claim(b, 1, k, a);
    } else {
      claim(a, 1, k, b);
      claim(b, -1, k, a);
    }
  });
  const offsets = new Map();
  for (const [key, list] of ports) {
    const [nodeIndex] = key.split(':').map(Number);
    const node = nodes[nodeIndex];
    const crossAxis = (i) => (horizontal ? nodes[i].y : nodes[i].x);
    list.sort((p, q) => crossAxis(p[1]) - crossAxis(q[1]));
    const room = (horizontal ? node.h : node.w) * 0.6;
    list.forEach(([k], j) => {
      const offset = list.length === 1 ? 0 : (j / (list.length - 1) - 0.5) * room;
      offsets.set(key + ':' + k, offset);
    });
  }
  const shift = (point, offset) => (horizontal ? [point[0], point[1] + offset] : [point[0] + offset, point[1]]);
  const routes = edges.map((e, k) => {
    const a = index.get(e.from),
      b = index.get(e.to),
      isBack = back.has(k);
    const start = shift(sideOf(nodes[a], isBack ? -1 : 1), offsets.get(`${a}:${isBack ? -1 : 1}:${k}`) ?? 0);
    const end = shift(sideOf(nodes[b], isBack ? 1 : -1), offsets.get(`${b}:${isBack ? 1 : -1}:${k}`) ?? 0);
    const gap = Math.max(12, Math.min(160, Math.hypot(end[0] - start[0], end[1] - start[1]) * 0.45));
    const sense = isBack ? -1 : 1;
    let c1 = [start[0] + flowDir[0] * gap * sense, start[1] + flowDir[1] * gap * sense],
      c2 = [end[0] - flowDir[0] * gap * sense, end[1] - flowDir[1] * gap * sense];
    if (isBack) {
      // A back edge swings out to the side so it never runs through the nodes between.
      const side = horizontal ? [0, -1] : [1, 0],
        swing = across * 0.08 + gap * 0.5;
      c1 = [c1[0] + side[0] * swing, c1[1] + side[1] * swing];
      c2 = [c2[0] + side[0] * swing, c2[1] + side[1] * swing];
    }
    return { ...e, back: isBack, points: [start, c1, c2, end] };
  });
  const groups = graph.groups.map((g) => {
    const members = nodes.filter((node) => node.group === g.id);
    const x0 = Math.min(...members.map((m) => m.x - m.w / 2)) - 22 * scale,
      x1 = Math.max(...members.map((m) => m.x + m.w / 2)) + 22 * scale,
      y0 = Math.min(...members.map((m) => m.y - m.h / 2)) - 30 * scale,
      y1 = Math.max(...members.map((m) => m.y + m.h / 2)) + 18 * scale;
    return { id: g.id, title: g.title, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  });
  return { direction: graph.direction, horizontal, scale, nodes, edges: routes, groups };
}
