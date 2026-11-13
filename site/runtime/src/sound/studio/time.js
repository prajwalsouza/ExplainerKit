import { assert, number, options } from '../../core/validate.js';
import { reverb } from './reverb.js';

const NOTE = /^1\/(1|2|4|8|16|32)([dt]?)$/;

/** Seconds for a delay time given as seconds or as a note value such as `'1/8d'` at a tempo. */
export function noteSeconds(value, tempo, name = 'delay time') {
  if (typeof value === 'number') return number(value, name, 0.0005, 4);
  const match = typeof value === 'string' && NOTE.exec(value);
  assert(match, 'SOUND_TIME', `${name} is seconds or a note value such as 1/4, 1/8d or 1/8t.`);
  assert(typeof tempo === 'number' && tempo >= 20 && tempo <= 400, 'SOUND_TIME', 'Note-value times need a tempo.');
  const beats = (4 / Number(match[1])) * (match[2] === 'd' ? 1.5 : match[2] === 't' ? 2 / 3 : 1);
  return number((beats * 60) / tempo, name, 0.0005, 4);
}

function tap(line, mask, position) {
  const whole = Math.floor(position),
    fraction = position - whole,
    a = line[whole & mask];
  return a + (line[(whole + 1) & mask] - a) * fraction;
}

const span = (frames) => 2 ** Math.ceil(Math.log2(frames + 8));

/** Stereo delay with filtered, optionally saturated feedback. `pingPong` bounces repeats between sides. */
export function delay(buffer, params, context = {}) {
  options(
    params,
    ['type', 'time', 'timeRight', 'feedback', 'mix', 'pingPong', 'lowCut', 'highCut', 'wow', 'drive'],
    'delay effect',
  );
  const { left, right, rate } = buffer,
    frames = left.length;
  const timeL = noteSeconds(params.time ?? '1/4', context.tempo) * rate,
    timeR = noteSeconds(params.timeRight ?? params.time ?? '1/4', context.tempo, 'right delay time') * rate,
    feedback = number(params.feedback ?? 0.35, 'delay feedback', 0, 0.95),
    mix = number(params.mix ?? 0.25, 'delay mix', 0, 1),
    wow = number(params.wow ?? 0, 'delay wow', 0, 1) * 0.0015 * rate,
    drive = number(params.drive ?? 0, 'delay drive', 0, 1),
    pingPong = params.pingPong ?? false;
  assert(typeof pingPong === 'boolean', 'SOUND_TIME', 'pingPong must be boolean.');
  const lowPole = 1 - Math.exp((-2 * Math.PI * number(params.lowCut ?? 180, 'delay low cut', 20, 2000)) / rate),
    highPole = 1 - Math.exp((-2 * Math.PI * number(params.highCut ?? 5200, 'delay high cut', 500, 20000)) / rate);
  const size = span(Math.max(timeL, timeR) + 2 * wow),
    mask = size - 1,
    lineL = new Float32Array(size),
    lineR = new Float32Array(size);
  let lowL = 0,
    lowR = 0,
    highL = 0,
    highR = 0;
  const shape = (x) => (drive ? Math.tanh(x * (1 + 2 * drive)) / (1 + 2 * drive) ** 0.5 : x);
  for (let i = 0, write = 0; i < frames; i++, write = (write + 1) & mask) {
    const wobble = wow ? wow * (1 + Math.sin((2 * Math.PI * 0.37 * i) / rate)) : 0;
    let dl = tap(lineL, mask, write - timeL - wobble),
      dr = tap(lineR, mask, write - timeR - wobble * 0.8);
    highL += highPole * (dl - highL);
    highR += highPole * (dr - highR);
    lowL += lowPole * (highL - lowL);
    lowR += lowPole * (highR - lowR);
    dl = highL - lowL;
    dr = highR - lowR;
    if (pingPong) {
      lineL[write] = shape((left[i] + right[i]) * 0.5 + dr * feedback);
      lineR[write] = shape(dl * feedback);
    } else {
      lineL[write] = shape(left[i] + dl * feedback);
      lineR[write] = shape(right[i] + dr * feedback);
    }
    left[i] = left[i] * (1 - mix) + dl * mix;
    right[i] = right[i] * (1 - mix) + dr * mix;
  }
}

