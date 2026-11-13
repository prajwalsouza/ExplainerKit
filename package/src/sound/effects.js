import { assert, number, options } from '../core/validate.js';
import { allocate, result, sampleRate, rng, scalePeak, fades, processSound } from './pcm.js';

export const SOUND_EFFECT_KINDS = Object.freeze([
  'whoosh',
  'swipe',
  'impact',
  'tick',
  'click',
  'pop',
  'reveal',
  'riser',
  'reverse',
  'stinger',
  'shimmer',
]);
/** First-party layered noise, transient and damped-modal motion cues; offline and seeded. */
export function soundEffect(kind, spec = {}) {
  assert(SOUND_EFFECT_KINDS.includes(kind), 'SOUND_KIND', 'Use a documented semantic sound kind.');
  options(
    spec,
    ['duration', 'sampleRate', 'seed', 'intensity', 'brightness', 'weight', 'pan', 'reverb', 'pitch'],
    'sound effect',
  );
  const defaults = {
    whoosh: 0.65,
    swipe: 0.24,
    impact: 0.7,
    tick: 0.07,
    click: 0.045,
    pop: 0.18,
    reveal: 0.8,
    riser: 1.6,
    reverse: 0.8,
    stinger: 1.1,
    shimmer: 1.4,
  };
  const duration = number(spec.duration ?? defaults[kind], 'sound duration', 0.015, 8),
    rate = sampleRate(spec.sampleRate),
    intensity = number(spec.intensity ?? 0.7, 'sound intensity', 0, 1),
    brightness = number(spec.brightness ?? 0.55, 'sound brightness', 0, 1),
    weight = number(spec.weight ?? 0.5, 'sound weight', 0, 1),
    pan = number(spec.pan ?? 0, 'sound pan', -1, 1),
    space = number(spec.reverb ?? (['shimmer', 'reveal', 'stinger'].includes(kind) ? 0.15 : 0), 'sound reverb', 0, 0.6),
    pitch = number(spec.pitch ?? 0, 'sound pitch semitones', -24, 24);
  const channels = allocate(Math.max(2, Math.round(duration * rate))),
    random = rng(spec.seed ?? 1),
    ratio = 2 ** (pitch / 12),
    base =
      kind === 'tick' ? 1100 + brightness * 1000 : kind === 'click' ? 450 + brightness * 800 : 90 + (1 - weight) * 300;
  let low = 0,
    band = 0,
    phase = 0,
    ring = 0;
  const airy = ['whoosh', 'swipe', 'riser', 'reverse'].includes(kind),
    bright = ['reveal', 'shimmer', 'stinger'].includes(kind),
    short = ['click', 'tick', 'pop'].includes(kind);
  const modes = bright
    ? [1, 2, 3.01, 4.12, 5.43, 7.07]
    : kind === 'impact'
      ? [1, 1.47, 2.09, 2.56, 3.43, 4.17, 5.4]
      : [1, 2.72, 5.4, 8.93];
  for (let i = 0; i < channels[0].length; i++) {
    const t = i / rate,
      u = i / (channels[0].length - 1),
      noise = random() * 2 - 1;
    const center = Math.min(
        rate * 0.42,
        (airy ? 180 + (500 + brightness * 8500) * Math.sin(Math.PI * u) ** 1.4 : 700 + brightness * 7000) * ratio,
      ),
      alpha = 1 - Math.exp((-2 * Math.PI * center) / rate);
    low += alpha * (noise - low);
    band += Math.min(0.95, alpha * 0.4) * (low - band);
    const filtered = low - band;
    const swell =
      kind === 'riser'
        ? u ** 2.1 * (1 - u) ** 0.15
        : kind === 'reverse'
          ? (1 - u) ** 2.1 * u ** 0.15
          : Math.sin(Math.PI * u) ** (kind === 'swipe' ? 0.65 : 1.5);
    let value = airy ? filtered * swell * 1.1 : filtered * Math.exp(-t / (short ? 0.006 : 0.025)) * 0.4;
    const attack = 1 - Math.exp(-t / (short ? 0.0008 : 0.003));
    for (let m = 0; m < modes.length; m++) {
      const frequency = (bright ? 430 : base) * modes[m] * (1 + 0.002 * m * Math.sin(t * 3)) * ratio;
      if (frequency > rate * 0.43) continue;
      const decay = short
        ? (0.018 + 0.03 * weight) / (1 + m * 0.35)
        : bright
          ? (duration * (0.25 + 0.4 * weight)) / (1 + m * 0.12)
          : (0.12 + 0.45 * weight) / (1 + m * 0.3);
      const amplitude = (airy ? 0.045 : bright ? 0.22 : 0.36) / (1 + m * 0.7);
      const offset = kind === 'shimmer' ? m * 0.035 : kind === 'reveal' ? m * 0.012 : 0;
      const elapsed = Math.max(0, t - offset);
      if (t >= offset)
        value += amplitude * Math.sin(2 * Math.PI * frequency * elapsed) * Math.exp(-elapsed / decay) * attack;
    }
    if (kind === 'pop')
      value +=
        0.5 *
        Math.sin(2 * Math.PI * (150 * t + 180 * 0.025 * (1 - Math.exp(-t / 0.025))) * ratio) *
        Math.exp(-t / 0.055) *
        attack;
    if (kind === 'impact')
      value += 0.45 * Math.sin(2 * Math.PI * base * 0.45 * ratio * t) * Math.exp(-t / 0.15) * attack;
    if (kind === 'riser') {
      phase += (2 * Math.PI * Math.min(rate * 0.4, 80 * ratio * 2 ** (u * (2 + brightness * 2)))) / rate;
      ring = 0.98 * ring + 0.02 * Math.sin(phase);
      value += ring * u ** 2 * 0.1;
    }
    const position = Math.max(-1, Math.min(1, pan + (airy ? 0.6 * Math.sin((u - 0.5) * Math.PI) : 0))),
      left = Math.cos(((position + 1) * Math.PI) / 4),
      right = Math.sin(((position + 1) * Math.PI) / 4);
    channels[0][i] = value * left;
    channels[1][i] = value * right;
  }
  if (kind === 'reverse') for (const channel of channels) channel.reverse();
  scalePeak(channels, 0.86 * intensity);
  fades(channels, rate, 0.002, Math.min(0.05, duration * 0.15));
  let output = result(channels, rate, {
    kind,
    source: 'original-layered-dsp',
    seed: spec.seed ?? 1,
    quality: 'audition-required',
  });
  if (space) {
    output = processSound(output, [
      { type: 'reverb', seconds: Math.min(0.8, duration), tail: 0, mix: space, seed: spec.seed ?? 1 },
    ]);
    fades(output.channels, rate, 0.002, 0.035);
  }
  return result(
    output.channels.map((c) => c.slice()),
    rate,
    { kind, source: 'original-layered-dsp', seed: spec.seed ?? 1, quality: 'audition-required' },
  );
}
