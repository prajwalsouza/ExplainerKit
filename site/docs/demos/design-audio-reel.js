import {scene} from '../../runtime/src/core/index.js';
import {css} from './_kit.js';
import {paintColor} from './design-stage.js';

const CSS = `
.ek-reel { border: 1px solid var(--line); border-radius: 16px; background: var(--panel); overflow: hidden; }
.ek-reel-screen { background: var(--screen); }
.ek-reel-screen svg { display: block; width: 100%; height: auto; }
.ek-reel-control { display: grid; grid-template-columns: max-content minmax(0,1fr); gap: .6rem .9rem; align-items: center; padding: .75rem clamp(10px,3cqw,22px) .25rem; }
.ek-reel-control button { border: 1px solid var(--line); border-radius: 999px; background: var(--screen); color: var(--ink); padding: .35em .75em; min-height: 38px; cursor: pointer; font: inherit; font-size: .875rem; }
.ek-reel-control input { display: block; width: 100%; accent-color: var(--needle); min-height: 30px; margin: 0; }
.ek-reel-times { grid-column: 1 / -1; font: .825rem var(--mono,monospace); color: var(--ink); }
.ek-reel [role=status] { color: var(--ink); margin: 0; padding: 0 clamp(10px,3cqw,22px) .85rem; font-size: .875rem; }
`;

export function pulseTape(duration, cues) {
  const sampleRate = 16000;
  const samples = new Float32Array(Math.round(sampleRate * duration));
  for (const [at, frequency, length, slide = 0] of cues) {
    const start = Math.round(at * sampleRate);
    const count = Math.min(samples.length - start, Math.round(length * sampleRate));
    for (let index = 0; index < count; index++) {
      const t = index / sampleRate;
      const envelope = Math.min(1, t * 100) * Math.min(1, (length - t) * 60) * Math.exp(-3 * t / length);
      const phase = 2 * Math.PI * (frequency * t + slide * t * t / (2 * length));
      samples[start + index] += .36 * envelope * (.8 * Math.sin(phase) + .2 * Math.sin(2 * phase));
    }
  }
  return {sampleRate, channels: [samples]};
}

export async function mountAudioReel(stage, ctx, {title, duration, build, attach, note}) {
  css('design-audio-reel', CSS);
  stage.innerHTML = '<div class="ek-reel"><div class="ek-reel-screen"></div><div class="ek-reel-control"><button type="button" data-reel-play>Play</button><input type="range" min="0" value="0" step="0.01" aria-label="Seek the tape"><output class="ek-reel-times" aria-live="off"></output></div><p role="status"></p></div>';
  const card = stage.querySelector('.ek-reel');
  const status = card.querySelector('[role=status]');
  const button = card.querySelector('[data-reel-play]');
  const control = card.querySelector('input');
  const readout = card.querySelector('output');
  control.max = String(duration);
  const drawing = scene({width: 520, height: 204, duration, label: title});
  build(drawing);
  const player = await drawing.mount(card.querySelector('.ek-reel-screen'), {controls: false});
  let audio;
  try { audio = attach(player); }
  catch (error) { player.dispose(); throw error; }
  const {adapter, media, offset = 0, release = () => {}} = audio;
  const events = new AbortController();
  const on = {signal: events.signal};

  function sync() {
    button.textContent = media.paused ? 'Play' : 'Pause';
    const audioTime = Math.max(0, media.currentTime - offset);
    control.value = String(Math.min(duration, audioTime));
    readout.textContent = `Audio ${audioTime.toFixed(2)} s · Picture ${player.time.toFixed(2)} s`;
  }
  button.addEventListener('click', () => {
    status.textContent = note;
    if (!media.paused) { adapter.pause(); return; }
    if (media.currentTime >= duration + offset - .03) adapter.seek(0);
    adapter.play().catch(() => { status.textContent = 'The browser could not start audio. Press Play to try again.'; sync(); });
  }, on);
  control.addEventListener('input', () => { adapter.seek(Number(control.value)); sync(); }, on);
  for (const event of ['play', 'pause', 'ended', 'timeupdate', 'loadedmetadata', 'seeked']) media.addEventListener(event, sync, on);
  const offFrame = player.on('frame', sync);
  const theme = () => {
    card.style.setProperty('--screen', paintColor(35, 29, ctx.dark() ? 23 : 92));
    card.style.setProperty('--needle', paintColor(20, 55, ctx.dark() ? 68 : 44));
  };
  const offTheme = ctx.onTheme(theme);
  theme();
  status.textContent = note;
  sync();
  return () => {
    events.abort(); offFrame(); offTheme();
    adapter.dispose(); release(); player.dispose();
  };
}
