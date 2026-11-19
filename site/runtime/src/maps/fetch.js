import { assert, number, options, text } from '../core/validate.js';
import { readGeoTIFF } from '../import/geotiff.js';
import { heightfield, localProjection } from './index.js';
import { osmAttribution, overpassQuery } from './osm.js';

// On-demand map data. Nothing here runs until called: an author asks for a region, the module
// works out which files cover it, fetches only those through the caller's `fetch`, keeps them
// in the caller's cache, and builds a heightfield and vectors for that region. Every result
// carries the sources, licences and attribution text that must be shown with it.
//
// The module never uses the global fetch. Every request goes through the function the caller
// passes, every download has a byte limit, and every URL it builds is https.

// The Copernicus licence page could not be reached when this module was written (it refused
// or timed out on 2026-11-16), so the exact attribution wording could not be checked against a
// primary source. The attribution below therefore names the product and points to the licence
// instead of quoting wording. Read the required wording at `licenceUrl` and show it with the map.
const COPERNICUS_LICENCE = 'https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model';

export const SOURCES = Object.freeze({
  copernicus90: Object.freeze({
    name: 'Copernicus DEM GLO-90',
    url: 'https://copernicus-dem-90m.s3.amazonaws.com/',
    licence: `Copernicus DEM licence, free for the general public: ${COPERNICUS_LICENCE}`,
    licenceUrl: COPERNICUS_LICENCE,
    attribution: `Copernicus DEM GLO-90. Show the attribution wording required by the licence at ${COPERNICUS_LICENCE}.`,
    attributionRequired: true,
    attributionVerified: false,
  }),
  copernicus30: Object.freeze({
    name: 'Copernicus DEM GLO-30 Public',
    url: 'https://copernicus-dem-30m.s3.amazonaws.com/',
    licence: `Copernicus DEM licence, free for the general public: ${COPERNICUS_LICENCE}`,
    licenceUrl: COPERNICUS_LICENCE,
    attribution: `Copernicus DEM GLO-30. Show the attribution wording required by the licence at ${COPERNICUS_LICENCE}.`,
    attributionRequired: true,
    attributionVerified: false,
  }),
  // Natural Earth's terms say the data is in the public domain and credit is unnecessary. The
  // attribution is the long credit those terms suggest.
  naturalEarth: Object.freeze({
    name: 'Natural Earth',
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/',
    licence: 'Public domain: https://www.naturalearthdata.com/about/terms-of-use/',
    licenceUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
    attribution: 'Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com.',
    attributionRequired: false,
    attributionVerified: true,
  }),
  openStreetMap: Object.freeze({
    name: 'OpenStreetMap',
    url: 'https://overpass-api.de/api/interpreter',
    licence: `${osmAttribution.license}: ${osmAttribution.url}`,
    licenceUrl: osmAttribution.url,
    attribution: osmAttribution.text,
    attributionRequired: true,
    attributionVerified: true,
  }),
});

/** Public Overpass servers tried in order. The main one sometimes answers 502 or 504 when busy. */
export const OVERPASS_ENDPOINTS = Object.freeze([
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]);

const MAX_DOWNLOAD = 1e9;

const box = (b) => {
  options(b, ['west', 'south', 'east', 'north'], 'bounding box');
  const west = number(b.west, 'west', -180, 180),
    east = number(b.east, 'east', -180, 180),
    south = number(b.south, 'south', -85, 85),
    north = number(b.north, 'north', -85, 85);
  assert(east > west && north > south, 'INVALID_BOX', 'A bounding box needs east > west and north > south.');
  return { west, east, south, north };
};
const needFetch = (f) => {
  assert(
    typeof f === 'function',
    'INVALID_FETCH',
    'Pass fetch: the platform fetch or your own function with the same shape.',
  );
  return f;
};
const needCache = (c) => {
  if (c === undefined || c === null) return null;
  assert(
    typeof c === 'object' && typeof c.get === 'function' && typeof c.set === 'function',
    'INVALID_CACHE',
    'A cache is an object with async get(key) and async set(key, bytes).',
  );
  return c;
};
const needCallback = (f, name) => {
  assert(f === undefined || typeof f === 'function', 'INVALID_OPTIONS', `${name} must be a function.`);
  return f;
};

