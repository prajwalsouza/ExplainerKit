import { assert, number, options } from '../core/validate.js';
import { managedSource, isInputSource, captureReferences } from './source.js';
import { fresh, freshnessDelay } from './freshness.js';

function sourceList(input) {
  const list = captureReferences(input, 16, 'input sources');
  assert(
    list.every(isInputSource) && new Set(list).size === list.length,
    'INVALID_INPUT_SOURCE',
    'Use distinct first-party input sources.',
  );
  return list;
}

function derived(input, makeMap, spec) {
  const list = sourceList(input);
  options(spec, ['id', 'kind', 'unit', 'space', 'maxSamples', 'maxBytes', 'maxAge', 'clock'], 'derived input');
  const sourceOptions = { maxAge: Math.min(...list.map((source) => source.maxAge)), ...spec };
  return managedSource(sourceOptions, (ctx) => {
    let map = makeMap(),
      signatures = '',
      expiry = null;
    const compute = () => {
      if (expiry !== null) {
        clearTimeout(expiry);
        expiry = null;
      }
      if (!ctx.isCurrent()) return;
      const views = list.map((source) => source.snapshot()),
        samples = views.map((view) => view.latest),
        valid = views.every((view) => fresh(view));
      const delay = freshnessDelay(views);
      if (delay !== null) expiry = setTimeout(update, delay);
      const key = views.map((v) => `${v.status}:${v.epoch}:${v.sequence}:${v.stale}`).join('|');
      if (key === signatures) return;
      signatures = key;
      if (!valid) {
        map = makeMap();
        ctx.emit(null, { valid: false });
        return;
      }
      const confidence = samples.every((s) => s.quality.confidence !== null)
        ? Math.min(...samples.map((s) => s.quality.confidence))
        : null;
      const result = map(samples);
      ctx.emit(result, { confidence, valid: result !== null });
    };
    const update = () => {
      try {
        compute();
      } catch (error) {
        if (expiry !== null) {
          clearTimeout(expiry);
          expiry = null;
        }
        ctx.status('error', error);
      }
    };
    const stops = [];
    try {
      for (const source of list) stops.push(source.subscribe(update));
      update();
    } catch (error) {
      for (const stop of stops) stop();
      if (expiry !== null) clearTimeout(expiry);
      throw error;
    }
    return () => {
      for (const stop of stops) stop();
      if (expiry !== null) clearTimeout(expiry);
    };
  });
}

/** Latest-with-freshness join. Starts its subscriptions, never its upstream devices. */
export function deriveInput(sources, map, spec = {}) {
  assert(typeof map === 'function', 'INVALID_INPUT_MAPPING', 'Use a trusted pure input mapping.');
  return derived(sources, () => map, spec);
}

/** Map one source value; the immutable observation is supplied as the second argument. */
export function mapInput(source, map, spec = {}) {
  assert(typeof map === 'function', 'INVALID_INPUT_MAPPING', 'Use a trusted pure input mapping.');
  return derived([source], () => (samples) => map(samples[0].value, samples[0]), spec);
}

/** Time-based scalar low-pass filter. Each explicit start resets filter state. */
export function smoothInput(source, spec = {}) {
  assert(isInputSource(source), 'INVALID_INPUT_SOURCE', 'Smooth an explicit input source.');
  options(
    spec,
    ['id', 'kind', 'unit', 'space', 'maxSamples', 'maxBytes', 'maxAge', 'clock', 'halfLife'],
    'input smoothing',
  );
  const { halfLife = 0.1, ...rest } = spec;
  number(halfLife, 'smoothing half life', 0.001, 60);
  return derived(
    [source],
    () => {
      let epoch = null,
        time = null,
        value = null;
      return (samples) => {
        const row = samples[0],
          next = number(row.value, 'scalar input'),
          same = epoch === row.epoch;
        if (!same || time === null) value = next;
        else value += (next - value) * (1 - Math.pow(0.5, Math.max(0, row.time - time) / halfLife));
        epoch = row.epoch;
        time = row.time;
        return value;
      };
    },
    { unit: source.unit, space: source.space, ...rest },
  );
}

/** Scalar hysteresis. A boolean state, not an inferred semantic event. */
export function thresholdInput(source, spec = {}) {
  options(
    spec,
    ['id', 'kind', 'unit', 'space', 'maxSamples', 'maxBytes', 'maxAge', 'clock', 'above', 'below', 'initial'],
    'input threshold',
  );
  const { above, below = above, initial = false, ...rest } = spec;
  number(above, 'threshold upper');
  number(below, 'threshold lower', -1e7, above);
  assert(typeof initial === 'boolean', 'INVALID_INPUT_MAPPING', 'Threshold initial state is boolean.');
  return derived(
    [source],
    () => {
      let active = initial,
        epoch = null;
      return (samples) => {
        const row = samples[0],
          value = number(row.value, 'scalar input');
        if (epoch !== row.epoch) active = initial;
        epoch = row.epoch;
        if (!active && value >= above) active = true;
        else if (active && value <= below) active = false;
        return active;
      };
    },
    rest,
  );
}
