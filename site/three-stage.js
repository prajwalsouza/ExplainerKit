// The 3D half of the story, rendered with Three.js (the library's optional solid renderer).
//   · The city is an ordinary ExplainerKit scene: rectangles laid flat and extruded by `depth`, bound to
//     scene parameters (a build progress and per-building hover lifts) and rendered by
//     `createThreeAdapter`. It builds outward from the park and thins into suburbs.
//   · Around it, a "land" scene holds the countryside and the region as curved patches of the Earth's
//     surface, painted procedurally, revealed outward from the city as the camera rises.
//   · The globe is the same Earth that is later cut open; while zooming, it is drawn with a camera
//     derived from the city camera, so one continuous camera travels from the street to space.
//   · The garden is caller-owned clay in the park: flowers placed by Poisson sampling, drifts of one
//     kind chosen by `distribution.pick`, clearings kept open by noise, and growth on springs.
// Everything varied uses seeded randomness, so every frame is reproducible.
import { scene } from 'explainerkit/core';
import { hsla, toHex } from 'explainerkit/color';
import { randomAt, noise2, fbm as fractalNoise } from 'explainerkit/noise';
import { spring } from 'explainerkit/physics';
import { stagger } from 'explainerkit/motion';
import { motionPath } from 'explainerkit/geometry';
import { points, distribution } from 'explainerkit/procedural';
import { createThreeAdapter } from 'explainerkit/renderers/three';
import { perspectiveCamera, projectPoint, pickBounds } from 'explainerkit/spatial';
import { LAND } from './geography.js';

export const EARTH_R = 6.371e6;
const SITE = { lon: 8.54, lat: 47.37 };
const B = 64, ROAD = 18, GRID = 13, HALF = (GRID * (B + ROAD)) / 2, PARK = { i: 6, j: 6 }, CORE = 4.3, EDGE = 6.4;
const r = (k, c, seed = 81) => randomAt(seed, k, c);
const bounded = (k, c, spread) => { const u = (r(k, c) + r(k, c + 50) + r(k, c + 90)) / 3;return (u - .5) * 2 * spread; }; // soft bell, never wild
const vary = ([h, s, l], k, c, amount = 1) => [h + bounded(k, c, 4 * amount), s + bounded(k, c + 1, 4 * amount), l + bounded(k, c + 2, 3 * amount)];
// Opaque #rrggbb: THREE.Color does not read the alpha byte that `toHex` appends.
const css = ([h, s, l]) => toHex(hsla(h, Math.max(0, Math.min(100, s)), Math.max(0, Math.min(100, l)))).slice(0, 7);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
/**
 * Long procedural work yields to the browser about every 6 ms (inside long rows too), so the story keeps animating while the
 * later chapters are painted. `scheduler.yield` where supported, otherwise a macrotask.
 */
let sliceStart = 0;
async function tick() {
  if (performance.now() - sliceStart < 6) return;
  await (globalThis.scheduler?.yield ? globalThis.scheduler.yield() : new Promise((r) => setTimeout(r, 0)));
  sliceStart = performance.now();
}
const blockOrigin = (i, j) => ({ x: -HALF + i * (B + ROAD) + ROAD / 2, y: -HALF + j * (B + ROAD) + ROAD / 2 });
const PARK_CENTRE = (() => { const o = blockOrigin(PARK.i, PARK.j);return { x: o.x + B / 2, y: o.y + B / 2 }; })();
/** Plan coordinates (x east, y south on the ground) to world: x right, y up, z south. */
export const toWorld = (x, y, h = 0) => ({ x: x - PARK_CENTRE.x, y: h, z: y - PARK_CENTRE.y });
/**
 * Smooth fractal noise: three octaves of the library's value noise, each turned to a different
 * angle so the lattice of any one octave never shows as squares.
 */
const fbm = (x, y, seed) => {
  // Explicit legacy artistic normalization preserves the existing landscape exactly.
  return fractalNoise(x, y, { seed, amplitude: .55, normalization: .8, offsetX: seed * .37 });
};
/** Height of the Earth's surface below the tangent plane at the city, at a horizontal distance. */
const surface = (x, z) => Math.sqrt(EARTH_R ** 2 - x * x - z * z) - EARTH_R;

// ---- The city plan: dense at the centre, thinning into suburbs, with a ragged edge ----------------
const PALETTE = { ivory: [38, 30, 90], sage: [100, 18, 64], peach: [24, 52, 84], stone: [36, 14, 80] };
function cityPlan() {
  const buildings = [], trees = [], pads = [];
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    const o = blockOrigin(i, j), k = i * 31 + j, dc = Math.hypot(i - PARK.i, j - PARK.j) + (r(k, 40) - .5) * 1.8;
    if (dc > EDGE) continue;
    const suburb = dc > CORE, delay = Math.max(0, dc) / EDGE * .9;
    const kind = i === PARK.i && j === PARK.j ? 'park' : r(k, 0) < (suburb ? .2 : .09) ? 'park' : r(k, 0) < (suburb ? .27 : .15) ? 'plaza' : 'built';
    pads.push({ x: o.x, y: o.y, kind, k, suburb, delay });
    const plant = (n, inset) => { for (let t = 0; t < n; t++) trees.push({ x: o.x + inset + r(k, 10 + t) * (B - inset * 2), y: o.y + inset + r(k, 30 + t) * (B - inset * 2), s: .7 + r(k, 50 + t) * .6, k: trees.length, delay: delay + .05 + r(k, 55 + t) * .1 }); };
    if (kind === 'park') { if (i !== PARK.i || j !== PARK.j) plant(6 + Math.floor(r(k, 1) * 6), 6); continue; }
    if (kind === 'plaza') continue;
    if (suburb) {
      // Suburb: one to three small houses in gardens, one per quarter of the block, and trees.
      const quarters = [0, 1, 2, 3].sort((a, b) => r(k, 60 + a) - r(k, 60 + b)), n = 1 + Math.floor(r(k, 2) * 3);
      for (let m = 0; m < n; m++) {
        const id = buildings.length, q = quarters[m], w = 12 + r(id, 1, 85) * 10, d = 10 + r(id, 2, 85) * 10;
        const x = o.x + (q % 2) * B / 2 + 3 + r(id, 3, 85) * (B / 2 - 6 - w), y = o.y + Math.floor(q / 2) * B / 2 + 3 + r(id, 4, 85) * (B / 2 - 6 - d);
        const tint = r(id, 5, 85) < .5 ? 'ivory' : r(id, 5, 85) < .8 ? 'peach' : 'sage';
        buildings.push({ id, x, y, w, d, h: 5 + r(id, 6, 85) * 5, color: vary(PALETTE[tint], id, 5), roof: r(id, 7, 85) < .7, delay: delay + r(id, 8, 85) * .08 });
      }
      plant(2 + Math.floor(r(k, 3) * 4), 4);
      continue;
    }
    // Core: split the block into one to four lots at uneven ratios.
    const lots = [{ x: o.x, y: o.y, w: B, h: B }];
    for (let s = 0; s < Math.floor(r(k, 2) * 3); s++) {
      const lot = lots.splice(Math.floor(r(k, 3 + s) * lots.length), 1)[0], f = .35 + r(k, 6 + s) * .3;
      if (lot.w > lot.h) lots.push({ ...lot, w: lot.w * f }, { ...lot, x: lot.x + lot.w * f, w: lot.w * (1 - f) });
      else lots.push({ ...lot, h: lot.h * f }, { ...lot, y: lot.y + lot.h * f, h: lot.h * (1 - f) });
    }
    const centre = Math.max(0, 1 - dc / 5.2);
    for (const lot of lots) {
      const id = buildings.length, sb = 3 + r(id, 1, 83) * 5, h = Math.max(7, Math.min(54, (8 + 30 * centre) * Math.exp(bounded(id, 2, .5)) + r(id, 3, 83) * 6));
      const tint = r(id, 4, 83) < .58 ? 'ivory' : r(id, 4, 83) < .86 ? 'sage' : 'peach';
      buildings.push({ id, x: lot.x + sb, y: lot.y + sb, w: lot.w - sb * 2, d: lot.h - sb * 2, h, color: vary(PALETTE[tint], id, 5), roof: r(id, 8, 83) < .35, delay: delay + r(id, 9, 83) * .08 });
    }
    if (r(k, 9) < .5) for (let t = 0; t < 2 + Math.floor(r(k, 11) * 3); t++) { const side = r(k, 60 + t) < .5;trees.push({ x: side ? o.x - 4 : o.x + r(k, 70 + t) * B, y: side ? o.y + r(k, 70 + t) * B : o.y - 4, s: .7 + r(k, 80 + t) * .4, k: trees.length, delay: delay + .1 }); }
  }
  return { buildings, trees, pads };
}
export const PLAN = cityPlan();
/**
 * The suburbs: the city's street grid continued past the 3D blocks, each block settled with a chance that falls off
 * with distance (varied by noise, so the edge frays rather than stops). Settled blocks carry pavements, streets, a
 * few houses and, at night, street lights; the rest stay fields. In ground metres from the city centre (east, south).
 */