function modulated(buffer, voices, mix, feedback = 0) {
  const { left, right, rate } = buffer,
    frames = left.length;
  const longest = Math.max(...voices.map((voice) => voice.base + 2 * voice.depth + (voice.fastDepth ?? 0) * 2));
  const size = span(longest * rate + 4),
    mask = size - 1;
  for (const [index, channel] of [left, right].entries()) {
    const line = new Float32Array(size);
    for (let i = 0, write = 0; i < frames; i++, write = (write + 1) & mask) {
      let wet = 0;
      for (const voice of voices) {
        const phase = voice.phase + index * voice.stereo;
        let seconds = voice.base + voice.depth * (1 + Math.sin((2 * Math.PI * voice.rate * i) / rate + phase));
        if (voice.fastDepth) {
          seconds += voice.fastDepth * (1 + Math.sin((2 * Math.PI * voice.fastRate * i) / rate + phase * 1.7));
        }
        wet += tap(line, mask, write - seconds * rate) * voice.gain;
      }
      line[write] = channel[i] + wet * feedback;
      channel[i] = channel[i] * (1 - mix) + wet * mix;
    }
  }
}

/** Several slowly detuned copies. It thickens a pad or a single-voice string line. */
export function chorus(buffer, params) {
  options(params, ['type', 'rate', 'depth', 'voices', 'mix', 'delay'], 'chorus effect');
  const rate = number(params.rate ?? 0.6, 'chorus rate', 0.01, 10),
    depth = number(params.depth ?? 0.003, 'chorus depth in seconds', 0, 0.02),
    base = number(params.delay ?? 0.014, 'chorus delay', 0.001, 0.05),
    count = params.voices ?? 3;
  assert(Number.isInteger(count) && count >= 1 && count <= 6, 'SOUND_TIME', 'A chorus has 1–6 voices.');
  const voices = Array.from({ length: count }, (_, index) => ({
    base: base * (1 + index * 0.23),
    depth,
    rate: rate * (1 + index * 0.17),
    phase: (2 * Math.PI * index) / count,
    stereo: Math.PI / 2,
    gain: 1 / Math.sqrt(count),
  }));
  modulated(buffer, voices, number(params.mix ?? 0.4, 'chorus mix', 0, 1));
}

/** Three delay lines swept by a slow and a fast oscillator a third of a cycle apart, as in string machines. */
export function ensemble(buffer, params) {
  options(params, ['type', 'depth', 'mix'], 'ensemble effect');
  const depth = number(params.depth ?? 0.6, 'ensemble depth', 0, 1);
  const voices = [0, 1, 2].map((index) => ({
    base: 0.0052,
    depth: 0.0019 * depth,
    rate: 0.63,
    fastDepth: 0.00022 * depth,
    fastRate: 6.1,
    phase: (2 * Math.PI * index) / 3,
    stereo: (2 * Math.PI) / 3,
    gain: 0.6,
  }));
  modulated(buffer, voices, number(params.mix ?? 0.55, 'ensemble mix', 0, 1));
}

/** A very short swept delay with feedback, giving a moving comb filter. */
export function flanger(buffer, params) {
  options(params, ['type', 'rate', 'depth', 'feedback', 'mix'], 'flanger effect');
  const voice = {
    base: 0.0008,
    depth: number(params.depth ?? 0.002, 'flanger depth in seconds', 0, 0.008),
    rate: number(params.rate ?? 0.25, 'flanger rate', 0.01, 10),
    phase: 0,
    stereo: Math.PI / 2,
    gain: 1,
  };
  modulated(
    buffer,
    [voice],
    number(params.mix ?? 0.5, 'flanger mix', 0, 1),
    number(params.feedback ?? 0.4, 'flanger feedback', -0.9, 0.9),
  );
}

/** A chain of swept all-pass stages whose notches move through the spectrum. */
export function phaser(buffer, params) {
  options(params, ['type', 'rate', 'stages', 'low', 'high', 'feedback', 'mix'], 'phaser effect');
  const { left, right, rate } = buffer,
    frames = left.length;
  const speed = number(params.rate ?? 0.3, 'phaser rate', 0.01, 10),
    stages = params.stages ?? 6,
    low = number(params.low ?? 300, 'phaser low frequency', 20, 5000),
    high = number(params.high ?? 3000, 'phaser high frequency', low, 16000),
    feedback = number(params.feedback ?? 0.3, 'phaser feedback', 0, 0.9),
    mix = number(params.mix ?? 0.5, 'phaser mix', 0, 1);
  assert(Number.isInteger(stages) && stages >= 2 && stages <= 12, 'SOUND_TIME', 'A phaser has 2–12 stages.');
  for (const [index, channel] of [left, right].entries()) {
    const state = new Float64Array(stages);
    let last = 0,
      a = 0;
    for (let i = 0; i < frames; i++) {
      if ((i & 15) === 0) {
        const sweep = 0.5 + 0.5 * Math.sin((2 * Math.PI * speed * i) / rate + (index * Math.PI) / 2),
          t = Math.tan((Math.PI * low * (high / low) ** sweep) / rate);
        a = (t - 1) / (t + 1);
      }
      let x = channel[i] + last * feedback;
      for (let stage = 0; stage < stages; stage++) {
        const y = a * x + state[stage];
        state[stage] = x - a * y;
        x = y;
      }
      last = x;
      channel[i] = channel[i] * (1 - mix) + x * mix;
    }
  }
}

