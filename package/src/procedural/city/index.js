import { assert, number, options } from '../../core/validate.js';
import { hsla } from '../../color/space.js';
import { randomAt, seedValue } from '../../noise/vector.js';
import { gradientRaw2 } from '../../noise/gradient.js';
import { CITY_STYLES, cityStyles, regionStyle } from './styles.js';
import { planTraffic, trafficState, parkingPlan, trafficLimits, DEFAULT_SPEEDS } from './traffic.js';
import { vehicleAsset, vehicleLook, VEHICLE_VARIANTS } from './vehicles.js';
import { meshBuilder, rgb } from './mesh.js';
import { ACTIVITY, activityMix, chooseActivity, groupSize, standingGesture } from './activities.js';
import { citySurfaceHeight, cityTerrain, terrainHeight } from './terrain.js';
import { levelWater } from './water.js';
import { bridgeSurfaceHeight, buildWaterBridges } from './water-bridges.js';
import { buildUnderpasses, underpassSurfaceHeight } from './underpasses.js';
import { addTerrainFoundation, buildingFoundationLevel } from './foundations.js';
import {
  personLook,
  personWardrobe,
  personColors,
  personMotion,
  personClimate,
  personRig,
  personPose,
  posePerson,
  personJoints,
  personTops,
  personBottoms,
  personHair,
  personHats,
  personHoods,
  personBags,
  personShoes,
  personAges,
  personBudget,
  personRanges,
  personGait,
  PERSON_PAINT,
} from './people.js';
import {
  addBuilding,
  buildingStyle,
  bayLayout,
  cityPalettes,
  groundStyles,
  roofMaterials,
  wallMaterials,
  windowStyles,
} from './buildings.js';
import { alongRoad, bridgeStreetField, footKinds, greenKinds, streetField } from './streets.js';
import {
  BIKE_PAINT,
  BLOOMS,
  CAR_PAINT,
  CLOTH_PAINT,
  COAT_PAINT,
  coverAsset,
  coverKinds,
  personAsset,
  bikeAsset,
  boatAsset,
  carAsset,
  carBodies,
  furnitureAsset,
  furnitureKinds,
  lampAsset,
  lampStyles,
  seasons,
  shrubAsset,
  surfaceKinds,
  treeAsset,
  treeForms,
} from './assets.js';

// A procedural model of a street or neighbourhood, built from parsed map features. Pure
// geometry: no renderer is imported and nothing is fetched. `buildCity` returns triangle meshes
// for walls, roofs and trim, a street field that a renderer shades the ground from, and lists
// of repeated objects (lamps, trees, cars, furniture) with where each one stands.
//
// Coordinates are metres: x east, y up, z south. Map features use x east and y north, so a map
// point (x, y) stands at (x, height, -y).

export { buildingStyle, bayLayout, cityPalettes, wallMaterials, windowStyles, groundStyles, roofMaterials };
export {
  lampAsset,
  lampStyles,
  treeAsset,
  treeForms,
  seasons,
  carAsset,
  carBodies,
  bikeAsset,
  boatAsset,
  furnitureAsset,
  furnitureKinds,
  shrubAsset,
  surfaceKinds,
};
export { footKinds, greenKinds };
export { CITY_STYLES, cityStyles, regionStyle, coverAsset, coverKinds, personAsset };
export { PERSON_GAITS, personGaits, personGaitStyle } from './people.js';
export { PERSON_ACTIVITIES, personActivities, standingGesture } from './activities.js';
export {
  personLook,
  personWardrobe,
  personColors,
  personMotion,
  personClimate,
  personRig,
  personPose,
  posePerson,
  personJoints,
  personTops,
  personBottoms,
  personHair,
  personHats,
  personHoods,
  personBags,
  personShoes,
  personAges,
  personBudget,
  personRanges,
  personGait,
  PERSON_PAINT,
};
/** How walkers may be dressed without describing them: the plain default figure, or clothes chosen for the situation. */
export const peopleClothing = Object.freeze(['plain', 'auto']);
export { planFlyby } from './flyby.js';
export { planTraffic, trafficState, parkingPlan, trafficLimits, DEFAULT_SPEEDS };
export {
  vehicleAsset,
  vehicleKinds,
  VEHICLE_SHAPES,
  vehicleShape,
  vehicleFamilies,
  vehicleEras,
  vehicleLook,
  VEHICLE_VARIANTS,
} from './vehicles.js';
export { CAR_PAINT };
/** How much `buildCity` may add beyond what the map states. */
export const interpretationLevels = Object.freeze(['raw', 'basic', 'high']);
export { WEATHER, weatherNames, resolveWeather, mixWeather, weatherSchedule } from './weather.js';
import { WEATHER } from './weather.js';
import { auditCityModel } from './audit.js';

export const cityLimits = Object.freeze({
  side: 3000,
  buildings: 20_000,
  props: 60_000,
  cover: 400_000,
  people: 2000,
  cell: [0.25, 4],
});
const FINE_TILE = 48,
  COVER_TILE = 32;
// How far away each kind of object stays worth drawing: 'small' things vanish first.
const RANGE = Object.freeze({
  bike: 'small',
  cafeChair: 'small',
  cafeTable: 'small',
  bin: 'small',
  binBox: 'small',
  bollard: 'small',
  bollardSteel: 'small',
  signRound: 'small',
  signTriangle: 'small',
  signPlate: 'small',
  hydrant: 'small',
  postbox: 'small',
  cabinet: 'small',
  bench: 'medium',
  benchModern: 'medium',
  planter: 'medium',
  umbrella: 'medium',
  bikeRack: 'medium',
  signal: 'medium',
});
/** The distance class of a placed object, from its name: 'small', 'medium' or 'large'. */
export const propRange = (name) => RANGE[name.split('.')[0]] ?? 'large';
export const WATER_LEVEL = -1.3;

const weightedPaint = (list, u) => {
  let total = 0;
  for (const c of list) total += c[3];
  let t = u * total;
  for (const c of list) {
    t -= c[3];
    if (t <= 0) return c;
  }
  return list[list.length - 1];
};

function pathsWithinBounds(points, bounds, radius, maxStep = Infinity) {
  // Clip in X/Z, inset by the requested radius. Each stretch outside breaks the path.
  if (bounds.x1 - bounds.x0 <= 2 * radius || bounds.y1 - bounds.y0 <= 2 * radius) return [];
  const limits = [
    [0, bounds.x0 + radius, bounds.x1 - radius],
    [2, -bounds.y1 + radius, -bounds.y0 - radius],
  ];
  const paths = [];
  let path = null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    let enter = 0;
    let leave = 1;
    for (const [axis, low, high] of limits) {
      const delta = b[axis] - a[axis];
      if (delta === 0) {
        if (a[axis] < low || a[axis] > high) {
          leave = 0;
          break;
        }
        continue;
      }
      const first = (low - a[axis]) / delta;
      const last = (high - a[axis]) / delta;
      enter = Math.max(enter, Math.min(first, last));
      leave = Math.min(leave, Math.max(first, last));
    }
    if (enter >= leave) {
      path = null;
      continue;
    }
    const at = (fraction) => a.map((value, axis) => value + fraction * (b[axis] - value));
    if (!path || enter > 0) {
      path = [enter === 0 ? a : at(enter)];
      paths.push(path);
    }
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]) * (leave - enter);
    const divisions = Math.max(1, Math.ceil(length / maxStep));
    assert(path.length + divisions <= 120_000, 'RESOURCE_LIMIT', 'A rail line exceeds the terrain subdivision limit.');
    for (let n = 1; n < divisions; n++) path.push(at(enter + ((leave - enter) * n) / divisions));
    path.push(leave === 1 ? b : at(leave));
    if (leave < 1) path = null;
  }
  return paths;
}

/**
 * Build a city model from the result of `parseOverpass`.
 *
 * Options: `seed` (whole number), `palette` (one of `cityPalettes`), `detail` ('full' or
 * 'massing', which leaves out trim and street objects), `season` (one of `seasons`),
 * `cell` (street field cell in metres), `margin` (metres of ground kept round the features)
 * and `infer`, which switches the made-up street objects: {lamps, trees, cars, bikes,
 * furniture, boats, plants}, each true or false. Objects read from the map are always placed.
 * `interpretation` ('raw', 'basic' or 'high') sets all of those at once: 'raw' draws only what
 * the map states, 'basic' (the default) adds simple guesses, and 'high' adds more plants and people.
 */
