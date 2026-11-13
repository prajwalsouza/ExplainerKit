// Deterministic measures for design work: plain counts on a script and structural checks on a telling.
// They describe; they do not grade. A high question rate or a long cascade is not evidence that an
// explanation is good, only something an author can look at. Thresholds named here are editorial choices.
import { assert } from '../core/validate.js';

const MAX_TEXT = 200000;
/** Phrases that usually signal stock narration. A heuristic list; extend it per project. */
export const STOCK_PHRASES = Object.freeze([
  'have you ever wondered',
  'in this video',
  "let's dive in",
  'dive into',
  'buckle up',
  'mind-blowing',
  'fascinating',
  'the answer may surprise you',
  'journey',
  'delve',
  'tapestry',
  'it turns out that',
  'at the end of the day',
  'stay tuned',
  "but here's the thing",
  'game-changer',
]);

/** Words that usually qualify a claim. Counted to keep spoken caveats in proportion, not to remove them. */
export const HEDGES = Object.freeze([
  'can',
  'may',
  'might',
  'suitable',
  'illustrative',
  'ideal',
  'idealized',
  'idealised',
  'typically',
  'generally',
  'specified',
  'conditions',
  'approximately',
  'roughly',
  'arguably',
  'possibly',
  'somewhat',
]);
const HEDGE_PHRASES = [
  /we haven[’']t/gi,
  /not a (?:finding|prediction|measurement)/gi,
  /under (?:the )?(?:right|ideal|comparable) conditions/gi,
];
/** Verbs that open an instruction to the viewer ("Put a lens over..."). Imagine and picture are left out on purpose. */
export const INSTRUCTIONS = Object.freeze([
  'look',
  'put',
  'take',
  'watch',
  'listen',
  'try',
  'keep',
  'place',
  'hold',
  'notice',
  'pause',
  'show',
  'add',
  'change',
  'follow',
  'aim',
  'slide',
  'compare',
  'hide',
  'uncover',
  'leave',
  'choose',
  'turn',
  'sample',
  'replay',
]);

const words = (text) => text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
const per100 = (count, total) => (total ? Math.round((count / total) * 1000) / 10 : 0);

/**
 * Counts on narration text: words, sentences, their lengths and spread, questions, address to the viewer, numbers,
 * hedges, sentences that open as instructions, stock phrases and estimated spoken minutes (at `wordsPerMinute`,
 * 150 by default).
 */
export function scriptStats(text, { wordsPerMinute = 150 } = {}) {
  assert(
    typeof text === 'string' && text.length <= MAX_TEXT,
    'INVALID_TEXT',
    `Narration must be text of at most ${MAX_TEXT} characters.`,
  );
  const all = words(text);
  const sentences = text
    .split(/(?<=[.!?…])\s+|\n{2,}/u)
    .map((s) => s.trim())
    .filter((s) => words(s).length > 0);
  const lengths = sentences.map((s) => words(s).length).sort((a, b) => a - b);
  const lower = text.toLowerCase();
  const count = (re) => (text.match(re) ?? []).length;
  const you = all.filter((w) => /^(you|your|you're|yours|yourself)$/i.test(w.replace('’', "'"))).length;
  const we = all.filter((w) => /^(i|we|me|my|our|us|i'm|we're)$/i.test(w.replace('’', "'"))).length;
  const stock = STOCK_PHRASES.filter((p) => lower.includes(p));
  const long = all.filter((w) => w.length >= 13).length;
  const hedgeSet = new Set(HEDGES);
  const hedges =
    all.filter((w) => hedgeSet.has(w.toLowerCase())).length +
    HEDGE_PHRASES.reduce((n, re) => n + (text.match(re) ?? []).length, 0);
  const mean = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  const spread = lengths.length ? Math.sqrt(lengths.reduce((a, n) => a + (n - mean) ** 2, 0) / lengths.length) : 0;
  // Bracketed stage directions ([Play the clip.]) are for the makers, not orders to the viewer.
  // Bracketed notes that put off a result ("[After filming, report...]") are holes, not stage directions.
  const placeholders = (
    text.match(
      /\[[^\]]*\b(?:after (?:filming|measurement|testing)|report the|insert|describe the actual|tbd|todo|to be confirmed)\b[^\]]*\]/gi,
    ) ?? []
  ).map((p) => p.slice(0, 120));
  const orders = sentences.filter(
    (s) => !s.startsWith('[') && INSTRUCTIONS.includes((words(s)[0] ?? '').toLowerCase()),
  ).length;
  return {
    words: all.length,
    sentences: sentences.length,
    paragraphs: text.split(/\n\s*\n/).filter((p) => p.trim()).length,
    meanSentenceWords: sentences.length ? Math.round((all.length / sentences.length) * 10) / 10 : 0,
    medianSentenceWords: lengths.length ? lengths[Math.floor(lengths.length / 2)] : 0,
    longSentences: lengths.filter((n) => n > 30).length,
    sentenceSpread: Math.round(spread * 10) / 10,
    hedgesPer100Words: per100(hedges, all.length),
    instructionSentences: orders,
    questions: count(/\?/g),
    questionsPer100Words: per100(count(/\?/g), all.length),
    viewerAddressPer100Words: per100(you, all.length),
    narratorPer100Words: per100(we, all.length),
    numbers: count(/\d+(?:[.,]\d+)?/g),
    longWordsPer100Words: per100(long, all.length),
    stockPhrases: stock,
    placeholders,
    estimatedMinutes: Math.round((all.length / wordsPerMinute) * 10) / 10,
  };
}

const id = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const ids = (values) => (Array.isArray(values) ? values.map(id).filter(Boolean) : []);

/**
 * Structural checks on a telling: an ordered list of beats, each with `id`, `gives`, `needs`, `plants`,
 * `recalls`, `opens`, `closes` and `world`, plus a `reveal` beat id. `known` lists ideas the audience already
 * has. Returns errors (a need not yet given, a recall with no earlier plant, a loop never closed, a missing
 * reveal), notes (plants never used, neighbouring beats in the same world) and measures (beats, reveal
 * position, cascade: earlier beats whose plants the reveal recalls).
 */
export function checkTelling(telling, { known = [] } = {}) {
  assert(telling && Array.isArray(telling.beats), 'INVALID_DATA', 'A telling needs a list of beats.');
  assert(telling.beats.length <= 200, 'RESOURCE_LIMIT', 'A telling may have at most 200 beats.');
  const errors = [];
  const notes = [];
  const given = new Set(ids(known));
  const planted = new Map();
  const used = new Set();
  const open = new Map();
  const beats = telling.beats.map((b) => ({
    id: id(b.id),
    gives: ids(b.gives),
    needs: ids(b.needs),
    plants: ids(b.plants),
    recalls: ids(b.recalls),
    opens: ids(b.opens),
    closes: ids(b.closes),
    world: id(b.world),
  }));
  const reveal = id(telling.reveal);
  const revealIndex = beats.findIndex((b) => b.id === reveal);
  if (revealIndex < 0) errors.push(`The reveal ${telling.reveal} is not one of the beats.`);
  beats.forEach((b, i) => {
    for (const need of b.needs)
      if (!given.has(need)) errors.push(`${b.id} needs ${need}, which no earlier beat gives.`);
    for (const cue of b.recalls) {
      if (!planted.has(cue)) errors.push(`${b.id} recalls ${cue}, which no earlier beat plants.`);
      else used.add(cue);
    }
    for (const loop of b.closes) {
      if (!open.has(loop)) errors.push(`${b.id} closes ${loop}, which no earlier beat opens.`);
      open.delete(loop);
    }
    for (const idea of b.gives) given.add(idea);
    for (const cue of b.plants) if (!planted.has(cue)) planted.set(cue, i);
    for (const loop of b.opens) open.set(loop, i);
    if (i > 0 && b.world && b.world === beats[i - 1].world)
      notes.push(`${beats[i - 1].id} and ${b.id} are both set in ${b.world}.`);
  });
  for (const [loop, i] of open) errors.push(`${beats[i].id} opens ${loop}, and no later beat closes it.`);
  for (const [cue, i] of planted)
    if (!used.has(cue)) notes.push(`${beats[i].id} plants ${cue}, and nothing recalls it.`);
  const fired = new Set();
  if (revealIndex >= 0)
    for (const cue of beats[revealIndex].recalls)
      if (planted.has(cue) && planted.get(cue) < revealIndex) fired.add(planted.get(cue));
  return {
    errors,
    notes,
    measures: {
      beats: beats.length,
      revealPosition:
        revealIndex >= 0 && beats.length > 1 ? Math.round((revealIndex / (beats.length - 1)) * 100) / 100 : null,
      cascade: fired.size,
      plants: planted.size,
      recalled: used.size,
      worlds: new Set(beats.map((b) => b.world).filter(Boolean)).size,
    },
  };
}

const STOP = new Set(
  'the a an and or of to in on at for with by from is are was were be been it its this that as into than then their there they them our your you we can not no but if so which what when how why who has have had do does'.split(
    ' ',
  ),
);
const content = (text) => new Set(words(String(text).toLowerCase()).filter((w) => w.length > 3 && !STOP.has(w)));

/**
 * How much of a mechanism an allegory carries: a mechanism step counts as covered when some correspondence's real
 * side shares at least `overlap` content words with it. A rough lexical check, meant to flag steps nobody mapped.
 */
export function allegoryCoverage(mechanism, correspondences, { overlap = 2 } = {}) {
  assert(
    Array.isArray(mechanism) && Array.isArray(correspondences),
    'INVALID_DATA',
    'Give the mechanism steps and the correspondences as lists.',
  );
  assert(
    mechanism.length <= 100 && correspondences.length <= 100,
    'RESOURCE_LIMIT',
    'At most 100 steps and 100 correspondences.',
  );
  const sides = correspondences.map((c) => content(c.real));
  const uncovered = mechanism.filter((step) => {
    const terms = content(step);
    return !sides.some((side) => [...terms].filter((w) => side.has(w)).length >= overlap);
  });
  return {
    steps: mechanism.length,
    covered: mechanism.length - uncovered.length,
    uncovered,
    correspondences: correspondences.length,
  };
}

const sentencesOf = (text) =>
  text
    .split(/(?<=[.!?…])\s+|\n{2,}/u)
    .map((s) => s.trim())
    .filter((s) => words(s).length > 0);

/**
 * Runs of consecutive short sentences: the places that make narration sound choppy. A sentence is short at
 * `short` words or fewer; a run is at least `length` of them in a row. Returns each run's sentences, so an editing
 * step can rewrite exactly those.
 */
export function shortRuns(text, { short = 9, length = 3, max = 20 } = {}) {
  assert(
    typeof text === 'string' && text.length <= MAX_TEXT,
    'INVALID_TEXT',
    `Text must be at most ${MAX_TEXT} characters.`,
  );
  const runs = [];
  let current = [];
  const close = () => {
    if (current.length >= length && runs.length < max) runs.push(current);
    current = [];
  };
  for (const sentence of sentencesOf(text)) {
    if (words(sentence).length <= short) current.push(sentence);
    else close();
  }
  close();
  return runs;
}

/** Which of `terms` appear in `text`, and how often (case-insensitive, whole words). */
export function termHits(text, terms) {
  assert(
    typeof text === 'string' && Array.isArray(terms) && terms.length <= 200,
    'INVALID_DATA',
    'Give text and at most 200 terms.',
  );
  const hits = {};
  for (const term of terms) {
    const clean = String(term).trim();
    if (!clean) continue;
    const re = new RegExp(
      `(?<![\\p{L}\\p{N}])${clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`,
      'giu',
    );
    const n = (text.match(re) ?? []).length;
    if (n) hits[clean] = n;
  }
  return hits;
}

/**
 * Philosophical vocabulary that should not be spoken to a general audience: the names of debates, schools and
 * technical terms. The depth belongs in the question and the analogy; credit thinkers in the notes.
 */
export const PHILOSOPHY_JARGON = Object.freeze([
  'qualia',
  'quale',
  'epistemolog',
  'ontolog',
  'metaphysic',
  'phenomenolog',
  'relationalis',
  'physicalis',
  'dualis',
  'functionalis',
  'solipsis',
  'theory-laden',
  'underdetermination',
  'a priori',
  'a posteriori',
  'empiricis',
  'rationalis',
  'inverted spectrum',
  'explanatory gap',
  'hard problem',
  'intentionality',
  'teleolog',
  'determinis',
  'compatibilis',
  'nominalis',
  'realism',
  'anti-realis',
  'instrumentalis',
  'falsifiab',
  'paradigm shift',
  'ontic',
]);

/** Philosophical jargon spoken in `text`, with counts (prefix matches, so "epistemolog" finds "epistemology"). */
export function philosophyJargon(text) {
  assert(
    typeof text === 'string' && text.length <= MAX_TEXT,
    'INVALID_TEXT',
    `Text must be at most ${MAX_TEXT} characters.`,
  );
  const lower = text.toLowerCase(),
    hits = {};
  for (const term of PHILOSOPHY_JARGON) {
    const n = (lower.match(new RegExp(`(?<![a-z])${term.replace(/[-]/g, '[- ]')}`, 'g')) ?? []).length;
    if (n) hits[term] = n;
  }
  return hits;
}
