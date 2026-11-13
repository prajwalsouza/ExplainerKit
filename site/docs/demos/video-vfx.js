import { scene } from '../../runtime/src/core/index.js';
import { hsla, toHex } from '../../runtime/src/color/index.js';
import { createCanvasRenderer } from '../../runtime/src/renderers/canvas.js';
import { createSVGRenderer } from '../../runtime/src/renderers/svg.js';
import { analyzeFrame, compileTrack, sampleTrack, surfaceTransform } from '../../runtime/src/vfx/index.js';
import { playState, shotControls } from './video-vfx-controls.js';
import { createShotComposite, loadMatteImage } from './video-vfx-composite.js';
import { autoTrackScreen } from './video-vfx-auto.js';
import { clipSource } from './_kit.js';

const width = 640,
  height = 360;
const color = (h, s, l, a = 1) => toHex(hsla(h, s, l, a));
const outline = (points, closed = true) => {
  const commands = points.map(({ x, y }, i) => [i ? 'L' : 'M', x, y]);
  if (closed) commands.push(['Z']);
  return commands;
};
const initial = [['M', 0, 0], ['L', 1, 0], ['L', 0, 1], ['Z']];
const accent = color(174, 61, 76);
const dark = color(211, 34, 16);
const petalColors = [
  color(326, 69, 62), color(349, 83, 66), color(14, 95, 70), color(33, 97, 72),
  color(47, 94, 77), color(19, 89, 69), color(352, 83, 68), color(326, 72, 68),
  color(294, 62, 66), color(269, 65, 70), color(306, 66, 68),
];
const turn = 2 * Math.PI;
const ease = (value) => {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
};

function projector(corners) {
  const [a, b, c, d, e, f, g, h] = surfaceTransform(corners);
  return (u, v) => {
    const w = g * u + h * v + 1;
    return { x: (a * u + b * v + c) / w, y: (d * u + e * v + f) / w };
  };
}

