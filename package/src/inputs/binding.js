import { assert, number, options, safeCopy } from '../core/validate.js';
import { Parameter, DataSource } from '../core/data.js';
import { isInputSource, captureReferences } from './source.js';
import { fresh, freshnessDelay } from './freshness.js';

const leases = new WeakMap();

/** Atomically project fresh observations into the scene's existing numeric parameters. */
export function bindInputs(scene, sources, mappings, spec = {}) {
  options(spec, ['stale', 'onError', 'player', 'maxAge'], 'input binding');
  assert(
    scene && typeof scene._ownsInput === 'function' && typeof scene._batch === 'function',
    'INVALID_INPUT_BINDING',
    'Bind inputs to an ExplainerKit scene.',
  );
  const inputs = captureReferences(sources, 16, 'input sources');
  assert(
    inputs.every(isInputSource) && new Set(inputs).size === inputs.length,
    'INVALID_INPUT_BINDING',
    'Use distinct input sources.',
  );
  const stale = spec.stale ?? 'release',
    maxAge = spec.maxAge === undefined ? null : number(spec.maxAge, 'binding freshness', 0, 86400),
    onError = spec.onError;
  assert(
    ['release', 'hold'].includes(stale) && (onError === undefined || typeof onError === 'function'),
    'INVALID_INPUT_BINDING',
    'Choose release/hold on stale input and an optional error callback.',
  );
  const rows = captureReferences(mappings, 64, 'parameter mappings').map((row) => {
    options(row, ['parameter', 'map'], 'live parameter mapping');
    assert(
      row.parameter instanceof Parameter && scene._ownsInput(row.parameter) && typeof row.map === 'function',
      'INVALID_INPUT_BINDING',
      'Each mapping targets an owned numeric parameter with a trusted pure map.',
    );
    return { parameter: row.parameter, map: row.map };
  });
  assert(
    new Set(rows.map((r) => r.parameter)).size === rows.length && !rows.some((r) => leases.has(r.parameter)),
    'INPUT_OWNERSHIP',
    'A parameter may have only one live-input binding.',
  );
  const player = spec.player;
  assert(
    !player || (!player.disposed && typeof player.on === 'function'),
    'INVALID_INPUT_BINDING',
    'Use a live player for automatic binding disposal.',
  );
  let disposed = false,
    queued = false,
    failure = null,
    commits = 0,
    releases = 0,
    expiry = null;
  const owner = {},
    prior = rows.map((row) => row.parameter.checkpoint());
  for (const row of rows) leases.set(row.parameter, owner);
  const release = () =>
    scene._batch(() => {
      for (let i = 0; i < rows.length; i++) {
        const parameter = rows[i].parameter;
        // Restore the reader override underneath this lease, preserving any set()
        // or authored keys edited while a live source controlled presentation.
        const previous = prior[i].override;
        if (previous === null) parameter.release();
        else parameter.override(previous);
      }
      releases++;
    });
  const flush = () => {
    queued = false;
    if (disposed) return false;
    if (expiry !== null) {
      clearTimeout(expiry);
      expiry = null;
    }
    try {
      const views = inputs.map((input) => input.snapshot());
      const valid = views.every((v) => fresh(v, maxAge));
      if (!valid) {
        if (stale === 'release') release();
        return false;
      }
      expiry = setTimeout(flush, freshnessDelay(views, maxAge));
      const observations = Object.freeze(views.map((v) => v.latest));
      const values = rows.map((row) =>
        number(row.map(observations), 'mapped input', row.parameter.min, row.parameter.max),
      );
      scene._batch(() => {
        for (let i = 0; i < rows.length; i++) rows[i].parameter.override(values[i]);
      });
      failure = null;
      commits++;
      return true;
    } catch (error) {
      if (expiry !== null) {
        clearTimeout(expiry);
        expiry = null;
      }
      failure = Object.freeze({
        code: String(error?.code ?? 'INPUT_MAPPING_ERROR'),
        message: String(error?.message ?? error),
      });
      if (stale === 'release') release();
      onError?.(error);
      return false;
    }
  };
  const schedule = () => {
    if (!disposed && !queued) {
      queued = true;
      queueMicrotask(() => {
        if (queued) flush();
      });
    }
  };
  let stops = [],
    stopPlayer = null;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    queued = false;
    if (expiry !== null) clearTimeout(expiry);
    for (const stop of stops) stop();
    stopPlayer?.();
    release();
    for (const row of rows) if (leases.get(row.parameter) === owner) leases.delete(row.parameter);
  };
  try {
    for (const input of inputs) stops.push(input.subscribe(schedule));
    if (player) stopPlayer = player.on('dispose', dispose);
    schedule();
  } catch (error) {
    dispose();
    throw error;
  }
  return Object.freeze({
    flush,
    dispose,
    snapshot: () => safeCopy({ disposed, queued, error: failure, commits, releases, stale }),
  });
}

/** Replace an existing scene DataSource only after a complete mapped row set validates. */
export function bindData(data, source, spec = {}) {
  options(spec, ['map', 'onError', 'player'], 'input data binding');
  assert(
    data instanceof DataSource && isInputSource(source),
    'INVALID_INPUT_BINDING',
    'Use scene data and an explicit input source.',
  );
  assert(!leases.has(data), 'INPUT_OWNERSHIP', 'This row source already has a live binding.');
  const map = spec.map ?? ((sample) => sample.value),
    onError = spec.onError,
    player = spec.player;
  assert(
    typeof map === 'function' &&
      (onError === undefined || typeof onError === 'function') &&
      (!player || (!player.disposed && typeof player.on === 'function')),
    'INVALID_INPUT_BINDING',
    'Use trusted mapping/error callbacks and an optional live player.',
  );
  let disposed = false,
    queued = false,
    error = null,
    commits = 0,
    last = '',
    stop = null,
    stopPlayer = null;
  const owner = {};
  leases.set(data, owner);
  const flush = () => {
    queued = false;
    if (disposed) return false;
    const view = source.snapshot(),
      key = `${view.epoch}:${view.sequence}`;
    if (!fresh(view) || key === last) return false;
    try {
      data.replace(map(view.latest));
      last = key;
      commits++;
      error = null;
      return true;
    } catch (e) {
      error = { code: String(e?.code ?? 'INPUT_MAPPING_ERROR'), message: String(e?.message ?? e) };
      onError?.(e);
      return false;
    }
  };
  const schedule = () => {
    if (!disposed && !queued) {
      queued = true;
      queueMicrotask(() => {
        if (queued) flush();
      });
    }
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    queued = false;
    stop?.();
    stopPlayer?.();
    if (leases.get(data) === owner) leases.delete(data);
  };
  try {
    stop = source.subscribe(schedule);
    if (player) stopPlayer = player.on('dispose', dispose);
    schedule();
  } catch (e) {
    dispose();
    throw e;
  }
  return Object.freeze({ flush, dispose, snapshot: () => safeCopy({ disposed, queued, error, commits }) });
}
