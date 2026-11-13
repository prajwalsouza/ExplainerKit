import { hsla, toHex, toRGBA } from '../../runtime/src/color/index.js';
import { projectPoint } from '../../runtime/src/spatial/index.js';
import { applyDepthHoldout } from '../../runtime/src/vfx/index.js';
import { css, clipSource } from './_kit.js';
import { playState, shotControls } from './video-vfx-controls.js';
import { cameraFor, drawDepthMesh, prepareGroundBin } from './video-vfx-world.js';

const size = { width: 640, height: 480 };
const roomLight = { x: 0.33, y: 0.92, z: -0.22 };
const holdoutBias = 0.065;
const holdoutSoftness = 0.04;
const guideFill = toHex(hsla(168, 70, 60, 0.13));
const guideStroke = toHex(hsla(167, 81, 69, 0.77));
const colors = {
  floor: toRGBA(hsla(168, 77, 50, 0.34)),
  horizontal: toRGBA(hsla(168, 77, 50, 0.34)),
  vertical: toRGBA(hsla(36, 92, 62, 0.34)),
};
const finite = (value, length) => Array.isArray(value) && value.length === length && value.every(Number.isFinite);

async function loadDepth(url, bytes) {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw Error('Could not load the recorded depth.');
  let received = 0;
  const bounded = new TransformStream({
    transform(chunk, controller) {
      received += chunk.length;
      if (received > 8 * 1024 * 1024) throw Error('The compressed depth exceeds the clip budget.');
      controller.enqueue(chunk);
    },
  });
  const reader = response.body.pipeThrough(bounded).pipeThrough(new DecompressionStream('gzip')).getReader();
  const depth = new Uint8Array(bytes);
  let offset = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (offset + value.length > bytes) throw Error('The recorded depth exceeds the clip length.');
      depth.set(value, offset);
      offset += value.length;
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  if (offset !== bytes) throw Error('The recorded depth is incomplete.');
  return depth;
}

function worldRay(sample, x, y, { fx, fy, cx, cy }) {
  const u = (x - cx) / fx;
  const v = (y - cy) / fy;
  const { rotation: r } = sample;
  return { x: r[0] * u + r[3] * v + r[6], y: r[1] * u + r[4] * v + r[7], z: r[2] * u + r[5] * v + r[8] };
}

function softenHoldoutEdge(composite, original, virtual, observed, width, height, step) {
  // Use nearby depth samples only to estimate fractional coverage at the silhouette.
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x;
      const alpha = index * 4 + 3;
      const z = virtual[index];
      if (!original[alpha] || !Number.isFinite(z)) continue;
      let coverage = 4 * (composite[alpha] / original[alpha]);
      for (const i of [index - 1, index + 1, index - width, index + width]) {
        const measured = observed[i] * step;
        coverage += measured ? Math.max(0, Math.min(1, (measured - z + holdoutBias) / holdoutSoftness)) : 1;
      }
      composite[alpha] = (original[alpha] * coverage) / 8;
    }
  }
}

function paintPlanes(context, planes, camera, sample, intrinsics, realDepth, { width, height, step }) {
  const { fx, fy, cx, cy } = intrinsics;
  const { rotation: r } = sample;
  const [cxWorld, cyWorld, czWorld] = camera.matrixWorld.slice(12, 15);
  const equations = planes.map(({ kind, normal: { x, y, z }, offset }) => ({
    nx: r[0] * x + r[1] * y + r[2] * z,
    ny: r[3] * x + r[4] * y + r[5] * z,
    nz: r[6] * x + r[7] * y + r[8] * z,
    offset: offset - (cxWorld * x + cyWorld * y + czWorld * z),
    tint: colors[kind],
  }));
  const pixels = context.createImageData(width, height);
  const stride = size.width / width;
  for (let y = 0; y < height; y++) {
    const v = ((y + 0.5) * stride - cy) / fy;
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const z = realDepth[i] * step;
      if (!z) continue;
      const u = ((x + 0.5) * stride - cx) / fx;
      let closest = 0.05;
      let tint;
      for (const plane of equations) {
        const distance = Math.abs((plane.nx * u + plane.ny * v + plane.nz) * z - plane.offset);
        if (distance < closest) {
          closest = distance;
          tint = plane.tint;
        }
      }
      if (tint) {
        for (let channel = 0; channel < 4; channel++) pixels.data[i * 4 + channel] = tint[channel] * 255;
      }
    }
  }
  context.putImageData(pixels, 0, 0);
}

