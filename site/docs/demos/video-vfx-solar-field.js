import { hsla, toHex } from '../../runtime/src/color/index.js';
import { perspectiveCamera } from '../../runtime/src/spatial/index.js';
import { compileCameraTrack } from '../../runtime/src/vfx/index.js';
import { css } from './_kit.js';
import { playState, shotControls } from './video-vfx-controls.js';
import { actualDiameter, bodies, calendar, chapters, formatSize, stateAt } from './video-vfx-solar-field-data.js';
import { makePlanetLayer, pointsOnField } from './video-vfx-solar-field-render.js';

const viewport = { width: 960, height: 540 };
const runtime = 32;
// TDB days since J2000.0, from 12 Nov 2022 through 12 Nov 2024.
const startDay = 8350.5;
const endDay = 9081.5;
const orbitStart = chapters[1].time;
const orbitEnd = 31.1;
const ink = toHex(hsla(144, 20, 9, 0.88));
const traces = bodies.map((_, i) => toHex(hsla(i >= 6 ? 45 : 187, i >= 6 ? 39 : 21, 93, i >= 6 ? 0.63 : 0.43)));
const hue = [44, 30, 46, 196, 17, 30, 43, 177, 208];
const asset = (suffix) => new URL('./video-vfx-solar-field' + suffix, import.meta.url);
const clamp = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => (x = clamp(x)) * x * (3 - 2 * x);
const earth = 3;
const labelOffsets = [-24, 24, -40, -16, 21, -16, 18, -16, -16];
const outerChapter = chapters.at(-1).time;
const xyz = ([x, y, z]) => ({ x, y, z });
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
const highlight = (i) => toHex(hsla(hue[i], 76, 78));
function fieldTransform(track) {
  const c = Math.cos(track.rotation),
    s = Math.sin(track.rotation);
  const up = Math.cos(track.tilt),
    across = Math.sin(track.tilt);
  const direction = ([x, y, z]) => {
    const along = z * c - x * s;
    return [x * c + z * s, y * up - along * across, y * across + along * up];
  };
  return {
    direction,
    position([x, y, z]) {
      return direction([x, z, -y]).map((value, axis) => track.center[axis] + value * track.metresPerAU);
    },
  };
}

function cameraAt(track, seconds) {
  // Sample the camera at the source frame used by the retimed footage.
  const sourceTime = seconds < orbitStart ? seconds * (20 / orbitStart) : 20 + (seconds - orbitStart) * 0.8;
  const row = Math.max(0, Math.min(sourceTime * track.fps, track.samples.length - 1));
  const index = Math.min(Math.floor(row), track.samples.length - 2);
  const t = row - index;
  const a = track.samples[index],
    b = track.samples[index + 1];
  const previous = track.samples[index - 1] ?? a;
  const next = track.samples[index + 2] ?? b;
  const p = a.map((value, axis) => {
    const startVelocity = (b[axis] - previous[axis]) / 2;
    const endVelocity = (next[axis] - value) / 2;
    return value + (b[axis] - value) * smooth(t) + t * (1 - t) * ((1 - t) * startVelocity - t * endVelocity);
  });
  return perspectiveCamera(
    {
      ...xyz(p.slice(0, 3)),
      target: xyz(p.slice(0, 3).map((x, i) => x + p[i + 3])),
      up: xyz(p.slice(6)),
      fov: 2 * Math.atan(viewport.height / (2 * track.focal)),
      near: 0.05,
      far: 2000,
    },
    viewport,
  );
}

function makeObjects(track, field, ephemeris, day) {
  return bodies.map((body, index) => {
    const { position, orientation } = stateAt(ephemeris, index, day);
    return {
      ...body,
      index,
      radius: actualDiameter(body, track.metresPerAU) / 2,
      alpha: 1,
      position,
      center: field.position(position),
      orientation: [
        ...field.direction(orientation.slice(0, 3)),
        ...field.direction(orientation.slice(3, 6)),
        ...field.direction(orientation.slice(6)),
      ],
    };
  });
}