function soundBloom(slide) {
  const panel = slide.path({ commands: initial, fill: color(275, 39, 16) });
  const orbit = slide.path({
    commands: initial, fill: 'none', stroke: color(295, 37, 62, 0.34), strokeWidth: 0.9,
  });
  const petals = petalColors.map((fill) => ({
    ribbon: slide.path({ commands: initial, fill }),
    vein: slide.path({
      commands: initial, fill: 'none', stroke: color(47, 100, 93, 0.55), strokeWidth: 1, strokeLinecap: 'round',
    }),
  }));
  const wave = slide.path({
    commands: initial, fill: 'none', stroke: color(49, 99, 84), strokeWidth: 2.5, strokeLinecap: 'round',
  });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  return (surface, time) => {
    const p = projector(surface);
    const polar = (angle, radius) => p(0.69 + 0.71 * Math.cos(angle) * radius, 0.55 + Math.sin(angle) * radius);
    const at = reduced.matches ? 3.36 : time;
    const curl = ease((at - 0.12) / 1.55);
    const open = ease((at - 0.56) / 2.48);
    const tilt = -0.18 + 0.31 * open;
    panel.set({ commands: outline(surface) });
    orbit.set({ commands: outline(Array.from({ length: 72 }, (_, i) => polar(turn * i / 72, 0.374))), opacity: open });
    for (const [i, { ribbon, vein }] of petals.entries()) {
      const growth = ease((at - 0.68 - 0.055 * i) / 1.76);
      const length = (0.285 + 0.052 * Math.sin(i * 2.37 + 0.4)) * growth;
      const base = tilt + turn * i / petals.length;
      const petal = (t, side) => polar(
        base + 0.55 * (1 - t) ** 1.45 + side * 0.34 * Math.sin(Math.PI * t) ** 0.8,
        0.039 + t * length,
      );
      const edge = Array.from({ length: 17 }, (_, j) => petal(j / 16, 1));
      for (let j = 15; j > 0; j--) edge.push(petal(j / 16, -1));
      ribbon.set({ commands: outline(edge), opacity: growth });
      vein.set({
        commands: outline(Array.from({ length: 12 }, (_, j) => petal(0.11 + j * 0.065, 0.14)), false),
        opacity: growth,
      });
    }
    const signal = Array.from({ length: 101 }, (_, i) => {
      const t = i / 100;
      const pulse = Math.sin(t * turn * 7 + (1 - curl) * at * 8) * Math.sin(Math.PI * t) ** 1.5;
      const radius = 0.094 + 0.026 * pulse;
      const angle = turn * t + tilt;
      const u = 0.45 + t * 0.48;
      const v = 0.55 + pulse * 0.115;
      return p(
        u + (0.69 + 0.71 * Math.cos(angle) * radius - u) * curl,
        v + (0.55 + Math.sin(angle) * radius - v) * curl,
      );
    });
    wave.set({ commands: outline(signal, false) });
  };
}
export default async function presentationDemo(stage) {
  shotControls();
  const [response, alphaAtlas, cleanScreen, anchorResponse] = await Promise.all([
    fetch(new URL('./video-vfx-tracks.json', import.meta.url)),
    loadMatteImage('./video-vfx-alpha.png'),
    loadMatteImage('./video-vfx-clean-screen.png'),
    fetch(new URL('./video-vfx-anchors.json', import.meta.url)),
  ]);
  if (!response.ok || !anchorResponse.ok) throw Error('The VFX tracks could not be loaded.');
  const data = await response.json();
  const plane = compileTrack(data.plane),
    matte = compileTrack(data.matte),
    region = compileTrack(data.region);
  const microphone = compileTrack((await anchorResponse.json()).object);
  const end = plane.samples.at(-1).time;
  const url = clipSource(new URL('./video-vfx-presentation.webm', import.meta.url).href);
  stage.innerHTML = `
    <div class="vfx-demo">
      <div class="vfx-shot">
        <video playsinline muted preload="auto" aria-label="A speaker holding a microphone in front of a presentation screen"></video>
        <canvas class="vfx-composite" width="640" height="360" aria-hidden="true"></canvas>
        <div class="vfx-scene" aria-hidden="true"></div>
        <button class="vfx-inspect" type="button" aria-expanded="false" hidden>Trace</button>
      </div>
      <div class="vfx-timeline">
        <button class="vfx-play" type="button" aria-label="Play" title="Play" disabled></button>
        <input type="range" min="0" max="4.96" value="0" step="0.04" aria-label="Clip time" disabled>
        <output aria-label="Time">0.00 s</output>
      </div>
      <div class="vfx-tools">
        <div class="vfx-tabs" role="group" aria-label="Composition views">
        <button type="button" data-view="composite" aria-pressed="true">Composite</button>
        <button type="button" data-view="original" aria-pressed="false">Original</button>
        <button type="button" data-view="matte" aria-pressed="false">Matte</button>
        </div>
        <div class="vfx-actions">
          <button type="button" class="vfx-analyze" disabled>Analyze frame</button>
          <button type="button" class="vfx-auto" disabled>Auto-track screen</button>
        </div>
      </div>
      <div class="vfx-edge-controls">
        <label><input class="vfx-layers" type="checkbox"> Microphone label</label>
        <label>Matte source <select class="vfx-source"><option value="refined">Shot refined</option><option value="outline">Outline</option></select></label>
        <label>Feather <input class="vfx-feather" type="range" min="0" max="8" step="1" value="1"><output class="vfx-feather-value">1 px</output></label>
        <label>Shift edge <input class="vfx-shift" type="range" min="-6" max="6" step="1" value="0"><output class="vfx-shift-value">0 px</output></label>
      </div>
      <div class="vfx-auto-status vfx-status" role="status" hidden></div>
      <div class="vfx-detail" hidden>A microphone turns changes in air pressure into an electrical signal. The flower opens around an illustrated waveform. Scrub back to the start to see it before it curls.</div>
      <div class="vfx-frame-status vfx-status" role="status" hidden></div>
    </div>`;
  const get = (selector) => stage.querySelector(selector);
  const video = get('video'),
    play = get('.vfx-play'),
    timeline = get('.vfx-timeline input'),
    clock = get('.vfx-timeline output');
  const inspect = get('.vfx-inspect'),
    detail = get('.vfx-detail'),
    message = get('.vfx-frame-status'),
    analyze = get('.vfx-analyze'),
    auto = get('.vfx-auto'),
    autoStatus = get('.vfx-auto-status'),
    layers = get('.vfx-layers');
  const buttons = [...stage.querySelectorAll('[data-view]')];
  const debugRenderer = createSVGRenderer(get('.vfx-scene'));
  const renderer = createCanvasRenderer(document.createElement('div'), { points: 'cpu' });
  const graphic = renderer.element.getContext('2d');
  const composite = createShotComposite(get('.vfx-composite'), alphaAtlas, cleanScreen);
  const edgeSource = get('.vfx-source'),
    feather = get('.vfx-feather'),
    shift = get('.vfx-shift');
  const drawing = scene({ width, height, duration: 5, label: 'Tracked presentation graphic and foreground matte' });
  const drawBloom = soundBloom(drawing.group({}));
  const debug = scene({ width, height, duration: 5, label: 'Footage analysis' });
  const analysis = debug.group({ opacity: 0 });
  const selectedGuide = debug.path({
    commands: initial, fill: 'none', stroke: accent, strokeWidth: 1.5, strokeDasharray: [6, 4], opacity: 0,
  });
  const badge = debug.group({ opacity: 0 });
  const leader = badge.path({ commands: initial, fill: 'none', stroke: dark, strokeWidth: 1.3 });
  const mark = badge.circle({ r: 4, fill: accent, stroke: dark, strokeWidth: 1.2 });
  const name = badge.text({ text: 'Microphone', fontSize: 17, fontWeight: 700, fill: dark });
  const regionGuide = analysis.path({ commands: initial, fill: 'none', stroke: accent, strokeWidth: 1.3 });
  const featureMarks = Array.from({ length: 30 }, () =>
    analysis.circle({ r: 2.5, fill: accent, stroke: dark, strokeWidth: 1, opacity: 0 }),
  );
  const scratch = document.createElement('canvas');
  scratch.width = width;
  scratch.height = height;
  const pixels = scratch.getContext('2d', { willReadFrequently: true });
  const listeners = new AbortController();
  const opts = { signal: listeners.signal };
  let view = 'composite',
    at = 0,
    request = null,
    inspected = false,
    autoTrack = null;

  function draw(time) {
    at = Math.max(0, Math.min(end, time));
    const surface = sampleTrack(plane, at),
      foreground = sampleTrack(matte, at);
    if (!surface || !foreground || video.readyState < 2 || video.seeking) return;
    const p = projector(surface);
    const automatic = autoTrack ? sampleTrack(autoTrack, Math.min(at, autoTrack.samples.at(-1).time)) : null;
    analysis.set({ opacity: inspected ? 1 : 0 });
    const mic = layers.checked && view === 'composite' ? sampleTrack(microphone, at) : null;
    badge.set({ opacity: mic ? 1 : 0 });
    if (mic) {
      const x = mic.x + 76;
      const y = mic.y - 83;
      mark.set(mic);
      name.set({ x, y });
      leader.set({ commands: [['M', mic.x, mic.y], ['L', x - 10, y + 11], ['L', x + 83, y + 11]] });
    }
    selectedGuide.set({ opacity: automatic && view !== 'matte' ? 1 : 0 });
    if (automatic) selectedGuide.set({ commands: outline(automatic) });
    const showOverlay = inspected || mic || (automatic && view !== 'matte');
    if (showOverlay) debugRenderer.render(debug.sample({ time: at }));
    get('.vfx-scene').hidden = !showOverlay;
    if (view === 'composite') {
      drawBloom(surface, at);
      renderer.render(drawing.sample({ time: at }));
    }
    const coverage = composite.render({
      video,
      graphic,
      foreground,
      surface,
      time: at,
      view,
      settings: { source: edgeSource.value, feather: Number(feather.value), shift: Number(shift.value) },
    });
    const anchor = p(0.56, 0.89);
    inspect.hidden =
      view !== 'composite' ||
      anchor.x < 23 ||
      anchor.x > width - 23 ||
      [-15, 0, 15].some((dx) => {
        const x = Math.floor(anchor.x + dx),
          y = Math.floor(anchor.y);
        return coverage?.alpha[y * coverage.width + x] >= 128;
      });
    inspect.style.left = (100 * anchor.x) / width + '%';
    inspect.style.top = (100 * anchor.y) / height + '%';
    timeline.value = at;
    clock.textContent = at.toFixed(2) + ' s';
  }

  function videoFrame(_, frame) {
    request = null;
    if (video.paused) return;
    draw(frame.mediaTime);
    request = video.requestVideoFrameCallback(videoFrame);
  }
  function sync() {
    if (video.paused || !video.requestVideoFrameCallback) draw(video.currentTime);
    if (!video.paused && video.requestVideoFrameCallback && request === null)
      request = video.requestVideoFrameCallback(videoFrame);
    if (video.paused && request !== null) {
      video.cancelVideoFrameCallback(request);
      request = null;
    }
    playState(play, video.paused);
  }
  function clearAnalysis() {
    inspected = false;
    message.hidden = true;
  }
  for (const event of ['play', 'pause', 'seeked', 'timeupdate', 'ended']) video.addEventListener(event, sync, opts);
  video.addEventListener(
    'loadeddata',
    () => {
      play.disabled = timeline.disabled = analyze.disabled = auto.disabled = false;
      draw(0);
    },
    opts,
  );
  video.addEventListener(
    'error',
    () => {
      message.hidden = false;
      message.textContent = 'This browser could not load the presentation footage.';
    },
    opts,
  );
  play.addEventListener(
    'click',
    () => {
      clearAnalysis();
      if (!video.paused) video.pause();
      else {
        if (video.currentTime >= end) video.currentTime = 0;
        void video.play().catch(() => {
          message.hidden = false;
          message.textContent = 'The video could not start.';
        });
      }
    },
    opts,
  );
  timeline.addEventListener(
    'input',
    () => {
      clearAnalysis();
      video.pause();
      video.currentTime = Number(timeline.value);
    },
    opts,
  );
  for (const button of buttons)
    button.addEventListener(
      'click',
      () => {
        view = button.dataset.view;
        clearAnalysis();
        if (view !== 'composite') {
          detail.hidden = true;
          inspect.setAttribute('aria-expanded', 'false');
        }
        for (const item of buttons) item.setAttribute('aria-pressed', String(item === button));
        draw(at);
      },
      opts,
    );
  for (const control of [edgeSource, feather, shift]) {
    control.addEventListener(
      'input',
      () => {
        get('.vfx-feather-value').textContent = feather.value + ' px';
        get('.vfx-shift-value').textContent = shift.value + ' px';
        draw(at);
      },
      opts,
    );
  }
  inspect.addEventListener(
    'click',
    () => {
      video.pause();
      detail.hidden = !detail.hidden;
      inspect.setAttribute('aria-expanded', String(!detail.hidden));
    },
    opts,
  );
  analyze.addEventListener(
    'click',
    () => {
      video.pause();
      const selected = sampleTrack(region, at);
      if (!selected || !pixels || video.seeking) return;
      pixels.drawImage(video, 0, 0, width, height);
      const result = analyzeFrame(
        { width, height, data: pixels.getImageData(0, 0, width, height).data },
        { region: selected },
      );
      regionGuide.set({ commands: outline(selected) });
      for (const [i, mark] of featureMarks.entries()) {
        const feature = result.features[i];
        mark.set(feature ? { ...feature, opacity: 1 } : { opacity: 0 });
      }
      inspected = true;
      message.hidden = false;
      message.textContent = result.features.length + ' candidate features in the selected region.';
      draw(at);
    },
    opts,
  );
  layers.addEventListener('change', () => draw(at), opts);
  auto.addEventListener('click', async () => {
    video.pause();
    clearAnalysis();
    auto.disabled = true;
    autoStatus.hidden = false;
    autoStatus.textContent = 'Looking for a screen…';
    try {
      const result = await autoTrackScreen(url, listeners.signal, (done, total) => {
        autoStatus.textContent = 'Tracking ' + done + ' of ' + total + ' sampled frames…';
      });
      autoTrack = result.track;
      autoStatus.textContent = result.message + (autoTrack ? '. The outline follows the detected screen.' : '');
      draw(at);
    } catch {
      if (!listeners.signal.aborted) autoStatus.textContent = 'The screen analysis could not finish.';
    } finally {
      if (!listeners.signal.aborted) auto.disabled = false;
    }
  }, opts);
  video.src = url;
  return () => {
    listeners.abort();
    if (request !== null) video.cancelVideoFrameCallback(request);
    video.pause();
    video.removeAttribute('src');
    video.load();
    renderer.dispose();
    debugRenderer.dispose();
  };
}
