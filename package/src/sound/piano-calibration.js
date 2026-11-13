import { calibrationTimes, measuredPiano } from './piano-calibration-data.js';

const profiles = {
  soft: measuredPiano.filter((entry) => entry.layer === 'soft'),
  firm: measuredPiano.filter((entry) => entry.layer === 'firm'),
};
const mix = (a, b, amount) => a + (b - a) * amount;
const exponentialMix = (a, b, amount) => Math.exp(mix(Math.log(a), Math.log(b), amount));

function atPitch(entries, midi) {
  const upper = entries.findIndex((entry) => entry.pitch >= midi);
  const next = entries[upper],
    previous = entries[Math.max(0, upper - 1)];
  if (next.pitch === midi || next === previous) return next.modes;
  const progress = (midi - previous.pitch) / (next.pitch - previous.pitch);
  return previous.modes.map((mode, index) => blend(mode, next.modes[index], progress));
}

function blend(a, b, amount) {
  return [mix(a[0], b[0], amount), ...a.slice(1).map((level, index) => exponentialMix(level, b[index + 1], amount))];
}

/** Interpolate measurements between recorded pitches and two recorded dynamic layers. */
export function pianoProfile(midi, velocity) {
  const { soft, firm } = profiles;
  if (midi < soft[0].pitch || midi >= soft.at(-1).pitch) return null;
  const progress = Math.max(0, Math.min(1, (velocity - 0.4) / 0.24));
  const quiet = atPitch(soft, midi),
    strong = atPitch(firm, midi);
  return quiet.map((mode, index) => blend(mode, strong[index], progress));
}

export function partialEnvelope(levels, rate) {
  const boundaries = calibrationTimes.map((time) => Math.round(rate * time));
  const earlySlope = Math.log(levels[0] / levels[1]) / (calibrationTimes[1] - calibrationTimes[0]);
  const initial = levels[0] * Math.exp(Math.max(-5, Math.min(8, earlySlope)) * calibrationTimes[0]);
  const knots = [initial, ...levels];
  const lastSlope = Math.log(levels.at(-1) / levels.at(-2)) / (calibrationTimes.at(-1) - calibrationTimes.at(-2));
  const steps = boundaries.map(
    (end, index) => (knots[index + 1] / knots[index]) ** (1 / (end - (boundaries[index - 1] ?? 0))),
  );
  steps.push(Math.exp(Math.max(-10, Math.min(-0.18, lastSlope)) / rate));
  return { boundaries, steps, knots, segment: 0, value: initial, frame: -1 };
}

export function envelopeAt(envelope, frame) {
  if (envelope.frame === frame) return envelope.value;
  if (frame === envelope.boundaries[envelope.segment]) {
    envelope.segment++;
    envelope.value = envelope.knots[envelope.segment];
  } else if (frame > 0) envelope.value *= envelope.steps[envelope.segment];
  envelope.frame = frame;
  return envelope.value;
}
