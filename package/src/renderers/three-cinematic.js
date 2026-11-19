import { assert, number, options } from '../core/validate.js';
import { toRGBA } from '../color/space.js';
import { elevationRamp, placeClouds } from '../maps/index.js';
import { gradientRaw2 } from '../noise/gradient.js';
import { textOutline } from '../import/font.js';

// Cinematic relief maps and lifted source text in Three.js. Three is always supplied by the
// caller (never imported here), textures are supplied by the caller (nothing is fetched), and
// every object this module creates is released by dispose(). The geography, layout and motion
// come from explainerkit/maps and explainerkit/typography/source.

const isThree = (T) =>
  T && typeof T.Mesh === 'function' && typeof T.BufferGeometry === 'function' && typeof T.ShaderMaterial === 'function';
const requireThree = (T) =>
  assert(isThree(T), 'INVALID_THREE', 'Pass the Three.js module namespace as the first argument.');
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// Pack colours are sRGB; Three's lighting works in linear light.
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linear = (color, scale = 1) =>
  toRGBA(color)
    .slice(0, 3)
    .map((c) => toLinear(c) * scale);

// ------------------------------------------------------------------ quality governor (pure)

const ADAPT_ORDER = ['pixelRatio', 'dofTaps', 'cloudCount', 'bloomLevels', 'shadowMapSize', 'terrainGrid'];
/**
 * Choose interactive quality from frame times, as the quality pack describes: drop one setting
 * when the 75th-percentile frame time stays above 1.15 x budget for 30 frames, raise one back
 * when it stays below 0.7 x budget for 120 frames. Pure: give it frame times, read settings.
 */
export function qualityGovernor(quality, spec = {}) {
  options(spec, ['tier', 'devicePixelRatio', 'window'], 'qualityGovernor');
  assert(quality?.interactive?.tiers, 'INVALID_QUALITY', 'Pass the quality.json pack.');
  const tiers = quality.interactive.tiers;
  const name = spec.tier ?? quality.interactive.defaultTier ?? 'balanced';
  assert(Object.hasOwn(tiers, name), 'INVALID_QUALITY', `Use one of the tiers ${Object.keys(tiers).join(', ')}.`);
  const dpr = number(spec.devicePixelRatio ?? 1, 'device pixel ratio', 0.25, 8);
  const windowSize = number(spec.window ?? 30, 'sample window', 5, 600);
  const base = tiers[name],
    low = tiers.low ?? base;
  const ratio = (v) => (typeof v === 'number' ? v : Math.min(dpr, 2));
  const budget = number(base.frameMs ?? 16.7, 'frame budget', 1, 1000);
  const order = (quality.interactive.adapt?.order ?? ADAPT_ORDER).filter((k) => k in base);
  const start = { ...base, pixelRatio: ratio(base.pixelRatio) };
  const floor = { ...low, pixelRatio: Math.min(1, ratio(low.pixelRatio)) };
  let dropped = 0,
    over = 0,
    under = 0;
  const samples = [];
  const current = () => {
    const out = { ...start };
    // Each step moves one setting from the chosen tier halfway to the low tier, then fully.
    for (let k = 0; k < dropped; k++) {
      const key = order[k % order.length],
        full = k >= order.length;
      if (typeof start[key] === 'number' && typeof floor[key] === 'number')
        out[key] = full ? floor[key] : (start[key] + floor[key]) / 2;
    }
    for (const key of ['dofTaps', 'cloudCount', 'bloomLevels', 'shadowMapSize', 'terrainGrid'])
      if (typeof out[key] === 'number') out[key] = Math.round(out[key]);
    return Object.freeze(out);
  };
  const maxDrops = order.length * 2;
  return {
    get tier() {
      return name;
    },
    get settings() {
      return current();
    },
    get level() {
      return dropped;
    },
    /** Record one frame time in milliseconds. Returns 'drop', 'raise' or null when settings change. */
    record(ms) {
      number(ms, 'frame time', 0, 1e5);
      samples.push(ms);
      if (samples.length > windowSize) samples.shift();
      const sorted = [...samples].sort((a, b) => a - b);
      const p75 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))];
      if (p75 > budget * 1.15) {
        over++;
        under = 0;
      } else if (p75 < budget * 0.7) {
        under++;
        over = 0;
      } else over = under = 0;
      if (over >= 30 && dropped < maxDrops) {
        dropped++;
        over = 0;
        samples.length = 0;
        return 'drop';
      }
      if (under >= 120 && dropped > 0) {
        dropped--;
        under = 0;
        samples.length = 0;
        return 'raise';
      }
      return null;
    },
  };
}

// ------------------------------------------------------------------- camera shots (pure)

/**
 * Camera poses from a list of shots: [{at, position:[x,y,z], target:[x,y,z], fov}]. Between
 * shots the camera eases. With reducedMotion the camera never flies: it holds each shot and
 * cuts at the midpoint of the move, as the quality pack asks.
 */
export function cameraShots(shots, spec = {}) {
  options(spec, ['reducedMotion', 'move'], 'cameraShots');
  assert(Array.isArray(shots) && shots.length >= 1 && shots.length <= 1000, 'INVALID_SHOTS', 'Give 1 to 1000 shots.');
  const list = shots.map((s, k) => {
    options(s, ['at', 'position', 'target', 'fov'], 'shot');
    const v3 = (v, n) => {
      assert(Array.isArray(v) && v.length === 3, 'INVALID_SHOTS', `${n} is [x, y, z].`);
      return v.map((q) => number(q, n, -1e7, 1e7));
    };
    const shot = {
      at: number(s.at ?? 0, 'shot time', -1e7, 1e7),
      position: v3(s.position, 'position'),
      target: v3(s.target, 'target'),
      fov: number(s.fov ?? 30, 'fov', 1, 170),
    };
    assert(
      k === 0 || shot.at > number(shots[k - 1].at ?? 0, 'shot time', -1e7, 1e7),
      'INVALID_SHOTS',
      'Shot times must increase.',
    );
    return shot;
  });
  const reduced = Boolean(spec.reducedMotion);
  const move = number(spec.move ?? 1.6, 'move duration', 0, 600);
  return Object.freeze({
    reducedMotion: reduced,
    pose(time) {
      number(time, 'time', -1e7, 1e7);
      let k = 0;
      while (k + 1 < list.length && list[k + 1].at <= time) k++;
      const a = list[k],
        next = list[k + 1];
      // A move into the next shot starts `move` seconds before it.
      if (!next || time < next.at - move)
        return Object.freeze({ position: a.position, target: a.target, fov: a.fov, moving: false });
      const u = move === 0 ? 1 : (time - (next.at - move)) / move;
      if (reduced) {
        const s = u < 0.5 ? a : next;
        return Object.freeze({ position: s.position, target: s.target, fov: s.fov, moving: false });
      }
      const e = u * u * (3 - 2 * u),
        mix = (p, q) => p.map((v, i) => v + (q[i] - v) * e);
      return Object.freeze({
        position: mix(a.position, next.position),
        target: mix(a.target, next.target),
        fov: a.fov + (next.fov - a.fov) * e,
        moving: true,
      });
    },
  });
}

// ------------------------------------------------------------------------- relief map

function outlineShapes(T, font, value, size) {
  const { commands } = textOutline(font, value, { size, missing: 'notdef' });
  const path = new T.ShapePath();
  for (const c of commands) {
    const [op, ...v] = c;
    if (op === 'M') path.moveTo(v[0], -v[1]);
    else if (op === 'L') path.lineTo(v[0], -v[1]);
    else if (op === 'Q') path.quadraticCurveTo(v[0], -v[1], v[2], -v[3]);
    else if (op === 'C') path.bezierCurveTo(v[0], -v[1], v[2], -v[3], v[4], -v[5]);
  }
  return path.toShapes(false);
}

/**
 * Build a cinematic relief map from a heightfield and a map style. Returns a Three group to add
 * to your scene, plus helpers to place things on the map and to animate it with setTime().
 *
 * Region coordinates are metres east (x) and north (y). The scene uses x east, y up and z south,
 * and `width` scene units span the region from west to east.
 */
