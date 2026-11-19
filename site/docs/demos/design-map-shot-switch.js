import {hsla, toHex} from '../../runtime/src/color/index.js';
import {heightfield} from '../../runtime/src/maps/index.js';
import {gradientNoise2} from '../../runtime/src/noise/index.js';
import {cameraShots, reliefMap} from '../../runtime/src/renderers/three-cinematic.js';
import {ground} from './_kit.js';
import {disc, dragStudy, label, paintColor, WIDTH} from './design-stage.js';

const VIEW_HEIGHT = 288;
const HEIGHT = 348;
const BOUNDS = {x0: -110000, y0: -72000, x1: 110000, y1: 72000};
const LAKE = {x: -13000, y: -5000, rx: 26500, ry: 17900, elevation: 460};
const RIVER_START = LAKE.y - LAKE.ry * .87;
const RIVER_REACH = RIVER_START - BOUNDS.y0 - 800;
const DURATION = 4;
const MOVE = 2.6;
const START = 60;
const END = WIDTH - START;

const RIDGES = [
  [-77000, 38000, 1910, 33000, 23000],
  [-95000, 13000, 1470, 19000, 24000],
  [-39000, 49500, 1550, 20000, 16600],
  [41500, 41000, 1730, 30000, 17600],
  [75000, 15000, 1430, 18400, 28700],
  [69000, -42300, 1320, 22100, 20400],
  [-68500, -43200, 820, 27000, 15600],
];

const style = {
  terrain: {
    ramp: {stops: [
      {metres: 0, color: hsla(41, 35, 47)},
      {metres: 460, color: hsla(101, 35, 35)},
      {metres: 950, color: hsla(82, 35, 44)},
      {metres: 1700, color: hsla(48, 34, 57)},
      {metres: 2700, color: hsla(36, 20, 75)},
    ]},
    slopeDarkening: {amount: .18, startDeg: 21, endDeg: 63},
    microDetail: {normalNoise: .3},
  },
  water: {
    sea: {color: hsla(198, 48, 36)},
    lake: {deep: hsla(198, 68, 31), shallow: hsla(177, 62, 47)},
    river: {deep: hsla(193, 64, 36), shallow: hsla(177, 60, 50)},
  },
  rivers: {},
};
const rig = {
  sun: {azimuthDeg: 302, elevationDeg: 37, color: hsla(40, 70, 85), intensity: 3.6},
  sky: {color: hsla(207, 50, 81), ground: hsla(37, 31, 54), intensity: 1.3},
};

function riverPoint(t) {
  const bend = 15500 * Math.sin(t * 7.6) * Math.min(1, t / .22);
  return {x: LAKE.x + 30000 * t + bend, y: RIVER_START - RIVER_REACH * t};
}

function makeField() {
  const columns = 121;
  const rows = 81;
  const values = new Float64Array(columns * rows);
  for (let row = 0; row < rows; row++) {
    const v = row / (rows - 1);
    const y = BOUNDS.y1 - (BOUNDS.y1 - BOUNDS.y0) * v;
    for (let column = 0; column < columns; column++) {
      const u = column / (columns - 1);
      const x = BOUNDS.x0 + (BOUNDS.x1 - BOUNDS.x0) * u;
      let metres = 325 + 220 * gradientNoise2(u * 10, v * 10, {seed: 8});
      const roughness = 180 * gradientNoise2(u * 25, v * 25, {seed: 9})
        + 74 * gradientNoise2(u * 53, v * 53, {seed: 11});
      for (const [cx, cy, rise, spreadX, spreadY] of RIDGES) {
        metres += (rise + roughness) * Math.exp(-(((x - cx) / spreadX) ** 2 + ((y - cy) / spreadY) ** 2));
      }
      const distance = Math.hypot((x - LAKE.x) / LAKE.rx, (y - LAKE.y) / LAKE.ry);
      const shore = Math.min(1, Math.max(0, (distance - .93) / .55));
      metres = LAKE.elevation + (metres - LAKE.elevation) * shore;
      if (y <= RIVER_START) {
        const t = Math.min(1, (RIVER_START - y) / RIVER_REACH);
        const valley = Math.exp(-(((x - riverPoint(t).x) / 9900) ** 2));
        const riverbed = LAKE.elevation + 19 - 115 * t - 185 * t * t;
        metres += (riverbed - metres) * valley;
      }
      const edge = Math.min(1, 18 * Math.min(u, 1 - u, v, 1 - v));
      values[row * columns + column] = 36 + (metres - 36) * edge;
    }
  }
  return heightfield({columns, rows, values, bounds: BOUNDS});
}