export function buildCity(osm, spec = {}) {
  options(
    spec,
    [
      'seed',
      'style',
      'palette',
      'detail',
      'season',
      'cell',
      'margin',
      'infer',
      'people',
      'density',
      'interpretation',
      'traffic',
      'terrain',
      'bridgeBlend',
    ],
    'buildCity',
  );
  assert(
    osm && Array.isArray(osm.buildings) && Array.isArray(osm.roads),
    'INVALID_CITY',
    'Pass the result of parseOverpass.',
  );
  const terrain = cityTerrain(spec.terrain);
  const bridgeBlend = number(spec.bridgeBlend ?? 1, 'bridgeBlend', 0.6, 2);
  const ground = (x, z) => terrainHeight(terrain, x, z);
  const seed = seedValue(spec.seed ?? 1);
  // The regional style: a name, 'auto' (chosen from where the map data is), or a name plus
  // overrides as {base, ...fields}.
  const styleSpec = spec.style ?? 'auto';
  const styleBase = typeof styleSpec === 'string' ? styleSpec : (styleSpec.base ?? 'auto');
  const styleName = styleBase === 'auto' ? regionStyle(osm.center?.lat, osm.center?.lon) : styleBase;
  assert(Object.hasOwn(CITY_STYLES, styleName), 'INVALID_CITY', `style is 'auto' or one of ${cityStyles.join(', ')}.`);
  const style = Object.freeze({
    ...CITY_STYLES[styleName],
    ...(typeof styleSpec === 'object' ? styleSpec : {}),
    name: styleName,
    inferred: styleBase === 'auto',
  });
  const palette = spec.palette ?? style.palette;
  assert(cityPalettes.includes(palette), 'INVALID_CITY', `palette is one of ${cityPalettes.join(', ')}.`);
  const detail = spec.detail ?? 'full';
  assert(detail === 'full' || detail === 'massing', 'INVALID_CITY', "detail is 'full' or 'massing'.");
  const season = spec.season ?? 'summer';
  assert(seasons.includes(season), 'INVALID_CITY', `season is one of ${seasons.join(', ')}.`);
  const margin = number(spec.margin ?? 14, 'margin', 0, 200);
  // How much the builder may add beyond what the map states. 'raw' draws only mapped things.
  // 'basic' adds simple, safe guesses such as grass, street trees and lamps. 'high' also fills
  // in livelier detail: more plants and people. Single switches in `infer` still override it.
  const interpretation = spec.interpretation ?? 'basic';
  assert(
    interpretationLevels.includes(interpretation),
    'INVALID_CITY',
    `interpretation is one of ${interpretationLevels.join(', ')}.`,
  );
  const guess = interpretation !== 'raw';
  const infer = {
    lamps: guess,
    trees: guess,
    cars: guess,
    bikes: guess,
    furniture: guess,
    boats: guess,
    plants: guess,
    ...(spec.infer ?? {}),
  };
  options(infer, ['lamps', 'trees', 'cars', 'bikes', 'furniture', 'boats', 'plants'], 'infer');
  const density = number(spec.density ?? (interpretation === 'high' ? 1.5 : 1), 'density', 0, 4);
  // People. A number, or true, sets how busy the pavements are and keeps the plain default
  // figure. An object can also say how walkers are dressed and how much they differ.
  const crowd = spec.people !== null && typeof spec.people === 'object' ? spec.people : { density: spec.people };
  // The weather the crowd dresses and walks for, as a condition object or null.
  const crowdWeather = typeof crowd.weather === 'string' ? (WEATHER[crowd.weather] ?? null) : (crowd.weather ?? null);
  options(
    crowd,
    ['density', 'clothing', 'variety', 'weather', 'variants', 'wear', 'noise', 'pauses', 'gait', 'activities'],
    'people',
  );
  // What people do: walk, walk in pairs, talk in groups, stand, or browse the shop fronts.
  const mix = activityMix(crowd.activities);
  const busy = crowd.density ?? (crowd === spec.people ? 1 : interpretation === 'high' ? 1.2 : 0);
  const peopleDensity = busy === true ? 1 : busy === false ? 0 : number(busy, 'people', 0, 6) || 0;
  const crowdVariety = number(crowd.variety ?? 0.7, 'variety', 0, 1),
    crowdNoise = number(crowd.noise ?? 0.6, 'noise', 0, 1),
    crowdPauses = number(crowd.pauses ?? 0.25, 'pauses', 0, 1);
  const clothing = crowd.clothing ?? 'plain';
  assert(
    clothing === 'plain' ||
      clothing === 'auto' ||
      (Array.isArray(clothing)
        ? clothing.length >= 1 && clothing.length <= 32 && clothing.every((l) => l && typeof l === 'object')
        : clothing && typeof clothing === 'object'),
    'INVALID_CITY',
    "clothing is 'plain', 'auto', a look, or a list of at most 32 looks.",
  );
  const crowdVariants = Math.round(number(crowd.variants ?? 16, 'variants', 1, 32));
  assert(
    osm.buildings.length <= cityLimits.buildings,
    'RESOURCE_LIMIT',
    `At most ${cityLimits.buildings} buildings are modelled.`,
  );

  // ---------------------------------------------------------------------- bounds
  let bounds;
  if (osm.bbox) bounds = { x0: osm.bbox.x0, y0: osm.bbox.y0, x1: osm.bbox.x1, y1: osm.bbox.y1 };
  else {
    bounds = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    const grow = (p) => {
      bounds.x0 = Math.min(bounds.x0, p.x);
      bounds.x1 = Math.max(bounds.x1, p.x);
      bounds.y0 = Math.min(bounds.y0, p.y);
      bounds.y1 = Math.max(bounds.y1, p.y);
    };
    for (const b of osm.buildings) b.ring.forEach(grow);
    for (const r of osm.roads) r.points.forEach(grow);
    assert(Number.isFinite(bounds.x0), 'INVALID_CITY', 'The map data holds no buildings or roads.');
  }
  bounds = { x0: bounds.x0 - margin, y0: bounds.y0 - margin, x1: bounds.x1 + margin, y1: bounds.y1 + margin };
  const side = Math.max(bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);
  assert(
    side <= cityLimits.side,
    'RESOURCE_LIMIT',
    `A city model spans at most ${cityLimits.side} metres. Parse a smaller box.`,
  );
  const cell = number(spec.cell ?? Math.max(0.4, side / 1280), 'cell', cityLimits.cell[0], cityLimits.cell[1]);
  const street = streetField(osm, bounds, cell, !!terrain);
  const { field, sample } = street;
  const inside = (x, y) => x > bounds.x0 + 1 && x < bounds.x1 - 1 && y > bounds.y0 + 1 && y < bounds.y1 - 1;

  // ------------------------------------------------------------------- buildings
  const budget = { vertices: 0 };
  const waterSurface = street.waterIds ? levelWater(osm.water, field, street.waterIds, ground, bounds, budget) : null;
  const bridgeFootprints = terrain ? osm.areas?.filter((area) => area.kind === 'bridge') : null;
  const bridges =
    terrain && (osm.water.length || bridgeFootprints?.length || osm.roads.some((road) => road.bridge))
      ? buildWaterBridges(osm.roads, field, street.waterIds, waterSurface?.levels ?? [], ground, budget, bounds, {
          infer: guess,
          footprints: bridgeFootprints,
          rails: osm.rails,
          blend: bridgeBlend,
          lowerRailAt: street.lowerRailAt,
        })
      : null;
  const roadSurface = (x, z, id) => bridgeSurfaceHeight(bridges?.profiles, x, z, id) ?? ground(x, z);
  const underpasses = bridges?.profiles.length
    ? buildUnderpasses(osm.roads, bridges, field, ground, budget, detail === 'full' && infer.lamps)
    : null;
  const bridgeField = bridges?.profiles.length
    ? bridgeStreetField(osm, bounds, cell, bridges.roadIds, underpasses?.roadIds, bridges.approachIds)
    : null;
  const roadsWithDecks = new Set(bridges?.roadIds ?? bridges?.profiles.map((profile) => profile.roadId));
  const fineTiles = new Map();
  let foundation = null;
  const foundationWork = { intervals: 0 };
  const elevation = terrain ? (x, z) => foundation ?? ground(x, z) : undefined;
  const layers = {
    walls: meshBuilder(12, budget, elevation),
    roofs: meshBuilder(4, budget, elevation),
    trim: meshBuilder(4, budget, elevation),
    // Small parts are gathered by map tile, so a renderer can leave distant tiles out.
    fine(x, y) {
      const i = Math.floor(x / FINE_TILE),
        j = Math.floor(y / FINE_TILE),
        key = `${i},${j}`;
      let t = fineTiles.get(key);
      if (!t) fineTiles.set(key, (t = { i, j, builder: meshBuilder(4, budget, elevation) }));
      return t.builder;
    },
  };
  // A wall is shared when the ground just outside it lies inside another building.
  const party = (p, q) => {
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    if (len < 0.5) return true;
    const nx = (q.y - p.y) / len,
      ny = -(q.x - p.x) / len;
    let hits = 0;
    for (const t of [0.25, 0.5, 0.75]) {
      const x = p.x + (q.x - p.x) * t + nx * 0.7,
        y = p.y + (q.y - p.y) * t + ny * 0.7;
      if (inside(x, y) && sample('wall', x, y) < -0.12) hits++;
    }
    return hits >= 2;
  };
  const styles = [];
  const buildSpec = { seed, palette, detail, style };
  // A small open roof on the map is a shelter at a stop or a canopy, not a house. It is drawn
  // later as a shelter: a roof on posts with a glass back.
  const isCanopy = (b) => (b.tag === 'roof' || b.tag === 'canopy' || b.tag === 'shelter') && b.area < 80;
  const canopies = osm.buildings.filter(isCanopy);
  for (const b of osm.buildings) {
    if (isCanopy(b)) {
      styles.push(Object.freeze({ id: b.id, kind: 'shelter', recent: false, inferred: Object.freeze([]) }));
      continue;
    }
    // A very small building whose height the map does not give is a kiosk or a booth, one low
    // storey high. Guessing several floors for it makes a tower out of a newsstand.
    const guessed = guess && b.inferred?.includes('levels') && b.inferred?.includes('height');
    const source =
      guessed && b.area < 34 ? { ...b, levels: 1, height: 2.9, roofHeight: Math.min(b.roofHeight ?? 0, 0.5) } : b;
    // One foundation level keeps walls plumb and roofs level on a slope.
    if (terrain) foundation = buildingFoundationLevel(source, terrain, foundationWork);
    const s = addBuilding(source, layers, buildSpec, party);
    if (terrain) addTerrainFoundation(source, s, terrain, foundation, layers.trim, foundationWork);
    styles.push(
      Object.freeze({
        id: s.id,
        kind: s.kind,
        recent: s.recent,
        material: wallMaterials[s.material],
        window: windowStyles[s.window],
        ground: groundStyles[s.ground],
        wall: s.wall,
        roof: s.roof,
        roofMaterial: roofMaterials[s.roofMaterial],
        inferred: Object.freeze([...b.inferred, ...s.inferred]),
      }),
    );
  }

  foundation = null;
  // --------------------------------------------------------- quays and bridge sides
  const trim = layers.trim;
  const quay = rgb(hsla(24, 14, 30)),
    capstone = rgb(hsla(38, 10, 62));
  trim.reset();
  const localShore = (ring) =>
    pathsWithinBounds(
      [...ring, ring[0]].map((p) => [p.x, 0, -p.y]),
      bounds,
      0,
    );
  for (const [waterIndex, w] of osm.water.entries()) {
    if (w.kind === 'lake') continue;
    const level = waterSurface?.levels[waterIndex];
    const base = (x, z) => (level === undefined ? WATER_LEVEL - 0.6 : Math.min(-0.3, level - ground(x, z) - 0.6));
    for (const ring of [w.ring, ...w.holes])
      for (const path of localShore(ring))
        for (let i = 1; i < path.length; i++) {
          const [ax, , az] = path[i - 1];
          const [cx, , cz] = path[i];
          // Faces point into the water: the ring runs counter-clockwise round it.
          trim
            .extra(0.85, 0, 0, 0)
            .quad([cx, base(cx, cz), cz], [ax, base(ax, az), az], [ax, -0.3, az], [cx, -0.3, cz], quay);
          trim.extra(0.8, 0, 0, 0).quad([cx, -0.3, cz], [ax, -0.3, az], [ax, 0.02, az], [cx, 0.02, cz], capstone);
        }
  }
  const rail = rgb(hsla(150, 10, 16));
  // Tram and railway tracks: two steel rails set almost flush in a street.
  const steel = rgb(hsla(215, 8, 58));
  const railRadius = 0.04;
  const railPoints = [];
  for (const track of osm.rails ?? []) {
    if (track.tunnel || !Array.isArray(track.points) || track.points.length < 2) continue;
    const pts = track.points;
    for (const p of pts) railPoints.push(p);
    const gauge = Number.isFinite(track.gauge) && track.gauge >= 0.3 && track.gauge <= 3 ? track.gauge : 1.435;
    for (const offset of [gauge / 2, -gauge / 2]) {
      const line = pts.map((p, k) => {
        const a = pts[Math.max(0, k - 1)],
          b = pts[Math.min(pts.length - 1, k + 1)],
          l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        return [p.x - ((b.y - a.y) / l) * offset, 0.035, -(p.y + ((b.x - a.x) / l) * offset)];
      });
      const railStep = !terrain ? Infinity : bridges?.profiles.length ? 1.5 : 6;
      for (const path of pathsWithinBounds(line, bounds, railRadius, railStep)) {
        if (bridges?.profiles.length) {
          for (const p of path) {
            const y = bridgeSurfaceHeight(bridges.profiles, p[0], p[2], track.id);
            if (y !== undefined) p[1] += y - ground(p[0], p[2]);
          }
        }
        trim.extra(0.3, 0, 0, 0);
        trim.tube(path, railRadius, steel, 4, false);
      }
    }
  }
  // Whether a point lies on or beside a track, so nothing is parked on the rails.
  const onRails = (x, y, reach) => railPoints.some((p) => Math.abs(p.x - x) < reach && Math.abs(p.y - y) < reach);
  for (const r of osm.roads) {
    if (!r.bridge || r.tunnel || roadsWithDecks.has(r.id)) continue;
    const off = r.foot ? r.width / 2 + 0.6 : Math.max(1.5, r.width / 2) + 2.4;
    const pts = alongRoad(r.points, 2.2);
    for (const sideSign of [1, -1]) {
      let prev = null;
      for (const p of pts) {
        const x = p.x - p.dy * off * sideSign,
          y = p.y + p.dx * off * sideSign;
        const over = inside(x, y) && sample('water', x - p.dy * 0.8 * sideSign, y + p.dx * 0.8 * sideSign) < 0.5;
        const here = over ? { x, y } : null;
        if (prev && here) {
          const A = [prev.x, 0, -prev.y],
            B = [here.x, 0, -here.y];
          const face = (y0, y1, colour) => {
            const pa = [A[0], y0, A[2]],
              pb = [B[0], y0, B[2]],
              pc = [B[0], y1, B[2]],
              pd = [A[0], y1, A[2]];
            trim.quad(...(sideSign > 0 ? [pb, pa, pd, pc] : [pa, pb, pc, pd]), colour);
          };
          trim.extra(0.85, 0, 0, 0);
          face(-0.75, 0.02, capstone);
          if (detail === 'full') {
            trim.extra(0.5, 0, 0, 0);
            trim.tube(
              [
                [A[0], 1.02, A[2]],
                [B[0], 1.02, B[2]],
              ],
              0.03,
              rail,
              5,
              false,
            );
            trim.tube(
              [
                [A[0], 0.55, A[2]],
                [B[0], 0.55, B[2]],
              ],
              0.016,
              rail,
              4,
              false,
            );
            trim.tube(
              [
                [A[0], 0, A[2]],
                [A[0], 1.05, A[2]],
              ],
              0.035,
              rail,
              5,
              true,
            );
          }
        }
        prev = here;
      }
    }
  }

  // ----------------------------------------------------------------------- props
  const props = new Map();
  let propCount = 0;
  const put = (name, make, x, y, turn = 0, scale = 1, tint = null, up = 0) => {
    if (!inside(x, y)) return false;
    let entry = props.get(name);
    if (!entry) {
      const asset = make();
      entry = { name, mesh: asset.mesh, asset, items: [] };
      props.set(name, entry);
    }
    assert(++propCount <= cityLimits.props, 'RESOURCE_LIMIT', `At most ${cityLimits.props} street objects are placed.`);
    entry.items.push(x, up + ground(x, -y), -y, turn, scale, ...(tint ?? [1, 1, 1]));
    return entry;
  };
  // A coarse grid of what already stands where, so objects do not overlap.
  const taken = new Map();
  const slot = (x, y) => `${Math.floor(x / 4)},${Math.floor(y / 4)}`;
  const free = (x, y, radius) => {
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++)
        for (const o of taken.get(slot(x + i * 4, y + j * 4)) ?? [])
          if (Math.hypot(o.x - x, o.y - y) < radius + o.r) return false;
    return true;
  };
  const take = (x, y, r) => {
    const k = slot(x, y);
    if (!taken.has(k)) taken.set(k, []);
    taken.get(k).push({ x, y, r });
  };
  // Open ground a person could stand on: not road, water or building.
  const walkable = (x, y, clear = 0.4) =>
    inside(x, y) && sample('edge', x, y) > clear && sample('wall', x, y) > clear && sample('water', x, y) > 0.6;
  const toRoad = (x, y) => {
    // Direction toward the nearest carriageway, from the slope of the edge distance.
    const d = cell * 2;
    const gx = sample('edge', x + d, y) - sample('edge', x - d, y),
      gy = sample('edge', x, y + d) - sample('edge', x, y - d);
    const l = Math.hypot(gx, gy);
    return l < 1e-4 ? null : { x: -gx / l, y: -gy / l };
  };
  const rnd = (i, k) => randomAt(seed, i, k);
  const lights = [...(underpasses?.lights ?? [])];
  const nordic = Math.abs(osm.center?.lat ?? 50) > 56;
  const oldTown = style.bollard === 'bollard';
  const treeSpots = [];

  if (detail === 'full') {
    // Street lamps: the mapped ones first, then made-up ones where the map has too few.
    const lampHeights = { cobra: 9, twin: 9.5, led: 7.5, lantern: 8, globe: 8, bracket: 4, bollard: 1 };
    const cityStyle = style;
    const lampGrid = new Map();
    const lampCell = 20;
    const lampKey = (x, y) => `${x},${y}`;
    const nearbyLamp = (x, y, height) => {
      const col = Math.floor(x / lampCell),
        row = Math.floor(y / lampCell);
      for (let j = row - 1; j <= row + 1; j++)
        for (let k = col - 1; k <= col + 1; k++)
          for (const lamp of lampGrid.get(lampKey(k, j)) ?? [])
            if (Math.abs(lamp.height - height) < 3 && Math.hypot(lamp.x - x, lamp.y - y) < 17) return true;
      return false;
    };
    const placeLamp = (x, y, i, mapped, height = roadSurface(x, -y)) => {
      if (!inside(x, y) || !free(x, y, 0.5)) return;
      const passageFloor = underpassSurfaceHeight(underpasses?.profiles, x, -y);
      if (passageFloor !== undefined && height < passageFloor + 3) return;
      const half = sample('half', x, y),
        edge = sample('edge', x, y),
        inPark = sample('green', x, y) < 0,
        onFoot = sample('foot', x, y) < 1.5;
      let lamp;
      if (edge > 9 || inPark) lamp = onFoot && rnd(i, 900) < 0.35 ? 'bollard' : cityStyle.lamps.park;
      else if (half >= 6.5) lamp = cityStyle.lamps.avenue === 'cobra' ? 'twin' : cityStyle.lamps.avenue;
      else if (half >= 4.2) lamp = cityStyle.lamps.avenue;
      else if (half >= 2.6) lamp = rnd(i, 901) < 0.85 ? cityStyle.lamps.street : cityStyle.lamps.lane;
      else lamp = cityStyle.lamps.lane;
      const dir = toRoad(x, y);
      const turn = dir ? Math.atan2(dir.y, dir.x) : rnd(i, 902) * Math.PI * 2;
      const entry = put(
        `lamp.${lamp}`,
        () => lampAsset(lamp, lampHeights[lamp], seed),
        x,
        y,
        turn + (rnd(i, 903) - 0.5) * 0.06,
        1,
        null,
        height - ground(x, -y),
      );
      if (!entry) return;
      take(x, y, 0.35);
      const key = lampKey(Math.floor(x / lampCell), Math.floor(y / lampCell));
      if (!lampGrid.has(key)) lampGrid.set(key, []);
      lampGrid.get(key).push({ x, y, height });
      const c = Math.cos(turn),
        s = Math.sin(turn);
      for (const l of entry.asset.lights) {
        const wx = x + l.x * c + l.z * s,
          wy = y + l.x * s - l.z * c;
        lights.push({ x: wx, y: l.y + height, z: -wy, kind: lamp, mapped });
        street.light(
          wx,
          wy,
          lamp === 'bollard' ? 5 : lamp === 'globe' ? 10 : 9 + l.y * 1.1,
          lamp === 'bollard' ? 0.5 : 1,
        );
      }
    };
    osm.lamps.forEach((l, i) => placeLamp(l.x, l.y, i, true));
    if (infer.lamps) {
      let n = 5000;
      for (const r of osm.roads) {
        if (r.lit === false || r.tunnel || r.layer < 0 || (r.highway === 'service' && r.width < 4)) continue;
        if (r.foot && !roadsWithDecks.has(r.id)) continue;
        const spacing = r.width >= 8.4 ? 32 : 26;
        alongRoad(r.points, spacing, 6 + rnd(r.id % 100000, 910) * spacing * 0.35).forEach((p, k) => {
          const sideSign = k % 2 ? 1 : -1;
          const distance = r.foot ? Math.max(0, r.width / 2 - 0.35) : Math.max(1.5, r.width / 2) + 0.55;
          const x = p.x - p.dy * distance * sideSign,
            y = p.y + p.dx * distance * sideSign;
          const deck = bridgeSurfaceHeight(bridges?.profiles, x, -y, r.id);
          if (deck === undefined && (!walkable(x, y, 0.25) || sample('junction', x, y) < 3)) return;
          const height = deck ?? ground(x, -y);
          if (!nearbyLamp(x, y, height)) placeLamp(x, y, n++, false, height);
        });
      }
    }

    // Shelters the map records, each turned to face along its longer side.
    canopies.forEach((b, k) => {
      const ring = b.ring;
      const cx = ring.reduce((t, q) => t + q.x, 0) / ring.length,
        cy = ring.reduce((t, q) => t + q.y, 0) / ring.length;
      let best = 0,
        angle = 0;
      for (let q = 0; q < ring.length; q++) {
        const a = ring[q],
          n = ring[(q + 1) % ring.length],
          l = Math.hypot(n.x - a.x, n.y - a.y);
        if (l > best) {
          best = l;
          angle = Math.atan2(n.y - a.y, n.x - a.x);
        }
      }
      if (
        put(
          'shelter',
          () => furnitureAsset('shelter', seed + (k % 3)),
          cx,
          cy,
          angle,
          Math.max(0.8, Math.min(2.2, best / 4)),
        )
      )
        take(cx, cy, 2.2);
    });

    // Stops: a shelter on every platform the map records, and at bus stops that have room,
    // unless the map says the stop has no shelter.
    const alongLongest = (ring) => {
      let best = 0,
        angle = 0;
      for (let q = 0; q < ring.length; q++) {
        const a = ring[q],
          n = ring[(q + 1) % ring.length],
          l = Math.hypot(n.x - a.x, n.y - a.y);
        if (l > best) {
          best = l;
          angle = Math.atan2(n.y - a.y, n.x - a.x);
        }
      }
      return { angle, length: best };
    };
    (osm.areas ?? [])
      .filter((a) => a.kind === 'platform' && Array.isArray(a.ring) && a.ring.length >= 3)
      .forEach((a, k) => {
        const cx = a.ring.reduce((t, q) => t + q.x, 0) / a.ring.length,
          cy = a.ring.reduce((t, q) => t + q.y, 0) / a.ring.length;
        const { angle, length } = alongLongest(a.ring);
        if (length < 6 || !free(cx, cy, 1.5)) return;
        if (put('shelter', () => furnitureAsset('shelter', seed + (k % 3)), cx, cy, angle)) take(cx, cy, 2.4);
      });
    (osm.amenities ?? [])
      .filter((a) => a.kind === 'bus_stop' && a.shelter !== false)
      .forEach((a, k) => {
        if (!free(a.x, a.y, 1.8) || sample('wall', a.x, a.y) < 1.6 || onRails(a.x, a.y, 2)) return;
        // Face the shelter along the nearest road.
        let best = Infinity,
          angle = 0;
        for (const { road: r } of street.cars)
          for (let q = 0; q + 1 < r.points.length; q++) {
            const d = Math.hypot(r.points[q].x - a.x, r.points[q].y - a.y);
            if (d < best) {
              best = d;
              angle = Math.atan2(r.points[q + 1].y - r.points[q].y, r.points[q + 1].x - r.points[q].x);
            }
          }
        if (best < 25 && put('shelter', () => furnitureAsset('shelter', seed + (k % 3)), a.x, a.y, angle))
          take(a.x, a.y, 2.4);
      });

    // Trees: eight variants of each form, repeated with their own turn, size and tint, so a row
    // of one species never shows the same silhouette twice in a glance.
    const treeName = (form, i) => `tree.${form}.${Math.floor(rnd(i, 920) * 8)}`;
    const placeTree = (x, y, height, crown, leaf, i) => {
      if (!inside(x, y) || !street.clearOfTransport(x, y) || !free(x, y, 1.2)) return;
      if (sample('wall', x, y) < 0.3 || sample('water', x, y) < 0.3) return;
      const passageFloor = underpassSurfaceHeight(underpasses?.profiles, x, -y);
      if (passageFloor !== undefined && ground(x, -y) < passageFloor + height) return;
      let form;
      if (leaf === 'needle') form = 'conifer';
      else if (height < 6) form = 'young';
      else {
        const u = rnd(i, 921);
        const w = style.trees;
        const total = w.reduce((a, b) => a + b, 0);
        let t = u * total,
          k = 0;
        while (k < w.length - 1 && (t -= w[k]) > 0) k++;
        form = ['round', 'oval', 'spreading', 'columnar', 'birch', 'conifer'][k];
      }
      const variant = treeName(form, i);
      const nominal = form === 'conifer' ? 12 : form === 'young' ? 5 : 10;
      const variantSeed =
        (seed + variant.charCodeAt(variant.length - 1) * 7919 + form.charCodeAt(0) * 131 + form.length * 17) >>> 0;
      const tint = [0.9 + rnd(i, 922) * 0.2, 0.92 + rnd(i, 923) * 0.16, 0.88 + rnd(i, 924) * 0.2];
      const treeSpec = {
        height: nominal,
        crown:
          form === 'columnar'
            ? nominal * 0.3
            : form === 'conifer'
              ? nominal * 0.42
              : form === 'spreading'
                ? nominal * 0.85
                : nominal * 0.62,
        seed: variantSeed,
        season,
      };
      const placed = put(
        variant,
        () => ({ ...treeAsset(form, treeSpec), far: treeAsset(form, { ...treeSpec, lod: 'far' }).mesh }),
        x,
        y,
        rnd(i, 925) * Math.PI * 2,
        (height / nominal) * (0.78 + rnd(i, 926) * 0.44),
        tint,
      );
      if (!placed) return;
      take(x, y, Math.min(2.5, crown * 0.25));
      treeSpots.push({ x, y, height });
      if (season === 'autumn' && form !== 'conifer') {
        const radius = Math.min(16, Math.max(4, crown * 0.8, height * 0.6));
        street.scatterLeaves(x, y, radius);
      }
    };
    osm.trees.forEach((t, i) => placeTree(t.x, t.y, t.height, t.crown, t.leaf, 20000 + i));
    if (infer.trees) {
      // Street trees where the map records few: along the open side of ordinary streets, set
      // back from the kerb, wherever the pavement is wide enough to hold one.
      let roadLength = 0;
      for (const { road: r } of street.cars)
        for (let k = 0; k + 1 < r.points.length; k++)
          roadLength += Math.hypot(r.points[k + 1].x - r.points[k].x, r.points[k + 1].y - r.points[k].y);
      if (osm.trees.length < roadLength / 45) {
        let n = 30000;
        for (const { road: r, half, index } of street.cars) {
          if (r.highway === 'service' || r.bridge || r.highway === 'busway') continue;
          const species = rnd(index, 927);
          for (const sideSign of [1, -1])
            alongRoad(r.points, 11 + rnd(index, 928) * 5, 4 + rnd(index, 929 + sideSign) * 8).forEach((p) => {
              n++;
              const d = half + 1.25;
              const x = p.x - p.dy * d * sideSign + (rnd(n, 935) - 0.5) * 0.5,
                y = p.y + p.dx * d * sideSign + (rnd(n, 936) - 0.5) * 0.5;
              if (
                !walkable(x, y, 0.9) ||
                sample('wall', x, y) < 3.4 ||
                sample('junction', x, y) < 7 ||
                rnd(n, 937) < 0.12
              )
                return;
              // One avenue, one kind of tree: sizes vary, the species mostly does not.
              const h = 8 + rnd(n, 938) * 4 + species * 2.5;
              placeTree(x, y, h, h * 0.55, 'broad', Math.floor(species * 5) * 1000 + (rnd(n, 939) < 0.85 ? 0 : n));
            });
        }
      }
      // Parks and woods: a jittered grid, thinned by how wooded the ground is.
      const step = 8.5;
      let i = 40000;
      for (let y = bounds.y0 + step / 2; y < bounds.y1; y += step)
        for (let x = bounds.x0 + step / 2; x < bounds.x1; x += step) {
          i++;
          const px = x + (rnd(i, 930) - 0.5) * step * 0.9,
            py = y + (rnd(i, 931) - 0.5) * step * 0.9;
          if (!inside(px, py)) continue;
          if (sample('green', px, py) > -1.6) {
            // Back gardens: a small tree here and there behind the houses.
            if (
              sample('green', px, py) > 0 &&
              sample('edge', px, py) > 12 &&
              sample('wall', px, py) > 2.4 &&
              sample('water', px, py) > 2 &&
              rnd(i, 935) < 0.2
            ) {
              const gh = 4.5 + rnd(i, 936) * 5;
              placeTree(px, py, gh, gh * 0.6, 'broad', i);
            }
            continue;
          }
          const kind = sample('greenKind', px, py);
          const wooded = kind === 3 ? 0.92 : kind === 2 ? 0.42 : 0.1;
          if (rnd(i, 932) > wooded || sample('foot', px, py) < 1.6 || sample('edge', px, py) < 3) continue;
          const h = 7 + rnd(i, 933) * 9;
          placeTree(px, py, h, h * 0.55, nordic && rnd(i, 934) < 0.3 ? 'needle' : 'broad', i);
        }
    }

    // Parked cars along the kerbs of ordinary streets.
    if (infer.cars) {
      const parkable = new Set(['residential', 'tertiary', 'unclassified', 'secondary', 'living_street']);
      let i = 60000;
      for (const { road: r, half, index } of street.cars) {
        if (!parkable.has(r.highway) || r.bridge || half < 2.5) continue;
        // A street that carries tram rails keeps its kerbs clear: cars drive there, but none park.
        const middle = r.points[Math.floor(r.points.length / 2)];
        if (r.tramTrack || onRails(middle.x, middle.y, half + 3) || onRails(r.points[0].x, r.points[0].y, half + 3))
          continue;
        // Parked rows go only where the moving lanes leave room, so traffic never meets them.
        const bays = parkingPlan(r, half, style.drive);
        const sides = [...(bays.left ? [1] : []), ...(bays.right ? [-1] : [])];
        for (const sideSign of sides) {
          // Stretches of parked cars with gaps, rather than an even scatter.
          const pts = alongRoad(r.points, 5.7, 3 + rnd(index, 941 + sideSign) * 4);
          pts.forEach((p, k) => {
            i++;
            const run = Math.sin(k * 0.55 + rnd(index, 942 + sideSign) * 20) * 0.5 + 0.5;
            if (rnd(i, 943) > 0.3 + run * 0.6) return;
            const d = half - 1.02 + (rnd(i, 944) - 0.5) * 0.16;
            const keepLeft = style.drive === 'left';
            const x = p.x - p.dy * d * sideSign,
              y = p.y + p.dx * d * sideSign;
            if (
              !inside(x, y) ||
              sample('junction', x, y) < 9 ||
              Math.abs(sample('zebra', x, y)) < 6 ||
              sample('bridge', x, y) < 0
            )
              return;
            if (sample('edge', x, y) > -0.7 || sample('edge', x, y) < -half + 0.2 || !free(x, y, 2.6)) return;
            let pickCar = rnd(i, 945) * style.cars.reduce((a, c) => a + c, 0),
              bodyIndex = 0;
            while (bodyIndex < 4 && (pickCar -= style.cars[bodyIndex]) > 0) bodyIndex++;
            const body = carBodies[bodyIndex];
            const paint = weightedPaint(CAR_PAINT, rnd(i, 946));
            const colour = rgb(hsla(paint[0], paint[1], paint[2] + (rnd(i, 947) - 0.5) * 6));
            const heading =
              Math.atan2(p.dy, p.dx) + (sideSign > 0 !== keepLeft ? Math.PI : 0) + (rnd(i, 948) - 0.5) * 0.07;
            // Each parked car is one of a few looks of its type: an era, a size, a ride height.
            const variant = Math.floor(rnd(i, 949) * VEHICLE_VARIANTS);
            put(
              `car.${body}.${variant}`,
              () => vehicleAsset(body, { look: vehicleLook(body, variant, seed, style.name) }),
              x,
              y,
              heading,
              1,
              colour,
            );
            take(x, y, 2.3);
          });
        }
      }
    }

    // Crossings with signals get a signal head on each side.
    street.crossings.forEach((x, i) => {
      if (x.kind !== 'signals') return;
      const dir = toRoad(x.x + 0.01, x.y + 0.01);
      // On the centre line the slope is ambiguous, so step off to both sides along the field.
      for (const sideSign of [1, -1]) {
        let best = null;
        for (let a = 0; a < 16; a++) {
          const ang = (a / 16) * Math.PI * 2,
            px = x.x + Math.cos(ang) * (x.half + 0.7),
            py = x.y + Math.sin(ang) * (x.half + 0.7);
          if (!walkable(px, py, 0.2)) continue;
          const score = sideSign * (Math.cos(ang) * 0.3 + Math.sin(ang));
          if (!best || score > best.score) best = { px, py, score, ang };
        }
        if (best && free(best.px, best.py, 0.4)) {
          put('signal', () => furnitureAsset('signal', seed + i), best.px, best.py, best.ang + Math.PI / 2);
          take(best.px, best.py, 0.3);
        }
      }
      void dir;
    });

    if (infer.furniture) {
      let i = 80000;
      const cloth = (k) => {
        const p = weightedPaint(CLOTH_PAINT, rnd(k, 950));
        return rgb(hsla(p[0], p[1], p[2]));
      };
      // Corners: bollards and a sign where pavements meet at a junction.
      for (const j of street.junctions) {
        i++;
        const radius = j.width / 2 + 1.5;
        let signed = false;
        for (let a = 0; a < 12; a++) {
          const ang = (a / 12) * Math.PI * 2 + rnd(i, 951),
            x = j.x + Math.cos(ang) * radius,
            y = j.y + Math.sin(ang) * radius;
          const e = inside(x, y) ? sample('edge', x, y) : -1;
          if (e < 0.25 || e > 1.4 || !walkable(x, y, 0.25) || !free(x, y, 0.5)) continue;
          if (!signed && rnd(i, 952 + a) < 0.35) {
            const kind = ['signRound', 'signTriangle', 'signPlate'][Math.floor(rnd(i, 953) * 3)];
            put(kind, () => furnitureAsset(kind, seed + (i % 7)), x, y, ang + Math.PI + (rnd(i, 954) - 0.5) * 0.5);
            signed = true;
          } else if (oldTown || rnd(i, 955 + a) < 0.5)
            put(
              oldTown ? 'bollard' : 'bollardSteel',
              () => furnitureAsset(oldTown ? 'bollard' : 'bollardSteel', seed),
              x,
              y,
              rnd(i, 956 + a) * 6,
            );
          else continue;
          take(x, y, 0.3);
        }
      }
      // Along streets: bins, cabinets, post boxes, planters, bike racks and shelters.
      for (const { road: r, half, index } of street.cars) {
        if (r.highway === 'service' || r.bridge) continue;
        let sinceShelter = 60 + rnd(index, 960) * 200;
        alongRoad(r.points, 13, rnd(index, 961) * 13).forEach((p, k) => {
          i++;
          const sideSign = rnd(i, 962) < 0.5 ? 1 : -1;
          const d = half + 0.95;
          const x = p.x - p.dy * d * sideSign,
            y = p.y + p.dx * d * sideSign;
          sinceShelter += 13;
          if (!walkable(x, y, 0.6) || sample('junction', x, y) < 7 || !free(x, y, 1.2)) return;
          const facing = Math.atan2(p.dy, p.dx) + (sideSign > 0 ? Math.PI / 2 : -Math.PI / 2);
          const u = rnd(i, 963);
          const wide = sample('wall', x, y) > 2.2;
          if (half >= 3.2 && sinceShelter > 260 && wide && u < 0.25) {
            put(
              'shelter',
              () => furnitureAsset('shelter', seed + k),
              x - p.dy * 0.7 * sideSign,
              y + p.dx * 0.7 * sideSign,
              facing + Math.PI,
            );
            take(x, y, 2.6);
            sinceShelter = 0;
          } else if (u < 0.1) {
            put(style.bin, () => furnitureAsset(style.bin, seed), x, y, facing);
            take(x, y, 0.4);
          } else if (u < 0.15) {
            put('cabinet', () => furnitureAsset('cabinet', seed), x, y, facing + Math.PI);
            take(x, y, 0.6);
          } else if (u < 0.18) {
            put(
              'postbox',
              () => furnitureAsset('postbox', seed),
              x,
              y,
              facing,
              1,
              rgb(hsla(style.postbox[0], style.postbox[1], style.postbox[2])),
            );
            take(x, y, 0.4);
          } else if (u < 0.2) {
            put('hydrant', () => furnitureAsset('hydrant', seed), x, y, facing);
            take(x, y, 0.3);
          } else if (u < 0.24 && wide) {
            put('planter', () => furnitureAsset('planter', seed + (i % 3)), x, y, rnd(i, 965) * 6, 1, [
              0.92 + rnd(i, 966) * 0.16,
              1,
              0.9 + rnd(i, 967) * 0.2,
            ]);
            take(x, y, 0.9);
          } else if (infer.bikes && u < 0.24 + 0.18 * style.bikes && wide) {
            const along = Math.atan2(p.dy, p.dx);
            put('bikeRack', () => furnitureAsset('bikeRack', seed), x, y, along);
            take(x, y, 1.6);
            for (let hoop = 0; hoop < 4; hoop++) {
              if (rnd(i, 970 + hoop) < 0.3) continue;
              const paint = weightedPaint(BIKE_PAINT, rnd(i, 974 + hoop));
              const off = (hoop - 1.5) * 0.7 + 0.1;
              put(
                rnd(i, 978 + hoop) < 0.7 ? 'bike.city' : 'bike.sport',
                () => bikeAsset(rnd(i, 978 + hoop) < 0.7 ? 'city' : 'sport'),
                x + p.dx * off,
                y + p.dy * off,
                along + Math.PI / 2 + (rnd(i, 982 + hoop) < 0.5 ? Math.PI : 0) + (rnd(i, 986 + hoop) - 0.5) * 0.3,
                1,
                rgb(hsla(paint[0], paint[1], paint[2])),
              );
            }
          }
        });
      }
      // A bicycle leaning on some lamp posts: a small thing that makes a street look used.
      if (infer.bikes)
        lights.forEach((l, k) => {
          if (l.kind !== 'lantern' && l.kind !== 'led') return;
          if (rnd(k, 990) > 0.18 * style.bikes) return;
          const paint = weightedPaint(BIKE_PAINT, rnd(k, 991));
          const a = rnd(k, 992) * Math.PI * 2;
          const x = l.x + Math.cos(a) * 0.3,
            y = -l.z + Math.sin(a) * 0.3;
          if (walkable(x, y, 0.2))
            put(
              'bike.city',
              () => bikeAsset('city'),
              x,
              y,
              a + Math.PI / 2,
              1,
              rgb(hsla(paint[0], paint[1], paint[2])),
            );
        });
      // Parks and squares: benches facing the path, with a bin by some.
      for (const r of osm.roads) {
        if (!r.foot || r.highway === 'steps' || r.bridge) continue;
        alongRoad(r.points, 24, 6 + rnd(r.id % 100000, 995) * 14).forEach((p, k) => {
          i++;
          const sideSign = rnd(i, 996) < 0.5 ? 1 : -1;
          const d = r.width / 2 + 0.75;
          const x = p.x - p.dy * d * sideSign,
            y = p.y + p.dx * d * sideSign;
          const green = inside(x, y) && sample('green', x, y) < 1.5;
          if ((!green && r.highway !== 'pedestrian') || !walkable(x, y, 0.8) || !free(x, y, 1.4) || rnd(i, 997) < 0.35)
            return;
          const facing = Math.atan2(p.dy, p.dx) + (sideSign > 0 ? -Math.PI / 2 : Math.PI / 2);
          const modern = !oldTown && rnd(i, 998) < 0.5;
          put(
            modern ? 'benchModern' : 'bench',
            () => furnitureAsset(modern ? 'benchModern' : 'bench', seed),
            x,
            y,
            facing,
          );
          take(x, y, 1.1);
          if (rnd(i, 999) < 0.45) {
            const bx = x + p.dx * 1.5,
              by = y + p.dy * 1.5;
            if (walkable(bx, by, 0.5) && free(bx, by, 0.4)) {
              put('bin', () => furnitureAsset('bin', seed), bx, by, facing);
              take(bx, by, 0.35);
            }
          }
          void k;
        });
      }
      // Café tables outside some shops, under parasols of one colour per café.
      osm.buildings.forEach((b, bi) => {
        const look = styles[bi];
        if (look.ground !== 'shop' || rnd(bi, 1001) > 0.3 * cityStyle.cafes || b.minHeight > 0) return;
        let best = null;
        for (let e = 0, n = b.ring.length; e < n; e++) {
          const p = b.ring[e],
            q = b.ring[(e + 1) % n],
            len = Math.hypot(q.x - p.x, q.y - p.y);
          if (len < 5 || party(p, q)) continue;
          const nx = (q.y - p.y) / len,
            ny = -(q.x - p.x) / len,
            mx = (p.x + q.x) / 2 + nx * 2.2,
            my = (p.y + q.y) / 2 + ny * 2.2;
          if (!walkable(mx, my, 0.9) || sample('edge', mx, my) > 9) continue;
          if (!best || len > best.len) best = { p, q, len, nx, ny };
        }
        if (!best) return;
        const colour = cloth(bi),
          chair = rgb(hsla(30, 10, 20 + rnd(bi, 1002) * 60));
        const tables = Math.min(4, Math.floor(best.len / 2.6));
        for (let t = 0; t < tables; t++) {
          const u = (t + 0.5 + (rnd(bi, 1003 + t) - 0.5) * 0.3) / tables,
            out = 1.5 + rnd(bi, 1007 + t) * 0.5;
          const x = best.p.x + (best.q.x - best.p.x) * u + best.nx * out,
            y = best.p.y + (best.q.y - best.p.y) * u + best.ny * out;
          if (!walkable(x, y, 0.7) || !free(x, y, 1.0)) continue;
          put(
            'cafeTable',
            () => furnitureAsset('cafeTable', seed),
            x,
            y,
            0,
            1,
            rgb(hsla(40, 6, 30 + rnd(bi, 1011) * 55)),
          );
          take(x, y, 0.9);
          const chairs = 2 + (rnd(bi, 1012 + t) < 0.35 ? 1 : 0);
          for (let ch = 0; ch < chairs; ch++) {
            const a = (ch / chairs) * Math.PI * 2 + rnd(bi, 1016 + t * 3 + ch) * 0.9;
            put(
              'cafeChair',
              () => furnitureAsset('cafeChair', seed),
              x + Math.cos(a) * 0.62,
              y + Math.sin(a) * 0.62,
              a + Math.PI / 2 + Math.PI + (rnd(bi, 1030 + t * 3 + ch) - 0.5) * 0.5,
              1,
              chair,
            );
          }
          if (rnd(bi, 1040) < 0.7)
            put(
              'umbrella',
              () => furnitureAsset('umbrella', seed),
              x + 0.1,
              y + 0.05,
              rnd(bi, 1041 + t) * 6,
              0.92 + rnd(bi, 1045 + t) * 0.16,
              colour,
            );
        }
      });
    }

    // Boats moored along quays.
    if (infer.boats) {
      let i = 100000;
      for (const [waterIndex, w] of osm.water.entries()) {
        if (w.ring.length < 4 || w.kind === 'lake') continue;
        const level = waterSurface?.levels[waterIndex];
        const pts = localShore(w.ring).flatMap((path) =>
          alongRoad(
            path.map(([x, , z]) => ({ x, y: -z })),
            9,
            rnd(Number(w.id) % 100000, 1050) * 9,
          ),
        );
        for (const p of pts) {
          i++;
          // The ring runs counter-clockwise, so the water lies to the left of travel.
          const x = p.x - p.dy * 1.7,
            y = p.y + p.dx * 1.7;
          if (
            !inside(x, y) ||
            rnd(i, 1051) > 0.4 ||
            sample('water', x, y) > -1.3 ||
            // Houseboats are mapped as buildings on the water; keep a boat clear of them.
            sample('wall', x, y) < 2.5 ||
            sample('bridge', x, y) < 3 ||
            !free(x, y, 3)
          )
            continue;
          const paint = weightedPaint(CLOTH_PAINT, rnd(i, 1052));
          const variant = Math.floor(rnd(i, 1053) * 4);
          put(
            `boat.${variant}`,
            () => boatAsset(seed + variant),
            x,
            y,
            Math.atan2(p.dy, p.dx) + (rnd(i, 1054) < 0.5 ? Math.PI : 0) + (rnd(i, 1055) - 0.5) * 0.12,
            1,
            rgb(hsla(paint[0], paint[1], paint[2])),
            (level === undefined ? WATER_LEVEL : level - ground(x, -y)) + 0.02,
          );
          take(x, y, 3);
        }
      }
    }
  }

  // ---------------------------------------------------------------- ground cover
  // Grass, tall grass, ferns and drifts of flowers wherever something grows: in parks and
  // woods, in back gardens and round the foot of street trees. Density follows two scales of
  // noise, so the cover is patchy rather than even, and flowers come in drifts of one colour.
  const coverTiles = new Map();
  let coverCount = 0;
  const coverLimit = Math.min(cityLimits.cover, Math.round(110_000 * density));
  const coverMeshes = new Map();
  const putCover = (name, make, x, y, turn, scale, tint) => {
    if (coverCount >= coverLimit || !inside(x, y) || sample('water', x, y) < 0) return;
    if (!coverMeshes.has(name)) coverMeshes.set(name, make().mesh);
    const i = Math.floor(x / COVER_TILE),
      j = Math.floor(y / COVER_TILE),
      key = `${name}|${i}|${j}`;
    let t = coverTiles.get(key);
    if (!t) coverTiles.set(key, (t = { name, i, j, items: [] }));
    t.items.push(x, ground(x, -y), -y, turn, scale, tint[0], tint[1], tint[2]);
    coverCount++;
  };
  const bloomOf = (u) => {
    let total = 0;
    for (const c of BLOOMS) total += c[3];
    let t = u * total,
      k = 0;
    while (k < BLOOMS.length - 1 && (t -= BLOOMS[k][3]) > 0) k++;
    return k;
  };
  const flowers = (k) => [`flowers.${k}`, () => coverAsset('flowers', seed + k, BLOOMS[k])];
  const green = (i, k) => [0.82 + rnd(i, k) * 0.36, 0.86 + rnd(i, k + 1) * 0.28, 0.7 + rnd(i, k + 2) * 0.5];
  if (detail === 'full' && infer.plants && density > 0) {
    // Round each street tree: a bed of soil, a ring of grass and a few flowers.
    treeSpots.forEach((t, n) => {
      const i = 200000 + n;
      if (sample('green', t.x, t.y) < 0 || sample('edge', t.x, t.y) > 9) return;
      putCover(
        'treePit',
        () => coverAsset('treePit', seed),
        t.x,
        t.y,
        rnd(i, 1100) * 6,
        0.85 + rnd(i, 1101) * 0.4,
        [1, 1, 1],
      );
      const tufts = 5 + Math.floor(rnd(i, 1102) * 9);
      const bloom = bloomOf(rnd(i, 1103));
      for (let k = 0; k < tufts; k++) {
        const a = rnd(i, 1110 + k) * Math.PI * 2,
          d = 0.25 + Math.sqrt(rnd(i, 1130 + k)) * 0.55;
        const kind = rnd(i, 1150 + k);
        const x = t.x + Math.cos(a) * d,
          y = t.y + Math.sin(a) * d;
        if (kind < 0.16 * style.flowers) putCover(...flowers(bloom), x, y, a, 0.8 + rnd(i, 1170 + k) * 0.5, [1, 1, 1]);
        else
          putCover(
            kind < 0.75 ? 'grass' : 'grassTall',
            () => coverAsset(kind < 0.75 ? 'grass' : 'grassTall', seed),
            x,
            y,
            a,
            0.8 + rnd(i, 1170 + k) * 0.7,
            green(i, 1190 + k * 3),
          );
      }
    });
    // Carpets: estimate the planted area first, then choose a spacing that fits the budget.
    const f = field;
    let planted = 0;
    for (let c = 0; c < f.green.length; c += 7)
      if (f.green[c] < -0.3 || (f.edge[c] > 12 && f.wall[c] > 1.5 && f.water[c] > 1)) planted += 7;
    const area = planted * cell * cell;
    const step = Math.max(0.7, Math.sqrt(area / Math.max(1, coverLimit * 0.9)) * 0.8);
    let i = 300000;
    for (let y = bounds.y0 + step / 2; y < bounds.y1 && coverCount < coverLimit; y += step)
      for (let x = bounds.x0 + step / 2; x < bounds.x1; x += step) {
        i++;
        const px = x + (rnd(i, 1200) - 0.5) * step,
          py = y + (rnd(i, 1201) - 0.5) * step;
        if (!inside(px, py)) continue;
        const g = sample('green', px, py);
        const yard = g > 0 && sample('edge', px, py) > 12;
        if (g > -0.25 && !yard) continue;
        if (
          sample('wall', px, py) < 0.35 ||
          sample('foot', px, py) < 0.35 ||
          sample('edge', px, py) < 0.6 ||
          sample('water', px, py) < 0.5
        )
          continue;
        // Patchiness at two scales: broad stands and small gaps.
        const broad = gradientRaw2(px * 0.035, py * 0.035, seed + 11) * 0.5 + 0.5,
          small = gradientRaw2(px * 0.31, py * 0.31, seed + 12) * 0.5 + 0.5;
        const kindOfGreen = sample('greenKind', px, py);
        const wood = kindOfGreen === 3,
          lawn = kindOfGreen === 1;
        const fullness = (yard ? 0.4 : wood ? 0.85 : lawn ? 0.5 : 0.62) * (0.35 + broad * 0.9) * (0.55 + small * 0.6);
        if (rnd(i, 1202) > fullness) continue;
        // Flowers grow in drifts: one colour per patch of the drift noise.
        const drift = gradientRaw2(px * 0.09 + 40, py * 0.09 - 17, seed + 13) * 0.5 + 0.5;
        const wild = gradientRaw2(px * 0.05 - 9, py * 0.05 + 23, seed + 14) * 0.5 + 0.5;
        const turn = rnd(i, 1203) * Math.PI * 2,
          size = 0.75 + rnd(i, 1204) * 0.9;
        if (drift > 0.66 - 0.06 * style.flowers && rnd(i, 1205) < 0.55 * style.flowers) {
          const bloom = bloomOf((Math.floor(px / 9) * 0.37 + Math.floor(py / 9) * 0.61 + drift * 3) % 1);
          putCover(...flowers(bloom), px, py, turn, size, [1, 1, 1]);
        } else if (wood && rnd(i, 1206) < 0.4)
          putCover('fern', () => coverAsset('fern', seed), px, py, turn, size * 1.1, green(i, 1210));
        else if (wild > (lawn ? 0.72 : 0.5) || rnd(i, 1207) < 0.12)
          putCover('grassTall', () => coverAsset('grassTall', seed), px, py, turn, size, green(i, 1210));
        else putCover('grass', () => coverAsset('grass', seed), px, py, turn, size * 1.15, green(i, 1210));
      }
  }

  // ------------------------------------------------------------------------ people
  // Routes run along pavements and paths. A walker is a route, a start, a speed and a look;
  // where it stands at any time is a pure function of that time (see walkerPose).
  const routes = [],
    walkers = [],
    walkerColors = [],
    walkerMotion = [],
    activity = [],
    figures = [];
  let groups = 0;
  if (detail === 'full' && peopleDensity > 0) {
    const addRoute = (pts, roadId) => {
      let run = [];
      const close = () => {
        if (run.length >= 6) {
          let len = 0;
          const flat = [];
          run.forEach((p, k) => {
            if (k) len += Math.hypot(p.x - run[k - 1].x, p.y - run[k - 1].y);
            flat.push(p.x, p.y, len);
          });
          if (len >= 24) routes.push({ points: new Float32Array(flat), length: len, roadId });
        }
        run = [];
      };
      for (const p of pts) {
        const deck = bridgeSurfaceHeight(bridges?.profiles, p.x, -p.y, roadId);
        const lower = underpassSurfaceHeight(underpasses?.profiles, p.x, -p.y, roadId);
        if ((lower !== undefined || deck !== undefined || walkable(p.x, p.y, 0.5)) && sample('green', p.x, p.y) > -40)
          run.push(p);
        else close();
      }
      close();
    };
    for (const { road: r, half } of street.cars) {
      if (r.highway === 'service' || r.bridge) continue;
      for (const sideSign of [1, -1])
        addRoute(
          alongRoad(r.points, 4).map((p) => ({
            x: p.x - p.dy * (half + 1.45) * sideSign,
            y: p.y + p.dx * (half + 1.45) * sideSign,
          })),
          r.id,
        );
    }
    for (const r of osm.roads)
      if (r.foot && r.highway !== 'steps' && (!r.tunnel || underpasses?.roadIds.includes(r.id)))
        addRoute(alongRoad(r.points, 4), r.id);
    // The figures walkers are drawn with: one for the plain default, or a set of looks.
    if (routes.length) {
      const looks =
        clothing === 'plain'
          ? [personLook()]
          : clothing === 'auto'
            ? Array.from({ length: crowdVariants }, (_, k) =>
                personWardrobe({
                  weather: crowd.weather ?? null,
                  season,
                  style,
                  variety: crowdVariety,
                  seed,
                  index: k,
                  wear: crowd.wear ?? {},
                }),
              )
            : (Array.isArray(clothing) ? clothing : [clothing]).map((l) => personLook(l));
      for (const look of looks) figures.push(personAsset(look, seed));
    }
    // A point of a route at distance d along it, with the route's direction there.
    const routeAt = (route, d) => {
      const p = route.points,
        n = p.length / 3;
      let lo = 0,
        hi = n - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (p[mid * 3 + 2] <= d) lo = mid;
        else hi = mid;
      }
      const a = lo * 3,
        c = hi * 3,
        t = (d - p[a + 2]) / Math.max(1e-6, p[c + 2] - p[a + 2]);
      const l = Math.hypot(p[c] - p[a], p[c + 1] - p[a + 1]) || 1;
      return {
        x: p[a] + (p[c] - p[a]) * t,
        y: p[a + 1] + (p[c + 1] - p[a + 1]) * t,
        dx: (p[c] - p[a]) / l,
        dy: (p[c + 1] - p[a + 1]) / l,
      };
    };
    // One person. `start` is the distance along the route, `speed` is signed by direction, `offset`
    // the offset across the pavement; `act` holds the twelve activity numbers.
    const addPerson = (ri, i, { start, speed = null, offset = null, act, move: given = null, wander = true }) => {
      const variant = Math.floor(rnd(i, 1307) * figures.length),
        look = figures[variant].look;
      const tones = personColors(look, seed, i),
        own = personMotion(look, {
          seed,
          index: i,
          noise: crowdNoise,
          pauses: crowdPauses,
          gait: crowd.gait ?? 'auto',
          weather: crowdWeather,
        });
      const move = given ? { ...own, ...given } : own;
      const scale = move.scale * (1 + (rnd(i, 1308) - 0.5) * 0.06 * crowdNoise);
      walkers.push(
        ri,
        start,
        speed ?? move.speed * (rnd(i, 1304) < 0.5 ? 1 : -1),
        offset ?? (rnd(i, 1306) - 0.5) * 1.1,
        variant,
        scale,
        rnd(i, 1309) * 6.28,
        own.step * scale,
        0,
        tones.top[0],
        tones.top[1],
        tones.top[2],
      );
      walkerColors.push(...tones.top, ...tones.bottom, ...tones.skin, ...tones.hair, ...tones.accent);
      walkerMotion.push(
        own.step,
        own.swing,
        own.lean,
        move.drift,
        move.driftRate,
        move.driftPhase,
        move.pause,
        move.rest,
        move.pauseAt,
        wander ? move.wander : 0,
        move.wanderRate,
        move.wanderPhase,
      );
      const a = new Array(12).fill(0);
      act.forEach((v, k) => (a[k] = v));
      activity.push(...a);
      return walkers.length / 12 - 1;
    };
    const room = (count = 1) => walkers.length / 12 + count <= cityLimits.people;
    // A place beside route `ri` with room for a circle of `radius` metres: off the walking line,
    // on the side away from the carriageway where there is room, and clear of street objects.
    const spotBeside = (ri, i, radius) => {
      const route = routes[ri];
      if (route.length < 8) return null;
      for (let attempt = 0; attempt < 4; attempt++) {
        const d = 3 + rnd(i, 1320 + attempt) * (route.length - 6);
        const at = routeAt(route, d),
          nx = -at.dy,
          ny = at.dx;
        const away =
          sample('edge', at.x + nx * 2, at.y + ny * 2) >= sample('edge', at.x - nx * 2, at.y - ny * 2) ? 1 : -1;
        for (const s of [away, -away]) {
          const gap = 0.8 + radius;
          const cx = at.x + nx * gap * s,
            cy = at.y + ny * gap * s;
          if (!walkable(cx, cy, radius + 0.3) || !free(cx, cy, radius + 0.25)) continue;
          take(cx, cy, radius + 0.1);
          routeSpots[ri].push(d, gap * s, radius);
          return { d, s, cx, cy, nx, ny, at };
        }
      }
      return null;
    };
    const routeSpots = routes.map(() => []);
    routes.forEach((route, ri) => {
      const count = Math.floor((route.length / 26) * peopleDensity * style.people + rnd(ri, 1300));
      for (let k = 0; k < count && room(); k++) {
        const i = 400000 + ri * 97 + k;
        const kind = chooseActivity(mix, rnd(i, 1310));
        const start = rnd(i, 1305) * route.length;
        if (kind === 'talk') {
          const size = Math.min(groupSize(mix, rnd(i, 1311)), cityLimits.people - walkers.length / 12);
          const radius = size === 2 ? 0.55 : 0.55 + 0.13 * (size - 2);
          const spot = size >= 2 ? spotBeside(ri, i, radius) : null;
          if (spot) {
            const g = groups++,
              base = rnd(i, 1312) * 6.28,
              slotLength = 2.6 + 3.4 * rnd(i, 1313);
            for (let m = 0; m < size; m++) {
              const j = i * 8 + m + 1,
                angle = base + (6.2832 * m) / size + (rnd(j, 1314) - 0.5) * 0.5;
              const x = spot.cx + Math.cos(angle) * radius,
                y = spot.cy + Math.sin(angle) * radius;
              const facing = Math.atan2(spot.cy - y, spot.cx - x) + (rnd(j, 1315) - 0.5) * 0.35;
              addPerson(ri, j, {
                start: spot.d,
                speed: 0,
                offset: 0,
                act: [
                  ACTIVITY.talk,
                  x,
                  y,
                  facing,
                  g,
                  m,
                  size,
                  rnd(j, 1316) < 0.3 ? 1 : 0,
                  0,
                  slotLength,
                  0.3 + 0.7 * rnd(j, 1317),
                  rnd(j, 1318) < 0.85 ? 0 : 1,
                ],
              });
            }
            k += size - 1;
            continue;
          }
        } else if (kind === 'stand') {
          const spot = spotBeside(ri, i, 0.35);
          if (spot) {
            const phone = rnd(i, 1319) < 0.5;
            // Someone waiting faces the street, or along it; someone on a phone faces anywhere.
            const facing = phone
              ? rnd(i, 1321) * 6.28
              : Math.atan2(-spot.ny * spot.s, -spot.nx * spot.s) + (rnd(i, 1322) - 0.5) * 1.6;
            addPerson(ri, i, {
              start: spot.d,
              speed: 0,
              offset: 0,
              act: [ACTIVITY.stand, spot.cx, spot.cy, facing, phone ? 1 : 0, rnd(i, 1323) * 6.28],
            });
            continue;
          }
        } else if (kind === 'browse' && route.length > 14) {
          // Drift along a few metres of shop fronts, stopping to look in.
          const length = 4 + 5 * rnd(i, 1324),
            from = rnd(i, 1325) * (route.length - length);
          const at = routeAt(route, from + length / 2),
            nx = -at.dy,
            ny = at.dx;
          const shop =
            sample('wall', at.x + nx * 3, at.y + ny * 3) < sample('wall', at.x - nx * 3, at.y - ny * 3) ? 1 : -1;
          const offset = shop * 0.7;
          if (
            walkable(at.x + nx * offset, at.y + ny * offset, 0.3) &&
            sample('wall', at.x + nx * 3 * shop, at.y + ny * 3 * shop) < 1.5
          ) {
            const pause = 6 + 4 * rnd(i, 1327);
            addPerson(ri, i, {
              start: rnd(i, 1326) * length * 2,
              offset,
              act: [ACTIVITY.browse, from, length, shop],
              move: {
                pause,
                rest: Math.min(2.5 + 3 * rnd(i, 1328), pause - 3.4),
                pauseAt: rnd(i, 1329) * 10,
              },
              wander: false,
            });
            // Browsers amble.
            walkers[walkers.length - 10] *= 0.55;
            continue;
          }
        }
        // Everyone else walks, some beside a companion.
        if (mix.pairs > 0 && rnd(i, 1330) < mix.pairs && room(2) && k + 1 < count) {
          const offset = (rnd(i, 1306) - 0.5) * 0.4;
          const lead = addPerson(ri, i, { start, offset, act: [ACTIVITY.pair, -1, 1], wander: false });
          const l = lead * 12,
            m = lead * 12;
          const shared = {
            drift: walkerMotion[m + 3],
            driftRate: walkerMotion[m + 4],
            driftPhase: walkerMotion[m + 5],
            pause: walkerMotion[m + 6],
            rest: walkerMotion[m + 7],
            pauseAt: walkerMotion[m + 8],
          };
          // The companion keeps the leader's pace, stops and speed changes, half a metre to one side.
          const partner = addPerson(ri, i + 50000, {
            start: walkers[l + 1] + (rnd(i, 1331) - 0.5) * 0.2,
            speed: walkers[l + 2],
            offset: offset + 0.62 * (rnd(i, 1332) < 0.5 ? 1 : -1),
            act: [ACTIVITY.pair, lead, 0],
            move: shared,
            wander: false,
          });
          activity[lead * 12 + 1] = partner;
          k++;
          continue;
        }
        addPerson(ri, i, { start, act: [ACTIVITY.walk] });
      }
    });
    routes.forEach((route, ri) => (route.spots = new Float32Array(routeSpots[ri])));
  }

  const fine = [...fineTiles.values()].map((t) => {
    const mesh = t.builder.finish();
    return Object.freeze({ x: (t.i + 0.5) * FINE_TILE, z: -(t.j + 0.5) * FINE_TILE, radius: FINE_TILE * 0.9, mesh });
  });
  // ----------------------------------------------------------------------- traffic
  // Cars, buses and trams that drive. Off unless asked for: `traffic: true` or an object of
  // settings (see planTraffic).
  let traffic = null;
  if (detail === 'full' && spec.traffic) {
    const paints = CAR_PAINT.flatMap((c) =>
      Array.from({ length: Math.max(1, Math.round(c[3] * 2)) }, () => rgb(hsla(c[0], c[1], c[2]))),
    );
    const riderPaints = COAT_PAINT.flatMap((c) =>
      Array.from({ length: Math.max(1, Math.round(c[3])) }, () => rgb(hsla(c[0], c[1], c[2]))),
    );
    const plan = planTraffic(
      osm,
      {
        bounds,
        seed,
        style,
        cars: street.cars,
        paints,
        riderModel: true,
        riderPaints,
        busPaint: rgb(hsla(style.postbox[0], 62, 40)),
        tramPaint: rgb(hsla(44, 22, 88)),
      },
      spec.traffic === true ? {} : spec.traffic,
    );
    const trafficMeshes = {},
      wheels = {};
    for (const u of plan.units) {
      if (trafficMeshes[u.mesh]) continue;
      const [name, variant] = u.mesh.split('~');
      const [kind, end] = name.split('.');
      const look = variant !== undefined ? vehicleLook(kind, Number(variant), seed, style.name) : null;
      const built = vehicleAsset(kind, { running: true, ...(end ? { end } : {}), ...(look ? { look } : {}) });
      trafficMeshes[u.mesh] = built.mesh;
      wheels[u.mesh] = built.shape.wheel;
    }
    traffic = Object.freeze({
      plan,
      meshes: Object.freeze(trafficMeshes),
      wheels: Object.freeze(wheels),
      count: plan.units.length,
    });
  }
  const meshes = {
    walls: layers.walls.finish(),
    roofs: layers.roofs.finish(),
    trim: layers.trim.finish(),
    ...(waterSurface ? { water: waterSurface.mesh } : {}),
    ...(waterSurface?.bank.vertexCount ? { waterBank: waterSurface.bank } : {}),
    ...(bridges?.mesh.vertexCount ? { bridges: bridges.mesh } : {}),
    ...(underpasses?.mesh.vertexCount ? { underpasses: underpasses.mesh } : {}),
  };
  let triangles = Object.values(meshes).reduce((count, mesh) => count + mesh.triangleCount, 0);
  for (const t of fine) triangles += t.mesh.triangleCount;
  const propList = [...props.values()].map((p) => {
    const count = p.items.length / 8;
    triangles += p.mesh.triangleCount * count;
    return Object.freeze({
      name: p.name,
      mesh: p.mesh,
      far: p.asset.far ?? null,
      range: propRange(p.name),
      count,
      transforms: new Float32Array(p.items),
    });
  });
  const inferredCount = {};
  for (const s of styles) for (const k of s.inferred) inferredCount[k] = (inferredCount[k] ?? 0) + 1;
  return Object.freeze({
    ...(terrain ? { terrain } : {}),
    ...(bridges?.profiles.length ? { bridgeProfiles: bridges.profiles } : {}),
    ...(bridgeField ? { bridgeField } : {}),
    ...(underpasses ? { underpass: { profiles: underpasses.profiles, mask: underpasses.mask } } : {}),
    meshes: Object.freeze(meshes),
    field: Object.freeze({ ...field }),
    props: Object.freeze(propList),
    fine: Object.freeze(fine),
    cover: Object.freeze(
      [...coverTiles.values()].map((t) =>
        Object.freeze({
          name: t.name,
          x: (t.i + 0.5) * COVER_TILE,
          z: -(t.j + 0.5) * COVER_TILE,
          radius: COVER_TILE * 0.75,
          count: t.items.length / 8,
          transforms: new Float32Array(t.items),
        }),
      ),
    ),
    coverMeshes: Object.freeze(Object.fromEntries(coverMeshes)),
    traffic,
    people: Object.freeze({
      // One figure per look: its full mesh, a simpler one for far away, its joints and its look.
      variants: Object.freeze(walkers.length ? figures.map((f) => f.mesh) : []),
      far: Object.freeze(walkers.length ? figures.map((f) => f.far) : []),
      rigs: Object.freeze(walkers.length ? figures.map((f) => f.rig) : []),
      looks: Object.freeze(walkers.length ? figures.map((f) => f.look) : []),
      routes: Object.freeze(routes.map((r) => Object.freeze(r))),
      // Twelve numbers per walker: route, start, speed, side, figure, scale, stride phase,
      // step length in metres, a spare, and the top's colour.
      walkers: new Float32Array(walkers),
      // Fifteen per walker: the top, bottom, skin, hair and accent colours.
      colors: new Float32Array(walkerColors),
      // Twelve per walker: step, arm swing, lean, speed drift (amount, rate, phase), pauses
      // (every, for, at) and wander across the pavement (amount, rate, phase).
      motion: new Float32Array(walkerMotion),
      // Twelve per person: what it is doing (see ACTIVITY) and that activity's numbers. A
      // talker or a stander holds its place, facing, group and habits; a browser the stretch
      // of route it ambles along and the side the shops are on; a walker in a pair its partner.
      activity: new Float32Array(activity),
      groups,
      clothing: typeof clothing === 'string' ? clothing : 'given',
      count: walkers.length / 12,
    }),
    style,
    lights: Object.freeze(lights.map((l) => Object.freeze(l))),
    // Where trees stand, in map coordinates (y north), for cameras and routes that must avoid them.
    trees: Object.freeze(treeSpots.map((t) => Object.freeze({ x: t.x, y: t.y, height: t.height }))),
    styles: Object.freeze(styles),
    junctions: Object.freeze(street.junctions),
    bounds: Object.freeze({
      x0: bounds.x0,
      z0: -bounds.y1,
      x1: bounds.x1,
      z1: -bounds.y0,
      top: osm.buildings.reduce((m, b) => Math.max(m, b.height), 0),
    }),
    waterLevel: WATER_LEVEL,
    palette,
    season,
    seed,
    interpretation,
    stats: Object.freeze({
      buildings: osm.buildings.length,
      triangles,
      props: propCount,
      lamps: lights.length,
      plants: coverCount,
      people: walkers.length / 12,
      inferred: Object.freeze(inferredCount),
    }),
    attribution: osm.attribution ?? null,
  });
}

