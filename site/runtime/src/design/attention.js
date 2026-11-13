// Attention: the hook, and keeping people there. A viewer arrives with some patience and spends it on every caveat,
// recap, new term and derivation; a question they now want answered, a surprise, a payoff or a person earns it back.
// A good opening is a deposit, not a fix, so the script must keep earning before the balance runs out. Insight
// engineering designs the moment understanding arrives; this module checks whether the viewer is still there for it.
//
//   research hooks      (model, searches the web) what creators, research and platforms say about hooks and keeping
//                       viewers, existing frameworks, and how other explanations of this topic open
//   engineer hooks      (model) the opening hook and its promise, a refill at every section start, a reason before
//                       every new idea, and a deposit before every heavy stretch
//   audit attention     (model) a first-time viewer's reading: the hook line, what earned and spent patience, where
//                       they would leave, the questions they carried and whether each was answered
//   attention measures  (measure) the ledger in code: spending counted in the text, earning taken from the audit's
//                       quotes found in the text, a balance curve over spoken time, its low points and droughts
//   revise for attention (model) exact line edits for the problems the measures name
//
// The ledger's costs and deposits are editorial choices, not measured constants. A model's reading predicts viewers;
// real retention needs real viewers or a platform's audience-retention data.
import { assert } from '../core/validate.js';
import { defineOperation } from './run.js';
import { boolean, list, number, oneOf, record, string } from './schema.js';
import { locateQuote } from './insight.js';
import { STOCK_PHRASES } from './measures.js';
import { PLAIN_RULES } from './shared.js';
import { applyEdits } from './terms.js';
import { referenceExamples, referencesFor } from './references.js';

/** Kinds of opening hook, after the flavours of motivation 3Blue1Brown names in judging the Summer of Math Exposition. */
export const HOOK_FLAVOURS = Object.freeze([
  'tangible-problem', // something in the viewer's life that does not work the way they assume
  'puzzle', // a question that seems impossible and is fun to try
  'surprising-observation', // a pattern or measurement that should not be there
  'broken-belief', // the usual explanation, shown not to hold
  'history', // a problem people struggled with, so the viewer joins something bigger
  'person', // someone with something at stake
  'participation', // the viewer makes or predicts something the lesson then uses
]);
/** Openings of well-made videos, studied from their first ninety seconds of captions; see references.js. */
export const HOOK_REFERENCES = referencesFor('attention', 'opening');

/** What the reference openings share, as rules the hook operations follow. */
export const HOOK_PATTERNS = Object.freeze([
  'A concrete thing the viewer can picture in the first sentence or two: a digit, a building, a bank machine, three colours.',
  'A question or an anomaly within about the first twenty seconds, not after the context.',
  'A contrast that makes the question sharp: effortless and impossible, ordinary and extraordinary, a teenager and the Pentagon.',
  'Stakes, and where there is a story, a person and a deadline.',
  'Answer the surface question quickly when it is easy, and show that the answer opens a stranger one.',
  'Show before explaining, and promise the explanation later rather than front-loading it.',
  'Name the belief the viewer probably holds, then say it is not the whole truth.',
  'An open loop that foreshadows something the viewer will want to see paid off.',
  'Motivate with the example, not with how important the field is.',
  'Keep caveats out of the opening, or make one earn its place, as a joke or as part of the puzzle.',
]);

const REFERENCE_EXAMPLES = referenceExamples(HOOK_REFERENCES);

/** What earns patience back. */
export const EARN_KINDS = Object.freeze([
  'question',
  'surprise',
  'payoff',
  'stakes',
  'person',
  'image',
  'play',
  'progress',
]);
/** What spends it. */
export const SPEND_KINDS = Object.freeze([
  'caveat',
  'recap',
  'term',
  'notation',
  'derivation',
  'abstract',
  'setup',
  'tangent',
  'repetition',
]);

/**
 * The ledger: patience on a 0 to 100 scale. It starts at `start`, drains by `drain` each spoken minute, pays the
 * costs of what the text spends and gains the deposits of what the audit says earned it. Editorial choices.
 */
export const ATTENTION_LEDGER = Object.freeze({
  start: 50,
  cap: 100,
  drain: 4,
  wordsPerMinute: 150,
  costs: Object.freeze({ caveat: 4, recap: 3, term: 3, notation: 2 }),
  auditSpend: 10,
  auditEarn: 25,
  question: 2,
});

/** Editorial thresholds for the attention gate. Times are spoken seconds. */
export const ATTENTION_GATE = Object.freeze({
  hookBy: 20,
  maxOpeningCaveats: 0,
  openingSeconds: 60,
  sectionOpeningSeconds: 45,
  maxRecapShare: 0.5,
  low: 20,
  lowFor: 45,
  maxDrought: 240,
  strongEarn: 0.5,
  maxOpenFor: 1800,
  promiseBy: 0.25,
  minAuditDensity: 0.5,
});

const quote = (description) => string({ max: 300, description: `${description} Copy it exactly from the narration.` });

