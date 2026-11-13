import { assert, number, options } from '../../core/validate.js';
import { dbToGain, midiToFrequency, seeded } from './core.js';
import { biquadCoefficients } from './filters.js';
import { defineInstrument, panGains } from './instrument.js';

const WAVES = ['sine', 'triangle', 'saw', 'square', 'noise'];
const VOWELS = {
  ah: [
    [730, 1],
    [1090, 0.5],
    [2440, 0.25],
  ],
  oh: [
    [570, 1],
    [840, 0.45],
    [2410, 0.18],
  ],
  oo: [
    [300, 1],
    [870, 0.3],
    [2240, 0.12],
  ],
  ee: [
    [270, 1],
    [2290, 0.35],
    [3010, 0.25],
  ],
  mm: [
    [250, 1],
    [1200, 0.12],
    [2100, 0.06],
  ],
};

const envelopeFields = ['attack', 'decay', 'sustain', 'release'];
function envelopeSpec(value, defaults, name) {
  const spec = { ...defaults, ...(value ?? {}) };
  options(spec, envelopeFields, name);
  return {
    attack: number(spec.attack, `${name} attack`, 0.0005, 20),
    decay: number(spec.decay, `${name} decay`, 0.001, 30),
    sustain: number(spec.sustain, `${name} sustain`, 0, 1),
    release: number(spec.release, `${name} release`, 0.005, 20),
  };
}

/** Exponential-segment envelope generator that returns one value per call. */
function envelope(spec, rate, gate) {
  const attack = Math.max(1, spec.attack * rate),
    decay = Math.exp(-4.6 / (spec.decay * rate)),
    release = Math.exp(-6.9 / (spec.release * rate));
  let value = 0,
    frame = 0;
  return () => {
    if (frame >= gate) value *= release;
    else if (frame < attack) value = Math.sin(((frame + 1) / attack) * (Math.PI / 2)) ** 2;
    else value = spec.sustain + (value - spec.sustain) * decay;
    frame++;
    return value;
  };
}

