import { rayPlane, screenRay } from '../../runtime/src/spatial/index.js';
import { css } from './_kit.js';
import { cameraFor } from './video-vfx-world.js';
import { playState, shotControls } from './video-vfx-controls.js';
import { createBoidFlock, sceneObstacles } from './video-vfx-boid-model.js';
import { makeBoidComposite } from './video-vfx-boid-composite.js';
import { boidLighting } from './video-vfx-boid-light.js';

const width = 768;
const fps = 24;
const shots = [
  {
    name: 'Living room',
    suffix: '',
    height: 322,
    frameCount: 720,
    crossingTime: 5.2,
    creator: 'KoolShooters',
    source: 'a-woman-walking-in-the-room-8991317',
  },
  {
    name: 'Sunlit house',
    suffix: '-house',
    height: 432,
    frameCount: 186,
    crossingTime: 1.2,
    creator: 'Martina Tomšič',
    source: 'a-woman-walking-inside-the-house-4098697',
  },
  {
    name: 'Sitting room',
    suffix: '-sitting-room',
    height: 404,
    frameCount: 408,
    crossingTime: 5.4,
    zoom: 1.12,
    creator: 'Kaboompics.com',
    source: 'back-view-of-a-woman-walking-along-the-corridor-7709001',
  },
  {
    name: 'Long hallway',
    suffix: '-hallway',
    height: 432,
    frameCount: 720,
    crossingTime: 3.4,
    creator: 'Vincuk Konan',
    source: 'woman-closing-door-and-walking-on-corridor-10577994',
  },
];
const asset = (shot, extension) => new URL(`./video-vfx-boids${shot.suffix}.${extension}`, import.meta.url);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const values = (a, n, limit) =>
  Array.isArray(a) && a.length === n && a.every((v) => Number.isFinite(v) && Math.abs(v) <= limit);
const box = (b) => values(b?.min, 3, 20) && values(b?.max, 3, 20) && b.max.every((value, i) => value > b.min[i]);

async function fetchBytes(url, signal, limit, expected = null) {
  const response = await fetch(url, { signal });
  if (!response.ok || !response.body) throw Error('Could not load the prepared room data.');
  const source = response.body.pipeThrough(
    new TransformStream({
      start() {
        this.bytes = 0;
      },
      transform(chunk, controller) {
        this.bytes += chunk.byteLength;
        if (this.bytes > limit) throw Error('The prepared room asset exceeds its byte budget.');
        controller.enqueue(chunk);
      },
    }),
  );
  const reader = (expected === null ? source : source.pipeThrough(new DecompressionStream('gzip'))).getReader();
  const bytes = new Uint8Array(expected ?? limit);
  let offset = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (offset + value.length > bytes.length) throw Error('The decoded room asset exceeds its byte budget.');
      bytes.set(value, offset);
      offset += value.length;
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (expected !== null && offset !== expected) throw Error('The person matte is incomplete.');
  return bytes.subarray(0, offset);
}

async function loadScene(config, signal) {
  const { height, frameCount } = config;
  const shot = JSON.parse(new TextDecoder().decode(await fetchBytes(asset(config, 'json'), signal, 640_000)));
  const { frames, intrinsics, matte, room, furniture, people, personDepth, doorway } = shot;
  if (
    shot.width !== width ||
    shot.height !== height ||
    shot.fps !== fps ||
    !values([intrinsics?.fx, intrinsics?.fy, intrinsics?.cx, intrinsics?.cy], 4, 1800) ||
    intrinsics.fx < 100 ||
    intrinsics.fy < 100 ||
    matte?.width !== width / 2 ||
    matte?.height !== height / 2 ||
    !box(room) ||
    !Array.isArray(furniture) ||
    furniture.length > 8 ||
    !furniture.every(box) ||
    !Array.isArray(frames) ||
    frames.length !== frameCount ||
    !frames.every((frame) => values(frame?.rotation, 9, 1.01) && values(frame?.translation, 3, 30)) ||
    !Array.isArray(people) ||
    people.length !== frameCount ||
    !people.every((sample) => Array.isArray(sample) && [0, 3].includes(sample.length) && sample.every(box)) ||
    !Array.isArray(personDepth) ||
    personDepth.length !== frameCount ||
    !personDepth.every((value) => value === null || (Number.isFinite(value) && Math.abs(value) < 20)) ||
    !Array.isArray(doorway) ||
    doorway.length !== frameCount ||
    !doorway.every((edges) => values(edges, 4, width) && edges[0] < edges[2] && edges[1] < edges[3])
  ) {
    throw Error('The prepared room geometry is invalid.');
  }
  return shot;
}

