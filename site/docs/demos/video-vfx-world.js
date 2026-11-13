import { scene } from '../../runtime/src/core/index.js';
import { fromRGBA, hsla, toHex, toRGBA } from '../../runtime/src/color/index.js';
import { createSVGRenderer } from '../../runtime/src/renderers/svg.js';
import { perspectiveCamera, projectPoint, projectPoints } from '../../runtime/src/spatial/index.js';
import { css } from './_kit.js';
import { playState, shotControls } from './video-vfx-controls.js';

const viewport = { width: 640, height: 360 };
const color = (h, s, l, a = 1) => toHex(hsla(h, s, l, a));
const guide = color(176, 80, 80);
const normalColor = color(40, 96, 72);
const sidewalkAzimuth = (1.07148 * Math.PI) / 180;
const sidewalkElevation = Math.PI / 4;
const sidewalkLight = {
  x: Math.sin(sidewalkAzimuth) * Math.cos(sidewalkElevation),
  y: Math.sin(sidewalkElevation),
  z: Math.cos(sidewalkAzimuth) * Math.cos(sidewalkElevation),
};
const sides = 96;
const profile = [
  { height: 0, radius: 0.166, lightness: 15 },
  { height: 0.016, radius: 0.182, lightness: 22 },
  { height: 0.043, radius: 0.182, lightness: 13 },
  { height: 0.057, radius: 0.171, lightness: 30 },
  { height: 0.077, radius: 0.181, lightness: 29 },
  { height: 0.526, radius: 0.192, lightness: 19 },
  { height: 0.546, radius: 0.203, lightness: 37 },
  { height: 0.568, radius: 0.203, lightness: 45 },
  { height: 0.582, radius: 0.197, lightness: 47 },
  { height: 0.612, radius: 0.175, lightness: 52 },
  { height: 0.624, radius: 0.136, lightness: 49 },
];
const placeholder = [['M', 0, 0], ['L', 1, 0], ['L', 1, 1], ['Z']];

function commands(points) {
  return [...points.map(({ x, y }, i) => [i === 0 ? 'M' : 'L', x, y]), ['Z']];
}

function facing(points) {
  const [a, b, c] = points;
  return (b.x - a.x) * (c.y - a.y) < (b.y - a.y) * (c.x - a.x);
}

function ring(anchor, { radius, height }, start = 0, end = Math.PI * 2, count = sides) {
  return Array.from({ length: count }, (_, i) => {
    const angle = start + ((end - start) * i) / count;
    return { x: anchor.x + radius * Math.cos(angle), y: anchor.y + height, z: anchor.z + radius * Math.sin(angle) };
  });
}

function buildBin(anchor, light, metal) {
  const rings = profile.map((shape) => ring(anchor, shape));
  const vertices = rings.flat();
  const faces = [];
  for (let row = 0; row < rings.length - 1; row++) {
    const lower = profile[row];
    const upper = profile[row + 1];
    const rise = upper.height - lower.height;
    const inset = lower.radius - upper.radius;
    const slopeLength = Math.hypot(rise, inset);
    for (let i = 0; i < sides; i++) {
      const next = (i + 1) % sides;
      const angle = ((i + 0.5) / sides) * Math.PI * 2;
      const incident = light
        ? (rise * (light.x * Math.cos(angle) + light.z * Math.sin(angle)) + inset * light.y) / slopeLength
        : Math.cos(angle + 0.34);
      const lightness = lower.lightness + Math.max(0, incident) * 25;
      const rib = row === 4 && i % 4 === 0 ? 3 : 0;
      const bottom = row * sides;
      const top = bottom + sides;
      faces.push({ indices: [bottom + i, top + i, top + next, bottom + next], fill: metal(lightness + rib) });
    }
  }
  const lid = rings
    .at(-1)
    .map((_, i) => vertices.length - sides + i)
    .reverse();
  faces.push({ indices: lid, fill: metal(profile.at(-1).lightness + (light?.y ?? 0) * 12) });

  // The opening follows the body rather than remaining square in the image.
  const slot = [];
  for (const [bottom, top, fill] of [
    [0.447, 0.523, metal(42)],
    [0.457, 0.518, metal(7)],
  ]) {
    const start = 0.41;
    const end = 1.4;
    const strips = 14;
    const first = vertices.length;
    vertices.push(...ring(anchor, { radius: 0.195, height: bottom }, start, end, strips));
    const second = vertices.length;
    vertices.push(...ring(anchor, { radius: 0.195, height: top }, start, end, strips));
    slot.push(
      Array.from({ length: strips - 1 }, (_, i) => ({
        indices: [first + i, second + i, second + i + 1, first + i + 1],
        fill,
      })),
    );
  }
  return { positions: pack(vertices), faces, slot };
}

