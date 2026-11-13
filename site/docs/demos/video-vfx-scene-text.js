import { projectPoint } from '../../runtime/src/spatial/index.js';
import { surfaceTransform } from '../../runtime/src/vfx/index.js';
import { css } from './_kit.js';
import { playState, shotControls } from './video-vfx-controls.js';
import { cameraFor } from './video-vfx-world.js';

const shots = [
  {
    asset: 'video-vfx-reading-room',
    label: 'Reading room',
    width: 360,
    height: 640,
    count: 124,
    creator: 'Julio Lopez',
    source: 'https://www.pexels.com/video/historic-library-with-arched-ceilings-and-bookshelves-29592157/',
    cues: [
      ['The missing page', 'Last seen in the east stacks.', 0],
      ['Shelf 17', 'The ledger is out of order.', 1.0],
    ],
  },
  {
    asset: 'video-vfx-stone-alley',
    label: 'Stone alley',
    width: 640,
    height: 338,
    count: 100,
    creator: '8 K Lover of aerials and photography',
    source: 'https://www.pexels.com/video/a-narrow-alley-with-a-person-walking-down-it-3723640/',
    cues: [['The gate was open', 'Check the stonework.', 0]],
  },
];

const fps = 25;
const cueWidth = 400;
const cueHeight = 110;
const finite = (values, length) => Array.isArray(values) && values.length === length && values.every(Number.isFinite);
const quad = (values, dimension) =>
  Array.isArray(values) && values.length === 4 && values.every((p) => finite(p, dimension));
const asset = (shot, extension) => new URL('./' + shot.asset + '.' + extension, import.meta.url);

async function loadTrack(shot, signal) {
  const response = await fetch(asset(shot, 'json'), { signal });
  if (!response.ok) throw Error('Could not load the text track.');
  const { width, height, frames, intrinsics, planes, quads } = await response.json();
  if (width !== shot.width || height !== shot.height) throw Error('The shot dimensions do not match the track.');
  if (Array.isArray(quads) && quads.length === shot.count && quads.every((value) => quad(value, 2))) {
    return (i) => [quads[i].map(([x, y]) => ({ x, y }))];
  }
  if (
    !finite([intrinsics?.fx, intrinsics?.fy, intrinsics?.cx, intrinsics?.cy], 4) ||
    !Array.isArray(frames) ||
    frames.length !== shot.count ||
    !frames.every((frame) => finite(frame?.rotation, 9) && finite(frame?.translation, 3)) ||
    !Array.isArray(planes) ||
    planes.length !== shot.cues.length ||
    !planes.every((value) => quad(value, 3))
  )
    throw Error('The spatial text track is invalid.');
  const cameras = frames.map((frame) => cameraFor(frame, intrinsics, { width, height }));
  return (i) =>
    planes.map((plane) =>
      plane.map(([x, y, z]) => {
        const p = projectPoint(cameras[i], { x, y, z });
        return { x: p.x + intrinsics.cx - width / 2, y: p.y + intrinsics.cy - height / 2, depth: p.cameraDepth };
      }),
    );
}