function lakeOutline() {
  return Array.from({length: 56}, (_, index) => {
    const angle = index / 56 * Math.PI * 2;
    const outlet = .28 * Math.exp(-(((angle - 5) / .27) ** 2));
    const radius = 1 + .095 * Math.sin(3 * angle) + .045 * Math.sin(7 * angle + .5) + outlet;
    return {x: LAKE.x + LAKE.rx * radius * Math.cos(angle), y: LAKE.y + LAKE.ry * radius * Math.sin(angle)};
  });
}

async function localThree() {
  const directory = new URL('.', import.meta.url).pathname;
  return directory.endsWith('/docs/demos/')
    ? import('../../vendor/three/three.module.js')
    : import('../../three/three.module.js');
}

export default async function mapShotSwitch(stage, ctx) {
  const THREE = await localThree();
  const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setSize(WIDTH, VIEW_HEIGHT, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  const map = reliefMap(THREE, {
    field: makeField(), style, rig, width: 2.45, exaggeration: 19, grid: 114, riverWidth: .036,
    rivers: [{id: 'valley-river', points: Array.from({length: 36}, (_, index) => riverPoint(index / 35))}],
    lakes: [{outline: lakeOutline(), elevation: LAKE.elevation}],
  });
  map.sun.shadow.mapSize.set(1024, 1024);
  const scene = new THREE.Scene();
  scene.add(map.group);
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(map.width + .02, .105, map.depth + .02),
    new THREE.MeshStandardMaterial({roughness: .95}),
  );
  slab.position.y = -.046;
  slab.castShadow = slab.receiveShadow = true;
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshStandardMaterial({roughness: .92}),
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = -.101;
  surface.receiveShadow = true;
  scene.add(surface, slab);

  const lake = map.toScene(LAKE.x, LAKE.y, LAKE.elevation);
  const sequence = cameraShots([
    {at: 0, position: [1.22, 1.53, 2.36], target: [0, .04, 0], fov: 40},
    {at: DURATION, position: [lake.x + .33, .74, lake.z + .85], target: [lake.x, lake.y, lake.z], fov: 37},
  ], {move: MOVE, reducedMotion: ctx.still});
  const camera = new THREE.PerspectiveCamera(40, WIDTH / VIEW_HEIGHT, .01, 30);
  const splice = {name: 'the film marker', x: START, y: 309, axis: 'x', minX: START, maxX: END};
  let lastTime;
  let lastTheme;

  const stop = dragStudy(stage, ctx, {
    height: HEIGHT,
    handles: [splice],
    draw(g, {width, height, dark, ink}) {
      const time = DURATION * (splice.x - START) / (END - START);
      const pose = sequence.pose(time);
      if (time !== lastTime || dark !== lastTheme) {
        surface.material.color.set(toHex(hsla(186, 13, dark ? 20 : 66), {alpha: 'never'}));
        slab.material.color.set(toHex(hsla(28, 22, dark ? 35 : 47), {alpha: 'never'}));
        camera.position.set(...pose.position);
        camera.lookAt(...pose.target);
        camera.fov = pose.fov;
        camera.updateProjectionMatrix();
        map.setTime(time);
        renderer.render(scene, camera);
        lastTime = time;
        lastTheme = dark;
      }
      g.fillStyle = ground(ctx);
      g.fillRect(0, 0, width, height);
      g.drawImage(renderer.domElement, 0, 0, WIDTH, VIEW_HEIGHT);
      g.fillStyle = ink;
      g.fillRect(START, splice.y - 1, END - START, 2);
      label(g, 'Whole valley', START, 331, ink, 13);
      label(g, 'Lake and river', END, 331, ink, 13);
      disc(g, splice.x, splice.y, 12, ink);
      disc(g, splice.x, splice.y, 7, paintColor(172, 49, dark ? 68 : 40));
      if (pose.moving) return 'Flying in toward the lake and river.';
      if (time >= (ctx.still ? DURATION - MOVE / 2 : DURATION)) return 'Close shot. The river winds through the valley below the lake.';
      return 'Wide shot. The fictional valley fits on a tabletop.';
    },
  });
  return () => {
    stop();
    map.dispose();
    for (const mesh of [slab, surface]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    renderer.dispose();
    renderer.forceContextLoss();
  };
}
