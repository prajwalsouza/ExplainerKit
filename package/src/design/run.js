// Design operations and the run that calls them. An operation is one step of a design process with a declared
// purpose and output shape. A `measure` is an ordinary function. A `model` operation is a prompt: its role,
// method, examples and rules are rendered with its input, sent to whatever model the caller supplies, and the
// answer must fit the output shape (one repair attempt, then an error). The run records every call so a
// process can be inspected afterwards and resumed without repeating finished steps.
//
// The model is an explicit input, a function ({operation, prompt, schema, effort, search}) => Promise<value>.
// This module never starts processes or makes requests itself; adapters do that.
import { assert } from '../core/validate.js';
import { expectShape, shapeErrors } from './schema.js';

export const OPERATION_KINDS = Object.freeze(['model', 'measure']);
export const EFFORTS = Object.freeze(['low', 'medium', 'high', 'xhigh', 'max']);

const NAME = /^[a-z][a-z0-9-]{0,63}$/;
const STEP_LABEL = /^[a-z][a-z0-9-]{0,199}$/;

/**
 * Declare one design operation. Model operations take `role`, `purpose`, `method` (steps), optional `examples`
 * and `rules`, an `output` shape, and whether the model may `search` the web. Measures take `compute(input)`.
 */
export function defineOperation(spec) {
  assert(spec && typeof spec === 'object', 'INVALID_OPERATION', 'An operation needs a description object.');
  const { name, kind = 'model', purpose, output } = spec;
  assert(
    typeof name === 'string' && NAME.test(name),
    'INVALID_OPERATION',
    'Operation names are short kebab-case words.',
  );
  assert(OPERATION_KINDS.includes(kind), 'INVALID_OPERATION', `${name}: kind must be model or measure.`);
  assert(
    typeof purpose === 'string' && purpose.length > 0,
    'INVALID_OPERATION',
    `${name}: say what the operation is for.`,
  );
  if (kind === 'measure') {
    assert(typeof spec.compute === 'function', 'INVALID_OPERATION', `${name}: a measure needs compute(input).`);
    return Object.freeze({ name, kind, purpose, output: output ?? null, compute: spec.compute });
  }
  assert(
    output && typeof output.check === 'function',
    'INVALID_OPERATION',
    `${name}: a model operation needs an output shape.`,
  );
  assert(typeof spec.role === 'string', 'INVALID_OPERATION', `${name}: a model operation needs a role.`);
  assert(
    Array.isArray(spec.method) && spec.method.length > 0,
    'INVALID_OPERATION',
    `${name}: a model operation needs method steps.`,
  );
  assert(
    spec.effort === undefined || EFFORTS.includes(spec.effort),
    'INVALID_OPERATION',
    `${name}: unknown effort ${spec.effort}.`,
  );
  return Object.freeze({
    name,
    kind,
    purpose,
    role: spec.role,
    method: Object.freeze([...spec.method]),
    examples: Object.freeze([...(spec.examples ?? [])]),
    rules: Object.freeze([...(spec.rules ?? [])]),
    output,
    search: Boolean(spec.search),
    effort: spec.effort,
  });
}

const BASE_RULES = [
  'Answer with JSON that fits the required shape exactly, and nothing else.',
  'Every claim of fact must be something you could defend with a source. When you are unsure, say so in the text rather than inventing detail.',
  'Use ids exactly as you defined them; ids are short kebab-case words.',
];

/** The full prompt text for a model operation and its input. */
export function renderPrompt(operation, input, extra = {}) {
  const parts = [`# ${operation.name}`, operation.role, `## Your task\n${operation.purpose}`];
  parts.push(`## Method\n${operation.method.map((step, i) => `${i + 1}. ${step}`).join('\n')}`);
  if (operation.examples.length)
    parts.push(
      `## Examples of the thinking wanted\nThese come from other topics on purpose. Learn the move, not the content.\n${operation.examples.map((e) => `- ${e}`).join('\n')}`,
    );
  if (operation.search)
    parts.push(
      '## Searching\nSearch the web. Prefer primary and unusual sources over the first popular summary. Give the URLs you actually opened.',
    );
  const rules = [...operation.rules, ...BASE_RULES];
  parts.push(`## Rules\n${rules.map((r) => `- ${r}`).join('\n')}`);
  if (extra.repair)
    parts.push(`## Your previous answer did not fit\n${extra.repair.join('\n')}\nAnswer again, fixing these problems.`);
  for (const [key, value] of Object.entries(input ?? {}))
    parts.push(`## Input: ${key}\n${typeof value === 'string' ? value : JSON.stringify(value, null, 1)}`);
  return parts.join('\n\n');
}

function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

