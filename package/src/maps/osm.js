import { assert, number, options, text } from '../core/validate.js';
import { hsla, toHSLA } from '../color/space.js';
import { localProjection } from './index.js';

// Pure parsing of OpenStreetMap data, as returned by the Overpass API in JSON, into typed and
// projected street features: buildings, roads, water, green areas, trees, street lamps,
// crossings, street furniture, places of interest, barriers, rails, special areas, entrances and
// land-use zones. Nothing here fetches data. The caller downloads the text and passes it in.
//
// Every value that is guessed rather than read from a tag is listed in the feature's `inferred`
// array, so an author can see which parts of a model came from the map and which were made up.

const LIMITS = Object.freeze({
  textLength: 64 * 1024 * 1024,
  elements: 400_000,
  buildings: 20_000,
  roads: 20_000,
  areas: 5_000,
  points: 50_000,
  ringVertices: 4_000,
  totalVertices: 2_000_000,
  relationMembers: 2_000,
  treesPerRow: 2_000,
  containmentChecks: 20_000_000,
  amenities: 50_000,
  places: 20_000,
  barriers: 20_000,
  rails: 5_000,
  areaFeatures: 10_000,
  entrances: 50_000,
  zones: 2_000,
  summaryKinds: 64,
});
const FEATURE_GROUPS = Object.freeze([
  'buildings',
  'roads',
  'water',
  'green',
  'trees',
  'lamps',
  'crossings',
  'amenities',
  'places',
  'barriers',
  'rails',
  'areas',
  'entrances',
  'zones',
]);
const WATER_RING_VERTICES = 120_000;
export const osmLimits = LIMITS;

export const osmAttribution = Object.freeze({
  text: '© OpenStreetMap contributors',
  url: 'https://www.openstreetmap.org/copyright',
  license: 'Open Database License (ODbL) 1.0',
});

const FLOOR = 3.2; // metres per floor when nothing else is known
const GROUND_FLOOR_SHOP = 4.2;

// Building tag values grouped into the facade families of explainerkit/procedural/city.
const KINDS = Object.freeze({
  residential: [
    'house',
    'detached',
    'semidetached_house',
    'terrace',
    'bungalow',
    'cabin',
    'farm',
    'villa',
    'houseboat',
    'static_caravan',
    'residential',
  ],
  apartment: ['apartments', 'dormitory'],
  commercial: ['commercial', 'retail', 'shop', 'supermarket', 'kiosk', 'hotel', 'restaurant'],
  office: ['office'],
  industrial: [
    'industrial',
    'warehouse',
    'factory',
    'manufacture',
    'garage',
    'garages',
    'hangar',
    'storage_tank',
    'service',
    'shed',
    'barn',
    'parking',
    'carport',
    'transportation',
    'train_station',
  ],
  civic: [
    'civic',
    'public',
    'government',
    'school',
    'university',
    'college',
    'hospital',
    'townhall',
    'museum',
    'library',
    'fire_station',
    'kindergarten',
    'courthouse',
    'stadium',
    'sports_hall',
    'theatre',
  ],
  religious: [
    'church',
    'cathedral',
    'chapel',
    'mosque',
    'temple',
    'synagogue',
    'shrine',
    'monastery',
    'religious',
    'basilica',
  ],
});
const KIND_OF = new Map(Object.entries(KINDS).flatMap(([kind, values]) => values.map((v) => [v, kind])));
export const buildingKinds = Object.freeze(Object.keys(KINDS));

const ROOF_SHAPES = new Set([
  'flat',
  'gabled',
  'hipped',
  'pyramidal',
  'skillion',
  'half-hipped',
  'gambrel',
  'mansard',
  'dome',
  'onion',
  'round',
  'saltbox',
  'cone',
]);
// Shapes the city kit can draw. Others are mapped to the nearest one and marked inferred.
const ROOF_DRAWN = Object.freeze({
  'half-hipped': 'hipped',
  gambrel: 'gabled',
  mansard: 'hipped',
  saltbox: 'gabled',
  skillion: 'skillion',
  dome: 'pyramidal',
  onion: 'pyramidal',
  round: 'gabled',
  cone: 'pyramidal',
});
export const roofShapes = Object.freeze(['flat', 'gabled', 'hipped', 'pyramidal', 'skillion']);

// Road classes: default lanes, lane width in metres, and whether a pavement is usual in a town.
const ROADS = Object.freeze({
  motorway: [2, 3.6, false],
  trunk: [2, 3.5, false],
  primary: [2, 3.4, true],
  secondary: [2, 3.3, true],
  tertiary: [2, 3.1, true],
  unclassified: [2, 2.9, true],
  residential: [2, 2.8, true],
  living_street: [1, 3.2, false],
  service: [1, 3.2, false],
  busway: [1, 3.4, false],
  pedestrian: [1, 6, false],
  motorway_link: [1, 3.6, false],
  trunk_link: [1, 3.5, false],
  primary_link: [1, 3.4, true],
  secondary_link: [1, 3.3, true],
  tertiary_link: [1, 3.1, true],
  footway: [1, 2, false],
  path: [1, 1.5, false],
  cycleway: [1, 2, false],
  steps: [1, 2, false],
  track: [1, 3, false],
});
export const roadClasses = Object.freeze(Object.keys(ROADS));
const FOOT = new Set(['footway', 'path', 'cycleway', 'steps', 'pedestrian', 'track']);

// Colour words used in OSM colour tags. Anything else must be a hex code; other values are ignored.
const COLOUR_WORDS = Object.freeze({
  white: [40, 15, 93],
  black: [0, 0, 12],
  grey: [30, 4, 55],
  gray: [30, 4, 55],
  silver: [210, 6, 72],
  red: [6, 55, 42],
  darkred: [4, 50, 30],
  maroon: [354, 45, 30],
  brown: [22, 40, 32],
  darkbrown: [20, 35, 22],
  beige: [38, 40, 78],
  cream: [44, 55, 84],
  ivory: [48, 50, 88],
  tan: [30, 38, 62],
  sand: [38, 35, 70],
  yellow: [46, 70, 62],
  lightyellow: [48, 70, 78],
  ochre: [38, 60, 50],
  gold: [44, 70, 55],
  orange: [26, 75, 55],
  pink: [350, 45, 78],
  salmon: [10, 55, 68],
  green: [110, 25, 40],
  darkgreen: [130, 30, 25],
  lightgreen: [100, 30, 70],
  olive: [65, 30, 38],
  blue: [215, 45, 45],
  lightblue: [205, 45, 72],
  darkblue: [220, 45, 28],
  navy: [225, 45, 25],
  teal: [180, 35, 38],
  turquoise: [175, 45, 55],
  purple: [280, 25, 40],
  violet: [275, 30, 55],
  terracotta: [14, 55, 48],
  'light grey': [30, 4, 72],
  'light gray': [30, 4, 72],
  lightgrey: [30, 4, 72],
  lightgray: [30, 4, 72],
  'dark grey': [30, 4, 30],
  'dark gray': [30, 4, 30],
  darkgrey: [30, 4, 30],
  darkgray: [30, 4, 30],
  anthracite: [210, 6, 22],
  copper: [24, 55, 45],
  patina: [165, 30, 50],
  brick: [10, 50, 40],
});

// Street furniture and other point features, in the order their tags are tried.
export const amenityKinds = Object.freeze([
  'bench',
  'waste_basket',
  'bicycle_parking',
  'post_box',
  'telephone',
  'fountain',
  'drinking_water',
  'vending_machine',
  'clock',
  'recycling',
  'charging_station',
  'atm',
  'toilets',
  'shelter',
  'bus_stop',
  'tram_stop',
  'traffic_signals',
  'stop_sign',
  'give_way',
  'street_cabinet',
  'flagpole',
  'hydrant',
  'artwork',
  'statue',
  'memorial',
  'advertising',
  'bollard',
  'planter',
  'picnic_table',
  'utility_pole',
  'mast',
  'parking_meter',
  'bicycle_rental',
  'taxi',
  'information',
]);
// amenity=* values that are read as an amenity of the same name.
const AMENITY_SAME = new Set([
  'bench',
  'waste_basket',
  'bicycle_parking',
  'post_box',
  'telephone',
  'fountain',
  'drinking_water',
  'vending_machine',
  'clock',
  'recycling',
  'charging_station',
  'atm',
  'toilets',
  'shelter',
  'planter',
  'parking_meter',
  'bicycle_rental',
  'taxi',
]);
const MAN_MADE_POINTS = Object.freeze({
  street_cabinet: 'street_cabinet',
  flagpole: 'flagpole',
  mast: 'mast',
  utility_pole: 'utility_pole',
});

