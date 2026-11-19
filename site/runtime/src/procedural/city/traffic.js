import { assert, number, options } from '../../core/validate.js';
import { randomAt } from '../../noise/vector.js';
import { VEHICLE_SHAPES, VEHICLE_VARIANTS, vehicleLook, vehicleShape } from './vehicles.js';

// Traffic that moves. Roads become directed lanes between junctions, rails become tracks, and
// vehicles drive along them: each keeps to its lane on the proper side, holds a gap to the one
// ahead, slows for bends, waits its turn at junctions, obeys signals, and buses and trams dwell
// at their stops.
//
// Where everything is at a time t is a pure function of t. Vehicles react to each other, so the
// function is evaluated by stepping a fixed-step simulation from time zero; snapshots taken on
// the way make later questions fast, and asking about an earlier time gives the same answer it
// gave before. Map coordinates throughout: x east, y north, metres.

export const trafficLimits = Object.freeze({ vehicles: 600, edges: 20_000, time: 6 * 3600 });
const STEP = 0.1,
  SNAPSHOT = 4;
// A lane piece shorter than this lies between two junctions that work as one: nobody stops on it.
const SHORT = 12;
const DRIVE = new Set([
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'unclassified',
  'residential',
  'living_street',
  'busway',
  'motorway_link',
  'trunk_link',
  'primary_link',
  'secondary_link',
  'tertiary_link',
]);
const BUS_ROADS = new Set(['trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'busway']);
/** Speed in km/h on a road whose limit the map does not give. */
export const DEFAULT_SPEEDS = Object.freeze({
  motorway: 80,
  trunk: 60,
  primary: 50,
  secondary: 50,
  tertiary: 40,
  unclassified: 40,
  residential: 30,
  living_street: 12,
  busway: 40,
});
const PARKING_BAY = 2.0,
  LANE = 2.8;

/**
 * How a carriageway is shared out: which sides have room for a row of parked cars once the
 * moving lanes are kept clear. Returns {left, right} as 0 or 1, seen along the road's own
 * direction. The same answer places parked cars and positions the moving lanes, so the two
 * never overlap.
 */
export function parkingPlan(road, half, drive = 'right') {
  const lanes = road.oneway ? 1 : 2;
  const spare = 2 * half - lanes * LANE;
  const bays = Math.max(0, Math.min(2, Math.floor(spare / PARKING_BAY)));
  if (bays === 2) return { left: 1, right: 1 };
  if (bays === 0) return { left: 0, right: 0 };
  // One row: on the kerb side of traffic.
  return drive === 'left' ? { left: 1, right: 0 } : { left: 0, right: 1 };
}

const key = (p) => `${Math.round(p.x * 10)},${Math.round(p.y * 10)}`;
// A polyline moved sideways by `d` metres (positive is to the right of travel).
function shifted(points, d) {
  const n = points.length,
    out = [];
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)],
      b = points[Math.min(n - 1, i + 1)];
    let dx = b.x - a.x,
      dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    out.push({ x: points[i].x + dy * d, y: points[i].y - dx * d });
  }
  return out;
}
// Points and running length as [x, y, s] triples.
function pack(points) {
  const out = new Float32Array(points.length * 3);
  let s = 0;
  points.forEach((p, i) => {
    if (i) s += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
    out.set([p.x, p.y, s], i * 3);
  });
  return out;
}
// The part of a polyline between two distances along it.
function slice(points, from, to) {
  const out = [];
  let s = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i],
      b = points[i + 1],
      l = Math.hypot(b.x - a.x, b.y - a.y);
    if (l < 1e-6) continue;
    const at = (d) => ({ x: a.x + ((b.x - a.x) * (d - s)) / l, y: a.y + ((b.y - a.y) * (d - s)) / l });
    if (from >= s && from < s + l) out.push(at(from));
    if (s > from && s < to) out.push(a);
    if (to > s && to <= s + l) out.push(at(to));
    s += l;
  }
  return out.length >= 2 ? out : [points[0], points[points.length - 1]];
}
// Position and direction at a distance along packed points.
function locate(path, s, out) {
  const n = path.length / 3;
  let lo = 0,
    hi = n - 1;
  const d = Math.min(path[(n - 1) * 3 + 2], Math.max(0, s));
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path[mid * 3 + 2] <= d) lo = mid;
    else hi = mid;
  }
  const a = lo * 3,
    b = hi * 3,
    span = Math.max(1e-6, path[b + 2] - path[a + 2]),
    t = (d - path[a + 2]) / span;
  out.x = path[a] + (path[b] - path[a]) * t;
  out.y = path[a + 1] + (path[b + 1] - path[a + 1]) * t;
  out.dx = (path[b] - path[a]) / span;
  out.dy = (path[b + 1] - path[a + 1]) / span;
  return out;
}

/**
 * Plan the traffic of a place: the lanes, the tracks, the stops, the signals and the vehicles.
 * `context` gives {bounds, seed, style, cars} from the city build, where `cars` lists each
 * drivable road with its half-width. Options: `cars`, `buses` and `trams` scale how many run
 * (0 to 4, 1 is typical, 0 none), `speed` scales every speed, `headway` is the time gap kept
 * to the vehicle ahead in seconds, and `signalCycle` is the length of a signal cycle in seconds.
 */
