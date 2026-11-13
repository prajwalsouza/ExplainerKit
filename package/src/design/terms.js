// Terms: the words a viewer has to hold to follow the piece. A script can avoid every textbook term and still be
// jargon, because a model told to avoid jargon tends to coin labels ("a grid-related trace", "the notch") and then use
// them as if they were words. This module lists every technical term and coined label in a script, with the line that
// first lets a newcomer picture it, and checks in code where each one is used.
//
//   find terms     (model) every technical term and coined label, its picture line and how to say it plainly
//   term measures  (measure) where each term is said, whether it is pictured before its first use, whether it
//                  returns bare after a long gap, and whether the eureka line depends on it
//
// Whether a viewer can picture something is a judgement, so the list comes from a model; where and when the words
// appear is counted in the text.
import { assert } from '../core/validate.js';
import { defineOperation } from './run.js';
import { boolean, list, number, oneOf, record, string } from './schema.js';
import { locateQuote } from './insight.js';
import { PLAIN_RULES } from './shared.js';

/** Editorial thresholds: how many sections a term may go unsaid before it needs its picture again. */
export const TERMS_GATE = Object.freeze({ maxGap: 3 });

export const findTerms = defineOperation({
  name: 'find-terms',
  role: 'You are an editor who reads every script as the least expert viewer in its audience. You notice every word that viewer would have to look up, and every phrase the writer made up and then treated as a word.',
  purpose:
    'List the technical terms and coined labels a viewer must hold to follow the script, with the line that first lets them picture each one and a plain way to say it.',
  method: [
    'The sections are numbered from 1. Read them in order as the persona given, or as a curious adult with no specialist knowledge.',
    'List every technical term (a word from the field, such as "frequency band" or "spectrum") and every coined label (a short phrase the script invents and then reuses as a name, such as "the notch", "the trace" or "a shared blind spot"). Copy each exactly as the narration says it, in its shortest recurring form.',
    'For each, find the picture: the first line that lets this viewer see what it means, through something they can imagine, hear or do. Quote that line exactly and give its section. A definition in other technical words is not a picture; if there is no picture anywhere, give section 0 and an empty quote.',
    'Say how to put it in everyday words a newcomer could picture, and whether the piece truly needs the word at all.',
    'Leave out words every adult knows, names of people and places, and terms said once in passing that nothing later depends on.',
  ],
  output: record({
    terms: list(
      record({
        term: string({ max: 60, description: 'The exact words, as the narration says them.' }),
        kind: oneOf(['technical', 'coined']),
        pictureSection: number({ min: 0, max: 60 }),
        picture: string({ max: 300, description: 'The exact line that lets the viewer picture it, or empty.' }),
        plain: string({ max: 240, description: 'How to say it in everyday words a newcomer could picture.' }),
        needed: boolean(),
      }),
      { max: 20 },
    ),
  }),
});

const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The sections (0-based) whose narration says `term`, matched as whole words, ignoring case. */
function uses(sections, term) {
  const re = new RegExp(`(^|[^a-z0-9])${escapeRe(term.toLowerCase())}(?=$|[^a-z0-9])`);
  return sections.map((s, i) => (re.test(String(s.narration ?? '').toLowerCase()) ? i : -1)).filter((i) => i >= 0);
}

