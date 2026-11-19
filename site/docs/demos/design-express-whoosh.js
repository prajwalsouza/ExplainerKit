import {createSoundtrack, cueForMotion} from '../../runtime/src/sound/index.js';
import {audition} from './design-audition.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

const move = {at: .55, duration: .83};
const duration = 2.4;
const score = createSoundtrack([
  cueForMotion('whoosh', move, {options: {weight: .5, seed: 6}}),
  cueForMotion('impact', move, {options: {intensity: .5}}),
]);

export default function expressWhoosh(stage, ctx) {
  const time = {name: 'the parcel replay clock', x: 70, y: 229, axis: 'x', minX: 70, maxX: 450};
  const stop = dragStudy(stage, ctx, {height: 251, handles: [time], draw(g, {dark, ink}) {
    const t = duration * (time.x - time.minX) / (time.maxX - time.minX);
    const k = Math.max(0, Math.min(1, (t - move.at) / move.duration));
    const x = 93 + k * 302;
    const y = 119 - 54 * Math.sin(k * Math.PI);
    g.fillStyle = paintColor(33, 61, dark ? 67 : 58);
    g.fillRect(x - 34, y - 25, 68, 52);
    g.fillStyle = paintColor(38, 79, dark ? 83 : 78);
    g.fillRect(x - 5, y - 25, 10, 52);
    label(g, '✦', x, y, paintColor(20, 42, 23), 17);
    const rail = seconds => 70 + (380 * seconds / duration);
    g.fillStyle = paintColor(170, 40, dark ? 63 : 41, .45);
    g.fillRect(rail(move.at), 193, rail(move.at + move.duration) - rail(move.at), 5);
    label(g, 'Whoosh', rail(move.at + move.duration / 2), 175, ink, 15);
    disc(g, rail(move.at + move.duration), 195, 5, ink);
    label(g, 'Impact', rail(move.at + move.duration) + 42, 195, ink, 15);
    g.fillStyle = paintColor(170, 28, dark ? 67 : 43, .35);
    g.fillRect(time.minX, time.y - 2, time.maxX - time.minX, 4);
    disc(g, time.x, time.y, 11, ink);
    return `${t.toFixed(2)} s. The cue uses the parcel’s motion start and duration. The impact is anchored to arrival.`;
  }});
  const stopAudio = audition(stage, 'Hear the delivery', () => score.render({duration}));
  return () => { stopAudio(); stop(); };
}