export function planTraffic(osm, context, spec = {}) {
  options(spec, ['cars', 'buses', 'trams', 'bikes', 'speed', 'headway', 'signalCycle', 'variety'], 'traffic');
  const want = {
    cars: number(spec.cars ?? 1, 'traffic cars', 0, 4),
    buses: number(spec.buses ?? 1, 'traffic buses', 0, 4),
    trams: number(spec.trams ?? 1, 'traffic trams', 0, 4),
    bikes: number(spec.bikes ?? 1, 'traffic bikes', 0, 4),
  };
  // How much drivers and riders differ from one another: 0 makes them identical, 1 is typical.
  const variety = number(spec.variety ?? 1, 'traffic variety', 0, 2);
  const speedScale = number(spec.speed ?? 1, 'traffic speed', 0.1, 3),
    headway = number(spec.headway ?? 1.4, 'traffic headway', 0.5, 6),
    cycle = number(spec.signalCycle ?? 36, 'signalCycle', 10, 240);
  const { bounds, seed, style } = context;
  const left = style?.drive === 'left';
  const insideModel = (p) => p.x > bounds.x0 + 3 && p.x < bounds.x1 - 3 && p.y > bounds.y0 + 3 && p.y < bounds.y1 - 3;
  const edges = [],
    nodes = new Map();
  const node = (p) => {
    const k = key(p);
    let n = nodes.get(k);
    if (!n)
      nodes.set(
        k,
        (n = {
          id: nodes.size,
          x: p.x,
          y: p.y,
          out: [],
          arms: 0,
          half: 0,
          exit: !insideModel(p),
          signal: false,
          rail: false,
        }),
      );
    return n;
  };
  // Keep only the parts of a way that lie inside the model, cutting it where it crosses the
  // edge. Vehicles leave and enter at those cuts, so none drives on the bare ground beyond.
  const inBox = (p) => p.x >= bounds.x0 && p.x <= bounds.x1 && p.y >= bounds.y0 && p.y <= bounds.y1;
  const crossing = (a, b) => {
    // The point where the segment from inside point a to outside point b meets the box.
    let t = 1;
    const cut = (from, to, limit, above) => {
      if (above ? to > limit : to < limit) t = Math.min(t, (limit - from) / (to - from));
    };
    cut(a.x, b.x, bounds.x0, false);
    cut(a.x, b.x, bounds.x1, true);
    cut(a.y, b.y, bounds.y0, false);
    cut(a.y, b.y, bounds.y1, true);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  };
  const clipped = (way) => {
    const runs = [];
    let run = null;
    way.points.forEach((p, i) => {
      const here = inBox(p),
        prev = i ? way.points[i - 1] : null;
      if (here) {
        if (!run) run = prev ? [crossing(p, prev)] : [];
        run.push(p);
      } else if (run) {
        run.push(crossing(prev, p));
        runs.push(run);
        run = null;
      }
    });
    if (run) runs.push(run);
    return runs.filter((r) => r.length >= 2).map((points) => ({ ...way, points }));
  };
  // Cut a set of ways into pieces between the points they share.
  const network = (allWays, makeEdges) => {
    const ways = allWays.flatMap(clipped);
    const uses = new Map();
    for (const w of ways)
      w.points.forEach((p, i) => {
        const k = key(p);
        uses.set(k, (uses.get(k) ?? 0) + (i === 0 || i === w.points.length - 1 ? 1 : 2) + (uses.has(k) ? 100 : 0));
      });
    for (const w of ways) {
      let start = 0;
      for (let i = 1; i < w.points.length; i++) {
        const last = i === w.points.length - 1;
        if (!last && (uses.get(key(w.points[i])) ?? 0) < 100) continue;
        const piece = w.points.slice(start, i + 1);
        start = i;
        let len = 0;
        for (let k = 1; k < piece.length; k++)
          len += Math.hypot(piece[k].x - piece[k - 1].x, piece[k].y - piece[k - 1].y);
        if (len < 1.5) continue;
        makeEdges(w, piece, len);
      }
    }
  };
  const addEdge = (from, to, points, extra) => {
    assert(
      edges.length < trafficLimits.edges,
      'RESOURCE_LIMIT',
      `Traffic is planned on at most ${trafficLimits.edges} lane pieces.`,
    );
    const path = pack(points);
    const e = {
      id: edges.length,
      from: from.id,
      to: to.id,
      path,
      len: path[path.length - 1],
      stops: [],
      rev: -1,
      ...extra,
    };
    edges.push(e);
    from.out.push(e.id);
    return e;
  };

  // ---- roads: one lane each way, set to the proper side and clear of parked rows
  const roads = context.cars.filter(
    ({ road }) => DRIVE.has(road.highway) && !road.tunnel && road.access !== 'private' && road.access !== 'no',
  );
  network(
    roads.map(({ road, half }) => ({ points: road.points, road, half })),
    (w, piece, len) => {
      const a = node(piece[0]),
        b = node(piece[piece.length - 1]);
      for (const n of [a, b]) {
        n.arms++;
        n.half = Math.max(n.half, w.half);
      }
      const parking = parkingPlan(w.road, w.half, style?.drive);
      // The moving band, measured to the right of the road's own direction.
      const lo = -w.half + PARKING_BAY * parking.left,
        hi = w.half - PARKING_BAY * parking.right,
        mid = (lo + hi) / 2;
      const limit = (w.road.maxspeed ?? DEFAULT_SPEEDS[w.road.highway.replace('_link', '')] ?? 30) / 3.6;
      const info = {
        kind: 'road',
        v0: limit * 0.92 * speedScale,
        half: w.half,
        bus: BUS_ROADS.has(w.road.highway),
        road: w.road.id,
        busOnly: w.road.highway === 'busway',
      };
      if (w.road.oneway) addEdge(a, b, shifted(piece, mid), info);
      else {
        const side = left ? -1 : 1;
        const forward = addEdge(a, b, shifted(piece, mid + (side * (hi - lo)) / 4), info);
        const back = addEdge(b, a, shifted(piece.slice().reverse(), -(mid - (side * (hi - lo)) / 4)), info);
        forward.rev = back.id;
        back.rev = forward.id;
      }
      void len;
    },
  );
  const roadEdges = edges.length;
  // ---- rails: trams keep to the direction their track is drawn in
  const tracks = (osm.rails ?? []).filter(
    (r) => (r.kind === 'tram' || r.kind === 'light_rail') && !r.tunnel && r.points.length >= 2,
  );
  const railNode = (p) => {
    const n = node({ x: p.x + 7777, y: p.y });
    n.x = p.x;
    n.rail = true;
    n.exit = !insideModel(p);
    return n;
  };
  network(tracks, (w, piece) => {
    addEdge(railNode(piece[0]), railNode(piece[piece.length - 1]), piece, {
      kind: 'rail',
      v0: 8.3 * speedScale,
      half: 1.3,
      bus: false,
      road: w.id,
    });
  });

  const railEnd = edges.length;
  // ---- cycle paths: riders keep to their side of the path, one line each way
  const cycleNode = (p) => {
    const n = node({ x: p.x + 15555, y: p.y });
    n.x = p.x;
    n.rail = true;
    n.exit = !insideModel(p);
    return n;
  };
  network(
    (osm.roads ?? []).filter((r) => r.highway === 'cycleway' && !r.tunnel && r.points.length >= 2),
    (w, piece) => {
      const a = cycleNode(piece[0]),
        b = cycleNode(piece[piece.length - 1]);
      const side = (left ? -1 : 1) * Math.min(0.5, w.width / 4);
      const info = { kind: 'cycle', v0: 5.2 * speedScale, half: w.width / 2, bus: false, road: w.id };
      const forward = addEdge(a, b, shifted(piece, side), info);
      if (!w.oneway) {
        const back = addEdge(b, a, shifted(piece.slice().reverse(), side), info);
        forward.rev = back.id;
        back.rev = forward.id;
      }
    },
  );

  // ---- junction geometry: stop short of the junction, and cross it on an arc
  const nodeList = [...nodes.values()].sort((p, q) => p.id - q.id);
  for (const n of nodeList) n.radius = n.rail ? 0 : n.arms >= 3 ? n.half * 0.85 + 1.4 : n.arms === 2 ? 0.6 : 0;
  for (const e of edges) {
    const a = nodeList[e.from],
      b = nodeList[e.to];
    const total = e.len;
    const trimA = Math.min(a.radius, total * 0.3),
      trimB = Math.min(b.radius, total * 0.3);
    if (trimA > 0.01 || trimB > 0.01) {
      const pts = [];
      for (let i = 0; i < e.path.length; i += 3) pts.push({ x: e.path[i], y: e.path[i + 1] });
      e.path = pack(slice(pts, trimA, total - trimB));
      e.len = e.path[e.path.length - 1];
    }
    const end = locate(e.path, e.len, {});
    // Signals alternate between the two crossing directions of a junction.
    e.group = Math.abs(end.dx) > Math.abs(end.dy) ? 0 : 1;
  }
  // Signals: junctions beside a mapped signal-controlled crossing or traffic signal.
  const signalPoints = [
    ...(osm.crossings ?? []).filter((x) => x.kind === 'signals'),
    ...(osm.amenities ?? []).filter((a) => a.kind === 'traffic_signals'),
  ];
  for (const n of nodeList) {
    if (n.rail || n.arms < 3) continue;
    n.signal = signalPoints.some((s) => Math.hypot(s.x - n.x, s.y - n.y) < n.half + 14);
    n.offset = randomAt(seed, n.id, 71) * cycle;
  }
  // Stops: a bus stop belongs to the nearest lane a bus may use, a tram stop to the nearest track.
  const where = {};
  const attach = (stop, wantRail, dwell) => {
    let best = null;
    for (const e of edges) {
      if ((e.kind === 'rail') !== wantRail || (!wantRail && !e.bus)) continue;
      // The nearest point of the lane, measured to its segments and not only to its corners.
      for (let i = 0; i + 3 < e.path.length; i += 3) {
        const ax = e.path[i],
          ay = e.path[i + 1],
          dx = e.path[i + 3] - ax,
          dy = e.path[i + 4] - ay,
          l2 = dx * dx + dy * dy || 1;
        const t = Math.min(1, Math.max(0, ((stop.x - ax) * dx + (stop.y - ay) * dy) / l2));
        const d = Math.hypot(stop.x - ax - dx * t, stop.y - ay - dy * t);
        if (d < (best?.d ?? (wantRail ? 14 : 11))) best = { e, d, s: e.path[i + 2] + Math.sqrt(l2) * t };
      }
    }
    if (best)
      best.e.stops.push({
        id: Number(stop.id) || edges.length + best.s,
        s: Math.min(best.e.len - 0.5, Math.max(3, best.s)),
        dwell,
      });
  };
  for (const a of osm.amenities ?? []) {
    if (a.kind === 'bus_stop') attach(a, false, 9 + randomAt(seed, Number(a.id) % 100000, 72) * 8);
    else if (a.kind === 'tram_stop') attach(a, true, 14 + randomAt(seed, Number(a.id) % 100000, 73) * 8);
  }
  for (const e of edges) e.stops.sort((p, q) => p.s - q.s);
  void where;

  // ---- vehicles
  const vehicles = [];
  const weights = style?.cars ?? [4, 3, 3, 2.5, 1.2];
  const bodies = ['hatch', 'sedan', 'estate', 'suv', 'van'];
  const paints = context.paints ?? [[0.8, 0.8, 0.8]];
  const place = (list, count, make) => {
    if (!list.length || count <= 0) return;
    const total = list.reduce((a, e) => a + e.len, 0);
    const gap = total / count;
    let next = gap * 0.5,
      run = 0,
      i = 0;
    for (const e of list) {
      while (next < run + e.len && i < count) {
        const s = next - run;
        if (s > 2 && s < e.len - 2 && vehicles.length < trafficLimits.vehicles) {
          const id = vehicles.length;
          const r = (k) => (randomAt(seed, id, 90 + k) - 0.5) * 2 * variety;
          // No two drivers are alike: each has a pace, a following distance, a way of pulling
          // away and a place in the lane, and each drifts a little as it goes.
          vehicles.push({
            edge: e.id,
            s,
            pace: 1 + 0.13 * r(1),
            gapTime: Math.max(0.7, headway * (1 + 0.3 * r(2))),
            pull: 1.5 * (1 + 0.22 * r(3)),
            rest: 2.0 + 0.5 * r(4),
            sway: 0.16 * (0.4 + Math.abs(r(5))),
            phase: randomAt(seed, id, 96) * 6.283,
            ...make(id),
          });
        }
        next += gap * (0.75 + 0.5 * randomAt(seed, i, 74));
        i++;
      }
      run += e.len;
    }
  };
  const carLanes = edges.slice(0, roadEdges).filter((e) => !e.busOnly),
    busLanes = edges.slice(0, roadEdges).filter((e) => e.bus),
    railLanes = edges.slice(roadEdges, railEnd),
    cycleLanes = edges.slice(railEnd);
  const lengthOf = (list) => list.reduce((a, e) => a + e.len, 0);
  place(carLanes, Math.round((lengthOf(carLanes) / 1000) * 13 * want.cars), (i) => {
    let pick = randomAt(seed, i, 75) * weights.reduce((a, w) => a + w, 0),
      k = 0;
    while (k < 4 && (pick -= weights[k]) > 0) k++;
    // A few work vehicles and taxis among the private cars; the regional style sets how many
    // pickups there are.
    const u = randomAt(seed, i, 78);
    const pickups = style?.name === 'american' ? 0.12 : 0.02;
    const kind = u < 0.05 ? 'taxi' : u < 0.09 ? 'boxTruck' : u < 0.09 + pickups ? 'pickup' : bodies[k];
    const variant = Math.floor(randomAt(seed, i, 79) * VEHICLE_VARIANTS);
    const length = vehicleShape(kind, vehicleLook(kind, variant, seed, style?.name)).length;
    return {
      kind,
      variant,
      length,
      paint:
        kind === 'taxi'
          ? (context.taxiPaint ?? [0.95, 0.75, 0.12])
          : paints[Math.floor(randomAt(seed, i, 76) * paints.length)],
      type: 0,
    };
  });
  place(busLanes, Math.min(12, Math.round((lengthOf(busLanes) / 1000) * 0.9 * want.buses)), () => ({
    kind: 'bus',
    length: VEHICLE_SHAPES.bus.length,
    paint: context.busPaint ?? [0.75, 0.12, 0.1],
    type: 1,
  }));
  place(railLanes, Math.min(10, Math.round((lengthOf(railLanes) / 600) * want.trams)), () => ({
    kind: 'tram',
    length: VEHICLE_SHAPES.tram.length * 3,
    paint: context.tramPaint ?? [0.9, 0.9, 0.86],
    type: 2,
  }));
  // Riders are planned only once a rider model exists: pass `riderModel: true` from the caller
  // that can draw one. Until then the cycle paths are in the network but stay empty.
  place(
    cycleLanes,
    context.riderModel ? Math.min(140, Math.round((lengthOf(cycleLanes) / 1000) * 14 * want.bikes)) : 0,
    (i) => {
      const coats = context.riderPaints ?? paints;
      return { kind: 'bicycle', length: 1.8, paint: coats[Math.floor(randomAt(seed, i, 77) * coats.length)], type: 3 };
    },
  );
  // What a renderer draws: one unit per vehicle, three sections per tram.
  const units = [];
  vehicles.forEach((v, i) => {
    if (v.type === 2)
      for (const [mesh, offset] of [
        ['tram.front', VEHICLE_SHAPES.tram.length],
        ['tram.middle', 0],
        ['tram.rear', -VEHICLE_SHAPES.tram.length],
      ])
        units.push({ vehicle: i, mesh, offset });
    else units.push({ vehicle: i, mesh: v.variant !== undefined ? `${v.kind}~${v.variant}` : v.kind, offset: 0 });
  });
  return Object.freeze({
    edges: Object.freeze(edges),
    nodes: Object.freeze(nodeList),
    vehicles: Object.freeze(vehicles.map((v) => Object.freeze(v))),
    units: Object.freeze(units.map((u) => Object.freeze(u))),
    headway,
    cycle,
    seed,
    stats: Object.freeze({
      lanes: roadEdges,
      tracks: railLanes.length,
      cyclePaths: cycleLanes.length,
      bikes: vehicles.filter((v) => v.type === 3).length,
      cars: vehicles.filter((v) => v.type === 0).length,
      buses: vehicles.filter((v) => v.type === 1).length,
      trams: vehicles.filter((v) => v.type === 2).length,
      signals: nodeList.filter((n) => n.signal).length,
    }),
  });
}

