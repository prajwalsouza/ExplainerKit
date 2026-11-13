export const SCORE_INSTRUMENTS = Object.freeze(['felt', 'pluck', 'pad', 'bass', 'percussion']);

const SPECTRA = Object.freeze({
  felt: [
    [1, 1, 0.62],
    [2.003, 0.31, 0.28],
    [3.012, 0.19, 0.13],
    [4.025, 0.08, 0.06],
    [6.06, 0.045, 0.035],
  ],
  pluck: [
    [1, 1, 0.32],
    [2, 0.48, 0.13],
    [3, 0.22, 0.08],
    [4, 0.16, 0.055],
    [7, 0.06, 0.04],
  ],
  pad: [
    [0.997, 0.52, Infinity],
    [1.003, 0.52, Infinity],
    [1.998, 0.21, Infinity],
    [3.004, 0.1, Infinity],
  ],
  bass: [
    [1, 1, Infinity],
    [2, 0.22, Infinity],
    [3, 0.085, Infinity],
  ],
  percussion: [
    [1, 0.85, 0.085],
    [1.47, 0.23, 0.039],
    [2.41, 0.18, 0.022],
    [4.79, 0.11, 0.013],
  ],
});

export const SCORE_ENVELOPES = Object.freeze({
  felt: [0.004, 0.22],
  pluck: [0.003, 0.12],
  pad: [0.21, 0.48],
  bass: [0.018, 0.22],
  percussion: [0.002, 0.08],
});

export function defaultScoreInstrument(channel, program) {
  if (channel === 9) return 'percussion';
  if (program >= 24 && program <= 31) return 'pluck';
  if (program >= 32 && program <= 39) return 'bass';
  if ((program >= 40 && program <= 55) || (program >= 88 && program <= 103)) return 'pad';
  return 'felt';
}

// The partials use a second-order oscillator recurrence. Frequency, damping,
// and mix coefficients are calculated once per voice, outside its sample loop.
export function mixScoreVoice(left, right, voice, rate) {
  const { start, gate, tail, pitch, instrument, gain, pan } = voice;
  const [attack] = SCORE_ENVELOPES[instrument];
  const frequency = instrument === 'percussion' ? 48 * 2 ** ((pitch - 36) / 10) : 440 * 2 ** ((pitch - 69) / 12);
  const oscillators = SPECTRA[instrument].flatMap(([ratio, amplitude, decay]) => {
    const hz = ratio * frequency;
    if (hz >= 0.48 * rate) return [];
    const angle = (2 * Math.PI * hz) / rate,
      damping = Math.exp(-1 / (rate * decay));
    return [
      {
        current: 0,
        previous: (-Math.sin(angle) * amplitude) / damping,
        step: 2 * Math.cos(angle) * damping,
        decay: damping * damping,
      },
    ];
  });
  const attackFrames = Math.max(1, Math.min(attack * rate, gate));
  const angle = ((pan + 1) * Math.PI) / 4;
  const l = gain * Math.cos(angle),
    r = gain * Math.sin(angle);
  for (let i = 0; i < gate + tail; i++) {
    let sum = 0;
    for (const oscillator of oscillators) {
      const next = oscillator.current * oscillator.step - oscillator.previous * oscillator.decay;
      sum += oscillator.current;
      oscillator.previous = oscillator.current;
      oscillator.current = next;
    }
    const fade = i < gate ? Math.min(1, i / attackFrames) : 1 - (i - gate) / tail;
    left[start + i] += sum * fade * l;
    right[start + i] += sum * fade * r;
  }
}