let suburbsMemo = null;
/** Computed on first use (the lake it avoids is defined further down). */
const suburbs = () => (suburbsMemo ??= (() => {
  const own = new Set(PLAN.pads.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`)), out = [], reach = 22;
  for (let i = -reach; i < GRID + reach; i++) for (let j = -reach; j < GRID + reach; j++) {
    const o = blockOrigin(i, j);
    if (own.has(`${Math.round(o.x)},${Math.round(o.y)}`)) continue;
    const x = o.x - PARK_CENTRE.x, y = o.y - PARK_CENTRE.y, cx = x + B / 2, cy = y + B / 2, d = Math.hypot(cx, cy);
    const fall = 1 - Math.min(1, Math.max(0, (d - 470) / 1250)), chance = fall * fall * (3 - 2 * fall) * (.65 + .55 * fbm(cx / 520, cy / 520, 83));
    if (d > 1800 || inLake(cx, cy, 30) || randomAt(84, i * 131 + j) > chance) continue;
    const k = out.length, homes = 1 + Math.floor(randomAt(85, k) * (1 + 3 * fall));
    out.push({ x, y, d, fall, homes, k });
  }
  return out;
})());
// The route follows the streets: road centrelines sit between blocks.
const road = (n) => -HALF + n * (B + ROAD), O = 2;
const ROUTE_PLAN = [[road(O) - 30, road(O + 3)], [road(O + 3), road(O + 3)], [road(O + 3), road(O + 5)], [road(O + 6), road(O + 5)], [road(O + 6), road(O + 7)], [road(O + 9) + 30, road(O + 7)]];
export const ROUTE = motionPath([['M', ...ROUTE_PLAN[0]], ...ROUTE_PLAN.slice(1).map((p) => ['L', ...p])], { rotate: false });
/** Named places along the way, each the building nearest a route point. */
export const PLACES = ['Library', 'Bakery', 'Station', 'Studio', 'Museum', 'Market'].map((name, n) => {
  const at = ROUTE.sample(.08 + n * .17), dist = (x) => Math.hypot(x.x + x.w / 2 - at.x, x.y + x.d / 2 - at.y);
  const b = PLAN.buildings.reduce((best, x) => (dist(x) < dist(best) ? x : best));
  return { name, building: b.id, anchor: toWorld(b.x + b.w / 2, b.y + b.d / 2, b.h + 2) };
});

// ---- The stage ------------------------------------------------------------------------------------
/**
 * Build the 3D stage in steps, reporting each with `progress(step)`: 'engine', 'city', 'garden', then,
 * after the stage has resolved and can already render the garden and city, 'land' and 'earth'.
 */
export async function createThreeStage(canvas, { progress = () => {} } = {}) {
  const THREE = await import('three');
  progress('engine');
  // Logarithmic depth lets one camera hold a flower and a planet without z-fighting.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
  renderer.setClearColor(0x000000, 0);renderer.autoClear = false;
  renderer.shadowMap.enabled = true;renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;renderer.toneMappingExposure = 1.02;
  renderer.outputColorSpace = THREE.SRGBColorSpace;renderer.localClippingEnabled = true;
  const clay = (color, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: .82, metalness: 0, sheen: .5, sheenRoughness: .85, sheenColor: new THREE.Color('#fff6ea'), ...extra });

  // ---- City: an ExplainerKit scene rendered by the library's Three adapter -------------------------
  const world = scene({ width: 1600, height: 900, label: 'Clay city', description: 'A clay city that builds outward from its park, thinning into suburbs.' });
  const routeProgress = world.parameter(0, { min: 0, max: 1 }), build = world.parameter(1, { min: 0, max: 1 });
  const lifts = PLAN.buildings.map(() => world.parameter(0, { min: -1, max: 2 }));
  const city = world.group({ rotationX: -Math.PI / 2, x: -PARK_CENTRE.x, y: 0, z: -PARK_CENTRE.y });
  // Plan y runs south (world +z); the group's −90° turn maps plan (x, y, depth) to world (x, −z, y), so flip y.
  const P = (y) => -y;
  // Each part rises on its own spring, released by distance from the park: the city builds outward.
  const rise = (delay) => { const s = spring({ from: 0, to: 1, stiffness: 150, damping: 11, at: delay });return (b) => Math.max(.02, s.sample(Math.max(delay, b * 1.7))); };
  for (const pad of PLAN.pads) {
    const up = rise(pad.delay * .8);
    // Each block spreads out from its own centre, the nearest to the park first.
    city.rect({ x: pad.x, y: P(pad.y + B), width: B, height: B, rx: 5, depth: 1.8, z: 0, fill: css(pad.kind === 'park' ? vary([96, 22, 70], pad.k, 3) : pad.suburb ? vary([74, 18, 80], pad.k, 3, .8) : vary([40, 20, 86], pad.k, 3, .6)) })
      .bind(['x', 'y', 'width', 'height', 'depth', 'rx'], { inputs: [build], map: (b) => { const e = Math.min(1, up(b) * 1.15), w = Math.max(.01, B * e);return { x: pad.x + (B - w) / 2, y: P(pad.y + B) + (B - w) / 2, width: w, height: w, depth: Math.max(.05, 1.8 * e), rx: Math.min(5, w / 2.2) }; } });
  }
  for (const b of PLAN.buildings) {
    const up = rise(b.delay), height = (lift, v) => b.h * up(v) * (1 + .22 * lift);
    city.rect({ x: b.x, y: P(b.y + b.d), width: b.w, height: b.d, rx: Math.min(2.6, b.w / 5), depth: b.h, z: 1.8, fill: css(b.color) }).bind('depth', { inputs: [lifts[b.id], build], map: height });
    if (b.roof) city.rect({ x: b.x + b.w * .2, y: P(b.y + b.d * .76), width: b.w * .6, height: b.d * .52, rx: 1.4, depth: b.h > 12 ? 3 : 2, z: 1.8 + b.h, fill: css([b.color[0], b.color[1], b.color[2] + 4]) })
      .bind('z', { inputs: [lifts[b.id], build], map: (lift, v) => 1.8 + height(lift, v) });
  }
  const routeParts = ROUTE_PLAN.slice(1).map(([x1, y1], n) => {
    const [x0, y0] = ROUTE_PLAN[n], horizontal = y0 === y1, w = 5;
    return city.rect({ x: Math.min(x0, x1) - (horizontal ? 0 : w / 2), y: P(Math.max(y0, y1) + (horizontal ? w / 2 : 0)), width: horizontal ? Math.abs(x1 - x0) : w, height: horizontal ? w : Math.abs(y1 - y0), rx: 2.4, depth: .6, z: .9, fill: '#e2583c' });
  });
  routeParts.forEach((part) => part.bind('depth', { inputs: [build], map: (b) => (b > .97 ? .6 : .001) }));
  const treeHolders = PLAN.trees.map((t) => city.group({ x: t.x, y: P(t.y), z: 1.8 }));
  const pin = city.group({ z: 2 });
  pin.bind(['x', 'y'], { inputs: [routeProgress], map: (p) => { const q = ROUTE.sample(Math.max(0, Math.min(1, p)));return { x: q.x, y: P(q.y) }; } });

  // Caller-owned clay objects the adapter attaches to the scene's tree and pin groups.
  const crowns = PLAN.trees.map((t) => {
    const g = new THREE.Group(), s = 3.2 + t.s * 2.6;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.45, .6, 5, 10), clay('#9b8268'));trunk.rotation.x = Math.PI / 2;trunk.position.z = 2.5;g.add(trunk);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(s, 24, 18), clay(css(vary([104, 20, 50], t.k, 7, 1.2))));ball.scale.set(1, 1, 1.15 + r(t.k, 9) * .25);ball.position.z = 5 + s;g.add(ball);
    g.traverse((m) => { m.castShadow = m.receiveShadow = true; });
    return { object: g, up: rise(t.delay) };
  });
  const pinObject = (() => {
    const g = new THREE.Group(), mat = clay('#e2583c', { roughness: .5 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(5, 24, 18), mat);head.position.z = 16;g.add(head);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(4.2, 11, 24), mat);tip.rotation.x = -Math.PI / 2;tip.position.z = 7;g.add(tip);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(1.8, 16, 12), clay('#fbf3e8'));dot.position.set(0, -4.4, 16.6);g.add(dot);
    g.traverse((m) => { m.castShadow = true; });return g;
  })();
  const adapter = createThreeAdapter({
    THREE, coordinateSystem: 'world', material: 'standard', lighting: true, shadows: true, maxVertices: 900000,
    light: { ambient: .55, key: 2.1, direction: [-420, 640, 520], ambientColor: '#fff3e6', keyColor: '#fff0dc', hemisphere: .9, sky: '#fbf5ec', ground: '#c8c0ae', shadowRadius: 8 },
    assets: [...crowns.map((c, n) => ({ id: treeHolders[n].id, object: c.object })), { id: pin.id, object: pinObject }],
  });

  // ---- Street lamps, for a dark page: posts at the street corners and mid-block, a warm head, a soft glow above,
  // and a pool of light on the road. They light when the city has built; by day they are not drawn.
  const lampScene = new THREE.Scene(), lampSpots = [], seenLamp = new Set();
  // Lamps follow the streets: on the sidewalk edge of every road a block faces, staggered from one side of the street
  // to the other, one at each intersection. Dense in the core, thinner in the suburbs; a noise field leaves some
  // stretches dim, and light runs from warm white in the core to sodium orange outside it.
  const kerb = 3.2, dim = (x, y) => noise2(x / 170, y / 170, { seed: 58 });
  const lamp = (x, y, pad, chance) => {
    const key = `${Math.round(x / 4)},${Math.round(y / 4)}`;
    if (seenLamp.has(key) || randomAt(57, lampSpots.length + pad.k * 13) > chance || dim(x, y) < -.42) return;
    seenLamp.add(key);lampSpots.push({ ...toWorld(x, y, 0), core: !pad.suburb, warmth: clamp01(.5 + dim(x * 3, y * 3) * .6) });
  };
  for (const pad of PLAN.pads) {
    const chance = pad.kind === 'park' ? .55 : pad.suburb ? .62 : .95, x0 = pad.x - kerb, y0 = pad.y - kerb, x1 = pad.x + B + kerb, y1 = pad.y + B + kerb;
    for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) lamp(x, y, pad, Math.min(1, chance + .2)); // corners
    // Along the edges: north and west sides at a quarter and three quarters, south and east at the middle, so lamps
    // facing each other across a street alternate.
    for (const t of [.25, .75]) { lamp(pad.x + B * t, y0, pad, chance);lamp(x0, pad.y + B * t, pad, chance); }
    lamp(pad.x + B / 2, y1, pad, chance);lamp(x1, pad.y + B / 2, pad, chance);
  }
  const softDisc = (inner, outer) => {
    const c = document.createElement('canvas');c.width = c.height = 128;const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, inner);gr.addColorStop(.35, outer);gr.addColorStop(1, 'rgba(0,0,0,0)');x.fillStyle = gr;x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);t.colorSpace = THREE.SRGBColorSpace;return t;
  };
  const LAMP_H = 9, posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(.22, .3, LAMP_H, 6), new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: .7 }), lampSpots.length);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(.75, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }), lampSpots.length);
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ map: softDisc('rgba(255,255,255,.2)', 'rgba(255,255,255,.06)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), lampSpots.length);
  const glowPoints = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lampSpots.flatMap((l) => [l.x, LAMP_H + 2, l.z]), 3)), new THREE.PointsMaterial({ map: softDisc('rgba(255,225,170,1)', 'rgba(255,180,100,.3)'), size: 9, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), v3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const tint = new THREE.Color(), warmWhite = new THREE.Color('#ffe6c2'), sodium = new THREE.Color('#ffae5a');
  lampSpots.forEach((l, i) => {
    tint.copy(warmWhite).lerp(sodium, l.core ? l.warmth * .35 : .55 + l.warmth * .45);
    heads.setColorAt(i, tint);pools.setColorAt(i, tint);
    posts.setMatrixAt(i, m4.compose(v3.set(l.x, 1.8 + LAMP_H / 2, l.z), q0, one));
    heads.setMatrixAt(i, m4.compose(v3.set(l.x, 1.8 + LAMP_H + .6, l.z), q0, one));
    pools.setMatrixAt(i, m4.compose(v3.set(l.x, 1.95, l.z), flat, one));
  });
  glowPoints.position.y = 1.8;
  lampScene.add(posts, heads, pools, glowPoints);
  const lampKey = new THREE.DirectionalLight('#fff6ec', 1.6);lampKey.position.set(-420, 640, 520);
  lampScene.add(new THREE.HemisphereLight('#a8a29a', '#141210', .6), lampKey);
  progress('city');
  // ---- Land and Earth: painted in the background once the stage is usable --------------------------
  let earth = null, land = null;

  // ---- Garden: clay flowers on an island in the park ----------------------------------------------
  const garden = new THREE.Scene(), gardenRoot = new THREE.Group();garden.add(gardenRoot);
  const gardenSky = new THREE.HemisphereLight('#fff7ee', '#cdbfa8', 1.1);garden.add(gardenSky);
  const sun = new THREE.DirectionalLight('#fff0dc', 2.4);sun.position.set(-14, 26, 18);sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);sun.shadow.radius = 10;sun.shadow.blurSamples = 16;Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 80 });
  garden.add(sun);
  const kit = flowerKit(THREE, clay), plants = await buildGarden(THREE, clay, kit, gardenRoot), sproutMeshes = new Map();
  progress('garden');
  const ISLAND_TOP = ISLAND_Y + 1.4 + .9;
  const groundShadow = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: .18 }));groundShadow.rotation.x = -Math.PI / 2;groundShadow.position.y = 1.85;groundShadow.receiveShadow = true;garden.add(groundShadow);

  // ---- Imported SVG: the library's importer gives ExplainerKit paths; the adapter extrudes them -----
  let imported = null;
  /**
   * Stand an imported SVG on the island as clay: every path gets an extrusion depth, the root clip
   * and strokes (which the 3D adapter does not extrude) are removed, and it grows on a spring.
   * Anything else the adapter cannot extrude is reported by name rather than silently dropped.
   */
  function addSVG(asset, time) {
    const prepare = (node) => {
      const props = { ...node.props, clip: null };
      if (node.type === 'path') Object.assign(props, { depth: Math.max(asset.width, asset.height) * .06, stroke: 'none', fill: props.fill === 'none' ? '#9fb38f' : props.fill });
      return { ...node, props, children: node.children ? Object.fromEntries(Object.entries(node.children).map(([key, child]) => [key, prepare(child)])) : node.children };
    };
    const w = scene({ width: 1600, height: 900, label: 'Imported SVG' }), size = 4.6 / Math.max(asset.width, asset.height), at = w.parameter(0, { min: 0, max: 1.3 });
    const holder = w.group({ rotationY: .75 });
    holder.bind(['x', 'y', 'z', 'scaleX', 'scaleY'], { inputs: [at], map: (g) => ({ x: -asset.width * size * g / 2 + 3.2, y: ISLAND_TOP + asset.height * size * g, z: -3.4, scaleX: size * g, scaleY: -size * g }) });
    holder.instance(w.component(prepare(asset.blueprint)));
    const a = createThreeAdapter({ THREE, coordinateSystem: 'world', material: 'standard', lighting: true, shadows: false, light: { ambient: .7, key: 2, direction: [-14, 26, 18], ambientColor: '#fff3e6', keyColor: '#fff0dc', hemisphere: 1, sky: '#fbf5ec', ground: '#c8c0ae' } });
    a.update(w.sampleWorld({ time: 0, width: 1600, height: 900 }), { camera }); // fails here, by name, if the artwork cannot be extruded
    imported?.adapter.dispose();
    imported = { world: w, adapter: a, at, born: time };
  }

  const view = { width: 1, height: 1 };
  let camera = null, pose = null;
  /** Buildings as world boxes for ray tests. */
  const boxes = PLAN.buildings.map((b) => { const a = toWorld(b.x, b.y, 0), c = toWorld(b.x + b.w, b.y + b.d, b.h + 1.8);return { id: `b${b.id}`, min: { x: a.x, y: 0, z: a.z }, max: { x: c.x, y: c.y, z: c.z } }; });
  const fade = (root, alpha) => root.traverse((o) => { for (const m of o.material ? [].concat(o.material) : []) { m.transparent = alpha < 1;m.opacity = alpha;m.depthWrite = alpha > .5; } });

  // ---- Dark: the same clay world in deep clays, its accents and flowers kept bright --------------------------
  // Each material remembers its day colour once; switching recolours it from that, so day always returns exactly.
  // Neutral clays (low saturation: ground, buildings, island, trunks, foliage) turn deep, keeping hue and their
  // light-to-dark order so forms still read; saturated accents (the route, the pin) keep their colour; textured
  // maps (countryside, globe) are tinted dark through the material colour, so the same globe reads at night.
  let dark = false, darkStamp = 0;
  const hsl = { h: 0, s: 0, l: 0 };
  function darkClay(material, keep = false, mapTint = .36) {
    if (!material?.color) return;
    const day = (material.userData.day ??= material.color.getHex()),
      sheen = (material.userData.sheen ??= material.sheenColor?.getHex() ?? null);
    if (material.userData.stamp === darkStamp) return;
    material.userData.stamp = darkStamp;
    material.color.setHex(day);
    if (sheen !== null) material.sheenColor.setHex(sheen);
    if (!dark || keep) return;
    // The clay's soft sheen is a pale fuzz by day; on dark clay it would read as a grey film, so it dims too.
    if (sheen !== null) material.sheenColor.multiplyScalar(.22);
    // The brand vermilion (route, pins) becomes the dark page's blue; the Earth's core stays red.
    if (day === 0xe2583c) return void (material.userData.core || material.color.set('#3b82f0'));
    if (material.map) return void material.color.setRGB(mapTint, mapTint * .97, mapTint * .94, THREE.SRGBColorSpace); // a dark multiply, in sRGB terms
    if (material.userData.multiply) return void material.color.setRGB(.34, .32, .3, THREE.SRGBColorSpace); // per-instance colours: darken them all alike
    material.color.getHSL(hsl, THREE.SRGBColorSpace); // judge colours as they are written (sRGB), not in linear light
    if (hsl.s >= .45 && hsl.l > .25 && hsl.l < .72) return; // an accent (saturated, mid-light): as it is
    // Dark clay is its own palette, not the day's colours dimmed: hues lean halfway to warm umber (greens become
    // olive-brown, greys warm), so the city and island sit together in browns while accents and flowers carry colour.
    const umber = 32 / 360, dh = ((umber - hsl.h + 1.5) % 1) - .5;
    const lean = hsl.h > .17 && hsl.h < .45 ? .85 : .5; // greens go almost all the way: blue's complement is warm
    material.color.setHSL((hsl.h + dh * lean + 1) % 1, Math.min(1, hsl.s * 1.1 + .04), .1 + hsl.l ** 1.4 * .22, THREE.SRGBColorSpace);
  }
  const themeTree = (root, keep, mapTint) => root?.traverse((o) => { for (const m of o.material ? [].concat(o.material) : []) darkClay(m, keep?.(o), mapTint); });
  // Flowers and plants stay as they are (they bloom against the dark); the island and its ground darken.
  const plantRoots = () => new Set([...plants.map((p) => p.object), ...sproutMeshes.values()].flatMap((v) => (v?.isObject3D ? [v] : v?.object ? [v.object] : [])));
  let plantSet = null;
  const isPlant = (o) => { plantSet ??= plantRoots();for (let p = o; p; p = p.parent) if (plantSet.has(p)) return true;return false; };
  const DAY_LIGHT = adapter.light, DARK_LIGHT = { ambient: .4, key: 2, ambientColor: '#ece6de', keyColor: '#fff6ec', hemisphere: .6, sky: '#a8a29a', ground: '#141210' };
  function setDark(on) {
    dark = !!on;darkStamp++;
    adapter.setLight(dark ? DARK_LIGHT : DAY_LIGHT);
    gardenSky.color.set(dark ? '#b0aaa2' : '#fff7ee');gardenSky.groundColor.set(dark ? '#171513' : '#cdbfa8');gardenSky.intensity = dark ? .8 : 1.1;
    if (earth) { earth.globe.material.emissiveIntensity = dark ? 1 : 0;earth.atmosphere.visible = dark; }
    for (const s of [land?.scene, earth?.scene]) s?.traverse((o) => { if (o.isHemisphereLight) { o.color.set(dark ? '#b8b2aa' : '#fff8f0');o.groundColor.set(dark ? '#141210' : '#d9cbb8');o.intensity = dark ? .85 : 1.15; } });
  }
  const later = (async () => { await tick();land = await buildLand(THREE, clay);if (dark) setDark(true);progress('land');earth = await buildEarth(THREE, clay);if (dark) setDark(true);progress('earth'); })();
  return {
    later, get earth() { return earth; }, THREE, renderer, plants, lifts, progress: routeProgress, boxes, ISLAND_TOP, camera: () => camera, addSVG,
    /** The live scenes, camera and renderer, for the 3D render audit (describeThreeScene). */
    inspect() { return { renderer, adapter, camera: adapter.camera, viewport: { ...view }, scenes: { city: adapter.scene, garden } }; },
    resize(width, height, ratio) { view.width = width;view.height = height;renderer.setPixelRatio(ratio);renderer.setSize(width, height, false); },
    /**
     * Orbit-style camera about the city: distance in metres, elevation and heading in radians. Looking
     * straight down, north stays at the top of the screen.
     */
    setCamera({ distance, elevation = .5, heading = Math.PI / 4, target = { x: 0, y: 3, z: 0 }, fov = .62 }) {
      const ce = Math.cos(elevation), overhead = elevation > Math.PI / 2 - 1e-3, up = overhead ? { x: 0, y: 0, z: -1 } : { x: 0, y: 1, z: 0 };
      const position = { x: target.x + Math.sin(heading) * ce * distance, y: target.y + Math.sin(elevation) * distance, z: target.z + Math.cos(heading) * ce * distance };
      camera = perspectiveCamera({ ...position, target, up, fov, near: Math.max(.02, distance / 3000), far: Math.min(9e7, distance * 3 + 3e4) }, { width: Math.max(1, Math.round(view.width)), height: Math.max(1, Math.round(view.height)) });
      pose = { position, target, up, fov };
      return camera;
    },
    /** World point to viewport pixels, with whether a building stands between the camera and it. */
    look(p) {
      const s = projectPoint(camera, p), eye = pose.position;
      const d = { x: p.x - eye.x, y: p.y - eye.y, z: p.z - eye.z }, len = Math.hypot(d.x, d.y, d.z);
      const hit = pickBounds({ origin: eye, direction: { x: d.x / len, y: d.y / len, z: d.z / len } }, boxes);
      return { x: s.x, y: s.y, visible: s.visible, hidden: !!hit && hit.distance < len - 3, by: hit?.id ?? null };
    },
    /** Whether a new flower may grow here: inside the island, outside clearings, under the density budget. */
    plantable(x, z, sprouts, k) { return plantable(x, z, plants, sprouts, k); },
    /** Shape the dandelion's stem from world points (13, base to tip), blended by `w`. */
    bendDandelion(points, w) { const base = new THREE.Vector3(DANDELION.x, ISLAND_TOP, DANDELION.z);gardenRoot.userData.dandelion.bend(points && points.map((p) => new THREE.Vector3(p.x, p.y, p.z).sub(base)), w); },
    /**
     * One frame of the city story. `build` raises the city from the park outward; `reveal` gives the
     * radius, in metres, to which the countryside, the region and the globe have been drawn.
     */
    renderCity({ time, cityAlpha = 1, gardenAlpha = 1, island: grown = 1, build: b = 1, grow = 99, pointer = null, ripples = [], sprouts = [], reveal = { outskirts: 0, region: 0, globe: 0 } }) {
      renderer.clear();
      const altitude = pose.position.y;
      // Far out, the globe is the Earth model itself, seen through a camera derived from this one.
      // The globe's lights are a whole-planet texture: they fade in only once the Earth reads as a globe; below that
      // the region's and countryside's own lights carry the night.
      if (altitude > 3e4 && earth) { earth.globe.material.emissiveIntensity = dark ? clamp01((altitude - 9e5) / 2.2e6) : 0;drawGlobeFrom(earth, pose, view, altitude, reveal.globe);themeTree(earth.scene, null, .2);renderer.render(earth.scene, earth.camera);renderer.clearDepth(); }
      // Level of detail for night lights: near the ground the 3D lamps carry the city; the painted town and village
      // lights fade in as the camera rises, so the two never stack and the texture is never seen close enough to blur.
      if (land) for (const m of land.lit) m.emissiveIntensity = dark ? 1.2 * clamp01((altitude - 900) / 2600) : 0;
      if (land) { land.update({ altitude, reveal, time });themeTree(land.scene, null, .3); /* land is ground, not light: a deep multiply */renderer.render(land.scene, makeThreeCamera(THREE, camera)); }
      build.override(b);
      adapter.update(world.sampleWorld({ time, width: 1600, height: 900 }), { camera });
      if (cityAlpha > .01) {
        for (const c of crowns) c.object.scale.setScalar(c.up(b));
        pinObject.visible = b > .97;
        fade(adapter.scene, cityAlpha);
        themeTree(adapter.scene);
        renderer.render(adapter.scene, adapter.camera);
        // Street lamps light once the city stands, and only on a dark page.
        if (dark && b > .97) {
          for (const m of [posts.material, heads.material, pools.material, glowPoints.material]) { m.transparent = true;m.opacity = cityAlpha; }
          renderer.render(lampScene, adapter.camera);
        }
      }
      if (gardenAlpha > .01) {
        // The island spreads out from under the dandelion, which already stands where it will be.
        const e = Math.max(.001, spring({ from: 0, to: 1, stiffness: 60, damping: 9, at: 0 }).sample(grown * 1.2));
        gardenRoot.userData.island.scale.set(e, Math.sqrt(e), e);gardenRoot.userData.island.position.set(DANDELION.x * (1 - e), ISLAND_Y + 1.4 * (1 - Math.sqrt(e)), DANDELION.z * (1 - e));
        animateGarden(plants, { time, grow, pointer, ripples });
        growSprouts(sprouts, sproutMeshes, { time, kit, root: gardenRoot, bake: (g) => bake(THREE, g) });
        fade(gardenRoot, gardenAlpha);
        plantSet = null;
        themeTree(gardenRoot, isPlant);
        renderer.render(garden, adapter.camera);
        if (imported) {
          imported.at.override(Math.max(0, spring({ from: 0, to: 1, stiffness: 80, damping: 7, at: imported.born }).sample(Math.max(imported.born, time))));
          imported.adapter.update(imported.world.sampleWorld({ time, width: 1600, height: 900 }), { camera });
          renderer.render(imported.adapter.scene, adapter.camera);
        }
      }
    },
    renderEarth(state) { if (!earth) return;renderer.clear();earth.globe.material.emissiveIntensity = dark ? 1 : 0;animateEarth(earth, { ...state, aspect: view.width / view.height });earth.atmosphere.visible = dark && !(state.cut > 0);themeTree(earth.scene, null, .2);renderer.render(earth.scene, earth.camera); },
    /** Dark clays, accents and flowers kept (see darkClay); lights to a neutral rig with a dark ground bounce. */
    setDark,
    dispose() { adapter.dispose();renderer.dispose(); },
  };
}
/** A Three camera from a library camera, for scenes the adapter does not own. */
function makeThreeCamera(THREE, c) {
  const cam = new THREE.PerspectiveCamera();cam.matrixAutoUpdate = false;
  cam.matrixWorld.fromArray(c.matrixWorld);cam.matrixWorldInverse.fromArray(c.viewMatrix);
  cam.projectionMatrix.fromArray(c.projectionMatrix);cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  cam.near = c.near;cam.far = c.far;
  return cam;
}

// ---- Land: the countryside and the region, as painted patches of the curved surface ----------------
// Shared geography, in metres east (x) and south (y) of the city centre.
const LAKE = [[900, 1100], [1700, 2000], [2600, 2900], [3700, 3700], [4800, 4400], [6200, 5200], [8000, 6400], [10000, 7600], [13000, 9000], [17000, 11000], [22000, 13500], [27000, 16000]];
const LAKE_W = (u) => 520 + 1100 * Math.sin(Math.min(1, u * 1.4) * Math.PI / 2) * (1 - .35 * u);
const RIVER = [[-480, -260], [-900, -600], [-1600, -900], [-2500, -1150], [-3300, -1750], [-4300, -2050], [-5600, -2700], [-7200, -3100], [-9000, -4200], [-12000, -5200], [-16000, -6900], [-22000, -8000]];
const townRadius = (a) => 600 + 90 * fbm(Math.cos(a) * 1.3, Math.sin(a) * 1.3, 44);
const forestAt = (x, y) => fbm(x / 1300, y / 1300, 21);
function polylineDistance(line, x, y) {
  let best = Infinity, at = 0, total = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1], [bx, by] = line[i], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = clamp01(((x - ax) * dx + (y - ay) * dy) / l2), d = Math.hypot(ax + dx * t - x, ay + dy * t - y);
    if (d < best) { best = d;at = (i - 1 + t) / (line.length - 1); }
    total += Math.sqrt(l2);
  }
  return { d: best, u: at };
}
const inLake = (x, y, margin = 0) => { const q = polylineDistance(LAKE, x, y);return q.d < LAKE_W(q.u) / 2 + margin; };
/** Villages: Poisson-spaced across the countryside, never in the lake or the town. */
const VILLAGES = (() => {
  const spots = points({ in: { rect: [-15000, -15000, 30000, 30000] }, method: 'poisson', minDistance: 2400, count: 70, seed: 81 }), out = [];
  for (let i = 0; i < spots.count; i++) { const x = spots.x[i], y = spots.y[i];if (Math.hypot(x, y) > 1900 && !inLake(x, y, 350)) out.push([x, y]); }
  return out;
})();
/** Roads: each village to its two nearest neighbours, and the nearest ring of villages to the town. */
const ROADS = (() => {
  const seen = new Set(), roads = [];
  VILLAGES.forEach(([x, y], i) => {
    const near = VILLAGES.map(([u, v], j) => [Math.hypot(u - x, v - y), j]).filter(([, j]) => j !== i).sort((a, b) => a[0] - b[0]).slice(0, 2);
    for (const [d, j] of near) { const key = Math.min(i, j) + ':' + Math.max(i, j);if (!seen.has(key) && d < 5200) { seen.add(key);roads.push([VILLAGES[i], VILLAGES[j], roads.length]); } }
    if (Math.hypot(x, y) < 4600) roads.push([[x * 600 / Math.hypot(x, y), y * 600 / Math.hypot(x, y)], [x, y], roads.length]);
  });
  return roads;
})();

/** A smooth band polygon around a polyline, for lakes and rivers. */
function band(t, line, width, map) {
  const left = [], right = [];
  line.forEach(([x, y], i) => {
    const [px, py] = line[Math.max(0, i - 1)], [nx, ny] = line[Math.min(line.length - 1, i + 1)], dx = nx - px, dy = ny - py, l = Math.hypot(dx, dy) || 1, w = width(i / (line.length - 1)) / 2;
    left.push(map(x - dy / l * w, y + dx / l * w));right.push(map(x + dy / l * w, y - dx / l * w));
  });
  const ring = [...left, ...right.reverse()];
  t.beginPath();ring.forEach(([x, y], i) => (i ? t.lineTo(x, y) : t.moveTo(x, y)));t.closePath();
}
/** Soft colour mottling: coherent noise on a small grid, scaled up smoothly. */
function mottle(t, N, base, amount, scale, seed, alpha = 1) {
  const M = 160, c = document.createElement('canvas');c.width = c.height = M;
  const g = c.getContext('2d'), img = g.createImageData(M, M);
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    const n = noise2(i / M * scale, j / M * scale, { seed }), n2 = noise2(i / M * scale * 3.1, j / M * scale * 3.1, { seed: seed + 1 });
    const hex = css([base[0] + n * 4, base[1] + n2 * 3, base[2] + (n * .7 + n2 * .3) * amount]), o = (j * M + i) * 4;
    img.data[o] = parseInt(hex.slice(1, 3), 16);img.data[o + 1] = parseInt(hex.slice(3, 5), 16);img.data[o + 2] = parseInt(hex.slice(5, 7), 16);img.data[o + 3] = 255 * alpha;
  }
  g.putImageData(img, 0, 0);t.imageSmoothingEnabled = true;t.imageSmoothingQuality = 'high';t.drawImage(c, 0, 0, N, N);
}
/** A soft-edged alpha mask from a field sampled on a small grid. */
async function maskImage(N, M, field) {
  const c = document.createElement('canvas');c.width = c.height = M;
  const g = c.getContext('2d'), img = g.createImageData(M, M);
  for (let j = 0; j < M; j++) { await tick();for (let i = 0; i < M; i++) { if (!(i & 127)) await tick();const o = (j * M + i) * 4;img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;img.data[o + 3] = 255 * clamp01(field(i / M, j / M)); } }
  g.putImageData(img, 0, 0);return c;
}
function tintedMask(N, mask, color) {
  const c = document.createElement('canvas');c.width = c.height = N;const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;g.drawImage(mask, 0, 0, N, N);g.globalCompositeOperation = 'source-in';g.fillStyle = color;g.fillRect(0, 0, N, N);return c;
}

/** The countryside, 30 km across: town ground, fields, woods, a lake, a river, roads and villages. */
/** A warm point of light on a lights canvas (black elsewhere): `b` is its brightness, 0–1. */
function lightDot(g, x, y, r, b) {
  g.fillStyle = `rgba(255,${Math.round(168 + b * 70)},${Math.round(92 + b * 80)},${(.3 + b * .7).toFixed(2)})`;
  g.beginPath();g.arc(x, y, r, 0, 6.283);g.fill();
}
/**
 * The countryside at night (30 km): the town dense round the city, each village a small cluster, a few lamps on the
 * roads near the town, and the odd farm. Positions come from the same plan as the day map (villages, roads, lake),
 * thinned by a noise field so nothing reads as evenly spread.
 */
async function outskirtsLights() {
  const N = 2048, S = 30000, c = document.createElement('canvas');c.width = c.height = N;
  const g = c.getContext('2d'), k = N / S, X = (m) => (m + S / 2) * k;
  g.fillStyle = '#000';g.fillRect(0, 0, N, N);
  // Street lights on the suburban streets (corners and mid-block, thinning with the settlement), and a warm window or
  // two in the houses; the city itself has its 3D lamps.
  for (const b of suburbs()) {
    for (const [u, v] of [[0, 0], [.5, 0], [0, .5]]) {
      const x = b.x - ROAD / 2 + u * (B + ROAD), y = b.y - ROAD / 2 + v * (B + ROAD);
      if (randomAt(89, b.k, u * 2 + v) < .35 + .6 * b.fall && noise2(x / 170, y / 170, { seed: 58 }) > -.42) lightDot(g, X(x), X(y), .55, .5 + .4 * b.fall);
    }
    for (let h = 0; h < b.homes; h++) if (randomAt(90, b.k, h) < .55) lightDot(g, X(b.x + 20 + randomAt(91, b.k, h) * 30), X(b.y + 12 + randomAt(92, b.k, h) * 40), .45, .35);
  }
  await tick();
  VILLAGES.forEach(([vx, vy], v) => {
    const n = 5 + Math.floor(randomAt(66, v) * 14);
    for (let i = 0; i < n; i++) {
      const r = Math.sqrt(-2 * Math.log(1 - randomAt(67, v, i) * .99)) * 55, a = randomAt(68, v, i) * 6.283, x = vx + Math.cos(a) * r, y = vy + Math.sin(a) * r;
      if (!inLake(x, y)) lightDot(g, X(x), X(y), .7, .35 + randomAt(69, v, i) * .45);
    }
  });
  await tick();
  for (const [[ax, ay], [bx, by], id] of ROADS) {
    const len = Math.hypot(bx - ax, by - ay);
    for (let d = 200; d < len; d += 320) {
      const x = ax + (bx - ax) * d / len, y = ay + (by - ay) * d / len;
      if (Math.hypot(x, y) < 3800 && noise2(x / 900, y / 900, { seed: 70 + id }) > -.1) lightDot(g, X(x), X(y), .55, .3);
    }
  }
  const farms = points({ in: { rect: [-S / 2, -S / 2, S, S] }, count: 900, seed: 71 });
  for (let i = 0; i < farms.count; i++) { const x = farms.x[i], y = farms.y[i];if (Math.hypot(x, y) > 1500 && !inLake(x, y, 80) && fbm(x / 2500, y / 2500, 72) > .18) lightDot(g, X(x), X(y), .55, .25); }
  return c;
}
/** The region at night (600 km): the real metropolitan areas nearby as clusters, and towns scattered over the land. */
async function regionLights() {
  const N = 2048, S = 600, c = document.createElement('canvas');c.width = c.height = N;
  const g = c.getContext('2d'), k = N / S, X = (km) => (km + S / 2) * k, lat0 = SITE.lat * Math.PI / 180;
  const fromLonLat = (lon, lat) => [X((lon - SITE.lon) * 111.32 * Math.cos(lat0)), X((SITE.lat - lat) * 110.57)];
  g.fillStyle = '#000';g.fillRect(0, 0, N, N);
  const coast = new Path2D();
  for (const ring of LAND) { ring.forEach(([lon, lat], i) => { const [x, y] = fromLonLat(lon, lat);i ? coast.lineTo(x, y) : coast.moveTo(x, y); });coast.closePath(); }
  for (const [m, [lat, lon, w]] of METROS.entries()) {
    const [cx, cy] = fromLonLat(lon, lat);
    if (cx < -60 || cy < -60 || cx > N + 60 || cy > N + 60) continue;
    for (let i = 0; i < 260 * w; i++) {
      const r = Math.sqrt(-2 * Math.log(1 - randomAt(73, m, i) * .99)) * (4 + w * 12), a = randomAt(74, m, i) * 6.283, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (g.isPointInPath(coast, x, y)) lightDot(g, x, y, .8, Math.exp(-r / (6 + w * 10)));
    }
  }
  await tick();
  const towns = points({ in: { rect: [0, 0, N, N] }, method: 'poisson', minDistance: 18, count: 2600, seed: 75 });
  for (let i = 0; i < towns.count; i++) {
    const x = towns.x[i], y = towns.y[i];
    if (!g.isPointInPath(coast, x, y) || fbm(x / 220, y / 220, 76) < .05) continue;
    const size = randomAt(77, i);
    for (let j = 0; j < 2 + size * 9; j++) lightDot(g, x + (randomAt(78, i, j) - .5) * (3 + size * 8), y + (randomAt(79, i, j) - .5) * (3 + size * 8), .7, .25 + size * .5);
  }
  // The city itself, where the countryside hands over.
  for (let i = 0; i < 160; i++) { const r = randomAt(80, i) * 6, a = randomAt(81, i) * 6.283;lightDot(g, N / 2 + Math.cos(a) * r, N / 2 + Math.sin(a) * r, .8, 1 - r / 7); }
  return c;
}
async function paintOutskirts() {
  const N = 4096, S = 30000, c = document.createElement('canvas');c.width = c.height = N;
  const t = c.getContext('2d'), k = N / S, X = (m) => (m + S / 2) * k, map = (x, y) => [X(x), X(y)];
  mottle(t, N, [93, 25, 71], 5, 24, 31);
  // Fields: a jittered patchwork turned a little off north, skipping the town and the lake.
  const cell = 230, turn = .32, ct = Math.cos(turn), st = Math.sin(turn), span = Math.ceil(S / cell) + 4;
  const corner = (a, b) => { const jx = (randomAt(7, a * 997 + b, 0) - .5) * 110, jy = (randomAt(7, a * 997 + b, 1) - .5) * 110, u = (a - span / 2) * cell + jx, v = (b - span / 2) * cell + jy;return [u * ct - v * st, u * st + v * ct]; };
  const crops = { wheat: 3, meadow: 2.5, ochre: 1.5, sage: 2, fallow: 1.2, green: 2 };
  const CROP = { wheat: [44, 42, 79], meadow: [90, 28, 70], ochre: [34, 36, 74], sage: [100, 18, 66], fallow: [28, 20, 73], green: [96, 32, 64] };
  for (let a = 0; a < span; a++) for (let b = 0, _ = await tick(); b < span; b++) {
    if (!(b & 127)) await tick();
    const q = [corner(a, b), corner(a + 1, b), corner(a + 1, b + 1), corner(a, b + 1)], cx = q.reduce((s, p) => s + p[0], 0) / 4, cy = q.reduce((s, p) => s + p[1], 0) / 4;
    const d = Math.hypot(cx, cy), id = a * 211 + b;
    if (d < townRadius(Math.atan2(cy, cx)) + 120 || inLake(cx, cy, 80) || forestAt(cx, cy) > .3 || randomAt(8, id, 0) < .16) continue;
    const crop = distribution.pick(crops, randomAt(8, id, 1));
    t.fillStyle = css(vary(CROP[crop], id, 2, 1.2));t.strokeStyle = css([96, 22, 56]);t.lineWidth = 1.2;
    t.beginPath();q.forEach((p, i) => { const [x, y] = map(p[0] * .97 + cx * .03, p[1] * .97 + cy * .03);i ? t.lineTo(x, y) : t.moveTo(x, y); });t.closePath();t.fill();t.stroke();
    if (crop === 'wheat' || crop === 'ochre') { // furrows
      t.save();t.clip();t.strokeStyle = css(vary([40, 30, 70], id, 3));t.globalAlpha = .35;t.lineWidth = .8;
      for (let f = -10; f < 10; f++) { const [x0, y0] = map(cx + f * 22 * ct - 200 * st, cy + f * 22 * st + 200 * ct), [x1, y1] = map(cx + f * 22 * ct + 200 * st, cy + f * 22 * st - 200 * ct);t.beginPath();t.moveTo(x0, y0);t.lineTo(x1, y1);t.stroke(); }
      t.restore();
    }
  }
  // Woods: soft-edged masses with a darker core and speckled canopy.
  const wood = await maskImage(N, 900, (u, v) => { const x = u * S - S / 2, y = v * S - S / 2;return Math.hypot(x, y) < 650 || inLake(x, y, 40) ? 0 : (forestAt(x, y) - .24) * 9; });
  t.drawImage(tintedMask(N, wood, css([108, 24, 50])), 0, 0);
  for (let i = 0; i < 90000; i++) {
    if (i % 2000 === 0) await tick();
    const x = (randomAt(9, i, 0) - .5) * S, y = (randomAt(9, i, 1) - .5) * S;
    if (forestAt(x, y) < .28 || inLake(x, y, 30) || Math.hypot(x, y) < 650) continue;
    t.fillStyle = css(vary([112, 26, randomAt(9, i, 2) < .5 ? 42 : 56], i, 4));t.beginPath();t.arc(X(x), X(y), 2.2 + randomAt(9, i, 3) * 2.6, 0, 6.283);t.fill();
  }
  // The lake and the river, with a pale shore.
  t.fillStyle = css([44, 26, 84]);band(t, LAKE, (u) => LAKE_W(u) + 70, map);t.fill();
  t.fillStyle = css([196, 30, 79]);band(t, LAKE, LAKE_W, map);t.fill();
  t.strokeStyle = css([196, 30, 79]);t.lineWidth = 34 * k;t.lineCap = t.lineJoin = 'round';t.beginPath();RIVER.forEach(([x, y], i) => (i ? t.lineTo(X(x), X(y)) : t.moveTo(X(x), X(y))));t.stroke();
  // Country roads: from the town's edge to each village, bending gently.
  t.strokeStyle = css([40, 22, 84]);t.lineWidth = 7 * k;t.globalAlpha = .85;
  for (const [[ax, ay], [bx, by], n] of ROADS) {
    const len = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / len, ny = (bx - ax) / len;
    t.beginPath();
    for (let s = 0; s <= 40; s++) { const u = s / 40, side = len * .09 * fbm(u * 3 + n, n * 1.7, 48) * Math.sin(u * Math.PI);t.lineTo(X(ax + (bx - ax) * u + nx * side), X(ay + (by - ay) * u + ny * side)); }
    t.stroke();
  }
  t.globalAlpha = 1;
  // Villages: a pale clearing for each cluster of houses.
  VILLAGES.forEach(([vx, vy], n) => { t.fillStyle = css(vary([40, 22, 84], n, 5));t.beginPath();for (let s = 0; s <= 24; s++) { const a = s / 24 * 6.283, rr = 150 + 50 * noise2(Math.cos(a) + n, Math.sin(a), { seed: 46 });t.lineTo(X(vx + Math.cos(a) * rr), X(vy + Math.sin(a) * rr)); }t.fill(); });
  // The town's ground: a faint wash under the city, then the street grid carried on into the suburbs. Each settled
  // block gets its street and pavement, a yard and a few house footprints; settled blocks thin out with distance,
  // so the grid frays into the fields rather than ending at a wall.
  for (let ring = 0; ring < 6; ring++) {
    t.fillStyle = css(vary([40, 18, 85], ring, 6, .5));t.globalAlpha = .3;t.beginPath();
    for (let s = 0; s <= 72; s++) { const a = s / 72 * 6.283, rr = (300 + ring * 32) * (1 + .12 * fbm(Math.cos(a) * 1.6 + ring * .3, Math.sin(a) * 1.6, 47));t.lineTo(X(Math.cos(a) * rr), X(Math.sin(a) * rr)); }
    t.fill();
  }
  t.globalAlpha = 1;
  const blocks = [...PLAN.pads.map((p) => ({ x: p.x - PARK_CENTRE.x, y: p.y - PARK_CENTRE.y, fall: 1, homes: 0, k: p.k })), ...suburbs()];
  for (const b of blocks) {
    t.globalAlpha = .35 + .65 * b.fall;
    t.fillStyle = css(vary([36, 10, 76], b.k, 3, .6));t.fillRect(X(b.x - ROAD / 2), X(b.y - ROAD / 2), (B + ROAD) * k, (B + ROAD) * k); // street and pavement
    t.fillStyle = css(vary([44, 16, 84], b.k, 4, .6));t.fillRect(X(b.x + 2), X(b.y + 2), (B - 4) * k, (B - 4) * k); // yards
    for (let h = 0; h < b.homes; h++) {
      const u = .12 + randomAt(86, b.k, h) * .62, side = h % 2;
      t.fillStyle = css(vary(randomAt(87, b.k, h) < .7 ? [14, 36, 62] : [30, 10, 58], b.k + h, 3));
      t.fillRect(X(b.x + (side ? u * B : 6)), X(b.y + (side ? 6 : u * B)), 12 * k, 10 * k);
    }
    if (!(b.k % 64)) await tick();
  }
  t.globalAlpha = 1;
  t.globalAlpha = 1;
  return c;
}

/** The region, 600 km across: the Alps, lakes, the Rhine and cities, on Natural Earth land. */
async function paintRegion() {
  const N = 2048, S = 600, c = document.createElement('canvas');c.width = c.height = N;
  const t = c.getContext('2d'), k = N / S, X = (km) => (km + S / 2) * k, lat0 = SITE.lat * Math.PI / 180;
  const fromLonLat = (lon, lat) => [X((lon - SITE.lon) * 111.32 * Math.cos(lat0)), X((SITE.lat - lat) * 110.57)];
  t.fillStyle = '#c6dbe4';t.fillRect(0, 0, N, N);
  const coast = new Path2D();
  for (const ring of LAND) { ring.forEach(([lon, lat], i) => { const [x, y] = fromLonLat(lon, lat);i ? coast.lineTo(x, y) : coast.moveTo(x, y); });coast.closePath(); }
  t.fillStyle = '#b4c7a2';t.fill(coast);t.save();t.clip(coast);
  mottle(t, N, [92, 24, 71], 4, 7, 51, .55);
  // Farmland and woods from the same functions as the countryside, one sample per 600 m: where the
  // two levels overlap they agree, so the finer one can fade into this without a seam.
  const M = 1024, cells = document.createElement('canvas');cells.width = cells.height = M;
  const cg = cells.getContext('2d'), img = cg.createImageData(M, M), crops = [[44, 42, 79], [90, 28, 70], [34, 36, 74], [100, 18, 66], [28, 20, 73], [96, 32, 64]];
  for (let j = 0; j < M; j++) for (let i = 0, _ = await tick(); i < M; i++) {
    if (!(i & 127)) await tick();
    const x = (i / M - .5) * S * 1000, y = (j / M - .5) * S * 1000, o = (j * M + i) * 4, wood = forestAt(x, y) > .3;
    const hex = css(wood ? vary([108, 24, 50], i * 7 + j, 1, .8) : vary(crops[Math.floor(randomAt(13, j * M + i) * crops.length)], i + j * 3, 2, 1.2));
    img.data[o] = parseInt(hex.slice(1, 3), 16);img.data[o + 1] = parseInt(hex.slice(3, 5), 16);img.data[o + 2] = parseInt(hex.slice(5, 7), 16);img.data[o + 3] = wood ? 170 : 80;
  }
  cg.putImageData(img, 0, 0);t.imageSmoothingEnabled = true;t.drawImage(cells, 0, 0, N, N);
  // The Alps: an arc of ridges, shaded and pale at the crests.
  const ALPS = [[-280, 190], [-170, 150], [-60, 118], [40, 108], [140, 100], [260, 86]];
  const ridge = await maskImage(N, 420, (u, v) => { const x = u * S - S / 2, y = v * S - S / 2, q = polylineDistance(ALPS, x, y);return Math.max(0, 1 - q.d / 75) * 2.2 * (.55 + .45 * Math.abs(fbm(x / 26, y / 26, 61))); });
  t.drawImage(tintedMask(N, ridge, css([96, 14, 62])), 0, 0);
  const snow = await maskImage(N, 420, (u, v) => { const x = u * S - S / 2, y = v * S - S / 2, q = polylineDistance(ALPS, x, y);return Math.max(0, 1 - q.d / 45) * 2.4 * (fbm(x / 16, y / 16, 62) - .05); });
  t.drawImage(tintedMask(N, snow, css([40, 30, 93])), 0, 0);
  // Lakes, by approximate position.
  t.fillStyle = css([196, 30, 79]);
  for (const [lon, lat, rx, ry, rot] of [[9.38, 47.61, 30, 10, -.55], [6.55, 46.43, 36, 7, -.25], [6.85, 46.9, 18, 5, .8], [8.45, 47.0, 14, 5, .2], [8.64, 45.95, 6, 24, .25], [9.27, 46.02, 5, 20, -.2], [10.7, 45.65, 9, 22, 0], [8.0, 47.19, 6, 3, 0], [7.85, 46.7, 9, 3, .1]]) {
    const [x, y] = fromLonLat(lon, lat);t.beginPath();t.ellipse(x, y, rx * k * .5, ry * k * .5, rot, 0, 6.283);t.fill();
  }
  band(t, LAKE.map(([x, y]) => [x / 1000, y / 1000]), (u) => LAKE_W(u) / 1000, (x, y) => [X(x), X(y)]);t.fill();
  // Rivers.
  t.strokeStyle = css([196, 26, 76]);t.lineWidth = 2.2;t.lineJoin = 'round';
  for (const river of [[[9.4, 47.6], [8.6, 47.67], [7.59, 47.56], [7.7, 48.1], [7.8, 48.6], [8.2, 49.0], [8.45, 49.5]], [[8.54, 47.37], [8.3, 47.48], [8.2, 47.6]], [[7.0, 46.3], [6.6, 46.42]], [[6.14, 46.2], [5.8, 45.9], [4.83, 45.76]], [[8.7, 45.5], [9.2, 45.1], [10.5, 45.0], [12.0, 45.0]]]) {
    t.beginPath();river.forEach(([lon, lat], i) => { const [x, y] = fromLonLat(lon, lat);i ? t.lineTo(x, y) : t.moveTo(x, y); });t.stroke();
  }
  // Cities: small pale clusters.
  for (const [lon, lat, size] of [[8.54, 47.37, 4], [7.59, 47.56, 3], [7.45, 46.95, 3], [6.14, 46.2, 3.5], [9.19, 45.46, 6], [11.58, 48.14, 5.5], [9.18, 48.78, 4], [4.83, 45.76, 5], [7.75, 48.58, 3.5], [7.69, 45.07, 4.5], [10.0, 48.4, 2.5], [6.63, 46.52, 3], [8.31, 47.05, 2.5], [9.38, 47.42, 2]]) {
    const [x, y] = fromLonLat(lon, lat);
    for (let i = 0; i < 18; i++) { t.fillStyle = css(vary([38, 22, 86], i + lon * 10, 1));t.beginPath();t.arc(x + (randomAt(12, i + lat * 100, 0) - .5) * size * k * .9, y + (randomAt(12, i + lat * 100, 1) - .5) * size * k * .9, 1.5 + randomAt(12, i, 2) * 2, 0, 6.283);t.fill(); }
  }
  t.restore();
  t.strokeStyle = '#97ad86';t.lineWidth = 2;t.stroke(coast);
  return c;
}

/** A soft-edged reveal mask: alpha 1 inside, an organic frontier near 0.92 of the radius, 0 at the edge. */
async function revealCanvas(seed) {
  const M = 256;
  return maskImage(M, M, (u, v) => { const x = u * 2 - 1, y = v * 2 - 1, rr = Math.hypot(x, y), a = Math.atan2(y, x);return (.86 + .08 * noise2(Math.cos(a) * 2.5, Math.sin(a) * 2.5, { seed }) - rr) / .2; });
}

async function buildLand(THREE, clay) {
  const scene3 = new THREE.Scene();
  // The Earth scene's lights, expressed in this frame (its +z is our up), so the patches and the globe
  // beneath them are lit alike. Mirrored north to south, which a flat patch cannot tell apart, so
  // trees and houses are lit from the camera's side.
  const hemi = new THREE.HemisphereLight('#fff8f0', '#d9cbb8', 1.15);hemi.position.set(0, 0, 1);scene3.add(hemi);
  const key = new THREE.DirectionalLight('#fff1e0', 2.2);key.position.set(-20, 30, 26);scene3.add(key);
  const lit = [];
  const patch = async (canvas, size, segments, seed, order, lights = null) => {
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, surface(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    const map = new THREE.CanvasTexture(canvas);map.colorSpace = THREE.SRGBColorSpace;map.anisotropy = 8;
    const reveal = new THREE.CanvasTexture(await revealCanvas(seed));reveal.wrapS = reveal.wrapT = THREE.ClampToEdgeWrapping;
    const glow = lights ? new THREE.CanvasTexture(lights) : null;
    if (glow) glow.colorSpace = THREE.SRGBColorSpace;
    const material = clay('#ffffff', { map, alphaMap: reveal, transparent: true, depthWrite: false, ...(glow ? { emissive: '#ffffff', emissiveMap: glow, emissiveIntensity: 0 } : {}) });
    if (glow) lit.push(material);
    const mesh = new THREE.Mesh(geo, material);mesh.renderOrder = order;scene3.add(mesh);
    return {
      mesh,
      /** Draw outward to a radius (metres) and fade by `alpha`. */
      set(radius, alpha) {
        const q = Math.max(1e-4, radius / (size / 2 * .86));
        reveal.repeat.set(1 / q, 1 / q);reveal.offset.set(.5 - .5 / q, .5 - .5 / q);
        material.opacity = alpha;mesh.visible = radius > 1 && alpha > .01;
      },
    };
  };
  const region = await patch(await paintRegion(), 6e5, 64, 71, 1, await regionLights()), outskirts = await patch(await paintOutskirts(), 3e4, 64, 72, 2, await outskirtsLights());
  // Trees in the woods and houses in the villages, grown in as the countryside is drawn.
  const plantings = points({ in: { rect: [-3600, -3600, 7200, 7200] }, count: 5200, seed: 61 });
  const trees = [];
  for (let i = 0; i < plantings.count; i++) {
    const x = plantings.x[i], y = plantings.y[i], f = forestAt(x, y);
    if (Math.hypot(x, y) < 640 || inLake(x, y, 40) || (f < .3 && randomAt(62, i) > .012)) continue;
    trees.push({ x, y, s: 5 + randomAt(63, i) * 5 + Math.max(0, f - .3) * 6, c: vary([104, 24, 50 + randomAt(64, i) * 14], i, 1, 1.4) });
  }
  const houses = [];
  VILLAGES.forEach(([vx, vy], n) => {
    for (let m = 0; m < 14 + Math.floor(randomAt(65, n) * 16); m++) {
      const a = randomAt(66, n * 50 + m, 0) * 6.283, rr = Math.sqrt(randomAt(66, n * 50 + m, 1)) * 140, id = n * 50 + m;
      houses.push({ x: vx + Math.cos(a) * rr, y: vy + Math.sin(a) * rr, w: 9 + randomAt(67, id, 0) * 8, d: 8 + randomAt(67, id, 1) * 6, h: 5 + randomAt(67, id, 2) * 4, turn: a + randomAt(67, id, 3) * .4, c: vary(randomAt(67, id, 4) < .6 ? PALETTE.ivory : PALETTE.peach, id, 2), roof: vary(randomAt(67, id, 5) < .7 ? [14, 42, 62] : [30, 10, 58], id, 3) });
    }
  });
  // Houses on the suburban blocks, fewer with distance; they face the street, set back behind a front yard.
  for (const b of suburbs()) for (let h = 0; h < b.homes; h++) {
    const u = .12 + randomAt(86, b.k, h) * .62, side = h % 2, id = 90000 + b.k * 8 + h;
    houses.push({ x: b.x + (side ? u * B + 6 : 12), y: b.y + (side ? 11 : u * B + 5), w: 10 + randomAt(88, id, 0) * 5, d: 8 + randomAt(88, id, 1) * 4, h: 5 + randomAt(88, id, 2) * 3 * b.fall, turn: side ? 0 : Math.PI / 2, c: vary(randomAt(88, id, 3) < .6 ? PALETTE.ivory : PALETTE.peach, id, 2), roof: vary(randomAt(88, id, 4) < .7 ? [14, 42, 62] : [30, 10, 58], id, 3) });
  }
  const crownGeo = new THREE.SphereGeometry(1, 10, 8);
  const treeMesh = new THREE.InstancedMesh(crownGeo, clay('#ffffff', { userData: { multiply: true } }), trees.length);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);boxGeo.translate(0, .5, 0);
  const roofShape = new THREE.Shape([new THREE.Vector2(-.55, 0), new THREE.Vector2(.55, 0), new THREE.Vector2(0, .5)]);
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 1.08, bevelEnabled: false });roofGeo.translate(0, 0, -.54);
  const houseMesh = new THREE.InstancedMesh(boxGeo, clay('#ffffff', { userData: { multiply: true } }), houses.length), roofMesh = new THREE.InstancedMesh(roofGeo, clay('#ffffff', { userData: { multiply: true } }), houses.length);
  const color = new THREE.Color();
  trees.forEach((tr, i) => treeMesh.setColorAt(i, color.set(css(tr.c))));
  houses.forEach((h, i) => { houseMesh.setColorAt(i, color.set(css(h.c)));roofMesh.setColorAt(i, color.set(css(h.roof))); });
  scene3.add(treeMesh, houseMesh, roofMesh);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const pop = spring({ from: 0, to: 1, stiffness: 160, damping: 10, at: 0 });
  let drawn = -1;
  return {
    lit,
    scene: scene3,
    update({ altitude, reveal }) {
      region.set(reveal.region, 1 - clamp01((altitude - 2.5e5) / 4e5));
      outskirts.set(reveal.outskirts, 1 - clamp01((altitude - 6e4) / 1.2e5));
      const near = altitude < 6e4;treeMesh.visible = houseMesh.visible = roofMesh.visible = near;
      if (!near || Math.abs(drawn - reveal.outskirts) < .5) return;
      drawn = reveal.outskirts;
      // Each object pops up on a spring once the frontier has passed it.
      const grow = (x, y) => pop.sample(clamp01((reveal.outskirts * .9 - Math.hypot(x, y)) / 260) * .9);
      trees.forEach((tr, i) => { const g = grow(tr.x, tr.y);v.set(tr.x, surface(tr.x, tr.y) + tr.s * 1.1 * g, tr.y);sc.set(tr.s, tr.s * 1.25, tr.s).multiplyScalar(Math.max(1e-3, g));treeMesh.setMatrixAt(i, m4.compose(v, q.identity(), sc)); });
      houses.forEach((h, i) => {
        const g = grow(h.x, h.y);q.setFromAxisAngle(Y, h.turn);v.set(h.x, surface(h.x, h.y), h.y);
        sc.set(h.w, h.h * Math.max(1e-3, g), h.d);houseMesh.setMatrixAt(i, m4.compose(v, q, sc));
        v.y += h.h * g;sc.set(h.w, h.w * .9 * Math.max(1e-3, g), h.d);roofMesh.setMatrixAt(i, m4.compose(v, q, sc));
      });
      treeMesh.instanceMatrix.needsUpdate = houseMesh.instanceMatrix.needsUpdate = roofMesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---- Earth ---------------------------------------------------------------------------------------
/** Great metropolitan regions as [lat, lon, weight 0–1]: where the night side is brightest. Approximate centres. */
const METROS = [
  [40.7, -74, 1], [34, -118.2, .9], [41.9, -87.6, .7], [29.8, -95.4, .6], [32.8, -96.8, .6], [25.8, -80.2, .55], [33.7, -84.4, .5], [38.9, -77, .55], [42.4, -71.1, .5], [37.8, -122.4, .55], [47.6, -122.3, .4], [43.7, -79.4, .5], [45.5, -73.6, .4], [39.7, -105, .35], [33.4, -112, .45], [19.4, -99.1, .9], [20.7, -103.3, .45], [25.7, -100.3, .4],
  [-23.5, -46.6, .95], [-22.9, -43.2, .7], [-34.6, -58.4, .7], [-33.4, -70.6, .5], [-12, -77, .5], [4.7, -74.1, .5], [10.5, -66.9, .35], [-15.8, -47.9, .3], [-19.9, -43.9, .4],
  [51.5, -.1, .85], [48.9, 2.35, .85], [52.5, 13.4, .6], [40.4, -3.7, .6], [41.4, 2.2, .45], [45.5, 9.2, .55], [41.9, 12.5, .5], [52.4, 4.9, .5], [50.85, 4.35, .45], [51.2, 6.8, .7], [48.1, 11.6, .45], [50.1, 8.7, .4], [53.5, 10, .4], [55.75, 37.6, .85], [59.9, 30.3, .5], [52.2, 21, .45], [50.1, 14.4, .35], [47.5, 19, .4], [48.2, 16.4, .4], [44.4, 26.1, .35], [41, 29, .8], [38, 23.7, .4], [53.5, -2.3, .5], [55.9, -3.2, .3], [53.3, -6.3, .3], [38.7, -9.1, .35], [59.3, 18.1, .3], [60.2, 24.9, .25], [50.4, 30.5, .45],
  [30, 31.2, .9], [6.5, 3.4, .7], [-26.2, 28, .6], [-33.9, 18.4, .35], [-1.3, 36.8, .35], [33.6, -7.6, .4], [36.8, 3, .35], [9, 38.7, .3], [5.6, -.2, .3], [-4.3, 15.3, .3],
  [35.7, 51.4, .65], [24.7, 46.7, .45], [25.2, 55.3, .5], [29.4, 47.9, .3], [33.3, 44.4, .4], [31.8, 35.2, .35], [32.1, 34.8, .35], [33.9, 35.5, .3], [24.9, 67, .65], [31.5, 74.3, .55], [33.7, 73.1, .35],
  [28.6, 77.2, 1], [19.1, 72.9, .95], [22.6, 88.4, .8], [13.1, 80.3, .6], [12.97, 77.6, .65], [17.4, 78.5, .6], [23, 72.6, .5], [26.9, 80.9, .45], [25.6, 85.1, .4], [23.8, 90.4, .8], [6.9, 79.9, .3], [27.7, 85.3, .25],
  [39.9, 116.4, .95], [31.2, 121.5, 1], [23.1, 113.3, .95], [22.5, 114.1, .7], [30.6, 114.3, .6], [30.7, 104.1, .6], [29.6, 106.6, .55], [34.3, 108.9, .5], [39.1, 117.2, .6], [32.1, 118.8, .55], [36.1, 120.4, .45], [41.8, 123.4, .45], [45.8, 126.6, .4], [25, 121.5, .6], [22.3, 114.2, .6],
  [35.7, 139.7, 1], [34.7, 135.5, .8], [35.2, 136.9, .55], [33.6, 130.4, .4], [43.1, 141.3, .3], [37.6, 127, .9], [35.2, 129.1, .45], [39, 125.8, .15],
  [14.6, 121, .75], [13.75, 100.5, .75], [10.8, 106.7, .6], [21, 105.8, .5], [1.35, 103.8, .6], [3.1, 101.7, .55], [-6.2, 106.8, .9], [-7.3, 112.7, .45], [16.9, 96.2, .3],
  [-33.9, 151.2, .6], [-37.8, 145, .55], [-27.5, 153, .35], [-31.95, 115.9, .3], [-36.85, 174.8, .3],
];
const PAPER = [40, 30, 93];
async function buildEarth(THREE, clay) {
  const scene3 = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, .1, 400);
  scene3.add(new THREE.HemisphereLight('#fff8f0', '#d9cbb8', 1.15));
  const key = new THREE.DirectionalLight('#fff1e0', 2.2);key.position.set(-20, 26, 30);scene3.add(key);
  // The surface: Natural Earth land on an equirectangular canvas, in the page's palette.
  const full = document.createElement('canvas');full.width = 2048;full.height = 1024;
  const f = full.getContext('2d');f.fillStyle = '#c6dbe4';f.fillRect(0, 0, 2048, 1024);
  f.fillStyle = '#b4c7a2';f.strokeStyle = '#97ad86';f.lineWidth = 2;
  for (const ring of LAND) { f.beginPath();ring.forEach(([lon, lat], i) => { const x = (lon + 180) / 360 * 2048, y = (90 - lat) / 180 * 1024;i ? f.lineTo(x, y) : f.moveTo(x, y); });f.closePath();f.fill();f.stroke(); }
  // Soft woods and farmland on the land, so the globe is not flat where the region hands over to it.
  const landPath = new Path2D();
  for (const ring of LAND) { ring.forEach(([lon, lat], i) => { const x = (lon + 180) / 360 * 2048, y = (90 - lat) / 180 * 1024;i ? landPath.lineTo(x, y) : landPath.moveTo(x, y); });landPath.closePath(); }
  f.save();f.clip(landPath);f.globalAlpha = .35;
  f.drawImage(tintedMask(2048, await maskImage(2048, 512, (u, v) => (fbm(u * 60, v * 30, 57) - .05) * 2), css([104, 24, 54])), 0, 0, 2048, 1024);
  f.globalAlpha = 1;f.restore();
  for (let i = 0; i < 9000; i++) { f.fillStyle = `rgba(80,70,60,${randomAt(5, i) * .05})`;f.fillRect(randomAt(5, i, 1) * 2048, randomAt(5, i, 2) * 1024, 1.5, 1.5); }
  // The texture actually shown: the map drawn outward from the city, blank paper beyond the frontier.
  const tex = document.createElement('canvas');tex.width = 2048;tex.height = 1024;
  const t = tex.getContext('2d');
  const MW = 512, MH = 256, mask = document.createElement('canvas');mask.width = MW;mask.height = MH;
  const mctx = mask.getContext('2d'), img = mctx.createImageData(MW, MH), km = new Float32Array(MW * MH), wave = new Float32Array(MW * MH);
  const la0 = SITE.lat * Math.PI / 180, lo0 = SITE.lon * Math.PI / 180;
  for (let j = 0; j < MH; j++) for (let i = 0, _ = await tick(); i < MW; i++) {
    if (!(i & 127)) await tick();
    const la = (90 - (j + .5) / MH * 180) * Math.PI / 180, lo = ((i + .5) / MW * 360 - 180) * Math.PI / 180;
    wave[j * MW + i] = 1 + .12 * noise2(i / MW * 14, j / MH * 7, { seed: 77 });
    km[j * MW + i] = 6371 * Math.acos(Math.max(-1, Math.min(1, Math.sin(la0) * Math.sin(la) + Math.cos(la0) * Math.cos(la) * Math.cos(lo - lo0))));
  }
  // Night lights, as the Earth looks from the ISS: warm sodium clusters round the great metropolitan regions, their
  // suburbs scattered around each and kept to land, nothing in the oceans. Shown only on a dark page (emissive).
  const lights = document.createElement('canvas');lights.width = 2048;lights.height = 1024;
  const g = lights.getContext('2d');g.fillStyle = '#000';g.fillRect(0, 0, 2048, 1024);
  const at = (lon, lat) => [(lon + 180) / 360 * 2048, (90 - lat) / 180 * 1024];
  for (const [k, [lat, lon, w]] of METROS.entries()) {
    const n = Math.round(60 + w * 220), spread = .5 + w * 2.2;
    for (let i = 0; i < n; i++) {
      const rr = Math.sqrt(-2 * Math.log(1 - randomAt(91, k, i) * .999)) * spread * .5, th = randomAt(92, k, i) * 6.283;
      const [x, y] = at(lon + Math.cos(th) * rr / Math.max(.25, Math.cos(lat * Math.PI / 180)), lat + Math.sin(th) * rr);
      if (!f.isPointInPath(landPath, x, y)) continue;
      const b = Math.exp(-rr / (spread * .9)), size = .35 + b * .8; // fine points: seen close, a city is many small lights
      g.fillStyle = `rgba(255,${Math.round(170 + b * 60)},${Math.round(90 + b * 70)},${(.18 + b * .55).toFixed(2)})`;
      g.beginPath();g.arc(x, y, size, 0, 6.283);g.fill();
    }
    const [cx, cy] = at(lon, lat), glow = g.createRadialGradient(cx, cy, 0, cx, cy, 3 + w * 5);
    glow.addColorStop(0, `rgba(255,214,150,${.18 + w * .25})`);glow.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = glow;g.beginPath();g.arc(cx, cy, 3 + w * 5, 0, 6.283);g.fill();
    if (!(k % 8)) await tick();
  }
  const lightsMap = new THREE.CanvasTexture(lights);lightsMap.colorSpace = THREE.SRGBColorSpace;lightsMap.anisotropy = 8;
  const paper = css(PAPER), pr = parseInt(paper.slice(1, 3), 16), pg = parseInt(paper.slice(3, 5), 16), pb = parseInt(paper.slice(5, 7), 16);
  const map = new THREE.CanvasTexture(tex);map.colorSpace = THREE.SRGBColorSpace;map.anisotropy = 8;
  let shown = -1;
  /** Draw the map out to a great-circle radius in km, with a soft, slightly wavering frontier. */
  function revealTo(radiusKm) {
    const step = radiusKm >= 2e4 ? 2e4 : Math.round(Math.log(Math.max(1, radiusKm)) * 14) / 14;
    if (step === shown) return;
    shown = step;
    const edge = Math.exp(step), soft = Math.max(150, edge * .18);
    for (let n = 0; n < km.length; n++) { const o = n * 4;img.data[o] = pr;img.data[o + 1] = pg;img.data[o + 2] = pb;img.data[o + 3] = radiusKm >= 2e4 ? 0 : 255 * clamp01((km[n] - edge * wave[n]) / soft); }
    mctx.putImageData(img, 0, 0);
    t.drawImage(full, 0, 0);t.imageSmoothingEnabled = true;t.drawImage(mask, 0, 0, 2048, 1024);map.needsUpdate = true;
  }
  revealTo(2e4);
  // The knife: a plane that keeps z ≤ constant, swept from in front of the globe to its centre.
  const planes = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e5)];
  const layers = [
    { r: 10, mat: clay('#ffffff', { map, side: THREE.DoubleSide, emissive: '#ffb76a', emissiveMap: lightsMap, emissiveIntensity: 0 }) },
    { r: 9.3, mat: clay('#ecc9a9', { side: THREE.DoubleSide }) }, // upper mantle
    { r: 7.6, mat: clay('#e5ad87', { side: THREE.DoubleSide }) }, // lower mantle
    { r: 5.4, mat: clay('#df8460', { side: THREE.DoubleSide }) }, // outer core
    { r: 2.4, mat: clay('#e2583c', { userData: { core: true } }) }, // inner core: the point to come, red in both themes
  ].map((L, n) => {
    if (n < 4) L.mat.clippingPlanes = [planes[0]]; // a knife plane that slices the front half away
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(L.r, 128, 96), L.mat);scene3.add(mesh);
    return { ...L, mesh };
  });
  // Orientation: the city's site faces +z (the camera) with north up. Build the turn that takes the
  // site's east, up and north (on the textured sphere) to +x, +y, −z, then tip it a quarter turn.
  const lon = SITE.lon * Math.PI / 180, lat = SITE.lat * Math.PI / 180;
  const e = [-Math.sin(lon), 0, -Math.cos(lon)], n = [Math.cos(lon) * Math.cos(lat), Math.sin(lat), -Math.sin(lon) * Math.cos(lat)], no = [-Math.cos(lon) * Math.sin(lat), Math.cos(lat), Math.sin(lon) * Math.sin(lat)];
  const toSite = new THREE.Matrix4().set(...e, 0, ...n, 0, -no[0], -no[1], -no[2], 0, 0, 0, 0, 1);
  const base = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeRotationX(Math.PI / 2).multiply(toSite));
  layers[0].mesh.quaternion.copy(base);
  const pin = new THREE.Mesh(new THREE.SphereGeometry(.18, 16, 12), clay('#e2583c'));pin.position.set(0, 0, 10.05);scene3.add(pin);
  // The atmosphere on a dark page: a thin blue limb, brightest at the edge (a larger sphere seen from inside, additive).
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(10.5, 96, 64), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    uniforms: { glow: { value: new THREE.Color('#5d9cff') } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 glow; varying vec3 vN; varying vec3 vV; void main(){ float rim = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(glow * rim * .75, rim * .6); }',
  }));
  atmosphere.visible = false;scene3.add(atmosphere);
  // The layers as flat clay rings, crust to outer core, each lying where its shell was cut.
  const rings = [[36, 40, 84], [28, 60, 79], [24, 64, 71], [16, 66, 63]].map((color, k) => {
    const outer = layers[k].r, inner = layers[k + 1].r + .08, shape = new THREE.Shape().absarc(0, 0, outer, 0, Math.PI * 2);
    shape.holes.push(new THREE.Path().absarc(0, 0, inner, 0, Math.PI * 2, true));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: .34, bevelEnabled: true, bevelThickness: .12, bevelSize: .12, bevelSegments: 4, curveSegments: 96 });geo.rotateX(-Math.PI / 2);geo.translate(0, -.17, 0);
    const mesh = new THREE.Mesh(geo, clay(css(vary(color, k, 3, .6)), { transparent: true }));
    mesh.visible = false;scene3.add(mesh);return mesh;
  });
  return { scene: scene3, camera, layers, planes, globe: layers[0].mesh, pin, base, revealTo, rings, atmosphere, THREE };
}

/**
 * Point the Earth's camera where the city camera is, in the Earth's frame: centre at the origin,
 * radius 10, the site on +z with north up. A quarter turn about x maps the city frame onto it.
 */
function drawGlobeFrom(E, pose, view, altitude, revealKm) {
  const k = 10 / EARTH_R, to = (p) => new E.THREE.Vector3(p.x * k, -p.z * k, (p.y + EARTH_R) * k);
  const eye = to(pose.position), at = to(pose.target), dist = eye.length();
  E.camera.position.copy(eye);E.camera.up.set(pose.up.x, -pose.up.z, pose.up.y);E.camera.lookAt(at);
  E.camera.fov = pose.fov * 180 / Math.PI;E.camera.aspect = view.width / view.height;
  E.camera.near = Math.max(1e-5, (dist - 10) * .2);E.camera.far = dist + 20;E.camera.updateProjectionMatrix();
  E.planes.forEach((p) => { p.constant = 1e5; });
  E.layers.forEach((L) => { L.mesh.scale.setScalar(1);L.mesh.position.y = 0; });
  E.globe.quaternion.copy(E.base);
  E.revealTo(revealKm);
  E.pin.visible = altitude > 5e6;E.pin.scale.setScalar(Math.max(.2, dist / 58));
}

const ringOrder = stagger([0, .45], { from: 'first' }), ease = (v) => { const t = clamp01(v);return t * t * (3 - 2 * t); };
const settle = spring({ from: 0, to: 1, stiffness: 90, damping: 8, at: 0 });
/**
 * `cut` in [0, 1] sweeps a knife plane through the front half of the globe while the camera turns to
 * see the hemispheres. `rings` in [0, 1] first brings the camera square to the cut face — which is
 * already a set of concentric rings — then hands over to clay rings in exactly that place, tips them
 * flat, and lifts them apart one after another. `close` in [0, 1] shrinks them outermost first onto
 * the core, and the core into the point the page ends on.
 */
function animateEarth(E, { aspect, time, spin = 0, cut = 0, rings = 0, close = 0, distance = 58 }) {
  E.camera.aspect = aspect;E.camera.fov = 30;E.camera.near = .1;E.camera.far = 400;E.camera.up.set(0, 1, 0);E.camera.updateProjectionMatrix();
  E.revealTo(2e4);
  const square = ease(rings / .25), tip = ease((rings - .3) / .4);
  const turn = .62 * ease(cut) * (1 - square), tilt = .3 * ease(cut) * (1 - square) + .8 * tip;
  E.camera.position.set(Math.sin(turn) * distance * Math.cos(tilt), Math.sin(tilt) * distance, Math.cos(turn) * distance * Math.cos(tilt));E.camera.lookAt(0, 0, 0);
  E.planes[0].constant = cut > 0 ? 10.4 * (1 - ease(cut)) : 1e5;
  E.globe.quaternion.copy(new E.THREE.Quaternion().setFromAxisAngle(new E.THREE.Vector3(0, 1, 0), spin * (1 - ease(cut))).multiply(E.base));
  E.pin.visible = cut < .02;E.pin.scale.setScalar(1);
  // The shells give way to rings while the camera is square to the cut, where both look the same.
  const handover = ease((rings - .24) / .06), n = E.rings.length;
  E.layers.forEach((L, k) => { if (k < E.layers.length - 1) { L.mesh.visible = handover < 1;L.mat.transparent = handover > 0;L.mat.opacity = 1 - handover; } });
  E.rings.forEach((ring, k) => {
    const delay = ringOrder(k, n), shut = ease((close - delay) / .5);
    const lift = settle.sample(Math.max(0, (rings - .55 - delay * .4) * 2.4)) * (1 - ease(close * 1.6));
    ring.visible = handover > 0 && shut < .999;ring.material.opacity = handover;ring.material.depthWrite = handover > .5;
    ring.position.y = (n - k) * 2.3 * lift + Math.sin(time * .9 + k * 1.3) * .1 * lift;
    ring.rotation.set(Math.PI / 2 * (1 - tip) + Math.sin(time * .6 + k) * .04 * lift, time * .05 * (k % 2 ? 1 : -1) * lift, Math.cos(time * .5 + k) * .04 * lift);
    ring.scale.setScalar(Math.max(1e-3, 1 - shut));
  });
  // The core: last to remain, it shrinks into the point the page ends on, and stays.
  const core = E.layers[E.layers.length - 1].mesh;core.scale.setScalar(1 - .75 * ease((close - .75) / .25));core.position.y = 0;
}

// ---- Garden ---------------------------------------------------------------------------------------
const ISLAND_Y = 2.2, ISLAND = { rx: 10.8, rz: 7.4 };
/** The dandelion the story began on: a plant in this garden, where the camera starts. */
export const DANDELION = { x: -1.6, z: 2.4, height: 5.4 };
export const DANDELION_HEAD = { x: DANDELION.x, y: ISLAND_Y + 2.3 + DANDELION.height, z: DANDELION.z };
/** The stem is built along a seeded curve; its tip, where the receptacle sits, is computed the same way. */
export const DANDELION_RECEPTACLE = (() => { const a = randomAt(93, 7, 1) * 6.283;return { x: DANDELION.x + Math.cos(a) * .25, y: DANDELION_HEAD.y + .12, z: DANDELION.z + Math.sin(a) * .25 }; })();
/** Clearings: where this noise is low the garden stays open, as real beds have paths and gaps. */
const clearing = (x, z) => fbm(x * .14 + 4.1, z * .14 - 2.3, 9);
/** Drifts: neighbouring plants tend to share a kind, as in a planted border. */
function driftKind(x, z, u, edge = false) {
  const weights = edge ? { grass: 4, leaves: 2, fern: 1, pebble: .6 } : { daisy: 3, tulip: 2, poppy: 2, spike: 2, bush: 1.4, grass: 2.5, leaves: 1.6, fern: 1, mushroom: .5 };
  if (!edge) { const n = noise2(x * .13, z * .13, { seed: 12 }), favour = ['daisy', 'tulip', 'spike', 'poppy'][Math.min(3, Math.floor((n * .5 + .5) * 4))];weights[favour] *= 4; }
  return distribution.pick(weights, u);
}
/** The density budget for new flowers: room, not in a clearing, and few close neighbours. */
function plantable(x, z, plants, sprouts, k) {
  if ((x / ISLAND.rx) ** 2 + (z / ISLAND.rz) ** 2 > .92) return null;
  const open = clearing(x, z);
  if (open < -.16) return null;
  let close = 0;
  for (const p of plants) { const d = Math.hypot(p.x - x, p.z - z);if (d < .95) return null;if (d < 2.4) close++; }
  for (const p of sprouts) { const d = Math.hypot(p.x - x, p.z - z);if (d < 1.1) return null;if (d < 2.4) close++; }
  if (close >= 6) return null;
  return driftKind(x, z, randomAt(98, k, 0), open < .02);
}

/** Merge a built plant's meshes by material: one draw call per material, not per petal. */
function bake(THREE, group) {
  group.updateMatrixWorld(true);
  const inv = group.matrixWorld.clone().invert(), byMaterial = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!byMaterial.has(o.material)) byMaterial.set(o.material, []);
    byMaterial.get(o.material).push(g);
  });
  const out = new THREE.Group();out.position.copy(group.position);out.quaternion.copy(group.quaternion);
  for (const [material, list] of byMaterial) {
    const count = list.reduce((s, g) => s + g.attributes.position.count, 0), pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
    let at = 0;
    for (const g of list) { pos.set(g.attributes.position.array, at * 3);nor.set(g.attributes.normal.array, at * 3);at += g.attributes.position.count;g.dispose(); }
    const geo = new THREE.BufferGeometry();geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, material);mesh.castShadow = mesh.receiveShadow = true;out.add(mesh);
  }
  return out;
}

/** Shared clay flower parts and builders. Every plant varies in size, lean, count and tint. */
function flowerKit(THREE, clay) {
  const SPHERE = new THREE.SphereGeometry(1, 20, 14), CAP = new THREE.SphereGeometry(1, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), Y = new THREE.Vector3(0, 1, 0);
  const VIEW = new THREE.Vector3(.68, 0, .73); // toward the garden camera
  /** A tapered stem along a gentle curve. */
  function stem(parent, h, lean, radius, mat, k) {
    const g = (c) => randomAt(93, k, c), a = g(1) * 6.283;
    const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * lean * .15, h * .35, Math.sin(a) * lean * .15), new THREE.Vector3(Math.cos(a) * lean * .55, h * .72, Math.sin(a) * lean * .55), new THREE.Vector3(Math.cos(a) * lean, h, Math.sin(a) * lean)];
    const curve = new THREE.CatmullRomCurve3(pts), segs = 22, radial = 8, geo = new THREE.TubeGeometry(curve, segs, radius, radial);
    const pos = geo.attributes.position;
    for (let i = 0; i <= segs; i++) { const c = curve.getPointAt(i / segs), s = 1 - .45 * i / segs;for (let j = 0; j <= radial; j++) { const v = i * (radial + 1) + j;pos.setXYZ(v, c.x + (pos.getX(v) - c.x) * s, c.y + (pos.getY(v) - c.y) * s, c.z + (pos.getZ(v) - c.z) * s); } }
    geo.computeVertexNormals();parent.add(new THREE.Mesh(geo, mat));
    return curve;
  }
  /** A leaf blade, arched along its length. */
  function blade(len, w, bend) {
    const shape = new THREE.Shape();shape.moveTo(0, 0);shape.bezierCurveTo(w, len * .3, w * .8, len * .8, 0, len);shape.bezierCurveTo(-w * .8, len * .8, -w, len * .3, 0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: .05, bevelEnabled: true, bevelThickness: .05, bevelSize: .05, bevelSegments: 2, curveSegments: 12 });
    const pos = geo.attributes.position;
    for (let v = 0; v < pos.count; v++) { const y = pos.getY(v), t = y / len, ang = t * bend;pos.setZ(v, pos.getZ(v) * Math.cos(ang) - y * Math.sin(ang) * .6);pos.setY(v, y * Math.cos(ang * .6)); }
    geo.computeVertexNormals();return geo;
  }
  const blob = (parent, mat, [x, y, z], [sx, sy, sz], rot = [0, 0, 0]) => { const m = new THREE.Mesh(SPHERE, mat);m.position.set(x, y, z);m.scale.set(sx, sy, sz);m.rotation.set(...rot);parent.add(m);return m; };
  /** A flower head facing up and a little toward the viewer, at the stem's tip. */
  const headAt = (parent, curve, k, tilt) => {
    const g = (c) => randomAt(94, k, c), head = new THREE.Group();head.position.copy(curve.getPoint(1));
    const n = new THREE.Vector3(VIEW.x * tilt + (g(1) - .5) * .5, 1, VIEW.z * tilt + (g(2) - .5) * .5).normalize();
    head.quaternion.setFromUnitVectors(Y, n);head.rotateY(g(3) * 6.283);parent.add(head);return head;
  };
  const leafPair = (parent, curve, k, mat, at = .3) => {
    const g = (c) => randomAt(95, k, c);
    for (const side of [0, 1]) { const p = curve.getPoint(at + side * .12), leaf = new THREE.Mesh(blade(.9 + g(side) * .6, .32 + g(side + 2) * .12, .5 + g(side + 4) * .4), mat);leaf.position.copy(p);leaf.rotation.set(-.9 - g(side + 6) * .4, side * Math.PI + g(side + 8) * 1.2, 0);parent.add(leaf); }
  };
  const tint = (base, k, c, amount = 1) => css(vary(base, k, c, amount));
  const builders = {
    daisy(p, k, sc, g) {
      const colours = [[42, 42, 95], [42, 42, 95], [348, 48, 87], [24, 62, 85], [52, 60, 86]];
      const stemMat = clay(tint([96, 24, 46], k, 1)), curve = stem(p, (2.6 + g(1) * 2.4) * sc, (g(2) - .2) * 1.3 * sc, .12 * sc, stemMat, k);
      leafPair(p, curve, k, clay(tint([100, 24, 50], k, 2)));
      const head = headAt(p, curve, k, .55), size = (.95 + g(3) * .45) * sc, n = 10 + Math.floor(g(4) * 6);
      const petal = clay(tint(colours[Math.floor(g(5) * colours.length)], k, 3, .8)), centre = clay(tint([38, 72, 58], k, 4));
      blob(head, centre, [0, .06 * size, 0], [.4 * size, .26 * size, .4 * size]);
      for (let i = 0; i < n; i++) {
        const a = i / n * 6.283 + (g(10 + i) - .5) * .25, pivot = new THREE.Group();pivot.rotation.y = a;head.add(pivot);
        blob(pivot, petal, [.66 * size, .02, 0], [.62 * size * (.88 + g(30 + i) * .24), .07 * size, .19 * size], [0, 0, .2 + (g(50 + i) - .5) * .25]);
      }
    },
    tulip(p, k, sc, g) {
      const colours = [[10, 72, 60], [16, 70, 68], [24, 62, 78], [346, 50, 74], [40, 64, 80]];
      const curve = stem(p, (2.8 + g(1) * 2.2) * sc, (g(2) - .3) * .9 * sc, .13 * sc, clay(tint([98, 24, 44], k, 1)), k);
      const leafMat = clay(tint([102, 22, 48], k, 2));
      for (let l = 0; l < 2; l++) { const leaf = new THREE.Mesh(blade((2 + g(20 + l) * 1.4) * sc, .42 * sc, .7 + g(22 + l) * .5), leafMat);leaf.rotation.set(-.25 - g(24 + l) * .3, l * Math.PI + g(26 + l), 0);p.add(leaf); }
      const head = headAt(p, curve, k, .2), s = (1 + g(3) * .35) * sc, petal = clay(tint(colours[Math.floor(g(4) * colours.length)], k, 3, .8));
      for (let i = 0; i < 6; i++) {
        const inner = i % 2, pivot = new THREE.Group();pivot.rotation.y = i / 6 * 6.283 + g(40 + i) * .2;head.add(pivot);
        blob(pivot, petal, [(inner ? .17 : .24) * s, .62 * s, 0], [(inner ? .3 : .34) * s, (inner ? .72 : .8) * s, .2 * s], [0, 0, inner ? .12 : .24 + g(50 + i) * .1]);
      }
    },
    poppy(p, k, sc, g) {
      const colours = [[10, 70, 64], [20, 74, 66], [350, 52, 78], [30, 70, 74]];
      const curve = stem(p, (2.2 + g(1) * 2) * sc, (g(2) - .2) * 1.6 * sc, .1 * sc, clay(tint([94, 22, 50], k, 1)), k);
      const head = headAt(p, curve, k, .5), s = (.9 + g(3) * .4) * sc, petal = clay(tint(colours[Math.floor(g(4) * colours.length)], k, 3, .8));
      const n = 4 + Math.floor(g(5) * 2);
      for (let i = 0; i < n; i++) { const pivot = new THREE.Group();pivot.rotation.y = i / n * 6.283 + g(10 + i) * .3;head.add(pivot);blob(pivot, petal, [.46 * s, .06, 0], [.6 * s, .1 * s, .56 * s], [0, 0, .45 + g(20 + i) * .2]); }
      blob(head, clay(tint([90, 16, 30], k, 4)), [0, .16 * s, 0], [.2 * s, .17 * s, .2 * s]);
    },
    spike(p, k, sc, g) {
      const colours = [[262, 26, 72], [280, 22, 76], [340, 38, 82], [250, 22, 70]];
      const h = (3.2 + g(1) * 2.2) * sc, curve = stem(p, h, (g(2) - .5) * .9 * sc, .11 * sc, clay(tint([96, 20, 48], k, 1)), k);
      leafPair(p, curve, k, clay(tint([100, 22, 50], k, 2)), .15);
      const base = colours[Math.floor(g(3) * colours.length)], low = clay(tint(base, k, 3)), high = clay(tint([base[0], base[1] - 4, base[2] + 8], k, 4));
      const n = 14 + Math.floor(g(4) * 8);
      for (let i = 0; i < n; i++) {
        const u = .45 + .55 * i / n, at = curve.getPoint(u), a = i * 2.4, rr = (.2 - .12 * i / n) * sc, size = (.27 - .15 * i / n) * sc * (.85 + g(10 + i) * .3);
        blob(p, i > n * .55 ? high : low, [at.x + Math.cos(a) * rr, at.y, at.z + Math.sin(a) * rr], [size, size * 1.15, size]);
      }
    },
    bush(p, k, sc, g) {
      const a = clay(tint([100, 20, 54], k, 1)), b = clay(tint([106, 22, 46], k, 2)), bloom = clay(tint(g(9) < .5 ? [42, 40, 94] : [348, 44, 86], k, 3));
      const n = 6 + Math.floor(g(1) * 4), balls = [];
      for (let i = 0; i < n; i++) { const ang = g(10 + i) * 6.283, d = g(20 + i) * 1.1 * sc, s = (.6 + g(30 + i) * .55) * sc, pos = [Math.cos(ang) * d, s * .75 + g(40 + i) * .5 * sc, Math.sin(ang) * d];balls.push([pos, s]);blob(p, i % 3 ? a : b, pos, [s, s * .9, s]); }
      for (let i = 0; i < 7; i++) { const [[x, y, z], s] = balls[i % balls.length], u = g(60 + i) * 6.283, v = g(70 + i) * 1.2;blob(p, bloom, [x + Math.cos(u) * Math.sin(v) * s, y + Math.cos(v) * s * .9, z + Math.sin(u) * Math.sin(v) * s], [.13 * sc, .13 * sc, .13 * sc]); }
    },
    mushroom(p, k, sc, g) {
      const h = (.7 + g(1) * .5) * sc, stalk = new THREE.Mesh(new THREE.CylinderGeometry(.16 * sc, .22 * sc, h, 14), clay(tint([40, 30, 90], k, 1)));stalk.position.y = h / 2;p.add(stalk);
      const capMat = clay(tint([12, 60, 62], k, 2)), cap = new THREE.Mesh(CAP, capMat), s = (.55 + g(2) * .25) * sc;cap.position.y = h * .92;cap.scale.set(s, s * .75, s);cap.rotation.z = (g(3) - .5) * .3;p.add(cap);
      const dot = clay('#f7eee2');
      for (let i = 0; i < 6; i++) { const u = g(10 + i) * 6.283, v = .3 + g(20 + i) * .9;blob(p, dot, [Math.cos(u) * Math.sin(v) * s, h * .92 + Math.cos(v) * s * .75, Math.sin(u) * Math.sin(v) * s], [.07 * sc, .03 * sc, .07 * sc]); }
    },
    grass(p, k, sc, g) {
      const mats = [clay(tint([92, 26, 48], k, 1)), clay(tint([100, 22, 58], k, 2))], n = 7 + Math.floor(g(1) * 5);
      for (let i = 0; i < n; i++) { const leaf = new THREE.Mesh(blade((1 + g(10 + i) * 1.3) * sc, (.1 + g(20 + i) * .07) * sc, .5 + g(30 + i) * .6), mats[i % 2]);leaf.position.set((g(40 + i) - .5) * .5 * sc, 0, (g(50 + i) - .5) * .5 * sc);leaf.rotation.set(-.15 - g(60 + i) * .35, g(70 + i) * 6.283, 0);p.add(leaf); }
    },
    leaves(p, k, sc, g) {
      const mats = [clay(tint([100, 20, 54], k, 1)), clay(tint([104, 22, 44], k, 2))];
      for (let l = 0; l < 3 + Math.floor(g(1) * 3); l++) { const leaf = new THREE.Mesh(blade((1.6 + g(10 + l) * 1.4) * sc, (.5 + g(20 + l) * .3) * sc, .35 + g(30 + l) * .4), mats[l % 2]);leaf.rotation.set(-.25 - g(40 + l) * .4, l / 3 * 6.283 + (g(50 + l) - .5) * .8, 0);p.add(leaf); }
    },
    fern(p, k, sc, g) {
      // A crozier: a stalk that winds into a tightening spiral at its tip.
      const h = (2.4 + g(1) * 1.8) * sc, size = (.7 + g(2) * .4) * sc, pts = [];
      for (let s = 0; s <= 20; s++) { const u = s / 20;pts.push(new THREE.Vector3(Math.sin(u * 2.2) * .3 * sc, u * h, 0)); }
      for (let s = 1; s <= 40; s++) { const v = s / 40, a = Math.PI + v * 1.6 * Math.PI * 2, rr = size * (1 - .78 * v);pts.push(new THREE.Vector3(.3 * sc + size + Math.cos(a) * rr, h + Math.sin(a) * rr, 0)); }
      p.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, (.15 + g(3) * .05) * sc, 10), clay(tint([100, 22, 56], k, 1))));
      p.rotation.y = g(4) * 6.283;
    },
    pebble(p, k, sc, g) { blob(p, clay(tint([36, 14, 82], k, 1, .8)), [0, .18 * sc, 0], [(.6 + g(1) * .5) * sc, (.3 + g(2) * .15) * sc, (.5 + g(3) * .3) * sc]); },
  };
  /**
   * The dandelion, kept live (not merged): its stem is a tapered tube rebuilt from any 13 points, so
   * it can take the painted stem's shape at the handover and spring back to its own.
   */
  function dandelion() {
    const group = new THREE.Group(), stemMat = clay(css([92, 22, 46])), a = randomAt(93, 7, 1) * 6.283, lean = .25, h = DANDELION.height;
    const natural = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * lean * .15, h * .35, Math.sin(a) * lean * .15), new THREE.Vector3(Math.cos(a) * lean * .55, h * .72, Math.sin(a) * lean * .55), new THREE.Vector3(Math.cos(a) * lean, h, Math.sin(a) * lean)]).getPoints(12);
    const head = new THREE.Group();group.add(head);
    blob(head, clay(css([34, 12, 64])), [0, .12, 0], [.36, .29, .36]);
    const pit = clay(css([30, 14, 46]));
    for (let i = 0; i < 46; i++) {
      const t = i * 2.39996, r = Math.sqrt((i + .5) / 46) * 1.25, n = new THREE.Vector3(Math.cos(t) * Math.sin(r), Math.cos(r), Math.sin(t) * Math.sin(r));
      blob(head, pit, [n.x * .35, .12 + n.y * .28, n.z * .35], [.035, .012, .035]).quaternion.setFromUnitVectors(Y, n);
    }
    let tube = null;
    const shape = (points) => {
      const curve = new THREE.CatmullRomCurve3(points), segs = 36, radial = 10, geo = new THREE.TubeGeometry(curve, segs, .16, radial), pos = geo.attributes.position;
      for (let i = 0; i <= segs; i++) { const c = curve.getPointAt(i / segs), k = 1 - .4 * i / segs;for (let j = 0; j <= radial; j++) { const v = i * (radial + 1) + j;pos.setXYZ(v, c.x + (pos.getX(v) - c.x) * k, c.y + (pos.getY(v) - c.y) * k, c.z + (pos.getZ(v) - c.z) * k); } }
      geo.computeVertexNormals();
      if (tube) { tube.geometry.dispose();tube.geometry = geo; } else { tube = new THREE.Mesh(geo, stemMat);tube.castShadow = true;group.add(tube); }
      head.position.copy(points[points.length - 1]);
    };
    shape(natural);
    let current = null;
    return {
      group,
      /** Blend the stem toward `points` (13, plant-local) by `w`; w = 0 is its own shape. */
      bend(points, w) {
        const key = w <= 0 || !points ? 'natural' : null;
        if (key && current === 'natural') return;
        shape(key ? natural : natural.map((p, i) => p.clone().lerp(points[i], w)));
        current = key;
      },
    };
  }
  return {
    dandelion,
    /** Build one plant of a kind, merged for drawing. */
    make(kind, k, sc = 1, bakeIt) { const p = new THREE.Group();builders[kind](p, k, sc, (c) => randomAt(92, k, c));return bakeIt(p); },
  };
}

async function buildGarden(THREE, clay, kit, root) {
  // The island: an organic outline, extruded with a generous bevel, sage on top and peach beneath.
  const g = (k, c) => randomAt(91, k, c), wob = (k, c, a) => (g(k, c) + g(k, c + 40) - 1) * a;
  const outline = new THREE.Shape(), n = 14;
  const pts = Array.from({ length: n }, (_, k) => { const a = k / n * Math.PI * 2, rr = 9.5 * (1 + wob(k, 1, .12)) * (k % 2 ? 1 : .96);return new THREE.Vector2(Math.cos(a) * rr * 1.25, Math.sin(a) * rr * .9); });
  outline.setFromPoints(new THREE.SplineCurve([...pts, pts[0]]).getPoints(120));
  const slab = new THREE.ExtrudeGeometry(outline, { depth: 1.4, bevelEnabled: true, bevelThickness: .9, bevelSize: .9, bevelSegments: 8, curveSegments: 64 });
  slab.rotateX(-Math.PI / 2);
  await tick();
  const island = new THREE.Mesh(slab, [clay('#9fb38f'), clay('#ead2c0')]);island.position.y = ISLAND_Y;island.castShadow = island.receiveShadow = true;root.add(island);root.userData.island = island;
  const top = ISLAND_Y + 1.4 + .9, plants = [];
  // Positions: Poisson-disc sampling inside the island, so nothing crowds; clearings stay open.
  const ring = Array.from({ length: 32 }, (_, i) => { const a = i / 32 * 6.283;return [i ? 'L' : 'M', Math.cos(a) * ISLAND.rx * .94, Math.sin(a) * ISLAND.rz * .94]; });
  const spots = points({ in: { polygon: [...ring, ['Z']] }, method: 'poisson', minDistance: 1.15, count: 96, seed: 4 });
  await tick();
  const live = kit.dandelion(), dandelion = live.group;dandelion.position.set(DANDELION.x, top, DANDELION.z);root.add(dandelion);root.userData.dandelion = live;
  plants.push({ object: dandelion, kind: 'dandelion', k: 999, x: DANDELION.x, z: DANDELION.z, delay: -1, lean: { x: 0, z: 0, vx: 0, vz: 0 } });
  await tick();
  for (let i = 0; i < spots.count; i++) {
    await tick();
    const x = spots.x[i], z = spots.y[i], open = clearing(x, z);
    if (Math.hypot(x - DANDELION.x, z - DANDELION.z) < 1.6) continue;
    if (open < -.22 && g(i, 9) > .25) continue;
    const kind = open < -.22 ? 'pebble' : driftKind(x, z, g(i, 2), open < -.06);
    const plant = kit.make(kind, i, .9 + g(i, 3) * .3, (p) => bake(THREE, p));plant.position.set(x, top, z);root.add(plant);
    plants.push({ object: plant, kind, k: i, x, z, delay: Math.hypot(x - 1, z) * .08 + g(i, 6) * .25, lean: { x: 0, z: 0, vx: 0, vz: 0 } });
  }
  return plants;
}

/** Grow each plant on a physical spring, sway it, and lean it away from the pointer's push. */
function animateGarden(plants, { time, grow, pointer, ripples }) {
  for (const p of plants) {
    p.spring ??= spring({ from: 0, to: 1, stiffness: 110, damping: 9, at: 1 + p.delay });
    p.object.scale.setScalar(p.kind === 'dandelion' ? 1 : Math.max(.001, p.spring.sample(Math.max(1 + p.delay, 1 + Math.min(grow, 30)))));
    let fx = .05 * noise2(time * .4 + p.k, p.k * .3, { seed: 3 }), fz = .05 * noise2(p.k * .3, time * .4 + p.k, { seed: 4 });
    if (pointer) { const dx = p.x - pointer.x, dz = p.z - pointer.z, f = Math.exp(-(dx * dx + dz * dz) / 9) * .5;fx += dx * f * .25;fz += dz * f * .25; }
    for (const rp of ripples) { const age = time - rp.t, d = Math.hypot(p.x - rp.x, p.z - rp.z), front = age * 9;if (age > 0 && age < 2) { const k = Math.exp(-((d - front) ** 2) / 2) * (1 - age / 2) * .4;fx += (p.x - rp.x) / (d + .1) * k;fz += (p.z - rp.z) / (d + .1) * k; } }
    p.lean.vx += (fx - p.lean.x) * .08 - p.lean.vx * .12;p.lean.vz += (fz - p.lean.z) * .08 - p.lean.vz * .12;p.lean.x += p.lean.vx;p.lean.z += p.lean.vz;
    if (p.kind !== 'dandelion') { p.object.rotation.x = p.lean.z;p.object.rotation.z = -p.lean.x; }
  }
}

/** Flowers planted along the pointer's path rise on a spring with a little overshoot, then sway. */
function growSprouts(sprouts, meshes, { time, kit, root, bake }) {
  for (const sp of sprouts) {
    let m = meshes.get(sp);
    if (!m) { m = kit.make(sp.kind, 500 + sp.k, .75 + randomAt(97, sp.k) * .2, bake);m.position.set(sp.x, sp.y, sp.z);root.add(m);meshes.set(sp, m); }
    sp.spring ??= spring({ from: 0, to: 1, stiffness: 120, damping: 7, at: sp.t });
    m.scale.setScalar(Math.max(.001, sp.spring.sample(Math.max(sp.t, time))));
    m.rotation.x = .05 * noise2(time * .5 + sp.k, 1, { seed: 5 });m.rotation.z = .05 * noise2(2, time * .5 + sp.k, { seed: 6 });
  }
  for (const [sp, m] of meshes) if (!sprouts.includes(sp)) { root.remove(m);meshes.delete(sp); }
}

/** Springy hover: each building rises toward 1 while hovered and settles back after. */
export function createLift() {
  const events = new Map();
  const value = (id, t) => { const e = events.get(id);if (!e) return 0;return spring({ from: e.from, to: e.to, stiffness: 160, damping: 12, at: e.at }).sample(Math.max(e.at, t)); };
  return {
    value,
    hover(id, t) { const e = events.get(id);if (!e || e.to !== 1) events.set(id, { to: 1, at: t, from: value(id, t) }); },
    leave(id, t) { const e = events.get(id);if (e && e.to === 1) events.set(id, { to: 0, at: t, from: value(id, t) }); },
  };
}