// ------------------------------------------------------------------------- simulation

const simulators = new WeakMap();
function simulator(plan) {
  let sim = simulators.get(plan);
  if (sim) return sim;
  const { edges, nodes, vehicles } = plan;
  const N = vehicles.length;
  const connectors = new Map();
  const tmpA = {},
    tmpB = {};
  // The arc a vehicle follows across a junction from one lane to the next.
  const connector = (a, b) => {
    const k = a * 32768 + b;
    let c = connectors.get(k);
    if (c) return c;
    const A = edges[a],
      B = edges[b];
    const p0 = locate(A.path, A.len, tmpA),
      p2 = locate(B.path, 0, tmpB);
    const gapLen = Math.hypot(p2.x - p0.x, p2.y - p0.y);
    // Control point where the two lane directions meet; straight across when they are in line.
    const cross = p0.dx * p2.dy - p0.dy * p2.dx;
    let cx = (p0.x + p2.x) / 2,
      cy = (p0.y + p2.y) / 2;
    if (Math.abs(cross) > 0.08) {
      const t = ((p2.x - p0.x) * p2.dy - (p2.y - p0.y) * p2.dx) / cross;
      if (t > 0 && t < gapLen * 2) {
        cx = p0.x + p0.dx * t;
        cy = p0.y + p0.dy * t;
      }
    }
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const u = i / 8,
        w = 1 - u;
      pts.push({ x: w * w * p0.x + 2 * w * u * cx + u * u * p2.x, y: w * w * p0.y + 2 * w * u * cy + u * u * p2.y });
    }
    const path = pack(pts);
    const turn = Math.acos(Math.max(-1, Math.min(1, p0.dx * p2.dx + p0.dy * p2.dy)));
    c = {
      path,
      len: Math.max(0.01, path[path.length - 1]),
      vmax: A.kind === 'rail' ? 5 : 3.2 + 9 * Math.max(0, 1 - turn / 1.4) ** 2,
    };
    connectors.set(k, c);
    return c;
  };
  // Which way to go at the end of a lane. A driver prefers to carry straight on, avoids the
  // way with the longest queue, and beyond that follows its own whim.
  const chooseNext = (i, e, hop, queues) => {
    const edge = edges[e],
      n = nodes[edge.to];
    // Leave at the edge of the model, unless there is no lane to come back in on: then turn round.
    if (n.exit) return entries[vehicles[i].type].length || edge.rev < 0 ? -1 : edge.rev;
    const v = vehicles[i];
    let options_ = n.out.filter(
      (o) => o !== edge.rev && edges[o].kind === edge.kind && (v.type === 1 || !edges[o].busOnly),
    );
    if (v.type === 1 && options_.some((o) => edges[o].bus)) options_ = options_.filter((o) => edges[o].bus);
    if (!options_.length) return edge.rev >= 0 && !n.exit ? edge.rev : -1;
    const end = locate(edge.path, edge.len, tmpA);
    const ex = end.dx,
      ey = end.dy;
    let pick = options_[0],
      bestScore = Infinity;
    options_.forEach((o, k) => {
      const start = locate(edges[o].path, 0, tmpB);
      const straight = 1 - (ex * start.dx + ey * start.dy);
      const queue = queues ? (queues[o].length * 7) / Math.max(14, edges[o].len) : 0;
      const whim = randomAt(plan.seed, i * 131 + hop, 81 + k);
      const score = straight * 0.5 + queue * 1.4 + whim * 0.9;
      if (score < bestScore) {
        bestScore = score;
        pick = o;
      }
    });
    return pick;
  };
  // Lanes a vehicle may appear on when it re-enters the model.
  const entries = [[], [], [], []];
  for (const e of edges) {
    if (!nodes[e.from].exit || nodes[e.to].exit) continue;
    if (e.kind === 'rail') entries[2].push(e.id);
    else if (e.kind === 'cycle') entries[3].push(e.id);
    else {
      if (!e.busOnly) entries[0].push(e.id);
      if (e.bus) entries[1].push(e.id);
    }
  }
  const anywhere = [[], [], [], []];
  for (const e of edges) {
    if (e.kind === 'rail') anywhere[2].push(e.id);
    else if (e.kind === 'cycle') anywhere[3].push(e.id);
    else {
      if (!e.busOnly) anywhere[0].push(e.id);
      if (e.bus) anywhere[1].push(e.id);
    }
  }
  const fresh = () => ({
    time: 0,
    edge: Int32Array.from(vehicles, (v) => v.edge),
    next: Int32Array.from(vehicles, (v, i) => chooseNext(i, v.edge, 0)),
    prev: new Int32Array(N).fill(-1),
    hop: new Int32Array(N),
    s: Float64Array.from(vehicles, (v) => v.s),
    v: Float64Array.from(vehicles, (v) => edges[v.edge].v0 * 0.6),
    odo: new Float64Array(N),
    wait: new Float64Array(N),
    dwell: new Float64Array(N),
    lastStop: new Float64Array(N).fill(-1),
    visible: new Uint8Array(N).fill(1),
  });
  const copy = (st) => ({
    time: st.time,
    edge: st.edge.slice(),
    next: st.next.slice(),
    prev: st.prev.slice(),
    hop: st.hop.slice(),
    s: st.s.slice(),
    v: st.v.slice(),
    odo: st.odo.slice(),
    wait: st.wait.slice(),
    dwell: st.dwell.slice(),
    lastStop: st.lastStop.slice(),
    visible: st.visible.slice(),
  });
  const lists = edges.map(() => []);
  const occupied = new Int32Array(nodes.length),
    granted = new Int32Array(nodes.length),
    best = new Float64Array(nodes.length);
  const B_COMF = 2.0;
  const step = (st, dt) => {
    const t = st.time;
    for (const l of lists) l.length = 0;
    for (let i = 0; i < N; i++) if (st.visible[i]) lists[st.edge[i]].push(i);
    for (const l of lists) l.sort((a, b) => st.s[a] - st.s[b]);
    occupied.fill(-1);
    granted.fill(-1);
    best.fill(-1);
    // Who is inside each junction now.
    for (let i = 0; i < N; i++) {
      if (!st.visible[i]) continue;
      const e = edges[st.edge[i]];
      // A vehicle is in the junction from the moment its front crosses the line.
      if ((st.s[i] + vehicles[i].length / 2 > e.len || e.len < SHORT) && st.next[i] >= 0) occupied[e.to] = e.id;
    }
    const red = (e) => {
      const n = nodes[e.to];
      if (!n.signal) return false;
      const phase = (t + n.offset) % plan.cycle,
        halfCycle = plan.cycle / 2;
      const green = phase < halfCycle ? 0 : 1,
        into = phase % halfCycle;
      return green !== e.group || into > halfCycle - 3;
    };
    // The vehicle at the head of each approach asks for the junction; the longest wait wins.
    for (let i = 0; i < N; i++) {
      if (!st.visible[i] || st.next[i] < 0) continue;
      const e = edges[st.edge[i]],
        l = lists[e.id];
      const toLine = e.len - st.s[i] - vehicles[i].length / 2;
      if (toLine < 0 || toLine > 9 + st.v[i] * 3) continue;
      // Only the first vehicle short of the line may ask.
      let first = true;
      for (const j of l) if (j !== i && st.s[j] > st.s[i] && st.s[j] + vehicles[j].length / 2 <= e.len) first = false;
      if (!first || red(e) || (occupied[e.to] >= 0 && occupied[e.to] !== e.id)) continue;
      // A vehicle with nowhere to go on the far side does not take the junction from others.
      const beyond = lists[st.next[i]];
      if (
        st.wait[i] < 30 &&
        beyond.length &&
        (edges[st.next[i]].len < SHORT || st.s[beyond[0]] - vehicles[beyond[0]].length / 2 < vehicles[i].length + 1.5)
      )
        continue;
      const score = st.wait[i] * 1000 - toLine - i * 1e-4;
      if (granted[e.to] < 0 || score > best[e.to]) {
        granted[e.to] = i;
        best[e.to] = score;
      }
    }
    for (let i = 0; i < N; i++) {
      if (!st.visible[i]) {
        // Waiting outside the model: come back in on an entry lane once its start is clear.
        st.wait[i] += dt;
        // Come back on a lane that enters the model. A network with no way in, such as a few
        // streets cut out of a town, lets the vehicle reappear at the start of any lane it may use.
        const pool = entries[vehicles[i].type].length ? entries[vehicles[i].type] : anywhere[vehicles[i].type];
        if (!pool.length || st.wait[i] < 2) continue;
        const pick = pool[Math.floor(randomAt(plan.seed, i * 977 + st.hop[i], 82) * pool.length)];
        const clear = lists[pick].every((j) => st.s[j] > vehicles[i].length + 8);
        if (!clear) {
          if (st.wait[i] > 20) st.hop[i]++;
          continue;
        }
        st.edge[i] = pick;
        st.prev[i] = -1;
        st.s[i] = 0.5;
        st.v[i] = edges[pick].v0 * 0.7;
        st.hop[i]++;
        st.next[i] = chooseNext(i, pick, st.hop[i], lists);
        st.visible[i] = 1;
        st.wait[i] = 0;
        st.lastStop[i] = -1;
        lists[pick].unshift(i);
        continue;
      }
      const e = edges[st.edge[i]],
        me = vehicles[i],
        l = lists[e.id];
      const conn = st.next[i] >= 0 ? connector(e.id, st.next[i]) : null;
      const inJunction = st.s[i] + me.length / 2 > e.len;
      // Each driver's own pace, drifting slowly so nobody holds a perfectly steady speed.
      let v0 = e.v0 * me.pace * (1 + 0.05 * Math.sin(t * 0.07 + me.phase));
      if (conn && (inJunction || e.len - st.s[i] < 6 + st.v[i] * 2)) v0 = Math.min(v0, conn.vmax);
      // Nearest thing ahead that must not be run into: a vehicle, a stop line or a stop.
      let gap = 1e6,
        ahead = v0;
      const k = l.indexOf(i);
      if (k + 1 < l.length) {
        const j = l[k + 1];
        gap = st.s[j] - st.s[i] - (me.length + vehicles[j].length) / 2;
        ahead = st.v[j];
      } else if (conn) {
        const nl = lists[st.next[i]];
        if (nl.length) {
          const j = nl[0];
          gap = e.len + conn.len - st.s[i] + st.s[j] - (me.length + vehicles[j].length) / 2;
          ahead = st.v[j];
        }
      }
      if (!inJunction) {
        const toLine = e.len - st.s[i] - me.length / 2;
        // Only real junctions and signals are controlled; a bend where two ways join is not.
        const to = nodes[e.to],
          controlled = !to.rail && (to.arms >= 3 || to.signal) && e.len >= SHORT && st.wait[i] < 45;
        let hold = false;
        if (st.next[i] < 0 || !controlled) hold = false;
        else if (
          granted[e.to] !== i &&
          !(
            occupied[e.to] === e.id &&
            k + 1 < l.length &&
            st.s[l[k + 1]] + vehicles[l[k + 1]].length / 2 > e.len &&
            !red(e)
          )
        )
          hold = true;
        // Never enter a junction without room to leave it.
        if (!hold && conn && controlled && st.wait[i] < 30) {
          const nl = lists[st.next[i]];
          if (
            nl.length &&
            (edges[st.next[i]].len < SHORT || st.s[nl[0]] - vehicles[nl[0]].length / 2 < me.length + 1.5)
          )
            hold = true;
        }
        if (hold && toLine - 0.6 < gap) {
          gap = Math.max(0.01, toLine - 0.6);
          ahead = 0;
        }
        // Buses and trams call at their stops.
        if (me.type > 0)
          for (const stop of e.stops) {
            if (stop.id === st.lastStop[i] || stop.s < st.s[i] - 1) continue;
            const d = stop.s - st.s[i];
            if (d < gap) {
              gap = Math.max(0.01, d);
              ahead = 0;
            }
            // A vehicle comes to rest a little short of what it stops for.
            if (d < 3.6 && st.v[i] < 0.3) {
              st.lastStop[i] = stop.id;
              st.dwell[i] = t + stop.dwell;
            }
            break;
          }
      }
      // Follow the vehicle ahead at a gap that grows with speed (the intelligent driver model).
      let acc;
      if (t < st.dwell[i]) {
        acc = -B_COMF * 2;
      } else {
        const v = st.v[i],
          want = me.rest + Math.max(0, v * me.gapTime + (v * (v - ahead)) / (2 * Math.sqrt(me.pull * B_COMF)));
        acc = me.pull * (1 - (v / Math.max(0.5, v0)) ** 4 - (want / Math.max(0.05, gap)) ** 2);
        acc = Math.max(-6, acc);
      }
      const v1 = Math.max(0, st.v[i] + acc * dt);
      const move = Math.min(Math.max(0, gap - 0.05), ((st.v[i] + v1) / 2) * dt);
      st.v[i] = v1;
      st.s[i] += move;
      st.odo[i] += move;
      st.wait[i] = v1 < 0.3 && !inJunction ? st.wait[i] + dt : 0;
      // Move on to the next lane, or leave the model.
      const end = e.len + (conn ? conn.len : 0);
      if (st.s[i] >= end) {
        if (st.next[i] < 0) {
          st.visible[i] = 0;
          st.wait[i] = 0;
          st.hop[i]++;
          continue;
        }
        st.s[i] -= end;
        st.prev[i] = e.id;
        st.edge[i] = st.next[i];
        st.hop[i]++;
        st.next[i] = chooseNext(i, st.edge[i], st.hop[i], lists);
        st.lastStop[i] = -1;
      }
    }
    st.time = t + dt;
  };
  const snapshots = [fresh()];
  const out = { x: 0, y: 0, dx: 1, dy: 0 };
  // Where a point `offset` metres ahead of a vehicle's middle lies, following its own path
  // through the junction ahead or the lane behind.
  const along = (st, i, offset, extra) => {
    const e = edges[st.edge[i]];
    let s = st.s[i] + extra + offset;
    if (s < 0 && st.prev[i] >= 0) {
      const p = edges[st.prev[i]],
        c = connector(p.id, e.id);
      const back = c.len + s;
      return back >= 0 ? locate(c.path, back, out) : locate(p.path, p.len + back, out);
    }
    if (s > e.len && st.next[i] >= 0) {
      const c = connector(e.id, st.next[i]);
      s -= e.len;
      return s <= c.len ? locate(c.path, s, out) : locate(edges[st.next[i]].path, s - c.len, out);
    }
    return locate(e.path, s, out);
  };
  sim = {
    /** The state at a time, stepping from the nearest earlier snapshot. */
    at(time) {
      const t = Math.min(trafficLimits.time, Math.max(0, time));
      const whole = Math.floor(t / STEP + 1e-9);
      const slot = Math.floor((whole * STEP) / SNAPSHOT + 1e-9);
      while (snapshots.length <= slot) {
        const st = copy(snapshots[snapshots.length - 1]);
        const target = snapshots.length * SNAPSHOT;
        while (st.time < target - 1e-9) step(st, STEP);
        st.time = target;
        snapshots.push(st);
      }
      const st = copy(snapshots[slot]);
      while (st.time < whole * STEP - 1e-9) step(st, STEP);
      return { st, rest: t - whole * STEP };
    },
    along,
  };
  simulators.set(plan, sim);
  return sim;
}

