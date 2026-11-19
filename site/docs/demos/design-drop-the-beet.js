import {analyzeMusic, musicGrid} from '../../runtime/src/music/index.js';
import {encodeWav} from '../../runtime/src/sound/mix.js';
import {css} from './_kit.js';
import {pulseTape} from './design-audio-reel.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

const CSS = `
.ek-beet-play { display: block; margin: .25em auto .8em; color: var(--ink); border: 1px solid var(--line); border-radius: 999px; background: var(--panel); padding: .4em 1em; font: inherit; font-size: .875rem; cursor: pointer; }
`;
const duration = 8;
const cues = Array.from({length: 16}, (_, index) => [.25 + index * .5, index % 4 ? 710 : 420, .045]);

function beet(g, x, y, color, leaves) {
  disc(g, x, y, 13, color);
  g.fillStyle = leaves;
  g.beginPath();
  g.ellipse(x - 4, y - 13, 4, 9, -.6, 0, 2 * Math.PI);
  g.ellipse(x + 5, y - 14, 4, 9, .55, 0, 2 * Math.PI);
  g.fill();
}

export default function dropTheBeet(stage, ctx) {
  css('design-drop-the-beet', CSS);
  const pcm = pulseTape(duration, cues);
  const analysis = analyzeMusic(pcm, {tempoHint: 120, chords: false, beatsPerBar: 4});
  const grid = musicGrid(analysis);
  const marker = {name: 'beet along the recording', x: 164, y: 148, axis: 'x', minX: 44, maxX: 477};
  const position = time => marker.minX + (marker.maxX - marker.minX) * time / duration;
  const disposeStudy = dragStudy(stage, ctx, {height: 231, handles: [marker], draw(g, {dark, ink}) {
    const time = duration * (marker.x - marker.minX) / (marker.maxX - marker.minX);
    const [hit] = grid.pin([{id: 'beet', at: time, snap: 'beat'}]);
    const snapped = position(hit.time);
    const vegetable = paintColor(338, 57, dark ? 65 : 45);
    const leaf = paintColor(134, 40, dark ? 64 : 37);
    const line = paintColor(342, 24, dark ? 67 : 46, .52);
    const round = paintColor(343, 21, dark ? 23 : 90);
    g.fillStyle = round;
    g.beginPath();
    g.roundRect(25, 30, 470, 78, 8);
    g.fill();
    for (const {time: beatTime, position: subdivision} of analysis.beats) {
      const x = position(beatTime);
      g.strokeStyle = subdivision === 0 ? ink : line;
      g.lineWidth = subdivision === 0 ? 2 : 1;
      g.beginPath();
      g.moveTo(x, 41);
      g.lineTo(x, 97);
      g.stroke();
    }
    g.strokeStyle = vegetable;
    g.lineWidth = 1.3;
    g.setLineDash([3, 3]);
    g.beginPath();
    g.moveTo(marker.x, marker.y - 10);
    g.lineTo(snapped, 71);
    g.stroke();
    g.setLineDash([]);
    disc(g, snapped, 71, 7, vegetable);
    g.strokeStyle = line;
    g.beginPath();
    g.moveTo(marker.minX, marker.y);
    g.lineTo(marker.maxX, marker.y);
    g.stroke();
    beet(g, marker.x, marker.y, vegetable, leaf);
    label(g, `${time.toFixed(2)} s → ${hit.time.toFixed(2)} s`, 261, 187, ink, 20);
    return `The analyser estimated ${Math.round(analysis.tempo.bpm)} beats per minute. At ${time.toFixed(2)} seconds the cue snaps to ${hit.time.toFixed(2)} seconds.`;
  }});

  const audio = document.createElement('audio');
  const url = URL.createObjectURL(new Blob([encodeWav(pcm)], {type: 'audio/wav'}));
  audio.src = url;
  const button = document.createElement('button');
  button.className = 'ek-beet-play';
  button.type = 'button';
  button.textContent = 'Hear the click track';
  stage.querySelector('.ek-study').append(button);
  const events = new AbortController();
  const options = {signal: events.signal};
  const sync = () => { button.textContent = audio.paused ? 'Hear the click track' : 'Pause the click track'; };
  audio.addEventListener('play', sync, options);
  audio.addEventListener('pause', sync, options);
  audio.addEventListener('ended', sync, options);
  button.addEventListener('click', () => {
    if (audio.paused) audio.play().catch(() => { button.textContent = 'Retry click track'; });
    else audio.pause();
  }, options);
  return () => {
    events.abort(); disposeStudy(); audio.pause(); audio.removeAttribute('src'); audio.load(); URL.revokeObjectURL(url);
  };
}