export const researchHooks = defineOperation({
  name: 'research-hooks',
  role: 'You are a researcher who studies why people keep watching educational videos and why they leave. You read creators talking about their own craft, the research on curiosity and attention, and what platforms publish about retention, and you keep the three apart.',
  purpose:
    'Find what is known about opening hooks and keeping viewers through a long explanation, the frameworks and tools that already exist for it, and how other explanations of this topic open.',
  method: [
    "Search for creators describing their own craft: talks, essays and videos where explainers say how they open and how they keep people watching (for example 3Blue1Brown's notes on motivation from judging the Summer of Math Exposition, or other well-known explainers' writing on their process).",
    'Search for research on curiosity and attention that bears on it: information-gap accounts of curiosity, how questions and surprise affect attention and memory, and evidence on video length and engagement in online learning.',
    'Search for what platforms say about audience retention: how retention is measured and what they report about the first seconds of a video.',
    'Find existing frameworks, checklists or tools that already plan or audit hooks and retention, and say what each measures and what it leaves out.',
    'Find three to six existing explanations of this topic itself for a similar audience (videos, lectures, articles about the subject, not advice about making videos) and say how each opens and which flavour of hook it uses, in your own words with at most a short quote. If you cannot find one, list fewer rather than substituting general advice.',
    'Find the openings of well-made videos from channels known for strong hooks (for example Vsauce, 3Blue1Brown, Veritasium, fern and Steve Mould), on this topic if possible, from their captions or transcripts. Describe each opening move in your own words, how many seconds it takes to reach its question, and its flavour. The reference openings in the rules are a starting point; find others rather than repeating them.',
    'Keep claims to what the source supports. Mark each principle as from a creator, research or a platform, and say how strong the evidence is. Retention advice is often folklore; say so where it is.',
    'End with what applies to this brief and audience, and what does not.',
  ],
  search: true,
  effort: 'high',
  rules: [
    `Use these hook flavours: ${HOOK_FLAVOURS.join(', ')}.`,
    `Reference openings already studied: ${HOOK_REFERENCES.map((r) => `${r.creator}, ${r.title} (${r.url})`).join('; ')}.`,
  ],
  output: record({
    principles: list(
      record({
        principle: string({ max: 300 }),
        from: oneOf(['creator', 'research', 'platform']),
        evidence: oneOf(['measured', 'observed', 'opinion']),
        source: string({ max: 400, description: 'The URL you opened, and the title or speaker.' }),
      }),
      { min: 3, max: 16 },
    ),
    frameworks: list(
      record({
        name: string({ max: 120 }),
        measures: string({ max: 300 }),
        misses: string({ max: 300 }),
        source: string({ max: 400 }),
      }),
      { max: 8 },
    ),
    openings: list(
      record({
        work: string({ max: 160 }),
        opening: string({ max: 300, description: 'How it opens, in your own words.' }),
        flavour: oneOf(HOOK_FLAVOURS),
        source: string({ max: 400 }),
      }),
      { max: 6 },
    ),
    applies: string({ max: 800 }),
  }),
});

export const engineerHooks = defineOperation({
  name: 'engineer-hooks',
  role: 'You are a story editor who plans attention the way an accountant plans cash. Every caveat, recap, term and derivation is spent from the viewer’s patience; every question they now want answered, surprise, payoff and person earns it back. You never let the balance run out.',
  purpose:
    'Plan the opening hook and its promise, a refill at the start of every section, a reason before every new idea and a deposit before every heavy stretch.',
  method: [
    'Read the research and the patterns. Use what they support; leave out folklore the research marks as weak.',
    `Follow the patterns of strong openings: ${HOOK_PATTERNS.join(' ')}`,
    "Design the opening: within the first twenty spoken seconds, a concrete thing the viewer can picture and a question they feel personally. Motivate with a clear example, not a sweeping statement or a promise of what is to come. Name the flavour, and state the promise: the question the whole piece will answer, which must be the piece's own question, not a small one that is paid off in a minute and dropped.",
    'Keep caveats out of the first minute. A qualification that prevents a false belief can come once the viewer has bought in.',
    'For every section after the first, design a refill: its first lines earn patience with a new question, image, person or stake. A callback is welcome inside the refill; a recap is not a refill.',
    'Find every heavy stretch (a derivation, a run of new terms, notation) and place a deposit just before it: the reason the viewer should want what follows.',
    'For every new idea, give the reason it is needed before its name arrives: the flaw in the previous idea, the property we want, or the question it answers.',
    'List every promise the piece makes and the section that pays it. Keep a question open only as long as the viewer can still feel it.',
  ],
  examples: REFERENCE_EXAMPLES,
  rules: [`Use these hook flavours: ${HOOK_FLAVOURS.join(', ')}.`, ...PLAIN_RULES],
  output: record({
    opening: record({
      line: string({ max: 400 }),
      flavour: oneOf(HOOK_FLAVOURS),
      promise: string({ max: 300 }),
      paidIn: number({ min: 1, max: 60 }),
    }),
    refills: list(
      record({
        section: number({ min: 2, max: 60 }),
        line: string({ max: 400 }),
        kind: oneOf(EARN_KINDS),
        pays: string({ max: 240, description: 'The heavy stretch this refill pays for, if any.' }),
      }),
      { max: 40 },
    ),
    reasons: list(
      record({ idea: string({ max: 80 }), section: number({ min: 1, max: 60 }), reason: string({ max: 300 }) }),
      { max: 24 },
    ),
    promises: list(
      record({
        id: string({ max: 40 }),
        promise: string({ max: 240 }),
        madeIn: number({ min: 1, max: 60 }),
        paidIn: number({ min: 1, max: 60 }),
      }),
      { max: 16 },
    ),
  }),
});