/**
 * Where walker `index` of a city model stands at `time` seconds: {x, y, z, turn, phase, step,
 * speed}, with `turn` the heading in radians, `phase` the point in the stride, `step` the
 * length of a step in the figure's own metres and `speed` the pace in metres a second. Walkers go to the end of
 * their route, turn round and come back, so the answer is a pure function of time and a shot
 * can be scrubbed or re-rendered frame by frame.
 */
export function walkerPose(city, index, time) {
  const w = city.people.walkers,
    k = index * 12;
  assert(Number.isInteger(index) && index >= 0 && k < w.length, 'INVALID_CITY', 'There is no walker with that index.');
  const route = city.people.routes[w[k]],
    speed = w[k + 2],
    act = city.people.activity,
    kind = act?.length > index * 12 ? act[index * 12] : ACTIVITY.walk;
  // Someone standing, alone or in a group, keeps their place and shifts their weight; their
  // arms and head move with the conversation (see standingGesture).
  if (kind === ACTIVITY.talk || kind === ACTIVITY.stand) {
    const a = act.subarray(index * 12, index * 12 + 12);
    const g = standingGesture(a, index, act, city.seed, time);
    const turn = a[3] + g.turn,
      sx = -Math.sin(turn) * g.sway,
      sy = Math.cos(turn) * g.sway;
    const x = a[1] + sx,
      z = -(a[2] + sy);
    return {
      x,
      y: citySurfaceHeight(city, x, z, route.roadId),
      z,
      turn,
      phase: w[k + 6],
      step: 0,
      speed: 0,
      activity: kind === ACTIVITY.talk ? 'talk' : 'stand',
      arms: g.arms,
      head: g.head,
    };
  }
  // A browser ambles to and fro along a few metres of the route rather than the whole of it.
  const browsing = kind === ACTIVITY.browse,
    from = browsing ? act[index * 12 + 1] : 0,
    L = browsing ? act[index * 12 + 2] : route.length;
  // Each walker has its own habits (see personMotion). It stops now and then, and its speed
  // wanders round its own pace. Both are written as the time it has spent walking, in closed
  // form, so the answer still depends on nothing but the time asked for.
  const m = city.people.motion,
    j = index * 12,
    has = m && m.length > j + 11;
  let walked = time,
    moving = 1;
  if (has && m[j + 6] > 0) {
    // One stop per period: ease down over `ramp` seconds, stand, ease up again.
    const period = m[j + 6],
      ramp = 1.2,
      go = period - m[j + 7] - 2 * ramp,
      at = time + m[j + 8],
      turns = Math.floor(at / period),
      u = at - turns * period;
    const eased = (x) => {
      const q = Math.min(1, Math.max(0, x / ramp));
      return [q * q * (3 - 2 * q), ramp * (q * q * q - (q * q * q * q) / 2)];
    };
    let within = u;
    if (u > go) {
      const [down, downArea] = eased(u - go),
        [upSpeed, upArea] = eased(u - (period - ramp));
      within = go + Math.min(u - go, ramp) - downArea + upArea;
      moving = u < period - ramp ? 1 - down : upSpeed;
    }
    walked = turns * (go + ramp) + within;
  }
  let pace = moving,
    travelled = walked;
  if (has && m[j + 3] > 0) {
    const rate = m[j + 4],
      at = rate * walked + m[j + 5];
    travelled += (m[j + 3] / rate) * (Math.sin(at) - Math.sin(m[j + 5]));
    pace *= 1 + m[j + 3] * Math.cos(at);
  }
  // Fold the distance travelled into a there-and-back path.
  let d = (w[k + 1] + speed * travelled) % (2 * L);
  if (d < 0) d += 2 * L;
  const back = d > L;
  if (back) d = 2 * L - d;
  const along = d;
  d += from;
  const p = route.points,
    n = p.length / 3;
  let lo = 0,
    hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (p[mid * 3 + 2] <= d) lo = mid;
    else hi = mid;
  }
  const a = lo * 3,
    c = hi * 3,
    t = (d - p[a + 2]) / Math.max(1e-6, p[c + 2] - p[a + 2]);
  let dx = p[c] - p[a],
    dy = p[c + 1] - p[a + 1];
  const l = Math.hypot(dx, dy) || 1;
  dx /= l;
  dy /= l;
  const forward = speed > 0 !== back ? 1 : -1;
  let side = w[k + 3] + (has ? m[j + 9] * Math.sin(m[j + 10] * time + m[j + 11]) : 0);
  // Step round anyone standing beside the route: within two and a half metres of a group, move
  // across the pavement until there is room, and drift back once past.
  const spots = route.spots;
  if (spots?.length)
    for (let s = 0; s < spots.length; s += 3) {
      const gap = Math.abs(d - spots[s]);
      if (gap > 2.5) continue;
      const clear = spots[s + 2] + 0.45,
        off = side - spots[s + 1];
      if (Math.abs(off) >= clear) continue;
      const away = off !== 0 ? Math.sign(off) : -Math.sign(spots[s + 1]) || 1;
      side += (spots[s + 1] + away * clear - side) * (0.5 + 0.5 * Math.cos((Math.PI * gap) / 2.5));
    }
  // At the end of the route a walker turns round over a few steps, never flips on the spot.
  const fromEnd = Math.min(along, L - along),
    turning = fromEnd < 0.7 ? (1 - fromEnd / 0.7) * (Math.PI / 2) * (along > L / 2 === back ? -1 : 1) : 0;
  const stride = w[k + 7] > 0 ? w[k + 7] : 0.77 * Math.max(0.5, w[k + 5]);
  const x = p[a] + (p[c] - p[a]) * t - dy * side;
  const z = -(p[a + 1] + (p[c + 1] - p[a + 1]) * t + dx * side);
  let turn = Math.atan2(dy * forward, dx * forward) + turning;
  const head = [0, 0];
  if (browsing) {
    // While stopped, a browser turns to the shop window and looks in.
    const shop = act[index * 12 + 3],
      look = 0.85 * (1 - moving),
      toShop = Math.atan2(dx * shop, -dy * shop);
    turn += Math.atan2(Math.sin(toShop - turn), Math.cos(toShop - turn)) * look;
    head[1] = 0.12 * look;
  } else if (kind === ACTIVITY.pair) {
    // Companions talk as they walk, turning their heads to each other now and then.
    // Both of a pair hold the other's number.
    const mate = act[index * 12 + 1];
    if (mate >= 0 && mate * 12 < w.length) {
      const left = (w[mate * 12 + 3] - w[k + 3]) * forward > 0 ? 1 : -1;
      const talk = Math.max(0, Math.sin(time * 0.45 + index * 1.3)) ** 2;
      head[0] = left * 0.45 * talk;
    }
  }
  return {
    x,
    y: citySurfaceHeight(city, x, z, route.roadId),
    z,
    turn,
    // A walker who slows takes both shorter and slower steps, as people do: 30 percent of the
    // rhythm follows the clock and 70 percent the ground covered. Each step is exactly as long
    // as the ground covered in it, so the planted foot never slides, and a walker who stops
    // stands with both feet together.
    phase: w[k + 6] + (Math.abs(speed) * (0.3 * time + 0.7 * travelled) * Math.PI) / stride,
    step: (stride / Math.max(1e-6, w[k + 5])) * (pace / (0.3 + 0.7 * pace)),
    speed: Math.abs(speed) * pace,
    activity: browsing ? 'browse' : kind === ACTIVITY.pair ? 'pair' : 'walk',
    arms: NO_GESTURE,
    head,
  };
}
const NO_GESTURE = Object.freeze([0, 0, 0, 0, 0, 0]);

