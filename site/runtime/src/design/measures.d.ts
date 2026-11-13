// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Counts on narration text: words, sentences, their lengths and spread, questions, address to the viewer, numbers,
 * hedges, sentences that open as instructions, stock phrases and estimated spoken minutes (at `wordsPerMinute`,
 * 150 by default).
 */
export function scriptStats(text: any, { wordsPerMinute }?: {
    wordsPerMinute?: number | undefined;
}): {
    words: any;
    sentences: any;
    paragraphs: any;
    meanSentenceWords: number;
    medianSentenceWords: any;
    longSentences: any;
    sentenceSpread: number;
    hedgesPer100Words: number;
    instructionSentences: any;
    questions: any;
    questionsPer100Words: number;
    viewerAddressPer100Words: number;
    narratorPer100Words: number;
    numbers: any;
    longWordsPer100Words: number;
    stockPhrases: string[];
    placeholders: any;
    estimatedMinutes: number;
};
/**
 * Structural checks on a telling: an ordered list of beats, each with `id`, `gives`, `needs`, `plants`,
 * `recalls`, `opens`, `closes` and `world`, plus a `reveal` beat id. `known` lists ideas the audience already
 * has. Returns errors (a need not yet given, a recall with no earlier plant, a loop never closed, a missing
 * reveal), notes (plants never used, neighbouring beats in the same world) and measures (beats, reveal
 * position, cascade: earlier beats whose plants the reveal recalls).
 */
export function checkTelling(telling: any, { known }?: {
    known?: never[] | undefined;
}): {
    errors: string[];
    notes: string[];
    measures: {
        beats: any;
        revealPosition: number | null;
        cascade: number;
        plants: number;
        recalled: number;
        worlds: number;
    };
};
/**
 * How much of a mechanism an allegory carries: a mechanism step counts as covered when some correspondence's real
 * side shares at least `overlap` content words with it. A rough lexical check, meant to flag steps nobody mapped.
 */
export function allegoryCoverage(mechanism: any, correspondences: any, { overlap }?: {
    overlap?: number | undefined;
}): {
    steps: any;
    covered: number;
    uncovered: any;
    correspondences: any;
};
/**
 * Runs of consecutive short sentences: the places that make narration sound choppy. A sentence is short at
 * `short` words or fewer; a run is at least `length` of them in a row. Returns each run's sentences, so an editing
 * step can rewrite exactly those.
 */
export function shortRuns(text: any, { short, length, max }?: {
    short?: number | undefined;
    length?: number | undefined;
    max?: number | undefined;
}): any[];
/** Which of `terms` appear in `text`, and how often (case-insensitive, whole words). */
export function termHits(text: any, terms: any): {};
/** Philosophical jargon spoken in `text`, with counts (prefix matches, so "epistemolog" finds "epistemology"). */
export function philosophyJargon(text: any): {};
/** Phrases that usually signal stock narration. A heuristic list; extend it per project. */
export const STOCK_PHRASES: readonly string[];
/** Words that usually qualify a claim. Counted to keep spoken caveats in proportion, not to remove them. */
export const HEDGES: readonly string[];
/** Verbs that open an instruction to the viewer ("Put a lens over..."). Imagine and picture are left out on purpose. */
export const INSTRUCTIONS: readonly string[];
/**
 * Philosophical vocabulary that should not be spoken to a general audience: the names of debates, schools and
 * technical terms. The depth belongs in the question and the analogy; credit thinkers in the notes.
 */
export const PHILOSOPHY_JARGON: readonly string[];