function pack(points) {
  return new Float64Array(points.flatMap(({ x, y, z }) => [x, y, z]));
}

function outline(points) {
  const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const side = (ordered) => {
    const edge = [];
    for (const p of ordered) {
      while (edge.length > 1 && facing([edge.at(-2), edge.at(-1), p])) edge.pop();
      edge.push(p);
    }
    return edge.slice(0, -1);
  };
  return [...side(sorted), ...side(sorted.reverse())];
}

function drawPolygon(context, points, fill, joined = false) {
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) context.lineTo(point.x, point.y);
  context.closePath();
  context.fillStyle = fill;
  context.fill();
  if (joined) {
    context.strokeStyle = fill;
    context.stroke();
  }
}

function rasterizeDepth(points, buffer, { width, height }) {
  const [a] = points;
  for (let i = 1; i < points.length - 1; i++) {
    const b = points[i];
    const c = points[i + 1];
    const dx1 = b.x - a.x,
      dy1 = b.y - a.y;
    const dx2 = c.x - a.x,
      dy2 = c.y - a.y;
    const area = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(area) < 1e-6) continue;
    const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
    const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x + 0.5 - a.x,
          dy = y + 0.5 - a.y;
        const u = (dx * dy2 - dy * dx2) / area;
        const v = (dx1 * dy - dy1 * dx) / area;
        if (u < 0 || v < 0 || u + v > 1) continue;
        const depth = 1 / ((1 - u - v) / a.depth + u / b.depth + v / c.depth);
        const index = y * width + x;
        if (depth < buffer[index]) buffer[index] = depth;
      }
    }
  }
}

function drawFaces(context, faces, projected, depthBuffer, size) {
  const visible = faces
    .map(({ indices, fill }) => ({ points: indices.map((i) => projected[i]), fill }))
    .filter(({ points }) => points.every((p) => p.depth > 0.01) && facing(points));
  const depth = (points) => points.reduce((sum, p) => sum + p.depth, 0) / points.length;
  visible.sort((a, b) => depth(b.points) - depth(a.points));
  for (const { points, fill } of visible) {
    drawPolygon(context, points, fill, true);
    if (depthBuffer) rasterizeDepth(points, depthBuffer, size);
  }
}

function shadowFootprint(anchor, light) {
  const footprint = ring(anchor, { radius: 0.19, height: 0 });
  if (light) {
    // Project every ring vertex away from the source onto the receiving plane.
    const flat = profile
      .flatMap((shape) => ring(anchor, shape))
      .map((p) => {
        const travel = (p.y - anchor.y) / light.y;
        return { x: p.x - travel * light.x, y: p.z - travel * light.z };
      });
    const cast = outline(flat).map(({ x, y }) => ({ x, y: anchor.y, z: y }));
    return { contact: pack(footprint), cast: pack(cast) };
  }
  const cap = profile.at(-1);
  const cast = ring(
    { ...anchor, x: anchor.x - cap.height * 0.7, z: anchor.z + cap.height * 0.9 },
    { radius: 0.16, height: 0 },
  );
  return {
    contact: pack(footprint),
    cast: pack([...footprint, ...cast]),
  };
}

function exposedColor(h, s, l, alpha, exposure) {
  const value = hsla(h, s, l, alpha);
  if (exposure === 0) return toHex(value);
  const [r, g, b, a] = toRGBA(value);
  const gain = 2 ** exposure;
  const expose = (c) => {
    const linear = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    const lit = Math.min(1, linear * gain);
    return lit <= 0.0031308 ? lit * 12.92 : 1.055 * lit ** (1 / 2.4) - 0.055;
  };
  return toHex(fromRGBA(expose(r), expose(g), expose(b), a));
}

