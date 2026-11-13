import { scene } from '../../runtime/src/core/index.js';
import { hsla, toHex } from '../../runtime/src/color/index.js';
import { createSVGRenderer } from '../../runtime/src/renderers/svg.js';
import { projectSurface, sampleTrack, surfaceTransform } from '../../runtime/src/vfx/index.js';
import { autoTrackScreen, trackSurface } from './video-vfx-auto.js';
import { css, clipSource } from './_kit.js';
import { playState, shotControls } from './video-vfx-controls.js';

const clips = [
  {
    title: 'Presentation screen',
    file: 'video-vfx-presentation.webm',
    findScreenOnLoad: true,
    credit: 'Pavel Danilyuk',
    source: 'https://www.pexels.com/video/a-woman-talking-while-holding-a-microphone-8716580/',
  },
  {
    title: 'Laptop outdoors',
    file: 'video-vfx-laptop.webm',
    findScreenOnLoad: true,
    credit: 'Ron Lach',
    source: 'https://www.pexels.com/video/a-person-using-a-laptop-7873070/',
  },
  {
    title: 'Phone at an angle',
    file: 'video-vfx-message.webm',
    surface: 'phone',
    region: [{ x:152, y:96 }, { x:241, y:47 }, { x:334, y:152 }, { x:239, y:208 }],
    credit: 'MART PRODUCTION',
    source: 'https://www.pexels.com/video/a-person-using-a-smartphone-7277940/',
  },
  {
    title: 'Brick and moving shadow',
    file: 'video-vfx-wall.webm',
    surface: 'wall',
    region: { x:154, y:42, width:342, height:274 },
    credit: 'cami',
    source: 'https://www.pexels.com/video/silhouette-stroll-along-brick-wall-in-urban-setting-35765822/',
  },
  {
    title: 'Interview',
    file: 'video-vfx-interview.webm',
    credit: 'NASA Goddard Space Flight Center',
    source: 'https://svs.gsfc.nasa.gov/14349/',
  },
];

