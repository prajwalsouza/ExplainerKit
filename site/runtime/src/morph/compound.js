import { assert, number, options, safeCopy } from '../core/validate.js';
import { validateProperty } from '../core/geometry.js';
import { createMorph } from './contour.js';

function contours(input) {
  const values = safeCopy(input);
  assert(
    Array.isArray(values) && values.length > 0 && values.length <= 32,
    'RESOURCE_LIMIT',
    'Use 1–32 named contours.',
  );
  const ids = new Set();
  return Object.freeze(
    values.map((value) => {
      options(value, ['id', 'commands'], 'contour');
      assert(
        typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 200 && !ids.has(value.id),
        'DUPLICATE_ID',
        'Contour IDs must be unique nonempty names.',
      );
      ids.add(value.id);
      return Object.freeze({ id: value.id, commands: validateProperty('path', 'commands', value.commands) });
    }),
  );
}
/** Named contour correspondence. Fill-rule and hole meaning remain author choices. */
export function createCompoundMorph(from, to, spec = {}) {
  options(spec, ['samples', 'tolerance', 'align', 'reverse', 'contours'], 'compound morph');
  const a = contours(from),
    b = contours(to),
    target = new Map(b.map((c) => [c.id, c]));
  assert(
    a.length === b.length && a.every((c) => target.has(c.id)),
    'MORPH_TOPOLOGY',
    'Every named contour needs a target; split/merge is explicit separate artwork.',
  );
  const overrides = safeCopy(spec.contours ?? {});
  options(
    overrides,
    a.map((c) => c.id),
    'contour overrides',
  );
  for (const value of Object.values(overrides))
    options(value, ['samples', 'tolerance', 'align', 'reverse', 'offset', 'landmarks'], 'contour override');
  const defaults = Object.fromEntries(
    ['samples', 'tolerance', 'align', 'reverse'].filter((k) => spec[k] !== undefined).map((k) => [k, spec[k]]),
  );
  const plans = a.map((c) =>
    Object.freeze({
      id: c.id,
      morph: createMorph(c.commands, target.get(c.id).commands, { ...defaults, ...overrides[c.id] }),
    }),
  );
  assert(
    plans.reduce((n, p) => n + p.morph.diagnostics.samples + 1, 0) <= 10000,
    'RESOURCE_LIMIT',
    'Compound morph exceeds the output command budget.',
  );
  const exactA = validateProperty(
      'path',
      'commands',
      a.flatMap((c) => c.commands),
    ),
    exactB = validateProperty(
      'path',
      'commands',
      b.flatMap((c) => c.commands),
    );
  return Object.freeze({
    diagnostics: Object.freeze({
      contours: Object.freeze(plans.map((p) => Object.freeze({ id: p.id, ...p.morph.diagnostics }))),
      topologyGuaranteed: false,
    }),
    sample(t) {
      number(t, 'compound morph progress', 0, 1);
      if (t === 0) return exactA;
      if (t === 1) return exactB;
      return Object.freeze(plans.flatMap((p) => p.morph.sample(t)));
    },
    inspect(t) {
      number(t, 'compound morph progress', 0, 1);
      return Object.freeze(plans.map((p) => Object.freeze({ id: p.id, ...p.morph.inspect(t) })));
    },
  });
}
