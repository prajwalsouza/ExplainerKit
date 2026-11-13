import { assert, number, options, text } from '../core/validate.js';

const sources = new WeakSet();
let nextSource = 0;
const monotonic = () => globalThis.performance.now() / 1000;
const states = new Set([
  'idle',
  'requesting',
  'running',
  'interrupted',
  'stopped',
  'denied',
  'unsupported',
  'error',
  'disposed',
]);

/** Bounded immutable JSON data; byte and aggregate-value work are checked before copying. */
function capture(value, maxBytes) {
  let bytes = 0,
    values = 0;
  const visit = (v, depth) => {
    assert(
      depth <= 16 && ++values <= 100000,
      'RESOURCE_LIMIT',
      'An input observation exceeds its nesting/value budget.',
    );
    if (v === null || typeof v === 'boolean') {
      bytes += 5;
      return v;
    }
    if (typeof v === 'number') {
      bytes += 24;
      return number(v, 'input value', -1e100, 1e100);
    }
    if (typeof v === 'string') {
      bytes += v.length * 3 + 2;
      assert(bytes <= maxBytes, 'RESOURCE_LIMIT', 'Input data exceeds its byte budget.');
      return text(v, 'input text', 10000);
    }
    assert(
      v &&
        typeof v === 'object' &&
        (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null),
      'INVALID_INPUT_DATA',
      'Input values are plain JSON data.',
    );
    const keys = Reflect.ownKeys(v);
    assert(
      keys.length <= 100000 && (!Array.isArray(v) || keys.length === v.length + 1),
      'INVALID_INPUT_DATA',
      'Use bounded plain records and dense arrays.',
    );
    const out = Array.isArray(v) ? [] : Object.create(null);
    for (const key of keys) {
      if (Array.isArray(v) && key === 'length') continue;
      assert(
        typeof key === 'string' && !['__proto__', 'prototype', 'constructor'].includes(key) && key.length <= 200,
        'INVALID_INPUT_DATA',
        'Input data contains an unsafe key.',
      );
      if (Array.isArray(v))
        assert(
          /^(0|[1-9]\d*)$/.test(key) && +key < v.length,
          'INVALID_INPUT_DATA',
          'Use dense arrays without extra fields.',
        );
      const d = Object.getOwnPropertyDescriptor(v, key);
      assert(d && 'value' in d && d.enumerable, 'INVALID_INPUT_DATA', 'Input data cannot contain accessors.');
      bytes += key.length * 3 + 4;
      assert(bytes <= maxBytes, 'RESOURCE_LIMIT', 'Input data exceeds its byte budget.');
      out[key] = visit(d.value, depth + 1);
    }
    return Object.freeze(out);
  };
  const data = visit(value, 0);
  assert(bytes <= maxBytes, 'RESOURCE_LIMIT', 'Input data exceeds its byte budget.');
  return { data, bytes };
}

function issue(error) {
  return Object.freeze({
    code: String(error?.code ?? error?.name ?? 'INPUT_ERROR').slice(0, 100),
    message: String(error?.message ?? error ?? 'Input failed.').slice(0, 500),
  });
}