function blep(t, dt) {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

function readPatch(patch) {
  options(
    patch,
    [
      'name',
      'oscillators',
      'sub',
      'noise',
      'fm',
      'filter',
      'filterEnvelope',
      'envelope',
      'lfo',
      'vibrato',
      'tremolo',
      'drift',
      'velocity',
      'drive',
      'gain',
      'formant',
      'retrigger',
      'width',
    ],
    'synth patch',
  );
  const list = patch.oscillators ?? [{ wave: 'saw' }];
  assert(Array.isArray(list) && list.length >= 1 && list.length <= 4, 'SOUND_SYNTH', 'A patch has 1–4 oscillators.');
  const oscillators = list.map((value) => {
    options(
      value,
      ['wave', 'level', 'octave', 'semitones', 'cents', 'pulseWidth', 'unison', 'detune', 'spread'],
      'oscillator',
    );
    const wave = value.wave ?? 'saw',
      unison = value.unison ?? 1;
    assert(WAVES.includes(wave), 'SOUND_SYNTH', 'Oscillator waves are sine, triangle, saw, square or noise.');
    assert(Number.isInteger(unison) && unison >= 1 && unison <= 9, 'SOUND_SYNTH', 'Unison uses 1–9 voices.');
    return {
      wave,
      level: number(value.level ?? 1, 'oscillator level', 0, 2),
      offset:
        number(value.octave ?? 0, 'oscillator octave', -4, 4) * 12 +
        number(value.semitones ?? 0, 'oscillator semitones', -24, 24) +
        number(value.cents ?? 0, 'oscillator cents', -100, 100) / 100,
      pulseWidth: number(value.pulseWidth ?? 0.5, 'pulse width', 0.05, 0.95),
      unison,
      detune: number(value.detune ?? (unison > 1 ? 14 : 0), 'unison detune in cents', 0, 100),
      spread: number(value.spread ?? (unison > 1 ? 0.8 : 0), 'unison stereo spread', 0, 1),
    };
  });
  let fm = null;
  if (patch.fm !== undefined) {
    options(patch.fm, ['ratio', 'index', 'decay', 'sustain'], 'FM settings');
    fm = {
      ratio: number(patch.fm.ratio ?? 2, 'FM ratio', 0.1, 32),
      index: number(patch.fm.index ?? 2, 'FM index', 0, 24),
      decay: number(patch.fm.decay ?? 0.6, 'FM decay', 0.005, 30),
      sustain: number(patch.fm.sustain ?? 0.1, 'FM sustain', 0, 1),
    };
  }
  let filter = null;
  if (patch.filter !== undefined) {
    options(
      patch.filter,
      ['mode', 'slope', 'cutoff', 'resonance', 'keyTrack', 'envelope', 'velocity', 'dynamics', 'lfo'],
      'synth filter',
    );
    const mode = patch.filter.mode ?? 'lowpass',
      slope = patch.filter.slope ?? 24;
    assert(['lowpass', 'highpass', 'bandpass'].includes(mode), 'SOUND_SYNTH', 'Use lowpass, highpass or bandpass.');
    assert(slope === 12 || slope === 24, 'SOUND_SYNTH', 'Synth filter slopes are 12 or 24 dB per octave.');
    filter = {
      mode,
      stages: slope / 12,
      cutoff: number(patch.filter.cutoff ?? 2000, 'filter cutoff', 20, 20000),
      resonance: number(patch.filter.resonance ?? 0.15, 'filter resonance', 0, 0.97),
      keyTrack: number(patch.filter.keyTrack ?? 0.5, 'filter key tracking', 0, 1),
      envelope: number(patch.filter.envelope ?? 0, 'filter envelope in octaves', -8, 8),
      velocity: number(patch.filter.velocity ?? 0, 'filter velocity in octaves', 0, 6),
      dynamics: number(patch.filter.dynamics ?? 0, 'filter dynamics in octaves', 0, 6),
      lfo: number(patch.filter.lfo ?? 0, 'filter LFO in octaves', 0, 4),
    };
  }
  let lfo = { rate: 5, delay: 0, fade: 0.01 };
  if (patch.lfo !== undefined) {
    options(patch.lfo, ['rate', 'delay', 'fade'], 'synth LFO');
    lfo = {
      rate: number(patch.lfo.rate ?? 5, 'LFO rate', 0.01, 40),
      delay: number(patch.lfo.delay ?? 0, 'LFO delay', 0, 10),
      fade: number(patch.lfo.fade ?? 0.01, 'LFO fade', 0.001, 10),
    };
  }
  let formant = null;
  if (patch.formant !== undefined) {
    options(patch.formant, ['vowel', 'mix', 'q'], 'formant settings');
    assert(Object.hasOwn(VOWELS, patch.formant.vowel ?? 'ah'), 'SOUND_SYNTH', 'Vowels are ah, oh, oo, ee or mm.');
    formant = {
      vowel: VOWELS[patch.formant.vowel ?? 'ah'],
      mix: number(patch.formant.mix ?? 0.8, 'formant mix', 0, 1),
      q: number(patch.formant.q ?? 7, 'formant Q', 1, 30),
    };
  }
  return {
    name: patch.name ?? 'synth',
    oscillators,
    sub: number(patch.sub ?? 0, 'sub oscillator level', 0, 2),
    noise: number(patch.noise ?? 0, 'noise level', 0, 2),
    fm,
    filter,
    filterEnvelope: envelopeSpec(
      patch.filterEnvelope,
      { attack: 0.01, decay: 0.4, sustain: 0.3, release: 0.4 },
      'filter envelope',
    ),
    envelope: envelopeSpec(patch.envelope, { attack: 0.01, decay: 0.3, sustain: 0.8, release: 0.3 }, 'envelope'),
    lfo,
    vibrato: number(patch.vibrato ?? 0, 'vibrato in cents', 0, 100),
    tremolo: number(patch.tremolo ?? 0, 'tremolo depth', 0, 1),
    drift: number(patch.drift ?? 0, 'pitch drift in cents', 0, 30),
    velocity: number(patch.velocity ?? 0.8, 'velocity sensitivity', 0, 1),
    drive: number(patch.drive ?? 0, 'synth drive', 0, 1),
    gain: dbToGain(number(patch.gain ?? 0, 'patch gain in dB', -48, 24)),
    formant,
    retrigger: patch.retrigger ?? false,
    width: number(patch.width ?? 1, 'patch stereo width', 0, 1),
  };
}

/**
 * Subtractive and FM synthesizer. A patch is plain data, so it can be stored,
 * varied and shared. Oscillators are band-limited, and the filter keeps its
 * tuning while its cutoff moves.
 */
export function synthInstrument(patchInput = {}) {
  const patch = readPatch(patchInput);
  const voices = patch.oscillators.reduce((sum, oscillator) => sum + oscillator.unison, 0);
  return defineInstrument(
    {
      kind: 'synth',
      name: patch.name,
      release: patch.envelope.release * 1.15 + 0.02,
      cost: 6 + voices * 5 + (patch.filter ? 6 * patch.filter.stages : 0) + (patch.formant ? 14 : 0),
    },
    (voice) => renderSynth(patch, voice),
  );
}

function renderSynth(patch, voice) {
  const { left, right, rate, start, gate, pitch, velocity, dynamics } = voice;
  const total = Math.min(left.length - start, gate + Math.ceil((patch.envelope.release * 1.15 + 0.02) * rate));
  if (total <= 0) return;
  const random = seeded(`${patch.name}:${voice.seed}:${pitch}:${start}`);
  const [panL, panR] = panGains(voice.pan);
  const level = voice.gain * patch.gain * (1 - patch.velocity + patch.velocity * velocity ** 1.6) * 0.3;
  const units = [];
  for (const oscillator of patch.oscillators) {
    for (let u = 0; u < oscillator.unison; u++) {
      const position = oscillator.unison === 1 ? 0 : (u / (oscillator.unison - 1)) * 2 - 1,
        cents = position * oscillator.detune * 0.5,
        frequency = midiToFrequency(pitch + oscillator.offset + cents / 100),
        side = position * oscillator.spread * patch.width,
        amp = oscillator.level / Math.sqrt(oscillator.unison);
      if (frequency >= rate * 0.45) continue;
      units.push({
        wave: oscillator.wave,
        dt: frequency / rate,
        phase: patch.retrigger ? 0 : random(),
        pulseWidth: oscillator.pulseWidth,
        left: amp * Math.cos(((side + 1) * Math.PI) / 4) * Math.SQRT2,
        right: amp * Math.sin(((side + 1) * Math.PI) / 4) * Math.SQRT2,
        driftRate: (2 * Math.PI * (0.07 + 0.3 * random())) / rate,
        driftPhase: 2 * Math.PI * random(),
        modPhase: 0,
        noise: 0,
      });
    }
  }
  const subDt = midiToFrequency(pitch - 12) / rate;
  let subPhase = 0;
  const amp = envelope(patch.envelope, rate, gate),
    cutoffEnvelope = envelope(patch.filterEnvelope, rate, gate);
  const { filter, fm, formant } = patch;
  const stages = filter ? filter.stages : 0,
    state = new Float64Array(8);
  const k = filter ? 2 - 2 * filter.resonance : 0;
  let g = 0,
    a1 = 0,
    a2 = 0,
    a3 = 0;
  const baseCutoff = filter
    ? filter.cutoff * 2 ** ((filter.keyTrack * (pitch - 60)) / 12 + filter.velocity * (velocity - 0.7))
    : 0;
  const formants = formant
    ? formant.vowel.map(([hz, gain]) => ({
        c: biquadCoefficients('bandpass', Math.min(hz, rate * 0.4), rate, formant.q),
        gain: gain * 2.2,
        s: new Float64Array(4),
      }))
    : null;
  const lfoStep = (2 * Math.PI * patch.lfo.rate) / rate,
    lfoDelay = patch.lfo.delay * rate,
    lfoFade = Math.max(1, patch.lfo.fade * rate),
    lfoPhase = 2 * Math.PI * random();
  const vibrato = patch.vibrato / 1200,
    drift = patch.drift / 1200;
  const drive = 1 + patch.drive * 5;
  let dynamic = dynamics ? dynamics[start >> 6] : 1,
    fmLevel = 0,
    pitchScale = 1,
    lfoValue = 0,
    noiseState = 0;
  const fmDecay = fm ? Math.exp(-1 / (fm.decay * rate)) : 0;
  let fmEnvelope = 1;
  for (let i = 0; i < total; i++) {
    const cutoffValue = cutoffEnvelope();
    if ((i & 15) === 0) {
      const since = i - lfoDelay,
        depth = since <= 0 ? 0 : Math.min(1, since / lfoFade);
      lfoValue = Math.sin(lfoPhase + lfoStep * i) * depth;
      pitchScale = vibrato ? 2 ** (vibrato * lfoValue) : 1;
      if (dynamics) dynamic += 0.2 * (dynamics[Math.min(dynamics.length - 1, (start + i) >> 6)] - dynamic);
      if (filter) {
        const hz =
          baseCutoff * 2 ** (filter.envelope * cutoffValue + filter.lfo * lfoValue + filter.dynamics * (dynamic - 1));
        g = Math.tan((Math.PI * Math.max(20, Math.min(hz, rate * 0.45))) / rate);
        a1 = 1 / (1 + g * (g + k));
        a2 = g * a1;
        a3 = g * a2;
      }
      if (fm) fmLevel = fm.index * (fm.sustain + (1 - fm.sustain) * fmEnvelope) * (0.35 + 0.65 * velocity);
    }
    if (fm) fmEnvelope *= fmDecay;
    let l = 0,
      r = 0;
    for (const unit of units) {
      let dt = unit.dt * pitchScale;
      if (drift) dt *= 1 + drift * 0.6931 * Math.sin(unit.driftPhase + unit.driftRate * i);
      let p = unit.phase + dt;
      if (p >= 1) p -= 1;
      unit.phase = p;
      let sample;
      if (unit.wave === 'saw') sample = 2 * p - 1 - blep(p, dt);
      else if (unit.wave === 'square') {
        let shifted = p + 1 - unit.pulseWidth;
        if (shifted >= 1) shifted -= 1;
        sample = (p < unit.pulseWidth ? 1 : -1) + blep(p, dt) - blep(shifted, dt);
      } else if (unit.wave === 'triangle') sample = 4 * Math.abs(p - 0.5) - 1;
      else if (unit.wave === 'noise') sample = random() * 2 - 1;
      else if (fm) {
        unit.modPhase += dt * fm.ratio;
        if (unit.modPhase >= 1) unit.modPhase -= Math.floor(unit.modPhase);
        sample = Math.sin(2 * Math.PI * p + fmLevel * Math.sin(2 * Math.PI * unit.modPhase));
      } else sample = Math.sin(2 * Math.PI * p);
      l += sample * unit.left;
      r += sample * unit.right;
    }
    if (patch.sub) {
      subPhase += subDt * pitchScale;
      if (subPhase >= 1) subPhase -= 1;
      const sub = Math.sin(2 * Math.PI * subPhase) * patch.sub;
      l += sub;
      r += sub;
    }
    if (patch.noise) {
      noiseState += 0.5 * (random() * 2 - 1 - noiseState);
      l += noiseState * patch.noise;
      r += noiseState * patch.noise;
    }
    for (let stage = 0; stage < stages; stage++) {
      const o = stage * 4;
      let v3 = l - state[o + 1],
        v1 = a1 * state[o] + a2 * v3,
        v2 = state[o + 1] + a2 * state[o] + a3 * v3;
      state[o] = 2 * v1 - state[o];
      state[o + 1] = 2 * v2 - state[o + 1];
      l = filter.mode === 'lowpass' ? v2 : filter.mode === 'bandpass' ? v1 : l - k * v1 - v2;
      v3 = r - state[o + 3];
      v1 = a1 * state[o + 2] + a2 * v3;
      v2 = state[o + 3] + a2 * state[o + 2] + a3 * v3;
      state[o + 2] = 2 * v1 - state[o + 2];
      state[o + 3] = 2 * v2 - state[o + 3];
      r = filter.mode === 'lowpass' ? v2 : filter.mode === 'bandpass' ? v1 : r - k * v1 - v2;
    }
    if (formants) {
      let fl = 0,
        fr = 0;
      for (const { c, gain, s } of formants) {
        const yl = c[0] * l + s[0];
        s[0] = c[1] * l - c[3] * yl + s[1];
        s[1] = c[2] * l - c[4] * yl;
        const yr = c[0] * r + s[2];
        s[2] = c[1] * r - c[3] * yr + s[3];
        s[3] = c[2] * r - c[4] * yr;
        fl += yl * gain;
        fr += yr * gain;
      }
      l += (fl - l) * formant.mix;
      r += (fr - r) * formant.mix;
    }
    if (patch.drive) {
      l = Math.tanh(l * drive) / drive ** 0.6;
      r = Math.tanh(r * drive) / drive ** 0.6;
    }
    let out = amp() * level * dynamic ** 1.3;
    if (patch.tremolo) out *= 1 - patch.tremolo * (0.5 + 0.5 * lfoValue);
    left[start + i] += l * out * panL * Math.SQRT2;
    right[start + i] += r * out * panR * Math.SQRT2;
  }
}

/** Starting patches for documentary scoring. Spread one into `synthInstrument` and change any field. */
export const SYNTH_PATCHES = Object.freeze({
  warmPad: {
    name: 'warm pad',
    oscillators: [
      { wave: 'saw', unison: 7, detune: 22, spread: 0.9, level: 0.8 },
      { wave: 'triangle', octave: -1, level: 0.22 },
    ],
    filter: { cutoff: 950, resonance: 0.08, keyTrack: 0.4, envelope: 1.2, dynamics: 2, lfo: 0.15 },
    filterEnvelope: { attack: 2.4, decay: 3, sustain: 0.6, release: 3 },
    envelope: { attack: 1.4, decay: 2, sustain: 0.85, release: 3.2 },
    lfo: { rate: 0.17 },
    drift: 5,
    velocity: 0.5,
  },
  glassPad: {
    name: 'glass pad',
    oscillators: [
      { wave: 'sine', unison: 3, detune: 9, spread: 0.7 },
      { wave: 'sine', octave: 1, level: 0.35, unison: 2, detune: 12 },
      { wave: 'triangle', octave: 2, level: 0.07 },
    ],
    fm: { ratio: 3, index: 1.1, decay: 2.5, sustain: 0.25 },
    filter: { cutoff: 3200, resonance: 0.05, keyTrack: 0.3, dynamics: 1.5 },
    envelope: { attack: 0.9, decay: 3, sustain: 0.7, release: 4 },
    drift: 4,
    velocity: 0.5,
    gain: -3,
  },
  airPad: {
    name: 'air pad',
    oscillators: [
      { wave: 'noise', level: 1.5 },
      { wave: 'sine', level: 0.25, unison: 2, detune: 8 },
    ],
    filter: { mode: 'bandpass', slope: 24, cutoff: 262, resonance: 0.8, keyTrack: 1, dynamics: 0.6 },
    envelope: { attack: 1.8, decay: 2, sustain: 0.9, release: 3.5 },
    velocity: 0.4,
    gain: -17,
  },
  choir: {
    name: 'choir',
    oscillators: [
      { wave: 'saw', unison: 5, detune: 18, spread: 0.9 },
      { wave: 'square', pulseWidth: 0.3, level: 0.3, unison: 2, detune: 10 },
    ],
    noise: 0.05,
    filter: { cutoff: 2600, resonance: 0.05, keyTrack: 0.3, dynamics: 1.2 },
    formant: { vowel: 'ah', mix: 0.85, q: 6 },
    envelope: { attack: 0.7, decay: 2, sustain: 0.9, release: 2.2 },
    lfo: { rate: 5.2, delay: 0.5, fade: 1 },
    vibrato: 9,
    drift: 6,
    velocity: 0.5,
    gain: 3,
  },
  synthStrings: {
    name: 'synth strings',
    oscillators: [
      { wave: 'saw', unison: 6, detune: 20, spread: 1 },
      { wave: 'saw', octave: 1, level: 0.25, unison: 3, detune: 16 },
    ],
    filter: { cutoff: 1500, resonance: 0.06, keyTrack: 0.45, envelope: 0.8, dynamics: 2 },
    filterEnvelope: { attack: 0.6, decay: 2, sustain: 0.7, release: 1.2 },
    envelope: { attack: 0.35, decay: 2, sustain: 0.9, release: 1.4 },
    lfo: { rate: 5.4, delay: 0.3, fade: 0.8 },
    vibrato: 6,
    drift: 4,
    velocity: 0.6,
  },
  brass: {
    name: 'soft brass',
    oscillators: [
      { wave: 'saw', unison: 4, detune: 10, spread: 0.6 },
      { wave: 'square', pulseWidth: 0.42, level: 0.3 },
    ],
    filter: { cutoff: 680, resonance: 0.1, keyTrack: 0.5, envelope: 2.6, velocity: 1.5, dynamics: 2.5 },
    filterEnvelope: { attack: 0.16, decay: 1.2, sustain: 0.55, release: 0.5 },
    envelope: { attack: 0.09, decay: 1, sustain: 0.85, release: 0.6 },
    lfo: { rate: 4.8, delay: 0.6, fade: 0.8 },
    vibrato: 4,
    drift: 3,
  },
  subBass: {
    name: 'sub bass',
    oscillators: [{ wave: 'sine' }, { wave: 'triangle', level: 0.18 }],
    filter: { cutoff: 240, slope: 12, resonance: 0, keyTrack: 0.6, dynamics: 0.5 },
    envelope: { attack: 0.03, decay: 1.5, sustain: 0.85, release: 0.45 },
    drive: 0.12,
    retrigger: true,
    velocity: 0.5,
    width: 0,
    gain: 4,
  },
  deepBass: {
    name: 'deep bass',
    oscillators: [
      { wave: 'saw', level: 0.7 },
      { wave: 'square', pulseWidth: 0.5, level: 0.4 },
    ],
    filter: { cutoff: 240, resonance: 0.18, keyTrack: 0.5, envelope: 2.4, velocity: 1, dynamics: 1.5 },
    filterEnvelope: { attack: 0.01, decay: 0.5, sustain: 0.25, release: 0.3 },
    envelope: { attack: 0.01, decay: 1.2, sustain: 0.8, release: 0.3 },
    drive: 0.2,
    retrigger: true,
    width: 0,
  },
  pulse: {
    name: 'pulse',
    oscillators: [
      { wave: 'saw', unison: 2, detune: 8, spread: 0.3 },
      { wave: 'square', pulseWidth: 0.35, level: 0.5 },
    ],
    filter: { cutoff: 520, resonance: 0.25, keyTrack: 0.5, envelope: 3, velocity: 1.6, dynamics: 2.5 },
    filterEnvelope: { attack: 0.003, decay: 0.18, sustain: 0.18, release: 0.14 },
    envelope: { attack: 0.003, decay: 0.26, sustain: 0.15, release: 0.16 },
    velocity: 0.9,
    gain: 3,
  },
  softLead: {
    name: 'soft lead',
    oscillators: [
      { wave: 'triangle', unison: 2, detune: 6, spread: 0.3 },
      { wave: 'sine', octave: 1, level: 0.2 },
    ],
    filter: { cutoff: 2400, resonance: 0.1, keyTrack: 0.5, dynamics: 1.2 },
    envelope: { attack: 0.06, decay: 1, sustain: 0.8, release: 0.7 },
    lfo: { rate: 5, delay: 0.35, fade: 0.6 },
    vibrato: 10,
  },
  bell: {
    name: 'glass bell',
    oscillators: [{ wave: 'sine' }, { wave: 'sine', octave: 2, cents: 7, level: 0.12 }],
    fm: { ratio: 3.5, index: 3.2, decay: 0.9, sustain: 0.04 },
    envelope: { attack: 0.002, decay: 2.8, sustain: 0, release: 2.2 },
    velocity: 0.9,
  },
  electricPiano: {
    name: 'electric piano',
    oscillators: [{ wave: 'sine', unison: 2, detune: 5, spread: 0.5 }],
    fm: { ratio: 1, index: 1.5, decay: 0.7, sustain: 0.12 },
    envelope: { attack: 0.003, decay: 2.4, sustain: 0.12, release: 0.5 },
    lfo: { rate: 4.2 },
    tremolo: 0.12,
    velocity: 0.9,
  },
});
for (const patch of Object.values(SYNTH_PATCHES)) Object.freeze(patch);
