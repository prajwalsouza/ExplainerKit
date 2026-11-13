// Insight engineering: designing the moment when understanding arrives, and measuring whether a script delivers it.
// The method follows Insight Engineering and its Narrative Design Language: write the ending first, plant the pieces it
// needs earlier as memorable cues in disguise, keep any beat from giving the ending away, and let the reveal recall
// many of them at once, so earlier moments fire together (the cascade, or waterfall).
//
//   engineer cascade  rework the chosen telling backward from its reveal: cues, disguises, leak bounds, fair play
//   check cascade     (measure) the engineered telling's structure, and its cues' placement and spacing
//   audit insight     read the finished script as a first-time viewer: expectation, surprise, recall, early guesses
//   insight measures  (measure) verify the audit against the text: cues literally planted and recalled, leak, spacing
//
// A model's reading is a prediction about viewers, not a measurement of them. The measures check what can be checked
// in the text; the rest needs real viewers.
import { assert } from '../core/validate.js';
import { defineOperation } from './run.js';
import { boolean, list, number, oneOf, record, string } from './schema.js';
import { checkTelling } from './measures.js';
import { PLAIN_RULES, section, tellingBeat } from './shared.js';

const ENGINEER =
  'You are an insight engineer. You design eureka moments the way a mystery writer designs a last chapter: the ending is written first, every clue is planted fairly and in disguise, and at the reveal many earlier moments click into place at once.';

const cue = record({
  id: string({ max: 60 }),
  cue: string({
    max: 60,
    description:
      'The exact words the narration will say, twice: a short literal phrase or number (1 to 5 words), such as "62.83", "three buckets" or "the blind man". Not a description of the moment.',
  }),
  form: oneOf(['number', 'image', 'object', 'phrase', 'person', 'question']),
  plantedIn: string({ max: 60 }),
  disguise: string({ max: 300 }),
  recalledIn: string({ max: 60 }),
});

export const engineerCascade = defineOperation({
  name: 'engineer-cascade',
  role: ENGINEER,
  purpose:
    'Rework the chosen telling backward from its reveal so that the reveal recalls as many earlier, disguised moments as it fairly can.',
  method: [
    'State the reveal: the moment the audience understands. Keep the reveal beat and the story; you are rearranging and planting, not rewriting the piece.',
    'List what the reveal needs the audience to have seen. For each need, choose a cue: a memorable number, image, object, phrase, person or question that the reveal will return to by name. Write the cue as the exact short phrase the narration will say, word for word, both where it is planted and at the reveal.',
    'Plant each cue in a different earlier beat, at least two beats before the reveal, and disguise it: put it in a different world (a kitchen, a court, a century ago) or a different form (365 shown as 19.13 squared). The cue must be worth noticing on its own, not an obvious clue.',
    'Check leak: no beat before the reveal may let an attentive viewer guess the ending outright. Bury near clues early; let far clues widen the world.',
    'Check fair play: everything the reveal uses has been shown, so the viewer could in principle have solved it.',
    'If an audience is given, design the reveal for the target persona: build it on something they wrongly believe or do not yet connect, never on something they find obvious, and plant only cues they can follow. Then, for every other persona, say honestly whether the reveal lands for them and why; where it would be obvious to an expert, add a deeper turn in the same reveal that can still surprise them.',
    'Return the full telling with its beats (keeping ids where beats are unchanged, and the same gives, needs, opens and closes rules), the cue list and the reveal beat id.',
  ],
  examples: [
    'A planted number: a puzzle about a spinning wheel leaves the viewer with "three-quarters of a turn"; at the reveal about sampling, the same three-quarters returns as the reason a fast wave looks slow.',
    'A planted person: a blind man asked what red is like appears early as a curiosity; at the reveal about private experience, he is the reason nobody can check.',
  ],
  rules: [
    "gives, needs, plants, recalls, opens and closes contain ids only; every cue id must appear in its planting beat's plants and its recalling beat's recalls.",
  ],
  output: record({
    shape: string({ max: 30 }),
    logline: string({ max: 300 }),
    beats: list(tellingBeat, { min: 5, max: 14 }),
    reveal: string({ max: 60 }),
    cues: list(cue, { min: 2, max: 8 }),
    leakNotes: string({ max: 500 }),
    forAudience: list(record({ persona: string({ max: 40 }), lands: boolean(), why: string({ max: 300 }) }), {
      max: 4,
      description: 'For each persona, when an audience is given: whether the reveal lands for them.',
    }),
  }),
});

