import { assert, number, options, safeCopy, KitError } from '../core/validate.js';
import { randomAt } from '../noise/vector.js';

const states = new WeakMap();
const reserved = new Set(['i', 'x', 'y', 'rand', 'rand2', 'rand3', 'rand4', '__proto__', 'prototype', 'constructor']);
export function stateOf(set) {
  const state = states.get(set);
  assert(state, 'PROCEDURAL_POINT_SET', 'Use a point set returned by points or attribute.');
  return state;
}
function columnValue(value) {
  assert(
    value === null ||
      typeof value === 'boolean' ||
      (typeof value === 'string' && value.length <= 200) ||
      (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e7),
    'PROCEDURAL_ATTRIBUTE',
    'Attributes must return finite numbers, short strings, booleans or null.',
  );
  return value;
}
export function sampleRows(set, time = 0) {
  const state = stateOf(set);
  number(time, 'procedural time', 0, 86400);
  if (state.cachedRows) return state.cachedRows;
  const result = new Array(state.count);
  for (let i = 0; i < state.count; i++) {
    const point = {
      i,
      x: state.x[i],
      y: state.y[i],
      rand: randomAt(state.seed, i, 0),
      rand2: randomAt(state.seed, i, 1),
      rand3: randomAt(state.seed, i, 2),
      rand4: randomAt(state.seed, i, 3),
    };
    for (const operation of state.operations)
      for (const [name, column] of operation) {
        let value;
        try {
          value =
            typeof column === 'function'
              ? column(Object.freeze({ ...point }), time)
              : Array.isArray(column)
                ? column[i]
                : column;
        } catch (cause) {
          const error = new KitError('PROCEDURAL_CALLBACK', `Procedural attribute ${name} failed at point ${i}.`);
          error.cause = cause;
          throw error;
        }
        point[name] = columnValue(value);
      }
    result[i] = Object.freeze(point);
  }
  const rows = Object.freeze(result);
  if (state.staticRows) state.cachedRows = rows;
  return rows;
}
export function pointSet(seed, x, y, operations = [], diagnostics = {}) {
  const ownedX = new Float32Array(x),
    ownedY = new Float32Array(y);
  const state = {
    seed,
    count: ownedX.length,
    x: ownedX,
    y: ownedY,
    operations,
    staticRows: operations.every((operation) => operation.every(([, column]) => typeof column !== 'function')),
  };
  const set = Object.freeze({
    count: state.count,
    seed,
    get x() {
      return new Float32Array(ownedX);
    },
    get y() {
      return new Float32Array(ownedY);
    },
    diagnostics: Object.freeze({ ...diagnostics }),
    rand(index, channel = 0) {
      number(index, 'point index', 0, state.count - 1);
      number(channel, 'random channel', 0, 65535);
      assert(
        Number.isInteger(index) && Number.isInteger(channel),
        'PROCEDURAL_INDEX',
        'Point indices and random channels must be whole numbers.',
      );
      return randomAt(seed, index, channel);
    },
    sample(time = 0) {
      return sampleRows(set, time);
    },
  });
  states.set(set, state);
  return set;
}
/** Return another captured point set; evaluate function columns independently at each sample time. */
export function attribute(set, input, callback) {
  const state = stateOf(set),
    columns = typeof input === 'string' ? { [input]: callback } : input;
  assert(
    callback === undefined || typeof input === 'string',
    'PROCEDURAL_ATTRIBUTE',
    'Use attribute(set,name,callback) or attribute(set,columns).',
  );
  options(columns, Object.keys(columns ?? {}), 'point attribute columns');
  const names = Object.keys(columns);
  assert(
    names.length > 0 && state.operations.reduce((sum, op) => sum + op.length, 0) + names.length <= 16,
    'RESOURCE_LIMIT',
    'A point set accepts at most 16 attribute operations.',
  );
  const operation = names.map((name) => {
    assert(
      /^[a-zA-Z][\w-]{0,63}$/.test(name) && !reserved.has(name),
      'PROCEDURAL_ATTRIBUTE',
      'Use a short nonreserved attribute name.',
    );
    const value = columns[name];
    if (typeof value === 'function') return Object.freeze([name, value]);
    const captured = safeCopy(value);
    if (Array.isArray(captured)) {
      assert(captured.length === state.count, 'PROCEDURAL_ATTRIBUTE', 'Column arrays need one value per point.');
      captured.forEach(columnValue);
    } else columnValue(captured);
    return Object.freeze([name, captured]);
  });
  const result = pointSet(
    state.seed,
    state.x,
    state.y,
    [...state.operations, Object.freeze(operation)],
    set.diagnostics,
  );
  // Validate at t=0 before returning; later invalid callback results remain explicit sample failures.
  sampleRows(result, 0);
  return result;
}
