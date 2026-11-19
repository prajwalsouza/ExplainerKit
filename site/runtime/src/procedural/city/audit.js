import { number, options } from '../../core/validate.js';
import { trafficState } from './traffic.js';

// Heuristic checks on a built city: the kinds of breakage that are easy to miss in a frame and
// obvious once pointed at. Geometry that is not a number, objects standing in walls or in the
// canal, walkers in the carriageway, cars on pavements or inside each other, things beyond the
// edge of the model. Each check samples rather than proving, so a clean report means nothing
// was found, not that nothing is wrong.

const MAX_REPORTED = 12;

/**
 * Check a city model built by buildCity, with `walkerPose` from the same module. `times` are the moments at which moving things are
 * sampled, in seconds (at most 64). Returns {ok, issues, checked}: each issue has a `kind`, a
 * `count`, a plain `message` and up to twelve example places as {x, z} in model metres.
 */
export function auditCityModel(city, spec = {}, walkerPose = null) {
  options(spec, ['times'], 'auditCity');
  const times = (spec.times ?? [0, 7.5, 31, 64, 133]).slice(0, 64).map((t) => number(t, 'audit time', 0, 6 * 3600));
  const f = city.field;
  const at = (name, x, y) => {
    const i = Math.round((x - f.x0) / f.cell - 0.5),
      j = Math.round((y - f.y0) / f.cell - 0.5);
    if (i < 0 || j < 0 || i >= f.width || j >= f.height) return NaN;
    return f[name][j * f.width + i];
  };
  const issues = new Map();
  const report = (kind, message, x, z) => {
    let issue = issues.get(kind);
    if (!issue) issues.set(kind, (issue = { kind, message, count: 0, examples: [] }));
    issue.count++;
    if (issue.examples.length < MAX_REPORTED && x !== undefined)
      issue.examples.push({ x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 });
  };
  const checked = { meshes: 0, objects: 0, walkerSamples: 0, vehicleSamples: 0 };
  const b = city.bounds;
  const inside = (x, z) => x >= b.x0 - 0.5 && x <= b.x1 + 0.5 && z >= b.z0 - 0.5 && z <= b.z1 + 0.5;

  // ---- geometry that cannot be drawn
  const meshes = [
    ...Object.entries(city.meshes),
    ...(city.fine ?? []).map((t, i) => [`fine ${i}`, t.mesh]),
    ...city.props.map((p) => [p.name, p.mesh]),
  ];
  for (const [name, m] of meshes) {
    checked.meshes++;
    let bad = false;
    for (const list of [m.positions, m.normals, m.extra])
      for (let i = 0; i < list.length && !bad; i++) bad = !Number.isFinite(list[i]);
    for (let i = 0; i < m.indices.length && !bad; i++) bad = m.indices[i] >= m.vertexCount;
    if (bad)
      report('broken-mesh', `The mesh "${name}" has a value that is not a number or an index beyond its vertices.`);
  }

  // ---- placed objects
  const wallMounted = /^(lamp\.bracket|signal|shelter)/;
  for (const p of city.props) {
    const t = p.transforms;
    for (let i = 0; i < p.count; i++) {
      checked.objects++;
      const x = t[i * 8],
        y = t[i * 8 + 1],
        z = t[i * 8 + 2];
      if (![x, y, z, t[i * 8 + 3], t[i * 8 + 4]].every(Number.isFinite)) {
        report('bad-transform', `A ${p.name} has a position, turn or size that is not a number.`, x, z);
        continue;
      }
      if (!inside(x, z)) report('outside', 'An object stands beyond the edge of the model.', x, z);
      const mx = x,
        my = -z;
      if (!wallMounted.test(p.name) && at('wall', mx, my) < -0.4)
        report('in-building', `A ${p.name.split('.')[0]} stands inside a building.`, x, z);
      if (!p.name.startsWith('boat') && at('water', mx, my) < -0.6 && at('bridge', mx, my) > 0)
        report('in-water', `A ${p.name.split('.')[0]} stands in water.`, x, z);
      if (p.name.startsWith('boat') && !(at('water', mx, my) < 0))
        report('boat-ashore', 'A boat is moored on dry ground.', x, z);
      if (/^(tree|bench|bin|planter|bikeRack|kiosk)/.test(p.name) && at('edge', mx, my) < -0.3)
        report('in-carriageway', `A ${p.name.split('.')[0]} stands in the carriageway.`, x, z);
    }
  }

  // ---- buildings
  if (city.meshes.walls.vertexCount) {
    const pos = city.meshes.walls.positions;
    let top = 0;
    for (let i = 1; i < pos.length; i += 3) top = Math.max(top, pos[i]);
    if (top > 500)
      report(
        'tall-building',
        `A wall reaches ${Math.round(top)} m, which is taller than any real building in a street model.`,
      );
  }

  // ---- walkers
  const crowd = city.people;
  if (crowd?.count && walkerPose) {
    for (const time of times)
      for (let i = 0; i < crowd.count; i++) {
        const w = walkerPose(city, i, time);
        checked.walkerSamples++;
        if (![w.x, w.y, w.z, w.turn, w.phase].every(Number.isFinite)) {
          report('walker-broken', 'A walker has a position or pose that is not a number.');
          continue;
        }
        const mx = w.x,
          my = -w.z;
        if (!inside(w.x, w.z)) report('walker-outside', 'A walker is beyond the edge of the model.', w.x, w.z);
        if (at('wall', mx, my) < -0.25) report('walker-in-building', 'A walker is inside a building.', w.x, w.z);
        if (at('water', mx, my) < -0.3 && at('bridge', mx, my) > 0)
          report('walker-in-water', 'A walker is in the water.', w.x, w.z);
        if (at('edge', mx, my) < -0.6 && at('foot', mx, my) > 0.5)
          report('walker-in-road', 'A walker is in the carriageway, away from any crossing or path.', w.x, w.z);
      }
  }

  // ---- traffic
  if (city.traffic) {
    const plan = city.traffic.plan;
    for (const time of times) {
      const st = trafficState(plan, time);
      const here = [];
      plan.units.forEach((u, k) => {
        if (!st.visible[k]) return;
        checked.vehicleSamples++;
        const x = st.x[k],
          y = st.y[k],
          type = plan.vehicles[u.vehicle].type;
        if (![x, y, st.turn[k]].every(Number.isFinite))
          return report('vehicle-broken', 'A vehicle has a position that is not a number.');
        if (!inside(x, -y)) report('vehicle-outside', 'A vehicle is beyond the edge of the model.', x, -y);
        if (at('wall', x, y) < -0.3) report('vehicle-in-building', 'A vehicle is inside a building.', x, -y);
        if (type <= 1 && at('edge', x, y) > 0.3)
          report('vehicle-off-road', 'A car or bus has left the carriageway.', x, -y);
        if (type === 3 && at('edge', x, y) < -0.4 && !(at('foot', x, y) < 1))
          report('bike-in-road', 'A cyclist rides in the carriageway away from a cycle path.', x, -y);
        if (type !== 2) here.push([x, y, u.vehicle, plan.vehicles[u.vehicle].length]);
      });
      // Two road vehicles closer than their own sizes allow are inside one another.
      for (let i = 0; i < here.length; i++)
        for (let j = i + 1; j < here.length; j++) {
          const d = Math.hypot(here[i][0] - here[j][0], here[i][1] - here[j][1]);
          if (here[i][2] !== here[j][2] && d < Math.min(here[i][3], here[j][3]) * 0.35)
            report('vehicles-overlap', 'Two vehicles are inside one another.', here[i][0], -here[i][1]);
        }
    }
  }

  const list = [...issues.values()].sort((a, c) => c.count - a.count);
  return Object.freeze({ ok: list.length === 0, issues: Object.freeze(list), checked: Object.freeze(checked) });
}