/** A cache kept in memory for this page or process. Pass your own {get, set} for anything lasting. */
export function memoryCache(spec = {}) {
  options(spec, ['maxBytes'], 'memoryCache');
  const max = number(spec.maxBytes ?? 512 * 1024 * 1024, 'cache size', 0, 8 * 1024 * 1024 * 1024);
  const store = new Map();
  let used = 0;
  return Object.freeze({
    async get(key) {
      return store.get(key) ?? null;
    },
    async set(key, bytes) {
      if (!(bytes instanceof Uint8Array) || bytes.length > max) return;
      if (store.has(key)) {
        used -= store.get(key).length;
        store.delete(key);
      }
      while (used + bytes.length > max && store.size) {
        const [k, v] = store.entries().next().value;
        store.delete(k);
        used -= v.length;
      }
      store.set(key, bytes);
      used += bytes.length;
    },
  });
}

// Read a response body without holding more than `max` bytes. A streamed body is cancelled as
// soon as it passes the limit; a response without a stream is checked after it arrives.
async function readBody(response, max, what) {
  const declared = Number(response.headers?.get?.('content-length') ?? 0);
  assert(!(declared > max), 'RESOURCE_LIMIT', `${what} is larger than the ${max}-byte limit.`);
  const reader = typeof response.body?.getReader === 'function' ? response.body.getReader() : null;
  if (!reader) {
    assert(typeof response.arrayBuffer === 'function', 'FETCH_FAILED', `${what} returned no body.`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert(bytes.length <= max, 'RESOURCE_LIMIT', `${what} is larger than the ${max}-byte limit.`);
    return bytes;
  }
  const chunks = [];
  let used = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    used += value.length;
    if (used > max) {
      reader.cancel().catch(() => {});
      assert(false, 'RESOURCE_LIMIT', `${what} is larger than the ${max}-byte limit.`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(used);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.length;
  }
  return bytes;
}

async function cached(s, key) {
  if (!s.cache) return null;
  const hit = await s.cache.get(key);
  if (hit === null || hit === undefined) return null;
  assert(hit instanceof Uint8Array, 'INVALID_CACHE', 'cache.get must resolve to a Uint8Array or null.');
  assert(hit.length <= s.maxBytes, 'RESOURCE_LIMIT', `The cached copy of ${key} is larger than the byte limit.`);
  return hit;
}

async function fetchBytes(url, s) {
  const hit = await cached(s, url);
  if (hit) return { bytes: hit, cached: true };
  const response = await s.fetch(url, { headers: { Accept: '*/*' } });
  if (response?.status === 404) return { bytes: null, missing: true };
  assert(response?.ok, 'FETCH_FAILED', `Downloading ${url} failed with status ${response?.status}.`);
  const bytes = await readBody(response, s.maxBytes, url);
  if (s.cache) await s.cache.set(url, bytes);
  return { bytes, cached: false };
}

/** The Copernicus tile names and URLs that cover a bounding box, one per whole degree. */
export function elevationTiles(bbox, spec = {}) {
  options(spec, ['resolution'], 'elevationTiles');
  const b = box(bbox);
  const resolution = spec.resolution ?? 90;
  assert(resolution === 90 || resolution === 30, 'INVALID_RESOLUTION', 'Use resolution 90 or 30 (metres).');
  const source = resolution === 90 ? SOURCES.copernicus90 : SOURCES.copernicus30;
  const tiles = [];
  for (let lat = Math.floor(b.south); lat < Math.ceil(b.north); lat++)
    for (let lon = Math.floor(b.west); lon < Math.ceil(b.east); lon++) {
      const ns = `${lat < 0 ? 'S' : 'N'}${String(Math.abs(lat)).padStart(2, '0')}_00`,
        ew = `${lon < 0 ? 'W' : 'E'}${String(Math.abs(lon)).padStart(3, '0')}_00`;
      const name = `Copernicus_DSM_COG_${resolution === 90 ? 30 : 10}_${ns}_${ew}_DEM`;
      tiles.push(Object.freeze({ name, lat, lon, url: `${source.url}${name}/${name}.tif` }));
    }
  return Object.freeze(tiles);
}

/**
 * Download the elevation a region needs, only when called, and build a heightfield of
 * `columns` x `rows` samples in metres around the region's centre. Tiles over open sea do not
 * exist; their samples are 0, as the data provider specifies. Returns {field, projection,
 * tiles, sources}.
 */
export async function loadElevation(spec = {}) {
  options(
    spec,
    ['bbox', 'fetch', 'cache', 'resolution', 'columns', 'rows', 'maxTiles', 'maxBytes', 'inflate', 'onProgress'],
    'loadElevation',
  );
  const b = box(spec.bbox);
  const resolution = spec.resolution ?? 90;
  const tiles = elevationTiles(b, { resolution });
  const maxTiles = number(spec.maxTiles ?? 64, 'max tiles', 1, 256);
  assert(
    tiles.length <= maxTiles,
    'RESOURCE_LIMIT',
    `This box needs ${tiles.length} elevation tiles, more than maxTiles (${maxTiles}).`,
  );
  const s = {
    fetch: needFetch(spec.fetch),
    cache: needCache(spec.cache),
    maxBytes: number(spec.maxBytes ?? 64 * 1024 * 1024, 'max bytes', 1, MAX_DOWNLOAD),
  };
  const onProgress = needCallback(spec.onProgress, 'onProgress');
  const inflate = needCallback(spec.inflate, 'inflate');
  const projection = localProjection({ center: { lon: (b.west + b.east) / 2, lat: (b.south + b.north) / 2 } });
  const sw = projection.project(b.west, b.south),
    ne = projection.project(b.east, b.north);
  const columns = number(spec.columns ?? 512, 'columns', 2, 2048),
    rows = number(spec.rows ?? Math.max(2, Math.round((columns * (ne.y - sw.y)) / (ne.x - sw.x))), 'rows', 2, 2048);
  assert(Number.isInteger(columns) && Number.isInteger(rows), 'INVALID_NUMBER', 'columns and rows are whole numbers.');
  const loaded = new Map(),
    report = [];
  for (const [k, tile] of tiles.entries()) {
    const got = await fetchBytes(tile.url, s);
    let image = null;
    if (got.bytes) image = await readGeoTIFF(got.bytes, inflate ? { inflate } : {});
    assert(!image || image.bounds, 'INVALID_TIFF', `${tile.name} has no georeferencing.`);
    loaded.set(`${tile.lat},${tile.lon}`, image);
    report.push(Object.freeze({ name: tile.name, url: tile.url, sea: !got.bytes, cached: !!got.cached }));
    onProgress?.({ done: k + 1, total: tiles.length, tile: tile.name });
  }
  // Resample the mosaic onto an even grid in projected metres, bilinearly within each tile.
  // A point on the box's north or east edge belongs to the tile below or to the west of it.
  const lat0 = Math.floor(b.south),
    lat1 = Math.ceil(b.north) - 1,
    lon0 = Math.floor(b.west),
    lon1 = Math.ceil(b.east) - 1;
  const sample = (lon, lat) => {
    const key = `${Math.min(lat1, Math.max(lat0, Math.floor(lat)))},${Math.min(lon1, Math.max(lon0, Math.floor(lon)))}`;
    const t = loaded.get(key);
    if (!t) return 0;
    const u = ((lon - t.bounds.west) / (t.bounds.east - t.bounds.west)) * t.width - 0.5,
      v = ((t.bounds.north - lat) / (t.bounds.north - t.bounds.south)) * t.height - 0.5;
    const i = Math.min(t.width - 2, Math.max(0, Math.floor(u))),
      j = Math.min(t.height - 2, Math.max(0, Math.floor(v)));
    const a = Math.min(1, Math.max(0, u - i)),
      c = Math.min(1, Math.max(0, v - j));
    const at = (x, y) => {
      const value = t.values[y * t.width + x];
      return (t.noData !== null && value === t.noData) || !Number.isFinite(value) ? 0 : value;
    };
    return (at(i, j) * (1 - a) + at(i + 1, j) * a) * (1 - c) + (at(i, j + 1) * (1 - a) + at(i + 1, j + 1) * a) * c;
  };
  const values = new Float64Array(columns * rows);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < columns; i++) {
      const x = sw.x + ((ne.x - sw.x) * i) / (columns - 1),
        y = ne.y - ((ne.y - sw.y) * j) / (rows - 1);
      const { lon, lat } = projection.unproject(x, y);
      values[j * columns + i] = Math.max(-11000, Math.min(9000, sample(lon, lat)));
    }
  const field = heightfield({ columns, rows, values, bounds: { x0: sw.x, y0: sw.y, x1: ne.x, y1: ne.y } });
  const source = resolution === 30 ? SOURCES.copernicus30 : SOURCES.copernicus90;
  return Object.freeze({ field, projection, tiles: Object.freeze(report), sources: Object.freeze([source]) });
}

const NE_LAYERS = Object.freeze({
  rivers: 'ne_10m_rivers_lake_centerlines',
  lakes: 'ne_10m_lakes',
  coastline: 'ne_10m_coastline',
  countries: 'ne_10m_admin_0_countries',
});

/**
 * Download one Natural Earth layer when called and keep only what lies in the box. Returns
 * features as {kind, name, lines: [[{lon, lat}]], rings: [[{lon, lat}]]} plus the source.
 */
export async function loadNaturalEarth(spec = {}) {
  options(spec, ['layer', 'bbox', 'fetch', 'cache', 'maxBytes', 'maxFeatures'], 'loadNaturalEarth');
  const layer = spec.layer;
  assert(Object.hasOwn(NE_LAYERS, layer), 'INVALID_LAYER', `Use a layer: ${Object.keys(NE_LAYERS).join(', ')}.`);
  const b = box(spec.bbox);
  const s = {
    fetch: needFetch(spec.fetch),
    cache: needCache(spec.cache),
    maxBytes: number(spec.maxBytes ?? 64 * 1024 * 1024, 'max bytes', 1, MAX_DOWNLOAD),
  };
  const maxFeatures = number(spec.maxFeatures ?? 5000, 'max features', 1, 100000);
  const url = `${SOURCES.naturalEarth.url}${NE_LAYERS[layer]}.geojson`;
  const got = await fetchBytes(url, s);
  assert(got.bytes, 'FETCH_FAILED', `${url} was not found.`);
  let json;
  try {
    json = JSON.parse(new TextDecoder().decode(got.bytes));
  } catch {
    assert(false, 'INVALID_DATA', `${url} is not valid GeoJSON.`);
  }
  assert(json && Array.isArray(json.features), 'INVALID_DATA', `${url} has no features.`);
  const inside = (p) => p.lon >= b.west && p.lon <= b.east && p.lat >= b.south && p.lat <= b.north;
  const list = (v) => (Array.isArray(v) ? v : []);
  const toPoints = (coords) =>
    list(coords)
      .filter((c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))
      .map(([lon, lat]) => ({ lon, lat }));
  const out = [];
  for (const f of json.features) {
    const g = f?.geometry;
    if (!g || typeof g !== 'object') continue;
    const raw = f.properties?.name;
    const name = typeof raw === 'string' ? raw.slice(0, 200) : null;
    const lines = [],
      rings = [];
    if (g.type === 'LineString') lines.push(toPoints(g.coordinates));
    else if (g.type === 'MultiLineString') for (const l of list(g.coordinates)) lines.push(toPoints(l));
    else if (g.type === 'Polygon') rings.push(...list(g.coordinates).map(toPoints));
    else if (g.type === 'MultiPolygon') for (const poly of list(g.coordinates)) rings.push(...list(poly).map(toPoints));
    // Keep a line's runs inside the box; keep a ring if any of it is inside.
    const keptLines = [];
    for (const line of lines) {
      let run = [];
      for (const p of line) {
        if (inside(p)) run.push(p);
        else if (run.length) {
          if (run.length > 1) keptLines.push(run);
          run = [];
        }
      }
      if (run.length > 1) keptLines.push(run);
    }
    const keptRings = rings.filter((r) => r.length >= 3 && r.some(inside));
    if (!keptLines.length && !keptRings.length) continue;
    assert(out.length < maxFeatures, 'RESOURCE_LIMIT', `More than ${maxFeatures} features fall in this box.`);
    out.push(Object.freeze({ kind: layer, name, lines: Object.freeze(keptLines), rings: Object.freeze(keptRings) }));
  }
  return Object.freeze({ features: Object.freeze(out), sources: Object.freeze([SOURCES.naturalEarth]) });
}

export { overpassQuery };

const RETRY_STATUS = new Set([429, 502, 503, 504]);
const defaultSleep = (ms) => new Promise((done) => setTimeout(done, ms));

/**
 * A polite downloader for OpenStreetMap street data. It sends one request at a time, waits at
 * least `minInterval` milliseconds between requests, tries `endpoints` in order when a server is
 * busy (429, 502, 503 or 504) or unreachable, and keeps each answer in the caller's cache. Its
 * `load(bbox)` resolves to {text, endpoint, cached, sources, attribution}; pass `text` to
 * `parseOverpass` from explainerkit/maps/osm.
 */
export function overpassClient(spec = {}) {
  options(
    spec,
    ['fetch', 'cache', 'endpoints', 'maxBytes', 'timeout', 'minInterval', 'sleep', 'now'],
    'overpassClient',
  );
  const get = needFetch(spec.fetch);
  const cache = needCache(spec.cache);
  const endpoints = spec.endpoints ?? OVERPASS_ENDPOINTS;
  assert(
    Array.isArray(endpoints) && endpoints.length >= 1 && endpoints.length <= 8,
    'INVALID_FETCH',
    'endpoints is a list of one to eight Overpass URLs.',
  );
  for (const e of endpoints)
    assert(
      typeof e === 'string' && e.length <= 500 && /^https:\/\/[^\s]+$/.test(e),
      'INVALID_FETCH',
      'Use https Overpass endpoints.',
    );
  const maxBytes = number(spec.maxBytes ?? 32 * 1024 * 1024, 'max bytes', 1, 256 * 1024 * 1024);
  const timeout = spec.timeout;
  const minInterval = number(spec.minInterval ?? 1000, 'min interval', 0, 600000);
  const sleep = needCallback(spec.sleep, 'sleep') ?? defaultSleep;
  const now = needCallback(spec.now, 'now') ?? Date.now;
  let last = -Infinity;
  let queue = Promise.resolve();
  const polite = async () => {
    const wait = last + minInterval - now();
    if (wait > 0) await sleep(wait);
    last = now();
  };
  const run = async (bbox) => {
    const query = overpassQuery(bbox, timeout === undefined ? {} : { timeout });
    const key = `overpass:${query}`;
    const s = { cache, maxBytes };
    const hit = await cached(s, key);
    const result = (bytes, endpoint, wasCached) =>
      Object.freeze({
        text: new TextDecoder().decode(bytes),
        endpoint,
        cached: wasCached,
        sources: Object.freeze([SOURCES.openStreetMap]),
        attribution: osmAttribution,
      });
    if (hit) return result(hit, null, true);
    const tried = [];
    for (const endpoint of endpoints) {
      await polite();
      let response;
      try {
        response = await get(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
          body: `data=${encodeURIComponent(query)}`,
        });
      } catch {
        tried.push(`${endpoint} (unreachable)`);
        continue;
      }
      if (RETRY_STATUS.has(response?.status)) {
        tried.push(`${endpoint} (${response.status})`);
        continue;
      }
      assert(response?.ok, 'FETCH_FAILED', `Overpass at ${endpoint} answered with status ${response?.status}.`);
      const bytes = await readBody(response, maxBytes, `The Overpass answer from ${endpoint}`);
      if (cache) await cache.set(key, bytes);
      return result(bytes, endpoint, false);
    }
    assert(false, 'FETCH_FAILED', `No Overpass endpoint answered: ${tried.join(', ')}. Try again later.`);
  };
  return Object.freeze({
    endpoints: Object.freeze([...endpoints]),
    /** Download the street data for a small box. Calls are queued, never sent in parallel. */
    load(bbox) {
      const next = queue.then(() => run(bbox));
      queue = next.catch(() => {});
      return next;
    },
  });
}