// Places of interest: a category and the tag key and values that put an element in it.
export const placeCategories = Object.freeze([
  'shop',
  'food',
  'office',
  'health',
  'education',
  'culture',
  'lodging',
  'service',
  'worship',
  'leisure',
]);
const PLACE_AMENITY = new Map(
  Object.entries({
    food: ['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'ice_cream', 'biergarten'],
    health: ['pharmacy', 'doctors', 'dentist', 'clinic', 'hospital', 'veterinary'],
    education: [
      'school',
      'kindergarten',
      'university',
      'college',
      'language_school',
      'music_school',
      'driving_school',
      'childcare',
    ],
    culture: ['theatre', 'cinema', 'arts_centre', 'library', 'community_centre', 'events_venue', 'planetarium'],
    service: [
      'bank',
      'post_office',
      'police',
      'fire_station',
      'townhall',
      'courthouse',
      'car_wash',
      'car_rental',
      'fuel',
      'bureau_de_change',
      'marketplace',
      'social_facility',
      'embassy',
      'coworking_space',
    ],
    worship: ['place_of_worship'],
    leisure: ['nightclub', 'casino', 'gambling'],
  }).flatMap(([category, values]) => values.map((v) => [v, category])),
);
const PLACE_TOURISM = new Map(
  Object.entries({
    culture: ['museum', 'gallery'],
    lodging: ['hotel', 'hostel', 'guest_house', 'motel', 'apartment', 'chalet'],
  }).flatMap(([category, values]) => values.map((v) => [v, category])),
);
const PLACE_LEISURE = new Set([
  'fitness_centre',
  'sports_centre',
  'sports_hall',
  'dance',
  'sauna',
  'amusement_arcade',
  'bowling_alley',
  'escape_game',
  'adult_gaming_centre',
  'hackerspace',
]);

// Barrier lines and their usual height in metres when no height is tagged.
const BARRIER_HEIGHT = Object.freeze({
  hedge: 1.2,
  wall: 1.6,
  fence: 1.4,
  retaining_wall: 1.2,
  guard_rail: 0.8,
  city_wall: 5,
  railing: 1.0,
  kerb: 0.15,
});
const RAIL_KINDS = new Set(['tram', 'rail', 'light_rail', 'narrow_gauge']);

export const areaKinds = Object.freeze([
  'parking',
  'pitch',
  'playground',
  'plaza',
  'platform',
  'sand',
  'beach',
  'flowerbed',
  'garden',
  'allotments',
  'cemetery',
  'farmland',
  'orchard',
  'construction',
  'swimming_pool',
  'dog_park',
  'schoolyard',
  'bridge',
]);
const ZONE_KINDS = new Set([
  'residential',
  'commercial',
  'retail',
  'industrial',
  'education',
  'religious',
  'military',
  'railway',
]);
const ZONE_BUILDING = Object.freeze({ commercial: 'commercial', retail: 'commercial', industrial: 'industrial' });

const COMPASS = Object.freeze(
  Object.fromEntries(
    ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'].map((w, k) => [
      w,
      k * 22.5,
    ]),
  ),
);

// --------------------------------------------------------------------------- tag reading

