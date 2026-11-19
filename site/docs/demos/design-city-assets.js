// The city kit's people and vehicles side by side: walkers dressed for the weather, one walker in every walking
// style, every vehicle kind, and the cars in each era. Every figure and body comes from the kit's own generators.
import {toRGBA, hsla} from '../../runtime/src/color/index.js';
import {
  CAR_PAINT,
  personAsset,
  personColors,
  personGaits,
  personMotion,
  personPose,
  posePerson,
  personRig,
  personWardrobe,
  vehicleAsset,
  vehicleKinds,
} from '../../runtime/src/procedural/city/index.js';
import {css} from './_kit.js';

const CSS = `
.ek-city-assets { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; }
.ek-city-assets-controls { display: flex; flex-wrap: wrap; gap: .75rem 1.15rem; padding: .8rem 1rem; }
.ek-city-assets-controls label { display: grid; gap: .2rem; flex: 1 1 9rem; font-size: .875rem; font-weight: 650; }
.ek-city-assets-controls select { min-height: 2.4rem; padding: .25rem .5rem; border: 1px solid var(--line); border-radius: 8px; color: var(--ink); background: var(--ground); font: inherit; font-weight: 450; }
.ek-city-assets-controls input { width: 100%; min-height: 2.4rem; margin: 0; }
.ek-city-assets-controls button { align-self: end; min-height: 2.4rem; padding: .25rem .75rem; border: 1px solid var(--line); border-radius: 8px; color: var(--ink); background: var(--ground); font: inherit; cursor: pointer; }
.ek-city-assets-controls label[hidden] { display: none; }
.ek-city-assets-viewport { display: grid; aspect-ratio: 16 / 9; min-height: 220px; }
.ek-city-assets-viewport canvas { width: 100%; height: 100%; display: block; }
.ek-city-assets [role=status] { margin: 0; padding: .45rem 1rem; font-size: .85rem; }
`;

function loadThree() {
  return new URL(import.meta.url).pathname.includes('/.local/docs-site/')
    ? import('../../three/three.module.js')
    : import('../../vendor/three/three.module.js');
}

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const ERA_KINDS = ['hatch', 'sedan', 'estate', 'suv', 'van', 'taxi', 'pickup'];
const VEHICLE_WIDTH = {bus: 2.6, tram: 2.5, boxTruck: 2.4, bicycle: 0.8};

