import { scene } from '../../runtime/src/core/index.js';
import { hsla, toHex, toRGBA } from '../../runtime/src/color/index.js';
import { createCanvasRenderer } from '../../runtime/src/renderers/canvas.js';
import { createSVGRenderer } from '../../runtime/src/renderers/svg.js';
import { compileTrack, sampleTrack, surfaceTransform } from '../../runtime/src/vfx/index.js';
import { css, clipSource } from './_kit.js';
import { playState, shotControls } from './video-vfx-controls.js';
import { phoneCard } from './video-vfx-phone.js';

const width = 640,
  height = 360,
  signWidth = 270,
  signHeight = 95;
const phonePlane = { width: 110, height: 240 };
const messageBox = { x: 126, y: 57, width: 200, height: 52 };
const color = (h, s, l, a = 1) => toHex(hsla(h, s, l, a));
const cream = color(43, 54, 95);
const gold = color(35, 82, 72);
const ink = color(214, 18, 14);

const SHOTS = {
  wall: {
    file: 'video-vfx-wall.webm',
    label: 'A shadow walks past a brick wall',
    description:
      'The lettering follows the brick face as the camera moves. Its ink darkens the wall without covering the mortar or the passing shadow.',
    author: 'cami',
    source: 'https://www.pexels.com/video/silhouette-stroll-along-brick-wall-in-urban-setting-35765822/',
  },
  object: {
    file: 'video-vfx-presentation.webm',
    label: 'A presenter holds a microphone',
    description: 'The dot follows the microphone. The leader moves with it while the words stay upright.',
    author: 'Pavel Danilyuk',
    source: 'https://www.pexels.com/video/a-woman-talking-while-holding-a-microphone-8716580/',
  },
  message: {
    file: 'video-vfx-message.webm',
    label: 'Hands type a message on a phone at night',
    description:
      'The message sits beside the phone’s upper right corner and tilts with the glass. The thumb matte keeps the card on the screen behind the hand.',
    author: 'MART PRODUCTION',
    source: 'https://www.pexels.com/video/a-person-using-a-smartphone-7277940/',
  },
};
const MESSAGES = [
  { at: 1.24, next: 3.2, sender: 'INCOMING', text: 'Use the east door.', card: 'EAST EXIT' },
  { at: 3.2, next: 5, sender: 'REPLY', text: 'I’m on my way.', card: 'ON MY WAY' },
];

function envelope(t, start, end) {
  const u = Math.min(1, Math.max(0, Math.min((t - start) / 0.17, (end - t) / 0.16)));
  return u * u * (3 - 2 * u);
}

function planeTransform(surface, planeWidth, planeHeight, scale) {
  const [a, b, c, d, e, f, g, h] = surfaceTransform(surface, planeWidth, planeHeight);
  return `matrix3d(${[a * scale, d * scale, 0, g, b * scale, e * scale, 0, h, 0, 0, 1, 0, c * scale, f * scale, 0, 1].join(',')})`;
}

function paintWall(context, video, surface, texture) {
  context.drawImage(video, 0, 0, width, height);
  if (!surface) return;
  const x = Math.max(0, Math.floor(Math.min(...surface.map((p) => p.x))));
  const y = Math.max(0, Math.floor(Math.min(...surface.map((p) => p.y))));
  const w = Math.min(width, Math.ceil(Math.max(...surface.map((p) => p.x)))) - x;
  const h = Math.min(height, Math.ceil(Math.max(...surface.map((p) => p.y)))) - y;
  if (w <= 0 || h <= 0) return;
  const [a, b, c, d, e, f, g, k] = surfaceTransform(surface, signWidth, signHeight);
  const pixels = context.getImageData(x, y, w, h);
  const alpha = (px, py) =>
    px >= 0 && px < signWidth && py >= 0 && py < signHeight ? texture[(py * signWidth + px) * 4 + 3] / 255 : 0;
  for (let row = 0; row < h; row++) {
    const py = y + row + 0.5;
    for (let column = 0; column < w; column++) {
      const px = x + column + 0.5;
      const aa = a - g * px,
        bb = b - k * px,
        dd = d - g * py,
        ee = e - k * py;
      const determinant = aa * ee - bb * dd;
      if (Math.abs(determinant) < 1e-8) continue;
      const sx = ((px - c) * ee - (py - f) * bb) / determinant - 0.5;
      const sy = ((py - f) * aa - (px - c) * dd) / determinant - 0.5;
      const u = Math.floor(sx),
        v = Math.floor(sy);
      const dx = sx - u,
        dy = sy - v;
      const coverage =
        (1 - dy) * ((1 - dx) * alpha(u, v) + dx * alpha(u + 1, v)) +
        dy * ((1 - dx) * alpha(u, v + 1) + dx * alpha(u + 1, v + 1));
      const i = (row * w + column) * 4;
      for (let channel = 0; channel < 3; channel++) {
        pixels.data[i + channel] *= 1 - coverage * (1 - wallInk[channel]);
      }
    }
  }
  context.putImageData(pixels, x, y);
}

