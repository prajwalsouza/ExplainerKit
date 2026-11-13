import { fft, hann } from '../../music/dsp.js';
import { measureLoudness } from '../../music/loudness.js';
import { gainToDb, readAudio } from './core.js';
import { truePeak } from './dynamics.js';

export const METER_BANDS = Object.freeze([
  Object.freeze({ id: 'sub', from: 20, to: 60 }),
  Object.freeze({ id: 'bass', from: 60, to: 250 }),
  Object.freeze({ id: 'lowMid', from: 250, to: 500 }),
  Object.freeze({ id: 'mid', from: 500, to: 2000 }),
  Object.freeze({ id: 'presence', from: 2000, to: 6000 }),
  Object.freeze({ id: 'air', from: 6000, to: 20000 }),
]);

const round = (value, places = 2) => Math.round(value * 10 ** places) / 10 ** places;

function percentile(sorted, p) {
  if (!sorted.length) return -70;
  const position = (sorted.length - 1) * p,
    index = Math.floor(position);
  return sorted[index] + (sorted[Math.min(sorted.length - 1, index + 1)] - sorted[index]) * (position - index);
}

/**
 * Delivery measurements for mono or stereo PCM. Loudness follows the ITU-R
 * BS.1770 method and the range follows EBU Tech 3342. True peak is estimated
 * at four times the sample rate.
 */
export function measureAudio(input) {
  const { channels, rate } = readAudio(input, 'measured audio');
  const left = channels[0],
    right = channels[channels.length - 1],
    frames = left.length;
  let peak = 0,
    square = 0,
    cross = 0,
    powerL = 0,
    powerR = 0,
    sum = 0,
    clippedSamples = 0;
  for (let i = 0; i < frames; i++) {
    const l = left[i],
      r = right[i],
      a = Math.max(Math.abs(l), Math.abs(r));
    if (a > peak) peak = a;
    if (Math.abs(l) > 1) clippedSamples++;
    if (Math.abs(r) > 1) clippedSamples++;
    square += l * l + r * r;
    cross += l * r;
    powerL += l * l;
    powerR += r * r;
    sum += l + r;
  }
  const loudness = measureLoudness({ sampleRate: rate, channels, length: frames });
  // Loudness range: gate the short-term series absolutely and relatively, then take the 10–95 % spread.
  const usable = Array.from(loudness.shortTerm)
    .slice(Math.min(loudness.shortTerm.length, Math.round(3 / loudness.step)))
    .filter((value) => value > -70);
  const power = usable.reduce((total, value) => total + 10 ** (value / 10), 0) / Math.max(1, usable.length);
  const gated = usable.filter((value) => value > 10 * Math.log10(Math.max(power, 1e-12)) - 20).sort((a, b) => a - b);
  const range = gated.length ? percentile(gated, 0.95) - percentile(gated, 0.1) : 0;

  const size = 4096,
    window = hann(size),
    bands = new Float64Array(METER_BANDS.length),
    real = new Float64Array(size),
    imag = new Float64Array(size);
  let total = 0;
  for (let start = 0; start + size <= frames; start += size * 2) {
    for (let i = 0; i < size; i++) {
      real[i] = (left[start + i] + right[start + i]) * 0.5 * window[i];
      imag[i] = 0;
    }
    fft(real, imag);
    for (let bin = 1; bin < size / 2; bin++) {
      const hz = (bin * rate) / size,
        energy = real[bin] * real[bin] + imag[bin] * imag[bin];
      total += energy;
      for (let band = 0; band < METER_BANDS.length; band++) {
        if (hz >= METER_BANDS[band].from && hz < METER_BANDS[band].to) bands[band] += energy;
      }
    }
  }
  const rms = Math.sqrt(square / (2 * frames));
  let momentaryMax = -70,
    shortTermMax = -70;
  for (const value of loudness.momentary) if (value > momentaryMax) momentaryMax = value;
  for (const value of loudness.shortTerm) if (value > shortTermMax) shortTermMax = value;
  return Object.freeze({
    sampleRate: rate,
    duration: frames / rate,
    integrated: round(loudness.integrated),
    momentaryMax: round(momentaryMax),
    shortTermMax: round(shortTermMax),
    range: round(range),
    truePeak: round(gainToDb(truePeak(left, right))),
    samplePeak: round(gainToDb(peak)),
    rms: round(gainToDb(rms)),
    crest: round(gainToDb(peak) - gainToDb(rms)),
    correlation: round(powerL > 0 && powerR > 0 ? cross / Math.sqrt(powerL * powerR) : 1, 3),
    dcOffset: round(sum / (2 * frames), 5),
    clippedSamples,
    bands: Object.freeze(
      Object.fromEntries(
        METER_BANDS.map(({ id }, band) => [
          id,
          round(total > 0 ? 10 * Math.log10(Math.max(bands[band] / total, 1e-12)) : -120, 1),
        ]),
      ),
    ),
  });
}