export const checkCascade = defineOperation({
  name: 'check-cascade',
  kind: 'measure',
  purpose:
    'Check the engineered telling: its structure, that every cue is planted before the reveal and recalled at it, how far apart, and in how many worlds.',
  compute({ telling, before = null, known = [] }) {
    const structure = checkTelling(telling, { known });
    const index = new Map(telling.beats.map((b, i) => [b.id, i]));
    const reveal = index.get(telling.reveal) ?? -1;
    const errors = [...structure.errors],
      notes = [];
    const cues = telling.cues.map((c) => {
      const planted = index.get(c.plantedIn) ?? -1,
        recalled = index.get(c.recalledIn) ?? -1;
      if (planted < 0) errors.push(`Cue ${c.id} is planted in ${c.plantedIn}, which is not a beat.`);
      else if (reveal >= 0 && planted >= reveal)
        errors.push(`Cue ${c.id} is planted at or after the reveal, so it cannot fire there.`);
      else if (reveal >= 0 && planted > reveal - 2)
        notes.push(`Cue ${c.id} is planted just before the reveal, a near clue that may give it away.`);
      // A cue that returns after the reveal is a callback that closes a loop; one recalled before it is spent early.
      if (recalled < 0) errors.push(`Cue ${c.id} is never recalled.`);
      else if (recalled > reveal)
        notes.push(`Cue ${c.id} returns after the reveal, as a callback rather than part of the cascade.`);
      else if (recalled < reveal) errors.push(`Cue ${c.id} is recalled before the reveal, which spends it early.`);
      return { id: c.id, planted, recalled, distance: planted >= 0 && recalled >= 0 ? recalled - planted : null };
    });
    const worlds = new Set(cues.map((c) => telling.beats[c.planted]?.world).filter(Boolean));
    const plantBeats = new Set(cues.map((c) => c.planted).filter((i) => i >= 0));
    return {
      errors,
      notes,
      cues: cues.length,
      firingCues: cues.filter((c) => c.recalled === reveal && c.planted >= 0 && c.planted < reveal).length,
      plantBeats: plantBeats.size,
      worlds: worlds.size,
      meanDistance: cues.length
        ? Math.round((cues.reduce((s, c) => s + (c.distance ?? 0), 0) / cues.length) * 10) / 10
        : 0,
      cascade: structure.measures.cascade,
      cascadeBefore: before ? checkTelling(before, { known }).measures.cascade : null,
      revealPosition: structure.measures.revealPosition,
    };
  },
});