export const auditAttention = defineOperation({
  name: 'audit-attention',
  role: 'You are a first-time viewer with your thumb over the skip button. You are curious and bright, and you have other videos waiting. When a persona is given you are that person, with their knowledge and impatience. You report honestly when you want more and when you want to leave.',
  purpose:
    'Read the script in order as a first-time viewer and record what earned and spent your patience, where you would leave, the questions you carried and whether each was answered.',
  method: [
    'The sections are numbered from 1. Read them strictly in order, and refer to each by its number.',
    'The opening: quote the hook, the first line that made you want something. Name its flavour and the promise you heard (what you now expect the piece to answer). Find where that promise is paid, by section and exact line, or give section 0 if it never is. Say whether you would still be watching after thirty seconds, and why.',
    'In each section, record the moments that moved your patience. An earning moment gives you a question you now want answered, a surprise, a payoff of something you were waiting for, stakes, a person, a vivid image, play, or a sense of progress. A spending moment asks you to hold a caveat, a recap of what you already saw, a new term, notation, a derivation, an abstract stretch, setup for a later payoff, a tangent or a repetition. Quote the exact sentence, give its effect and kind, and score its strength from 0 to 1.',
    'Record moments through the whole of each section, not only its highlights: about one for every 250 spoken words, so a long section has many. A stretch where nothing earns is worth recording as spending.',
    'Spending is not a fault. Every explanation must spend; the question is whether it earned enough first. Record spending honestly and do not invent earning to be kind.',
    'Mark where you would leave: quote the line where your thumb would move, and say why. Most sections have none.',
    'Mark new ideas that arrived without a reason: quote the line where a term, equation or method appeared before you wanted it.',
    'Track the questions you carried. For each, quote the line that opened it and the line that answered it (section 0 and an empty quote if nothing did).',
    'At the end of each section, score how much patience you have left from 0 to 1.',
    'Finally, name the strongest refill in the piece, and what would have kept you watching longer.',
  ],
  examples: REFERENCE_EXAMPLES,
  rules: [
    `Hook flavours: ${HOOK_FLAVOURS.join(', ')}, or none.`,
    `Judge the opening against the patterns of strong openings: ${HOOK_PATTERNS.join(' ')} A hook is not strong because it exists; compare it honestly with the examples.`,
    `Earning kinds: ${EARN_KINDS.join(', ')}. Spending kinds: ${SPEND_KINDS.join(', ')}.`,
  ],
  output: record({
    opening: record({
      hook: quote('The first line that made you want something.'),
      flavour: oneOf([...HOOK_FLAVOURS, 'none']),
      promise: string({ max: 300 }),
      paidIn: number({ min: 0, max: 60 }),
      paidLine: quote('The line that pays the promise, or empty.'),
      stillWatching: boolean(),
      why: string({ max: 300 }),
    }),
    sections: list(
      record({
        section: number({ min: 1, max: 60 }),
        events: list(
          record({
            quote: quote('The sentence.'),
            effect: oneOf(['earn', 'spend']),
            kind: oneOf([...EARN_KINDS, ...SPEND_KINDS]),
            strength: number({ min: 0, max: 1 }),
            why: string({ max: 160 }),
          }),
          { max: 24 },
        ),
        leave: list(record({ quote: quote('The line.'), why: string({ max: 200 }) }), { max: 3 }),
        unmotivated: list(record({ quote: quote('The line.'), why: string({ max: 200 }) }), { max: 3 }),
        patience: number({ min: 0, max: 1 }),
      }),
      { min: 1, max: 40 },
    ),
    questions: list(
      record({
        id: string({ max: 20 }),
        question: string({ max: 200 }),
        openedIn: number({ min: 1, max: 60 }),
        opened: quote('The line that opened it.'),
        closedIn: number({ min: 0, max: 60 }),
        closed: quote('The line that answered it, or empty.'),
      }),
      { max: 24 },
    ),
    strongestRefill: string({ max: 300 }),
    keepLonger: string({ max: 500 }),
  }),
});

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
const countWords = (text) => (String(text).match(WORD) ?? []).length;
const round = (value, places = 0) => Math.round(value * 10 ** places) / 10 ** places;