/** Periodic level change. With `stereo` at 1 the two sides move in opposition, which pans the sound. */
export function tremolo(buffer, params) {
  options(params, ['type', 'rate', 'depth', 'stereo'], 'tremolo effect');
  const { left, right, rate } = buffer;
  const speed = number(params.rate ?? 4, 'tremolo rate', 0.01, 30),
    depth = number(params.depth ?? 0.4, 'tremolo depth', 0, 1),
    offset = number(params.stereo ?? 0, 'tremolo stereo', 0, 1) * Math.PI;
  for (let i = 0; i < left.length; i++) {
    const angle = (2 * Math.PI * speed * i) / rate;
    left[i] *= 1 - depth * (0.5 - 0.5 * Math.cos(angle));
    right[i] *= 1 - depth * (0.5 - 0.5 * Math.cos(angle + offset));
  }
}

/** Shift pitch by reading two overlapping grains from a moving delay. Duration is unchanged. */
export function pitchShift(buffer, params) {
  options(params, ['type', 'semitones', 'grain', 'mix'], 'pitch shift effect');
  const { left, right, rate } = buffer,
    frames = left.length;
  const ratio = 2 ** (number(params.semitones ?? 12, 'pitch shift in semitones', -24, 24) / 12),
    grain = number(params.grain ?? 0.09, 'pitch shift grain', 0.02, 0.3) * rate,
    mix = number(params.mix ?? 1, 'pitch shift mix', 0, 1);
  if (ratio === 1) return;
  const size = span(grain + 4),
    mask = size - 1,
    step = Math.abs(ratio - 1) / grain;
  for (const channel of [left, right]) {
    const line = new Float32Array(size);
    let phase = 0;
    for (let i = 0, write = 0; i < frames; i++, write = (write + 1) & mask) {
      line[write] = channel[i];
      let wet = 0;
      for (let grainIndex = 0; grainIndex < 2; grainIndex++) {
        const p = (phase + grainIndex * 0.5) % 1,
          // Shifting up shortens the delay through each grain, and shifting down lengthens it.
          distance = (ratio > 1 ? 1 - p : p) * grain + 1,
          window = 0.5 - 0.5 * Math.cos(2 * Math.PI * p);
        wet += tap(line, mask, write - distance) * window;
      }
      phase += step;
      if (phase >= 1) phase -= 1;
      channel[i] = channel[i] * (1 - mix) + wet * mix;
    }
  }
}

/** Octave-raised copies fed into a long reverb, which adds a bright halo above the source. */
export function shimmer(buffer, params) {
  options(params, ['type', 'decay', 'mix', 'dry', 'semitones', 'damping'], 'shimmer effect');
  const { left, right, rate } = buffer,
    frames = left.length;
  const mix = number(params.mix ?? 0.2, 'shimmer mix', 0, 1),
    dry = number(params.dry ?? 1, 'shimmer dry level', 0, 1),
    semitones = number(params.semitones ?? 12, 'shimmer interval', -12, 12);
  const first = { left: Float32Array.from(left), right: Float32Array.from(right), rate };
  pitchShift(first, { semitones });
  const second = { left: Float32Array.from(first.left), right: Float32Array.from(first.right), rate };
  pitchShift(second, { semitones });
  for (let i = 0; i < frames; i++) {
    first.left[i] += second.left[i] * 0.4;
    first.right[i] += second.right[i] * 0.4;
  }
  reverb(first, {
    preset: 'ambient',
    decay: number(params.decay ?? 7, 'shimmer decay', 0.5, 30),
    damping: number(params.damping ?? 0.55, 'shimmer damping', 0, 1),
    mix: 1,
    highCut: 7000,
    lowCut: 400,
  });
  for (let i = 0; i < frames; i++) {
    left[i] = left[i] * dry + first.left[i] * mix;
    right[i] = right[i] * dry + first.right[i] * mix;
  }
}
