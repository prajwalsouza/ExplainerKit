// This experiment only models the A4 recording shipped with the music guide.
export const strikeEnd = 0.14;
export const handoffEnd = 0.24;

/** Retain the strike, then rebuild the decay from time-varying stereo partials. */
export function hybridA4(reference, frequencies) {
  const { channels, sampleRate } = reference;
  const frames = channels[0].length;
  const start = Math.round(strikeEnd * sampleRate);
  const end = Math.round(handoffEnd * sampleRate);
  const hop = Math.round(0.012 * sampleRate);
  const radius = Math.round(0.04 * sampleRate);
  const points = Math.ceil((frames - start) / hop) + 1;
  const sin = new Float64Array(frames);
  const cos = new Float64Array(frames);
  const taper = Float64Array.from({ length: 2 * radius + 1 }, (_, i) => (1 - Math.cos((Math.PI * i) / radius)) / 2);
  const rebuilt = channels.map(() => new Float32Array(frames));

  for (const frequency of frequencies) {
    const phase = (2 * Math.PI * frequency) / sampleRate;
    for (let i = start - radius; i < frames; i++) {
      sin[i] = Math.sin(phase * i);
      cos[i] = Math.cos(phase * i);
    }
    for (const [channel, source] of channels.entries()) {
      // Project each window onto both phases of the partial. Interpolating the two
      // coefficients preserves its changing amplitude and phase across windows.
      const inPhase = new Float64Array(points);
      const quadrature = new Float64Array(points);
      for (let point = 0; point < points; point++) {
        const first = start + point * hop - radius;
        let weight = 0;
        for (let k = 0; k < taper.length && first + k < frames; k++) {
          const i = first + k;
          const sample = source[i] * taper[k];
          inPhase[point] += sample * cos[i];
          quadrature[point] += sample * sin[i];
          weight += taper[k];
        }
        inPhase[point] *= 2 / weight;
        quadrature[point] *= 2 / weight;
      }
      for (let i = start; i < frames; i++) {
        const point = Math.floor((i - start) / hop);
        const blend = ((i - start) % hop) / hop;
        const re = inPhase[point] + blend * (inPhase[point + 1] - inPhase[point]);
        const im = quadrature[point] + blend * (quadrature[point + 1] - quadrature[point]);
        rebuilt[channel][i] += re * cos[i] + im * sin[i];
      }
    }
  }

  for (const [channel, source] of channels.entries()) {
    const output = rebuilt[channel];
    output.set(source.subarray(0, start));
    // The two signals share much of their waveform. Complementary gains avoid
    // boosting that shared signal in the middle of the crossfade.
    for (let i = start; i < end; i++) {
      const mix = (1 - Math.cos((Math.PI * (i - start)) / (end - start))) / 2;
      output[i] = source[i] + mix * (output[i] - source[i]);
    }
    const fade = Math.round(0.035 * sampleRate);
    for (let i = frames - fade; i < frames; i++) output[i] *= (frames - 1 - i) / (fade - 1);
  }
  return { channels: rebuilt, sampleRate, duration: frames / sampleRate };
}
