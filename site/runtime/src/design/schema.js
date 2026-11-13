// Output shapes for design operations. A shape does two jobs: it becomes the strict JSON Schema handed to a model
// (every property required, no extra properties), and it checks what comes back, including the limits a model
// schema cannot carry reliably (lengths, counts and ranges). Those limits are also written into each field's
// description, so the model can see them. Text gets a margin (SLACK) past its stated length before it is refused:
// a model counts characters poorly, and a slightly long answer is still a good answer. Checking is bounded and
// never runs user code.
import { KitError } from '../core/validate.js';

const LIMIT = 20000;
/** How far past its stated length a text may run before it is refused. */
export const SLACK = 1.5;
const join = (...parts) => parts.filter(Boolean).join(' ');

function shape(kind, json, check, extra = {}) {
  return Object.freeze({ kind, json: Object.freeze(json), check, ...extra });
}

/**
 * Text, at most `max` characters.
 * @param {{max?: number, description?: string}} [options]
 */
export function string({ max = 4000, description } = {}) {
  const words = Math.max(3, Math.round(max / 6));
  return shape(
    'string',
    withDescription({ type: 'string' }, join(description, `At most about ${words} words.`)),
    (value, path, errors) => {
      if (typeof value !== 'string') errors.push(`${path} must be text.`);
      else if (value.length > max * SLACK)
        errors.push(
          `${path} must be at most about ${words} words (${max} characters); it has ${value.length} characters.`,
        );
    },
  );
}

/**
 * A number between `min` and `max`.
 * @param {{min?: number, max?: number, description?: string}} [options]
 */
export function number({ min = -1e9, max = 1e9, description } = {}) {
  return shape(
    'number',
    withDescription({ type: 'number' }, join(description, min > -1e9 || max < 1e9 ? `Between ${min} and ${max}.` : '')),
    (value, path, errors) => {
      if (!(typeof value === 'number' && Number.isFinite(value))) errors.push(`${path} must be a finite number.`);
      else if (value < min || value > max) errors.push(`${path} must be between ${min} and ${max}.`);
    },
    { min, max },
  );
}

/** True or false. @param {{description?: string}} [options] */
export function boolean({ description } = {}) {
  return shape('boolean', withDescription({ type: 'boolean' }, description), (value, path, errors) => {
    if (typeof value !== 'boolean') errors.push(`${path} must be true or false.`);
  });
}

/**
 * One of a fixed list of words.
 * @param {string[]} values
 * @param {{description?: string}} [options]
 */
export function oneOf(values, { description } = {}) {
  const allowed = Object.freeze([...values]);
  return shape(
    'enum',
    withDescription({ type: 'string', enum: allowed }, description),
    (value, path, errors) => {
      if (!allowed.includes(value)) errors.push(`${path} must be one of: ${allowed.join(', ')}.`);
    },
    { values: allowed },
  );
}

/**
 * A list of items of one shape, with between `min` and `max` entries.
 * @param {any} item
 * @param {{min?: number, max?: number, description?: string}} [options]
 */
export function list(item, { min = 0, max = 100, description } = {}) {
  return shape(
    'array',
    withDescription({ type: 'array', items: item.json }, join(description, `Between ${min} and ${max} entries.`)),
    (value, path, errors, budget) => {
      if (!Array.isArray(value)) {
        errors.push(`${path} must be a list.`);
        return;
      }
      if (value.length < min || value.length > max) errors.push(`${path} must have between ${min} and ${max} entries.`);
      value.slice(0, max).forEach((entry, i) => visit(item, entry, `${path}[${i}]`, errors, budget));
    },
    { item, min, max },
  );
}

/**
 * A record with exactly these fields.
 * @param {Record<string, any>} fields
 * @param {{description?: string}} [options]
 */
export function record(fields, { description } = {}) {
  const names = Object.keys(fields);
  const properties = {};
  for (const name of names) properties[name] = fields[name].json;
  const json = withDescription(
    { type: 'object', additionalProperties: false, required: names, properties },
    description,
  );
  return shape(
    'object',
    json,
    (value, path, errors, budget) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        errors.push(`${path} must be a record.`);
        return;
      }
      for (const name of names) {
        if (!Object.hasOwn(value, name)) errors.push(`${path}.${name} is missing.`);
        else visit(fields[name], value[name], `${path}.${name}`, errors, budget);
      }
      for (const name of Object.keys(value))
        if (!Object.hasOwn(fields, name)) errors.push(`${path}.${name} is not expected.`);
    },
    { fields: Object.freeze({ ...fields }) },
  );
}

function withDescription(json, description) {
  return description ? { ...json, description } : json;
}

function visit(s, value, path, errors, budget) {
  if (++budget.count > LIMIT) {
    if (!budget.stopped) errors.push('The output has too many values to check.');
    budget.stopped = true;
    return;
  }
  if (errors.length < 50) s.check(value, path, errors, budget);
}

/** Problems with `value` against `shape`, as plain sentences; an empty list means it fits. */
export function shapeErrors(s, value) {
  const errors = [];
  visit(s, value, 'output', errors, { count: 0, stopped: false });
  return errors;
}

/** Return `value` when it fits `shape`; otherwise throw DESIGN_OUTPUT_INVALID with the problems. */
export function expectShape(s, value, name = 'output') {
  const errors = shapeErrors(s, value);
  if (errors.length) {
    const error = new KitError(
      'DESIGN_OUTPUT_INVALID',
      `${name} does not fit its shape: ${errors.slice(0, 8).join(' ')}`,
    );
    error.problems = errors;
    throw error;
  }
  return value;
}