export const auditInsight = defineOperation({
  name: 'audit-insight',
  role: 'You are a first-time viewer who is curious, bright and impatient, and you report honestly what goes on in your head as the script plays. When a persona is given, you are that person, with their knowledge, gaps and beliefs. You also know the research on insight: surprise when an expectation breaks, the aha when scattered pieces suddenly fit.',
  purpose:
    'Read the finished script section by section as a first-time viewer and record expectation, surprise, recall and early guesses, then locate the aha and its cascade.',
  method: [
    'If a persona is given, read as that person: what they already know cannot surprise them, what they wrongly believe can, and a reveal built on something they find obvious is not a eureka for them.',
    'The sections are numbered from 1. Refer to every section by its number. Read them strictly in order. Before each one, write what you expect it to say or show next, based only on what came before.',
    'After it, score how much it surprised you from 0 to 1 (0 as expected, 1 overturned what you believed), and say why in a sentence.',
    'Surprise lands at a point, not across a section: quote the moment, the exact words of the sentence where it landed for you (or, when nothing surprised you, the line you remember most), copied character for character from the narration.',
    'Name at most eight earlier sections you actually remembered. When more came to mind, keep the ones that mattered most.',
    'Mark whether, by the end of this section, you could already state the final insight. Be honest: a guessable ending is a leak.',
    'Mark where you got lost: any line where you, as this viewer, could not picture what was meant, met a word you would have to look up, or met a label the script made up and you had forgotten. Quote the exact words that lost you and say why. Most sections have none; do not invent confusion, and do not hide it.',
    'Then map every eureka moment, small or main: a line where something clicked. For each, quote that line exactly as written, state the insight in one sentence and cite where it comes from: the earlier sections that came together to make it, quoting the exact line in each that feeds it and saying in one plain sentence what it contributed; its own section may be listed too, as the trigger. An earlier eureka can be one of the sources, so eurekas build on eurekas like a graph of citations. Give each eureka a short id (e1, e2, ...) and, when a source is itself a eureka, its id.',
    'Write what clicked as a person would say it out loud. Name the object, action or result from the scene and say why it mattered. In each source explanation, say what that earlier scene lets the viewer work out now. Avoid report phrases such as task-specific, intended use and preserve the evidence.',
    'Be honest: a script may give you no eureka at all, or only small ones. Do not invent one to be helpful. If nothing clicked, list no eurekas.',
    "Name the aha: the main eureka, where the piece's central insight lands, and every earlier section that clicked into place at that moment (the cascade). If no main eureka landed, give section 0, say in insight why it did not land for you, and leave the cascade empty.",
    'Finally, say what would have made the aha stronger.',
  ],
  output: record({
    sections: list(
      record({
        section: number({ min: 1, max: 60 }),
        expected: string({ max: 300 }),
        surprise: number({ min: 0, max: 1 }),
        why: string({ max: 300 }),
        moment: string({
          max: 300,
          description: 'The exact words of the sentence where the surprise lands, copied from the narration.',
        }),
        recalls: list(number({ min: 1, max: 60 }), { max: 8 }),
        couldStateInsight: boolean(),
        lost: list(
          record({
            quote: string({ max: 200, description: 'The exact words that lost you, copied from the narration.' }),
            why: string({ max: 200 }),
          }),
          { max: 3 },
        ),
      }),
      { min: 3, max: 40 },
    ),
    eurekas: list(
      record({
        id: string({ max: 20 }),
        section: number({ min: 1, max: 60 }),
        kind: oneOf(['main', 'small']),
        line: string({
          max: 300,
          description: 'The exact words of the line where it clicks, copied from the narration.',
        }),
        insight: string({ max: 400 }),
        because: list(
          record({
            section: number({ min: 1, max: 60 }),
            eureka: string({
              max: 20,
              description: 'The id of the eureka in that section, if it is one; otherwise an empty string.',
            }),
            quote: string({
              max: 300,
              description: 'The exact words in that section that feed the eureka, copied from the narration.',
            }),
            gives: string({
              max: 240,
              description: 'What this source contributes to the eureka, in one plain sentence.',
            }),
          }),
          { min: 1, max: 6 },
        ),
      }),
      { max: 10 },
    ),
    aha: record({
      section: number({
        min: 0,
        max: 60,
        description: 'The section where the main eureka lands, or 0 if none landed.',
      }),
      insight: string({ max: 400 }),
      cascade: list(number({ min: 1, max: 60 }), { max: 12 }),
    }),
    stronger: string({ max: 500 }),
  }),
});

const tokens = (text) =>
  String(text)
    .toLowerCase()
    .match(/[a-z0-9.]+/g) ?? [];

/**
 * Whether `cue` appears in `text`: every content word of the cue (or the whole number) must occur. Short cues are
 * matched exactly; this is a check on wording, so a cue recalled in other words is not counted.
 */
function mentions(text, cueText) {
  const words = tokens(cueText).filter((w) => w.length > 3 || /\d/.test(w));
  if (!words.length) return false;
  const have = new Set(tokens(text));
  return words.filter((w) => have.has(w)).length / words.length >= 0.75;
}

const fold = (text) =>
  String(text)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .toLowerCase();

/**
 * Where a quoted line sits in `text`, as [from, to] character offsets, or null. Tries the exact words, then the words
 * with quotes and spacing folded, then the sentence sharing at least 60% of the quote's words; a quote the model
 * paraphrased too far is not found.
 */