const wallPaint = hsla(211, 34, 28, 0.88);
const wallInk = toRGBA(wallPaint);

export default async function anchorsDemo(stage) {
  shotControls();
  css(
    'vfx-anchor-shots',
    `
    .vfx-anchor-tabs { justify-self:start; }
    .vfx-plane-art { position:absolute; top:0; left:0; transform-origin:0 0; pointer-events:none; }
    .vfx-cues { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .vfx-cues label { display:flex; align-items:center; gap:5px; font:13px var(--sans); color:var(--muted); }
    .vfx-cues button { font-weight:500; }
    .vfx-anchor-live { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
    @media(max-width:440px) {
      .vfx-demo .vfx-anchor-tabs button { padding-inline:8px; font-size:12px; }
    }
  `,
  );
  const response = await fetch(new URL('./video-vfx-anchors.json', import.meta.url));
  if (!response.ok) throw Error('The shot tracks could not be loaded.');
  const tracks = await response.json();
  const wallTrack = compileTrack(tracks.wall),
    objectTrack = compileTrack(tracks.object),
    phoneTrack = compileTrack(tracks.phone);
  stage.innerHTML = `
    <div class="vfx-demo">
      <div class="vfx-tabs vfx-anchor-tabs" role="group" aria-label="Text studies">
        <button type="button" data-case="wall" aria-pressed="true">Wall lettering</button>
        <button type="button" data-case="object" aria-pressed="false">Object clue</button>
        <button type="button" data-case="message" aria-pressed="false">Message cues</button>
      </div>
      <div class="vfx-shot">
        <video playsinline muted preload="auto"></video>
        <canvas class="vfx-composite" width="640" height="360" aria-hidden="true" hidden></canvas>
        <canvas class="vfx-composite vfx-wall-picture" width="640" height="360" aria-hidden="true" hidden></canvas>
        <div class="vfx-plane-art vfx-message-plane" aria-hidden="true" hidden></div>
        <div class="vfx-scene" aria-hidden="true"></div>
      </div>
      <div class="vfx-timeline">
        <button type="button" class="vfx-play" aria-label="Play" title="Play" disabled></button>
        <input type="range" min="0" max="5" step="0.04" value="0" aria-label="Study clip time" disabled>
        <output aria-label="Time">0.00 s</output>
      </div>
      <div class="vfx-cues" hidden>
        <button type="button" data-cue="1.44">Incoming · 1.24 s</button>
        <button type="button" data-cue="3.40">Reply · 3.20 s</button>
        <label><input type="checkbox" class="vfx-show-glass"> Show screen track</label>
        <label><input type="checkbox" class="vfx-hand-matte" checked> Thumb matte</label>
      </div>
      <div class="vfx-explanation"></div>
      <div class="vfx-credit">Footage by <a></a>.</div>
      <div class="vfx-status" role="status" hidden></div>
      <span class="vfx-anchor-live" aria-live="polite"></span>
    </div>`;
  const get = (selector) => stage.querySelector(selector);
  const shot = get('.vfx-shot'),
    video = get('video'),
    play = get('.vfx-play'),
    timeline = get('input[type=range]'),
    showGlass = get('.vfx-show-glass'),
    handMatte = get('.vfx-hand-matte');
  const glassCanvas = get('canvas');
  const card = phoneCard(glassCanvas);
  const wallLayer = get('.vfx-wall-picture'),
    wallContext = wallLayer.getContext('2d', { alpha: false, willReadFrequently: true }),
    messageLayer = get('.vfx-message-plane'),
    overlay = get('.vfx-scene'),
    clock = get('output');
  const description = get('.vfx-explanation'),
    credit = get('.vfx-credit a'),
    cues = get('.vfx-cues');
  const status = get('.vfx-status'),
    announce = get('.vfx-anchor-live');
  const selectors = [...stage.querySelectorAll('[data-case]')];
  const wall = scene({ width: signWidth, height: signHeight, label: 'Wayfinding lettering on the brick surface' });
  const wallRenderer = createCanvasRenderer(document.createElement('div'), { points: 'cpu' });
  const paint = toHex(wallPaint);
  wall.text({ x: 7, y: 61, text: 'EAST DOOR', fontSize: 36, fontWeight: 800, fill: paint });
  wall.path({
    commands: [
      ['M', 221, 45],
      ['L', 258, 45],
      ['M', 245, 31],
      ['L', 259, 45],
      ['L', 245, 58],
    ],
    stroke: paint,
    strokeWidth: 4,
    fill: 'none',
  });
  wallRenderer.render(wall.sample({ time: 0 }));
  const wallTexture = wallRenderer.element.getContext('2d').getImageData(0, 0, signWidth, signHeight).data;

  const message = scene({ width: messageBox.width, height: messageBox.height, label: 'A message beside the phone' });
  const messageRenderer = createSVGRenderer(messageLayer);
  messageLayer.style.width = `${messageBox.width}px`;
  messageLayer.style.height = `${messageBox.height}px`;
  const sender = message.text({ x: 0, y: 13, text: '', fontSize: 12, fontWeight: 800, fill: gold });
  const words = message.text({ x: 0, y: 37, text: '', fontSize: 22, fontWeight: 650, fill: cream });

  const drawing = scene({ width, height, duration: 5, label: 'A microphone callout and phone screen outline' });
  const renderer = createSVGRenderer(overlay);
  const clue = drawing.group({ opacity: 0 });
  const line = clue.path({
    commands: [
      ['M', 0, 0],
      ['L', 1, 1],
    ],
    stroke: cream,
    strokeWidth: 1.25,
    fill: 'none',
  });
  const dot = clue.circle({ r: 4.6, fill: gold, stroke: ink, strokeWidth: 1.1 });
  const clueText = clue.text({ text: 'Microphone', fontSize: 22, fontWeight: 700, fill: ink });
  const clueDetail = clue.text({ text: 'Sound becomes a signal', fontSize: 12, fill: ink });
  const marker = [
    ['M', 0, 0],
    ['L', 1, 1],
  ];
  const glassGuide = drawing.path({
    commands: marker,
    opacity: 0,
    stroke: gold,
    strokeWidth: 1.25,
    strokeDasharray: [5, 4],
    fill: 'none',
  });

  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  let mode = 'wall',
    request = null,
    time = 0,
    available = false,
    lastCue = '';

  const limit = () => (mode === 'object' ? objectTrack.samples.at(-1).time : Math.min(5, video.duration));
  function draw(at) {
    if (!available || video.seeking) return;
    const requested = Math.max(0, Math.min(limit(), at));
    time = mode === 'wall' ? Math.floor(requested * 25 + 1e-4) / 25 : requested;
    const scale = shot.clientWidth / width;
    const surface = mode === 'wall' ? sampleTrack(wallTrack, Math.min(wallTrack.samples.at(-1).time, time)) : null;
    wallLayer.hidden = mode !== 'wall';
    if (mode === 'wall') {
      paintWall(wallContext, video, surface, wallTexture);
      timeline.value = time;
      clock.textContent = time.toFixed(2) + ' s';
      return;
    }

    const point = mode === 'object' ? sampleTrack(objectTrack, Math.min(objectTrack.samples.at(-1).time, time)) : null;
    clue.set({ opacity: point ? 1 : 0 });
    if (point) {
      const x = point.x + 82,
        y = point.y - 96;
      dot.set(point);
      line.set({
        commands: [
          ['M', point.x, point.y],
          ['L', x - 9, y + 16],
          ['L', x + 117, y + 16],
        ],
      });
      clueText.set({ x, y });
      clueDetail.set({ x, y: y + 33 });
    }
    const glass = mode === 'message' ? sampleTrack(phoneTrack, Math.min(phoneTrack.samples.at(-1).time, time)) : null;
    glassGuide.set({ opacity: glass && showGlass.checked ? 1 : 0 });
    if (glass && showGlass.checked) {
      glassGuide.set({
        commands: [['M', glass[0].x, glass[0].y], ...glass.slice(1).map(({ x, y }) => ['L', x, y]), ['Z']],
      });
    }
    const cue = glass ? MESSAGES.find(({ at, next }) => time >= at && time < next) : null;
    const opacity = cue ? envelope(time, cue.at, cue.next) : 0;
    glassCanvas.hidden = messageLayer.hidden = !opacity;
    if (opacity) card.draw(video, glass, opacity, handMatte.checked, cue.card);
    if (cue) {
      if (cue.text !== lastCue) {
        sender.set({ text: cue.sender });
        words.set({ text: cue.text });
        messageRenderer.render(message.sample({ time: 0 }));
      }
      // Apply the offset in the phone plane before projecting the whole message.
      messageLayer.style.transform = `${planeTransform(glass, phonePlane.width, phonePlane.height, scale)} translate(${messageBox.x}px, ${messageBox.y}px)`;
      messageLayer.style.opacity = String(opacity);
    }
    const nextCue = cue?.text ?? '';
    if (nextCue !== lastCue) announce.textContent = lastCue = nextCue;
    overlay.hidden = mode === 'wall';
    if (!overlay.hidden) renderer.render(drawing.sample({ time }));
    timeline.value = time;
    clock.textContent = time.toFixed(2) + ' s';
  }

  function tick(_, metadata) {
    request = null;
    if (video.paused || !available) return;
    draw(metadata.mediaTime);
    if (metadata.mediaTime >= limit()) {
      video.pause();
      return;
    }
    request = video.requestVideoFrameCallback(tick);
  }
  function cancelFrame() {
    if (request !== null) video.cancelVideoFrameCallback(request);
    request = null;
  }
  function synchronize(event) {
    if (!video.paused && !video.requestVideoFrameCallback && available && video.currentTime >= limit()) video.pause();
    if (video.paused) cancelFrame();
    else if (video.requestVideoFrameCallback && request === null) request = video.requestVideoFrameCallback(tick);
    if (!video.requestVideoFrameCallback || (video.paused && (mode !== 'wall' || event?.type === 'seeked'))) {
      draw(video.currentTime);
    }
    playState(play, video.paused);
  }
  function load(next) {
    mode = next;
    available = false;
    time = 0;
    lastCue = '';
    announce.textContent = '';
    cancelFrame();
    video.pause();
    timeline.value = 0;
    clock.textContent = '0.00 s';
    play.disabled = timeline.disabled = true;
    status.hidden = true;
    cues.hidden = next !== 'message';
    overlay.hidden = wallLayer.hidden = glassCanvas.hidden = messageLayer.hidden = true;
    for (const button of selectors) button.setAttribute('aria-pressed', String(button.dataset.case === next));
    description.textContent = SHOTS[next].description;
    credit.textContent = SHOTS[next].author;
    credit.href = SHOTS[next].source;
    video.setAttribute('aria-label', SHOTS[next].label);
    video.src = clipSource(new URL(SHOTS[next].file, import.meta.url).href);
  }
  function seek(value) {
    if (!available) return;
    video.pause();
    video.currentTime = value;
  }
  for (const event of ['play', 'pause', 'seeked', 'timeupdate', 'ended'])
    video.addEventListener(event, synchronize, options);
  video.addEventListener(
    'loadeddata',
    () => {
      if (video.currentSrc !== new URL(SHOTS[mode].file, import.meta.url).href) return;
      available = true;
      timeline.max = String(limit());
      play.disabled = timeline.disabled = false;
      draw(0);
    },
    options,
  );
  video.addEventListener(
    'error',
    () => {
      status.hidden = false;
      status.textContent = 'The selected footage could not be loaded.';
    },
    options,
  );
  play.addEventListener(
    'click',
    () => {
      if (!video.paused) video.pause();
      else {
        if (video.ended || video.currentTime >= limit()) seek(0);
        void video.play().catch(() => {
          status.hidden = false;
          status.textContent = 'The video could not start.';
        });
      }
    },
    options,
  );
  showGlass.addEventListener('change', () => draw(time), options);
  handMatte.addEventListener('change', () => draw(time), options);
  timeline.addEventListener('input', () => seek(Number(timeline.value)), options);
  for (const button of selectors)
    button.addEventListener(
      'click',
      () => {
        if (button.dataset.case !== mode) load(button.dataset.case);
      },
      options,
    );
  for (const button of cues.querySelectorAll('button'))
    button.addEventListener('click', () => seek(Number(button.dataset.cue)), options);
  const resize = new ResizeObserver(() => {
    if (mode !== 'wall') draw(time);
  });
  resize.observe(shot);
  load('wall');
  return () => {
    listeners.abort();
    resize.disconnect();
    cancelFrame();
    video.pause();
    video.removeAttribute('src');
    video.load();
    renderer.dispose();
    wallRenderer.dispose();
    messageRenderer.dispose();
    card.dispose();
  };
}
