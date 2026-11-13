// Multimedia: Richard Mayer's principles of multimedia learning applied to the shot plan. They group by what they do
// for a viewer's limited working memory: cut what wastes attention (coherence, signalling, redundancy, spatial and
// temporal contiguity), manage what is hard (segmenting, pre-training, modality) and build engagement
// (personalization, voice, embodiment). Most are checkable in code against the timed shot plan; the rest are judged
// by a model reading the plan with the narration.
//
//   audit multimedia     (model) each shot against the principles: decoration, missing signals, labels away from
//                        their things, hard stretches without a pause, names not taught first
//   multimedia measures  (measure) redundancy between on-screen text and speech, labels said in their own shot,
//                        load per shot, early decoration, signals on protected lines, segments, pre-training
//
// The principles come from experiments on learning, mostly with short lessons. They are strong defaults, not laws:
// redundant text can help for a non-native audience, for example.
import { assert } from '../core/validate.js';
import { defineOperation } from './run.js';
import { list, oneOf, record, string } from './schema.js';
import { principleRules, principles, referenceExamples, referencesFor } from './references.js';
import { narrationEditShape, patchShape, shotDigest, shotSpans, timeShots } from './shots.js';

const MAYER = 'Mayer, Multimedia Learning (3rd ed., 2021)';

export const MULTIMEDIA_PRINCIPLES = principles([
  {
    id: 'coherence',
    rule: 'Cut words, pictures and sounds that do not carry the idea, however interesting.',
    source: `${MAYER}; Rey 2012 meta-analysis of seductive details`,
    evidence: 'measured',
  },
  {
    id: 'signalling',
    rule: 'Point at what matters: a highlight, a zoom, a colour change or a callout on the element the narration is about.',
    source: MAYER,
    evidence: 'measured',
  },
  {
    id: 'redundancy',
    rule: 'Do not print the narration on screen. On-screen text is a label, a number or a term at the moment it is said.',
    source: MAYER,
    evidence: 'measured',
  },
  {
    id: 'spatial-contiguity',
    rule: 'Put a label next to the thing it names, not in a legend or a corner.',
    source: MAYER,
    evidence: 'measured',
  },
  {
    id: 'temporal-contiguity',
    rule: 'Show a thing while the narration names it.',
    source: MAYER,
    evidence: 'measured',
  },
  {
    id: 'segmenting',
    rule: 'Break a hard stretch into pieces with a pause or hold between them, so the viewer can take each in.',
    source: MAYER,
    evidence: 'measured',
  },
  {
    id: 'pre-training',
    rule: 'Show and name the parts before the stretch that uses them together.',
    source: MAYER,
    evidence: 'measured',
  },
  {
    id: 'modality',
    rule: 'Explain with narration and pictures rather than narration and printed paragraphs.',
    source: MAYER,
    evidence: 'measured',
  },
  {
    id: 'multimedia',
    rule: 'Words and pictures together beat words alone: every stretch of narration has a picture that does work.',
    source: MAYER,
    evidence: 'measured',
  },
  {
    id: 'personalization',
    rule: 'Speak conversationally, as a person to a person.',
    source: MAYER,
    evidence: 'measured',
  },
  {
    id: 'embodiment',
    rule: 'An on-screen guide, if there is one, gestures and looks at what matters like a person would.',
    source: MAYER,
    evidence: 'measured',
  },
  {
    id: 'early-decoration',
    rule: 'Decoration does the most harm early in a lesson; keep the opening free of it.',
    source: 'Harp and Mayer 1998',
    evidence: 'measured',
  },
]);

/** Editorial thresholds for the multimedia gate. */
export const MULTIMEDIA_GATE = Object.freeze({
  maxElements: 3,
  redundantShare: 0.6,
  redundantMinWords: 5,
  maxTextWords: 12,
  openingSeconds: 60,
  maxUnpaused: 120,
});

export const auditMultimedia = defineOperation({
  name: 'audit-multimedia',
  role: 'You are a learning designer who knows the multimedia research. You read a storyboard against its narration and find what will cost the viewer attention without teaching them anything.',
  purpose:
    'Check every shot against the multimedia principles, and fix what you find with shot patches and, where the picture already says it, small narration edits.',
  method: [
    'Read the narration and the shots in order. Each shot has its idea, elements with their roles and the ideas they carry, on-screen text, framing, camera and motion.',
    'Coherence: mark elements that carry no idea. Remove them, or give them an idea to carry.',
    'Signalling: at each important moment, is there a highlight, guide, zoom or colour change on what the narration is about? Add one where it is missing.',
    'Spatial and temporal contiguity: labels sit beside their things and appear when the narration names them.',
    'Segmenting and pre-training: before a hard stretch, are its parts shown and named? Is there a hold between pieces of a long explanation?',
    'Redundancy and modality: on-screen text is short and never a copy of the narration.',
    'Write each fix as a patch to one shot field. Where a sentence only describes what the picture already shows, propose cutting or shortening it as a narration edit, naming the idea it serves. Change no facts.',
  ],
  examples: referenceExamples(referencesFor('multimedia')),
  rules: principleRules(MULTIMEDIA_PRINCIPLES),
  output: record({
    findings: list(
      record({
        shot: string({ max: 40 }),
        principle: oneOf(MULTIMEDIA_PRINCIPLES.map((p) => p.id)),
        problem: string({ max: 300 }),
      }),
      { max: 60 },
    ),
    patches: list(patchShape, { max: 60 }),
    narration: list(narrationEditShape, { max: 16 }),
  }),
});

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
const STOP = new Set(
  'the a an and or of to in on at for with by from is are was were be it its this that as into than then their there they them our your you we can not no but if so which what when how why who has have had do does'.split(
    ' ',
  ),
);
const content = (text) => (String(text).toLowerCase().match(WORD) ?? []).filter((w) => w.length > 2 && !STOP.has(w));