export function locateQuote(text, quote) {
  const raw = String(text ?? ''),
    q = String(quote ?? '').trim();
  if (!q) return null;
  const exact = raw.indexOf(q);
  if (exact >= 0) return [exact, exact + q.length];
  const folded = fold(raw),
    fq = fold(q);
  if (folded.length === raw.length) {
    const at = folded.indexOf(fq);
    if (at >= 0) return [at, at + fq.length];
  }
  const want = tokens(q).filter((w) => w.length > 2);
  if (!want.length) return null;
  let best = null,
    score = 0.6;
  for (const m of raw.matchAll(/[^.!?\n]+[.!?]*/g)) {
    const have = new Set(tokens(m[0]));
    const share = want.filter((w) => have.has(w)).length / want.length;
    if (share > score || (share === score && !best)) {
      score = share;
      const lead = m[0].length - m[0].trimStart().length;
      best = [m.index + lead, m.index + m[0].trimEnd().length];
    }
  }
  return best;
}

/**
 * Surprise as it lands: for each section, the line the audit quoted, where it falls through the whole script (0 to 1,
 * by characters), and its surprise relative to this script's own range (0 its flattest moment, 1 its strongest), so a
 * script is read against itself rather than against an absolute score.
 */
export function surpriseMoments(sections, audit) {
  const lengths = sections.map((s) => String(s.narration ?? '').length),
    total = Math.max(
      1,
      lengths.reduce((a, b) => a + b, 0),
    );
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((a, b) => a + b, 0));
  const scores = audit.sections.map((a) => a.surprise),
    low = Math.min(...scores),
    high = Math.max(...scores);
  return audit.sections
    .filter((a) => Number.isInteger(a.section) && a.section >= 1 && a.section <= sections.length)
    .map((a) => {
      const i = a.section - 1,
        span = locateQuote(sections[i].narration, a.moment);
      const at = (starts[i] + (span ? (span[0] + span[1]) / 2 : lengths[i] / 2)) / total;
      return {
        section: a.section,
        at: Math.round(at * 1000) / 1000,
        found: Boolean(span),
        surprise: a.surprise,
        relative: high > low ? Math.round(((a.surprise - low) / (high - low)) * 100) / 100 : 0,
      };
    });
}

/**
 * Read the eureka graph from an audit: each eureka cites the earlier sections (and eurekas) it comes from, and may cite
 * its own section as the trigger. Returns how many eurekas there are, the main one and how many earlier sections feed
 * it, the depth of the longest chain of eurekas citing eurekas, the sections before the main eureka that feed nothing,
 * and citations that point forward or nowhere.
 */
export function eurekaGraph(audit, count) {
  const eurekas = (audit.eurekas ?? []).slice().sort((a, b) => a.section - b.section);
  const byId = new Map(eurekas.map((e) => [e.id, e]));
  const errors = [];
  for (const e of eurekas)
    for (const b of e.because) {
      if (b.section > e.section) errors.push(`${e.id} cites section ${b.section}, which comes after it.`);
      if (b.section < 1 || b.section > count) errors.push(`${e.id} cites section ${b.section}, which does not exist.`);
      if (b.eureka && !byId.has(b.eureka)) errors.push(`${e.id} cites eureka ${b.eureka}, which is not mapped.`);
    }
  const depthOf = new Map();
  const depth = (e, seen = new Set()) => {
    if (depthOf.has(e.id)) return depthOf.get(e.id);
    if (seen.has(e.id)) return 1;
    seen.add(e.id);
    const below = e.because.map((b) => (b.eureka && byId.has(b.eureka) ? depth(byId.get(b.eureka), seen) : 0));
    const d = 1 + Math.max(0, ...below);
    depthOf.set(e.id, d);
    return d;
  };
  const main =
    eurekas.find((e) => e.kind === 'main') ??
    eurekas.find((e) => e.section === audit.aha?.section) ??
    eurekas.at(-1) ??
    null;
  const feeding = new Set(eurekas.flatMap((e) => e.because.map((b) => b.section)));
  const loose = main
    ? Array.from({ length: main.section - 1 }, (_, i) => i + 1).filter(
        (n) => !feeding.has(n) && !eurekas.some((e) => e.section === n),
      )
    : [];
  return {
    eurekas: eurekas.length,
    main: main
      ? { id: main.id, section: main.section, sources: main.because.filter((b) => b.section < main.section).length }
      : null,
    depth: eurekas.length ? Math.max(...eurekas.map((e) => depth(e))) : 0,
    loose,
    errors,
  };
}