export function reliefMap(T, spec = {}) {
  requireThree(T);
  options(
    spec,
    [
      'field',
      'style',
      'rig',
      'width',
      'exaggeration',
      'grid',
      'rivers',
      'lakes',
      'labels',
      'clouds',
      'textures',
      'seed',
      'riverWidth',
    ],
    'reliefMap',
  );
  const f = spec.field;
  assert(
    f && typeof f.sample === 'function' && f.bounds,
    'INVALID_HEIGHTFIELD',
    'Pass a heightfield from explainerkit/maps.',
  );
  const style = spec.style,
    rig = spec.rig;
  assert(
    style?.terrain?.ramp?.stops && style.water && style.rivers,
    'INVALID_STYLE',
    'Pass a map style such as relief-miniature.json.',
  );
  assert(rig?.sun && rig.sky, 'INVALID_STYLE', 'Pass a light rig such as relief-golden-hour.json.');
  const { x0, y0, x1, y1 } = f.bounds;
  const sceneWidth = number(spec.width ?? 2, 'map width', 1e-3, 1e5);
  const k = sceneWidth / (x1 - x0); // scene units per metre
  const ex = number(spec.exaggeration ?? style.terrain.verticalExaggeration ?? 3, 'exaggeration', 0, 1000);
  const depth = (y1 - y0) * k;
  const toScene = (x, y, metres = null) => ({
    x: (x - (x0 + x1) / 2) * k,
    y: (metres ?? Math.max(0, f.sample(x, y))) * ex * k,
    z: -(y - (y0 + y1) / 2) * k,
  });
  const heightAt = (x, y) => Math.max(0, f.sample(x, y)) * ex * k;

  // Terrain mesh, resampled to at most `grid` cells along its longer side.
  const grid = number(spec.grid ?? 512, 'terrain grid', 16, 2048);
  const cols = Math.max(
      2,
      Math.round(Math.min(grid, f.columns - 1) * Math.min(1, sceneWidth / Math.max(sceneWidth, depth))),
    ),
    rows = Math.max(2, Math.round((cols * depth) / sceneWidth));
  assert((cols + 1) * (rows + 1) <= 4_200_000, 'RESOURCE_LIMIT', 'The terrain mesh would exceed 4.2 million vertices.');
  const ramp = elevationRamp(style.terrain.ramp.stops);
  const slope = style.terrain.slopeDarkening ?? { amount: 0, startDeg: 90, endDeg: 90 };
  const sea = style.water.sea,
    seaColor = linear(sea.color),
    deepColor = linear(sea.deep ?? sea.color),
    coast = sea.coastGlow ? linear(sea.coastGlow.color) : null;
  const seed = number(spec.seed ?? 13, 'seed', 0, 0xffffffff) >>> 0;
  const count = (cols + 1) * (rows + 1);
  const positions = new Float32Array(count * 3),
    colors = new Float32Array(positions.length),
    metres = new Float32Array(count),
    // How strongly each vertex is a river bank or a lake shore, for vegetation and sand colours.
    bank = new Float32Array(count),
    shore = new Float32Array(count);
  const cellX = sceneWidth / cols,
    cellZ = depth / rows;
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= cols; i++) {
      const x = x0 + ((x1 - x0) * i) / cols,
        y = y1 - ((y1 - y0) * j) / rows,
        v = j * (cols + 1) + i,
        m = f.sample(x, y);
      metres[v] = m;
      const p = toScene(x, y, m > 0 ? m : m * 0.15); // the sea floor is kept shallow so the water reads flat
      positions.set([p.x, p.y, p.z], v * 3);
    }
  const vertexAt = (sx, sz) => ({ i: (sx + sceneWidth / 2) / cellX, j: (sz + depth / 2) / cellZ });

  // Rivers are drawn as water, not as lines. Width follows the water a point carries: it grows
  // with the square root of the drainage, the usual downstream rule for river channels
  // (Leopold and Maddock, 1953). Each river cuts a channel and a soft valley into the terrain.
  const riverSpec = spec.rivers ?? [];
  assert(Array.isArray(riverSpec) && riverSpec.length <= 500, 'INVALID_RIVER', 'Give at most 500 rivers.');
  const widest = number(spec.riverWidth ?? 0.006 * sceneWidth, 'river width', 1e-6, 1e4);
  const narrowest = widest * 0.3;
  let maxDrainage = 1;
  for (const r of riverSpec) for (const d of r.drainageAlong ?? []) maxDrainage = Math.max(maxDrainage, d);
  const channels = [];
  for (const river of riverSpec) {
    options(river, ['id', 'points', 'drainageAlong', 'width'], 'river');
    assert(
      typeof river.id === 'string' && !channels.some((c) => c.id === river.id),
      'INVALID_RIVER',
      'Each river needs a unique string id.',
    );
    assert(
      Array.isArray(river.points) && river.points.length >= 2 && river.points.length <= 100000,
      'INVALID_RIVER',
      'A river has 2 to 100000 points.',
    );
    const along = river.drainageAlong;
    assert(
      along === undefined || along.length === river.points.length,
      'INVALID_RIVER',
      'drainageAlong needs one value per point.',
    );
    const scale = river.width === undefined ? 1 : number(river.width, 'river width scale', 0, 100);
    const pts = river.points.map((p, n) => {
      const q = toScene(number(p.x, 'river x', -2e7, 2e7), number(p.y, 'river y', -2e7, 2e7));
      const share = along ? (Math.max(0, along[n]) / maxDrainage) ** 0.35 : Math.sqrt(n / (river.points.length - 1));
      return { x: q.x, y: q.y, z: q.z, w: (narrowest + (widest - narrowest) * share) * scale };
    });
    // Water never runs uphill: the surface follows the running minimum of the ground downstream.
    for (let n = 1; n < pts.length; n++) pts[n].y = Math.min(pts[n].y, pts[n - 1].y);
    channels.push({ id: river.id, pts });
  }
  const carveBudget = 60_000_000;
  let carveWork = 0;
  for (const { pts } of channels)
    for (const p of pts) {
      const reach = p.w * 4,
        c = vertexAt(p.x, p.z);
      const di = Math.ceil(reach / cellX),
        dj = Math.ceil(reach / cellZ);
      carveWork += (2 * di + 1) * (2 * dj + 1);
      assert(
        carveWork <= carveBudget,
        'RESOURCE_LIMIT',
        'The rivers are too wide or too many for this terrain grid. Use fewer rivers or a smaller riverWidth.',
      );
      const bottom = p.y - p.w * 0.6;
      for (let j = Math.max(0, Math.floor(c.j - dj)); j <= Math.min(rows, Math.ceil(c.j + dj)); j++)
        for (let i = Math.max(0, Math.floor(c.i - di)); i <= Math.min(cols, Math.ceil(c.i + di)); i++) {
          const v = j * (cols + 1) + i;
          if (metres[v] <= 0) continue;
          const d = Math.hypot(positions[v * 3] - p.x, positions[v * 3 + 2] - p.z);
          // A channel as wide as the water, inside a valley about three times wider.
          const g = Math.exp(-((d / (p.w * 0.75)) ** 2)) * 0.8 + Math.exp(-((d / (p.w * 2.4)) ** 2)) * 0.2;
          const y = positions[v * 3 + 1];
          if (y > bottom) positions[v * 3 + 1] = y - (y - bottom) * g;
          bank[v] = Math.max(bank[v], Math.exp(-((d / (p.w * 3)) ** 2)));
        }
    }

  // Lakes cut a basin below their surface and get a ring of shore.
  const lakeSpec = spec.lakes ?? [];
  assert(Array.isArray(lakeSpec) && lakeSpec.length <= 200, 'INVALID_LAKE', 'Give at most 200 lakes.');
  const lakes = lakeSpec.map((lake) => {
    options(lake, ['outline', 'elevation', 'depth'], 'lake');
    assert(
      Array.isArray(lake.outline) && lake.outline.length >= 3 && lake.outline.length <= 4000,
      'INVALID_LAKE',
      'A lake outline has 3 to 4000 points.',
    );
    const ring = lake.outline.map((p) => {
      const q = toScene(number(p.x, 'lake x', -2e7, 2e7), number(p.y, 'lake y', -2e7, 2e7));
      return { x: q.x, z: q.z };
    });
    const surface = number(lake.elevation, 'lake elevation', -1000, 9000) * ex * k;
    const xs = ring.map((p) => p.x),
      zs = ring.map((p) => p.z);
    const box = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
    const size = Math.max(box.x1 - box.x0, box.z1 - box.z0);
    const basin = number(lake.depth ?? 0.06, 'lake depth', 0, 10) * size;
    return { ring, surface, box, size, basin };
  });
  const inside = (ring, x, z) => {
    let hit = false;
    for (let a = 0, b = ring.length - 1; a < ring.length; b = a++)
      if (
        ring[a].z > z !== ring[b].z > z &&
        x < ((ring[b].x - ring[a].x) * (z - ring[a].z)) / (ring[b].z - ring[a].z) + ring[a].x
      )
        hit = !hit;
    return hit;
  };
  const edgeDistance = (ring, x, z) => {
    let best = Infinity;
    for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
      const ax = ring[b].x,
        az = ring[b].z,
        dx = ring[a].x - ax,
        dz = ring[a].z - az,
        t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
      best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
    }
    return best;
  };
  for (const lake of lakes) {
    const margin = lake.size * 0.12;
    lake.pad = Math.min(margin * 0.5, Math.max(cellX, cellZ) * 1.7);
    const a = vertexAt(lake.box.x0 - margin, lake.box.z0 - margin),
      b = vertexAt(lake.box.x1 + margin, lake.box.z1 + margin);
    carveWork += (b.i - a.i + 1) * (b.j - a.j + 1) * lake.ring.length;
    assert(carveWork <= carveBudget, 'RESOURCE_LIMIT', 'The lakes are too large or detailed for this terrain grid.');
    for (let j = Math.max(0, Math.floor(a.j)); j <= Math.min(rows, Math.ceil(b.j)); j++)
      for (let i = Math.max(0, Math.floor(a.i)); i <= Math.min(cols, Math.ceil(b.i)); i++) {
        const v = j * (cols + 1) + i,
          x = positions[v * 3],
          z = positions[v * 3 + 2];
        // Signed distance from the shore: positive inside the lake. The ground dips under the
        // waterline over a band a little wider than one terrain cell, so no triangle of land
        // can poke through the water's edge and leave it jagged.
        const sd = edgeDistance(lake.ring, x, z) * (inside(lake.ring, x, z) ? 1 : -1);
        const bed = lake.surface - 4e-4 * sceneWidth;
        if (sd > -lake.pad)
          positions[v * 3 + 1] = Math.min(
            positions[v * 3 + 1],
            bed - lake.basin * Math.min(1, Math.max(0, sd) / (lake.size * 0.25)),
          );
        else if (-sd < margin) {
          // Beyond the band the ground eases back up to the land around the lake.
          const t = smooth(lake.pad, margin, -sd);
          positions[v * 3 + 1] = Math.min(positions[v * 3 + 1], bed + (positions[v * 3 + 1] - bed) * t);
        }
        if (sd < 0 && -sd < margin) shore[v] = Math.max(shore[v], 1 - smooth(lake.pad * 0.6, lake.pad * 2.5, -sd));
      }
  }

  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  const index = new Uint32Array(cols * rows * 6);
  for (let j = 0, q = 0; j < rows; j++)
    for (let i = 0; i < cols; i++, q += 6) {
      const a = j * (cols + 1) + i;
      index.set([a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2], q);
    }
  geometry.setIndex(new T.BufferAttribute(index, 1));
  geometry.computeVertexNormals();
  const normals = geometry.attributes.normal;
  const micro = style.terrain.microDetail?.normalNoise ?? 0;
  const waterStyle = style.water.river ?? {};
  const riparian = linear(waterStyle.banks ?? 'hsla(96, 42%, 22%, 1)'),
    sand = linear(waterStyle.shore ?? 'hsla(42, 24%, 46%, 1)');
  for (let v = 0; v < count; v++) {
    const m = metres[v],
      px = positions[v * 3],
      pz = positions[v * 3 + 2];
    let c;
    if (m <= 0) {
      const t = Math.min(1, -m / number(sea.depthFadeMetres ?? 1200, 'depth fade', 1, 1e5));
      c = seaColor.map((s, i) => s + (deepColor[i] - s) * t);
      if (coast) c = c.map((s, i) => s + (coast[i] - s) * (sea.coastGlow.intensity ?? 0.5) * (1 - smooth(0, 40, -m)));
    } else {
      const wobble = 80 * gradientRaw2(((px * 9) / sceneWidth) * 2, ((pz * 9) / sceneWidth) * 2, seed);
      c = linear(ramp(Math.max(-12000, Math.min(12000, m + wobble))));
      // Vegetation follows the water: a darker green band along rivers, sand at lake shores.
      const green =
        bank[v] * 0.7 * (0.75 + 0.25 * gradientRaw2((px * 400) / sceneWidth, (pz * 400) / sceneWidth, seed + 2));
      c = c.map((s, i) => s + (riparian[i] - s) * green);
      c = c.map((s, i) => s + (sand[i] - s) * shore[v] * 0.55);
      const deg = (Math.acos(Math.min(1, normals.getY(v))) * 180) / Math.PI;
      const dark = 1 - slope.amount * smooth(slope.startDeg, slope.endDeg, deg);
      const grain =
        1 + micro * 0.12 * gradientRaw2(((px * 60) / sceneWidth) * 2, ((pz * 60) / sceneWidth) * 2, seed + 1);
      c = c.map((s) => s * dark * grain);
    }
    colors.set(c, v * 3);
  }
  geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
  const owned = [geometry];
  const material = new T.MeshStandardMaterial({
    vertexColors: true,
    roughness: style.terrain.roughness ?? 0.9,
    metalness: 0,
  });
  owned.push(material);
  const terrain = new T.Mesh(geometry, material);
  terrain.name = 'terrain';
  terrain.castShadow = terrain.receiveShadow = true;
  const group = new T.Group();
  group.name = 'relief-map';
  group.add(terrain);
  const groundAt = (sx, sz) => {
    const g = vertexAt(sx, sz),
      i = Math.min(cols - 1, Math.max(0, Math.floor(g.i))),
      j = Math.min(rows - 1, Math.max(0, Math.floor(g.j))),
      a = Math.min(1, Math.max(0, g.i - i)),
      b = Math.min(1, Math.max(0, g.j - j));
    const y = (ii, jj) => positions[(jj * (cols + 1) + ii) * 3 + 1];
    return (y(i, j) * (1 - a) + y(i + 1, j) * a) * (1 - b) + (y(i, j + 1) * (1 - a) + y(i + 1, j + 1) * a) * b;
  };

  // Water surface and its halftone screen. The halftone texture stores its dots in alpha, so it
  // is used as a colour map with transparency, never as an alphaMap (which reads green).
  const waterGeo = new T.PlaneGeometry(sceneWidth, depth);
  waterGeo.rotateX(-Math.PI / 2);
  owned.push(waterGeo);
  const waterMat = new T.MeshStandardMaterial({
    color: new T.Color(...seaColor),
    roughness: sea.roughness ?? 0.25,
    metalness: 0.05,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  owned.push(waterMat);
  const water = new T.Mesh(waterGeo, waterMat);
  water.name = 'water';
  water.position.y = 1e-4 * sceneWidth;
  water.receiveShadow = true;
  group.add(water);
  const tex = spec.textures ?? {};
  if (tex.halftone && sea.halftone) {
    const dots = tex.halftone;
    dots.wrapS = dots.wrapT = T.RepeatWrapping;
    const repeat = 1 / (sea.halftone.scale ?? 0.012) / 3;
    dots.repeat.set(repeat, (repeat * depth) / sceneWidth);
    const screenMat = new T.MeshBasicMaterial({
      color: 0xffffff,
      map: dots,
      transparent: true,
      opacity: sea.halftone.opacity ?? 0.35,
      depthWrite: false,
    });
    owned.push(screenMat);
    const screen = new T.Mesh(waterGeo, screenMat);
    screen.name = 'halftone';
    screen.position.y = 3e-4 * sceneWidth;
    group.add(screen);
  }

  // Fresh water shares one material. Colours run from a muddy bank through clear shallows to a
  // deep channel, so the water reads as depth rather than as a flat line.
  const lakeStyle = style.water.lake ?? {};
  // Seen from altitude, fresh water is muted: dark blue-green in deep channels, grey-teal in the
  // shallows and brown where it carries silt, which it does more as it reaches the lowlands.
  const deepFresh = linear(waterStyle.deep ?? 'hsla(198, 64%, 27%, 1)'),
    shallowFresh = linear(waterStyle.shallow ?? 'hsla(182, 46%, 40%, 1)'),
    muddy = linear(waterStyle.bank ?? 'hsla(38, 28%, 36%, 1)'),
    silt = linear(waterStyle.silt ?? 'hsla(34, 42%, 42%, 1)');
  const lakeDeep = linear(lakeStyle.deep ?? 'hsla(207, 58%, 22%, 1)'),
    lakeShallow = linear(lakeStyle.shallow ?? 'hsla(192, 38%, 36%, 1)');
  // Water mostly shows the sky it reflects. A small sky made from the rig (sky overhead, haze at
  // the horizon, ground below) gives the water its gradient, and a ripple normal map breaks the
  // reflection into sparkle. Both are generated here, so nothing is fetched.
  // The reflected horizon leans toward the sky colour, so warm haze does not turn water purple.
  const skyTop = linear(rig.sky.color),
    haze = linear(rig.atmosphere?.haze ?? rig.sky.color).map((h, q) => h * 0.4 + linear(rig.sky.color)[q] * 0.6),
    below = linear(rig.sky.ground);
  const SW = 128,
    SH = 64,
    skyData = new Float32Array(SW * SH * 4);
  for (let j = 0; j < SH; j++) {
    const lat = 1 - (j + 0.5) / SH; // 1 at the zenith, 0 at the nadir
    for (let i = 0; i < SW; i++) {
      const up = Math.max(0, (lat - 0.5) * 2),
        down = Math.max(0, (0.5 - lat) * 2);
      const c =
        lat >= 0.5
          ? haze.map((h, q) => h + (skyTop[q] - h) * Math.sqrt(up))
          : haze.map((h, q) => h + (below[q] - h) * Math.min(1, down * 3));
      skyData.set([...c, 1], (j * SW + i) * 4);
    }
  }
  const skyMap = new T.DataTexture(skyData, SW, SH, T.RGBAFormat, T.FloatType);
  skyMap.mapping = T.EquirectangularReflectionMapping;
  skyMap.needsUpdate = true;
  const RN = 128,
    rippleData = new Uint8Array(RN * RN * 4);
  for (let j = 0; j < RN; j++)
    for (let i = 0; i < RN; i++) {
      // Tileable ripples: noise sampled on a torus so the texture repeats without seams.
      const a = (i / RN) * 2 * Math.PI,
        b = (j / RN) * 2 * Math.PI;
      const h = (x, y) =>
        gradientRaw2(Math.cos(x) * 3 + Math.cos(y) * 1.3, Math.sin(x) * 3 + Math.sin(y) * 1.3 + 7, seed + 5);
      const dx = h(a + 0.05, b) - h(a - 0.05, b),
        dy = h(a, b + 0.05) - h(a, b - 0.05);
      const l = Math.hypot(dx * 4, dy * 4, 1);
      rippleData.set(
        [((-dx * 4) / l) * 127 + 128, ((-dy * 4) / l) * 127 + 128, (1 / l) * 127 + 128, 255],
        (j * RN + i) * 4,
      );
    }
  const ripples = new T.DataTexture(rippleData, RN, RN, T.RGBAFormat);
  ripples.wrapS = ripples.wrapT = T.RepeatWrapping;
  ripples.repeat.set(320 / sceneWidth, 320 / sceneWidth);
  ripples.needsUpdate = true;
  owned.push(skyMap, ripples);
  waterMat.envMap = skyMap;
  const freshMat = new T.MeshStandardMaterial({
    side: T.DoubleSide,
    transparent: true,
    envMap: skyMap,
    envMapIntensity: 0.22,
    emissive: new T.Color(...linear(lakeStyle.color ?? 'hsla(206, 80%, 52%, 1)', 0.06 * (lakeStyle.emissive ?? 1))),
    normalMap: ripples,
    normalScale: new T.Vector2(0.05, 0.05),
    vertexColors: true,
    roughness: waterStyle.roughness ?? 0.16,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  owned.push(freshMat);
  const across = [-1, -0.82, -0.45, 0, 0.45, 0.82, 1];
  const tint = (t, shallow = shallowFresh, deep = deepFresh) => {
    // t is 0 at the bank and 1 at the deepest point.
    const a = smooth(0, 0.18, t),
      b = smooth(0.25, 1, t);
    return muddy.map((m, i) => m + (shallow[i] - m) * a + (deep[i] - shallow[i]) * b);
  };
  const topMetres = Math.max(1, f.max);
  const riverPaths = new Map();
  for (const ch of channels) {
    const pts = ch.pts,
      n = pts.length,
      w = across.length;
    const pos = new Float32Array(n * w * 3),
      col = new Float32Array(n * w * 4),
      idx = new Uint32Array((n - 1) * (w - 1) * 6);
    for (let q = 0; q < n; q++) {
      const prev = pts[Math.max(0, q - 1)],
        next = pts[Math.min(n - 1, q + 1)];
      let tx = next.x - prev.x,
        tz = next.z - prev.z;
      const l = Math.hypot(tx, tz) || 1;
      tx /= l;
      tz /= l;
      const p = pts[q],
        surface = Math.max(p.y - p.w * 0.25, groundAt(p.x, p.z) + 1e-4 * sceneWidth);
      // Wider, slower water downstream is deeper in colour; lower water carries more silt; and
      // shoals and pools vary the colour along the channel.
      const depthTone = 0.55 + 0.45 * Math.min(1, p.w / widest);
      const lowland = 1 - Math.min(1, Math.max(0, p.y / (topMetres * ex * k)));
      const shoal = 0.5 + 0.5 * gradientRaw2((p.x * 90) / sceneWidth, (p.z * 90) / sceneWidth, seed + 7);
      const muddiness = Math.min(0.7, 0.15 + 0.45 * lowland * lowland + 0.15 * shoal);
      across.forEach((o, c) => {
        const x = p.x - tz * o * p.w * 0.5,
          z = p.z + tx * o * p.w * 0.5;
        const y = Math.abs(o) === 1 ? Math.max(surface, groundAt(x, z)) + 1e-4 * sceneWidth : surface;
        pos.set([x, y, z], (q * w + c) * 3);
        const fresh = tint((1 - Math.abs(o)) * depthTone * (0.8 + 0.2 * shoal)).map(
          (v, i) => v + (silt[i] - v) * muddiness * (1 - Math.abs(o) * 0.3),
        );
        // The banks fade into the land instead of ending in a hard edge.
        col.set([...fresh, Math.abs(o) === 1 ? 0 : Math.abs(o) > 0.8 ? 0.7 : 1], (q * w + c) * 4);
      });
    }
    for (let q = 0, e = 0; q < n - 1; q++)
      for (let c = 0; c < w - 1; c++, e += 6) {
        const a = q * w + c,
          b = a + w;
        idx.set([a, a + 1, b, a + 1, b + 1, b], e);
      }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('color', new T.BufferAttribute(col, 4));
    g.setAttribute(
      'uv',
      new T.BufferAttribute(
        Float32Array.from({ length: n * w * 2 }, (_, q) => pos[Math.floor(q / 2) * 3 + (q % 2 ? 2 : 0)]),
        2,
      ),
    );
    g.setIndex(new T.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    // Whatever the path's direction, the water faces the sky.
    const rn = g.attributes.normal;
    for (let v = 0; v < rn.count; v++) if (rn.getY(v) < 0) rn.setXYZ(v, -rn.getX(v), -rn.getY(v), -rn.getZ(v));
    owned.push(g);
    const mesh = new T.Mesh(g, freshMat);
    mesh.name = `river:${ch.id}`;
    mesh.receiveShadow = true;
    group.add(mesh);
    riverPaths.set(
      ch.id,
      Object.freeze(
        pts.map((p) =>
          Object.freeze({ x: p.x, y: Math.max(p.y - p.w * 0.25, groundAt(p.x, p.z)), z: p.z, width: p.w }),
        ),
      ),
    );
  }
  // Lakes: a fine grid of water inside the outline, coloured by the true distance from the
  // shore. Shrinking the outline toward its centre would draw rays on an irregular lake.
  for (const lake of lakes) {
    const { ring, box: bb } = lake;
    const cellSize = Math.max(lake.size / 110, sceneWidth / 4000);
    const rim = Math.ceil(lake.pad / cellSize) + 1;
    const nx = Math.min(260, Math.ceil((bb.x1 - bb.x0) / cellSize) + 2 * rim),
      nz = Math.min(260, Math.ceil((bb.z1 - bb.z0) / cellSize) + 2 * rim);
    assert(nx * nz * ring.length <= 60_000_000, 'RESOURCE_LIMIT', 'This lake outline is too detailed. Simplify it.');
    const y = lake.surface + 3e-4 * sceneWidth;
    // The depth a viewer reads: full depth colour about a fifth of the lake's size from shore.
    const deepAt = lake.size * 0.2;
    const pos = new Float32Array(nx * nz * 3),
      col = new Float32Array(nx * nz * 4),
      signed = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const x = bb.x0 - rim * cellSize + i * cellSize,
          z = bb.z0 - rim * cellSize + j * cellSize,
          v = j * nx + i;
        const d = edgeDistance(ring, x, z) * (inside(ring, x, z) ? 1 : -1);
        signed[v] = d;
        pos.set([x, y, z], v * 3);
        const patch = 0.05 * gradientRaw2((x * 140) / sceneWidth, (z * 140) / sceneWidth, seed + 9);
        const t = Math.min(1, Math.max(0, d / deepAt + patch));
        // The water thins to nothing just outside the outline, so the grid's steps never show.
        col.set([...tint(t, lakeShallow, lakeDeep), smooth(-lake.pad * 0.85, -lake.pad * 0.2, d)], v * 4);
      }
    const idx = [];
    for (let j = 0; j < nz - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i,
          b = a + nx;
        // Keep cells that touch the lake at all.
        if (Math.max(signed[a], signed[a + 1], signed[b], signed[b + 1]) < -lake.pad) continue;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('color', new T.BufferAttribute(col, 4));
    g.setAttribute(
      'uv',
      new T.BufferAttribute(
        Float32Array.from({ length: nx * nz * 2 }, (_, q) => pos[Math.floor(q / 2) * 3 + (q % 2 ? 2 : 0)]),
        2,
      ),
    );
    g.setAttribute(
      'normal',
      new T.BufferAttribute(
        Float32Array.from({ length: nx * nz * 3 }, (_, q) => (q % 3 === 1 ? 1 : 0)),
        3,
      ),
    );
    g.setIndex(idx);
    owned.push(g);
    const mesh = new T.Mesh(g, freshMat);
    mesh.name = 'lake';
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Engraved names: real letter outlines laid on the ground, darkening it like a carved line.
  for (const label of spec.labels ?? []) {
    options(label, ['text', 'x', 'y', 'size', 'font', 'kind', 'color'], 'label');
    assert(
      label.font,
      'INVALID_LABEL',
      'Labels need a font from explainerkit/import/font, so they do not depend on installed fonts.',
    );
    const engraved = style.labels?.engraved ?? {};
    const size = number(label.size ?? 0.04 * sceneWidth, 'label size', 1e-6, 1e5);
    const shapes = outlineShapes(T, label.font, String(label.text).toUpperCase(), size);
    if (!shapes.length) continue;
    const g = new T.ShapeGeometry(shapes, 6);
    g.computeBoundingBox();
    const bb = g.boundingBox,
      cx = (bb.min.x + bb.max.x) / 2,
      cy = (bb.min.y + bb.max.y) / 2;
    const centre = toScene(number(label.x, 'label x', -2e7, 2e7), number(label.y, 'label y', -2e7, 2e7));
    const pos = g.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const sx = centre.x + pos.getX(v) - cx,
        sz = centre.z - (pos.getY(v) - cy);
      const rx = sx / k + (x0 + x1) / 2,
        ry = -(sz / k) + (y0 + y1) / 2;
      pos.setXYZ(v, sx, heightAt(rx, ry) + 6e-4 * sceneWidth, sz);
    }
    pos.needsUpdate = true;
    const onWater = label.kind === 'water';
    const m = new T.MeshBasicMaterial({
      color: new T.Color(
        ...linear(label.color ?? (onWater ? 'hsla(200, 60%, 92%, 1)' : (engraved.color ?? 'hsla(30, 30%, 22%, 1)'))),
      ),
      transparent: true,
      opacity: onWater ? 0.85 : (engraved.opacity ?? 0.5),
      depthWrite: false,
      side: T.DoubleSide,
      // Pull the letters toward the camera so terrain triangles between samples do not cut them.
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
    });
    owned.push(g, m);
    const mesh = new T.Mesh(g, m);
    mesh.name = `label:${label.text}`;
    if (onWater) mesh.position.y += 0.01 * sceneWidth;
    group.add(mesh);
  }

  // Clouds over high ground, from the cloud atlas (a 4 x 4 grid of sprites in its alpha).
  const cloudSprites = [];
  const cs = style.clouds ?? {};
  if (tex.cloudAtlas && spec.clouds !== false) {
    const cfg = spec.clouds ?? {};
    options(cfg, ['seed', 'count', 'avoid'], 'clouds');
    const placed = placeClouds(f, {
      seed: cfg.seed ?? seed,
      count: cfg.count ?? 12,
      avoid: cfg.avoid ?? [],
      exaggeration: ex,
      altitudeFactor: cs.altitude ?? 1.2,
    });
    for (const c of placed.clouds) {
      const t = tex.cloudAtlas.clone();
      t.repeat.set(0.25, 0.25);
      t.offset.set(((c.sprite * 2) % 4) * 0.25, 0.75 - (Math.floor((c.sprite * 2) / 4) % 4) * 0.25);
      t.needsUpdate = true;
      const [lo, hi] = cs.size ?? [0.08, 0.16];
      const s = sceneWidth * (lo + ((hi - lo) * (c.size - 0.7)) / 0.6);
      const m = new T.SpriteMaterial({
        map: t,
        color: new T.Color(...linear(cs.lit ?? 'hsla(36, 30%, 96%, 1)', 1.05)),
        transparent: true,
        depthWrite: false,
        opacity: 0.8,
      });
      owned.push(t, m);
      const sprite = new T.Sprite(m);
      sprite.scale.set(s, s, 1);
      const p = toScene(c.x, c.y);
      sprite.position.set(p.x, c.z * k, p.z);
      sprite.userData.home = { x: p.x, z: p.z, drift: c.drift };
      group.add(sprite);
      cloudSprites.push(sprite);
    }
  }

  // Sun and sky from the rig. Azimuth is clockwise from north; north is -z in the scene.
  const az = (number(rig.sun.azimuthDeg, 'sun azimuth', -720, 720) * Math.PI) / 180,
    el = (number(rig.sun.elevationDeg, 'sun elevation', 0, 90) * Math.PI) / 180;
  const sun = new T.DirectionalLight(new T.Color(...linear(rig.sun.color)), rig.sun.intensity ?? 3);
  sun.name = 'sun';
  sun.position.set(
    Math.sin(az) * Math.cos(el) * sceneWidth * 1.5,
    Math.sin(el) * sceneWidth * 1.5,
    -Math.cos(az) * Math.cos(el) * sceneWidth * 1.5,
  );
  sun.castShadow = true;
  const half = Math.max(sceneWidth, depth) * 0.7;
  Object.assign(sun.shadow.camera, {
    left: -half,
    right: half,
    top: half,
    bottom: -half,
    near: 0.01 * sceneWidth,
    far: sceneWidth * 4,
  });
  sun.shadow.bias = rig.shadow?.bias ?? -0.0002;
  sun.shadow.normalBias = 0.002 * sceneWidth;
  sun.shadow.mapSize.set(2048, 2048);
  const sky = new T.HemisphereLight(
    new T.Color(...linear(rig.sky.color)),
    new T.Color(...linear(rig.sky.ground)),
    rig.sky.intensity ?? 1,
  );
  sky.name = 'sky';
  group.add(sun, sun.target, sky);

  let disposed = false;
  return {
    group,
    sun,
    /** The terrain mesh geometry, read-only, for overlays such as mapHighlights(). */
    terrain: geometry,
    width: sceneWidth,
    depth,
    /** Scene position of a region point; elevation defaults to the ground. */
    toScene: (x, y, elevation) => {
      const p = toScene(
        number(x, 'x', -2e7, 2e7),
        number(y, 'y', -2e7, 2e7),
        elevation === undefined ? null : number(elevation, 'elevation', -12000, 12000),
      );
      return Object.freeze(p);
    },
    heightAt: (x, y) => heightAt(number(x, 'x', -2e7, 2e7), number(y, 'y', -2e7, 2e7)),
    /** Haze settings for scene.fog, from the rig's atmosphere. */
    fog(far) {
      const a = rig.atmosphere ?? { haze: 'hsla(35, 40%, 82%, 1)', start: 0.35, density: 0.18 };
      const reach = number(far, 'camera far', 1e-3, 1e7);
      return new T.Fog(
        new T.Color(...linear(a.haze, 0.7)),
        reach * (a.start ?? 0.35),
        reach * Math.min(1, (a.start ?? 0.35) + (1 / Math.max(0.01, a.density ?? 0.18)) * 0.1),
      );
    },
    /**
     * The water surface along a river in scene units, with the drawn width at each point. Use it
     * to place things on the river or to highlight it with mapHighlights().
     */
    riverPath(id) {
      assert(riverPaths.has(id), 'INVALID_RIVER', `No river ${id}.`);
      return riverPaths.get(id);
    },
    /** Ground height in scene units at a scene position, including carved valleys and basins. */
    groundAt: (sx, sz) => groundAt(number(sx, 'scene x', -1e7, 1e7), number(sz, 'scene z', -1e7, 1e7)),
    /** Pose the map at `time`. Clouds drift; everything else is fixed. Pure in time. */
    setTime(time) {
      assert(!disposed, 'DISPOSED', 'This relief map was disposed.');
      number(time, 'time', -1e7, 1e7);
      const speed = (cs.drift ?? 0.004) * sceneWidth;
      for (const c of cloudSprites) {
        const h = c.userData.home;
        c.position.x = h.x + Math.cos(h.drift) * speed * time;
        c.position.z = h.z + Math.sin(h.drift) * speed * time * 0.4;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent?.();
      sun.shadow.map?.dispose?.();
      for (const o of owned) o.dispose?.();
    },
  };
}

// --------------------------------------------------------------------- post-processing

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const BLUR_FRAG = `
uniform sampler2D tSource; uniform vec2 direction; uniform float threshold; varying vec2 vUv;
vec3 pick(vec2 uv){ vec3 c = texture2D(tSource, uv).rgb; float l = dot(c, vec3(.2126,.7152,.0722));
  return threshold > 0.0 ? c * smoothstep(threshold, threshold * 1.6, l) : c; }
void main(){
  float w[5]; w[0]=.227027; w[1]=.1945946; w[2]=.1216216; w[3]=.054054; w[4]=.016216;
  vec3 sum = pick(vUv) * w[0];
  for (int i = 1; i < 5; i++){ sum += pick(vUv + direction * float(i)) * w[i]; sum += pick(vUv - direction * float(i)) * w[i]; }
  gl_FragColor = vec4(sum, 1.0);
}`;
const ACCUM_FRAG =
  'uniform sampler2D tSource; uniform float weight; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tSource, vUv).rgb * weight, weight); }';
const COMPOSITE_FRAG = `
uniform sampler2D tScene, tBloomA, tBloomB; uniform vec2 resolution;
uniform float focusCenter, halfWidth, falloff, maxBlur, angle, bloomStrength, exposure;
uniform vec3 shadowTint, highlightTint; uniform float shadowAmount, highlightAmount, saturation, contrast, grain, chroma, seed;
uniform vec3 vignette; uniform int taps; varying vec2 vUv;
// ACES filmic fit (Narkowicz 2015). Input and output are linear.
vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14), 0., 1.); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + seed) * 43758.5453); }
vec3 lens(vec2 uv, float radius){
  vec3 sum = vec3(0.); float total = 0.;
  for (int i = 0; i < 64; i++){
    if (i >= taps) break;
    float r = sqrt((float(i) + .5) / float(taps)) * radius; float a = float(i) * 2.39996323;
    vec2 o = vec2(cos(a), sin(a)) * r * vec2(resolution.y / resolution.x, 1.);
    sum += texture2D(tScene, uv + o).rgb; total += 1.;
  }
  return sum / total;
}
void main(){
  vec2 d = vUv - vec2(.5, 1. - focusCenter);
  float along = abs(-sin(angle) * d.x + cos(angle) * d.y);
  float radius = maxBlur * smoothstep(halfWidth, halfWidth + falloff, along);
  vec3 col = radius > .0004 ? lens(vUv, radius) : texture2D(tScene, vUv).rgb;
  // Colour fringing only where the image is sharp; mixing sharp channels into a blurred one tints the blur.
  float fringe = .6 * (1. - smoothstep(0., .0015, radius));
  if (chroma > 0. && fringe > 0.) { vec2 off = (vUv - .5) * chroma; col.r = mix(col.r, texture2D(tScene, vUv + off).r, fringe); col.b = mix(col.b, texture2D(tScene, vUv - off).b, fringe); }
  col += (texture2D(tBloomA, vUv).rgb * .6 + texture2D(tBloomB, vUv).rgb * .8) * bloomStrength;
  col = aces(col * exposure);
  float l = dot(col, vec3(.2126,.7152,.0722));
  col = mix(col, col * shadowTint * 2., shadowAmount * (1. - smoothstep(0., .5, l)));
  col = mix(col, col * highlightTint * 1.6, highlightAmount * smoothstep(.4, 1., l));
  col = mix(vec3(l), col, saturation);
  col = (col - .18) * contrast + .18;
  vec2 v = (vUv - .5) * vec2(resolution.x / resolution.y, 1.) * vignette.z;
  col *= 1. - vignette.x * smoothstep(vignette.y * .6, 1.0, length(v));
  col = pow(max(col, 0.), vec3(1. / 2.2));
  col += (hash(vUv * resolution) - .5) * grain;
  gl_FragColor = vec4(col, 1.);
}`;

/**
 * The finishing chain for cinematic shots: lens blur (tilt-shift band), selective bloom, ACES
 * tone mapping, split-tone grade, vignette, sharp-only colour fringing and grain, in that order.
 *
 * `mode: 'film'` (default) averages `samples` jittered renders per frame for clean edges and soft
 * shadows, and suits frame-by-frame export. `mode: 'interactive'` renders once per frame and,
 * when the caller reports the view is still, refines over up to 16 frames.
 */
export function cinematicPost(T, renderer, spec = {}) {
  requireThree(T);
  assert(
    renderer && typeof renderer.render === 'function' && typeof renderer.setRenderTarget === 'function',
    'INVALID_RENDERER',
    'Pass a THREE.WebGLRenderer.',
  );
  options(
    spec,
    ['width', 'height', 'lens', 'grade', 'rig', 'mode', 'samples', 'taps', 'stillSamples'],
    'cinematicPost',
  );
  const mode = spec.mode ?? 'film';
  assert(mode === 'film' || mode === 'interactive', 'INVALID_MODE', "mode is 'film' or 'interactive'.");
  const lens = spec.lens,
    grade = spec.grade;
  assert(lens?.bloom && grade?.splitTone, 'INVALID_STYLE', 'Pass a lens pack and a grade pack.');
  const samples = number(spec.samples ?? (mode === 'film' ? 64 : 1), 'film samples', 1, 256);
  const stillMax = number(spec.stillSamples ?? 16, 'still samples', 1, 64);
  let width = number(spec.width ?? 1920, 'width', 16, 8192),
    height = number(spec.height ?? 1080, 'height', 16, 8192);
  assert(width * height <= 8_294_400, 'RESOURCE_LIMIT', 'The post chain supports up to 3840 x 2160 pixels.');
  const owned = [],
    targets = [];
  const target = (w, h, msaa = 0) => {
    const t = new T.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), { type: T.HalfFloatType, samples: msaa });
    targets.push(t);
    return t;
  };
  let rt;
  const build = () => {
    for (const t of targets.splice(0)) t.dispose();
    rt = {
      scene: target(width, height, 4),
      accum: target(width, height),
      a: target(width >> 1, height >> 1),
      b: target(width >> 1, height >> 1),
      c: target(width >> 2, height >> 2),
      d: target(width >> 2, height >> 2),
    };
  };
  build();
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    quadGeo = new T.PlaneGeometry(2, 2),
    quad = new T.Mesh(quadGeo),
    passScene = new T.Scene();
  passScene.add(quad);
  const blurMat = new T.ShaderMaterial({
    uniforms: { tSource: { value: null }, direction: { value: new T.Vector2() }, threshold: { value: 0 } },
    vertexShader: VERT,
    fragmentShader: BLUR_FRAG,
  });
  const accumMat = new T.ShaderMaterial({
    uniforms: { tSource: { value: null }, weight: { value: 1 } },
    vertexShader: VERT,
    fragmentShader: ACCUM_FRAG,
    transparent: true,
    blending: T.AdditiveBlending,
    depthTest: false,
  });
  const band = lens.interactive ?? {};
  const st = grade.splitTone;
  const srgb = (c) => toRGBA(c).slice(0, 3);
  const compMat = new T.ShaderMaterial({
    uniforms: {
      tScene: { value: null },
      tBloomA: { value: null },
      tBloomB: { value: null },
      resolution: { value: new T.Vector2(width, height) },
      focusCenter: { value: band.center ?? 0.5 },
      halfWidth: { value: band.halfWidth ?? 0.17 },
      falloff: { value: band.falloff ?? 0.32 },
      maxBlur: { value: band.maxBlur ?? 0.007 },
      angle: { value: ((band.angleDeg ?? 0) * Math.PI) / 180 },
      bloomStrength: { value: lens.bloom.strength ?? 0.5 },
      exposure: { value: spec.rig?.exposure ?? 1 },
      shadowTint: { value: new T.Vector3(...srgb(st.shadows)) },
      shadowAmount: { value: st.shadowAmount ?? 0 },
      highlightTint: { value: new T.Vector3(...srgb(st.highlights)) },
      highlightAmount: { value: st.highlightAmount ?? 0 },
      saturation: { value: grade.saturation ?? 1 },
      contrast: { value: grade.contrast ?? 1 },
      vignette: {
        value: new T.Vector3(
          grade.vignette?.amount ?? 0,
          grade.vignette?.softness ?? 0.55,
          grade.vignette?.roundness ?? 0.8,
        ),
      },
      grain: { value: mode === 'film' ? (grade.grain?.amount ?? 0) : 0 },
      chroma: { value: grade.chromaticAberration ?? 0 },
      seed: { value: 0 },
      taps: { value: number(spec.taps ?? (mode === 'film' ? 32 : 9), 'lens taps', 1, 64) },
    },
    vertexShader: VERT,
    fragmentShader: COMPOSITE_FRAG,
  });
  const normMat = new T.ShaderMaterial({
    uniforms: { tSource: { value: null }, weight: { value: 1 } },
    vertexShader: VERT,
    fragmentShader: ACCUM_FRAG,
    blending: T.NoBlending,
    depthTest: false,
  });
  owned.push(quadGeo, blurMat, accumMat, normMat, compMat);
  const pass = (material, out) => {
    quad.material = material;
    renderer.setRenderTarget(out);
    renderer.render(passScene, camera);
  };
  const blur = (src, tmp, dst, threshold, spread) => {
    blurMat.uniforms.tSource.value = src.texture;
    blurMat.uniforms.threshold.value = threshold;
    blurMat.uniforms.direction.value.set(spread / tmp.width, 0);
    pass(blurMat, tmp);
    blurMat.uniforms.tSource.value = tmp.texture;
    blurMat.uniforms.threshold.value = 0;
    blurMat.uniforms.direction.value.set(0, spread / tmp.height);
    pass(blurMat, dst);
  };
  // Sub-pixel jitter offsets (Halton 2, 3), so averaged frames resolve edges and soft shadows.
  const halton = (i, b) => {
    let f = 1,
      r = 0;
    for (let n = i; n > 0; n = Math.floor(n / b)) {
      f /= b;
      r += f * (n % b);
    }
    return r;
  };
  let still = 0,
    disposed = false;
  const accumulate = (scene, cam, start, count, onSample, total) => {
    for (let s = start; s < start + count; s++) {
      // The caller may move the light, the lens or the clock a little for each sample, which
      // turns the average into soft shadows, depth of field and motion blur.
      if (onSample) onSample(s, total);
      const jx = halton(s + 1, 2) - 0.5,
        jy = halton(s + 1, 3) - 0.5;
      if (cam.setViewOffset) cam.setViewOffset(width, height, jx, jy, width, height);
      renderer.setRenderTarget(rt.scene);
      renderer.render(scene, cam);
      accumMat.uniforms.tSource.value = rt.scene.texture;
      accumMat.uniforms.weight.value = 1;
      // The sum must survive between passes, so this one render must not clear its target.
      const clears = renderer.autoClear;
      renderer.autoClear = false;
      try {
        pass(accumMat, rt.accum);
      } finally {
        renderer.autoClear = clears;
      }
    }
    if (cam.clearViewOffset) cam.clearViewOffset();
  };
  const finish = (total, frame) => {
    // Normalise the accumulated sum into the scene target, then blur and composite.
    normMat.uniforms.tSource.value = rt.accum.texture;
    normMat.uniforms.weight.value = 1 / total;
    pass(normMat, rt.scene);
    blur(rt.scene, rt.b, rt.a, lens.bloom.threshold ?? 0.85, 1.4);
    blur(rt.a, rt.d, rt.c, 0, 2.2);
    const U = compMat.uniforms;
    U.tScene.value = rt.scene.texture;
    U.tBloomA.value = rt.a.texture;
    U.tBloomB.value = rt.c.texture;
    U.seed.value = (frame % 997) * 0.618;
    pass(compMat, null);
  };
  const clearAccum = () => {
    renderer.setRenderTarget(rt.accum);
    renderer.setClearColor?.(0x000000, 0);
    renderer.clear();
  };
  return {
    mode,
    get size() {
      return { width, height };
    },
    /** Samples accumulated so far for the current still view (interactive mode). */
    get stillSamples() {
      return still;
    },
    /**
     * Render and finish one frame to the screen. In interactive mode pass `still: true` while
     * the camera and story clock are stopped; any frame with `still: false` resets refinement.
     * `onSample(index, count)` runs before each averaged render, so a scene can jitter its
     * light, lens or clock per sample.
     */
    render(scene, cam, s = {}) {
      assert(!disposed, 'DISPOSED', 'This post chain was disposed.');
      options(s, ['frame', 'still', 'onSample'], 'render');
      assert(
        s.onSample === undefined || typeof s.onSample === 'function',
        'INVALID_OPTIONS',
        'onSample is a function of (index, count).',
      );
      const frame = number(s.frame ?? 0, 'frame', 0, 1e7);
      if (mode === 'film') {
        clearAccum();
        accumulate(scene, cam, 0, samples, s.onSample, samples);
        finish(samples, frame);
        return samples;
      }
      // A moving view renders one fresh sample; a still view adds samples up to stillMax.
      if (!s.still) still = 0;
      if (still < stillMax) {
        if (still === 0) clearAccum();
        accumulate(scene, cam, still, 1, s.onSample, stillMax);
        still++;
      }
      finish(still, frame);
      return still;
    },
    setSize(w, h) {
      width = number(w, 'width', 16, 8192);
      height = number(h, 'height', 16, 8192);
      assert(width * height <= 8_294_400, 'RESOURCE_LIMIT', 'The post chain supports up to 3840 x 2160 pixels.');
      build();
      compMat.uniforms.resolution.value.set(width, height);
      still = 0;
    },
    /** Lens taps for the interactive tier (the quality governor's dofTaps). */
    setTaps(n) {
      compMat.uniforms.taps.value = number(n, 'lens taps', 1, 64);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.setRenderTarget(null);
      for (const o of [...targets, ...owned]) o.dispose?.();
    },
  };
}

// ------------------------------------------------------------------ source documents

/**
 * Paint a laid-out document page into a 2D canvas context you own, using font outlines so the
 * page looks the same on every machine. `layout` is from layoutDocument(); `pxPerMm` sets the
 * texture resolution. Highlights are [{rects, drawn, color}] from highlightSchedule().
 */
export function paintDocument(ctx, layout, spec = {}) {
  assert(
    ctx && typeof ctx.fillRect === 'function' && typeof ctx.beginPath === 'function',
    'INVALID_CONTEXT',
    'Pass a 2D canvas context.',
  );
  assert(layout && Array.isArray(layout.lines), 'INVALID_LAYOUT', 'Pass the result of layoutDocument().');
  options(spec, ['font', 'pxPerMm', 'paper', 'ink', 'highlights', 'imprint', 'size'], 'paintDocument');
  const px = number(spec.pxPerMm ?? 8, 'pixels per mm', 0.5, 64);
  const css = (c) => {
    const [r, g, b, a] = toRGBA(c);
    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
  };
  if (spec.paper !== undefined && spec.size) {
    ctx.fillStyle = css(spec.paper);
    ctx.fillRect(0, 0, spec.size[0] * px, spec.size[1] * px);
  }
  for (const h of spec.highlights ?? []) {
    ctx.fillStyle = css(h.color ?? 'hsla(52, 96%, 60%, 0.55)');
    for (const r of h.rects ?? []) ctx.fillRect(r.x * px, r.y * px, r.width * (r.drawn ?? 1) * px, r.height * px);
  }
  ctx.fillStyle = css(spec.ink ?? 'hsla(30, 14%, 11%, 0.94)');
  // Words covered by an imprint rectangle are drawn faintly: the phrase has lifted off the page.
  const imprint = spec.imprint ?? null;
  for (const line of layout.lines)
    for (const word of line.words) {
      const faded =
        imprint &&
        imprint.rects.some(
          (r) =>
            word.x + word.width / 2 >= r.x &&
            word.x + word.width / 2 <= r.x + r.width &&
            line.y >= r.y - 0.01 &&
            line.y <= r.y + r.height,
        );
      ctx.globalAlpha = faded ? imprint.strength : 1;
      const { commands } = textOutline(spec.font, word.text, {
        size: line.size * px,
        x: word.x * px,
        y: line.baseline * px,
        missing: 'notdef',
      });
      ctx.beginPath();
      for (const [op, ...v] of commands) {
        if (op === 'M') ctx.moveTo(v[0], v[1]);
        else if (op === 'L') ctx.lineTo(v[0], v[1]);
        else if (op === 'Q') ctx.quadraticCurveTo(v[0], v[1], v[2], v[3]);
        else if (op === 'C') ctx.bezierCurveTo(v[0], v[1], v[2], v[3], v[4], v[5]);
        else if (op === 'Z') ctx.closePath();
      }
      ctx.fill();
    }
  ctx.globalAlpha = 1;
}

/**
 * The torn paper chip that carries a lifted phrase (the motion pack's `chip` mode). `rect` is
 * the phrase rectangle in millimetres; `texture` is an optional caller-made texture of the phrase.
 * Use applyLift() each frame to place it from a liftSchedule pose.
 */
export function liftChip(T, spec = {}) {
  requireThree(T);
  options(spec, ['rect', 'chip', 'texture', 'paper', 'seed'], 'liftChip');
  const r = spec.rect;
  assert(
    r && typeof r.width === 'number' && typeof r.height === 'number',
    'INVALID_PHRASE',
    'Pass the phrase rectangle in millimetres.',
  );
  const chip = spec.chip ?? { padding_mm: 2, tearAmplitude_mm: 0.6, tearFrequency: 1.4, thickness_mm: 0.15 };
  const pad = number(chip.padding_mm ?? 2, 'padding', 0, 100),
    amp = number(chip.tearAmplitude_mm ?? 0.6, 'tear amplitude', 0, 20) / 1000;
  const w = (number(r.width, 'width', 0.1, 2000) + pad * 2) / 1000,
    h = (number(r.height, 'height', 0.1, 2000) + pad * 2) / 1000;
  const seed = number(spec.seed ?? 1, 'seed', 0, 1e6);
  const edge = (t, k) =>
    amp *
    (gradientRaw2(t * 9 * (chip.tearFrequency ?? 1.4), k + seed, 3) * 0.7 +
      gradientRaw2(t * 23, k * 3 + seed, 4) * 0.3);
  const shape = new T.Shape(),
    steps = 48;
  for (let i = 0; i <= steps; i++)
    shape[i ? 'lineTo' : 'moveTo'](-w / 2 + (w * i) / steps, -h / 2 + edge(i / steps, 1));
  for (let i = 1; i <= 12; i++) shape.lineTo(w / 2 + edge(i / 12, 2), -h / 2 + (h * i) / 12);
  for (let i = 1; i <= steps; i++) shape.lineTo(w / 2 - (w * i) / steps, h / 2 + edge(i / steps, 3));
  for (let i = 1; i < 12; i++) shape.lineTo(-w / 2 + edge(i / 12, 4), h / 2 - (h * i) / 12);
  const geo = new T.ExtrudeGeometry(shape, { depth: (chip.thickness_mm ?? 0.15) / 1000, bevelEnabled: false });
  const uv = geo.attributes.uv,
    pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
  const paper = new T.Color(...linear(spec.paper ?? 'hsla(42, 30%, 88%, 1)'));
  const front = new T.MeshStandardMaterial({
    color: spec.texture ? 0xffffff : paper,
    map: spec.texture ?? null,
    roughness: 0.9,
  });
  const side = new T.MeshStandardMaterial({ color: paper.clone().multiplyScalar(0.85), roughness: 0.95 });
  const mesh = new T.Mesh(geo, [front, side]);
  mesh.castShadow = true;
  const holder = new T.Group();
  holder.name = 'lift-chip';
  holder.add(mesh);
  const flat = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2),
    facing = new T.Quaternion(),
    look = new T.Matrix4(),
    up = new T.Vector3(0, 1, 0);
  let disposed = false;
  return {
    object: holder,
    /** Place the chip from a liftSchedule pose, turning it toward `camera` by pose.faceCamera. */
    apply(pose, camera) {
      assert(!disposed, 'DISPOSED', 'This chip was disposed.');
      holder.position.set(pose.position.x, pose.position.y, pose.position.z);
      look.lookAt(camera.position, holder.position, up);
      facing.setFromRotationMatrix(look);
      holder.quaternion.copy(flat).slerp(facing, Math.min(1, Math.max(0, pose.faceCamera)));
      holder.rotateZ((pose.flutterDeg * Math.PI) / 180);
      holder.scale.setScalar(pose.scale);
      holder.visible = pose.phase !== 'rest';
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      holder.removeFromParent?.();
      geo.dispose();
      front.dispose();
      side.dispose();
    },
  };
}

// ------------------------------------------------------------------------- highlights

// Highlighting is an editorial act, separate from drawing the land. A highlight marks the
// subject of a beat: a path, an area or a place. Each one enters, holds and leaves on its own
// schedule, and its look is a pure function of time.

export const HIGHLIGHT_KINDS = Object.freeze({
  path: Object.freeze(['glow', 'trace', 'dash', 'pulse', 'ribbon']),
  area: Object.freeze(['outline', 'wash', 'spotlight', 'hatch', 'contours', 'wall', 'raise']),
  place: Object.freeze(['ring', 'pin', 'beacon']),
});

const HL_EASE = {
  linear: (t) => t,
  smooth: (t) => t * t * (3 - 2 * t),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outCubic: (t) => 1 - (1 - t) ** 3,
  outBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
};
function envelope(spec, defaults) {
  const at = number(spec.at ?? 0, 'highlight start', -1e7, 1e7),
    duration = number(spec.duration ?? defaults.duration, 'highlight duration', 0, 600),
    out = spec.out === undefined ? Infinity : number(spec.out, 'highlight end', at, 1e7),
    outDuration = number(spec.outDuration ?? 0.8, 'highlight exit duration', 0, 600);
  const ease = HL_EASE[spec.ease ?? defaults.ease ?? 'inOutCubic'];
  assert(ease, 'INVALID_EASE', `Use one of ${Object.keys(HL_EASE).join(', ')}.`);
  const ramp = (t, a, d) => (d === 0 ? (t >= a ? 1 : 0) : Math.min(1, Math.max(0, (t - a) / d)));
  return (time) => ({
    enter: ease(ramp(time, at, duration)),
    raw: ramp(time, at, duration),
    exit: out === Infinity ? 1 : 1 - HL_EASE.smooth(ramp(time, out, outDuration)),
    age: time - at,
  });
}

const LINE_VERT = `
attribute vec2 lineUv; varying vec2 vLine; varying float vHeight;
void main(){ vLine = lineUv; vHeight = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const LINE_FRAG = `
uniform vec3 color; uniform float draw, fade, time, kind, lengthScale, intensity; varying vec2 vLine;
void main(){
  float along = vLine.x, across = abs(vLine.y);
  if (along > draw) discard;
  float a;
  if (kind < 0.5) {            // glow: hot core and soft halo
    a = exp(-across * across * 40.0) * 1.0 + exp(-across * across * 4.0) * 0.35;
  } else if (kind < 1.5) {     // trace: a crisp ink line
    a = 1.0 - smoothstep(0.32, 0.42, across);
  } else if (kind < 2.5) {     // dash: marching dashes
    a = (1.0 - smoothstep(0.3, 0.4, across)) * step(0.45, fract(along * lengthScale - time * 0.8));
  } else if (kind < 3.5) {     // pulse: packets of light travelling downstream
    float p = fract(along * lengthScale * 0.25 - time * 0.6);
    a = exp(-across * across * 30.0) * (0.25 + 1.6 * exp(-pow((p - 0.5) * 9.0, 2.0)));
  } else {                     // ribbon: a curtain that fades upward
    a = pow(1.0 - vLine.y, 1.6) * 0.5;
  }
  // The leading edge of a draw-on is brighter, like a pen of light.
  float head = draw < 1.0 ? exp(-pow((draw - along) * 40.0, 2.0)) * 1.5 : 0.0;
  gl_FragColor = vec4(color * intensity * (1.0 + head), clamp(a * fade, 0.0, 1.0));
}`;
const AREA_VERT = `
attribute float signedEdge; attribute float sweep; attribute float turn;
varying float vEdge; varying float vSweep; varying float vTurn; varying float vY;
void main(){ vEdge = signedEdge; vSweep = sweep; vTurn = turn; vY = position.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const AREA_FRAG = `
uniform vec3 color; uniform float draw, fade, time, kind, feather, interval, intensity;
varying float vEdge; varying float vSweep; varying float vTurn; varying float vY;
void main(){
  float inside = smoothstep(-feather, feather, vEdge);
  float a; vec3 c = color * intensity;
  if (kind < 0.5) {            // outline: a band on the edge, drawn around the shape
    a = exp(-pow(vEdge / feather, 2.0)) * step(vTurn, draw);
  } else if (kind < 1.5) {     // wash: a colour sweeping across the region
    a = inside * 0.42 * (1.0 - smoothstep(draw - 0.1, draw, vSweep));
  } else if (kind < 2.5) {     // spotlight: everything outside the region dims
    a = (1.0 - inside) * 0.62 * draw; c = vec3(0.0);
  } else if (kind < 3.5) {     // hatch: drifting diagonal stripes
    a = inside * 0.5 * step(0.6, fract((vSweep * 60.0) + time * 0.4)) * draw;
  } else {                     // contours: height lines appear inside
    float line = abs(fract(vY / interval) - 0.5);
    a = inside * smoothstep(0.42, 0.5, line) * draw;
  }
  gl_FragColor = vec4(c, clamp(a * fade, 0.0, 1.0));
}`;

/**
 * Highlights for a reliefMap: glowing or inked paths, regions that wash, dim the rest, hatch,
 * show contours, grow walls or lift out of the map, and places marked with rings, pins or
 * beacons. Add one with path(), area() or place(), pose them all with setTime(time).
 */
export function mapHighlights(T, map, spec = {}) {
  requireThree(T);
  assert(
    map && map.group && map.terrain && typeof map.toScene === 'function',
    'INVALID_MAP',
    'Pass a map made with reliefMap().',
  );
  options(spec, ['style'], 'mapHighlights');
  const style = spec.style ?? {};
  const W = map.width;
  const group = new T.Group();
  group.name = 'highlights';
  map.group.add(group);
  const items = new Map(),
    owned = [];
  const defaultColor = style.rivers?.core?.color ?? 'hsla(192, 100%, 90%, 1)';
  const colorOf = (c, scale = 1) => new T.Color(...linear(c ?? defaultColor, scale));
  const id = (name) => {
    assert(
      typeof name === 'string' && name.length > 0 && name.length <= 128 && !items.has(name),
      'INVALID_HIGHLIGHT',
      'Each highlight needs a new, short string id.',
    );
    return name;
  };
  const sceneLine = (points) => {
    if (typeof points === 'string') return map.riverPath(points).map((p) => ({ x: p.x, y: p.y, z: p.z }));
    assert(
      Array.isArray(points) && points.length >= 2 && points.length <= 100000,
      'INVALID_HIGHLIGHT',
      'A path is a river id or 2 to 100000 region points.',
    );
    return points.map((p) => {
      const q = map.toScene(p.x, p.y);
      return { x: q.x, y: map.groundAt(q.x, q.z), z: q.z };
    });
  };

  // A flat strip along a line, lying on the ground (or standing up, for a ribbon).
  function strip(pts, width, standing, height) {
    const n = pts.length,
      cumulative = [0];
    for (let q = 1; q < n; q++)
      cumulative.push(cumulative[q - 1] + Math.hypot(pts[q].x - pts[q - 1].x, pts[q].z - pts[q - 1].z));
    const total = cumulative.at(-1) || 1;
    const pos = new Float32Array(n * 2 * 3),
      uv = new Float32Array(n * 2 * 2),
      idx = new Uint32Array((n - 1) * 6);
    for (let q = 0; q < n; q++) {
      const a = pts[Math.max(0, q - 1)],
        b = pts[Math.min(n - 1, q + 1)];
      let tx = b.x - a.x,
        tz = b.z - a.z;
      const l = Math.hypot(tx, tz) || 1;
      tx /= l;
      tz /= l;
      const p = pts[q],
        lift = 4e-4 * W;
      if (standing) {
        pos.set([p.x, p.y + lift, p.z, p.x, p.y + lift + height, p.z], q * 6);
        uv.set([cumulative[q] / total, 0, cumulative[q] / total, 1], q * 4);
      } else {
        pos.set(
          [p.x - tz * width, p.y + lift, p.z + tx * width, p.x + tz * width, p.y + lift, p.z - tx * width],
          q * 6,
        );
        uv.set([cumulative[q] / total, -1, cumulative[q] / total, 1], q * 4);
      }
    }
    for (let q = 0; q < n - 1; q++) idx.set([q * 2, q * 2 + 2, q * 2 + 1, q * 2 + 1, q * 2 + 2, q * 2 + 3], q * 6);
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('lineUv', new T.BufferAttribute(uv, 2));
    g.setIndex(new T.BufferAttribute(idx, 1));
    owned.push(g);
    return { geometry: g, length: total };
  }
  const lineMaterial = (kind, color, intensity, additive) => {
    const m = new T.ShaderMaterial({
      uniforms: {
        color: { value: colorOf(color) },
        draw: { value: 0 },
        fade: { value: 0 },
        time: { value: 0 },
        kind: { value: HIGHLIGHT_KINDS.path.indexOf(kind) },
        lengthScale: { value: 1 },
        intensity: { value: intensity },
      },
      vertexShader: LINE_VERT,
      fragmentShader: LINE_FRAG,
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
      blending: additive ? T.AdditiveBlending : T.NormalBlending,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
    });
    owned.push(m);
    return m;
  };

  // Per-vertex distances from an area's edge, over the terrain mesh, for the area shaders.
  function areaField(outline) {
    assert(
      Array.isArray(outline) && outline.length >= 3 && outline.length <= 4000,
      'INVALID_HIGHLIGHT',
      'An area outline has 3 to 4000 region points.',
    );
    const ring = outline.map((p) => {
      const q = map.toScene(p.x, p.y);
      return { x: q.x, z: q.z };
    });
    const cx = ring.reduce((s, p) => s + p.x, 0) / ring.length,
      cz = ring.reduce((s, p) => s + p.z, 0) / ring.length;
    const xs = ring.map((p) => p.x);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs);
    const pos = map.terrain.attributes.position,
      n = pos.count;
    assert(n * ring.length <= 400_000_000, 'RESOURCE_LIMIT', 'This area outline is too detailed for the terrain grid.');
    const edge = new Float32Array(n),
      sweep = new Float32Array(n),
      turn = new Float32Array(n);
    for (let v = 0; v < n; v++) {
      const x = pos.getX(v),
        z = pos.getZ(v);
      let best = Infinity,
        hit = false;
      for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
        const ax = ring[b].x,
          az = ring[b].z,
          dx = ring[a].x - ax,
          dz = ring[a].z - az;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
        best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
        if (
          ring[a].z > z !== ring[b].z > z &&
          x < ((ring[b].x - ring[a].x) * (z - ring[a].z)) / (ring[b].z - ring[a].z) + ring[a].x
        )
          hit = !hit;
      }
      edge[v] = hit ? best : -best;
      sweep[v] = (x - minX) / (maxX - minX || 1);
      turn[v] = (Math.atan2(z - cz, x - cx) + Math.PI) / (2 * Math.PI);
    }
    return { ring, edge, sweep, turn, centre: { x: cx, z: cz } };
  }
  function areaOverlay(field, kind, color, s) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', map.terrain.attributes.position);
    g.setIndex(map.terrain.index);
    g.setAttribute('signedEdge', new T.BufferAttribute(field.edge, 1));
    g.setAttribute('sweep', new T.BufferAttribute(field.sweep, 1));
    g.setAttribute('turn', new T.BufferAttribute(field.turn, 1));
    const m = new T.ShaderMaterial({
      uniforms: {
        color: { value: colorOf(color) },
        draw: { value: 0 },
        fade: { value: 0 },
        time: { value: 0 },
        kind: { value: ['outline', 'wash', 'spotlight', 'hatch', 'contours'].indexOf(kind) },
        feather: { value: number(s.feather ?? 0.0018 * W, 'feather', 1e-6, 1e4) },
        interval: { value: number(s.interval ?? 0.01 * W, 'contour interval', 1e-6, 1e4) },
        intensity: { value: number(s.intensity ?? (kind === 'outline' ? 1.3 : 1), 'intensity', 0, 100) },
      },
      vertexShader: AREA_VERT,
      fragmentShader: AREA_FRAG,
      transparent: true,
      depthWrite: false,
      blending: kind === 'outline' ? T.AdditiveBlending : T.NormalBlending,
      polygonOffset: true,
      polygonOffsetFactor: -8,
      polygonOffsetUnits: -8,
    });
    owned.push(g, m);
    const mesh = new T.Mesh(g, m);
    mesh.renderOrder = 2;
    return mesh;
  }
  // The land inside an area as its own piece: the top surface and side walls down to a base.
  function liftedPiece(field) {
    const src = map.terrain,
      pos = src.attributes.position,
      col = src.attributes.color,
      index = src.index.array;
    const keep = new Map(),
      top = [],
      edges = new Map();
    for (let t = 0; t < index.length; t += 3) {
      const tri = [index[t], index[t + 1], index[t + 2]];
      if (!tri.every((v) => field.edge[v] >= 0)) continue;
      for (const v of tri) if (!keep.has(v)) keep.set(v, keep.size);
      top.push(...tri.map((v) => keep.get(v)));
      for (let e = 0; e < 3; e++) {
        const a = tri[e],
          b = tri[(e + 1) % 3],
          key = a < b ? `${a},${b}` : `${b},${a}`;
        edges.set(key, edges.has(key) ? null : [a, b]);
      }
    }
    assert(
      keep.size > 0,
      'INVALID_HIGHLIGHT',
      'This area covers no terrain samples. Draw a larger area or use a finer grid.',
    );
    // Cut along the outline, not along the ground grid: every vertex on the edge of the piece
    // moves sideways onto the nearest point of the outline, so the cut is a clean curve. The
    // terrain itself moves with it, by less than one cell, so piece, socket and land still meet.
    const rimSet = new Set();
    for (const pair of edges.values()) if (pair) pair.forEach((v) => rimSet.add(v));
    const ring = field.ring;
    for (const v of rimSet) {
      const x = pos.getX(v),
        z = pos.getZ(v);
      let best = Infinity,
        bx = x,
        bz = z;
      for (let a = 0, b2 = ring.length - 1; a < ring.length; b2 = a++) {
        const ax = ring[b2].x,
          az = ring[b2].z,
          dx = ring[a].x - ax,
          dz = ring[a].z - az;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
        const px = ax + dx * t,
          pz = az + dz * t,
          d = Math.hypot(x - px, z - pz);
        if (d < best) {
          best = d;
          bx = px;
          bz = pz;
        }
      }
      pos.setXYZ(v, bx, map.groundAt(bx, bz), bz);
    }
    pos.needsUpdate = true;
    // The piece is a solid block of ground: the surface on top, earth walls all round and a flat
    // underside. Its thickness is a share of its own size, so it reads as a slab, not a sheet.
    const ys = [...keep.keys()].map((v) => pos.getY(v));
    const low = Math.min(...ys),
      thickness = Math.max(0.012 * W, (Math.max(...ys) - low) * 0.35),
      base = low - thickness;
    const soil = linear('hsla(28, 42%, 44%, 1)'),
      subsoil = linear('hsla(22, 36%, 31%, 1)'),
      rock = linear('hsla(24, 14%, 24%, 1)');
    const verts = [],
      colors = [];
    for (const v of keep.keys()) {
      verts.push(pos.getX(v), pos.getY(v), pos.getZ(v));
      colors.push(col.getX(v), col.getY(v), col.getZ(v));
    }
    // Underside: the same triangles, flattened at the base and wound the other way.
    const under = verts.length / 3;
    for (const v of keep.keys()) {
      verts.push(pos.getX(v), base, pos.getZ(v));
      colors.push(...rock);
    }
    const bottom = [];
    for (let t = 0; t < top.length; t += 3) bottom.push(under + top[t], under + top[t + 2], under + top[t + 1]);
    // Walls in three bands, so the cut shows topsoil over darker earth over rock.
    const walls = [],
      rim = [];
    for (const pair of edges.values()) {
      if (!pair) continue;
      rim.push(pair);
      const [a, b2] = pair;
      const levels = (v) => {
        const top0 = pos.getY(v);
        return [top0, top0 - (top0 - base) * 0.18, top0 - (top0 - base) * 0.6, base];
      };
      const la = levels(a),
        lb = levels(b2),
        tones = [soil, soil, subsoil, rock];
      const o = verts.length / 3;
      for (let k = 0; k < 4; k++) {
        verts.push(pos.getX(a), la[k], pos.getZ(a), pos.getX(b2), lb[k], pos.getZ(b2));
        colors.push(...tones[k], ...tones[k]);
      }
      for (let k = 0; k < 3; k++)
        walls.push(o + k * 2, o + k * 2 + 2, o + k * 2 + 1, o + k * 2 + 1, o + k * 2 + 2, o + k * 2 + 3);
    }
    const build = (positions, colours, triangles) => {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(new Float32Array(positions), 3));
      g.setAttribute('color', new T.BufferAttribute(new Float32Array(colours), 3));
      g.setIndex(triangles);
      g.computeVertexNormals();
      owned.push(g);
      return g;
    };
    const m = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, side: T.DoubleSide });
    owned.push(m);
    const piece = new T.Mesh(build(verts, colors, [...top, ...bottom, ...walls]), m);
    piece.castShadow = piece.receiveShadow = true;
    // The socket: the hole the piece leaves, with its own earth walls and a floor at the depth
    // of the piece's underside. It stays in the map while the piece is up.
    const sv = [],
      sc = [],
      si = [];
    const floorY = base;
    for (const v of keep.keys()) {
      sv.push(pos.getX(v), floorY, pos.getZ(v));
      sc.push(...subsoil.map((q) => q * 0.8));
    }
    si.push(...top);
    for (const [a, b2] of rim) {
      const o = sv.length / 3;
      sv.push(
        pos.getX(a),
        pos.getY(a),
        pos.getZ(a),
        pos.getX(b2),
        pos.getY(b2),
        pos.getZ(b2),
        pos.getX(a),
        floorY,
        pos.getZ(a),
        pos.getX(b2),
        floorY,
        pos.getZ(b2),
      );
      sc.push(...soil, ...soil, ...rock, ...rock);
      si.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
    }
    const socket = new T.Mesh(build(sv, sc, si), m);
    socket.receiveShadow = true;
    // The terrain without the piece, swapped in while the piece is out of the map.
    const cut = [];
    for (let t = 0; t < index.length; t += 3)
      if (!(field.edge[index[t]] >= 0 && field.edge[index[t + 1]] >= 0 && field.edge[index[t + 2]] >= 0))
        cut.push(index[t], index[t + 1], index[t + 2]);
    const cutIndex = new T.BufferAttribute(new Uint32Array(cut), 1);
    return { piece, socket, cutIndex, wholeIndex: src.index };
  }

  const api = {
    group,
    kinds: HIGHLIGHT_KINDS,
    /**
     * Highlight a path: a river id or region points. Kinds: glow, trace, dash, pulse, ribbon.
     * Options: at, duration, out, outDuration, ease, color, width, height (ribbon), intensity.
     */
    path(name, points, s = {}) {
      id(name);
      options(
        s,
        ['kind', 'at', 'duration', 'out', 'outDuration', 'ease', 'color', 'width', 'height', 'intensity'],
        'path highlight',
      );
      const kind = s.kind ?? 'glow';
      assert(
        HIGHLIGHT_KINDS.path.includes(kind),
        'INVALID_HIGHLIGHT',
        `Path highlights are ${HIGHLIGHT_KINDS.path.join(', ')}.`,
      );
      const pts = sceneLine(points);
      const width = number(
        s.width ?? (kind === 'glow' || kind === 'pulse' ? 0.006 : 0.0025) * W,
        'highlight width',
        1e-6,
        1e4,
      );
      const ribbon = kind === 'ribbon';
      const { geometry, length } = strip(pts, width, ribbon, number(s.height ?? 0.05 * W, 'ribbon height', 1e-6, 1e4));
      const intensity = number(
        s.intensity ?? (kind === 'trace' ? 1 : ribbon ? 0.9 : kind === 'dash' ? 1.4 : 2.2),
        'intensity',
        0,
        100,
      );
      const m = lineMaterial(
        kind,
        s.color ?? (kind === 'trace' ? 'hsla(355, 70%, 45%, 1)' : undefined),
        intensity,
        kind !== 'trace' && kind !== 'dash',
      );
      m.uniforms.lengthScale.value = length / (0.02 * W);
      const mesh = new T.Mesh(geometry, m);
      mesh.name = `highlight:${name}`;
      mesh.renderOrder = 3;
      group.add(mesh);
      items.set(name, { kind, mesh, env: envelope(s, { duration: ribbon ? 1.4 : 2.4 }), ribbon });
      return api;
    },
    /**
     * Highlight an area given by a region outline. Kinds: outline, wash, spotlight, hatch,
     * contours, wall, raise. `raise` lifts the land inside the area up out of the map.
     */
    area(name, outline, s = {}) {
      id(name);
      options(
        s,
        [
          'kind',
          'at',
          'duration',
          'out',
          'outDuration',
          'ease',
          'color',
          'feather',
          'interval',
          'intensity',
          'height',
          'lift',
          'tilt',
        ],
        'area highlight',
      );
      const kind = s.kind ?? 'outline';
      assert(
        HIGHLIGHT_KINDS.area.includes(kind),
        'INVALID_HIGHLIGHT',
        `Area highlights are ${HIGHLIGHT_KINDS.area.join(', ')}.`,
      );
      const field = areaField(outline);
      let mesh,
        extra = null;
      if (kind === 'wall') {
        const pts = [...field.ring, field.ring[0]].map((p) => ({ x: p.x, y: map.groundAt(p.x, p.z), z: p.z }));
        const { geometry } = strip(pts, 0, true, number(s.height ?? 0.04 * W, 'wall height', 1e-6, 1e4));
        mesh = new T.Mesh(
          geometry,
          lineMaterial('ribbon', s.color, number(s.intensity ?? 0.7, 'intensity', 0, 100), true),
        );
      } else if (kind === 'raise') {
        mesh = new T.Group();
        const solid = liftedPiece(field);
        mesh.add(solid.piece);
        // Water inside the area lifts with its land; the originals hide while the piece is up.
        const insideArea = (x, z) => {
          let hit = false;
          const r = field.ring;
          for (let a = 0, b = r.length - 1; a < r.length; b = a++)
            if (r[a].z > z !== r[b].z > z && x < ((r[b].x - r[a].x) * (z - r[a].z)) / (r[b].z - r[a].z) + r[a].x)
              hit = !hit;
          return hit;
        };
        const carried = [];
        for (const child of map.group.children) {
          if (!child.isMesh || !(child.name === 'lake' || child.name.startsWith('river:'))) continue;
          child.geometry.computeBoundingSphere();
          const c = child.geometry.boundingSphere.center;
          if (!insideArea(c.x, c.z)) continue;
          const copy = new T.Mesh(child.geometry, child.material);
          copy.position.copy(child.position);
          mesh.add(copy);
          carried.push(child);
        }
        mesh.userData.carried = carried;
        // The hole left behind is real geometry, and the terrain is drawn without the piece.
        extra = solid.socket;
        extra.name = `highlight-socket:${name}`;
        extra.userData.cut = solid;
        group.add(extra);
      } else
        mesh = areaOverlay(
          field,
          kind,
          s.color ??
            (kind === 'wash' ? 'hsla(42, 90%, 60%, 1)' : kind === 'hatch' ? 'hsla(355, 60%, 40%, 1)' : undefined),
          s,
        );
      mesh.name = `highlight:${name}`;
      group.add(mesh);
      items.set(name, {
        kind,
        mesh,
        extra,
        env: envelope(s, { duration: kind === 'raise' ? 1.6 : 1.2, ease: kind === 'raise' ? 'outBack' : 'inOutCubic' }),
        lift: number(s.lift ?? 0.025 * W, 'lift height', 0, 1e4),
        tilt: number(s.tilt ?? 0.12, 'tilt', -1.5, 1.5),
        centre: field.centre,
      });
      return api;
    },
    /** Mark a place: ring (ripples), pin (drops and bounces) or beacon (a beam of light). */
    place(name, at, s = {}) {
      id(name);
      options(s, ['kind', 'at', 'duration', 'out', 'outDuration', 'ease', 'color', 'size'], 'place highlight');
      options(at, ['x', 'y'], 'place');
      const kind = s.kind ?? 'ring';
      assert(
        HIGHLIGHT_KINDS.place.includes(kind),
        'INVALID_HIGHLIGHT',
        `Place highlights are ${HIGHLIGHT_KINDS.place.join(', ')}.`,
      );
      const q = map.toScene(at.x, at.y),
        ground = map.groundAt(q.x, q.z);
      const size = number(s.size ?? 0.02 * W, 'marker size', 1e-6, 1e4);
      const holder = new T.Group();
      holder.position.set(q.x, ground, q.z);
      const color = colorOf(
        s.color ?? (kind === 'pin' ? 'hsla(355, 75%, 52%, 1)' : undefined),
        kind === 'pin' ? 1 : 2.5,
      );
      const parts = [];
      if (kind === 'ring') {
        for (let r = 0; r < 3; r++) {
          const g = new T.RingGeometry(0.82, 1, 64);
          g.rotateX(-Math.PI / 2);
          const m = new T.MeshBasicMaterial({
            color,
            transparent: true,
            depthWrite: false,
            blending: T.AdditiveBlending,
            side: T.DoubleSide,
          });
          owned.push(g, m);
          const mesh = new T.Mesh(g, m);
          mesh.position.y = 6e-4 * W;
          holder.add(mesh);
          parts.push(mesh);
        }
      } else if (kind === 'pin') {
        const head = new T.SphereGeometry(size * 0.28, 24, 16),
          stem = new T.ConeGeometry(size * 0.12, size * 0.7, 16);
        stem.rotateX(Math.PI);
        stem.translate(0, size * 0.35, 0);
        head.translate(0, size * 0.8, 0);
        const m = new T.MeshStandardMaterial({ color, roughness: 0.35 });
        owned.push(head, stem, m);
        const pin = new T.Group();
        pin.add(new T.Mesh(head, m), new T.Mesh(stem, m));
        pin.children.forEach((c) => (c.castShadow = true));
        holder.add(pin);
        parts.push(pin);
      } else {
        const g = new T.CylinderGeometry(size * 0.08, size * 0.3, size * 6, 24, 1, true);
        g.translate(0, size * 3, 0);
        const m = new T.MeshBasicMaterial({
          color,
          transparent: true,
          depthWrite: false,
          blending: T.AdditiveBlending,
          side: T.DoubleSide,
        });
        owned.push(g, m);
        const beam = new T.Mesh(g, m);
        holder.add(beam);
        parts.push(beam);
      }
      holder.name = `highlight:${name}`;
      group.add(holder);
      items.set(name, {
        kind,
        mesh: holder,
        parts,
        size,
        env: envelope(s, { duration: kind === 'pin' ? 0.9 : 0.6, ease: kind === 'pin' ? 'outBack' : 'outCubic' }),
      });
      return api;
    },
    /** Pose every highlight at `time`. Pure in time, so seeking gives the same frame. */
    setTime(time) {
      number(time, 'time', -1e7, 1e7);
      for (const item of items.values()) {
        const e = item.env(time),
          visible = e.raw > 0 && e.exit > 0;
        item.mesh.visible = visible;
        if (item.extra) item.extra.visible = visible;
        if (!visible && item.kind === 'raise') {
          for (const original of item.mesh.userData.carried) original.visible = true;
          if (map.terrain.index !== item.extra.userData.cut.wholeIndex)
            map.terrain.setIndex(item.extra.userData.cut.wholeIndex);
        }
        if (!visible) continue;
        const u = item.mesh.material?.uniforms;
        if (HIGHLIGHT_KINDS.path.includes(item.kind)) {
          // Lines draw on along their length; a ribbon rises while it draws.
          u.draw.value = item.ribbon ? 1 : e.enter;
          u.fade.value = e.exit * (item.ribbon ? e.enter : 1);
          u.time.value = time;
          if (item.ribbon) item.mesh.scale.y = Math.max(1e-3, e.enter);
        } else if (item.kind === 'wall') {
          u.draw.value = 1;
          u.fade.value = e.exit * e.enter;
          item.mesh.scale.y = Math.max(1e-3, e.enter);
        } else if (item.kind === 'raise') {
          // The piece lifts, tilts slightly toward the viewer and casts its shadow on the socket.
          const lift = item.lift * e.enter * e.exit;
          item.mesh.position.set(0, lift, 0);
          item.mesh.rotation.x = item.tilt * e.enter * e.exit * 0.3;
          for (const original of item.mesh.userData.carried) original.visible = !(e.raw > 0 && e.exit > 0.02);
          if (map.terrain.index !== item.extra.userData.cut.cutIndex)
            map.terrain.setIndex(item.extra.userData.cut.cutIndex);
        } else if (u) {
          u.draw.value = e.enter;
          u.fade.value = e.exit;
          u.time.value = time;
        } else if (item.kind === 'ring') {
          item.parts.forEach((ring, r) => {
            const phase = (((e.age * 0.6 + r / 3) % 1) + 1) % 1;
            const radius = item.size * (0.3 + 2.4 * phase);
            ring.scale.set(radius, 1, radius);
            ring.material.opacity = (1 - phase) * e.enter * e.exit;
          });
        } else if (item.kind === 'pin') {
          const p = item.parts[0];
          p.position.y = item.size * 3 * (1 - e.enter);
          p.scale.setScalar(Math.max(1e-3, Math.min(1, e.raw * 3)) * e.exit);
        } else if (item.kind === 'beacon') {
          item.parts[0].scale.set(1, Math.max(1e-3, e.enter), 1);
          item.parts[0].material.opacity = 0.35 * e.exit * (0.85 + 0.15 * Math.sin(e.age * 4));
        }
      }
    },
    remove(name) {
      const item = items.get(name);
      assert(item, 'INVALID_HIGHLIGHT', `No highlight ${name}.`);
      item.mesh.removeFromParent();
      item.extra?.removeFromParent();
      items.delete(name);
    },
    dispose() {
      group.removeFromParent();
      for (const o of owned) o.dispose?.();
      items.clear();
    },
  };
  return api;
}
