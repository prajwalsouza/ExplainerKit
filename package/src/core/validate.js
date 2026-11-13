/** Errors carry stable codes. Messages explain how to repair the authored input. */
export class KitError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'KitError';
    this.code = code;
  }
}
export function assert(condition, code, message) {
  if (!condition) throw new KitError(code, message);
}
export function number(value, name, min = -1e7, max = 1e7) {
  if (!(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max))
    assert(false, 'INVALID_NUMBER', `${name} must be finite and between ${min} and ${max}.`);
  return value;
}
export function text(value, name, max = 10000) {
  if (!(typeof value === 'string' && value.length <= max))
    assert(false, 'INVALID_TEXT', `${name} must be text of at most ${max} characters.`);
  return value;
}
const unsafeKeys = new Set(['__proto__', 'prototype', 'constructor']);
/** JSON-like values only. Descriptors are checked before reading; no user getters run. */
export function safeCopy(value, depth = 0, budget = { count: 0 }) {
  assert(depth <= 24 && ++budget.count <= 200000, 'RESOURCE_LIMIT', 'Input exceeds the nesting or value limit.');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return number(value, 'data number', -1e100, 1e100);
  if (typeof value === 'string') return text(value, 'data text');
  assert(
    value && typeof value === 'object',
    'INVALID_DATA',
    'Data must contain only JSON values, not executable code.',
  );
  assert(
    Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null,
    'INVALID_DATA',
    'Use plain records or arrays.',
  );
  if (Array.isArray(value)) {
    assert(value.length <= 200000, 'RESOURCE_LIMIT', 'Data array exceeds the value limit.');
    assert(
      Reflect.ownKeys(value).length === value.length + 1 &&
        Array.from({ length: value.length }, (_, i) => Object.hasOwn(value, i)).every(Boolean),
      'INVALID_DATA',
      'Arrays must be dense indexed values without extra properties.',
    );
  }
  const result = Array.isArray(value) ? [] : Object.create(null);
  for (const key of Object.keys(value)) {
    if (unsafeKeys.has(key)) assert(false, 'UNSAFE_KEY', `Data key ${key} is reserved.`);
    const d = Object.getOwnPropertyDescriptor(value, key);
    assert(d && 'value' in d, 'INVALID_DATA', 'Accessor properties are not accepted as data.');
    result[key] = safeCopy(d.value, depth + 1, budget);
  }
  return Object.freeze(result);
}
export function options(value, allowed, name = 'options') {
  if (!(value && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)))
    assert(false, 'INVALID_OPTIONS', `${name} must be a plain object.`);
  for (const key of Reflect.ownKeys(value)) {
    assert(
      typeof key === 'string' && Object.getOwnPropertyDescriptor(value, key).enumerable,
      'INVALID_OPTIONS',
      'Options must use enumerable string keys.',
    );
    if (!allowed.includes(key)) assert(false, 'UNKNOWN_OPTION', `${name}: unknown option ${key}.`);
    assert(
      'value' in Object.getOwnPropertyDescriptor(value, key),
      'INVALID_OPTIONS',
      'Accessor options are not supported.',
    );
  }
}