export const insightMeasures = defineOperation({
  name: 'insight-measures',
  kind: 'measure',
  purpose:
    'Verify the insight audit against the text: which planted cues literally appear before the aha and again at it, where the ending first leaks, and how surprise is spread.',
  compute({ sections, audit, cues = [] }) {
    assert(
      Array.isArray(sections) && audit && Array.isArray(audit.sections),
      'INVALID_DATA',
      'Give the script sections and the insight audit.',
    );
    const order = sections.map((s) => s.beat);
    const ahaIndex =
      Number.isInteger(audit.aha.section) && audit.aha.section >= 1 && audit.aha.section <= sections.length
        ? audit.aha.section - 1
        : -1;
    const text = (i) => sections[i]?.narration ?? '';
    const verified = cues.filter(
      (c) =>
        ahaIndex > 0 &&
        mentions(text(ahaIndex), c.cue) &&
        sections.slice(0, ahaIndex).some((s) => mentions(s.narration, c.cue)),
    );
    const surprises = audit.sections.map((s) => s.surprise);
    const strong = audit.sections.map((s, i) => (s.surprise >= 0.6 ? i : -1)).filter((i) => i >= 0);
    let gap = 0;
    for (let i = 1; i < strong.length; i++) gap = Math.max(gap, strong[i] - strong[i - 1]);
    if (strong.length) gap = Math.max(gap, strong[0], audit.sections.length - 1 - strong.at(-1));
    const leak = audit.sections.findIndex((s) => s.couldStateInsight);
    const position = (i) => (i >= 0 && order.length > 1 ? Math.round((i / (order.length - 1)) * 100) / 100 : null);
    const cascade = new Set(audit.aha.cascade.filter((n) => n >= 1 && n - 1 < ahaIndex));
    return {
      aha: ahaIndex >= 0 ? order[ahaIndex] : null,
      ahaSection: ahaIndex >= 0 ? ahaIndex + 1 : null,
      graph: eurekaGraph(audit, sections.length),
      moments: audit.sections.every((a) => typeof a.moment === 'string') ? surpriseMoments(sections, audit) : [],
      ahaPosition: position(ahaIndex),
      cascade: cascade.size,
      verifiedCues: verified.map((c) => c.id),
      cues: cues.length,
      leakPosition: position(leak),
      leaksBeforeAha: leak >= 0 && ahaIndex >= 0 && leak < ahaIndex,
      strongSurprises: strong.length,
      meanSurprise: surprises.length
        ? Math.round((surprises.reduce((a, b) => a + b, 0) / surprises.length) * 100) / 100
        : 0,
      longestFlat: gap,
      ...lostMeasures(sections, audit, ahaIndex),
    };
  },
});

/** Where the viewer got lost: each quoted line found in its section, how many, and whether one is at the eureka. */
function lostMeasures(sections, audit, ahaIndex) {
  const lost = audit.sections.flatMap((a) =>
    (a.lost ?? [])
      .filter(() => Number.isInteger(a.section) && a.section >= 1 && a.section <= sections.length)
      .map((l) => ({
        section: a.section,
        quote: l.quote,
        why: l.why,
        found: Boolean(locateQuote(sections[a.section - 1].narration, l.quote)),
      })),
  );
  return { lost, lostLines: lost.length, lostAtAha: ahaIndex >= 0 && lost.some((l) => l.section === ahaIndex + 1) };
}

/** Engineer the cascade on a chosen telling; returns the engineered telling and its check. */
export async function engineerInsight(run, context, telling, { known = [] } = {}) {
  const engineered = await run.call(engineerCascade, { ...context, telling });
  const check = await run.call(checkCascade, { telling: engineered, before: telling, known });
  return { telling: engineered, check };
}