const TOKEN_FIELDS = ['input', 'cachedInput', 'output', 'reasoning'];
function addUsage(total, usage) {
  if (!usage) return;
  for (const field of TOKEN_FIELDS)
    if (Number.isFinite(usage[field])) total[field] = (total[field] ?? 0) + usage[field];
}

/**
 * A design run. `model` is required for model operations; it returns `{output, usage}`, where usage (optional)
 * counts tokens as {input, cachedInput, output, reasoning}. `recorder` (optional) has `save(entry)` and may have
 * `load(label)` returning an earlier entry, which is reused when its input is unchanged.
 * @param {{model?: (request: any) => Promise<{output: any, usage?: any}>, recorder?: {save: (entry: any) => any, load?: (label: string) => any}, effort?: string, onStep?: (step: {label: string, status: string, ms?: number}) => void}} [options]
 */
export function createDesignRun({ model, recorder, effort = 'medium', onStep } = {}) {
  assert(EFFORTS.includes(effort), 'INVALID_OPTION', `Unknown effort ${effort}.`);
  const trace = [];
  const labels = new Set();
  const usage = {};
  const ask = async (request, tokens) => {
    const answer = await model(request);
    assert(
      answer && typeof answer === 'object' && 'output' in answer,
      'DESIGN_MODEL_INVALID',
      `The model must return {output, usage} for ${request.label}.`,
    );
    addUsage(tokens, answer.usage);
    return answer.output;
  };

  async function call(operation, input = {}, options = {}) {
    const label = options.label ?? operation.name;
    assert(
      STEP_LABEL.test(label),
      'INVALID_OPTION',
      `Step label ${label} must be kebab-case and at most 200 characters.`,
    );
    assert(
      !labels.has(label),
      'DESIGN_STEP_REPEATED',
      `The step ${label} was already called in this run; give each call its own label.`,
    );
    labels.add(label);
    const key = hash(
      JSON.stringify({ operation: operation.name, input, effort: options.effort ?? operation.effort ?? effort }),
    );
    const earlier = recorder?.load ? await recorder.load(label) : null;
    if (earlier && earlier.key === key) {
      trace.push({
        label,
        operation: operation.name,
        kind: operation.kind,
        reused: true,
        ms: 0,
        tokens: earlier.tokens ?? {},
      });
      onStep?.({ label, status: 'reused' });
      return earlier.output;
    }
    onStep?.({ label, status: 'started' });
    const started = Date.now();
    let output,
      prompt,
      attempts = 1;
    const tokens = {};
    if (operation.kind === 'measure') {
      output = operation.compute(input);
      if (operation.output) expectShape(operation.output, output, label);
    } else {
      assert(
        typeof model === 'function',
        'DESIGN_MODEL_MISSING',
        `${label} needs a model; pass one to createDesignRun.`,
      );
      const chosen = options.effort ?? operation.effort ?? effort;
      prompt = renderPrompt(operation, input);
      output = await ask(
        {
          operation: operation.name,
          label,
          prompt,
          schema: operation.output.json,
          effort: chosen,
          search: operation.search,
        },
        tokens,
      );
      const problems = shapeErrors(operation.output, output);
      if (problems.length) {
        attempts = 2;
        output = await ask(
          {
            operation: operation.name,
            label,
            prompt: renderPrompt(operation, input, { repair: problems.slice(0, 12) }),
            schema: operation.output.json,
            effort: chosen,
            search: operation.search,
          },
          tokens,
        );
        expectShape(operation.output, output, label);
      }
    }
    const entry = {
      label,
      operation: operation.name,
      kind: operation.kind,
      key,
      input,
      output,
      prompt,
      attempts,
      tokens,
      ms: Date.now() - started,
    };
    addUsage(usage, tokens);
    trace.push({
      label,
      operation: operation.name,
      kind: operation.kind,
      reused: false,
      ms: entry.ms,
      attempts,
      tokens,
    });
    if (recorder?.save) await recorder.save(entry);
    onStep?.({ label, status: 'done', ms: entry.ms });
    return output;
  }

  const all = (calls) => Promise.all(calls);
  /** A view of this run whose step labels start with `prefix`, for running one stage once per subtopic. */
  function scope(prefix) {
    assert(STEP_LABEL.test(prefix), 'INVALID_OPTION', `Scope ${prefix} must be kebab-case and at most 200 characters.`);
    return Object.freeze({
      call: (operation, input, options = {}) =>
        call(operation, input, { ...options, label: `${prefix}-${options.label ?? operation.name}` }),
      all,
      scope: (inner) => scope(`${prefix}-${inner}`),
    });
  }

  return Object.freeze({
    call,
    /** Run several calls at once; same as Promise.all, named so a process reads as a flowchart. */
    all,
    scope,
    get trace() {
      return trace.map((t) => ({ ...t }));
    },
    /** Tokens used by model calls made in this run (reused steps are not counted). */
    get usage() {
      return { ...usage };
    },
  });
}