export const multimediaMeasures = defineOperation({
  name: 'multimedia-measures',
  kind: 'measure',
  purpose:
    'Check the shot plan against the narration: redundant or long on-screen text, labels not said in their shot, too many elements, decoration in the opening, protected moments without a signal, long unpaused stretches and names used before they are shown.',
  compute({ sections, shots, timing = null, protect = [], terms = [], gate = MULTIMEDIA_GATE }) {
    assert(Array.isArray(sections) && Array.isArray(shots), 'INVALID_DATA', 'Give the sections and the shots.');
    const t = timing ?? timeShots(sections, shots);
    const at = new Map(t.shots.map((x) => [x.id, x]));
    const spans = shotSpans(sections, shots);
    const problems = [];
    const rows = shots.map((s) => {
      const said = new Set(content(spans.get(s.id) ?? ''));
      const textWords = s.text.flatMap(content);
      const spoken = textWords.filter((w) => said.has(w)).length;
      const redundant = textWords.length >= gate.redundantMinWords && spoken / textWords.length >= gate.redundantShare;
      const long = s.text.some((x) => (x.match(WORD) ?? []).length > gate.maxTextWords);
      const unsaid = s.text.filter((x) => {
        const w = content(x);
        return w.length > 0 && w.filter((v) => said.has(v)).length === 0 && !/\d/.test(x);
      });
      const load = s.elements.filter((e) => e.role !== 'decoration').length;
      const decoration = s.elements.filter((e) => e.role === 'decoration' || !String(e.carries ?? '').trim()).length;
      const timed = at.get(s.id);
      const span = spans.get(s.id) ?? '';
      const protectedHere = protect.some(
        (line) => line && span.toLowerCase().includes(String(line).toLowerCase().slice(0, 60)),
      );
      const signalled = s.elements.some((e) => e.role === 'highlight' || e.role === 'guide') || s.camera === 'push-in';
      if (redundant)
        problems.push(
          `Shot ${s.id} prints the narration on screen ("${s.text.join(' / ')}"); keep a label or a number instead.`,
        );
      if (long)
        problems.push(
          `Shot ${s.id} has on-screen text longer than ${gate.maxTextWords} words; the narration should carry it.`,
        );
      for (const u of unsaid) problems.push(`Shot ${s.id} shows "${u}" without the narration saying it in that shot.`);
      if (load > gate.maxElements) problems.push(`Shot ${s.id} asks the viewer to track ${load} elements at once.`);
      if (decoration && timed && timed.from < gate.openingSeconds)
        problems.push(
          `Shot ${s.id} has ${decoration} decorative element${decoration > 1 ? 's' : ''} in the first ${gate.openingSeconds} seconds, where decoration costs the most.`,
        );
      if (protectedHere && !signalled)
        problems.push(`Shot ${s.id} carries a protected line (a cue or the eureka) with nothing pointing at it.`);
      return {
        id: s.id,
        load,
        decoration,
        redundant,
        long,
        unsaid: unsaid.length,
        signalled,
        protected: protectedHere,
      };
    });
    // Segmenting: the longest stretch without a hold.
    let since = 0,
      longest = 0;
    for (const x of t.shots) {
      since += x.seconds;
      longest = Math.max(longest, since);
      if (shots.find((s) => s.id === x.id)?.hold) since = 0;
    }
    if (longest > gate.maxUnpaused)
      problems.push(
        `The longest stretch without a hold is ${Math.round(longest)} seconds; add a pause between pieces.`,
      );
    // Pre-training: a term's first spoken shot should show it as a label or text.
    const pretraining = terms.map((term) => {
      const word = String(term).toLowerCase();
      const first = shots.find((s) => (spans.get(s.id) ?? '').toLowerCase().includes(word));
      const shown = first
        ? first.text.some((x) => x.toLowerCase().includes(word)) ||
          first.elements.some((e) => e.role === 'label' && e.what.toLowerCase().includes(word))
        : false;
      if (first && !shown)
        problems.push(`The term "${term}" is first said in shot ${first.id} without being shown or labelled there.`);
      return { term, shot: first?.id ?? null, shown };
    });
    return {
      shots: rows,
      meanLoad: rows.length ? Math.round((rows.reduce((n, r) => n + r.load, 0) / rows.length) * 10) / 10 : 0,
      decorative: rows.reduce((n, r) => n + r.decoration, 0),
      redundant: rows.filter((r) => r.redundant).length,
      longestUnpaused: Math.round(longest),
      pretraining,
      problems,
    };
  },
});

/** Audit the shot plan for multimedia principles and measure it; returns the audit, the measures and the problems. */
export async function checkMultimedia(run, { brief, sections, shots, timing, protect = [], terms = [] }) {
  const measures = await run.call(multimediaMeasures, { sections, shots, timing, protect, terms });
  const audit = await run.call(auditMultimedia, {
    brief,
    narration: sections.map((s, i) => ({ section: i + 1, narration: s.narration })),
    shots: shotDigest(shots, timing),
    problems: measures.problems,
  });
  return { audit, measures, problems: measures.problems };
}