function paintReceivingPlane(context, outline, camera, sample, intrinsics, observed, depth) {
  const points = outline.map((point) => projectPoint(camera, point));
  const { width, height } = size;
  context.clearRect(0, 0, width, height);
  if (points.some((point) => point.cameraDepth <= camera.near)) return;
  const { cx, cy, fx, fy } = intrinsics;
  const offsetX = cx - width / 2;
  const offsetY = cy - height / 2;
  context.beginPath();
  for (const [i, { x, y }] of points.entries()) {
    if (i === 0) context.moveTo(x + offsetX, y + offsetY);
    else context.lineTo(x + offsetX, y + offsetY);
  }
  context.closePath();
  context.fillStyle = guideFill;
  context.fill();
  context.strokeStyle = guideStroke;
  context.lineWidth = 1.5;
  context.stroke();

  const x = Math.max(0, Math.floor(Math.min(...points.map((p) => p.x)) + offsetX) - 2);
  const y = Math.max(0, Math.floor(Math.min(...points.map((p) => p.y)) + offsetY) - 2);
  const w = Math.min(width, Math.ceil(Math.max(...points.map((p) => p.x)) + offsetX) + 2) - x;
  const h = Math.min(height, Math.ceil(Math.max(...points.map((p) => p.y)) + offsetY) + 2) - y;
  if (w <= 0 || h <= 0) return;
  const image = context.getImageData(x, y, w, h);
  const stride = width / depth.width;
  const originY = camera.matrixWorld[13];
  const { rotation: r } = sample;
  for (let row = 0; row < h; row++) {
    const py = y + row;
    const v = (py + 0.5 - cy) / fy;
    for (let column = 0; column < w; column++) {
      const alpha = (row * w + column) * 4 + 3;
      if (!image.data[alpha]) continue;
      const px = x + column;
      const measured = observed[Math.floor(py / stride) * depth.width + Math.floor(px / stride)] * depth.step;
      if (!measured) continue;
      const u = (px + 0.5 - cx) / fx;
      const planeDepth = -originY / (r[1] * u + r[4] * v + r[7]);
      image.data[alpha] *= Math.max(0, Math.min(1, (measured - planeDepth + 0.13) / 0.055));
    }
  }
  context.putImageData(image, x, y);
}

export default function depthDemo(stage) {
  return mountDepthDemo(stage, {
    source: 'video-vfx-rgbd',
    shotLabel: 'Camera moving sideways past a partition',
    footageLabel: 'Room footage',
    objectLabel: 'Trash can',
    surface: 'floor',
    matchColor: true,
    prepare: (point, appearance) =>
      prepareGroundBin(point, 1, {
        appearance: { ...appearance, shadowOpacity: 0.24 },
        lightDirection: roomLight,
      }),
  });
}