export default async function autoStudy(stage) {
  shotControls();
  css('vfx-motion-toggle', `
    .vfx-motion-toggle { display:flex; align-items:center; gap:5px; font:13px var(--sans); color:var(--muted); }
    .vfx-demo button.vfx-corner-picker { position:absolute; inset:0; width:100%; border:0; border-radius:0; background:transparent; cursor:crosshair; }
    .vfx-demo button.vfx-corner-picker:focus-visible { outline-offset:-4px; }
  `);
  const [response, trackResponse] = await Promise.all([
    fetch(new URL('./video-vfx-motion.json', import.meta.url)),
    fetch(new URL('./video-vfx-anchors.json', import.meta.url)),
  ]);
  if (!response.ok || !trackResponse.ok) throw Error('The footage examples could not be loaded.');
  const motion = await response.json();
  const presets = await trackResponse.json();
  stage.innerHTML = `
    <div class="vfx-demo">
      <div class="vfx-actions">
        <select aria-label="Footage">${clips.map(({ title }, i) => `<option value="${i}">${title}</option>`).join('')}</select>
        <button type="button" class="vfx-auto" disabled>Find and track screen</button>
        <button type="button" class="vfx-track-surface" disabled>Track surface</button>
        <button type="button" class="vfx-mark-surface" disabled>Mark surface</button>
        <label class="vfx-motion-toggle"><input type="checkbox"> Show motion regions</label>
      </div>
      <div class="vfx-shot">
        <video muted playsinline preload="auto"></video>
        <div class="vfx-scene" aria-hidden="true" hidden></div>
        <button type="button" class="vfx-corner-picker" aria-label="Set surface corner. Use the arrow keys to move the crosshair and Enter to mark a point." hidden></button>
      </div>
      <div class="vfx-timeline">
        <button class="vfx-play" type="button" aria-label="Play" title="Play" disabled></button>
        <input type="range" min="0" max="4.96" step="0.04" value="0" aria-label="Auto study clip time" disabled>
        <output aria-label="Time">0.00 s</output>
      </div>
      <div class="vfx-status" role="status" hidden></div>
      <div class="vfx-credit">Footage by <a></a>.</div>
    </div>`;
  const get = (selector) => stage.querySelector(selector);
  const video = get('video'),
    choice = get('select'),
    play = get('.vfx-play'),
    analyze = get('.vfx-auto'),
    follow = get('.vfx-track-surface'),
    mark = get('.vfx-mark-surface'),
    picker = get('.vfx-corner-picker'),
    shot = get('.vfx-shot'),
    time = get('input[type=range]'),
    showMotion = get('input[type=checkbox]'),
    clock = get('output'),
    status = get('.vfx-status'),
    overlay = get('.vfx-scene'),
    credit = get('a');

  const model = scene({ width: 640, height: 360, duration: 5, label: 'Tracked surface and motion regions' });
  const renderer = createSVGRenderer(overlay);
  const cyan = toHex(hsla(199, 98, 75));
  const contrast = toHex(hsla(219, 52, 18));
  const backing = model.path({
    commands: [['M', 0, 0], ['L', 1, 1]], fill: 'none', stroke: contrast, strokeWidth: 4.5,
  });
  const outline = model.path({
    commands: [['M', 0, 0], ['L', 1, 1]], fill: 'none', stroke: cyan, strokeWidth: 2.5, strokeDasharray: [6, 4],
  });
  const point = model.circle({ r: 4, fill: cyan, stroke: contrast, strokeWidth: 1.5 });
  const crosshair = model.path({ commands: [['M', 0, 0], ['L', 1, 1]], fill: 'none', stroke: cyan, strokeWidth: 2 });
  const amber = toHex(hsla(42, 85, 72));
  const motionGuide = model.path({
    commands: [['M', 0, 0], ['L', 1, 1]], fill: 'none', stroke: amber, strokeWidth: 2,
  });
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  let job = null,
    track = null,
    url = '',
    regions = [],
    seed = null,
    marking = null,
    cursor = { x: 320, y: 180 },
    ready = false,
    frameRequest = null;

  function update(mediaTime = video.currentTime) {
    if (video.seeking || video.readyState < 2) return;
    const at = Math.min(mediaTime, Number(time.max));
    time.value = at;
    clock.textContent = at.toFixed(2) + ' s';
    playState(play, video.paused);
    const quad = track ? sampleTrack(track, Math.min(at, track.samples.at(-1).time)) : at < .02 ? seed?.surface : null;
    const corners = marking ?? quad;
    const visibleMotion = showMotion.checked ? regions.flatMap(({ samples }) => {
      const nearest = samples.find(({ time }) => Math.abs(time - at) <= 0.25);
      if (!nearest) return [];
      const { x, y, width, height } = nearest.box;
      const l = x * 4, t = y * 4, r = (x + width) * 4, b = (y + height) * 4;
      return [['M', l, t], ['L', r, t], ['L', r, b], ['L', l, b], ['Z']];
    }) : [];
    motionGuide.set(visibleMotion.length ? { commands: visibleMotion, opacity: 1 } : { opacity: 0 });
    const outlineVisible = corners?.length >= 2;
    outline.set({ opacity: outlineVisible ? 1 : 0 });
    backing.set({ opacity: outlineVisible ? 1 : 0 });
    point.set({ opacity: quad && !marking ? 1 : 0 });
    crosshair.set({ opacity: marking ? 1 : 0 });
    overlay.hidden = !quad && !marking && !visibleMotion.length;
    if (outlineVisible) {
      const commands = [['M', corners[0].x, corners[0].y], ...corners.slice(1).map(({ x, y }) => ['L', x, y]), ...(marking ? [] : [['Z']])];
      backing.set({ commands });
      outline.set({ commands });
    }
    if (quad && !marking) point.set(projectSurface(quad, 0.5, 0.5));
    if (marking) {
      const { x, y } = cursor;
      crosshair.set({ commands: [['M', x - 6, y], ['L', x + 6, y], ['M', x, y - 6], ['L', x, y + 6]] });
    }
    if (!overlay.hidden) renderer.render(model.sample({ time: at }));
  }

  function controls() {
    analyze.disabled = !ready || Boolean(job || marking);
    follow.disabled = !ready || !seed || Boolean(job || marking);
    mark.disabled = !ready || Boolean(job);
    play.disabled = time.disabled = !ready || Boolean(marking);
    picker.hidden = !marking;
    mark.textContent = marking ? 'Cancel marking' : 'Mark surface';
  }

  function load() {
    job?.abort();
    job = track = null;
    ready = false;
    marking = null;
    status.hidden = overlay.hidden = true;
    const clip = clips[Number(choice.value)];
    seed = clip.surface ? { surface: presets[clip.surface].samples[0].value, region: clip.region } : null;
    regions = motion[clip.file] ?? [];
    video.pause();
    url = new URL(clip.file, import.meta.url).href;
    video.src = clipSource(url);
    video.setAttribute('aria-label', clip.title);
    controls();
    time.value = 0;
    clock.textContent = '0.00 s';
    credit.textContent = clip.credit;
    credit.href = clip.source;
  }

  choice.addEventListener('change', load, options);
  showMotion.addEventListener('change', () => update(), options);
  async function runTracking(findScreen) {
    video.pause();
    const current = new AbortController();
    job = current;
    controls();
    status.hidden = false;
    status.textContent = findScreen ? 'Looking for a screen…' : 'Tracking the marked surface…';
    try {
      const progress = (done, total) => {
        if (job === current) status.textContent = 'Tracking ' + done + ' of ' + total + ' sampled frames…';
      };
      const result = await (findScreen ? autoTrackScreen(url, current.signal, progress) : trackSurface(url, seed, current.signal, progress));
      if (job !== current) return;
      track = result.track;
      status.textContent = (findScreen && track ? 'Blue outline shows the tracked screen. ' : '') + result.message;
      update();
    } catch {
      if (job === current) status.textContent = 'Tracking could not finish.';
    } finally {
      if (job === current) {
        job = null;
        controls();
      }
    }
  }
  analyze.addEventListener('click', () => void runTracking(true), options);
  follow.addEventListener('click', () => void runTracking(false), options);
  const cornerNames = ['top left', 'top right', 'bottom right', 'bottom left'];
  mark.addEventListener('click', () => {
    if (marking) {
      marking = null;
      status.hidden = true;
    } else {
      video.pause();
      if (video.currentTime !== 0) video.currentTime = 0;
      marking = [];
      cursor = { x: 320, y: 180 };
      status.hidden = false;
      status.textContent = 'Mark the top left corner of the surface.';
    }
    controls();
    if (marking) picker.focus();
    update();
  }, options);
  picker.addEventListener('keydown', (event) => {
    const directions = { ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1] };
    if (!Object.hasOwn(directions, event.key)) return;
    const move = directions[event.key];
    event.preventDefault();
    const step = event.shiftKey ? 16 : 4;
    cursor = { x: Math.max(0, Math.min(640, cursor.x + step * move[0])), y: Math.max(0, Math.min(360, cursor.y + step * move[1])) };
    update();
  }, options);
  picker.addEventListener('click', (event) => {
    if (!marking || video.seeking) return;
    if (event.detail) {
      const bounds = shot.getBoundingClientRect();
      cursor = { x: (event.clientX - bounds.left) * 640 / bounds.width, y: (event.clientY - bounds.top) * 360 / bounds.height };
    }
    marking.push(cursor);
    if (marking.length < 4) {
      status.textContent = 'Mark the ' + cornerNames[marking.length] + ' corner.';
    } else {
      try {
        surfaceTransform(marking);
        seed = { surface: marking };
        track = null;
        marking = null;
        status.textContent = 'Surface marked. Choose Track surface.';
        controls();
        follow.focus();
      } catch {
        marking = [];
        status.textContent = 'Choose four corners around the surface. Start at the top left.';
      }
    }
    update();
  }, options);
  play.addEventListener('click', () => {
    if (video.paused) void video.play().catch(() => {
      status.hidden = false;
      status.textContent = 'The video could not start.';
    });
    else video.pause();
  }, options);
  time.addEventListener('input', () => {
    video.pause();
    video.currentTime = Number(time.value);
  }, options);
  function synchronize() {
    if (frameRequest !== null) video.cancelVideoFrameCallback(frameRequest);
    frameRequest = null;
    update();
    if (!video.paused && video.requestVideoFrameCallback) frameRequest = video.requestVideoFrameCallback(tick);
  }
  function tick(_, { mediaTime }) {
    frameRequest = null;
    update(mediaTime);
    if (!video.paused) frameRequest = video.requestVideoFrameCallback(tick);
  }
  for (const event of ['play', 'pause', 'seeked', 'ended']) video.addEventListener(event, synchronize, options);
  video.addEventListener('timeupdate', () => {
    if (video.paused || !video.requestVideoFrameCallback) update();
  }, options);
  video.addEventListener('loadeddata', () => {
    if (ready) return;
    ready = true;
    controls();
    time.max = Math.min(4.96, video.duration);
    update();
    if (clips[Number(choice.value)].findScreenOnLoad) void runTracking(true);
  }, options);
  load();
  return () => {
    job?.abort();
    job = null;
    listeners.abort();
    if (frameRequest !== null) video.cancelVideoFrameCallback(frameRequest);
    video.pause();
    video.removeAttribute('src');
    video.load();
    renderer.dispose();
  };
}
