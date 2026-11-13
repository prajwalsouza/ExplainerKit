import { assert, number, text, options, safeCopy } from '../core/validate.js';

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
/** Explainable grouping suggestions. Explicit semantic exclusions win over heuristics.
 * @param {Array<{id:string,bounds:{x:number,y:number,width:number,height:number},ink?:number[][],inkWidth?:number,velocity?:{x:number,y:number},similarity?:string,region?:string}>} input
 * @param {{distance?:number,similarityDistance?:number,motionDistance?:number,velocityTolerance?:number,minSpeed?:number,together?:string[][],apart?:string[][],connections?:string[][]}} [spec]
 */
export function perceptualGroups(input, spec = {}) {
  options(
    spec,
    [
      'distance',
      'similarityDistance',
      'motionDistance',
      'velocityTolerance',
      'minSpeed',
      'together',
      'apart',
      'connections',
    ],
    'perceptual groups',
  );
  const source = safeCopy(input);
  assert(
    Array.isArray(source) && source.length <= 512,
    'RESOURCE_LIMIT',
    'Perceptual grouping accepts at most 512 items.',
  );
  const ids = new Set(),
    items = source
      .map((item) => {
        options(item, ['id', 'bounds', 'velocity', 'similarity', 'region', 'ink', 'inkWidth'], 'perceptual item');
        const id = text(item.id, 'item id', 200);
        assert(id.length && !ids.has(id), 'DUPLICATE_ID', 'Items need unique nonempty IDs.');
        ids.add(id);
        options(item.bounds, ['x', 'y', 'width', 'height'], 'item bounds');
        const b = item.bounds;
        const bounds = Object.freeze({
          x: number(b.x, 'bounds x'),
          y: number(b.y, 'bounds y'),
          width: number(b.width, 'bounds width', 0),
          height: number(b.height, 'bounds height', 0),
        });
        let velocity = null;
        if (item.velocity !== undefined) {
          options(item.velocity, ['x', 'y'], 'velocity');
          velocity = Object.freeze({
            x: number(item.velocity.x, 'velocity x'),
            y: number(item.velocity.y, 'velocity y'),
          });
        }
        let ink = null;
        if (item.ink !== undefined) {
          assert(
            Array.isArray(item.ink) && item.ink.length >= 2 && item.ink.length <= 128,
            'RESOURCE_LIMIT',
            'Ink is a polyline of 2–128 points.',
          );
          ink = Object.freeze(
            item.ink.map((p) => {
              assert(Array.isArray(p) && p.length === 2, 'INVALID_GROUP', 'Ink points are [x,y].');
              return Object.freeze([number(p[0], 'ink x'), number(p[1], 'ink y')]);
            }),
          );
        }
        const inkWidth = number(item.inkWidth ?? 0, 'ink width', 0, 1e5);
        return Object.freeze({
          id,
          bounds,
          velocity,
          ink,
          inkWidth,
          similarity: item.similarity === undefined ? null : text(item.similarity, 'similarity key', 200),
          region: item.region === undefined ? null : text(item.region, 'region key', 200),
        });
      })
      .sort((a, b) => compare(a.id, b.id));
  const segmentCount = items.reduce((sum, item) => sum + (item.ink ? item.ink.length - 1 : 4), 0);
  assert(segmentCount * segmentCount <= 8000000, 'RESOURCE_LIMIT', 'Ink comparison exceeds the segment budget.');
  const gap = number(spec.distance ?? 24, 'proximity distance', 0, 1e6),
    similarityDistance = number(spec.similarityDistance ?? gap * 2, 'similarity distance', 0, 1e7),
    motionDistance = number(spec.motionDistance ?? gap * 4, 'motion distance', 0, 1e7);
  const velocityTolerance = number(spec.velocityTolerance ?? 0.1, 'velocity tolerance', 0, 1e6),
    minSpeed = number(spec.minSpeed ?? 0.001, 'minimum speed', 0, 1e6);
  const pairList = (value, label) => {
    const list = safeCopy(value ?? []);
    assert(Array.isArray(list) && list.length <= 4096, 'RESOURCE_LIMIT', `${label} accepts at most 4096 pairs.`);
    return list.map((p) => {
      assert(
        Array.isArray(p) && p.length === 2 && p[0] !== p[1] && p.every((id) => ids.has(id)),
        'INVALID_GROUP',
        `${label} needs two different known IDs.`,
      );
      return [...p].sort(compare);
    });
  };
  const apart = pairList(spec.apart, 'apart'),
    connections = pairList(spec.connections, 'connections');
  assert(
    items.length * items.length * Math.max(1, apart.length) <= 8000000,
    'RESOURCE_LIMIT',
    'Pair/exclusion work exceeds the grouping budget.',
  );
  const together = safeCopy(spec.together ?? []);
  assert(Array.isArray(together) && together.length <= 512, 'RESOURCE_LIMIT', 'Use at most 512 semantic groups.');
  const parent = new Map(items.map((i) => [i.id, i.id])),
    members = new Map(items.map((i) => [i.id, new Set([i.id])]));
  function find(id) {
    while (parent.get(id) !== id) id = parent.get(id);
    return id;
  }
  function blocked(a, b) {
    const left = members.get(find(a)),
      right = members.get(find(b));
    return apart.filter(([x, y]) => (left.has(x) && right.has(y)) || (left.has(y) && right.has(x)));
  }
  function union(a, b) {
    a = find(a);
    b = find(b);
    if (a === b) return;
    if (compare(a, b) > 0) [a, b] = [b, a];
    parent.set(b, a);
    for (const id of members.get(b)) members.get(a).add(id);
    members.delete(b);
  }
  for (const group of together) {
    assert(
      Array.isArray(group) &&
        group.length >= 2 &&
        group.length <= 512 &&
        new Set(group).size === group.length &&
        group.every((id) => ids.has(id)),
      'INVALID_GROUP',
      'Together groups need distinct known IDs.',
    );
    const sorted = [...group].sort(compare);
    for (const id of sorted.slice(1)) {
      assert(!blocked(sorted[0], id).length, 'GROUP_CONFLICT', 'Together and apart constraints contradict.');
      union(sorted[0], id);
    }
  }
  const connected = new Set(connections.map((p) => JSON.stringify(p))),
    edges = [];
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i],
        b = items[j],
        u = a.bounds,
        v = b.bounds;
      const d =
        a.ink || b.ink
          ? Math.max(0, inkGap(a, b) - (a.ink ? a.inkWidth / 2 : 0) - (b.ink ? b.inkWidth / 2 : 0))
          : Math.hypot(
              Math.max(0, u.x - v.x - v.width, v.x - u.x - u.width),
              Math.max(0, u.y - v.y - v.height, v.y - u.y - u.height),
            );
      const reasons = [];
      let priority = 0;
      if (a.region !== null && a.region === b.region) {
        reasons.push('commonRegion');
        priority = 4;
      }
      if (connected.has(JSON.stringify([a.id, b.id]))) {
        reasons.push('connectedness');
        priority = Math.max(priority, 4);
      }
      if (
        a.velocity &&
        b.velocity &&
        Math.min(Math.hypot(a.velocity.x, a.velocity.y), Math.hypot(b.velocity.x, b.velocity.y)) > minSpeed &&
        d <= motionDistance &&
        Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y) <= velocityTolerance
      ) {
        reasons.push('commonFate');
        priority = Math.max(priority, 3);
      }
      if (a.similarity !== null && a.similarity === b.similarity && d <= similarityDistance) {
        reasons.push('similarity');
        priority = Math.max(priority, 2);
      }
      if (d <= gap) {
        reasons.push('proximity');
        priority = Math.max(priority, 1);
      }
      if (reasons.length) edges.push({ a: a.id, b: b.id, reasons: Object.freeze(reasons), gap: d, priority });
    }
  edges.sort((a, b) => b.priority - a.priority || a.gap - b.gap || compare(a.a, b.a) || compare(a.b, b.b));
  const evidence = edges.map((e) => {
    const exclusions = blocked(e.a, e.b),
      accepted = exclusions.length === 0;
    if (accepted) union(e.a, e.b);
    return Object.freeze({ ...e, accepted, blockedBy: Object.freeze(exclusions.map((p) => Object.freeze(p))) });
  });
  const groups = [...members.entries()]
    .sort(([a], [b]) => compare(a, b))
    .map(([id, group]) => Object.freeze({ id: `group:${id}`, members: Object.freeze([...group].sort(compare)) }));
  return Object.freeze({
    groups: Object.freeze(groups),
    edges: Object.freeze(evidence),
    policy: Object.freeze({ distance: gap, similarityDistance, motionDistance, velocityTolerance, minSpeed }),
    semanticGroups: together,
  });
}

