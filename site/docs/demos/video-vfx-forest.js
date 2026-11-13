import { projectPoints, screenRay } from '../../runtime/src/spatial/index.js';
import { applyDepthHoldout } from '../../runtime/src/vfx/index.js';
import { css } from './_kit.js';
import { playState, shotControls } from './video-vfx-controls.js';
import { cameraFor } from './video-vfx-world.js';
import { coffeeTable, rover, roverLocation, wildlife, woodland } from './video-vfx-forest-models.js';

const width = 450;
const height = 564;
const fps = 25;
const frameCount = 70;
const asset = (extension) => new URL('./video-vfx-forest.' + extension, import.meta.url);
const finite = (array, length) => Array.isArray(array) && array.length === length && array.every(Number.isFinite);

async function readShot() {
  const response = await fetch(asset('json'));
  if (!response.ok) throw Error('Could not load the living-room camera track.');
  const shot = await response.json();
  const { frames, intrinsics, table } = shot;
  if (
    shot.width !== width ||
    shot.height !== height ||
    shot.fps !== fps ||
    !finite([intrinsics?.fx, intrinsics?.fy, intrinsics?.cx, intrinsics?.cy], 4) ||
    intrinsics.fx <= 0 ||
    intrinsics.fy <= 0 ||
    !finite([table?.x, table?.z, table?.width, table?.height, table?.depth], 5) ||
    Math.min(table.width, table.height, table.depth) <= 0 ||
    !Array.isArray(frames) ||
    frames.length !== frameCount ||
    !frames.every((frame) => finite(frame?.rotation, 9) && finite(frame?.translation, 3))
  )
    throw Error('The living-room camera track is invalid.');
  return shot;
}

function rasterize(model, camera, intrinsics, depth, pixels, receiverDepth) {
  const { positions, cameraDepths } = projectPoints(camera, model.positions);
  const dx = intrinsics.cx - width / 2;
  const dy = intrinsics.cy - height / 2;
  for (let i = 0; i < model.triangles.length; i += 3) {
    const [a, b, c] = [model.triangles[i], model.triangles[i + 1], model.triangles[i + 2]];
    const az = cameraDepths[a];
    const bz = cameraDepths[b];
    const cz = cameraDepths[c];
    if (Math.min(az, bz, cz) <= 0.01) continue;

    const ax = positions[2 * a] + dx;
    const ay = positions[2 * a + 1] + dy;
    const bx = positions[2 * b] + dx;
    const by = positions[2 * b + 1] + dy;
    const cx = positions[2 * c] + dx;
    const cy = positions[2 * c + 1] + dy;
    const area = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(area) < 1e-8) continue;
    const left = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const right = Math.min(width - 1, Math.floor(Math.max(ax, bx, cx)));
    const top = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const bottom = Math.min(height - 1, Math.floor(Math.max(ay, by, cy)));
    const color = model.colors[i / 3];
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        const px = x + 0.5 - cx;
        const py = y + 0.5 - cy;
        const wa = ((by - cy) * px + (cx - bx) * py) / area;
        const wb = ((cy - ay) * px + (ax - cx) * py) / area;
        const wc = 1 - wa - wb;
        if (wa < 0 || wb < 0 || wc < 0) continue;
        const z = 1 / (wa / az + wb / bz + wc / cz);
        const index = y * width + x;
        if (z >= depth[index] || (receiverDepth && Math.abs(receiverDepth[index] - z) > 0.016)) continue;
        depth[index] = z;
        if (pixels) pixels.set(color, index * 4);
      }
    }
  }
}