export const termMeasures = defineOperation({
  name: 'term-measures',
  kind: 'measure',
  purpose:
    'Check the listed terms against the text: where each is said, whether its picture comes before its first use, whether it returns bare after a long gap, and whether the eureka line depends on it.',
  compute({ sections, terms, eureka = null, gate = TERMS_GATE }) {
    assert(Array.isArray(sections) && Array.isArray(terms), 'INVALID_DATA', 'Give the script sections and the terms.');
    const rows = terms.map((t) => {
      const at = uses(sections, t.term);
      const pictured =
        t.pictureSection >= 1 &&
        t.pictureSection <= sections.length &&
        Boolean(locateQuote(sections[t.pictureSection - 1].narration, t.picture));
      const picturedAt = pictured ? t.pictureSection - 1 : -1;
      const problems = [];
      if (at.length && !pictured) problems.push('never pictured');
      else if (at.length && at[0] < picturedAt)
        problems.push(`used in section ${at[0] + 1} before its picture in section ${picturedAt + 1}`);
      let last = picturedAt;
      for (const i of at) {
        if (last >= 0 && i - last > gate.maxGap)
          problems.push(`returns bare in section ${i + 1}, ${i - last} sections after it was last said`);
        last = i;
      }
      const inEureka =
        eureka && eureka.section >= 1 && eureka.line
          ? new RegExp(`(^|[^a-z0-9])${escapeRe(t.term.toLowerCase())}(?=$|[^a-z0-9])`).test(eureka.line.toLowerCase())
          : false;
      if (inEureka) problems.push('the eureka line depends on it');
      return { term: t.term, kind: t.kind, uses: at.map((i) => i + 1), pictured, inEureka, plain: t.plain, problems };
    });
    const flagged = rows.filter((r) => r.uses.length && r.problems.length);
    return {
      terms: rows,
      coined: rows.filter((r) => r.kind === 'coined' && r.uses.length > 1).length,
      unpictured: rows.filter((r) => r.uses.length && !r.pictured).length,
      inEureka: rows.filter((r) => r.inEureka).map((r) => r.term),
      problems: flagged.map((r) => `"${r.term}" (${r.kind}): ${r.problems.join('; ')}. Say instead: ${r.plain}`),
    };
  },
});

/** List the terms in a script and check them; `eureka` is {section, line} from the target viewer's audit, if any. */
export async function checkTerms(run, { brief, sections, persona = null, eureka = null }) {
  const { terms } = await run.call(findTerms, {
    brief,
    ...(persona ? { persona } : {}),
    script: sections.map((s, i) => ({ section: i + 1, narration: s.narration })),
  });
  const measures = await run.call(termMeasures, { sections, terms, eureka });
  return { terms, measures };
}

export const rewritePlain = defineOperation({
  name: 'rewrite-plain',
  role: 'You are an editor who rewrites single lines so that a newcomer can picture them, without touching anything else. You keep the voice, the facts and the rhythm.',
  purpose:
    'Rewrite only the lines a viewer got lost in and the lines that use an unexplained term or coined label, in everyday words, as exact replacements that code can apply.',
  method: [
    'Read the problems. Each names a term or a line, the section and why it fails.',
    'For each, find the exact words in the narration that need to change (a phrase or a whole sentence) and write the replacement. Use the picture, not the label: what the viewer could imagine, hear or do.',
    'Where a term is needed later, introduce it once after its picture, and bring the picture back with it when it returns after a gap. Where it is not needed, drop the term and keep the picture.',
    'Change nothing else. Keep each replacement about the same length as what it replaces, and keep the facts exactly.',
  ],
  rules: PLAIN_RULES,
  output: record({
    edits: list(
      record({
        section: number({ min: 1, max: 60 }),
        find: string({ max: 400, description: 'The exact words to replace, copied from that section.' }),
        replace: string({ max: 500 }),
        why: string({ max: 160 }),
      }),
      { max: 16 },
    ),
  }),
});

/**
 * Apply line edits to sections: each `find` is located in its section (exactly, or by the closest sentence) and
 * replaced. Returns the new sections and which edits applied; an edit whose words cannot be found is skipped.
 */
export function applyEdits(sections, edits) {
  const next = sections.map((s) => ({ ...s }));
  const applied = [];
  for (const e of edits) {
    const i = e.section - 1;
    if (!Number.isInteger(i) || i < 0 || i >= next.length) continue;
    const text = String(next[i].narration ?? ''),
      span = locateQuote(text, e.find);
    if (!span) continue;
    next[i].narration = text.slice(0, span[0]) + e.replace + text.slice(span[1]);
    applied.push(e);
  }
  return { sections: next, applied, skipped: edits.length - applied.length };
}