// Spending the text shows on its face. Heuristics, extended per project; the audit catches what they miss.
const CAVEAT =
  /\b(?:invented for|for the explanation|not a (?:measurement|finding|prediction|photograph|proof)|is not (?:a|the) (?:measurement|real|full)|cannot recover|does not prove|in a real (?:camera|system|lab)|a real \w+ (?:needs|uses|would)|real reconstruction|simplif(?:y|ied|ication)|approximately|roughly|under (?:ideal|the right) conditions|we will ignore|this is only)\b/i;
const RECAP =
  /\b(?:earlier|(?:have|has) already|already (?:seen|saw|met|used|know)|still (?:on the table|standing|here)|we (?:saw|used|met|have seen|found|learned)|remember|back to|by now|so far|recall|as before|last chapter|previous chapter)\b/i;
const TERM =
  /\b(?:is called|are called|called (?:a|an|the)?\s*\w|known as|we call|named (?:a|the)?\s*\w|the name for)\b/i;
const NOTATION = /[=≈×÷√∑∫λθφπ]|\b\d+(?:\.\d+)?\s*(?:over|times|divided by|squared)\b/;

function sentencesIn(text) {
  const out = [];
  for (const m of String(text).matchAll(/(?:[^.!?…\n]|\.(?=\d))+[.!?…]*["”’)]*/gu)) {
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const body = raw.trim();
    if (!countWords(body)) continue;
    out.push({ text: body, from: m.index + lead, to: m.index + lead + body.length, words: countWords(body) });
  }
  return out;
}

function codeSpend(text, costs) {
  const kinds = [];
  if (CAVEAT.test(text)) kinds.push('caveat');
  if (RECAP.test(text)) kinds.push('recap');
  if (TERM.test(text)) kinds.push('term');
  if (NOTATION.test(text) || (text.match(/\d+(?:\.\d+)?/g) ?? []).length >= 3) kinds.push('notation');
  return { kinds, cost: kinds.reduce((s, k) => s + (costs[k] ?? 0), 0) };
}

/** Find the sentence (index into `spoken`) that holds a quote from section `section`, or -1. */
function sentenceOf(sections, spoken, firstOf, section, text) {
  if (!Number.isInteger(section) || section < 1 || section > sections.length || !text) return -1;
  const span = locateQuote(sections[section - 1].narration, text);
  if (!span) return -1;
  const start = firstOf[section - 1],
    end = firstOf[section] ?? spoken.length;
  if (start >= end) return -1;
  for (let i = start; i < end; i++) if (spoken[i].to > span[0]) return i;
  return end - 1;
}

export const attentionMeasures = defineOperation({
  name: 'attention-measures',
  kind: 'measure',
  purpose:
    "Keep the viewer's patience ledger over spoken time: spending counted in the text, earning taken from the audit's quotes found in the text, the balance curve, its low points and droughts, the opening and every section's first seconds, and the questions left open.",
  compute({ sections, audit, ledger = ATTENTION_LEDGER, gate = ATTENTION_GATE }) {
    assert(
      Array.isArray(sections) && sections.length >= 1 && sections.length <= 60,
      'INVALID_DATA',
      'Give between 1 and 60 script sections.',
    );
    assert(audit && Array.isArray(audit.sections), 'INVALID_DATA', 'Give the attention audit.');
    const total = sections.reduce((n, s) => n + String(s.narration ?? '').length, 0);
    assert(total <= 400000, 'RESOURCE_LIMIT', 'The script may have at most 400000 characters.');
    const wps = ledger.wordsPerMinute / 60;

    // Every sentence, with its section and the spoken second it starts at.
    const spoken = [],
      firstOf = [];
    let words = 0;
    sections.forEach((s, i) => {
      firstOf.push(spoken.length);
      for (const sentence of sentencesIn(s.narration ?? '')) {
        spoken.push({ ...sentence, section: i + 1, at: words / wps, spend: 0, earn: 0, kinds: [] });
        words += sentence.words;
      }
    });
    const seconds = words / wps;

    // Spending the text shows, then the audit's moments found in the text. One sentence pays its largest cost and
    // gains its largest deposit once, so a caveat both detected and quoted is not counted twice.
    for (const s of spoken) {
      const { kinds, cost } = codeSpend(s.text, ledger.costs);
      s.kinds.push(...kinds);
      s.spend = cost;
      if (s.text.endsWith('?')) s.earn = ledger.question;
    }
    const events = [];
    let unfound = 0;
    for (const a of audit.sections)
      for (const e of a.events ?? []) {
        const i = sentenceOf(sections, spoken, firstOf, a.section, e.quote);
        if (i < 0) {
          unfound++;
          continue;
        }
        const s = spoken[i];
        if (e.effect === 'earn') s.earn = Math.max(s.earn, e.strength * ledger.auditEarn);
        else s.spend = Math.max(s.spend, e.strength * ledger.auditSpend);
        if (!s.kinds.includes(e.kind)) s.kinds.push(e.kind);
        events.push({ section: a.section, at: round(s.at), effect: e.effect, kind: e.kind, strength: e.strength });
      }

    // Walk the ledger.
    let balance = ledger.start;
    const curve = [],
      lows = [];
    let low = null;
    const step = 30;
    let next = 0;
    spoken.forEach((s, i) => {
      const length = s.words / wps;
      balance = Math.min(ledger.cap, Math.max(0, balance - (ledger.drain / 60) * length - s.spend + s.earn));
      s.balance = balance;
      const end = s.at + length;
      while (next <= end) {
        curve.push({ at: next, section: s.section, balance: round(balance, 1) });
        next += step;
      }
      if (balance < gate.low) {
        if (!low) low = { from: s.at, to: end, section: s.section, last: s.section, lines: [] };
        low.to = end;
        low.last = s.section;
        if (s.spend > 0 && low.lines.length < 40) low.lines.push(i);
      } else if (low) {
        lows.push(low);
        low = null;
      }
    });
    if (low) lows.push(low);
    const longLows = lows
      .filter((l) => l.to - l.from >= gate.lowFor)
      .map((l) => ({
        from: round(l.from),
        to: round(l.to),
        section: l.section,
        through: l.last,
        spentOn: l.lines
          .map((i) => spoken[i])
          .sort((a, b) => b.spend - a.spend)
          .slice(0, 3)
          .map((s) => ({ section: s.section, line: s.text.slice(0, 200), kinds: s.kinds })),
      }));

    // Droughts: spoken time between strong earning moments.
    const strong = spoken.filter((s) => s.earn >= gate.strongEarn * ledger.auditEarn).map((s) => s.at);
    const marks = [0, ...strong, seconds];
    const droughts = [];
    for (let i = 1; i < marks.length; i++)
      if (marks[i] - marks[i - 1] > gate.maxDrought) {
        const from = marks[i - 1];
        droughts.push({
          from: round(from),
          to: round(marks[i]),
          section: spoken.find((s) => s.at >= from)?.section ?? sections.length,
        });
      }
    const longestDrought = Math.max(0, ...marks.slice(1).map((m, i) => m - marks[i]));

    // The opening.
    const opening = spoken.filter((s) => s.at < gate.openingSeconds);
    const firstQuestion = spoken.findIndex((s) => s.text.endsWith('?'));
    const hookAt = sentenceOf(sections, spoken, firstOf, 1, audit.opening?.hook);
    const openingText = opening
      .map((s) => s.text)
      .join(' ')
      .toLowerCase();
    const promisePaid = Number.isInteger(audit.opening?.paidIn) && audit.opening.paidIn >= 1;
    const paidAt = promisePaid
      ? sentenceOf(sections, spoken, firstOf, audit.opening.paidIn, audit.opening.paidLine)
      : -1;

    // Each section's first seconds: a refill earns there; a recap opening mostly looks back.
    const openings = sections.slice(1).map((_, k) => {
      const i = k + 1,
        start = spoken[firstOf[i]]?.at ?? seconds;
      const window = spoken.filter((s) => s.section === i + 1 && s.at < start + gate.sectionOpeningSeconds);
      const recap = window.filter((s) => s.kinds.includes('recap')).length;
      const earned = window.some((s) => s.earn >= gate.strongEarn * ledger.auditEarn);
      const share = window.length ? round(recap / window.length, 2) : 0;
      return {
        section: i + 1,
        title: sections[i].beat ?? null,
        recapShare: share,
        question: window.some((s) => s.text.endsWith('?')),
        refill: earned,
        kind: share > gate.maxRecapShare ? 'recap' : earned ? 'refill' : 'flat',
        first: window[0]?.text.slice(0, 200) ?? '',
      };
    });

    // Questions the viewer carried.
    const questions = (audit.questions ?? []).map((q) => {
      const o = sentenceOf(sections, spoken, firstOf, q.openedIn, q.opened);
      const c = q.closedIn >= 1 ? sentenceOf(sections, spoken, firstOf, q.closedIn, q.closed) : -1;
      return {
        id: q.id,
        question: q.question,
        opened: o >= 0 ? round(spoken[o].at) : null,
        closed: c >= 0 ? round(spoken[c].at) : null,
        openFor: o >= 0 && c >= 0 ? round(spoken[c].at - spoken[o].at) : null,
        answered: q.closedIn >= 1,
        found: o >= 0 && (q.closedIn < 1 || c >= 0),
      };
    });

    const located = (field) =>
      audit.sections.flatMap((a) =>
        (a[field] ?? []).map((r) => {
          const i = sentenceOf(sections, spoken, firstOf, a.section, r.quote);
          return {
            section: a.section,
            at: i >= 0 ? round(spoken[i].at) : null,
            quote: r.quote,
            why: r.why,
            found: i >= 0,
          };
        }),
      );
    const totals = (effect) => {
      const out = {};
      for (const e of events.filter((x) => x.effect === effect)) out[e.kind] = (out[e.kind] ?? 0) + 1;
      return out;
    };
    const textSpend = {};
    for (const s of spoken)
      for (const k of codeSpend(s.text, ledger.costs).kinds) textSpend[k] = (textSpend[k] ?? 0) + 1;

    return {
      seconds: round(seconds),
      sentences: spoken.length,
      curve,
      final: round(balance, 1),
      lowest: round(Math.min(...spoken.map((s) => s.balance)), 1),
      lows: longLows,
      secondsLow: round(longLows.reduce((n, l) => n + (l.to - l.from), 0)),
      droughts,
      longestDrought: round(longestDrought),
      opening: {
        hook: audit.opening?.hook ?? '',
        flavour: audit.opening?.flavour ?? 'none',
        hookAt: hookAt >= 0 ? round(spoken[hookAt].at) : null,
        wordsBeforeQuestion:
          firstQuestion >= 0 ? spoken.slice(0, firstQuestion + 1).reduce((n, s) => n + s.words, 0) : null,
        caveats: opening.filter((s) => s.kinds.includes('caveat')).map((s) => s.text.slice(0, 200)),
        stockPhrases: STOCK_PHRASES.filter((p) => openingText.includes(p)),
        promise: audit.opening?.promise ?? '',
        promisePaid,
        promisePaidAt: paidAt >= 0 ? round(spoken[paidAt].at) : null,
        stillWatching: Boolean(audit.opening?.stillWatching),
      },
      openings,
      questions,
      unanswered: questions.filter((q) => !q.answered).length,
      leave: located('leave'),
      unmotivated: located('unmotivated'),
      earned: totals('earn'),
      spent: totals('spend'),
      textSpend,
      unfoundQuotes: unfound,
      auditDensity: seconds ? round(events.length / (seconds / 60), 2) : 0,
      promiseShare: paidAt >= 0 && seconds ? round(spoken[paidAt].at / seconds, 2) : null,
      patience: audit.sections.map((a) => ({ section: a.section, patience: a.patience })),
    };
  },
});

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/** What the attention measures say is wrong, as sentences; an empty list means the script passes the gate. */
export function attentionProblems(measures, gate = ATTENTION_GATE) {
  const problems = [];
  const o = measures.opening;
  if (o.hookAt === null) problems.push('No hook line is found in the opening section.');
  else if (o.hookAt > gate.hookBy)
    problems.push(
      `The hook arrives at ${clock(o.hookAt)}; the first ${gate.hookBy} seconds should make the viewer want something.`,
    );
  if (o.caveats.length > gate.maxOpeningCaveats)
    problems.push(
      `${o.caveats.length} caveat${o.caveats.length > 1 ? 's' : ''} in the first ${gate.openingSeconds} seconds spend patience before the viewer has bought in: ${o.caveats.map((c) => `"${c}"`).join('; ')}.`,
    );
  if (o.stockPhrases.length) problems.push(`Stock phrases in the opening: ${o.stockPhrases.join(', ')}.`);
  if (!o.promisePaid) problems.push(`The opening promise is never paid: "${o.promise}".`);
  else if (measures.promiseShare !== null && measures.promiseShare < gate.promiseBy)
    problems.push(
      `The opening promise is paid at ${clock(o.promisePaidAt)}, ${Math.round(measures.promiseShare * 100)}% of the way through. The hook's question should be the piece's own question and carry further: "${o.promise}".`,
    );
  if (measures.auditDensity < gate.minAuditDensity)
    problems.push(
      `The audit records only ${measures.auditDensity} moments per spoken minute, so the lows and droughts below may reflect a sparse reading rather than the script.`,
    );
  for (const s of measures.openings)
    if (s.kind !== 'refill')
      problems.push(
        `Section ${s.section} opens with ${s.kind === 'recap' ? `a recap (${Math.round(s.recapShare * 100)}% of its first ${gate.sectionOpeningSeconds} seconds look back)` : 'nothing that earns patience'}: "${s.first}".`,
      );
  for (const l of measures.lows)
    problems.push(
      `Patience is below ${gate.low} from ${clock(l.from)} to ${clock(l.to)} (${l.through > l.section ? `sections ${l.section} to ${l.through}` : `section ${l.section}`}), ${l.spentOn.length ? `spent on: ${l.spentOn.map((x) => `"${x.line}" (${x.kinds.join(', ')})`).join('; ')}` : 'drained by time with nothing earning'}.`,
    );
  for (const d of measures.droughts)
    problems.push(`Nothing strong earns patience from ${clock(d.from)} to ${clock(d.to)} (section ${d.section}).`);
  for (const q of measures.questions) {
    if (!q.answered) problems.push(`The question "${q.question}" is opened and never answered.`);
    else if (q.openFor !== null && q.openFor > gate.maxOpenFor)
      problems.push(`The question "${q.question}" stays open for ${clock(q.openFor)}; a viewer may stop feeling it.`);
  }
  for (const l of measures.leave)
    problems.push(`A viewer would leave in section ${l.section} at "${l.quote}": ${l.why}`);
  for (const u of measures.unmotivated)
    problems.push(`A new idea arrives without a reason in section ${u.section} at "${u.quote}": ${u.why}`);
  return problems;
}

export const auditAttentionPart = defineOperation({
  name: 'audit-attention-part',
  role: auditAttention.role,
  purpose:
    'Read one part of a long script as the same first-time viewer, carrying what came before, and record what earned and spent your patience, where you would leave and the questions you carried.',
  method: [
    'You have already watched the earlier parts: their titles, the questions you are still carrying and your patience at the end of the last part are given. Read only this part, in order. Its sections keep their numbers in the whole script.',
    'If this is the first part, also read the opening as the full audit would: quote the hook, name its flavour and the promise you heard, and say whether you would still be watching after thirty seconds. Find where the promise is paid in this part, or give section 0. If this is not the first part, write an empty hook, flavour none, an empty promise, section 0, an empty paid line, true and an empty reason.',
    ...auditAttention.method.slice(2, 8),
    'For every carried question that this part answers, give its id, the section and the exact line that answers it.',
    'List the questions this part opens, with the line that opened them, and the line that answered them if it is in this part (section 0 and an empty quote otherwise).',
  ],
  examples: auditAttention.examples,
  rules: auditAttention.rules,
  output: record({
    opening: auditAttention.output.fields.opening,
    sections: auditAttention.output.fields.sections,
    answered: list(
      record({ id: string({ max: 20 }), closedIn: number({ min: 1, max: 60 }), closed: quote('The answering line.') }),
      { max: 24 },
    ),
    questions: auditAttention.output.fields.questions,
  }),
});

/** Scripts longer than this many words are audited part by part. */
export const ATTENTION_PART_WORDS = 4000;

/**
 * Group sections into parts: consecutive sections sharing a `chapter` form one part, and sections with no chapter
 * are each their own part.
 */
function partsOf(sections) {
  const parts = [];
  sections.forEach((s, i) => {
    const key = s.chapter ?? `#${i}`;
    if (parts.length && parts.at(-1).key === key) parts.at(-1).indices.push(i);
    else parts.push({ key, indices: [i] });
  });
  return parts;
}

/**
 * Audit a long script part by part, in order, each part carrying the questions still open and the patience left,
 * and merge the readings into one audit with the whole script's section numbers. The opening promise is carried as
 * a question, so a later part can pay it.
 */
async function auditInParts(run, { brief, sections, persona, research }) {
  const parts = partsOf(sections);
  let opening = null,
    patience = null;
  const merged = [],
    questions = [];
  for (let k = 0; k < parts.length; k++) {
    const { indices } = parts[k];
    const open = questions.filter((q) => q.closedIn < 1);
    const reading = await run.call(
      auditAttentionPart,
      {
        brief,
        ...(persona ? { persona } : {}),
        ...(research ? { research } : {}),
        first: k === 0,
        before: {
          titles: parts.slice(0, k).flatMap((p) => p.indices.map((i) => sections[i].beat)),
          carried: open.map((q) => ({ id: q.id, question: q.question })),
          patience,
        },
        part: indices.map((i) => ({ section: i + 1, title: sections[i].beat, narration: sections[i].narration })),
      },
      { label: `audit-attention-part-${k + 1}` },
    );
    if (k === 0) {
      opening = { ...reading.opening };
      if (opening.paidIn < 1 && opening.promise)
        questions.push({
          id: 'promise',
          question: opening.promise,
          openedIn: 1,
          opened: opening.hook,
          closedIn: 0,
          closed: '',
        });
    }
    const inPart = new Set(indices.map((i) => i + 1));
    merged.push(...reading.sections.filter((x) => inPart.has(x.section)));
    for (const a of reading.answered) {
      const q = questions.find((x) => x.id === a.id && x.closedIn < 1);
      if (q && inPart.has(a.closedIn)) Object.assign(q, { closedIn: a.closedIn, closed: a.closed });
    }
    for (const q of reading.questions)
      questions.push({ ...q, id: questions.some((x) => x.id === q.id) ? `${q.id}-p${k + 1}` : q.id });
    patience = merged.at(-1)?.patience ?? patience;
  }
  const promise = questions.find((q) => q.id === 'promise');
  if (promise?.closedIn >= 1) Object.assign(opening, { paidIn: promise.closedIn, paidLine: promise.closed });
  return {
    opening,
    sections: merged,
    questions: questions.filter((q) => q.id !== 'promise').slice(0, 60),
    strongestRefill: '',
    keepLonger: '',
  };
}

/**
 * Audit a finished script for attention and measure the ledger; `research` is a research-hooks answer, if any.
 * A script longer than ATTENTION_PART_WORDS is audited part by part (by `chapter` where sections have one), which
 * keeps the reading dense enough to feed the ledger; set `parts` to force either way.
 */
export async function auditScriptAttention(run, { brief, sections, persona = null, research = null, parts = null }) {
  const words = sections.reduce((n, s) => n + countWords(s.narration ?? ''), 0);
  const inParts = parts ?? (words > ATTENTION_PART_WORDS && sections.length > 1);
  const audit = inParts
    ? await auditInParts(run, { brief, sections, persona, research })
    : await run.call(auditAttention, {
        brief,
        ...(persona ? { persona } : {}),
        ...(research ? { research } : {}),
        script: sections.map((s, i) => ({ section: i + 1, title: s.beat, narration: s.narration })),
      });
  const measures = await run.call(attentionMeasures, { sections, audit });
  return { audit, measures, problems: attentionProblems(measures) };
}

/**
 * Plan attention before drafting: research hooks for the brief, then engineer the opening, the refills, the reasons
 * and the promises over `sections`, which are the planned beats or chapters as {beat, narration} (the narration may be
 * a summary of what the beat does).
 */
export async function planAttention(run, { brief, sections, persona = null, research = null }) {
  const found = research ?? (await run.call(researchHooks, { brief, opening: sections[0]?.narration ?? '' }));
  const plan = await run.call(engineerHooks, {
    brief,
    ...(persona ? { persona } : {}),
    research: found,
    plan: sections.map((s, i) => ({ section: i + 1, beat: s.beat, does: s.narration })),
  });
  return { research: found, plan };
}

const overlaps = (text, lines) => {
  const t = String(text).toLowerCase();
  return lines.some((l) => {
    const line = String(l ?? '')
      .toLowerCase()
      .trim();
    return line.length > 0 && (t.includes(line) || line.includes(t.trim()));
  });
};

/**
 * Audit a finished script for attention and, when the gate finds problems, revise it once with exact line edits.
 * Edits that touch a `protect` line (the main eureka, a planted cue) are dropped. The revision is audited again and
 * kept only when it leaves fewer attention problems. Returns the sections to use, the audits and the pass record.
 */
export async function keepAttention(run, { brief, sections, persona = null, research = null, protect = [] }) {
  const before = await auditScriptAttention(run, { brief, sections, persona, research });
  if (!before.problems.length) return { sections, ...before, pass: null };
  const pass = run.scope('attention-pass');
  const { edits } = await pass.call(reviseForAttention, {
    brief,
    problems: before.problems,
    ...(research ? { research: research.principles } : {}),
    audit: { opening: before.audit.opening, keepLonger: before.audit.keepLonger },
    script: sections.map((s, i) => ({ section: i + 1, title: s.beat, narration: s.narration })),
  });
  const safe = edits.filter((e) => !overlaps(e.find, protect));
  const revised = applyEdits(sections, safe);
  const after = await auditScriptAttention(pass, { brief, sections: revised.sections, persona, research });
  const kept = after.problems.length < before.problems.length;
  const passRecord = {
    problems: before.problems,
    changes: revised.applied.map((e) => `Section ${e.section}: ${e.why}`),
    protected: edits.length - safe.length,
    skipped: revised.skipped,
    remaining: after.problems,
    kept,
  };
  return kept
    ? { sections: revised.sections, ...after, before, pass: passRecord }
    : { sections, ...before, rejected: after, pass: passRecord };
}

export const reviseForAttention = defineOperation({
  name: 'revise-for-attention',
  role: 'You are a script doctor brought in only for attention. You change the fewest words that keep a viewer watching, and you never change a fact.',
  purpose:
    'Fix the attention problems named, as exact line edits that code can apply: a hook in the first seconds, caveats moved out of the opening, refills instead of recaps at section starts, a deposit before heavy stretches, and promises paid.',
  method: [
    'Read the problems, the audit and the research. Fix the problems named, most costly first.',
    'An early caveat that prevents a false belief moves later, once the viewer has bought in; one that does not, shortens to a clause or goes.',
    'A recap opening becomes a refill: keep the callback in a few words and turn it into a new question, image or stake the section answers.',
    'Before a low stretch or a drought, add or sharpen one line that earns patience from material already in the script: the question this stretch answers, a prediction about to fail, or what is at stake.',
    'A promise that is never paid is either paid where the piece already answers it, by naming it there, or narrowed at the opening to what the piece really answers. A promise paid early in a long piece widens at the opening to the question the whole piece answers, with the small question as its first step.',
    'Keep the central image and its callbacks: a refill can carry the image forward with a new question about it, but do not cut the image that holds the piece together.',
    'Vary the forms. Do not open several passages with the same words (such as "For optional depth") or ask every new question in the same shape (such as "Can we...?"); a refill can be a question, an image, a prediction, a person or a stake.',
    'For each edit, give the exact words to replace and the replacement. Keep the voice, the facts and roughly the length.',
  ],
  examples: REFERENCE_EXAMPLES,
  rules: [`Patterns of strong openings and refills: ${HOOK_PATTERNS.join(' ')}`, ...PLAIN_RULES],
  output: record({
    edits: list(
      record({
        section: number({ min: 1, max: 60 }),
        find: string({ max: 600, description: 'The exact words to replace, copied from that section.' }),
        replace: string({ max: 800 }),
        why: string({ max: 200 }),
      }),
      { max: 24 },
    ),
  }),
});