export default async function sceneText(stage) {
  shotControls();
  css(
    'vfx-scene-text',
    `
.vfx-scene-text { width:min(100%, 650px); margin-inline:auto; }
.vfx-scene-text[data-portrait] { width:min(100%, 390px); }
.vfx-scene-text .vfx-shot { aspect-ratio:var(--shot-ratio); overflow:clip; }
.vfx-scene-text .vfx-shot video { opacity:0; }
.vfx-scene-text .vfx-shot .vfx-clue {
  box-sizing:border-box; display:flex; flex-direction:column; justify-content:center; align-items:flex-start;
  position:absolute; left:0; top:0; width:${cueWidth}px; height:${cueHeight}px; padding:0 0 0 13px;
  transform-origin:0 0; border:0; border-left:4px solid currentColor; border-radius:0; text-align:left;
  background:transparent; color:hsl(43 68% 91%); text-shadow:0 1px 5px hsl(26 32% 7% / .95);
}
.vfx-scene-text .vfx-shot .vfx-clue:hover,.vfx-scene-text .vfx-shot .vfx-clue:focus-visible { background:transparent; color:white; }
.vfx-scene-text .vfx-clue strong { color:inherit; font:700 47px/.95 var(--sans); letter-spacing:.025em; text-transform:uppercase; }
.vfx-clue span { margin-top:5px; font:500 23px/1.15 var(--sans); }
.vfx-clue[aria-pressed="false"] span { visibility:hidden; }
.vfx-scene-text .vfx-credit { min-height:1.5em; }
`,
  );
  stage.innerHTML = `
    <div class="vfx-demo vfx-scene-text">
      <div class="vfx-tabs" role="group" aria-label="Footage">
        ${shots.map(({ label }, i) => `<button type="button" aria-pressed="${i === 0}">${label}</button>`).join('')}
      </div>
      <div class="vfx-shot">
        <video muted playsinline preload="auto"></video>
        <canvas class="vfx-composite" aria-hidden="true"></canvas>
        <div class="vfx-clues"></div>
      </div>
      <div class="vfx-timeline">
        <button class="vfx-play" type="button" aria-label="Play" title="Play" disabled></button>
        <input type="range" min="0" step="0.04" value="0" aria-label="Footage time" disabled>
        <output aria-label="Time">0.00 s</output>
      </div>
      <div class="vfx-status" role="status" hidden></div>
      <div class="vfx-credit"></div>
    </div>`;
  const get = (selector) => stage.querySelector(selector);
  const demo = get('.vfx-scene-text');
  const scene = get('.vfx-shot');
  const video = get('video');
  const picture = get('canvas');
  const context = picture.getContext('2d');
  const play = get('.vfx-play');
  const timeline = get('input');
  const clock = get('output');
  const status = get('.vfx-status');
  const credit = get('.vfx-credit');
  const clues = get('.vfx-clues');
  const tabs = stage.querySelectorAll('.vfx-tabs button');
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  let shot = shots[0],
    project,
    cueButtons = [],
    pending = null,
    load,
    frame = 0;

  function note(message) {
    status.textContent = message;
    status.hidden = !message;
  }

  function paintClues() {
    if (!project) return;
    const sx = scene.clientWidth / shot.width;
    const sy = scene.clientHeight / shot.height;
    if (!sx || !sy) return;
    project(frame).forEach((corners, i) => {
      const cue = cueButtons[i];
      cue.hidden = frame / fps < shot.cues[i][2] || corners.some(({ depth }) => depth <= 0.01);
      if (cue.hidden) return;
      const surface = corners.map(({ x, y }) => ({ x: x * sx, y: y * sy }));
      const [a, b, c, d, e, f, g, h] = surfaceTransform(surface, cueWidth, cueHeight);
      cue.style.transform = `matrix3d(${a},${d},0,${g},${b},${e},0,${h},0,0,1,0,${c},${f},0,1)`;
    });
  }

  function draw(mediaTime) {
    if (!project || video.seeking || video.readyState < 2) return;
    frame = Math.max(0, Math.min(shot.count - 1, Math.floor(mediaTime * fps + 1e-4)));
    timeline.value = frame / fps;
    clock.textContent = (frame / fps).toFixed(2) + ' s';
    context.drawImage(video, 0, 0, shot.width, shot.height);
    paintClues();
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
    if (video.paused || !video.requestVideoFrameCallback) draw(video.currentTime);
    else pending = video.requestVideoFrameCallback(tick);
  }

  async function select(index) {
    load?.abort();
    const request = new AbortController();
    load = request;
    project = null;
    video.pause();
    stopFrame();
    shot = shots[index];
    tabs.forEach((tab, i) => tab.setAttribute('aria-pressed', String(i === index)));
    demo.toggleAttribute('data-portrait', shot.height > shot.width);
    scene.style.setProperty('--shot-ratio', shot.width + ' / ' + shot.height);
    picture.width = shot.width;
    picture.height = shot.height;
    video.setAttribute('aria-label', shot.label + ' footage');
    timeline.max = (shot.count - 1) / fps;
    timeline.value = 0;
    clock.textContent = '0.00 s';
    play.disabled = timeline.disabled = true;
    clues.replaceChildren();
    credit.innerHTML = `Footage by <a href="${shot.source}">${shot.creator}</a> under the <a href="https://www.pexels.com/license/">Pexels license</a>.`;
    note('');
    try {
      const track = await loadTrack(shot, request.signal);
      if (request.signal.aborted) return;
      project = track;
      clues.innerHTML = shot.cues
        .map(
          ([label, detail]) =>
            `<button type="button" class="vfx-clue" aria-label="${label}, reveal clue" aria-pressed="false" hidden><strong>${label}</strong><span>${detail}</span></button>`,
        )
        .join('');
      cueButtons = [...clues.querySelectorAll('button')];
      video.src = asset(shot, 'webm').href;
    } catch (error) {
      if (!request.signal.aborted) note(error.message);
    }
  }

  const resize = new ResizeObserver(paintClues);
  resize.observe(scene);
  for (const event of ['play', 'pause', 'ended', 'seeked']) video.addEventListener(event, sync, options);
  video.addEventListener(
    'loadeddata',
    () => {
      if (!project) return;
      play.disabled = timeline.disabled = false;
      sync();
    },
    options,
  );
  video.addEventListener('error', () => note('Could not load the footage.'), options);
  if (!video.requestVideoFrameCallback) video.addEventListener('timeupdate', () => draw(video.currentTime), options);
  tabs.forEach((tab, i) => tab.addEventListener('click', () => void select(i), options));
  clues.addEventListener(
    'click',
    (event) => {
      const cue = event.target.closest('button');
      if (!cue) return;
      video.pause();
      const revealed = cue.getAttribute('aria-pressed') === 'true';
      cue.setAttribute('aria-pressed', String(!revealed));
      const [label, detail] = shot.cues[cueButtons.indexOf(cue)];
      cue.setAttribute('aria-label', revealed ? label + ', reveal clue' : label + '. ' + detail);
    },
    options,
  );
  play.addEventListener(
    'click',
    () => {
      if (!video.paused) return video.pause();
      if (video.ended) video.currentTime = 0;
      void video.play().catch(() => note('Could not play the footage.'));
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
  await select(0);
  return () => {
    load?.abort();
    listeners.abort();
    resize.disconnect();
    stopFrame();
    video.pause();
    video.removeAttribute('src');
    video.load();
  };
}
