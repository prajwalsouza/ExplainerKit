import {createAudioMix} from '../../runtime/src/sound/mix.js';
import {audition} from './design-audition.js';
import {disc, dragStudy, label, paintColor, polygon} from './design-stage.js';

const sampleRate = 8000;
const tau = Math.PI * 2;
const music = Float32Array.from({length: 3 * sampleRate}, (_, i) => {
  const t = i / sampleRate;
  const notes = [196, 247, 294, 247];
  const pulse = .055 + .095 * Math.exp(-8 * ((t * 4) % 1));
  return pulse * Math.sin(t * tau * notes[Math.floor(t * 4) % notes.length]);
});
const quack = Float32Array.from({length: Math.round(.38 * sampleRate)}, (_, i) => {
  const t = i / sampleRate;
  return .35 * Math.sin(Math.PI * t / .38) * (Math.sin(tau * (260 * t - 90 * t * t)) + .38 * Math.sin(750 * t * tau));
});

export default function duckingDuck(stage, ctx) {
  const duck = {name: 'the duck’s narration cue', x: 235, y: 90, axis: 'x', minX: 100, maxX: 423};
  let mix, voiceOnly, lastCue;
  const stop = dragStudy(stage, ctx, {height: 259, handles: [duck], draw(g, {dark, ink}) {
    const start = Math.round((duck.x - 56) * 300 / 408) / 100;
    if (lastCue !== start) {
      const voice = {id: 'quack', role: 'narration', channels: [quack], sampleRate, start};
      voiceOnly = createAudioMix([voice]);
      mix = createAudioMix([{id: 'music', role: 'music', sampleRate, channels: [music]}, voice],
        {duckGain: .2, attack: .20, release: .30, threshold: .03});
      lastCue = start;
    }
    const wing = paintColor(43, 88, dark ? 71 : 58);
    disc(g, duck.x - 11, duck.y + 9, 20, wing);
    disc(g, duck.x + 4, duck.y - 8, 16, wing);
    polygon(g, [{x: duck.x + 15, y: duck.y - 12}, {x: duck.x + 33, y: duck.y - 5}, {x: duck.x + 15, y: duck.y - 1}], paintColor(20, 73, 55));
    disc(g, duck.x + 8, duck.y - 12, 2.8, ink);
    label(g, 'Music under the cue', 260, 147, ink, 17);
    g.strokeStyle = paintColor(201, 50, dark ? 75 : 37);
    g.lineWidth = 1.85;
    for (let i = 0; i < 93; i++) {
      const t = i * 3 / 93;
      let peak = 0;
      for (let n = 0; n < 20; n++) {
        const at = t + n / sampleRate;
        peak = Math.max(peak, Math.abs(mix.sample(at)[0] - voiceOnly.sample(at)[0]));
      }
      const x = 56 + i * 408 / 93;
      g.beginPath();
      g.moveTo(x, 200 - 185 * peak);
      g.lineTo(x, 200 + 185 * peak);
      g.stroke();
    }
    return `The quack starts at ${start.toFixed(2)} s. During the active narration, music gain falls to 20%.`;
  }});
  const stopAudio = audition(stage, 'Hear the mix', () => mix.render({sampleRate, duration: 3}));
  return () => { stopAudio(); stop(); };
}