/** Internal adapter lifecycle. All resource acquisition is deferred until explicit start(). */
export function managedSource(spec = {}, activate = () => {}) {
  options(spec, ['id', 'kind', 'unit', 'space', 'maxSamples', 'maxBytes', 'maxAge', 'clock'], 'input source');
  const sourceId = text(spec.id ?? `input-${++nextSource}`, 'source id', 128),
    kind = spec.kind ?? 'state',
    unit = text(spec.unit ?? 'unitless', 'input unit', 80),
    space = text(spec.space ?? 'none', 'input space', 80),
    maxSamples = number(spec.maxSamples ?? 1, 'input sample retention', 1, 1024),
    maxBytes = number(spec.maxBytes ?? 1048576, 'input retained byte budget', 256, 16777216),
    maxAge = number(spec.maxAge ?? 0.5, 'input freshness', 0, 86400),
    clock = spec.clock ?? monotonic;
  assert(
    sourceId.length > 0 &&
      ['state', 'event'].includes(kind) &&
      Number.isInteger(maxSamples) &&
      Number.isInteger(maxBytes) &&
      typeof clock === 'function' &&
      typeof activate === 'function',
    'INVALID_INPUT_SOURCE',
    'Use a source ID, state/event kind, integer budgets and a trusted clock.',
  );
  let status = 'idle',
    epoch = 0,
    sequence = 0,
    latest = null,
    error = null,
    generation = 0,
    cleanup = null,
    abort = null,
    pending = null,
    dropped = 0,
    retainedBytes = 0,
    lastReceived = -Infinity;
  const history = [],
    listeners = new Set();
  const now = () => number(clock(), 'input clock', 0, 1e12);
  const snapshot = () => {
    const age = latest === null ? null : Math.max(0, now() - latest.receivedAt);
    return Object.freeze({
      sourceId,
      kind,
      status,
      epoch,
      sequence,
      latest,
      age,
      maxAge,
      stale: status !== 'running' || age === null || age > maxAge,
      error,
      dropped,
      retained: history.length,
      retainedBytes,
    });
  };
  const notify = () => {
    const view = snapshot();
    let failure;
    for (const listener of [...listeners])
      try {
        listener(view);
      } catch (e) {
        failure ??= e;
      }
    if (failure) throw failure;
  };
  const release = () => {
    const fn = cleanup;
    cleanup = null;
    const controller = abort;
    abort = null;
    let failure = null;
    try {
      controller?.abort();
    } catch (e) {
      failure = e;
    }
    try {
      fn?.();
    } catch (e) {
      failure ??= e;
    }
    return failure;
  };
  function transition(next, problem = null) {
    assert(states.has(next), 'INVALID_INPUT_STATE', 'Use a declared input lifecycle state.');
    status = next;
    error = problem === null ? null : issue(problem);
    notify();
  }
  function push(value, metadata = {}) {
    assert(
      status === 'running' || status === 'requesting',
      'INPUT_NOT_RUNNING',
      'Start the input before publishing observations.',
    );
    options(metadata, ['time', 'valid', 'confidence'], 'input observation');
    const receivedAt = now(),
      time = number(metadata.time ?? receivedAt, 'source sample time', 0, 1e12),
      valid = metadata.valid ?? true,
      confidence = metadata.confidence ?? null;
    assert(
      typeof valid === 'boolean' && (confidence === null || typeof confidence === 'number'),
      'INVALID_INPUT_DATA',
      'Quality uses a boolean valid flag and nullable confidence.',
    );
    if (confidence !== null) number(confidence, 'input confidence', 0, 1);
    assert(
      receivedAt >= lastReceived && (latest === null || time >= latest.time),
      'INPUT_TIME_ORDER',
      'Input clocks and sample times cannot move backward within an epoch.',
    );
    const captured = capture(value, maxBytes);
    const observation = Object.freeze({
      source: sourceId,
      epoch,
      sequence: sequence + 1,
      time,
      receivedAt,
      value: captured.data,
      unit,
      space,
      quality: Object.freeze({ valid, confidence }),
    });
    while (history.length && (history.length >= maxSamples || retainedBytes + captured.bytes > maxBytes)) {
      retainedBytes -= history.shift().bytes;
      dropped++;
    }
    history.push({ sample: observation, bytes: captured.bytes });
    retainedBytes += captured.bytes;
    lastReceived = receivedAt;
    sequence++;
    latest = observation;
    error = null;
    notify();
    return observation;
  }
  function stop() {
    if (status === 'disposed') return;
    generation++;
    pending = null;
    latest = null;
    const failure = release();
    transition('stopped', failure);
  }
  function dispose() {
    if (status === 'disposed') return;
    generation++;
    pending = null;
    latest = null;
    const failure = release();
    history.length = 0;
    retainedBytes = 0;
    try {
      transition('disposed', failure);
    } finally {
      listeners.clear();
    }
  }
  function start() {
    assert(status !== 'disposed', 'DISPOSED', 'This input source is disposed.');
    if (status === 'running') return Promise.resolve(true);
    if (status === 'requesting' && pending) return pending;
    generation++;
    const token = generation;
    epoch++;
    sequence = 0;
    latest = null;
    error = null;
    lastReceived = -Infinity;
    release();
    abort = new AbortController();
    const controller = abort;
    const current = () => generation === token && (status === 'requesting' || status === 'running');
    const context = Object.freeze({
      now,
      signal: controller.signal,
      isCurrent: current,
      emit: (value, metadata) => (current() ? push(value, metadata) : null),
      status: (next, problem = null) => {
        if (!current()) return;
        if (next === 'ended') next = 'interrupted';
        assert(
          states.has(next) && !['idle', 'disposed'].includes(next),
          'INVALID_INPUT_STATE',
          'Use an adapter input state.',
        );
        if (!['running', 'requesting'].includes(next)) {
          generation++;
          pending = null;
          latest = null;
          release();
        }
        transition(next, problem);
      },
    });
    transition('requesting');
    if (!current()) return Promise.resolve(false);
    // The first activate call is synchronous so native permission requests remain
    // within the caller's user activation; its completion may be asynchronous.
    let result;
    try {
      result = activate(context);
    } catch (e) {
      result = Promise.reject(e);
    }
    const task = Promise.resolve(result)
      .then((fn) => {
        assert(
          fn === undefined || typeof fn === 'function',
          'INVALID_INPUT_SOURCE',
          'An input adapter must return a cleanup function.',
        );
        if (!current()) {
          fn?.();
          return false;
        }
        cleanup = fn ?? null;
        pending = null;
        transition('running');
        return true;
      })
      .catch((e) => {
        if (!current()) return false;
        generation++;
        pending = null;
        latest = null;
        release();
        transition(
          e?.code === 'INPUT_UNSUPPORTED'
            ? 'unsupported'
            : ['NotAllowedError', 'PermissionDeniedError'].includes(e?.name)
              ? 'denied'
              : 'error',
          e,
        );
        return false;
      });
    pending = task;
    return task;
  }
  const source = Object.freeze({
    sourceId,
    kind,
    unit,
    space,
    maxAge,
    start,
    stop,
    dispose,
    push,
    snapshot,
    samples: () => Object.freeze(history.map((row) => row.sample)),
    subscribe: (listener) => {
      assert(status !== 'disposed', 'DISPOSED', 'This input is disposed.');
      assert(typeof listener === 'function', 'INVALID_INPUT_SOURCE', 'Use an input observer.');
      assert(listeners.size < 256, 'RESOURCE_LIMIT', 'At most 256 input observers.');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
  sources.add(source);
  return source;
}

/** Caller-fed observations, including an explicitly supplied phone/transport bridge. */
export function inputSource(spec = {}) {
  return managedSource(spec);
}

export function isInputSource(value) {
  return sources.has(value);
}

/** Capture reference arrays without executing indexed accessors or copying owned objects. */
export function captureReferences(input, maximum, label) {
  assert(
    Array.isArray(input) &&
      input.length > 0 &&
      input.length <= maximum &&
      Reflect.ownKeys(input).length === input.length + 1,
    'INVALID_INPUT_SOURCE',
    `Use 1–${maximum} densely indexed ${label}.`,
  );
  return Object.freeze(
    Array.from({ length: input.length }, (_, i) => {
      const d = Object.getOwnPropertyDescriptor(input, i);
      assert(d && 'value' in d, 'INVALID_INPUT_SOURCE', 'Input reference arrays cannot contain accessors or gaps.');
      return d.value;
    }),
  );
}
