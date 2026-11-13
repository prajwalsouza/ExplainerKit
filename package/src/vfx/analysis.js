import { assert, number, options } from '../core/validate.js';
import { cutHint, exclusions, featuresIn, frameStats, grayFrame, regionOf } from './frames.js';

function inspect(frame, region, excluded) {
  const area = region ?? regionOf({ x: 0, y: 0, width: frame.width, height: frame.height });
  const bounds = area.bounds;
  assert(
    bounds.x < frame.width && bounds.y < frame.height && bounds.x + bounds.width > 0 && bounds.y + bounds.height > 0,
    'INVALID_DATA',
    'The region must overlap the frame.',
  );
  const features = featuresIn(frame, area, excluded);
  return Object.freeze({
    ...frameStats(frame, area),
    features: Object.freeze(features.map(({ x, y }) => Object.freeze({ x, y }))),
  });
}

function selection(spec) {
  options(spec, ['region', 'exclude'], 'footage analysis');
  return { region: spec.region === undefined ? null : regionOf(spec.region), excluded: exclusions(spec.exclude) };
}

/** Inspect a decoded frame or region for candidate tracking features. */
export function analyzeFrame(input, spec = {}) {
  const { region, excluded } = selection(spec);
  return inspect(grayFrame(input), region, excluded);
}

/** Compare up to 16 sampled frames and suggest a textured place to begin tracking. */
export function analyzeFootage(input, spec = {}) {
  const { region, excluded } = selection(spec);
  assert(
    Array.isArray(input) && input.length > 0 && input.length <= 16,
    'RESOURCE_LIMIT',
    'Analyze between 1 and 16 sampled frames.',
  );
  assert(Reflect.ownKeys(input).length === input.length + 1, 'INVALID_DATA', 'Use a dense list of footage samples.');
  const samples = [],
    changes = [];
  let last = null,
    reference = null,
    lastTime = -1,
    referenceScore = 0,
    pixels = 0;
  for (let i = 0; i < input.length; i++) {
    const entry = Object.getOwnPropertyDescriptor(input, i);
    assert(entry && 'value' in entry, 'INVALID_DATA', 'Footage samples must be plain data without accessors.');
    const value = entry.value;
    options(value, ['time', 'frame'], 'footage sample');
    const time = number(value.time, 'sample time', 0, 86400);
    assert(time > lastTime, 'INVALID_DATA', 'Footage sample times must increase.');
    const frame = grayFrame(value.frame);
    pixels += frame.width * frame.height;
    assert(pixels <= 8388608, 'RESOURCE_LIMIT', 'Analyze at most 8,388,608 pixels across sampled frames.');
    if (last) {
      assert(
        last.width === frame.width && last.height === frame.height,
        'INVALID_DATA',
        'Sampled frames must have the same dimensions.',
      );
      if (cutHint(last, frame)) changes.push(Object.freeze({ from: lastTime, to: time }));
    }
    const result = inspect(frame, region, excluded);
    samples.push(Object.freeze({ time, ...result }));
    const score = result.features.length * (1 - result.darkFraction - result.brightFraction) + result.contrast;
    if (result.features.length >= 6 && score > referenceScore) {
      reference = time;
      referenceScore = score;
    }
    last = frame;
    lastTime = time;
  }
  return Object.freeze({
    samples: Object.freeze(samples),
    possibleCuts: Object.freeze(changes),
    referenceTime: reference,
  });
}