export default async function cityAssets(stage, ctx) {
  let THREE, renderer;
  try {
    THREE = await loadThree();
    renderer = new THREE.WebGLRenderer({antialias: true});
  } catch {
    stage.textContent = 'The asset studio needs a browser with WebGL2 and the local Three.js runtime.';
    return;
  }
  css('design-city-assets', CSS);
  stage.innerHTML = `<div class="ek-city-assets">
    <div class="ek-city-assets-controls">
      <label>Show <select name="row">
        <option value="people">People dressed for the weather</option>
        <option value="gaits">One person, every walking style</option>
        <option value="vehicles">Every vehicle kind</option>
        <option value="eras">Cars by era and size</option>
      </select></label>
      <label>Weather <select name="weather">
        <option value="clear">Clear summer day</option>
        <option value="rain">Autumn rain</option>
        <option value="snow">Winter snow</option>
      </select></label>
      <label>View angle <input name="turn" type="range" min="-1.4" max="1.4" step="0.01" value="0.45"></label>
      <button type="button" name="shuffle">New draw</button>
    </div>
    <div class="ek-city-assets-viewport"></div>
    <p role="status"></p>
  </div>`;
  const $ = (name) => stage.querySelector(`[name="${name}"]`);
  const row = $('row'), weather = $('weather'), turn = $('turn'), shuffle = $('shuffle');
  const status = stage.querySelector('[role="status"]');
  const viewport = stage.querySelector('.ek-city-assets-viewport');
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  viewport.append(canvas);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdfe8f0, 0x6b6257, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
  sun.position.set(6, 12, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 60});
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const floorMaterial = new THREE.MeshStandardMaterial({roughness: 0.95});
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const material = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.7, side: THREE.DoubleSide});
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 400);
  const group = new THREE.Group();
  scene.add(group);

  function theme() {
    const dark = ctx.dark();
    scene.background = new THREE.Color(dark ? 0x2a2c2e : 0xd3d8db);
    floorMaterial.color.set(dark ? 0x55524e : 0x9a9690);
  }
  theme();
  ctx.onTheme?.(() => {
    theme();
    request();
  });

  // A kit mesh as Three geometry. Each vertex colour is its own sRGB colour times the tone its slot asks for,
  // converted to linear light for the renderer.
  function geometryFrom(mesh, tint) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(mesh.positions.slice(), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(mesh.normals.slice(), 3));
    const colors = new Float32Array(mesh.vertexCount * 3);
    for (let i = 0; i < mesh.vertexCount; i++) {
      const t = tint(i) ?? [1, 1, 1];
      for (let k = 0; k < 3; k++) colors[i * 3 + k] = toLinear(mesh.colors[i * 3 + k] * t[k]);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    g.computeBoundingSphere();
    return g;
  }
  function place(geometry, x, z) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, 0, z);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    return m;
  }

  let figures = [], seed = 3, span = 10, people = true, labels = [];
  function person(look, index, x, z, gait) {
    const asset = personAsset(look, seed);
    const tones = personColors(asset.look, seed, index);
    const slots = [null, tones.top, tones.bottom, tones.skin, tones.hair, tones.accent];
    const stride = asset.mesh.extraStride;
    const mesh = place(geometryFrom(asset.mesh, (i) => slots[Math.round(asset.mesh.extra[i * stride + 6])] ?? null), x, z);
    const motion = personMotion(asset.look, {seed, index, gait});
    mesh.scale.setScalar(motion.scale);
    figures.push({mesh, asset, rig: asset.rig ?? personRig(asset.look), motion, offset: index * 0.71});
    return motion;
  }

  function build() {
    for (const m of group.children) m.geometry.dispose();
    group.clear();
    figures = [];
    labels = [];
    const kind = row.value;
    people = kind === 'people' || kind === 'gaits';
    weather.parentElement.hidden = kind !== 'people';
    if (kind === 'people') {
      const w = weather.value;
      const season = w === 'snow' ? 'winter' : w === 'rain' ? 'autumn' : 'summer';
      for (let i = 0; i < 12; i++) {
        const look = personWardrobe({weather: w, season, style: 'central', variety: 1, seed, index: i});
        person(look, i, (i % 6) * 1.25 - 3.1, Math.floor(i / 6) * 2 - 1, 'auto');
      }
      span = 9;
      status.textContent = `Twelve walkers dressed by personWardrobe for ${weather.selectedOptions[0].text.toLowerCase()}.`;
    } else if (kind === 'gaits') {
      const look = personWardrobe({season: 'autumn', variety: 0.6, seed, index: 0});
      personGaits.forEach((g, i) => {
        const m = person(look, 0, i * 1.4 - (personGaits.length - 1) * 0.7, 0, g);
        labels.push(`${g} ${m.speed.toFixed(2)} m/s`);
      });
      span = 10;
      status.textContent = labels.join(' · ');
    } else {
      // Eras: one row per car kind and one column per era. Kinds: every vehicle in two columns, so the
      // long buses and trams sit beside the short cars rather than in one line.
      const eras = kind === 'eras';
      const rows = eras ? ERA_KINDS.map((name) => ['classic', 'modern', 'sleek'].map((era) => [name, era])) : [];
      if (!eras) for (let i = 0; i < vehicleKinds.length; i += 2) rows.push(vehicleKinds.slice(i, i + 2).map((name) => [name, null]));
      const spacing = eras ? 6.4 : 14;
      let z = 0;
      rows.forEach((cells, r) => {
        cells.forEach(([name, era], c) => {
          const look = era ? {era, size: c === 1 ? 1 : r % 2 ? 1.18 : 0.86} : undefined;
          const built = vehicleAsset(name, {running: true, ...(look ? {look} : {}), ...(name === 'tram' ? {end: 'front'} : {})});
          const paint = CAR_PAINT[(r * 3 + c + seed) % CAR_PAINT.length];
          const tone = toRGBA(hsla(paint[0], paint[1], paint[2])).slice(0, 3);
          const stride = built.mesh.extraStride ?? 4;
          place(geometryFrom(built.mesh, (i) => (built.mesh.extra[i * stride + 3] > 0.5 ? tone : null)), (c - (cells.length - 1) / 2) * spacing, z);
        });
        z += Math.max(...cells.map(([name]) => VEHICLE_WIDTH[name] ?? 2.2)) + 1.6;
      });
      span = Math.max(z, rows[0].length * spacing) * 1.2;
      group.position.z = -(z - 2) / 2;
      status.textContent = kind === 'eras'
        ? 'Rows: hatchback, saloon, estate, SUV, van, taxi and pickup. Columns: classic, modern and sleek, alternately small and large.'
        : `Every kind in vehicleKinds: ${vehicleKinds.join(', ')}.`;
    }
    if (people) group.position.z = 0;
    canvas.setAttribute('aria-label', status.textContent);
    request();
  }

  let frame = 0, start = performance.now();
  const events = new AbortController();
  function draw(now) {
    frame = 0;
    if (!canvas.isConnected) return;
    const width = Math.max(16, viewport.clientWidth), height = Math.max(16, viewport.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const time = ctx.still ? 0.4 : (now - start) / 1000;
    for (const f of figures) {
      // Walking on the spot: the pose of this walker at this moment of its stride.
      const phase = f.offset + (f.motion.speed * time * Math.PI) / f.motion.step;
      const pose = personPose(phase, {step: f.motion.step / f.motion.scale, swing: f.motion.swing, lean: f.motion.lean}, f.rig);
      f.mesh.geometry.attributes.position.array.set(posePerson(f.asset.mesh, pose, f.rig));
      f.mesh.geometry.attributes.position.needsUpdate = true;
      f.mesh.geometry.computeVertexNormals();
    }
    const a = Number(turn.value);
    const narrow = camera.aspect < 1.2 ? 1.5 : 1;
    const d = (people ? span * 0.95 : span * 1.1) * narrow;
    const centre = new THREE.Vector3(0, people ? 0.95 : 0.9, 0);
    camera.position.set(Math.sin(a) * d, centre.y + (people ? 0.8 : d * 0.42), Math.cos(a) * d);
    camera.lookAt(centre);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    if (people && !ctx.still) request();
  }
  function request() {
    if (!frame && !events.signal.aborted) frame = requestAnimationFrame(draw);
  }

  const settings = {signal: events.signal};
  row.addEventListener('change', build, settings);
  weather.addEventListener('change', build, settings);
  turn.addEventListener('input', request, settings);
  shuffle.addEventListener('click', () => {
    seed = (seed * 7 + 5) % 997;
    build();
  }, settings);
  const observer = new ResizeObserver(request);
  observer.observe(viewport);
  build();

  return function dispose() {
    if (events.signal.aborted) return;
    events.abort();
    observer.disconnect();
    cancelAnimationFrame(frame);
    for (const m of group.children) m.geometry.dispose();
    material.dispose();
    floorMaterial.dispose();
    floor.geometry.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  };
}