export default function mountBoids(stage) {
  shotControls();
  css(
    'vfx-boids',
    `
.vfx-boids .vfx-shot { cursor:crosshair; touch-action:pan-y; }
.vfx-boids .vfx-boids-select { display:flex; align-items:center; gap:10px; font:13px var(--sans); color:var(--muted); }
.vfx-boids video { opacity:0; pointer-events:none; }
.vfx-boids .vfx-shot:focus-visible { outline:2px solid hsl(var(--h) var(--accent-s) var(--accent-l)); outline-offset:3px; }
.vfx-boids .vfx-tools label { display:flex; align-items:center; gap:7px; font:13px var(--sans); color:var(--muted); }
.vfx-boids .vfx-boids-key { font:13px/1.45 var(--sans); color:var(--muted); }
`,
  );
  stage.innerHTML = `
    <div class="vfx-demo vfx-boids">
      <label class="vfx-boids-select">Footage
        <select>${shots.map(({ name }, i) => `<option value="${i}">${name}</option>`).join('')}</select>
      </label>
      <div class="vfx-boids-shot"></div>
    </div>`;
  const select = stage.querySelector('select');
  const mount = stage.querySelector('.vfx-boids-shot');
  let active;
  function change() {
    active?.abort();
    const request = new AbortController();
    active = request;
    void mountShot(mount, shots[select.selectedIndex], request.signal).catch((error) => {
      if (request.signal.aborted) return;
      mount.querySelector('.vfx-status').textContent = error.message;
    });
  }
  select.addEventListener('change', change);
  change();
  return () => {
    active.abort();
    select.removeEventListener('change', change);
  };
}

