// The audience: who is watching, and what they already know. A eureka is not a property of a script; it happens in a
// particular head. The same reveal can land for a newcomer, be obvious to an expert, and pass a child by. So a piece
// is designed for a target viewer and audited for several, each with what they know, what they believe that is not
// so, and what they would find obvious.
//
//   build audience       (model) personas across mastery levels for the brief, one of them the target
//   audit for audience   run the insight audit once per persona, each reading as that viewer
//   audience insight     (measure) for whom the eureka lands, where, and for whom it leaks or never arrives
//
// Personas are a model's guess at kinds of viewer, not real people. They make the audit's assumptions explicit and
// comparable; they do not replace watching real viewers.
import { assert } from '../core/validate.js';
import { defineOperation } from './run.js';
import { boolean, list, oneOf, record, string } from './schema.js';
import { auditScriptInsight } from './insight.js';

/** Mastery levels, from someone meeting the topic for the first time to someone who teaches it. */
export const AUDIENCE_LEVELS = Object.freeze(['newcomer', 'familiar', 'expert']);

export const persona = record({
  id: string({ max: 40, description: 'A short kebab-case id, such as "curious-teen".' }),
  name: string({ max: 80, description: 'Who they are, in a few plain words.' }),
  level: oneOf(AUDIENCE_LEVELS),
  target: boolean(),
  knows: list(string({ max: 160 }), { min: 2, max: 8 }),
  gaps: list(string({ max: 160 }), { min: 1, max: 6 }),
  believes: list(
    string({ max: 200, description: 'Something they believe about the topic that is wrong or incomplete.' }),
    {
      max: 4,
    },
  ),
  obvious: list(string({ max: 160, description: 'Something about the topic that would bore them as a reveal.' }), {
    max: 4,
  }),
  hooks: string({ max: 240, description: 'What in their own life the topic already touches.' }),
});

export const buildAudience = defineOperation({
  name: 'build-audience',
  role: 'You are an audience researcher for a science channel. You know that a reveal which astonishes one viewer is obvious to another, and you describe viewers concretely: what they have read, done and believe, not their demographics.',
  purpose:
    'Describe the people who will watch this piece, across mastery levels, with what each already knows, does not know, wrongly believes and would find obvious.',
  method: [
    'Make one persona for each mastery level: a newcomer meeting the topic for the first time, someone familiar with it from school or hobbies, and an expert who works with it. Add one more only if the brief names a group that none of these covers.',
    "Mark as target the persona that best matches the brief's audience. The piece is designed for the target; the others are there to check it.",
    'For each, list what they already know, in their own everyday words, and the gaps that matter for this topic. Be specific: "knows that white light splits into a rainbow through a prism" rather than "knows some optics".',
    'List what each believes that is wrong or incomplete; these are where a reveal can surprise them. List what each would find obvious; a reveal built on it will not land for them.',
    'Say what in their own life the topic already touches, so the piece can start there.',
  ],
  rules: [
    'An expert is not a harder newcomer: they know the textbook account, so a eureka for them has to come from a new connection, a surprising case or an assumption they had stopped noticing.',
  ],
  output: record({ personas: list(persona, { min: 2, max: 4 }) }),
});

/** The target persona of an audience, or its first one. */
export function targetPersona(personas) {
  return personas.find((p) => p.target) ?? personas[0] ?? null;
}

/** Audit a finished script once per persona; each audit reads as that viewer and may honestly find no eureka. */
export async function auditForAudience(run, { brief, sections, cues = [], personas }) {
  assert(Array.isArray(personas) && personas.length > 0, 'INVALID_DATA', 'Give at least one persona.');
  const readings = await run.all(
    personas.map((p, i) =>
      auditScriptInsight(
        run.scope(
          personas.findIndex((q) => q.id === p.id) === i && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id)
            ? `for-${p.id}`
            : `for-persona-${i + 1}`,
        ),
        { brief, sections, cues, persona: p },
      ).then((r) => ({
        persona: p,
        ...r,
      })),
    ),
  );
  const summary = await run.call(audienceInsight, { readings });
  return { readings, summary };
}

export const audienceInsight = defineOperation({
  name: 'audience-insight',
  kind: 'measure',
  purpose:
    'Compare the insight audits across personas: for whom the main eureka lands, where in the script, how many smaller eurekas each meets, and for whom the ending leaks early or never arrives.',
  compute({ readings }) {
    assert(Array.isArray(readings), 'INVALID_DATA', 'Give the per-persona readings.');
    const rows = readings.map(({ persona: p, measures: m, audit }) => ({
      persona: p.id,
      level: p.level,
      target: Boolean(p.target),
      lands: m.aha !== null,
      ahaPosition: m.ahaPosition,
      eurekas: (audit.eurekas ?? []).length,
      leaksBeforeAha: m.leaksBeforeAha,
      strongSurprises: m.strongSurprises,
    }));
    return {
      rows,
      landsFor: rows.filter((r) => r.lands).map((r) => r.persona),
      missesFor: rows.filter((r) => !r.lands).map((r) => r.persona),
      leaksFor: rows.filter((r) => r.lands && r.leaksBeforeAha).map((r) => r.persona),
      targetLands: rows.some((r) => r.target && r.lands),
    };
  },
});

/** What the audience comparison says is wrong, as sentences; an empty list means the eureka lands for everyone. */
export function audienceProblems(summary) {
  const problems = [];
  for (const r of summary.rows) {
    if (!r.lands)
      problems.push(`No eureka lands for the ${r.level} viewer (${r.persona})${r.target ? ', the target' : ''}.`);
    else if (r.leaksBeforeAha)
      problems.push(`The ${r.level} viewer (${r.persona}) can state the ending before the eureka.`);
  }
  return problems;
}