/**
 * Where drawable unit `index` of a city's traffic is at `time` seconds: {x, y, z, turn,
 * travelled, speed, visible}. A car or a bus is one unit and a tram is three, one per section.
 * `travelled` is the distance driven so far, for turning wheels, and `visible` is false while
 * the vehicle is outside the model. The answer is a pure function of time.
 */
export function vehiclePose(city, index, time) {
  assert(city?.traffic, 'INVALID_CITY', 'This city was built without traffic. Pass traffic: true to buildCity.');
  assert(
    Number.isInteger(index) && index >= 0 && index < city.traffic.count,
    'INVALID_CITY',
    'There is no vehicle with that index.',
  );
  const plan = city.traffic.plan;
  const st = trafficState(plan, time);
  const x = st.x[index],
    z = -st.y[index];
  return {
    x,
    y: citySurfaceHeight(city, x, z, plan.edges[st.edge[index]]?.road),
    z,
    turn: st.turn[index],
    travelled: st.travelled[index],
    speed: st.speed[index],
    visible: st.visible[index] === 1,
  };
}

/**
 * Look for broken things in a city model: geometry that is not a number, objects inside
 * buildings, in the water or in the carriageway, walkers in walls or in the road, vehicles off
 * the road or inside one another, anything beyond the edge of the model. Moving things are
 * sampled at `times` (seconds). Returns {ok, issues, checked}; see auditCityModel in audit.js.
 */
export function auditCity(city, spec = {}) {
  return auditCityModel(city, spec, walkerPose);
}