async function mountShot(stage, shot, signal) {
  const { height, frameCount, crossingTime, creator, source, name, zoom = 1 } = shot;
  stage.innerHTML = `
    <div class="vfx-demo">
      <div class="vfx-shot" style="aspect-ratio:${width} / ${height}" tabindex="0" role="group" aria-label="Guide the flock with the pointer or arrow keys">
        <video muted playsinline preload="auto" aria-label="${name} footage"></video>
        <canvas class="vfx-composite" style="transform:scale(${zoom});transform-origin:45% 24%" width="${width}" height="${height}" aria-hidden="true"></canvas>
      </div>
      <div class="vfx-timeline">
        <button class="vfx-play" type="button" aria-label="Play" title="Play" disabled></button>
        <input class="vfx-boids-time" type="range" min="0" max="${frameCount - 1}" step="1" value="0" aria-label="Footage time" disabled>
        <output aria-label="Time">0.00 s</output>
      </div>
      <div class="vfx-tools">
        <div class="vfx-actions">
          <button class="vfx-boids-crossing" type="button" disabled>Play from crossing</button>
          <button class="vfx-boids-reset" type="button" disabled>Reset flock</button>
        </div>
        <div class="vfx-actions">
          <label>Geometry <select class="vfx-boids-geometry" disabled><option value="mesh">Mesh</option><option value="boxes">Boxes</option></select></label>
          <label><input class="vfx-boids-shadows" type="checkbox" checked disabled> Cast shadows</label>
          <label><input class="vfx-boids-matte" type="checkbox" checked disabled> Person occlusion</label>
          <label><input class="vfx-boids-guides" type="checkbox" disabled> Show collision volumes</label>
        </div>
      </div>
      <div class="vfx-boids-key" hidden>Green outlines mark fixtures. Amber outlines follow the person.</div>
      <div class="vfx-status" role="status">Loading room footage and geometry…</div>
      <div class="vfx-credit">Footage by <a href="https://www.pexels.com/video/${source}/">${creator}</a> under the <a href="https://www.pexels.com/license/">Pexels license</a>.</div>
    </div>`;
  const get = (selector) => stage.querySelector(selector);
  const video = get('video'),
    view = get('.vfx-shot'),
    play = get('.vfx-play');
  const crossing = get('.vfx-boids-crossing'),
    reset = get('.vfx-boids-reset');
  const timeline = get('.vfx-boids-time'),
    guides = get('.vfx-boids-guides'),
    geometry = get('.vfx-boids-geometry'),
    shadows = get('.vfx-boids-shadows'),
    person = get('.vfx-boids-matte');
  const key = get('.vfx-boids-key'),
    clock = get('output'),
    status = get('.vfx-status'),
    canvas = get('canvas');
  const [scene, mattes] = await Promise.all([
    loadScene(shot, signal),
    fetchBytes(asset(shot, 'depth'), signal, 10 * 1024 * 1024, (frameCount * width * height) / 4),
  ]);
  signal.throwIfAborted();
  const cameras = scene.frames.map((frame) => cameraFor(frame, scene.intrinsics, { width, height }));
  let obstacles, flock;
  function setGeometry() {
    obstacles = sceneObstacles(scene, geometry.value);
    flock = createBoidFlock({ ...scene, duration: frameCount / fps, geometry: geometry.value, obstacles });
  }
  setGeometry();
  const composite = makeBoidComposite(canvas, scene, mattes, boidLighting[shot.suffix]);
  const footage = document.createElement('canvas');
  footage.width = width;
  footage.height = height;
  const decoded = footage.getContext('2d', { alpha: false });
  const options = { signal };
  let presented = 0,
    pending = null,
    target = null,
    heldFrame = null,
    heldTime = null,
    heldSteps = 0;

  function note(message) {
    status.textContent = message;
    status.hidden = !message;
  }

  function lure(camera) {
    if (!target) return null;
    const { room, intrinsics } = scene;
    const z = room.min[2] + (room.max[2] - room.min[2]) * 0.58;
    const ray = screenRay(camera, {
      x: target.x - intrinsics.cx + width / 2,
      y: target.y - intrinsics.cy + height / 2,
    });
    const hit = rayPlane(ray, { point: { x: 0, y: 0, z }, normal: { x: 0, y: 0, z: 1 } });
    if (!hit) return null;
    return [
      clamp(hit.point.x, room.min[0] + 0.18, room.max[0] - 0.18),
      clamp(hit.point.y, room.min[1] + 0.18, room.max[1] - 0.18),
      z,
    ];
  }

  function draw(time, live = false, steps = 0, reuseFrame = false) {
    if (video.readyState < 2 || video.seeking) return;
    presented = clamp(Math.floor(time * fps + 0.0001), 0, frameCount - 1);
    if (!reuseFrame) decoded.drawImage(video, 0, 0, width, height);
    const seconds = presented / fps;
    const camera = cameras[presented];
    const position = lure(camera);
    timeline.value = presented;
    timeline.setAttribute('aria-valuetext', seconds.toFixed(2) + ' seconds');
    clock.textContent = seconds.toFixed(2) + ' s';
    composite.draw(
      footage,
      camera,
      presented,
      steps && position ? flock.hold(seconds, position, steps) : flock.sample(seconds, live ? position : null),
      flock.previous(),
      obstacles.person(seconds),
      {
        fixtures: obstacles.fixtures,
        mesh: geometry.value === 'mesh',
        showGuides: guides.checked,
        hideBehindPerson: person.checked,
        castShadows: shadows.checked,
        lure: position,
      },
    );
  }

  function stopFrame() {
    if (pending !== null) video.cancelVideoFrameCallback(pending);
    pending = null;
  }

  function tick(_, metadata) {
    pending = null;
    if (video.paused) return;
    draw(metadata.mediaTime, true);
    pending = video.requestVideoFrameCallback(tick);
  }

  function sync(event) {
    stopFrame();
    playState(play, video.paused);
    if (!video.paused && video.requestVideoFrameCallback) pending = video.requestVideoFrameCallback(tick);
    else if (event?.type !== 'pause' || !video.requestVideoFrameCallback) draw(video.currentTime);
  }

  function stopHolding() {
    if (heldFrame !== null) cancelAnimationFrame(heldFrame);
    heldFrame = heldTime = null;
    heldSteps = 0;
  }

  function steerPaused(now) {
    heldFrame = null;
    if (!video.paused || video.seeking || video.readyState < 2 || !target) return;
    if (heldTime !== null) heldSteps += Math.min(66, now - heldTime) * 0.06;
    heldTime = now;
    const steps = Math.min(4, Math.floor(heldSteps));
    heldSteps -= steps;
    if (steps) draw(presented / fps, false, steps, true);
    heldFrame = requestAnimationFrame(steerPaused);
  }

  function start() {
    stopHolding();
    void video.play().catch(() => note('The room footage could not play.'));
  }

  function toggle() {
    if (!video.paused) return video.pause();
    if (video.ended) video.currentTime = 0;
    start();
  }

  function setTarget(point) {
    target = point;
    if (video.paused) {
      draw(presented / fps, false, 0, true);
      if (target && heldFrame === null && !video.seeking && video.readyState >= 2)
        heldFrame = requestAnimationFrame(steerPaused);
      if (!target) stopHolding();
    }
  }

  video.addEventListener(
    'loadeddata',
    () => {
      for (const element of [play, crossing, reset, timeline, guides, person, shadows, geometry])
        element.disabled = false;
      note('');
      sync();
    },
    options,
  );
  video.addEventListener('error', () => note('The room footage could not be loaded.'), options);
  for (const event of ['play', 'pause', 'ended', 'seeked']) video.addEventListener(event, sync, options);
  if (!video.requestVideoFrameCallback)
    video.addEventListener('timeupdate', () => draw(video.currentTime, !video.paused), options);
  play.addEventListener('click', toggle, options);
  crossing.addEventListener(
    'click',
    () => {
      video.currentTime = crossingTime;
      start();
    },
    options,
  );
  reset.addEventListener(
    'click',
    () => {
      flock.reset();
      setTarget(null);
    },
    options,
  );
  timeline.addEventListener(
    'input',
    () => {
      stopHolding();
      target = null;
      video.pause();
      video.currentTime = Number(timeline.value) / fps + 0.0005;
    },
    options,
  );
  guides.addEventListener(
    'change',
    () => {
      key.hidden = !guides.checked;
      if (video.paused) draw(presented / fps, false, 0, true);
    },
    options,
  );
  geometry.addEventListener(
    'change',
    () => {
      stopHolding();
      setGeometry();
      if (video.paused) setTarget(null);
    },
    options,
  );
  for (const control of [person, shadows]) {
    control.addEventListener(
      'change',
      () => {
        if (video.paused) draw(presented / fps, false, 0, true);
      },
      options,
    );
  }

  function pointer(event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    setTarget({
      x: ((event.clientX - rect.left) * width) / rect.width,
      y: ((event.clientY - rect.top) * height) / rect.height,
    });
  }
  view.addEventListener('pointerdown', pointer, options);
  view.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType === 'mouse' || event.buttons) pointer(event);
    },
    options,
  );
  view.addEventListener(
    'pointerleave',
    (event) => {
      if (event.pointerType === 'mouse') setTarget(null);
    },
    options,
  );
  view.addEventListener('pointercancel', () => setTarget(null), options);
  view.addEventListener(
    'keydown',
    (event) => {
      const moves = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -18], ArrowDown: [0, 18] };
      if (Object.hasOwn(moves, event.key)) {
        event.preventDefault();
        const [dx, dy] = moves[event.key];
        setTarget({
          x: clamp((target?.x ?? width / 2) + dx, 0, width),
          y: clamp((target?.y ?? height / 2) + dy, 0, height),
        });
      } else if (event.key === 'Escape') {
        setTarget(null);
      } else if (event.key === ' ') {
        event.preventDefault();
        toggle();
      }
    },
    options,
  );

  signal.addEventListener(
    'abort',
    () => {
      stopHolding();
      stopFrame();
      video.pause();
      video.removeAttribute('src');
      video.load();
    },
    { once: true },
  );
  video.src = asset(shot, 'webm').href;
}