export async function mountDepthDemo(
  stage,
  { source, shotLabel, footageLabel, objectLabel, surface, matchColor, prepare, cue, guideOutline },
) {
  const asset = (suffix) => new URL('./' + source + '.' + suffix, import.meta.url);
  shotControls();
  css(
    'vfx-rgbd',
    `
    .vfx-rgbd-shot { aspect-ratio:4 / 3; }
    .vfx-rgbd-shot video { opacity:0; }
    .vfx-rgbd-options { display:flex; flex-wrap:wrap; align-items:center; gap:8px 14px; color:var(--muted); font:13px var(--sans); }
    .vfx-rgbd-options label { display:flex; align-items:center; gap:6px; min-height:36px; }
    .vfx-rgbd-shot[data-place] { cursor:crosshair; outline:2px solid var(--ink); outline-offset:3px; }
    .vfx-rgbd-shot .vfx-rgbd-pointer { position:absolute; width:14px; height:14px; margin:-7px; border:2px solid white; border-radius:50%; box-shadow:0 0 0 1px black; pointer-events:none; }
  `,
  );
  const response = await fetch(asset('json'));
  if (!response.ok) throw Error('Could not load the recorded geometry.');
  const { width, height, fps, intrinsics, samples, surfaces, depth, appearance } = await response.json();
  if (
    width !== size.width ||
    height !== size.height ||
    fps !== 25 ||
    ![1, 2].includes(width / depth?.width) ||
    height / depth.height !== width / depth.width ||
    !Number.isFinite(depth?.step) ||
    depth.step <= 0 ||
    !finite([intrinsics?.fx, intrinsics?.fy, intrinsics?.cx, intrinsics?.cy], 4) ||
    intrinsics.fx <= 0 ||
    intrinsics.fy <= 0 ||
    !Array.isArray(samples) ||
    samples.length < 2 ||
    samples.length > 150 ||
    !samples.every((frame) => finite(frame?.rotation, 9) && finite(frame?.translation, 3)) ||
    !finite([appearance?.hue, appearance?.saturation, appearance?.exposure], 3) ||
    !Array.isArray(surfaces) ||
    surfaces.length > 7 ||
    !surfaces.every(
      ({ kind, normal, offset }) => Object.hasOwn(colors, kind) && finite([normal?.x, normal?.y, normal?.z, offset], 4),
    )
  )
    throw Error('The prepared depth track is invalid.');
  const depthSize = depth.width * depth.height;
  const depths = await loadDepth(asset('depth'), depthSize * samples.length);
  const cameras = samples.map((sample) => cameraFor(sample, intrinsics, size));
  const lastTime = (samples.length - 1) / fps;

  stage.innerHTML = `
    <div class="vfx-demo">
      <div class="vfx-shot vfx-rgbd-shot" aria-label="${shotLabel}">
        <video muted playsinline preload="auto" aria-label="Recorded ${footageLabel.toLowerCase()}"></video>
        <canvas class="vfx-composite vfx-rgbd-picture" width="${width}" height="${height}" aria-hidden="true"></canvas>
        <canvas class="vfx-composite vfx-rgbd-planes" width="${guideOutline ? width : depth.width}" height="${guideOutline ? height : depth.height}" hidden aria-hidden="true"></canvas>
        <canvas class="vfx-composite vfx-rgbd-insert" width="${width}" height="${height}" hidden aria-hidden="true"></canvas>
        <span class="vfx-rgbd-pointer" hidden aria-hidden="true"></span>
      </div>
      <div class="vfx-timeline">
        <button class="vfx-play" type="button" aria-label="Play" title="Play" disabled></button>
        <input type="range" min="0" max="${lastTime}" step="0.04" value="0" aria-label="${footageLabel} time" disabled>
        <output aria-label="Time">0.00 s</output>
      </div>
      <div class="vfx-rgbd-options">
        <button class="vfx-rgbd-place" type="button" aria-pressed="false" disabled>Place on ${surface}</button>
        <button class="vfx-rgbd-reset" type="button" disabled>Reset position</button>
        ${cue ? `<button class="vfx-rgbd-cue" type="button" disabled>${cue.label}</button>` : ''}
        <label><input class="vfx-rgbd-occlude" type="checkbox" checked> Foreground occlusion</label>
        <label><input class="vfx-rgbd-show-planes" type="checkbox"> ${guideOutline ? 'Show tabletop plane' : 'Show fitted planes'}</label>
        ${matchColor ? '<label><input class="vfx-rgbd-grade" type="checkbox" checked> Match scene color</label>' : ''}
      </div>
      <div class="vfx-status" role="status" hidden></div>
      <div class="vfx-credit">Footage by Jürgen Sturm, Nikolas Engelhard, Felix Endres, Wolfram Burgard and Daniel Cremers.
        Cropped in time and re-encoded from the <a href="https://cvg.cit.tum.de/data/datasets/rgbd-dataset/download">TUM RGB-D benchmark</a>
        under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.</div>
    </div>`;
  const get = (selector) => stage.querySelector(selector);
  const video = get('video');
  const shot = get('.vfx-rgbd-shot');
  const pointer = get('.vfx-rgbd-pointer');
  const play = get('.vfx-play');
  const time = get('input[type=range]');
  const clock = get('output');
  const place = get('.vfx-rgbd-place');
  const reset = get('.vfx-rgbd-reset');
  const jump = get('.vfx-rgbd-cue');
  const occlude = get('.vfx-rgbd-occlude');
  const guide = get('.vfx-rgbd-show-planes');
  const grade = get('.vfx-rgbd-grade');
  const status = get('.vfx-status');
  const guideCanvas = get('.vfx-rgbd-planes');
  const planes = guideCanvas.getContext('2d', { willReadFrequently: Boolean(guideOutline) });
  const context = get('.vfx-rgbd-insert').getContext('2d', { willReadFrequently: true });
  const picture = get('.vfx-rgbd-picture').getContext('2d');
  const decodedFrame = document.createElement('canvas');
  decodedFrame.width = width;
  decodedFrame.height = height;
  const footage = decodedFrame.getContext('2d', { alpha: false });
  if (!context || !planes || !picture || !footage) throw Error('The depth composite requires a drawing canvas.');
  const virtualDepth = new Float32Array(width * height);
  const sampledDepth = new Float32Array(width * height);
  const origin = { x: 0, y: 0, z: 0 };
  let anchor = origin;
  const buildInsert = (point) => prepare(point, grade?.checked ? appearance : undefined);
  let insert = buildInsert(origin);
  let frame = 0;
  let pendingFrame = null;
  let cursor = { x: width / 2, y: height * 0.7 };
  const listeners = new AbortController();
  const options = { signal: listeners.signal };

  function note(message) {
    status.textContent = message;
    status.hidden = !message;
  }

  function draw(at, force = false, reuseFrame = false) {
    if (video.seeking || video.readyState < 2) return;
    const mediaTime = Math.max(0, Math.min(lastTime, at));
    const index = Math.min(samples.length - 1, Math.floor(mediaTime * fps + 1e-4));
    time.value = index / fps;
    clock.textContent = (index / fps).toFixed(2) + ' s';
    if (!force && index === frame) return;
    frame = index;
    if (!reuseFrame) footage.drawImage(video, 0, 0, width, height);
    const camera = cameras[frame];
    const observed = depths.subarray(frame * depthSize, (frame + 1) * depthSize);
    context.clearRect(0, 0, width, height);
    drawDepthMesh(context, insert, camera, intrinsics, occlude.checked ? virtualDepth : undefined);
    if (occlude.checked) {
      const image = context.getImageData(0, 0, width, height);
      // Canvas antialiasing can color a pixel just outside the triangle's sampled coverage.
      sampledDepth.set(virtualDepth);
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const i = y * width + x;
          if (image.data[i * 4 + 3] && !Number.isFinite(virtualDepth[i])) {
            sampledDepth[i] = Math.min(
              virtualDepth[i - 1],
              virtualDepth[i + 1],
              virtualDepth[i - width],
              virtualDepth[i + width],
            );
          }
        }
      }
      const composite = applyDepthHoldout({
        width,
        height,
        insert: image.data,
        insertDepth: sampledDepth,
        observed: { width: depth.width, height: depth.height, data: observed, scale: depth.step },
        bias: holdoutBias,
        softness: holdoutSoftness,
      });
      if (depth.width === width) {
        softenHoldoutEdge(composite, image.data, sampledDepth, observed, width, height, depth.step);
      }
      image.data.set(composite);
      context.putImageData(image, 0, 0);
    }
    picture.drawImage(decodedFrame, 0, 0);
    guideCanvas.hidden = Boolean(guideOutline) || !guide.checked;
    if (guide.checked) {
      if (guideOutline) {
        paintReceivingPlane(planes, guideOutline, camera, samples[frame], intrinsics, observed, depth);
        picture.drawImage(guideCanvas, 0, 0);
      } else paintPlanes(planes, surfaces, camera, samples[frame], intrinsics, observed, depth);
    }
    picture.drawImage(context.canvas, 0, 0);
  }

  function stopFrame() {
    if (pendingFrame !== null) video.cancelVideoFrameCallback(pendingFrame);
    pendingFrame = null;
  }

  function tick(_, metadata) {
    pendingFrame = null;
    if (video.paused) return;
    draw(metadata.mediaTime);
    pendingFrame = video.requestVideoFrameCallback(tick);
  }

  function sync(event) {
    stopFrame();
    playState(play, video.paused);
    if (!video.paused && video.requestVideoFrameCallback) {
      pendingFrame = video.requestVideoFrameCallback(tick);
    } else if (event?.type !== 'pause' || !video.requestVideoFrameCallback) {
      draw(video.currentTime, true);
    }
  }

  function redraw() {
    if (video.paused || !video.requestVideoFrameCallback) draw(frame / fps, true, true);
  }

  function moveCursor(x, y) {
    cursor = { x: Math.max(0, Math.min(width - 1, x)), y: Math.max(0, Math.min(height - 1, y)) };
    pointer.style.left = (cursor.x * 100) / width + '%';
    pointer.style.top = (cursor.y * 100) / height + '%';
  }

  function placeMode(active) {
    place.setAttribute('aria-pressed', String(active));
    shot.toggleAttribute('data-place', active);
    pointer.hidden = !active;
    if (!active) {
      shot.removeAttribute('tabindex');
      return;
    }
    video.pause();
    shot.tabIndex = 0;
    shot.focus();
    const { x, y, cameraDepth } = projectPoint(cameras[frame], anchor);
    moveCursor(
      cameraDepth > 0 ? x + intrinsics.cx - width / 2 : width / 2,
      cameraDepth > 0 ? y + intrinsics.cy - height / 2 : height * 0.7,
    );
    note(`Click the visible ${surface} or use the arrow keys and Enter. Press Escape to cancel.`);
  }

  function commitPlacement() {
    const camera = cameras[frame];
    const ray = worldRay(samples[frame], cursor.x, cursor.y, intrinsics);
    const [x, y, zWorld] = camera.matrixWorld.slice(12, 15);
    const z = -y / ray.y;
    const stride = width / depth.width;
    const pixel = Math.floor(cursor.y / stride) * depth.width + Math.floor(cursor.x / stride);
    const measured = depths[frame * depthSize + pixel] * depth.step;
    if (!measured || !Number.isFinite(z) || z < 0.25 || Math.abs(measured - z) > 0.1) {
      note(`Choose a visible ${surface} point with measured depth.`);
      return;
    }
    anchor = { x: x + ray.x * z, y: 0, z: zWorld + ray.z * z };
    insert = buildInsert(anchor);
    placeMode(false);
    place.focus();
    note(`${objectLabel} placed on the ${surface}.`);
    redraw();
  }

  for (const event of ['play', 'pause', 'seeked', 'ended']) video.addEventListener(event, sync, options);
  video.addEventListener(
    'timeupdate',
    () => {
      if (!video.requestVideoFrameCallback) draw(video.currentTime);
    },
    options,
  );
  video.addEventListener(
    'loadeddata',
    () => {
      play.disabled = time.disabled = place.disabled = reset.disabled = false;
      if (jump) jump.disabled = false;
      sync();
    },
    options,
  );
  video.addEventListener('error', () => note('Could not load the recorded footage.'), options);
  play.addEventListener(
    'click',
    () => {
      if (!video.paused) {
        video.pause();
        return;
      }
      placeMode(false);
      note('');
      if (video.currentTime >= lastTime) video.currentTime = 0;
      void video.play().catch(() => note('Could not play the recorded footage.'));
    },
    options,
  );
  function seek(at) {
    placeMode(false);
    note('');
    video.pause();
    video.currentTime = at;
  }
  time.addEventListener('input', () => seek(Number(time.value)), options);
  jump?.addEventListener('click', () => seek(cue.frame / fps), options);
  for (const input of [occlude, guide]) input.addEventListener('change', redraw, options);
  grade?.addEventListener(
    'change',
    () => {
      insert = buildInsert(anchor);
      redraw();
    },
    options,
  );
  place.addEventListener(
    'click',
    () => {
      const active = !shot.hasAttribute('data-place');
      placeMode(active);
      if (!active) note('');
    },
    options,
  );
  reset.addEventListener(
    'click',
    () => {
      placeMode(false);
      anchor = origin;
      insert = buildInsert(origin);
      note('');
      redraw();
    },
    options,
  );
  shot.addEventListener(
    'click',
    (event) => {
      if (!shot.hasAttribute('data-place')) return;
      const bounds = shot.getBoundingClientRect();
      moveCursor(
        ((event.clientX - bounds.left) * width) / bounds.width,
        ((event.clientY - bounds.top) * height) / bounds.height,
      );
      commitPlacement();
    },
    options,
  );
  shot.addEventListener(
    'keydown',
    (event) => {
      if (!shot.hasAttribute('data-place')) return;
      const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (Object.hasOwn(directions, event.key)) {
        event.preventDefault();
        const [dx, dy] = directions[event.key];
        moveCursor(cursor.x + dx * 6, cursor.y + dy * 6);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        commitPlacement();
      } else if (event.key === 'Escape') {
        placeMode(false);
        place.focus();
        note('');
      }
    },
    options,
  );
  video.src = clipSource(asset('webm').href);

  return () => {
    listeners.abort();
    stopFrame();
    video.pause();
    video.removeAttribute('src');
    video.load();
  };
}