/** Common onset: keep each proposed group together in an authored entrance sequence. */
export function groupStagger(plan, spec = {}) {
  options(spec, ['at', 'interval'], 'group stagger');
  const descriptor = plan && typeof plan === 'object' ? Object.getOwnPropertyDescriptor(plan, 'groups') : null;
  assert(descriptor && 'value' in descriptor, 'INVALID_GROUP', 'Use a grouping plan with declarative groups.');
  const at = number(spec.at ?? 0, 'stagger start', 0, 86400),
    interval = number(spec.interval ?? 0.15, 'group interval', 0, 86400),
    groups = safeCopy(descriptor.value);
  assert(Array.isArray(groups) && groups.length <= 512, 'INVALID_GROUP', 'Use a bounded grouping plan.');
  const times = Object.create(null);
  groups.forEach((group, i) => {
    const time = number(at + i * interval, 'group time', 0, 86400);
    assert(Array.isArray(group.members), 'INVALID_GROUP', 'A group needs member IDs.');
    for (const id of group.members) {
      text(id, 'member id', 200);
      assert(!Object.hasOwn(times, id), 'DUPLICATE_ID', 'An item cannot occur in two timing groups.');
      times[id] = time;
    }
  });
  return Object.freeze(times);
}

// Narrow-phase distance between actual polyline ink and box ink, avoiding empty-box bridges.
function inkGap(a, b) {
  const outline = (item) =>
    item.ink ?? [
      [item.bounds.x, item.bounds.y],
      [item.bounds.x + item.bounds.width, item.bounds.y],
      [item.bounds.x + item.bounds.width, item.bounds.y + item.bounds.height],
      [item.bounds.x, item.bounds.y + item.bounds.height],
      [item.bounds.x, item.bounds.y],
    ];
  const A = outline(a),
    B = outline(b),
    contains = (p, item) =>
      !item.ink &&
      p[0] >= item.bounds.x &&
      p[0] <= item.bounds.x + item.bounds.width &&
      p[1] >= item.bounds.y &&
      p[1] <= item.bounds.y + item.bounds.height;
  if (A.some((p) => contains(p, b)) || B.some((p) => contains(p, a))) return 0;
  const point = (p, u, v) => {
    const x = v[0] - u[0],
      y = v[1] - u[1],
      d = x * x + y * y,
      t = d ? Math.max(0, Math.min(1, ((p[0] - u[0]) * x + (p[1] - u[1]) * y) / d)) : 0;
    return Math.hypot(p[0] - u[0] - t * x, p[1] - u[1] - t * y);
  };
  const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  let gap = Infinity;
  for (let i = 1; i < A.length; i++)
    for (let j = 1; j < B.length; j++) {
      const p = A[i - 1],
        q = A[i],
        u = B[j - 1],
        v = B[j],
        c1 = cross(p, q, u),
        c2 = cross(p, q, v),
        c3 = cross(u, v, p),
        c4 = cross(u, v, q);
      if (c1 * c2 < 0 && c3 * c4 < 0) return 0;
      gap = Math.min(gap, point(p, u, v), point(q, u, v), point(u, p, q), point(v, p, q));
      if (gap === 0) return 0;
    }
  return gap;
}