/** Download OpenStreetMap street data for one small box, only when called. See overpassClient. */
export async function loadOverpass(spec = {}) {
  options(
    spec,
    ['bbox', 'fetch', 'cache', 'endpoints', 'maxBytes', 'timeout', 'minInterval', 'sleep', 'now'],
    'loadOverpass',
  );
  const { bbox, ...rest } = spec;
  return overpassClient(rest).load(bbox);
}

/**
 * Load a region baked by scripts/maps/bake-region.mjs from `base` (a folder URL ending in /).
 * Returns {field, projection, water: {rivers, lakes, coastline} in region metres, sources, meta}.
 */
export async function loadBakedRegion(spec = {}) {
  options(spec, ['base', 'fetch', 'maxBytes'], 'loadBakedRegion');
  const base = text(spec.base, 'base', 2000);
  assert(base.endsWith('/'), 'INVALID_FETCH', 'base is a folder URL ending in /.');
  const get = needFetch(spec.fetch);
  const max = number(spec.maxBytes ?? 64 * 1024 * 1024, 'max bytes', 1, 256 * 1024 * 1024);
  const read = async (name) => {
    const r = await get(base + name);
    assert(r?.ok, 'FETCH_FAILED', `Loading ${base + name} failed with status ${r?.status}.`);
    return readBody(r, max, name);
  };
  const json = (bytes, name) => {
    try {
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return assert(false, 'INVALID_DATA', `${name} is not valid JSON.`);
    }
  };
  const meta = json(await read('region.json'), 'region.json');
  assert(meta?.format === 'explainerkit-region@1', 'INVALID_DATA', 'region.json is not a baked region.');
  const heights = await read('heights.f32');
  assert(
    Number.isInteger(meta.columns) && Number.isInteger(meta.rows) && heights.length === meta.columns * meta.rows * 4,
    'INVALID_DATA',
    'heights.f32 does not match the region size.',
  );
  const values = new Float32Array(heights.buffer.slice(heights.byteOffset, heights.byteOffset + heights.length));
  const field = heightfield({ columns: meta.columns, rows: meta.rows, values, bounds: meta.bounds });
  const projection = localProjection({ center: meta.center });
  const raw = json(await read('water.json'), 'water.json');
  // Every vertex is validated and projected; the total is bounded by the water.json byte limit.
  const toMetres = (pts) =>
    Object.freeze(
      (Array.isArray(pts) ? pts : [])
        .filter((p) => Number.isFinite(p?.lon) && Number.isFinite(p?.lat) && Math.abs(p.lat) <= 85)
        .map((p) => projection.project(p.lon, p.lat)),
    );
  const water = {};
  for (const layer of ['rivers', 'lakes', 'coastline'])
    water[layer] = Object.freeze(
      (Array.isArray(raw?.[layer]) ? raw[layer] : []).map((f) =>
        Object.freeze({
          name: typeof f?.name === 'string' ? f.name.slice(0, 200) : null,
          lines: Object.freeze((Array.isArray(f?.lines) ? f.lines : []).map(toMetres)),
          rings: Object.freeze((Array.isArray(f?.rings) ? f.rings : []).map(toMetres)),
        }),
      ),
    );
  return Object.freeze({
    field,
    projection,
    water: Object.freeze(water),
    sources: Object.freeze(Array.isArray(meta.sources) ? meta.sources : []),
    meta: Object.freeze(meta),
  });
}