/** Audit a finished script for insight; `cues` are the engineered cues, if any. */
export async function auditScriptInsight(run, { brief, sections, cues = [], persona = null }) {
  const audit = await run.call(auditInsight, {
    brief,
    ...(persona ? { persona } : {}),
    script: sections.map((s, i) => ({ section: i + 1, title: s.beat, narration: s.narration })),
  });
  const measures = await run.call(insightMeasures, { sections, audit, cues });
  return { audit, measures };
}

/** The insight gate: when the audit and its measures call for a restructuring pass. Editorial thresholds. */
export const INSIGHT_GATE = Object.freeze({
  earliestAha: 0.55,
  longestFlat: 4,
  minStrongSurprises: 2,
  minVerifiedShare: 0.5,
  minSources: 2,
  maxLostLines: 1,
});

/** What the insight measures say is wrong, as sentences; an empty list means the script passes the gate. */
export function insightProblems(measures, cues = [], gate = INSIGHT_GATE) {
  const problems = [];
  if (measures.aha === null) problems.push('No section lands the main insight.');
  if (measures.leaksBeforeAha)
    problems.push(
      `A first-time viewer could state the insight ${measures.leakPosition} of the way through, before the aha at ${measures.ahaPosition}.`,
    );
  if (measures.ahaPosition !== null && measures.ahaPosition < gate.earliestAha)
    problems.push(
      `The aha lands ${measures.ahaPosition} of the way through; most of the piece then explains what was already understood.`,
    );
  if (measures.longestFlat > gate.longestFlat)
    problems.push(`${measures.longestFlat} sections pass without a strong surprise.`);
  if (measures.strongSurprises < gate.minStrongSurprises)
    problems.push(`Only ${measures.strongSurprises} strong surprises.`);
  if (measures.lostAtAha)
    problems.push(
      `The viewer got lost at the eureka: ${measures.lost
        .filter((l) => l.section === measures.ahaSection)
        .map((l) => `"${l.quote}" (${l.why})`)
        .join('; ')}. Say it in everyday words.`,
    );
  if ((measures.lostLines ?? 0) > gate.maxLostLines)
    problems.push(
      `The viewer got lost ${measures.lostLines} times: ${measures.lost.map((l) => `section ${l.section}, "${l.quote}"`).join('; ')}.`,
    );
  if (measures.graph?.main && measures.graph.main.sources < gate.minSources)
    problems.push(
      `The main eureka draws on only ${measures.graph.main.sources} earlier section; a eureka should bring at least ${gate.minSources} things together.`,
    );
  if (cues.length && measures.verifiedCues.length < cues.length * gate.minVerifiedShare)
    problems.push(
      `Only ${measures.verifiedCues.length} of ${cues.length} cues are said in the same words before the aha and at it.`,
    );
  return problems;
}

export const reviseForInsight = defineOperation({
  name: 'revise-for-insight',
  role: ENGINEER,
  purpose:
    'Restructure the script so the insight arrives later, is not given away early, and recalls its planted cues word for word.',
  method: [
    'Read the problems, the audit (what a first-time viewer expected, where they were surprised, where they could already state the insight) and its advice on how the aha could be stronger.',
    'Remove or postpone every sentence that states the insight, or makes it guessable, before the aha section. Turn early statements into questions the audience carries.',
    'Move the aha later if it comes early: let the audience predict, see the surprising result, and only then assemble the explanation.',
    'In a long flat stretch, add one surprise from the material already in the script: a prediction that fails, a number that should not be possible, a case that breaks the rule.',
    'Say every cue in its exact words where it is planted and again at the aha.',
    'Where a problem names a term or a line where a viewer got lost, rewrite that line in everyday words: the picture instead of the label.',
    "Keep the facts, the sections' cites and notes, the voice and the length roughly as they are. Return every section, in the new order, and list what you changed.",
  ],
  rules: PLAIN_RULES,
  output: record({
    sections: list(section, { min: 3, max: 20 }),
    changes: list(string({ max: 300 }), { max: 10 }),
  }),
});