const tagText = (tags, key, max = 255) => {
  const v = tags[key];
  return typeof v === 'string' && v.length <= max ? v.trim() : undefined;
};
/** A length in metres from a tag such as "12", "12 m", "12.5m", "40'" or "40 ft". */
export function parseLength(value) {
  if (typeof value !== 'string' || value.length > 32) return undefined;
  const s = value.trim().toLowerCase().replace(',', '.');
  let m = /^(-?\d+(?:\.\d+)?)\s*(m|metres|meters|metre|meter)?$/.exec(s);
  if (m) return Number(m[1]);
  m = /^(\d+(?:\.\d+)?)\s*(ft|feet|')$/.exec(s);
  if (m) return Number(m[1]) * 0.3048;
  m = /^(\d+)'\s*(\d+(?:\.\d+)?)"$/.exec(s);
  if (m) return Number(m[1]) * 0.3048 + Number(m[2]) * 0.0254;
  return undefined;
}
/** A count such as floors or lanes. "3;4" (several values) gives the largest. */
export function parseCount(value) {
  if (typeof value !== 'string' || value.length > 32) return undefined;
  const parts = value.split(';').map((p) => p.trim().replace(',', '.'));
  let best;
  for (const p of parts) {
    if (!/^\d+(?:\.\d+)?$/.test(p)) return undefined;
    best = Math.max(best ?? 0, Number(p));
  }
  return best;
}
/** An OSM colour tag as an HSLA string, or undefined for values that are not colours. */
export function parseColour(value) {
  if (typeof value !== 'string' || value.length > 32) return undefined;
  const s = value.trim().toLowerCase();
  if (/^#(?:[\da-f]{3}|[\da-f]{6})$/.test(s)) {
    const { h, s: sat, l } = toHSLA(s);
    return hsla(Math.round(h), Math.round(sat), Math.round(l));
  }
  const words = s.replace(/[_-]/g, ' ');
  const word = Object.hasOwn(COLOUR_WORDS, s)
    ? COLOUR_WORDS[s]
    : Object.hasOwn(COLOUR_WORDS, words)
      ? COLOUR_WORDS[words]
      : undefined;
  return word ? hsla(...word) : undefined;
}
/**
 * A direction in degrees clockwise from north, from a tag such as "45", "270.5", "45;225" (the
 * first value is read) or a compass word such as N, NE or NNW. Other values give undefined.
 */
export function parseDirection(value) {
  if (typeof value !== 'string' || value.length > 32) return undefined;
  const s = value.split(';')[0].trim();
  if (/^-?\d+(?:\.\d+)?$/.test(s)) {
    const d = Number(s);
    return Math.abs(d) <= 3600 ? ((d % 360) + 360) % 360 : undefined;
  }
  const word = s.toUpperCase();
  return Object.hasOwn(COMPASS, word) ? COMPASS[word] : undefined;
}
/**
 * A construction year from a tag such as "1905", "1905-06-12", "~1900" or "C19" (the middle of the
 * century, 1850). Other text gives its first four-digit year, so "early 1900s" gives 1900, and
 * text without one, such as "early 20th century", gives undefined.
 */
export function parseYear(value) {
  if (typeof value !== 'string' || value.length > 64) return undefined;
  const s = value.trim();
  let m = /^~?\s*(\d{4})(?:-\d{2}(?:-\d{2})?)?$/.exec(s);
  if (m) return finite(Number(m[1]), 1000, 2100);
  m = /^~?\s*C(\d{1,2})$/i.exec(s);
  if (m) return finite((Number(m[1]) - 1) * 100 + 50, 1000, 2100);
  m = /(?:^|\D)(\d{4})(?!\d)/.exec(s);
  return m ? finite(Number(m[1]), 1000, 2100) : undefined;
}
// A speed limit in km/h read from values such as 50, 50 km/h or 30 mph. "none", "walk" and zone codes give undefined.
function parseSpeed(value) {
  if (typeof value !== 'string' || value.length > 32) return undefined;
  const m = /^(\d+(?:\.\d+)?)\s*(mph|km\/h|kmh|kph)?$/i.exec(value.split(';')[0].trim());
  if (!m) return undefined;
  const v = Number(m[1]) * (m[2]?.toLowerCase() === 'mph' ? 1.609344 : 1);
  return finite(v, 1, 300);
}
// yes/no tags as booleans. Values in `alsoYes` count as yes, and anything else gives undefined.
const yesNo = (v, alsoYes = [], alsoNo = []) =>
  v === 'yes' || alsoYes.includes(v) ? true : v === 'no' || alsoNo.includes(v) ? false : undefined;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const finite = (v, lo, hi) => (v !== undefined && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined);

// ------------------------------------------------------------------------- geometry

function ringArea(ring) {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const p = ring[i],
      q = ring[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}
function centroid(ring) {
  let x = 0,
    y = 0;
  for (const p of ring) {
    x += p.x;
    y += p.y;
  }
  return { x: x / ring.length, y: y / ring.length };
}
function extent(ring) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const p of ring) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x0, y0, x1, y1 };
}
const within = (p, b) => p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;
function pointInRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
// The shortest distance from a point to the edges of a closed ring.
function ringDistance(p, ring) {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j],
      b = ring[i],
      dx = b.x - a.x,
      dy = b.y - a.y,
      len = dx * dx + dy * dy;
    const t = len > 0 ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len, 0, 1) : 0;
    best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
  }
  return best;
}
// A grid over the extents of rings, grown by `margin` metres, so a point is tested only against
// rings whose extent covers it. Every index entry counts against a fixed budget.
function ringGrid(items, ringOf, cell, margin) {
  const grid = new Map();
  let entries = 0;
  const boxes = new Map();
  for (const item of items) {
    const e = extent(ringOf(item));
    const box = { x0: e.x0 - margin, y0: e.y0 - margin, x1: e.x1 + margin, y1: e.y1 + margin };
    boxes.set(item, box);
    for (let i = Math.floor(box.x0 / cell); i <= Math.floor(box.x1 / cell); i++)
      for (let j = Math.floor(box.y0 / cell); j <= Math.floor(box.y1 / cell); j++) {
        assert(++entries <= 1_000_000, 'RESOURCE_LIMIT', 'Outlines cover too large an area to index.');
        const key = `${i},${j}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(item);
      }
  }
  return (p) =>
    (grid.get(`${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`) ?? []).filter((item) =>
      within(p, boxes.get(item)),
    );
}
// Drop the closing duplicate and consecutive duplicates, and orient: outer rings counter-clockwise.
function cleanRing(points, ccw) {
  const out = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.01) out.push(p);
  }
  while (out.length > 1 && Math.hypot(out[0].x - out.at(-1).x, out[0].y - out.at(-1).y) <= 0.01) out.pop();
  if (out.length < 3) return null;
  const area = ringArea(out);
  if (Math.abs(area) < 0.5) return null;
  if (area > 0 !== ccw) out.reverse();
  return Object.freeze(out.map((p) => Object.freeze(p)));
}

// --------------------------------------------------------------------------- parsing

/**
 * Parse Overpass JSON text into projected street features.
 *
 * `bbox` ({south, west, north, east} in degrees) keeps only features that reach into the box and
 * sets the projection centre; `center` ({lon, lat}) overrides that centre. Coordinates come back
 * in metres east (x) and north (y) of the centre. Every input is bounded; see `osmLimits`.
 */
export function parseOverpass(source, spec = {}) {
  options(spec, ['bbox', 'center', 'include'], 'parseOverpass');
  text(source, 'Overpass text', LIMITS.textLength);
  let data;
  try {
    data = JSON.parse(source);
  } catch {
    assert(false, 'INVALID_OSM', 'The Overpass response is not JSON. Ask Overpass for [out:json].');
  }
  assert(
    data && typeof data === 'object' && Array.isArray(data.elements),
    'INVALID_OSM',
    'Overpass JSON needs an elements list.',
  );
  const elements = data.elements;
  assert(
    elements.length <= LIMITS.elements,
    'RESOURCE_LIMIT',
    `At most ${LIMITS.elements} OSM elements are accepted. Ask for a smaller area.`,
  );

  let bbox = null;
  if (spec.bbox !== undefined) {
    options(spec.bbox, ['south', 'west', 'north', 'east'], 'bbox');
    bbox = {
      south: number(spec.bbox.south, 'bbox south', -85, 85),
      west: number(spec.bbox.west, 'bbox west', -180, 180),
      north: number(spec.bbox.north, 'bbox north', -85, 85),
      east: number(spec.bbox.east, 'bbox east', -180, 180),
    };
    assert(
      bbox.north > bbox.south && bbox.east > bbox.west,
      'INVALID_BBOX',
      'The box needs north above south and east of west.',
    );
    assert(
      bbox.north - bbox.south <= 0.2 && bbox.east - bbox.west <= 0.3,
      'RESOURCE_LIMIT',
      'A street box spans at most 0.2 degrees of latitude and 0.3 of longitude.',
    );
  }
  if (spec.include !== undefined)
    assert(
      Array.isArray(spec.include) &&
        spec.include.length <= FEATURE_GROUPS.length &&
        spec.include.every((g) => FEATURE_GROUPS.includes(g)),
      'INVALID_OPTIONS',
      `include lists feature groups from: ${FEATURE_GROUPS.join(', ')}.`,
    );
  const include = new Set(spec.include ?? FEATURE_GROUPS);

  // Nodes by id, for responses that list ways by node references rather than inline geometry.
  const nodes = new Map();
  const ways = new Map();
  let vertexBudget = LIMITS.totalVertices;
  const spend = (n) => {
    vertexBudget -= n;
    assert(
      vertexBudget >= 0,
      'RESOURCE_LIMIT',
      `At most ${LIMITS.totalVertices} vertices are read. Ask for a smaller area.`,
    );
  };
  // Point-in-ring tests and edge distances (holes, building parts, zones and the buildings that
  // places and entrances belong to) visit ring vertices. Their total is bounded too.
  let containmentBudget = LIMITS.containmentChecks;
  const spendChecks = (n) => {
    containmentBudget -= n;
    assert(
      containmentBudget >= 0,
      'RESOURCE_LIMIT',
      `At most ${LIMITS.containmentChecks} vertex visits are spent matching holes, building parts, zones and buildings.`,
    );
  };
  const inside = (p, ring) => {
    spendChecks(ring.length);
    return pointInRing(p, ring);
  };
  const okId = (id) => Number.isSafeInteger(id) && id > 0;
  const isTags = (t) => t === undefined || (t && typeof t === 'object' && !Array.isArray(t));
  for (const e of elements) {
    if (!e || typeof e !== 'object' || !okId(e.id) || !isTags(e.tags)) continue;
    if (e.type === 'node' && Number.isFinite(e.lat) && Number.isFinite(e.lon)) nodes.set(e.id, e);
    else if (e.type === 'way') ways.set(e.id, e);
  }
  let center = spec.center;
  if (center !== undefined) options(center, ['lon', 'lat'], 'center');
  else if (bbox) center = { lon: (bbox.west + bbox.east) / 2, lat: (bbox.south + bbox.north) / 2 };
  else {
    // The middle of everything given.
    let s = Infinity,
      w = Infinity,
      n = -Infinity,
      ea = -Infinity;
    const grow = (lat, lon) => {
      s = Math.min(s, lat);
      n = Math.max(n, lat);
      w = Math.min(w, lon);
      ea = Math.max(ea, lon);
    };
    const ok = (p) =>
      p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 85 && Math.abs(p.lon) <= 180;
    for (const e of elements) {
      if (e?.type === 'node' && ok(e)) grow(e.lat, e.lon);
      if (Array.isArray(e?.geometry) && ok(e.geometry[0])) grow(e.geometry[0].lat, e.geometry[0].lon);
    }
    assert(Number.isFinite(s), 'INVALID_OSM', 'The response contains no positions.');
    center = { lon: (w + ea) / 2, lat: (s + n) / 2 };
  }
  const projection = localProjection({ center });
  const inBox = (lat, lon) => !bbox || (lat >= bbox.south && lat <= bbox.north && lon >= bbox.west && lon <= bbox.east);

  // Positions of a way, from inline geometry or node references, with whether any reaches the
  // box, or null if any position is missing or invalid.
  const projectWay = (way, maxVertices = LIMITS.ringVertices) => {
    let list;
    if (Array.isArray(way.geometry)) list = way.geometry;
    else if (Array.isArray(way.nodes)) list = way.nodes;
    else return null;
    if (list.length < 2 || list.length > maxVertices) return null;
    spend(list.length);
    const pts = [];
    let reaches = false;
    for (const item of list) {
      const g = list === way.geometry ? item : nodes.get(item);
      if (!g || !Number.isFinite(g.lat) || !Number.isFinite(g.lon) || Math.abs(g.lat) > 85 || Math.abs(g.lon) > 180)
        return null;
      if (inBox(g.lat, g.lon)) reaches = true;
      const p = projection.project(g.lon, g.lat);
      pts.push({ x: p.x, y: p.y });
    }
    return { pts, reaches };
  };
  const wayPoints = (way) => {
    const got = projectWay(way);
    return got && got.reaches ? got.pts : null;
  };
  // Join the member ways of a multipolygon into closed rings.
  const assemble = (members, maxVertices) => {
    const open = members.map((m) => m.slice());
    const rings = [];
    const same = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 0.05;
    let guard = 0;
    while (open.length && guard++ < LIMITS.relationMembers * 4) {
      let ring = open.shift();
      while (!same(ring[0], ring.at(-1))) {
        spendChecks(open.length);
        const k = open.findIndex((w) => same(w[0], ring.at(-1)) || same(w.at(-1), ring.at(-1)));
        if (k < 0) break;
        const next = open.splice(k, 1)[0];
        if (ring.length + next.length - 1 > maxVertices) break;
        if (!same(next[0], ring.at(-1))) next.reverse();
        for (let j = 1; j < next.length; j++) ring.push(next[j]);
      }
      if (same(ring[0], ring.at(-1))) rings.push(ring);
    }
    return rings;
  };

  /** @type {{[group: string]: any[]}} */
  const out = Object.fromEntries(FEATURE_GROUPS.map((g) => [g, []]));
  const cap = (list, limit, what) =>
    assert(list.length < limit, 'RESOURCE_LIMIT', `At most ${limit} ${what} are read. Ask for a smaller area.`);

  // Each element's positions and polygons are worked out once, however many lists read them.
  const pointsCache = new Map();
  const pointsOf = (e) => {
    if (!pointsCache.has(e)) pointsCache.set(e, wayPoints(e));
    return pointsCache.get(e);
  };
  const polygonCache = new Map();
  const polygonsOfCached = (e) => {
    if (!polygonCache.has(e)) polygonCache.set(e, polygonsOf(e));
    return polygonCache.get(e);
  };
  // Whether a way starts and ends at the same position. Multipolygon rings are always closed.
  const closed = (e) => {
    if (e.type !== 'way') return e.type === 'relation';
    if (Array.isArray(e.nodes)) return e.nodes.length >= 4 && e.nodes[0] === e.nodes.at(-1);
    if (!Array.isArray(e.geometry) || e.geometry.length < 4) return false;
    const a = e.geometry[0],
      b = e.geometry.at(-1);
    return a?.lat === b?.lat && a?.lon === b?.lon;
  };
  const areaPolygons = (e) => (closed(e) ? polygonsOfCached(e) : []);

  // With `overlap`, an area also counts as reaching the box when its extent overlaps the box
  // without any of its positions lying inside, as a land-use zone around the whole box does.
  const boxXY = bbox && boxMetres(projection, bbox);
  const overlapsBox = (pts) => {
    if (!boxXY) return true;
    const e = extent(pts);
    return e.x0 <= boxXY.x1 && e.x1 >= boxXY.x0 && e.y0 <= boxXY.y1 && e.y1 >= boxXY.y0;
  };
  const polygonsOf = (e, overlap = false, maxVertices = LIMITS.ringVertices) => {
    if (e.type === 'way') {
      let pts;
      if (overlap) {
        const got = projectWay(e, maxVertices);
        pts = got && (got.reaches || overlapsBox(got.pts)) ? got.pts : null;
      } else pts = pointsOf(e);
      if (!pts) return [];
      const ring = cleanRing(pts, true);
      return ring ? [{ ring, holes: [] }] : [];
    }
    // Only multipolygon relations describe an area. Other relations that carry area tags, such
    // as type=building, group ways that are already read on their own.
    if (e.type !== 'relation' || !Array.isArray(e.members)) return [];
    if (e.tags.type !== undefined && e.tags.type !== 'multipolygon') return [];
    assert(
      e.members.length <= LIMITS.relationMembers,
      'RESOURCE_LIMIT',
      `A relation may have at most ${LIMITS.relationMembers} members.`,
    );
    const outer = [],
      inner = [];
    let reaches = false;
    for (const m of e.members) {
      if (!m || m.type !== 'way') continue;
      const way = Array.isArray(m.geometry) ? m : ways.get(m.ref);
      if (!way) continue;
      const got = projectWay({ geometry: way.geometry, nodes: way.nodes }, maxVertices);
      if (!got) continue;
      reaches ||= got.reaches || (overlap && m.role !== 'inner' && overlapsBox(got.pts));
      (m.role === 'inner' ? inner : outer).push(got.pts);
    }
    if (!reaches && !overlap) return [];
    const outers = assemble(outer, maxVertices)
      .map((r) => cleanRing(r, true))
      .filter((ring) => ring && (!overlap || overlapsBox(ring)));
    const inners = assemble(inner, maxVertices)
      .map((r) => cleanRing(r, false))
      .filter((ring) => ring && (!overlap || overlapsBox(ring)));
    const boxes = outers.map(extent);
    return outers.map((ring, k) => ({
      ring,
      holes: inners.filter((h) => within(h[0], boxes[k]) && inside(h[0], ring)),
    }));
  };

  const usable = (e) => e && typeof e === 'object' && okId(e.id) && isTags(e.tags) && e.tags;

  // Land-use zones are read first, because a building without a specific kind takes its default
  // kind from the zone it stands in. They are read whenever buildings are, so the buildings do not
  // depend on whether the zones themselves are returned.
  const zones = [];
  if (include.has('zones') || include.has('buildings')) {
    const seenZones = new Set();
    for (const e of elements) {
      if (!usable(e) || (e.type !== 'way' && e.type !== 'relation')) continue;
      const kind = e.tags.landuse;
      if (typeof kind !== 'string' || !ZONE_KINDS.has(kind)) continue;
      const identity = `${e.type}/${e.id}`;
      if (seenZones.has(identity)) continue;
      seenZones.add(identity);
      for (const poly of closed(e) ? polygonsOf(e, true) : []) {
        cap(zones, LIMITS.zones, 'zones');
        zones.push(Object.freeze({ id: e.id, kind, ring: poly.ring, holes: Object.freeze(poly.holes) }));
      }
    }
  }
  const zonesAt = zones.length ? ringGrid(zones, (z) => z.ring, 128, 0) : () => [];
  const zoneKindAt = (ring) => {
    const c = centroid(ring);
    for (const z of zonesAt(c))
      if (Object.hasOwn(ZONE_BUILDING, z.kind) && inside(c, z.ring) && !z.holes.some((h) => inside(c, h)))
        return ZONE_BUILDING[z.kind];
    return undefined;
  };

  // The lists added beside the original seven. An element may appear in several of them, and
  // reading them never changes what the original lists contain.
  const readExtras = (e, tags) => {
    const isNode = e.type === 'node' && Number.isFinite(e.lat) && Number.isFinite(e.lon);
    const p = isNode && inBox(e.lat, e.lon) ? projection.project(e.lon, e.lat) : null;
    if (isNode && !p) return;
    if (p && include.has('amenities')) {
      const got = amenityOf(tags);
      if (got) {
        cap(out.amenities, LIMITS.amenities, 'amenities');
        out.amenities.push(readAmenity(e, tags, p, got));
      }
    }
    if (include.has('places')) {
      const got = placeOf(tags);
      if (got) {
        let at = p;
        const inferred = [];
        if (!p) {
          const polys = areaPolygons(e);
          if (polys.length) {
            const largest = polys.reduce((a, b) => (Math.abs(ringArea(b.ring)) > Math.abs(ringArea(a.ring)) ? b : a));
            at = centroid(largest.ring);
            inferred.push('position');
          }
        }
        if (at) {
          cap(out.places, LIMITS.places, 'places');
          const own = !p && typeof tags.building === 'string' && tags.building !== 'no';
          out.places.push({ feature: readPlace(e, tags, at, got, own ? e.id : undefined, inferred), p });
        }
      }
    }
    if (p && include.has('entrances')) {
      const kind = tagText(tags, 'entrance', 32) ?? (tagText(tags, 'door', 32) === undefined ? undefined : 'yes');
      if (kind !== undefined && kind !== 'no' && tags.door !== 'no') {
        cap(out.entrances, LIMITS.entrances, 'entrances');
        out.entrances.push({
          feature: {
            id: e.id,
            x: p.x,
            y: p.y,
            kind,
            level: tagText(tags, 'level', 16),
            wheelchair: tagText(tags, 'wheelchair', 16),
            inferred: Object.freeze([]),
          },
          p,
        });
      }
    }
    if (e.type !== 'way' && e.type !== 'relation') return;
    if (include.has('barriers') && e.type === 'way' && Object.hasOwn(BARRIER_HEIGHT, tags.barrier)) {
      const pts = pointsOf(e);
      if (pts) {
        cap(out.barriers, LIMITS.barriers, 'barriers');
        const height = finite(parseLength(tags.height), 0.05, 30);
        out.barriers.push(
          Object.freeze({
            id: e.id,
            kind: tags.barrier,
            points: Object.freeze(pts.map((q) => Object.freeze(q))),
            height: height ?? BARRIER_HEIGHT[tags.barrier],
            closed: closed(e),
            material: tagText(tags, 'material', 32),
            inferred: Object.freeze(height === undefined ? ['height'] : []),
          }),
        );
      }
    }
    if (include.has('rails') && e.type === 'way' && RAIL_KINDS.has(tags.railway)) {
      const tunnel = tags.tunnel !== undefined && tags.tunnel !== 'no';
      const pts = tunnel && tags.service === 'yard' ? null : pointsOf(e);
      if (pts) {
        cap(out.rails, LIMITS.rails, 'rails');
        out.rails.push(readRail(e, tags, pts, tunnel));
      }
    }
    if (include.has('areas')) {
      const kind = areaKindOf(tags);
      if (kind)
        for (const poly of areaPolygons(e)) {
          cap(out.areas, LIMITS.areaFeatures, 'special areas');
          out.areas.push(
            Object.freeze({
              id: e.id,
              kind,
              ring: poly.ring,
              holes: Object.freeze(poly.holes),
              surface: tagText(tags, 'surface', 32),
              sport: tagText(tags, 'sport', 32),
              name: tagText(tags, 'name', 128),
              ...(kind === 'bridge'
                ? {
                    layer: bridgeLayer(tags, 1),
                    structure: tagText(tags, 'bridge:structure', 32),
                  }
                : {}),
              capacity: finite(parseCount(tags.capacity), 0, 100_000),
              inferred: Object.freeze([]),
            }),
          );
        }
    }
  };

  const seen = new Set();
  for (const e of elements) {
    if (!usable(e)) continue;
    // An element listed twice is read once.
    const identity = `${e.type}/${e.id}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const tags = e.tags;
    readExtras(e, tags);
    const isPart = typeof tags['building:part'] === 'string' && tags['building:part'] !== 'no';
    if (
      include.has('buildings') &&
      (e.type === 'way' || e.type === 'relation') &&
      ((tags.building && tags.building !== 'no') || isPart)
    ) {
      for (const poly of polygonsOfCached(e)) {
        cap(out.buildings, LIMITS.buildings, 'buildings');
        out.buildings.push(readBuilding(e, tags, poly, isPart, zoneKindAt));
      }
      continue;
    }
    if (
      include.has('roads') &&
      e.type === 'way' &&
      typeof tags.highway === 'string' &&
      Object.hasOwn(ROADS, tags.highway) &&
      tags.area !== 'yes'
    ) {
      const pts = pointsOf(e);
      if (pts) {
        cap(out.roads, LIMITS.roads, 'roads');
        out.roads.push(readRoad(e, tags, pts));
      }
      continue;
    }
    const water =
      tags.natural === 'water' ||
      tags.waterway === 'riverbank' ||
      tags.landuse === 'basin' ||
      tags.landuse === 'reservoir';
    if (include.has('water') && water && (e.type === 'way' || e.type === 'relation')) {
      const elevation = finite(parseLength(tags.ele), -12000, 12000);
      for (const poly of polygonsOf(e, true, WATER_RING_VERTICES)) {
        cap(out.water, LIMITS.areas, 'water areas');
        out.water.push(
          Object.freeze({
            id: e.id,
            kind: tagText(tags, 'water') ?? 'water',
            ...poly,
            name: tagText(tags, 'name'),
            ...(elevation === undefined ? {} : { elevation }),
          }),
        );
      }
      continue;
    }
    const green = isGreen(tags);
    if (include.has('green') && green && (e.type === 'way' || e.type === 'relation')) {
      for (const poly of polygonsOfCached(e)) {
        cap(out.green, LIMITS.areas, 'green areas');
        const kind =
          tags.natural === 'wood' || tags.landuse === 'forest'
            ? 'wood'
            : tags.leisure === 'park' || tags.leisure === 'garden'
              ? 'park'
              : 'grass';
        out.green.push(Object.freeze({ id: e.id, kind, ...poly }));
      }
      continue;
    }
    if (e.type === 'node' && Number.isFinite(e.lat) && Number.isFinite(e.lon) && inBox(e.lat, e.lon)) {
      const p = projection.project(e.lon, e.lat);
      if (include.has('trees') && tags.natural === 'tree') {
        cap(out.trees, LIMITS.points, 'trees');
        out.trees.push(readTree(e, tags, p));
      } else if (include.has('lamps') && tags.highway === 'street_lamp') {
        cap(out.lamps, LIMITS.points, 'lamps');
        const height = finite(parseLength(tags['lamp_mount'] === 'wall' ? undefined : tags.height), 2, 30);
        out.lamps.push(
          Object.freeze({
            id: e.id,
            x: p.x,
            y: p.y,
            height: height ?? 6,
            mount: tagText(tags, 'lamp_mount') ?? 'pole',
            inferred: Object.freeze(height === undefined ? ['height'] : []),
          }),
        );
      } else if (include.has('crossings') && (tags.highway === 'crossing' || tags.railway === 'crossing')) {
        cap(out.crossings, LIMITS.points, 'crossings');
        const raw = tagText(tags, 'crossing:markings') ?? tagText(tags, 'crossing');
        const kind =
          tags.crossing_ref === 'zebra'
            ? 'zebra'
            : raw === undefined || raw === 'no' || raw === 'unmarked' || raw === 'informal'
              ? 'unmarked'
              : raw === 'traffic_signals'
                ? 'signals'
                : 'zebra';
        out.crossings.push(
          Object.freeze({
            id: e.id,
            x: p.x,
            y: p.y,
            kind,
            island: yesNo(tags['crossing:island']),
            tactile: yesNo(tags.tactile_paving, ['contrasted', 'primitive'], ['incorrect']),
            inferred: Object.freeze(raw === undefined && tags.crossing_ref === undefined ? ['kind'] : []),
          }),
        );
      }
    } else if (include.has('trees') && e.type === 'way' && tags.natural === 'tree_row') {
      const pts = pointsOf(e);
      if (pts)
        for (const p of spaced(pts, 7)) {
          cap(out.trees, LIMITS.points, 'trees');
          out.trees.push(readTree({ id: e.id }, tags, p, ['position']));
        }
    }
  }
  const buildings = replaceOutlines(out.buildings, inside);

  // Places and entrances drawn as nodes are linked to the building they stand in or beside.
  const near = buildings.length ? ringGrid(buildings, (b) => b.ring, 32, 2) : () => [];
  const edgeDistance = (p, ring) => {
    spendChecks(ring.length);
    return ringDistance(p, ring);
  };
  const buildingAt = (p, reach, contain) => {
    let best,
      bestArea = Infinity,
      bestDistance = Infinity;
    for (const b of near(p)) {
      if (contain && inside(p, b.ring)) {
        if (bestDistance > 0 || b.area < bestArea) [best, bestArea, bestDistance] = [b, b.area, 0];
      } else if (bestDistance > 0) {
        const d = edgeDistance(p, b.ring);
        if (d <= reach && d < bestDistance) [best, bestDistance] = [b, d];
      }
    }
    return best?.id;
  };
  const link = (pending, reach, contain) =>
    pending.map(({ feature, p }) => {
      if (!p) return Object.freeze(feature);
      const building = buildingAt(p, reach, contain);
      return Object.freeze(
        building === undefined
          ? feature
          : { ...feature, building, inferred: Object.freeze([...feature.inferred, 'building']) },
      );
    });

  return Object.freeze({
    projection,
    center: Object.freeze({ ...projection.center }),
    bbox: bbox && Object.freeze({ ...bbox, ...boxMetres(projection, bbox) }),
    buildings: Object.freeze(buildings),
    roads: Object.freeze(out.roads),
    water: Object.freeze(out.water),
    green: Object.freeze(out.green),
    trees: Object.freeze(out.trees),
    lamps: Object.freeze(out.lamps),
    crossings: Object.freeze(out.crossings),
    amenities: Object.freeze(out.amenities),
    places: Object.freeze(link(out.places, 2, true)),
    barriers: Object.freeze(out.barriers),
    rails: Object.freeze(out.rails),
    areas: Object.freeze(out.areas),
    entrances: Object.freeze(link(out.entrances, 1.5, false)),
    zones: Object.freeze(include.has('zones') ? zones : []),
    attribution: osmAttribution,
    timestamp:
      typeof data.osm3s?.timestamp_osm_base === 'string' ? data.osm3s.timestamp_osm_base.slice(0, 32) : undefined,
  });
}

function boxMetres(projection, bbox) {
  const a = projection.project(bbox.west, bbox.south),
    b = projection.project(bbox.east, bbox.north);
  return { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
}

// Points every `step` metres along a line, stopping at LIMITS.treesPerRow points.
function spaced(points, step) {
  const out = [];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      len = Math.hypot(b.x - a.x, b.y - a.y);
    for (let d = carry; d < len; d += step) {
      if (out.length >= LIMITS.treesPerRow) return out;
      out.push({ x: a.x + ((b.x - a.x) * d) / len, y: a.y + ((b.y - a.y) * d) / len });
    }
    carry = (((carry - len) % step) + step) % step;
  }
  return out;
}

// Building parts replace the outline they belong to: an outline is dropped when the centre of
// any part lies inside it. Outlines are indexed on a grid so each part is tested only against
// outlines whose extent covers it.
function replaceOutlines(buildings, inside) {
  const parts = buildings.filter((b) => b.part);
  if (!parts.length) return buildings;
  const CELL = 64;
  const grid = new Map();
  let entries = 0;
  const outlines = buildings.filter((b) => !b.part);
  const boxes = new Map();
  for (const b of outlines) {
    const e = extent(b.ring);
    boxes.set(b, e);
    for (let i = Math.floor(e.x0 / CELL); i <= Math.floor(e.x1 / CELL); i++)
      for (let j = Math.floor(e.y0 / CELL); j <= Math.floor(e.y1 / CELL); j++) {
        assert(++entries <= 1_000_000, 'RESOURCE_LIMIT', 'Building outlines cover too large an area to index.');
        const key = `${i},${j}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(b);
      }
  }
  const replaced = new Set();
  for (const p of parts) {
    const c = centroid(p.ring);
    for (const b of grid.get(`${Math.floor(c.x / CELL)},${Math.floor(c.y / CELL)}`) ?? [])
      if (!replaced.has(b) && within(c, boxes.get(b)) && inside(c, b.ring)) replaced.add(b);
  }
  return buildings.filter((b) => !replaced.has(b));
}

// A stable 0..1 value from an OSM id, so inferred values do not change between runs.
const idRandom = (id, salt) => {
  let h = (Math.imul(id % 2147483647, 2654435761) ^ Math.imul(salt + 1, 40503)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

function readBuilding(e, tags, poly, isPart, zoneKindAt) {
  const inferred = [];
  const value = isPart ? tags['building:part'] : tags.building;
  let kind = KIND_OF.get(value);
  if (tags.amenity === 'place_of_worship') kind = 'religious';
  else if (!kind && (tags.shop || tags.amenity === 'restaurant' || tags.amenity === 'cafe' || tags.amenity === 'bar'))
    kind = 'commercial';
  else if (!kind && tags.office) kind = 'office';
  const area = Math.abs(ringArea(poly.ring));
  let levels = finite(parseCount(tags['building:levels']), 0, 200);
  const height = finite(parseLength(tags.height), 0.5, 1000);
  let minHeight = finite(parseLength(tags.min_height), 0, 1000);
  const minLevel = finite(parseCount(tags['building:min_level']), 0, 200);
  if (minHeight === undefined && minLevel !== undefined) {
    minHeight = minLevel * FLOOR;
    inferred.push('minHeight');
  }
  if (!kind) {
    // building=yes: guess from size and height. Tall or large footprints are apartments in a town.
    const tall = (levels ?? (height ?? 0) / FLOOR) >= 4;
    kind = area > 4000 ? 'industrial' : tall || area > 300 ? 'apartment' : 'residential';
    // A commercial, retail or industrial zone gives a better default than the size alone.
    kind = zoneKindAt?.(poly.ring) ?? kind;
    inferred.push('kind');
  }
  // Roof.
  let shapeTag = tagText(tags, 'roof:shape');
  let roofShape = shapeTag && ROOF_SHAPES.has(shapeTag) ? shapeTag : undefined;
  if (roofShape && Object.hasOwn(ROOF_DRAWN, roofShape)) {
    roofShape = ROOF_DRAWN[roofShape];
    inferred.push('roofShape');
  }
  const roofLevels = finite(parseCount(tags['roof:levels']), 0, 20);
  let roofHeight = finite(parseLength(tags['roof:height']), 0, 100);
  if (!roofShape) {
    // Small houses usually have pitched roofs; larger and taller buildings are usually flat.
    const pitched = (kind === 'residential' && area < 400) || kind === 'religious' || (roofLevels ?? 0) > 0;
    roofShape = pitched ? (idRandom(e.id, 3) < 0.6 ? 'gabled' : 'hipped') : 'flat';
    inferred.push('roofShape');
  }
  if (roofHeight === undefined) {
    if (roofShape === 'flat') roofHeight = 0;
    else if (roofLevels !== undefined && roofLevels > 0) roofHeight = roofLevels * 2.8;
    else roofHeight = undefined; // decided by the geometry kit from the footprint and a pitch
    if (roofShape === 'flat' || roofLevels > 0) inferred.push('roofHeight');
  }
  // Height and levels.
  let wall;
  if (height !== undefined) {
    if (levels === undefined) {
      const roofPart = roofShape === 'flat' ? 0 : (roofHeight ?? Math.min(height * 0.3, 6));
      levels = Math.max(1, Math.round((height - (minHeight ?? 0) - roofPart) / FLOOR));
      inferred.push('levels');
    }
    wall = height;
  } else {
    if (levels === undefined) {
      const typical = { residential: 2, apartment: 5, commercial: 3, office: 6, industrial: 1, civic: 3, religious: 2 }[
        kind
      ];
      levels = Math.max(
        1,
        Math.round(typical + (idRandom(e.id, 1) - 0.5) * (kind === 'apartment' || kind === 'office' ? 3 : 1.4)),
      );
      inferred.push('levels');
    }
    const ground = kind === 'commercial' ? GROUND_FLOOR_SHOP : FLOOR;
    const perFloor = kind === 'industrial' ? 5 : kind === 'religious' ? 5.5 : FLOOR;
    wall =
      (minHeight ?? 0) +
      (levels > 0 ? ground + (levels - 1) * perFloor : 0) +
      (roofShape === 'flat' ? 0 : (roofHeight ?? 0));
    inferred.push('height');
  }
  const wallColor = parseColour(tags['building:colour']);
  const roofColor = parseColour(tags['roof:colour']);
  const material = tagText(tags, 'building:material', 64);
  const roofMaterial = tagText(tags, 'roof:material', 64);
  if (!wallColor) inferred.push('wallColor');
  if (!roofColor) inferred.push('roofColor');
  const ground = tags.shop || tags.amenity ? 'shop' : kind === 'commercial' ? 'shop' : undefined;
  return Object.freeze({
    id: e.id,
    type: e.type,
    part: isPart,
    kind,
    tag: value,
    ring: poly.ring,
    holes: Object.freeze(poly.holes),
    area,
    height: clamp(wall, (minHeight ?? 0) + 1, 1000),
    minHeight: minHeight ?? 0,
    levels: Math.round(levels),
    roofShape,
    roofHeight,
    roofLevels,
    roofDirection: finite(parseLength(tags['roof:direction']), 0, 360),
    roofAcross: tags['roof:orientation'] === 'across',
    wallColor,
    roofColor,
    material,
    roofMaterial,
    groundFloor: ground,
    name: tagText(tags, 'name', 128),
    address: tagText(tags, 'addr:housenumber', 16),
    year: parseYear(tags.start_date) ?? parseYear(tags.year_of_construction),
    architecture: tagText(tags, 'building:architecture', 64),
    flats: finite(parseCount(tags['building:flats']), 0, 10_000),
    facadeMaterial: tagText(tags, 'building:facade:material', 64),
    use: tagText(tags, 'building:use', 64),
    inferred: Object.freeze(inferred),
  });
}

function bridgeLayer(tags, fallback = 0) {
  const layer = tagText(tags, 'layer', 8);
  return layer && /^-?[0-5]$/.test(layer) ? Number(layer) : fallback;
}

function readRoad(e, tags, points) {
  const inferred = [];
  const highway = tags.highway;
  const [lanesDefault, laneWidth, townPavement] = ROADS[highway];
  const oneway = tags.oneway === 'yes' || tags.oneway === '1' || tags.junction === 'roundabout';
  let lanes = finite(parseCount(tags.lanes), 1, 12);
  if (lanes === undefined) {
    lanes = oneway ? 1 : lanesDefault;
    inferred.push('lanes');
  }
  let width = finite(parseLength(tags.width ?? tags['width:carriageway']), 1, 60);
  if (width === undefined) {
    width = FOOT.has(highway) ? laneWidth : Math.max(3, lanes * laneWidth);
    inferred.push('width');
  }
  let sidewalk = 'no';
  const sw = tagText(tags, 'sidewalk') ?? tagText(tags, 'sidewalk:both');
  const left = tagText(tags, 'sidewalk:left'),
    right = tagText(tags, 'sidewalk:right');
  const yes = (v) => v === 'yes' || v === 'both';
  if (sw && ['both', 'left', 'right', 'no', 'none', 'separate'].includes(sw)) sidewalk = sw === 'none' ? 'no' : sw;
  else if (sw === 'yes') sidewalk = 'both';
  else if (left || right)
    sidewalk = yes(left) && yes(right) ? 'both' : yes(left) ? 'left' : yes(right) ? 'right' : 'no';
  else {
    sidewalk = townPavement ? 'both' : 'no';
    inferred.push('sidewalk');
  }
  const layerTag = tagText(tags, 'layer', 8);
  const layer = finite(parseCount(layerTag?.replace(/^-/, '')), 0, 5) ?? 0;
  const bridgeName = tagText(tags, 'bridge:name', 128) ?? tagText(tags, 'name:bridge', 128);
  return Object.freeze({
    id: e.id,
    highway,
    foot: FOOT.has(highway),
    points: Object.freeze(points.map((p) => Object.freeze(p))),
    name: tagText(tags, 'name', 128),
    lanes,
    width,
    sidewalk,
    oneway,
    surface: tagText(tags, 'surface', 32),
    bridge: tags.bridge !== undefined && tags.bridge !== 'no',
    ...(bridgeName ? { bridgeName } : {}),
    ...(tags.bridge === 'no' ? { bridgeDenied: true } : {}),
    ...(tags.ford !== undefined && tags.ford !== 'no' ? { ford: true } : {}),
    tunnel: tags.tunnel !== undefined && tags.tunnel !== 'no',
    layer: layerTag?.startsWith('-') && layer > 0 ? -layer : layer,
    maxspeed: parseSpeed(tags.maxspeed),
    lit: yesNo(tags.lit, ['automatic', '24/7', 'sunset-sunrise', 'limited', 'interval'], ['disused']),
    cycleway: sides(tags, 'cycleway', cyclewayValue),
    parking: parkingSides(tags),
    footway: tagText(tags, 'footway', 32),
    crossingKind: tags.footway === 'crossing' ? crossingKindOf(tags) : undefined,
    turnLanes: tagText(tags, 'turn:lanes', 64),
    busLanes: busLaneCount(tags),
    tramTrack:
      tags.railway === 'tram' || /(^|;)\s*tram\s*($|;)/.test(tagText(tags, 'embedded_rails', 64) ?? '') || undefined,
    access: tagText(tags, 'access', 16),
    inferred: Object.freeze(inferred),
  });
}

// The kind of a crossing from its markings, or undefined when nothing about it is tagged.
function crossingKindOf(tags) {
  const raw = tagText(tags, 'crossing:markings') ?? tagText(tags, 'crossing');
  if (tags.crossing_ref === 'zebra') return 'zebra';
  if (raw === undefined) return undefined;
  if (raw === 'no' || raw === 'unmarked' || raw === 'informal') return 'unmarked';
  return raw === 'traffic_signals' ? 'signals' : 'zebra';
}

const CYCLEWAY = Object.freeze({
  lane: 'lane',
  opposite_lane: 'lane',
  track: 'track',
  opposite_track: 'track',
  shared_lane: 'shared',
  share_busway: 'shared',
  opposite_share_busway: 'shared',
  shared: 'shared',
  opposite: 'shared',
  no: 'none',
  none: 'none',
});
const cyclewayValue = (v) => (typeof v === 'string' && Object.hasOwn(CYCLEWAY, v) ? CYCLEWAY[v] : undefined);

// {left, right} from `key`, `key:both`, `key:left` and `key:right`, the side tags winning, or
// undefined when none of them is tagged.
function sides(tags, key, read) {
  const keys = [key, `${key}:both`, `${key}:left`, `${key}:right`];
  if (keys.every((k) => tags[k] === undefined)) return undefined;
  const both = read(tags[`${key}:both`]) ?? read(tags[key]);
  return Object.freeze({ left: read(tags[`${key}:left`]) ?? both, right: read(tags[`${key}:right`]) ?? both });
}

const ORIENTATIONS = new Set(['parallel', 'diagonal', 'perpendicular']);
// Street parking on each side, from the current parking:<side> scheme with its :orientation, or
// from the older parking:lane:<side> scheme.
function parkingSides(tags) {
  const current = (side) => {
    const v = tags[`parking:${side}`];
    if (v === undefined) return undefined;
    if (v === 'no') return 'no';
    const o = tags[`parking:${side}:orientation`];
    return ORIENTATIONS.has(o) ? o : null;
  };
  const older = (side) => {
    const v = tags[`parking:lane:${side}`];
    return v === 'no' || v === 'no_parking' || v === 'no_stopping' ? 'no' : ORIENTATIONS.has(v) ? v : undefined;
  };
  const keys = [
    'parking:both',
    'parking:left',
    'parking:right',
    'parking:lane:both',
    'parking:lane:left',
    'parking:lane:right',
  ];
  if (keys.every((k) => tags[k] === undefined)) return undefined;
  const side = (s) => {
    const own = current(s);
    if (own !== undefined) return own ?? undefined;
    const both = current('both');
    if (both !== undefined) return both ?? undefined;
    return older(s) ?? older('both');
  };
  return Object.freeze({ left: side('left'), right: side('right') });
}

// Bus lanes from lanes:bus, or from busway, busway:both, busway:left and busway:right.
function busLaneCount(tags) {
  const counted = finite(parseCount(tags['lanes:bus']), 0, 12);
  if (counted !== undefined) return counted;
  const lane = (v) => v === 'lane' || v === 'opposite_lane';
  if (lane(tags['busway:both'])) return 2;
  const n = (lane(tags['busway:left']) ? 1 : 0) + (lane(tags['busway:right']) ? 1 : 0);
  if (n) return n;
  return lane(tags.busway) ? 1 : undefined;
}

function readRail(e, tags, points, tunnel) {
  const inferred = [];
  const kind = tags.railway;
  let embedded = yesNo(tags.embedded);
  if (embedded === undefined) {
    embedded = kind === 'tram';
    inferred.push('embedded');
  }
  let gauge = finite(Number(tagText(tags, 'gauge', 32)?.split(';')[0]), 300, 3000);
  if (gauge === undefined) inferred.push('gauge');
  gauge = gauge === undefined ? 1.435 : gauge / 1000;
  let tracks = finite(parseCount(tags.tracks), 1, 20);
  if (tracks === undefined) {
    tracks = 1;
    inferred.push('tracks');
  }
  const bridgeName = tagText(tags, 'bridge:name', 128) ?? tagText(tags, 'name:bridge', 128);
  return Object.freeze({
    id: e.id,
    kind,
    points: Object.freeze(points.map((p) => Object.freeze(p))),
    bridge: tags.bridge !== undefined && tags.bridge !== 'no',
    ...(bridgeName ? { bridgeName } : {}),
    ...(tags.layer !== undefined ? { layer: bridgeLayer(tags) } : {}),
    tunnel,
    embedded,
    gauge,
    tracks: Math.round(tracks),
    inferred: Object.freeze(inferred),
  });
}

// The amenity kind of a node, with whether the kind was guessed.
function amenityOf(tags) {
  const has = (k) => typeof tags[k] === 'string' && tags[k] !== 'no';
  if (tags.highway === 'bus_stop') return { kind: 'bus_stop' };
  if (tags.railway === 'tram_stop') return { kind: 'tram_stop' };
  if (tags.public_transport === 'platform') {
    if (tags.tram === 'yes' && tags.bus !== 'yes') return { kind: 'tram_stop' };
    return { kind: 'bus_stop', guessed: tags.bus !== 'yes' };
  }
  if (tags.highway === 'traffic_signals') return { kind: 'traffic_signals' };
  if (tags.highway === 'stop') return { kind: 'stop_sign' };
  if (tags.highway === 'give_way') return { kind: 'give_way' };
  if (AMENITY_SAME.has(tags.amenity)) return { kind: tags.amenity };
  if (tags.leisure === 'picnic_table') return { kind: 'picnic_table' };
  if (tags.barrier === 'bollard') return { kind: 'bollard' };
  if (Object.hasOwn(MAN_MADE_POINTS, tags.man_made)) return { kind: MAN_MADE_POINTS[tags.man_made] };
  if (has('street_cabinet')) return { kind: 'street_cabinet' };
  if (tags.power === 'pole') return { kind: 'utility_pole' };
  if (tags.emergency === 'fire_hydrant') return { kind: 'hydrant' };
  if (tags.historic === 'statue' || tags.memorial === 'statue' || tags.artwork_type === 'statue')
    return { kind: 'statue' };
  if (tags.historic === 'memorial') return { kind: 'memorial' };
  if (tags.tourism === 'artwork') return { kind: 'artwork' };
  if (has('advertising')) return { kind: 'advertising' };
  if (tags.tourism === 'information') return { kind: 'information' };
  return undefined;
}

function readAmenity(e, tags, p, { kind, guessed }) {
  const stop = kind === 'bus_stop' || kind === 'tram_stop';
  return Object.freeze({
    id: e.id,
    kind,
    x: p.x,
    y: p.y,
    name: tagText(tags, 'name', 128),
    direction: parseDirection(tags.direction),
    capacity: finite(parseCount(tags.capacity), 0, 100_000),
    covered: yesNo(tags.covered),
    ...(stop ? { shelter: yesNo(tags.shelter), bench: yesNo(tags.bench) } : {}),
    inferred: Object.freeze(guessed ? ['kind'] : []),
  });
}

// The category and kind of a place of interest, or undefined.
function placeOf(tags) {
  const value = (k) => {
    const v = tagText(tags, k, 64);
    return v && v !== 'no' ? v : undefined;
  };
  const shop = value('shop');
  if (shop) return { category: 'shop', kind: shop };
  const amenity = value('amenity');
  if (amenity && PLACE_AMENITY.get(amenity) === 'food') return { category: 'food', kind: amenity };
  const office = value('office');
  if (office) return { category: 'office', kind: office };
  const healthcare = value('healthcare');
  const tourism = value('tourism');
  const leisure = value('leisure');
  const craft = value('craft');
  const fromAmenity = amenity && PLACE_AMENITY.get(amenity);
  const fromTourism = tourism && PLACE_TOURISM.get(tourism);
  for (const category of placeCategories.slice(3)) {
    if (category === 'health' && healthcare && fromAmenity !== 'health') return { category, kind: healthcare };
    if (fromAmenity === category) return { category, kind: amenity };
    if (fromTourism === category) return { category, kind: tourism };
    if (category === 'service' && craft) return { category, kind: craft };
    if (category === 'leisure' && leisure && PLACE_LEISURE.has(leisure)) return { category, kind: leisure };
  }
  return undefined;
}

function readPlace(e, tags, p, { category, kind }, building, inferred) {
  return {
    id: e.id,
    x: p.x,
    y: p.y,
    category,
    kind,
    name: tagText(tags, 'name', 128),
    cuisine: tagText(tags, 'cuisine', 64),
    brand: tagText(tags, 'brand', 64),
    outdoorSeating: yesNo(tags.outdoor_seating),
    building,
    inferred: Object.freeze(inferred),
  };
}

// Tags that put an area in the green list.
const isGreen = (tags) =>
  ['grass', 'meadow', 'village_green', 'recreation_ground', 'flowerbed'].includes(tags.landuse) ||
  ['park', 'garden', 'playground'].includes(tags.leisure) ||
  ['grassland', 'scrub', 'wood'].includes(tags.natural) ||
  tags.landuse === 'forest';
// Green areas that are also returned as special areas, because they carry detail of their own.
const ALSO_GREEN = new Set(['garden', 'flowerbed', 'playground']);
const AREA_LEISURE = Object.freeze({
  pitch: 'pitch',
  playground: 'playground',
  garden: 'garden',
  swimming_pool: 'swimming_pool',
  dog_park: 'dog_park',
});
const AREA_LANDUSE = Object.freeze({
  flowerbed: 'flowerbed',
  allotments: 'allotments',
  cemetery: 'cemetery',
  farmland: 'farmland',
  orchard: 'orchard',
  construction: 'construction',
});

// The special-area kind of a polygon, or undefined. An area with green tags is a special area
// only when its kind is in ALSO_GREEN.
function areaKindOf(tags) {
  const kind = areaKindOfTags(tags);
  return kind && (ALSO_GREEN.has(kind) || !isGreen(tags)) ? kind : undefined;
}
function areaKindOfTags(tags) {
  if (tags.man_made === 'bridge') return 'bridge';
  if (tags.amenity === 'parking') {
    const underground =
      ['underground', 'multi-storey', 'rooftop'].includes(tags.parking) || tags.location === 'underground';
    return underground || (tags.building !== undefined && tags.building !== 'no') ? undefined : 'parking';
  }
  if (Object.hasOwn(AREA_LEISURE, tags.leisure)) return AREA_LEISURE[tags.leisure];
  if ((tags.highway === 'pedestrian' && tags.area === 'yes') || tags.place === 'square') return 'plaza';
  if (tags.railway === 'platform' || tags.public_transport === 'platform') return 'platform';
  if (tags.natural === 'sand' || tags.natural === 'beach') return tags.natural;
  if (Object.hasOwn(AREA_LANDUSE, tags.landuse)) return AREA_LANDUSE[tags.landuse];
  if (tags.amenity === 'grave_yard') return 'cemetery';
  if (tags.amenity === 'school') return 'schoolyard';
  return undefined;
}

// The field each list is counted by in osmSummary.
const SUMMARY_FIELD = Object.freeze({
  buildings: 'kind',
  roads: 'highway',
  water: 'kind',
  green: 'kind',
  trees: 'leaf',
  lamps: 'mount',
  crossings: 'kind',
  amenities: 'kind',
  places: 'category',
  barriers: 'kind',
  rails: 'kind',
  areas: 'kind',
  entrances: 'kind',
  zones: 'kind',
});

/**
 * Counts of a parseOverpass result: for each list, `count` and `kinds`, the number of features of
 * each kind (roads by `highway`, trees by `leaf`, lamps by `mount`, places by `category`). At most
 * `osmLimits.summaryKinds` kinds are named per list, and the rest are counted under `other`.
 */
export function osmSummary(parsed) {
  assert(parsed && typeof parsed === 'object', 'INVALID_OSM', 'osmSummary needs a parseOverpass result.');
  const result = {};
  for (const [list, field] of Object.entries(SUMMARY_FIELD)) {
    const items = parsed[list];
    if (items === undefined) continue;
    assert(
      Array.isArray(items) && items.length <= 1_000_000,
      'INVALID_OSM',
      `osmSummary needs ${list} as a list of at most 1000000 features.`,
    );
    const kinds = Object.create(null);
    let named = 0,
      other = 0;
    for (const item of items) {
      const k = item?.[field];
      const key = typeof k === 'string' && k.length <= 64 ? k : undefined;
      if (key !== undefined && (key in kinds || named < LIMITS.summaryKinds)) {
        if (!(key in kinds)) {
          kinds[key] = 0;
          named++;
        }
        kinds[key]++;
      } else other++;
    }
    result[list] = Object.freeze({ count: items.length, kinds: Object.freeze(kinds), other });
  }
  return Object.freeze(result);
}

function readTree(e, tags, p, extra = []) {
  const inferred = [...extra];
  let height = finite(parseLength(tags.height), 1, 60);
  if (height === undefined) {
    height = 8 + idRandom(e.id ?? 1, Math.round(p.x * 7 + p.y * 13)) * 7;
    inferred.push('height');
  }
  let crown = finite(parseLength(tags.diameter_crown), 0.5, 40);
  if (crown === undefined) {
    crown = height * (0.45 + idRandom(e.id ?? 1, Math.round(p.x * 3 - p.y * 5)) * 0.25);
    inferred.push('crown');
  }
  const leaf = tags.leaf_type === 'needleleaved' ? 'needle' : 'broad';
  if (tags.leaf_type === undefined) inferred.push('leafType');
  return Object.freeze({
    id: e.id,
    x: p.x,
    y: p.y,
    height,
    crown,
    leaf,
    species: tagText(tags, 'species', 64),
    genus: tagText(tags, 'genus', 32) ?? tagText(tags, 'species', 64)?.split(/\s+/)[0].slice(0, 32),
    leafCycle: tagText(tags, 'leaf_cycle', 32),
    circumference: finite(parseLength(tags.circumference), 0.05, 30),
    denotation: tagText(tags, 'denotation', 32),
    inferred: Object.freeze(inferred),
  });
}

/** Overpass QL for every feature parseOverpass reads inside a box, as JSON with inline geometry. */
export function overpassQuery(bbox, spec = {}) {
  options(spec, ['timeout'], 'overpassQuery');
  options(bbox, ['south', 'west', 'north', 'east'], 'bbox');
  const b = [bbox.south, bbox.west, bbox.north, bbox.east].map((v, i) =>
    number(v, 'bbox value', i % 2 ? -180 : -85, i % 2 ? 180 : 85),
  );
  assert(b[2] > b[0] && b[3] > b[1], 'INVALID_BBOX', 'The box needs north above south and east of west.');
  assert(
    b[2] - b[0] <= 0.02 && b[3] - b[1] <= 0.03,
    'RESOURCE_LIMIT',
    'Ask for at most 0.02 degrees of latitude by 0.03 of longitude (about 2 km) at a time.',
  );
  const box = b.map((v) => v.toFixed(7)).join(',');
  const timeout = Math.round(number(spec.timeout ?? 25, 'timeout', 5, 180));
  const b2 = `(${box})`;
  const center = [((b[0] + b[2]) / 2).toFixed(7), ((b[1] + b[3]) / 2).toFixed(7)].join(',');
  // Water, green areas, special areas and land-use zones share one landuse filter.
  const landuse =
    '"landuse"~"^(basin|reservoir|grass|meadow|village_green|recreation_ground|flowerbed|forest|allotments|cemetery|' +
    'farmland|orchard|construction|residential|commercial|retail|industrial|education|religious|military|railway)$"';
  // Keys whose every value may matter: places, furniture, barriers, artworks and leisure areas.
  // Parking spaces are left out because a car park can hold hundreds of them.
  const anyValue =
    '[~"^(shop|office|amenity|tourism|craft|healthcare|leisure|historic|emergency|advertising|barrier)$"~"."]' +
    '["amenity"!="parking_space"]';
  return (
    `[out:json][timeout:${timeout}];is_in(${center})->.containing;(` +
    `way["building"]${b2};relation["building"]${b2};way["building:part"]${b2};relation["building:part"]${b2};` +
    `way["highway"]${b2};wr["waterway"="riverbank"]${b2};nwr[${landuse}]${b2};` +
    `wr(pivot.containing)["natural"="water"];wr(pivot.containing)["waterway"="riverbank"];` +
    `wr(pivot.containing)["landuse"~"^(basin|reservoir)$"];` +
    `nwr["natural"~"^(water|grassland|scrub|wood|sand|beach|tree_row)$"]${b2};node["natural"="tree"]${b2};` +
    `node["highway"~"^(street_lamp|crossing|bus_stop|traffic_signals|stop|give_way)$"]${b2};` +
    `nwr["railway"~"^(crossing|tram_stop|tram|rail|light_rail|narrow_gauge|platform)$"]${b2};` +
    `nwr["public_transport"="platform"]${b2};nwr["place"="square"]${b2};nwr${anyValue}${b2};` +
    `node["man_made"~"^(street_cabinet|flagpole|mast|utility_pole)$"]${b2};wr["man_made"="bridge"]${b2};node["power"="pole"]${b2};` +
    `node[~"^(entrance|door|street_cabinet)$"~"."]${b2};` +
    `);out geom;`
  );
}