/** Place an upright mesh on a horizontal surface. A light vector points toward the source. */
export function prepareGroundBin(anchor, scale = 1, { lightDirection, appearance = {} } = {}) {
  if (!validNumbers([anchor?.x, anchor?.y, anchor?.z, scale], 4) || scale <= 0)
    throw Error('Invalid trash can placement.');
  let light;
  if (lightDirection !== undefined) {
    const components = [lightDirection?.x, lightDirection?.y, lightDirection?.z];
    const length = Math.hypot(...components);
    const minimumElevation = Math.sin((2.9 * Math.PI) / 180);
    if (
      !validNumbers(components, 3) ||
      !Number.isFinite(length) ||
      length === 0 ||
      components[1] / length < minimumElevation
    ) {
      throw Error('The light direction must be at least 2.9 degrees above the ground plane.');
    }
    const [x, y, z] = components.map((component) => component / length);
    light = { x, y, z };
  }
  const { hue, saturation, exposure = 0, shadowOpacity = 0.45 } = appearance;
  if (
    !validNumbers([hue ?? 0, saturation ?? 0, exposure, shadowOpacity], 4) ||
    (saturation !== undefined && (saturation < 0 || saturation > 100)) ||
    Math.abs(exposure) > 2 ||
    shadowOpacity < 0 ||
    shadowOpacity > 1
  ) {
    throw Error('Use a finite hue, saturation from 0 to 100, exposure within two stops and opacity from 0 to 1.');
  }
  const metal = (lightness) => exposedColor(hue ?? 162, saturation ?? 1, lightness, 1, exposure);
  const origin = { x: 0, y: 0, z: 0 };
  const bin = buildBin(origin, light, metal);
  const shadow = shadowFootprint(origin, light);
  const castTint = exposedColor(hue ?? 30, saturation ?? 4, 6, shadowOpacity, exposure);
  const contactTint = exposedColor(hue ?? 30, saturation ?? 4, 4, 0.64, exposure);
  for (const points of [bin.positions, shadow.contact, shadow.cast]) {
    for (let i = 0; i < points.length; i += 3) {
      points[i] = anchor.x + points[i] * scale;
      points[i + 1] = anchor.y + points[i + 1] * scale;
      points[i + 2] = anchor.z + points[i + 2] * scale;
    }
  }
  return { ...bin, shadow, castTint, contactTint, castVisible: shadowOpacity > 0 };
}

/** Draw into a transparent layer. Optional depth records camera-space z at pixel centers. */
export function drawDepthMesh(context, mesh, camera, { cx, cy }, depthBuffer) {
  const size = camera.viewport;
  if (depthBuffer) {
    if (!(depthBuffer instanceof Float32Array) || depthBuffer.length !== size.width * size.height) {
      throw Error('The insert depth buffer must match the camera viewport.');
    }
    depthBuffer.fill(Infinity);
  }
  const offsetX = cx - size.width / 2;
  const offsetY = cy - size.height / 2;
  const project = (points) => {
    const { positions, cameraDepths } = projectPoints(camera, points);
    return Array.from(cameraDepths, (depth, i) => ({
      x: positions[i * 2] + offsetX,
      y: positions[i * 2 + 1] + offsetY,
      depth,
    }));
  };
  context.save();
  context.lineWidth = 0.45;
  for (const [points, tint, blur, visible] of [
    [mesh.shadow.cast, mesh.castTint, 'blur(1.3px)', mesh.castVisible],
    [mesh.shadow.contact, mesh.contactTint, 'blur(1px)', true],
  ]) {
    if (!visible) continue;
    const projected = project(points);
    if (projected.some((p) => p.depth <= camera.near)) continue;
    const polygon = outline(projected);
    context.filter = blur;
    drawPolygon(context, polygon, tint);
    if (depthBuffer) {
      // A receiver can differ slightly from its measured depth. Keep its shadow
      // visible on the receiving plane while closer foreground still hides it.
      const shadowDepth = mesh.shadowDepthBias
        ? polygon.map((point) => ({ ...point, depth: Math.max(camera.near, point.depth - mesh.shadowDepthBias) }))
        : polygon;
      rasterizeDepth(shadowDepth, depthBuffer, size);
    }
  }
  context.filter = 'none';
  const projected = project(mesh.positions);
  drawFaces(context, mesh.faces, projected, depthBuffer, size);
  for (const border of mesh.slot ?? []) drawFaces(context, border, projected, depthBuffer, size);
  context.restore();
}

export { drawDepthMesh as drawGroundBin };

function normalCommands(base, tip) {
  const dx = tip.x - base.x,
    dy = tip.y - base.y;
  const length = Math.hypot(dx, dy);
  if (length < 1)
    return [
      ['M', base.x, base.y],
      ['L', tip.x, tip.y],
    ];
  const x = dx / length,
    y = dy / length;
  return [
    ['M', base.x, base.y],
    ['L', tip.x, tip.y],
    ['M', tip.x - 7 * x - 3 * y, tip.y - 7 * y + 3 * x],
    ['L', tip.x, tip.y],
    ['L', tip.x - 7 * x + 3 * y, tip.y - 7 * y - 3 * x],
  ];
}