/**
 * Where every drawable unit of a traffic plan is at `time` seconds. Returns arrays with one
 * entry per unit of `plan.units`: `x` and `y` in map metres, `turn` as a heading in radians,
 * `travelled` in metres (for turning wheels), `speed` in metres per second and `visible`
 * (0 while a vehicle is outside the model). The same time always gives the same answer.
 */
export function trafficState(plan, time) {
  number(time, 'time', -1e6, 1e6);
  const sim = simulator(plan);
  const { st, rest } = sim.at(time);
  const n = plan.units.length;
  const state = {
    x: new Float32Array(n),
    y: new Float32Array(n),
    turn: new Float32Array(n),
    travelled: new Float32Array(n),
    speed: new Float32Array(n),
    visible: new Uint8Array(n),
    edge: new Uint32Array(n),
  };
  plan.units.forEach((u, k) => {
    const i = u.vehicle;
    state.visible[k] = st.visible[i];
    if (!st.visible[i]) return;
    // Between steps a vehicle simply carries on at its speed.
    const extra = st.v[i] * rest;
    const p = sim.along(st, i, u.offset, extra);
    // A vehicle wanders a little within its lane; a rider wanders more.
    const me = plan.vehicles[i];
    const sway =
      me.sway * (me.type === 3 ? 1.8 : me.type === 2 ? 0 : 1) * Math.sin((st.odo[i] + extra) * 0.05 + me.phase);
    state.x[k] = p.x + p.dy * sway;
    state.y[k] = p.y - p.dx * sway;
    state.turn[k] = Math.atan2(p.dy, p.dx);
    state.travelled[k] = st.odo[i] + extra;
    state.speed[k] = st.v[i];
    state.edge[k] = st.edge[i];
  });
  return state;
}

/**
 * The simulation's own record of each vehicle at `time`: which lane piece it is on (`edge`),
 * how far along it (`s`), its speed, how long it has stood waiting and whether it is in the
 * model. One entry per vehicle of `plan.vehicles`. Meant for checks and for flow displays.
 */
export function trafficVehicles(plan, time) {
  number(time, 'time', -1e6, 1e6);
  const { st } = simulator(plan).at(time);
  return plan.vehicles.map((v, i) => ({
    edge: st.edge[i],
    next: st.next[i],
    s: st.s[i],
    speed: st.v[i],
    waiting: st.wait[i],
    visible: st.visible[i] === 1,
  }));
}