export default async function mountForest(stage) {
  const { frames, intrinsics, table } = await readShot();
  const cameras = frames.map((frame) => cameraFor(frame, intrinsics, { width, height }));
  const woods = woodland();
  const tableProxy = coffeeTable(table);
  const lastTime = (frameCount - 1) / fps;
  shotControls();
  css(
    'vfx-forest',
    `
.vfx-forest { width:min(100%, 500px); margin-inline:auto; }
.vfx-forest .vfx-shot { aspect-ratio:450 / 564; }
.vfx-forest video { opacity:0; }
.vfx-forest .vfx-shot[data-place] { cursor:crosshair; outline:2px solid var(--ink); outline-offset:3px; }
.vfx-forest .vfx-tools label { display:flex; gap:7px; align-items:center; min-height:36px; color:var(--muted); font:13px var(--sans); }
`,
  );
  stage.innerHTML = `
    <div class="vfx-demo vfx-forest">
      <div class="vfx-tools">
        <div class="vfx-tabs" role="group" aria-label="Effect">
          <button type="button" aria-pressed="true">Woodland</button>
          <button type="button" aria-pressed="false">Folding rover</button>
        </div>
        <label><input type="checkbox" checked> Coffee table occlusion</label>
      </div>
      <div class="vfx-shot">
        <video muted playsinline preload="auto" aria-label="Living-room footage"></video>
        <canvas class="vfx-composite" width="${width}" height="${height}" aria-hidden="true"></canvas>
      </div>
      <div class="vfx-timeline">
        <button class="vfx-play" type="button" aria-label="Play" title="Play" disabled></button>
        <input type="range" min="0" max="${lastTime}" step="0.04" value="0" aria-label="Living-room footage time" disabled>
        <output aria-label="Time">0.00 s</output>
      </div>
      <div class="vfx-actions vfx-rover-actions" hidden>
        <button class="vfx-rover-panels" type="button">Open panels</button>
        <button class="vfx-rover-place" type="button" aria-pressed="false">Place rover</button>
        <button class="vfx-rover-reset" type="button">Reset rover</button>
      </div>
      <div class="vfx-status" role="status" hidden></div>
      <div class="vfx-credit">Footage by <a href="https://www.pexels.com/video/modern-minimalist-living-room-with-neutral-decor-36516358/">Real Estate 4k</a> under the <a href="https://www.pexels.com/license/">Pexels license</a>.</div>
    </div>`;
  const get = (selector) => stage.querySelector(selector);
  const video = get('video');
  const shot = get('.vfx-shot');
  const play = get('.vfx-play');
  const timeline = get('input[type=range]');
  const clock = get('output');
  const occlusion = get('input[type=checkbox]');
  const status = get('.vfx-status');
  const buttons = stage.querySelectorAll('.vfx-tabs button');
  const roverActions = get('.vfx-rover-actions');
  const panelButton = get('.vfx-rover-panels');
  const placeButton = get('.vfx-rover-place');
  const context = get('canvas').getContext('2d');
  if (!context) throw Error('The living-room composite requires a drawing canvas.');
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  const overlay = layer.getContext('2d');
  const image = overlay.createImageData(width, height);
  const virtualDepth = new Float32Array(width * height);
  const tableDepth = new Float32Array(width * height);
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  let effect = 0;
  let frame = -1;
  let pending = null;
  let placement = null;
  let previewPlacement = null;
  let deployed = null;

  function draw(mediaTime, force = false) {
    if (video.seeking || video.readyState < 2) return;
    const index = Math.min(frameCount - 1, Math.max(0, Math.floor(mediaTime * fps + 0.0001)));
    const time = index / fps;
    timeline.value = time;
    clock.textContent = time.toFixed(2) + ' s';
    if (index === frame && !force) return;
    frame = index;
    const camera = cameras[index];
    image.data.fill(0);
    virtualDepth.fill(Infinity);
    if (occlusion.checked || effect === 1) {
      tableDepth.fill(Infinity);
      rasterize(tableProxy, camera, intrinsics, tableDepth);
    }
    if (effect === 0) {
      rasterize(woods, camera, intrinsics, virtualDepth, image.data);
      for (const animal of wildlife(time)) rasterize(animal, camera, intrinsics, virtualDepth, image.data);
    } else {
      const [cast, model] = rover(time, table, previewPlacement ?? placement, deployed);
      rasterize(cast, camera, intrinsics, virtualDepth, image.data, tableDepth);
      rasterize(model, camera, intrinsics, virtualDepth, image.data);
    }
    if (occlusion.checked) {
      image.data.set(
        applyDepthHoldout({
          width,
          height,
          insert: image.data,
          insertDepth: virtualDepth,
          observed: { width, height, data: tableDepth },
          bias: 0.014,
          softness: 0.008,
        }),
      );
    }
    if (effect === 1) panelButton.textContent = (deployed ?? time >= 0.82) ? 'Close panels' : 'Open panels';
    overlay.putImageData(image, 0, 0);
    context.drawImage(video, 0, 0, width, height);
    context.drawImage(layer, 0, 0);
  }

  function stopFrame() {
    if (pending !== null) video.cancelVideoFrameCallback(pending);
    pending = null;
  }

  function tick(_, metadata) {
    draw(metadata.mediaTime);
    pending = video.paused ? null : video.requestVideoFrameCallback(tick);
  }

  function sync() {
    stopFrame();
    playState(play, video.paused);
    if (video.paused || !video.requestVideoFrameCallback) draw(video.currentTime, true);
    else pending = video.requestVideoFrameCallback(tick);
  }

  function note(message) {
    status.hidden = !message;
    status.textContent = message;
  }

  function redraw() {
    if (frame >= 0) draw(frame / fps, true);
  }

  function togglePanels() {
    deployed = !(deployed ?? frame / fps >= 0.82);
    redraw();
  }

  function endPlacement() {
    previewPlacement = null;
    shot.removeAttribute('data-place');
    shot.removeAttribute('tabindex');
    placeButton.setAttribute('aria-pressed', 'false');
    note('');
  }

  function placeAt(point) {
    placement = point;
    endPlacement();
    placeButton.focus();
    redraw();
  }

  function roomPoint({ clientX, clientY }) {
    const rect = shot.getBoundingClientRect();
    return { x: ((clientX - rect.left) * width) / rect.width, y: ((clientY - rect.top) * height) / rect.height };
  }

  function onTable({ x, y }) {
    const ray = screenRay(cameras[frame], {
      x: x - intrinsics.cx + width / 2,
      y: y - intrinsics.cy + height / 2,
    });
    const distance = (table.height - ray.origin.y) / ray.direction.y;
    const point = { x: ray.origin.x + distance * ray.direction.x, z: ray.origin.z + distance * ray.direction.z };
    if (
      !Number.isFinite(distance) ||
      distance <= 0 ||
      point.x < table.x ||
      point.x > table.x + table.width ||
      point.z < table.z ||
      point.z > table.z + table.depth
    )
      return null;
    return clampToTable(point);
  }

  function clampToTable({ x, z }) {
    const inset = 0.27;
    return {
      x: Math.max(table.x + inset, Math.min(table.x + table.width - inset, x)),
      z: Math.max(table.z + inset, Math.min(table.z + table.depth - inset, z)),
    };
  }

  for (const event of ['play', 'pause', 'seeked', 'ended']) video.addEventListener(event, sync, options);
  video.addEventListener(
    'loadeddata',
    () => {
      play.disabled = false;
      timeline.disabled = false;
      sync();
    },
    options,
  );
  video.addEventListener('error', () => note('Could not load the living-room footage.'), options);
  if (!video.requestVideoFrameCallback) video.addEventListener('timeupdate', () => draw(video.currentTime), options);
  play.addEventListener(
    'click',
    () => {
      if (!video.paused) return video.pause();
      endPlacement();
      if (video.ended) video.currentTime = 0;
      void video.play().catch(() => note('Could not play the living-room footage.'));
    },
    options,
  );
  timeline.addEventListener(
    'input',
    () => {
      video.pause();
      video.currentTime = Number(timeline.value);
    },
    options,
  );
  occlusion.addEventListener('change', redraw, options);
  buttons.forEach((button, index) => {
    button.addEventListener(
      'click',
      () => {
        effect = index;
        endPlacement();
        roverActions.hidden = effect !== 1;
        buttons.forEach((item, i) => item.setAttribute('aria-pressed', String(i === effect)));
        redraw();
      },
      options,
    );
  });
  panelButton.addEventListener('click', togglePanels, options);
  placeButton.addEventListener(
    'click',
    () => {
      if (frame < 0) return;
      if (previewPlacement) {
        endPlacement();
        redraw();
        return;
      }
      video.pause();
      previewPlacement = placement ?? roverLocation(frame / fps, table);
      placeButton.setAttribute('aria-pressed', 'true');
      shot.setAttribute('data-place', '');
      shot.tabIndex = 0;
      shot.focus();
      note('Choose a spot on the table or move with the arrow keys. Press Enter to place or Escape to cancel.');
      redraw();
    },
    options,
  );
  get('.vfx-rover-reset').addEventListener(
    'click',
    () => {
      placement = deployed = null;
      endPlacement();
      redraw();
    },
    options,
  );
  shot.addEventListener(
    'click',
    (event) => {
      if (effect !== 1 || frame < 0 || video.seeking) return;
      const point = roomPoint(event);
      if (previewPlacement) {
        const next = onTable(point);
        if (next) placeAt(next);
        else note('Choose a spot on the visible tabletop.');
      } else {
        const x = Math.floor(point.x),
          y = Math.floor(point.y);
        if (x >= 0 && x < width && y >= 0 && y < height && image.data[(y * width + x) * 4 + 3] > 180) {
          togglePanels();
        }
      }
    },
    options,
  );
  shot.addEventListener(
    'keydown',
    (event) => {
      if (!previewPlacement) return;
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (Object.hasOwn(direction, event.key)) {
        event.preventDefault();
        const [dx, dz] = direction[event.key];
        previewPlacement = clampToTable({ x: previewPlacement.x + dx * 0.04, z: previewPlacement.z + dz * 0.04 });
        redraw();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        placeAt(previewPlacement);
      } else if (event.key === 'Escape') {
        endPlacement();
        placeButton.focus();
        redraw();
      }
    },
    options,
  );
  video.src = asset('webm').href;

  return () => {
    listeners.abort();
    stopFrame();
    video.pause();
    video.removeAttribute('src');
    video.load();
  };
}