export function cameraFor({ rotation, translation }, { fx, fy }, size = viewport) {
  const [xx, xy, xz, yx, yy, yz, zx, zy, zz] = rotation;
  const [tx, ty, tz] = translation;
  // The solved pose maps world points into an image camera whose y points down and z points forward.
  const x = -(xx * tx + yx * ty + zx * tz);
  const y = -(xy * tx + yy * ty + zy * tz);
  const z = -(xz * tx + yz * ty + zz * tz);
  return perspectiveCamera(
    {
      x,
      y,
      z,
      target: { x: x + zx, y: y + zy, z: z + zz },
      up: { x: -yx, y: -yy, z: -yz },
      fov: 2 * Math.atan(size.height / (2 * fy)),
      aspect: (size.width * fy) / (size.height * fx),
      near: 0.01,
      far: 100,
    },
    size,
  );
}

function validNumbers(values, count) {
  return Array.isArray(values) && values.length === count && values.every(Number.isFinite);
}

export default async function worldDemo(stage, { createInsert } = {}) {
  shotControls();
  css(
    'vfx-world-placement',
    `
    .vfx-world-options { display:flex; gap:16px; flex-wrap:wrap; color:var(--muted); font:13px var(--sans); }
    .vfx-world-options label { display:flex; align-items:center; gap:6px; }
  `,
  );
  const response = await fetch(new URL('./video-vfx-world-track.json', import.meta.url));
  if (!response.ok) throw Error('The camera track could not be loaded.');
  const { width, height, fps, intrinsics, samples, ground } = await response.json();
  const point = (p) => validNumbers([p?.x, p?.y, p?.z], 3);
  if (
    width !== viewport.width ||
    height !== viewport.height ||
    fps !== 25 ||
    !validNumbers([intrinsics?.fx, intrinsics?.fy, intrinsics?.cx, intrinsics?.cy, ground?.y], 5) ||
    intrinsics.fx <= 0 ||
    intrinsics.fy <= 0 ||
    !point(ground.anchor) ||
    !Array.isArray(ground.corners) ||
    ground.corners.length !== 4 ||
    !ground.corners.every(point) ||
    !Array.isArray(samples) ||
    samples.length < 2 ||
    samples.length > 150 ||
    !samples.every(
      ({ time, rotation, translation }, i) =>
        time === i / fps && validNumbers(rotation, 9) && validNumbers(translation, 3),
    )
  ) {
    throw Error('The camera track is invalid.');
  }
  const cameras = samples.map((sample) => cameraFor(sample, intrinsics));
  const anchor = { ...ground.anchor, y: ground.y };
  const authoredBin = prepareGroundBin(anchor);
  const matchedBin = prepareGroundBin(anchor, 1, { lightDirection: sidewalkLight });
  const drawInsert =
    createInsert?.({ anchor, lightDirection: sidewalkLight }) ??
    ((context, camera, intrinsics, { matchLight }) => {
      drawDepthMesh(context, matchLight ? matchedBin : authoredBin, camera, intrinsics);
    });
  const groundCorners = ground.corners.map((corner) => ({ ...corner, y: ground.y }));
  const normalBase = { x: anchor.x + 0.46, y: ground.y, z: anchor.z + 0.12 };
  const normalTip = { ...normalBase, y: ground.y + 0.28 };
  const offsetX = intrinsics.cx - viewport.width / 2;
  const offsetY = intrinsics.cy - viewport.height / 2;
  const lastTime = (samples.length - 1) / fps;

  stage.innerHTML = `
    <div class="vfx-demo">
      <div class="vfx-shot">
        <video muted playsinline preload="auto" aria-label="Camera panning along a paved sidewalk"></video>
        <canvas class="vfx-composite vfx-world-insert" width="${width * 2}" height="${height * 2}" aria-hidden="true"></canvas>
        <div class="vfx-scene vfx-world-guide-overlay" aria-hidden="true"></div>
      </div>
      <div class="vfx-timeline">
        <button class="vfx-play" type="button" aria-label="Play" title="Play" disabled></button>
        <input type="range" min="0" max="${lastTime}" step="0.04" value="0" aria-label="Sidewalk footage time" disabled>
        <output aria-label="Time">0.00 s</output>
      </div>
      <div class="vfx-world-options">
        <label><input class="vfx-world-inserts" type="checkbox" checked> ${createInsert ? 'Show character and can' : 'Show trash can'}</label>
        <label><input class="vfx-world-light" type="checkbox" checked> Match shadow direction</label>
        <label><input class="vfx-world-guide" type="checkbox"> Show ground plane</label>
      </div>
      <div class="vfx-status" role="status" hidden></div>
      <div class="vfx-credit">Footage by <a href="https://www.pexels.com/video/silhouette-stroll-along-brick-wall-in-urban-setting-35765822/">cami</a>.</div>
    </div>`;
  const get = (selector) => stage.querySelector(selector);
  const video = get('video'),
    play = get('.vfx-play'),
    time = get('input[type=range]'),
    clock = get('output'),
    status = get('.vfx-status'),
    inserts = get('.vfx-world-inserts'),
    matchLight = get('.vfx-world-light'),
    showGuide = get('.vfx-world-guide'),
    insert = get('.vfx-world-insert'),
    overlay = get('.vfx-world-guide-overlay');

  const context = insert.getContext('2d');
  if (!context) throw Error('A drawing surface could not be created.');
  context.scale(2, 2);
  const model = scene({ ...viewport, label: 'A guide to the ground plane beneath the trash can' });
  const renderer = createSVGRenderer(overlay);
  const plane = model.path({
    commands: placeholder,
    fill: 'none',
    stroke: guide,
    strokeWidth: 1.5,
    strokeDasharray: [6, 4],
  });

  const normal = model.path({ commands: placeholder, fill: 'none', stroke: normalColor, strokeWidth: 2 });
  const normalOrigin = model.circle({ r: 2.6, fill: normalColor });

  let frameRequest = null;
  let mediaTime = 0;
  const listeners = new AbortController();
  const options = { signal: listeners.signal };

  function draw(at) {
    if (video.seeking || video.readyState < 2) return;
    mediaTime = Math.max(0, Math.min(lastTime, at));
    time.value = mediaTime;
    clock.textContent = mediaTime.toFixed(2) + ' s';
    const frame = Math.min(cameras.length - 1, Math.round(mediaTime * fps));
    const camera = cameras[frame];
    const project = (world) => {
      const { x, y, cameraDepth } = projectPoint(camera, world);
      return { x: x + offsetX, y: y + offsetY, cameraDepth };
    };

    context.clearRect(0, 0, width, height);
    if (inserts.checked) drawInsert(context, camera, intrinsics, { time: frame / fps, matchLight: matchLight.checked });
    if (showGuide.checked) {
      const base = project(normalBase);
      const tip = project(normalTip);
      plane.set({ commands: commands(groundCorners.map(project)), opacity: 1 });
      normal.set({ commands: normalCommands(base, tip), opacity: 1 });
      normalOrigin.set({ x: base.x, y: base.y, opacity: 1 });
    } else {
      for (const shape of [plane, normal, normalOrigin]) shape.set({ opacity: 0 });
    }
    renderer.render(model.sample({ time: 0 }));
  }

  function cancelFrame() {
    if (frameRequest !== null) video.cancelVideoFrameCallback(frameRequest);
    frameRequest = null;
  }

  function tick(_, frame) {
    draw(frame.mediaTime);
    frameRequest = video.paused ? null : video.requestVideoFrameCallback(tick);
  }

  function sync() {
    cancelFrame();
    playState(play, video.paused);
    if (video.paused || !video.requestVideoFrameCallback) draw(video.currentTime);
    else frameRequest = video.requestVideoFrameCallback(tick);
  }

  for (const event of ['play', 'pause', 'seeked', 'ended']) video.addEventListener(event, sync, options);
  video.addEventListener(
    'timeupdate',
    () => {
      if (video.paused || !video.requestVideoFrameCallback) draw(video.currentTime);
    },
    options,
  );
  video.addEventListener(
    'loadeddata',
    () => {
      play.disabled = time.disabled = false;
      sync();
    },
    options,
  );
  video.addEventListener(
    'error',
    () => {
      status.hidden = false;
      status.textContent = 'The wall footage could not be loaded.';
    },
    options,
  );
  play.addEventListener(
    'click',
    () => {
      if (!video.paused) video.pause();
      else {
        if (video.currentTime >= lastTime) video.currentTime = 0;
        void video.play().catch(() => {
          status.hidden = false;
          status.textContent = 'The wall footage could not play.';
        });
      }
    },
    options,
  );
  time.addEventListener(
    'input',
    () => {
      const target = Number(time.value);
      video.pause();
      video.currentTime = target;
    },
    options,
  );
  for (const option of [inserts, matchLight, showGuide])
    option.addEventListener('change', () => draw(mediaTime), options);
  video.src = new URL('./video-vfx-wall.webm', import.meta.url).href;

  return () => {
    listeners.abort();
    cancelFrame();
    video.pause();
    video.removeAttribute('src');
    video.load();
    renderer.dispose();
  };
}