function inspectionView(wide, subject) {
  const origin = wide.matrixWorld.slice(12, 15);
  const dx = origin[0] - subject.center[0],
    dz = origin[2] - subject.center[2];
  const heading = Math.atan2(dz, dx);
  const distance = subject.radius * (subject.index >= 5 ? 12.8 : 6.6);
  const eye = subject.center.map((value, i) => value + distance * [Math.cos(heading), 0.34, Math.sin(heading)][i]);
  const camera = perspectiveCamera(
    {
      ...xyz(eye),
      target: xyz(subject.center),
      fov: 2 * Math.atan(1 / wide.projectionMatrix[5]),
      near: Math.max(1e-8, distance / 100),
      far: 2000,
    },
    viewport,
  );
  return { camera, groundY: subject.center[1] - subject.radius * 1.14, groundOpacity: 1, groundUnit: distance * 0.65 };
}

function stroke(ctx, pts, color, width) {
  ctx.beginPath();
  let moved = false;
  for (const p of pts) {
    if (p.depth < 0.1) {
      moved = false;
      continue;
    }
    if (moved) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
    moved = true;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function edgeOpacity(point, padding) {
  if (point.depth <= 0.1) return 0;
  const edge = Math.min(point.x, viewport.width - point.x, point.y, viewport.height - point.y);
  return smooth(edge / padding);
}

function pin(ctx, point, color, silhouette, opacity) {
  if (opacity <= 0.001) return;
  // The gap keeps the center clear for the physical silhouette.
  const gap = Math.max(3, silhouette / 2 + 2);
  const end = gap + 3;
  const { x, y } = point;
  ctx.globalAlpha = opacity;
  ctx.beginPath();
  ctx.moveTo(x - end, y);
  ctx.lineTo(x - gap, y);
  ctx.moveTo(x + gap, y);
  ctx.lineTo(x + end, y);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawDiameterChart(canvas) {
  const ctx = canvas.getContext('2d');
  const pixelsPerKm = 270 / bodies[0].diameter;
  const baseline = 290;
  const diameterText = new Intl.NumberFormat('en');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  bodies.forEach(({ name, diameter }, index) => {
    const x = index === 0 ? 164 : 350 + (index - 1) * 80;
    const radius = (diameter * pixelsPerKm) / 2;
    ctx.beginPath();
    ctx.arc(x, baseline - radius, radius, 0, 2 * Math.PI);
    ctx.fillStyle = highlight(index);
    ctx.fill();
    ctx.fillStyle = toHex(hsla(0, 0, 95));
    ctx.font = '600 18px system-ui';
    ctx.fillText(name, x, baseline + 24);
    ctx.font = '12px system-ui';
    ctx.fillText(diameterText.format(diameter), x, baseline + 43);
  });
}

async function readAsset(suffix, limit) {
  const response = await fetch(asset(suffix));
  if (!response.ok) throw Error('The solar system data could not be loaded.');
  const payload = await response.text();
  if (payload.length > limit) throw Error('The solar system data exceeds the demo budget.');
  return JSON.parse(payload);
}

function prepareShotCamera(track) {
  const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
  const poses = track.samples.map((sample, i) => {
    const center = sample.slice(0, 3);
    const [fx, fy, fz, ux, uy, uz] = sample.slice(3);
    const right = [fy * uz - fz * uy, fz * ux - fx * uz, fx * uy - fy * ux];
    const rows = [right, [ux, uy, uz], [-fx, -fy, -fz]];
    return { time: i / track.fps, rotation: rows.flat(), translation: rows.map((row) => -dot(row, center)) };
  });
  const { samples, repaired } = compileCameraTrack(poses);
  const cameraSamples = track.samples.slice();
  for (const index of repaired) {
    const { rotation, translation } = samples[index];
    const center = [0, 1, 2].map((i) => -dot([rotation[i], rotation[i + 3], rotation[i + 6]], translation));
    cameraSamples[index] = [...center, ...rotation.slice(6).map((value) => -value), ...rotation.slice(3, 6)];
  }
  return { ...track, samples: cameraSamples };
}

async function getData() {
  const [track, ephemeris] = await Promise.all([
    readAsset('-camera.json', 32_000),
    readAsset('-orbits.json', 4_000_000),
  ]);
  const tuple = (row, n, max) =>
    Array.isArray(row) && row.length === n && row.every((x) => Number.isFinite(x) && Math.abs(x) < max);
  const rows = (table, n, width, max) =>
    Array.isArray(table) && table.length === n && table.every((row) => tuple(row, width, max));
  if (
    track.fps !== 8 ||
    track.focal !== 800 ||
    !rows(track.samples, 296, 9, 500) ||
    !tuple(track.center, 3, 500) ||
    !Number.isFinite(track.rotation) ||
    Math.abs(track.rotation) > Math.PI ||
    !Number.isFinite(track.tilt) ||
    Math.abs(track.tilt) > Math.PI / 2 ||
    !Number.isFinite(track.metresPerAU) ||
    track.metresPerAU <= 0 ||
    track.metresPerAU > 50 ||
    ephemeris.stepDays !== 2 ||
    ephemeris.startDay !== 6160.5 ||
    ephemeris.endDay !== 9812.5 ||
    !Array.isArray(ephemeris.bodies) ||
    ephemeris.bodies.length !== 9 ||
    !ephemeris.bodies.every(
      (body, i) =>
        Number.isFinite(body.spinDegPerDay) &&
        Math.abs(body.spinDegPerDay) < 1000 &&
        rows(body.samples, 1827, 15, 40) &&
        rows(body.outline, i ? 181 : 0, 3, 40),
    )
  )
    throw Error('The solar system data is invalid.');
  return { track: prepareShotCamera(track), ephemeris };
}

export default async function solarField(stage, { still = false } = {}) {
  shotControls();
  css(
    'vfx-solar-field',
    `
    .solar-field { display:grid; gap:.65rem; min-width:0; width:100%; }
    .solar-field .vfx-shot { aspect-ratio:16/9; background:#202820; container-type:inline-size; }
    .solar-field .vfx-shot > :is(video, canvas, .solar-labels) { position:absolute; inset:0; display:block; width:100%; height:100%; }
    .solar-field .vfx-shot > :is(canvas, .solar-labels) { pointer-events:none; }
    .solar-label { position:absolute; left:0; top:0; transform:translate(-50%,-50%); white-space:nowrap; font:650 clamp(9px,2.15cqw,14px) var(--sans); color:#fff9e8; text-shadow:0 1px 3px #101710,0 0 7px #101710; }
    .solar-field .solar-heading { position:absolute; left:4%; top:8%; margin:0; color:#fff9e9; line-height:1; text-shadow:0 1px 4px #182a20; pointer-events:none; }
    .solar-heading small { display:block; color:inherit; font:700 clamp(7px,1.75cqw,12px) var(--sans); letter-spacing:.11em; text-transform:uppercase; margin-bottom:.6em; }
    .solar-field .solar-heading strong { display:block; color:inherit; font:650 clamp(17px,4.4cqw,40px)/1 var(--sans); letter-spacing:-.045em; }
    .solar-gaps { display:block; margin-top:.52em; color:#ffe4a5; font:700 clamp(10px,2.7cqw,20px) var(--sans); }
    .solar-controls { display:flex; flex-wrap:wrap; gap:.35rem .8rem; align-items:center; font:13px var(--sans); color:var(--muted); }
    .solar-controls label { display:inline-flex; align-items:center; gap:.3em; min-height:36px; }
    .solar-field button[aria-current=true], .solar-field button[aria-pressed=true] { border-color:currentColor; font-weight:700; }
    .solar-date { display:grid; grid-template-columns:auto minmax(70px,1fr) auto; align-items:center; gap:.4rem; }
    .solar-date input { width:100%; min-height:36px; accent-color:hsl(var(--h) var(--accent-s) var(--accent-l)); }
    .solar-date output { min-width:11ch; font:650 .78rem var(--mono); }
    .solar-field .solar-readout, .solar-field .solar-error { margin:0; font:500 .84rem/1.5 var(--sans); color:var(--muted); }
    .solar-legend { display:flex; flex-wrap:wrap; gap:.25rem; }
    .solar-field .solar-legend button { padding:.28em .6em; font-size:.73rem; min-height:32px; }
    .solar-legend i { width:.55em; height:.55em; margin-right:.35em; display:inline-block; border:1px solid #5557; border-radius:50%; }
    .solar-size-chart { min-width:0; }
    .solar-size-chart canvas { display:block; width:100%; height:auto; background:hsl(206 25% 12%); border-radius:12px; }
    .solar-size-chart p { margin:.3rem 0; color:var(--muted); font-size:.8rem; }
    .solar-field [hidden] { display:none !important; }
  `,
  );
  const { track, ephemeris } = await getData();
  const field = fieldTransform(track);
  const paths = ephemeris.bodies.map(({ outline }) => outline.map(field.position));
  stage.innerHTML = `<div class="vfx-demo solar-field">
    <div class="vfx-shot">
      <video muted playsinline preload="auto" aria-label="Wide aerial footage over farmland"></video>
      <canvas class="solar-marks" width="960" height="540" aria-hidden="true"></canvas>
      <canvas class="solar-gl" width="1440" height="810" aria-hidden="true"></canvas>
      <div class="solar-labels" aria-hidden="true"></div>
      <p class="solar-heading" aria-hidden="true"><small></small><strong></strong><span class="solar-gaps"></span></p>
    </div>
    <div class="vfx-timeline">
      <button class="vfx-play" type="button" aria-label="Play" disabled></button>
      <input class="solar-seek" type="range" min="0" max="${runtime}" step="0.041667" value="0" aria-label="Film time" disabled>
      <output class="solar-clock" aria-label="Film time">0:00 / 0:32</output>
    </div>
    <div class="solar-controls" role="group" aria-label="Chapters">
      ${chapters.map(({ name, time }) => `<button type="button" data-time="${time}" disabled>${name}</button>`).join('')}
    </div>
    <div class="solar-date">
      <output class="solar-date-value" aria-label="Simulation date"></output>
      <input class="solar-date-range" type="range" min="${startDay}" max="${endDay}" step=".25" aria-label="Simulation date">
      <button type="button" class="solar-step" title="Advance the ephemeris by six hours">+6 h</button>
    </div>
    <div class="solar-controls">
      <button type="button" class="solar-wide">Field view</button>
      <button type="button" class="solar-compare" aria-expanded="false">Compare diameters</button>
      <label><input type="checkbox" class="solar-shadow" checked> Cast shadows</label>
      <label><input type="checkbox" class="solar-light" checked disabled> Sun lighting</label>
    </div>
    <div class="solar-legend" role="group" aria-label="Inspect a body">
      ${bodies.map(({ name }, i) => `<button type="button" data-body="${i}" aria-pressed="false"><i aria-hidden="true" style="background:${highlight(i)}"></i>${name}</button>`).join('')}
    </div>
    <div class="solar-size-chart" hidden>
      <canvas width="960" height="348" role="img" aria-label="The Sun and eight planets side by side at a common diameter scale"></canvas>
      <p>Diameters in kilometres. Saturn’s silhouette shows its globe.</p>
    </div>
    <p class="solar-readout" role="status" hidden></p>
    <p class="solar-error" role="status" hidden></p>
  </div>`;
  const get = (q) => stage.querySelector(q);
  const video = get('video'),
    play = get('.vfx-play'),
    seek = get('.solar-seek'),
    clock = get('.solar-clock');
  const dateRange = get('.solar-date-range'),
    dateValue = get('.solar-date-value'),
    step = get('.solar-step');
  const heading = get('.solar-heading'),
    shadows = get('.solar-shadow'),
    sunLighting = get('.solar-light');
  const wideButton = get('.solar-wide'),
    compare = get('.solar-compare'),
    sizeChart = get('.solar-size-chart'),
    detail = get('.solar-readout'),
    status = get('.solar-error');
  const chapterButtons = [...stage.querySelectorAll('[data-time]')],
    bodyButtons = [...stage.querySelectorAll('[data-body]')];
  const marks = get('.solar-marks').getContext('2d');
  const shot = get('.vfx-shot');
  let labelWidth = shot.clientWidth;
  const glCanvas = get('.solar-gl');
  const labels = bodies.map(({ name }) => {
    const label = document.createElement('span');
    label.className = 'solar-label';
    label.textContent = name;
    get('.solar-labels').append(label);
    return label;
  });
  let labelSizes = measureLabels();
  const resize = new ResizeObserver((entries) => {
    const shotEntry = entries.find(({ target }) => target === shot);
    if (shotEntry) labelWidth = shotEntry.contentRect.width;
    labelSizes = measureLabels();
    draw(at);
  });
  resize.observe(shot);
  labels.forEach((label) => resize.observe(label));
  const listeners = new AbortController(),
    options = { signal: listeners.signal };
  let layer,
    disposed = false,
    frame = null,
    at = 0,
    day = startDay,
    userDay,
    userView,
    selected = -1;
  let previousChapter = -1;
  let hasPresentedFrame = false;
  const labelOpacity = bodies.map(() => 0);

  function tell(message) {
    status.hidden = false;
    status.textContent = message;
  }

  function measureLabels() {
    return labels.map(({ offsetWidth, offsetHeight }) => ({ width: offsetWidth, height: offsetHeight }));
  }

  function draw(seconds, advanceLabels = false) {
    const previousTime = at;
    at = Math.max(0, Math.min(runtime, seconds));
    day = userDay ?? startDay + (endDay - startDay) * clamp((at - orbitStart) / (orbitEnd - orbitStart));
    const wide = cameraAt(track, at);
    const objects = makeObjects(track, field, ephemeris, day);
    const inspecting = layer && userView >= 0;
    const view = inspecting ? inspectionView(wide, objects[userView]) : { camera: wide };
    const lateShot = !inspecting && at >= orbitStart;
    const outerBeat = !inspecting && at >= outerChapter && at < 30;
    const positions = pointsOnField(
      view.camera,
      objects.map(({ center }) => center),
    );
    marks.clearRect(0, 0, viewport.width, viewport.height);
    if (!inspecting) {
      marks.globalAlpha = still ? Number(lateShot) : smooth((at - 5) / 5);
      for (let i = 1; i < paths.length; i++) {
        stroke(marks, pointsOnField(wide, paths[i]), traces[i], i >= 6 ? 1.05 : 0.8);
      }
      marks.globalAlpha = 1;
      positions.forEach((point, index) => {
        const opacity = edgeOpacity(point, 24) * (index === earth ? 1 : smooth((at - 3.6) / 0.75));
        const diameter = (objects[index].radius * 2 * track.focal) / point.depth;
        pin(marks, point, highlight(index), layer ? diameter : 0, opacity);
      });
    }

    // Labels keep a fixed offset. At tight overlaps the lower-priority name fades in place.
    const occupied = [];
    const widthInScene = viewport.width / Math.max(1, labelWidth);
    const elapsed = Math.max(0, at - previousTime);
    const labelBlend = advanceLabels ? 1 - Math.exp(-Math.min(elapsed, 0.12) / 0.16) : 1;
    for (const index of [earth, 8, 7, 6, 0, 5, 4, 2, 1]) {
      const label = labels[index],
        point = positions[index];
      const offset = labelOffsets[index];
      const y = point.y + offset;
      const halfWidth = (labelSizes[index].width / 2 + 3) * widthInScene;
      const halfHeight = (labelSizes[index].height / 2 + 2) * widthInScene;
      const edge = Math.min(
        point.x - halfWidth,
        viewport.width - point.x - halfWidth,
        y - halfHeight,
        viewport.height - y - halfHeight,
      );
      const visible = !inspecting && point.depth > 0.1 && edge > 0;
      let opacity = visible ? smooth(edge / 24) * (index === earth ? 1 : smooth((at - 3.6) / 0.75)) : 0;
      for (const other of occupied) {
        const gapX = Math.abs(point.x - other.x) - halfWidth - other.halfWidth;
        const gapY = Math.abs(y - other.y) - halfHeight - other.halfHeight;
        opacity *= 1 - other.opacity * (1 - smooth((Math.max(gapX, gapY) + 4) / 18));
      }
      if (opacity > 0.001) {
        occupied.push({ x: point.x, y, halfWidth, halfHeight, opacity });
        label.style.left = (point.x / viewport.width) * 100 + '%';
        label.style.top = (y / viewport.height) * 100 + '%';
      }
      labelOpacity[index] += (opacity - labelOpacity[index]) * labelBlend;
      label.style.opacity = labelOpacity[index];
    }
    if (outerBeat) {
      const radii = [6, 7, 8].map((index) => Math.hypot(...objects[index].position) * track.metresPerAU);
      get('.solar-gaps').textContent = `${Math.round(radii[1] - radii[0])} m · ${Math.round(radii[2] - radii[1])} m`;
    } else get('.solar-gaps').textContent = '';
    sunLighting.disabled = !layer || inspecting;
    layer?.draw(view.camera, objects, shadows.checked, { ...view, sunLighting: sunLighting.checked && !inspecting });
    seek.value = at;
    dateRange.value = day;
    const date = calendar(day);
    const dateText = dateFormat.format(date);
    dateValue.textContent = userDay === undefined ? dateText : dateText + ' · ' + timeFormat.format(date);
    dateRange.setAttribute('aria-valuetext', dateText + ' ' + timeFormat.format(date) + ' TDB');
    step.disabled = day >= endDay;
    clock.textContent = `0:${String(Math.floor(at)).padStart(2, '0')} / 0:32`;
    heading.querySelector('strong').textContent = inspecting
      ? bodies[userView].name
      : outerBeat
        ? 'The outer gaps'
        : '';
    heading.querySelector('small').textContent = inspecting
      ? formatSize(actualDiameter(bodies[userView], track.metresPerAU)) + ' across'
      : '';
    wideButton.setAttribute('aria-pressed', String(!inspecting));
    const chapter = chapters.findLastIndex(({ time }) => time <= at);
    if (chapter !== previousChapter) {
      previousChapter = chapter;
      chapterButtons.forEach((button, i) => button.setAttribute('aria-current', String(i === chapter)));
    }
    detail.hidden = selected < 0;
    if (selected >= 0) {
      const body = bodies[selected];
      const current = objects[selected];
      const r = Math.hypot(...current.position);
      const spinHours = (24 * 360) / Math.abs(ephemeris.bodies[selected].spinDegPerDay);
      const spin = `${spinHours >= 48 ? (spinHours / 24).toFixed(1) + ' days' : spinHours.toFixed(1) + ' hours'}`;
      const direction = ephemeris.bodies[selected].spinDegPerDay < 0 ? ' · retrograde' : '';
      const report = `${body.name} · ${r.toFixed(2)} AU from the Sun · ${formatSize(actualDiameter(body, track.metresPerAU))} across at one scale · spin: ${spin}${direction}.`;
      if (detail.textContent !== report) detail.textContent = report;
    }
  }

  function cancelFrame() {
    if (frame !== null) video.cancelVideoFrameCallback(frame);
    frame = null;
  }
  function tick(_, presented) {
    frame = null;
    if (!video.seeking) {
      hasPresentedFrame = true;
      draw(presented.mediaTime, true);
    }
    if (!video.paused) frame = video.requestVideoFrameCallback(tick);
  }
  function sync(event) {
    cancelFrame();
    playState(play, video.paused);
    if (video.readyState >= 2 && !video.seeking) {
      const time = event?.type === 'pause' && hasPresentedFrame ? at : video.currentTime;
      draw(time);
    }
    if (!video.paused && video.requestVideoFrameCallback) frame = video.requestVideoFrameCallback(tick);
  }
  function jump(time) {
    userDay = userView = undefined;
    selected = -1;
    bodyButtons.forEach((b) => b.setAttribute('aria-pressed', 'false'));
    video.pause();
    if (Math.abs(video.currentTime - time) < 0.001) draw(at);
    else video.currentTime = time;
  }

  for (const event of ['play', 'pause', 'seeked', 'ended']) video.addEventListener(event, sync, options);
  video.addEventListener(
    'loadeddata',
    () => {
      play.disabled = seek.disabled = false;
      chapterButtons.forEach((button) => {
        button.disabled = false;
      });
      sync();
    },
    options,
  );
  video.addEventListener(
    'seeking',
    () => {
      hasPresentedFrame = false;
    },
    options,
  );
  video.addEventListener(
    'timeupdate',
    () => {
      if (!video.requestVideoFrameCallback && !video.seeking) draw(video.currentTime);
    },
    options,
  );
  video.addEventListener('error', () => tell('The field footage could not be loaded.'), options);
  play.addEventListener(
    'click',
    () => {
      if (!video.paused) video.pause();
      else {
        userDay = userView = undefined;
        selected = -1;
        bodyButtons.forEach((b) => b.setAttribute('aria-pressed', 'false'));
        if (video.ended || video.currentTime >= runtime - 0.05) video.currentTime = 0;
        void video.play().catch(() => tell('The field footage could not play.'));
      }
    },
    options,
  );
  seek.addEventListener('input', () => jump(Number(seek.value)), options);
  chapterButtons.forEach((button) =>
    button.addEventListener('click', () => jump(Number(button.dataset.time)), options),
  );
  dateRange.addEventListener(
    'input',
    () => {
      video.pause();
      userDay = Number(dateRange.value);
      draw(at);
    },
    options,
  );
  step.addEventListener(
    'click',
    () => {
      video.pause();
      userDay = Math.min(endDay, day + 0.25);
      draw(at);
    },
    options,
  );
  shadows.addEventListener('change', () => draw(at), options);
  sunLighting.addEventListener('change', () => draw(at), options);
  compare.addEventListener(
    'click',
    () => {
      sizeChart.hidden = !sizeChart.hidden;
      compare.setAttribute('aria-expanded', String(!sizeChart.hidden));
      if (!sizeChart.hidden) drawDiameterChart(sizeChart.querySelector('canvas'));
    },
    options,
  );
  wideButton.addEventListener(
    'click',
    () => {
      video.pause();
      userView = -1;
      selected = -1;
      bodyButtons.forEach((b) => b.setAttribute('aria-pressed', 'false'));
      draw(at);
    },
    options,
  );
  bodyButtons.forEach((button, i) =>
    button.addEventListener(
      'click',
      () => {
        video.pause();
        selected = selected === i ? -1 : i;
        userView = selected;
        bodyButtons.forEach((b, j) => b.setAttribute('aria-pressed', String(j === selected)));
        draw(at);
      },
      options,
    ),
  );
  get('.solar-gl').addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      layer = null;
      shadows.disabled = true;
      tell('The 3D view was interrupted. The orbits and date controls are still available.');
      draw(at);
    },
    options,
  );
  video.src = asset('.webm').href;
  const atlas = new Image();
  atlas.src = asset('-maps.webp').href;
  void atlas
    .decode()
    .then(() => {
      if (disposed) return;
      if (atlas.naturalWidth !== 1536 || atlas.naturalHeight !== 768) throw Error('Unexpected planet map dimensions');
      layer = makePlanetLayer(glCanvas, atlas);
      if (!layer) throw Error('WebGL 2 unavailable');
      draw(at);
    })
    .catch(() => {
      if (disposed) return;
      userView = -1;
      shadows.disabled = true;
      tell('The 3D models could not load. You can still explore the orbits and date controls.');
      draw(at);
    });
  draw(0);
  return () => {
    disposed = true;
    listeners.abort();
    resize.disconnect();
    cancelFrame();
    video.pause();
    video.removeAttribute('src');
    video.load();
    layer?.dispose();
  };
}
