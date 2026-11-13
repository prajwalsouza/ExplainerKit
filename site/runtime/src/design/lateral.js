// Lateral thinking: operations that force a topic out of its obvious framing. Each follows a published method,
// reduced to steps a modest model can carry out:
//   reframe          forced lenses (invert, scale, observer, private, cost, boundary, far connection, child)
//   provoke          de Bono's provocation: an deliberately unreasonable "po" statement, then "movement" to an idea
//   random entry     de Bono's random stimulus: unrelated words chosen by code, connected to the topic
//   connect distant  Koestler's bisociation: a real shared mechanism between the topic and a far field
//   create frames    Dorst's frame creation: the core paradox, its themes, and "if we see it as X, then..." frames
//   find image       the central picture or thought experiment that makes the mechanism visible
//   wander           an unconstrained reframer that never solves the brief: twenty jumps of play and odd stories
// The stimuli and far fields are picked by a seeded measure, so a run is repeatable and the model cannot steer
// towards comfortable associations.
import { randomAt } from '../noise/vector.js';
import { assert } from '../core/validate.js';
import { defineOperation } from './run.js';
import { boolean, list, number, oneOf, record, string } from './schema.js';

const LATERAL =
  'You are a creative director trained in lateral thinking. You distrust the first idea, you follow strange connections on purpose, and you keep only what survives a hard look.';

export const LENSES = Object.freeze([
  ['invert', 'What if it did not exist, or worked the opposite way?'],
  ['scale', 'What happens at a tiny scale, a huge scale, an instant or a million years?'],
  ['observer', 'How does it look to another animal, a machine, a person from 1700, or someone with a different body?'],
  ['private', 'Is there a part of it that nobody can ever check from the outside?'],
  ['cost', 'Where does it touch money, law, war, medicine or art?'],
  ['boundary', 'Where does the idea break down, or stop being true?'],
  ['far-connection', 'Which unrelated field secretly runs on the same idea?'],
  ['child', 'What is the simplest question about it that experts still argue over?'],
]);

export const reframe = defineOperation({
  name: 'reframe',
  role: 'You are a story editor who refuses the first framing of any topic. Your job is to force new ways of looking.',
  purpose: 'Look at the topic through each lens in turn and write the question each lens makes possible.',
  method: [
    `Go through every lens, in order:\n${LENSES.map(([key, question]) => `   - ${key}: ${question}`).join('\n')}`,
    'For each lens, write one concrete question about this topic that the lens produces. Avoid questions any textbook chapter heading would ask.',
    'Say in one sentence why a person would want the answer.',
    'Then mark the two lenses that produced the strongest questions.',
  ],
  examples: [
    'Topic sound, lens private: "When you hear your own recorded voice and hate it, which version is the real you?"',
    'Topic maps, lens cost: "Why did a fake town drawn on a map to catch copiers later become real?"',
  ],
  output: record({
    angles: list(
      record({
        id: string({ max: 60 }),
        lens: oneOf(LENSES.map(([key]) => key)),
        question: string({ max: 300 }),
        why: string({ max: 300 }),
        strongest: boolean(),
      }),
      { min: LENSES.length, max: LENSES.length },
    ),
  }),
});

export const PROVOCATIONS = Object.freeze([
  ['reversal', 'Reverse the usual direction of a relationship.'],
  ['exaggeration', 'Push a quantity to an absurd extreme: zero, infinite, a billion times.'],
  ['escape', 'Take something everyone assumes is essential and remove it.'],
  ['wishful', 'State an impossible wish as if it were true.'],
  ['distortion', 'Change the order, timing or ownership of the steps.'],
]);

export const provoke = defineOperation({
  name: 'provoke',
  role: LATERAL,
  purpose:
    'Use provocation to escape the usual thinking about the topic, then move from each provocation to a usable idea.',
  method: [
    `For each provocation operation, write one "po" statement about the topic: something deliberately unreasonable.\n${PROVOCATIONS.map(([key, how]) => `   - ${key}: ${how}`).join('\n')}`,
    'Do not judge the provocation. Instead, move from it: what would follow if it were true? What principle does it point at? What is interesting about the difference between it and reality?',
    'Write the idea the movement produced: a story, a question or a demonstration that is sound, even though the provocation was not.',
  ],
  examples: [
    'Topic traffic, escape: "Po, roads have no lanes." Movement: drivers already self-organise at low density. Idea: the town that removed its traffic lights and had fewer crashes.',
    'Topic memory, reversal: "Po, we remember the future and forget the past." Movement: memory is reconstruction, not playback. Idea: the eyewitness who confidently remembers a face she never saw.',
  ],
  output: record({
    provocations: list(
      record({
        id: string({ max: 60 }),
        operation: oneOf(PROVOCATIONS.map(([key]) => key)),
        po: string({ max: 300 }),
        movement: string({ max: 500 }),
        idea: string({ max: 500 }),
      }),
      { min: PROVOCATIONS.length, max: PROVOCATIONS.length },
    ),
  }),
});

/** Concrete, unrelated words for random entry. Ordinary objects work better than abstractions. */
export const STIMULI = Object.freeze(
  'anchor ladder umbrella jam lighthouse violin glacier receipt beehive passport chalk mirror bicycle seed tattoo kettle rope crown postcard cactus elevator bruise compass orchestra pillow river cathedral lottery shadow cheese tunnel feather prison balloon fingerprint harvest marble wedding volcano library button mask parachute coin bridge oyster snowflake scarecrow wristwatch avalanche ballot hammock telescope candle fossil chess queue ghost recipe staircase magnet harbour diary trumpet tide quilt helmet sponge desert circus vaccine keyhole carousel'.split(
    ' ',
  ),
);

/** Fields far from most science topics, for bisociation. */
export const FAR_FIELDS = Object.freeze([
  'cooking',
  'law and courts',
  'football tactics',
  'religion and ritual',
  'fashion',
  'banking',
  'military logistics',
  'theatre',
  'farming',
  'cartography',
  'poker',
  'architecture',
  'beekeeping',
  'shipping and ports',
  'perfumery',
  'typography',
  'the postal service',
  'dance',
  'lock-picking',
  'wine-making',
  'elections',
  'insurance',
  'sign language',
  'knitting',
  'detective work',
  'air-traffic control',
  'tea ceremony',
  'circus acts',
  'tax law',
  'gardening',
]);

function pick(items, seed, count, channel) {
  const order = items.map((item, i) => [randomAt(seed, i, channel), item]).sort((a, b) => a[0] - b[0]);
  return order.slice(0, count).map(([, item]) => item);
}

export const pickStimuli = defineOperation({
  name: 'pick-stimuli',
  kind: 'measure',
  purpose: 'Choose random words and far fields for lateral thinking, repeatably from a seed.',
  compute({ seed = 1, words = 4, fields = 3 }) {
    assert(
      Number.isInteger(seed) && words <= 12 && fields <= 8,
      'INVALID_OPTION',
      'Give an integer seed and at most 12 words and 8 fields.',
    );
    return { words: pick(STIMULI, seed, words, 1), fields: pick(FAR_FIELDS, seed, fields, 2) };
  },
});

export const randomEntry = defineOperation({
  name: 'random-entry',
  role: LATERAL,
  purpose: 'Connect each random word to the topic, and keep the connections that open a real idea.',
  method: [
    'Take each word in turn. List its features: what it does, what it is made of, where it is found, what it means to people.',
    'Use each feature as a bridge to the topic. Write down several connections quickly, including silly ones.',
    'Keep the best connection per word: one that suggests a story, a demonstration, an image or a question that is true to the science.',
  ],
  examples: [
    'Topic immunity, word "receipt": shops keep receipts to prove a past sale; memory cells keep a record of a past infection. Idea: the immune system as a shop that never throws a receipt away.',
  ],
  output: record({
    entries: list(
      record({
        id: string({ max: 60 }),
        word: string({ max: 40 }),
        bridge: string({ max: 300 }),
        idea: string({ max: 500 }),
      }),
      { min: 1, max: 12 },
    ),
  }),
});

export const connectDistant = defineOperation({
  name: 'connect-distant',
  role: LATERAL,
  purpose: 'For each far field, find a real shared mechanism with the topic (bisociation), not a surface pun.',
  method: [
    'Describe the core mechanism of the topic in one abstract sentence, without its own vocabulary.',
    'For each far field, find a practice, problem or object in it that runs on the same abstract mechanism.',
    'Test it: would an expert in both fields agree the structure is the same? If not, say it is only a metaphor and score it low.',
    'Write the story or explanation the connection makes possible.',
  ],
  examples: [
    'Topic evolution, field banking: compound interest and population growth share one equation; the connection explains why tiny advantages win over thousands of generations.',
  ],
  output: record({
    links: list(
      record({
        id: string({ max: 60 }),
        field: string({ max: 60 }),
        counterpart: string({ max: 300 }),
        sharedMechanism: string({ max: 400 }),
        idea: string({ max: 500 }),
        strength: number({ min: 0, max: 1 }),
      }),
      { min: 1, max: 8 },
    ),
  }),
});

export const createFrames = defineOperation({
  name: 'create-frames',
  role: 'You are a design researcher who practises frame creation: you solve hard problems by changing how they are seen.',
  purpose: 'Find the paradox at the heart of the topic and create new frames for it.',
  method: [
    'State the core paradox: two things that are both true about the topic and seem to contradict each other, or what people want from it versus what it does.',
    'Look at the wider context: who is involved, what they value, what history, culture or practice shapes how they see it. Name the deeper themes underneath.',
    'Create frames in the form "If we see it as ..., then ...". Each frame should change what counts as the interesting question.',
    'Say which frame most changes the story you could tell.',
  ],
  examples: [
    'Topic sleep, paradox: we lose a third of life to it, yet every animal with a brain sleeps. Frame: if we see sleep as maintenance the brain cannot do while running, then the question becomes what breaks when we skip it.',
  ],
  output: record({
    paradox: string({ max: 500 }),
    themes: list(string({ max: 200 }), { min: 2, max: 6 }),
    frames: list(
      record({ id: string({ max: 60 }), frame: string({ max: 400 }), question: string({ max: 300 }), best: boolean() }),
      { min: 3, max: 6 },
    ),
  }),
});

export const findImage = defineOperation({
  name: 'find-image',
  role: LATERAL,
  purpose:
    'Find the one central image, model or thought experiment that makes the chosen mechanism visible and carries the whole piece.',
  method: [
    'List at least six candidate images: a physical model, a machine, a thought experiment, an imagined creature or alien, an everyday object pushed to an extreme, a game.',
    'For each, check: does manipulating the image reproduce the actual mechanism, step by step? Where does it break?',
    'Choose the image that is easiest to picture, most faithful, and can be returned to at the end with a new meaning.',
  ],
  examples: [
    'For frequency analysis: wrapping a wave around a circle and watching where its centre of mass goes.',
    'For private experience: an alien who knows every nerve that carries pain but has never felt it.',
  ],
  output: record({
    candidates: list(
      record({ image: string({ max: 300 }), faithful: string({ max: 300 }), breaks: string({ max: 300 }) }),
      { min: 4, max: 8 },
    ),
    chosen: string({ max: 300 }),
    why: string({ max: 500 }),
    returnAtEnd: string({ max: 300 }),
  }),
});

/** Run the lateral operations together on a brief; returns their outputs keyed by kind. */
export async function lateralPass(run, brief, { seed = 1 } = {}) {
  const [stimuli, more] = await run.all([
    run.call(pickStimuli, { seed }),
    run.call(pickStimuli, { seed: seed + 1000 }, { label: 'pick-stimuli-wander' }),
  ]);
  const about = { brief };
  const [angles, provocations, entries, links, frames, wanderA, wanderB] = await run.all([
    run.call(reframe, about),
    run.call(provoke, about),
    run.call(randomEntry, { ...about, words: stimuli.words }),
    run.call(connectDistant, { ...about, fields: stimuli.fields }),
    run.call(createFrames, about),
    run.call(wander, { ...about, words: stimuli.words }, { label: 'wander-a' }),
    run.call(wander, { ...about, words: more.words }, { label: 'wander-b' }),
  ]);
  const { wanderings } = await run.call(keepWanderings, { wanderings: [wanderA, wanderB] });
  return {
    reframings: angles.angles,
    provocations: provocations.provocations,
    randomEntries: entries.entries,
    distantLinks: links.links,
    frames: frames.frames,
    paradox: frames.paradox,
    wanderings,
  };
}

export const wander = defineOperation({
  name: 'wander',
  role: 'You are a wildly curious, slightly unhinged polymath at 2 a.m. You are not trying to solve anything. You follow every tangent, love absurd questions, and collect strange true stories the way other people collect stamps.',
  purpose:
    'Wander as far as you can from the topic while keeping a thread to it: generate playful adjacent topics, absurd questions and sideways stories. Do not try to answer the brief.',
  method: [
    "Start from the topic and the random words. Make at least twenty jumps. Each jump goes somewhere the previous one did not: animals, toys, food, crime, religion, sport, outer space, childhood, music, the body, money, language, history's oddest people.",
    'For each jump write a playful question or an odd true story, and the thin thread that still ties it to the topic.',
    'Include at least five questions that sound like jokes but have a real answer, and at least five true stories that sound made up.',
    'Do not filter for usefulness. Rate each one only for how much fun it is (0 to 1).',
  ],
  examples: [
    'Topic sleep → "Do fish dream?" → dolphins sleep with half a brain → the record for staying awake (a student in 1964, eleven days) → what soldiers hallucinate after three nights → why the Moon was once blamed for madness.',
  ],
  output: record({
    jumps: list(
      record({
        id: string({ max: 60 }),
        idea: string({ max: 400 }),
        kind: oneOf(['question', 'story', 'image', 'game']),
        thread: string({ max: 200 }),
        fun: number({ min: 0, max: 1 }),
      }),
      { min: 15, max: 30 },
    ),
  }),
});

const terms = (text) =>
  new Set(
    String(text)
      .toLowerCase()
      .match(/[a-z]{4,}/g) ?? [],
  );

export const keepWanderings = defineOperation({
  name: 'keep-wanderings',
  kind: 'measure',
  purpose: 'Merge several wanderings, drop near-duplicates by word overlap, and keep the most fun, diverse ones.',
  compute({ wanderings, keep = 16 }) {
    const all = wanderings
      .flatMap((w, k) => w.jumps.map((j) => ({ ...j, id: `w${k}-${j.id}` })))
      .sort((a, b) => b.fun - a.fun);
    const kept = [];
    for (const jump of all) {
      const words = terms(jump.idea);
      const similar = kept.some((other) => {
        const theirs = terms(other.idea);
        const shared = [...words].filter((w) => theirs.has(w)).length;
        return shared / Math.max(1, Math.min(words.size, theirs.size)) > 0.5;
      });
      if (!similar) kept.push(jump);
      if (kept.length >= keep) break;
    }
    return { wanderings: kept };
  },
});

// The reframing loop ------------------------------------------------------------------------------------------
// Depth comes from reading a question again and again in different frames, and from what other people have already
// thought about it. Each round reframes the current question through lens families it has not used yet, drops frames
// too close to earlier ones, reads the literature on the rest, and chooses the deepest question that still touches
// the mechanism. That question is the next round's focus, so every round starts somewhere new.

export const LENS_FAMILIES = Object.freeze([
  ['inside', 'What is it like from the inside? What about it can be felt but never shared or checked?'],
  ['knowing', 'How do we know? What would count as evidence, and what could never be tested?'],
  ['being', 'What is it, really? Is it out in the world, in us, or in the relation between them?'],
  ['value', 'What matters here? What should we do, who decides, and what is lost?'],
  ['history', 'How did people think about it before? Who argued, and what changed their minds?'],
  ['limits', 'Where does explanation stop? What is the model, and what is the thing itself?'],
  ['others', 'What does it say about other minds, about community, about being human?'],
  ['time', 'What does it look like across deep time, a lifetime, or the scale of the universe?'],
]);

export const pickLenses = defineOperation({
  name: 'pick-lenses',
  kind: 'measure',
  purpose:
    'Choose lens families for a reframing round, repeatably from a seed, never repeating one already used in the loop.',
  compute({ seed = 1, round = 0, used = [], count = 2 }) {
    const fresh = LENS_FAMILIES.filter(([key]) => !used.includes(key));
    const pool = fresh.length >= count ? fresh : LENS_FAMILIES;
    return { lenses: pick(pool, seed + round * 7919, count, 3).map(([key, question]) => ({ key, question })) };
  },
});

const words = (text) =>
  new Set(
    String(text)
      .toLowerCase()
      .match(/[a-z]{5,}/g) ?? [],
  );

export const deepenFrame = defineOperation({
  name: 'deepen-frame',
  role: 'You are a philosopher of science who also writes for the public. You read a question slowly, in more than one frame, until it opens onto something larger, and you never lose the thread back to the actual mechanism.',
  purpose:
    'Reframe the current question through the lens families given, going one level deeper than the earlier rounds in the history.',
  method: [
    'Read the focus question and the history of earlier rounds. Do not repeat a frame or question that is already there.',
    'For each lens family, read the focus again inside that lens and write a frame in the form "If we see it as ..., then ...".',
    'Write the question each frame makes possible. It should be one level deeper than the focus: more general, more human, or more about the limits of knowing, but still answerable in part by the science.',
    'Say how the question still connects to the mechanism, in one sentence. A question that has lost the science is a different video.',
  ],
  examples: [
    'Focus: why does a recorded voice sound wrong to its owner? Lens inside: if we see hearing as partly bone, then the question becomes whether anyone has ever heard their own voice as others do.',
    'Focus: how do clocks agree? Lens being: if we see time as something we agree on rather than find, then the question becomes what "now" means for two people far apart.',
  ],
  output: record({
    frames: list(
      record({
        id: string({ max: 60 }),
        lens: string({ max: 30 }),
        frame: string({ max: 400 }),
        question: string({ max: 300 }),
        connection: string({ max: 300 }),
      }),
      { min: 2, max: 6 },
    ),
  }),
});

export const freshFrames = defineOperation({
  name: 'fresh-frames',
  kind: 'measure',
  purpose:
    'Drop frames whose questions share most of their words with questions from earlier rounds, keeping at least one.',
  compute({ frames, history = [], overlap = 0.5 }) {
    const earlier = history.map((q) => words(q));
    const fresh = frames.filter((f) => {
      const mine = words(f.question);
      return !earlier.some(
        (old) => [...mine].filter((w) => old.has(w)).length / Math.max(1, Math.min(mine.size, old.size)) > overlap,
      );
    });
    return { frames: fresh.length ? fresh : frames.slice(0, 1), dropped: frames.length - Math.max(1, fresh.length) };
  },
});

export const readAround = defineOperation({
  name: 'read-around',
  role: 'You are a research librarian for philosophy and the history of science. You find what serious people have already written about a question.',
  purpose:
    'Find literature on each frame: philosophers, essays, papers, books and classic thought experiments that bear on its question.',
  search: true,
  method: [
    'For each frame, search reference works first (the Stanford Encyclopedia of Philosophy, the Internet Encyclopedia of Philosophy), then the classic papers, essays and books they cite, then good recent writing.',
    'Prefer a named argument or thought experiment over a general topic: a specific work, its author and year, and what it argues in one or two sentences of your own.',
    'Say how the reading changes the question: what it sharpens, what it overturns, or what it adds that the science alone does not.',
    'Mark readings you could not open or confirm as unsure.',
  ],
  output: record({
    readings: list(
      record({
        id: string({ max: 60 }),
        frame: string({ max: 60 }),
        work: string({ max: 200 }),
        author: string({ max: 120 }),
        year: string({ max: 20 }),
        kind: oneOf(['reference', 'paper', 'essay', 'book', 'thought-experiment', 'lecture', 'other']),
        argument: string({ max: 500 }),
        changes: string({ max: 300 }),
        confidence: oneOf(['established', 'likely', 'contested', 'unsure']),
        url: string({ max: 600 }),
      }),
      { min: 2, max: 8 },
    ),
  }),
});

export const chooseDepth = defineOperation({
  name: 'choose-depth',
  role: 'You are the editor who decides how deep a piece can go and still carry its audience with it.',
  purpose:
    'Choose the deepest question this round reached that still connects to the mechanism, and name what to push in the next round.',
  method: [
    'Read the frames and the readings. Which question did the reading make sharper, stranger or more human?',
    'Choose one. Write it as the audience would ask it. Name the step it takes: from which concrete thing to which larger idea.',
    'Name the thinkers or thought experiments that carry the step, and the one detail from them an audience would remember.',
    'Say what about this question should be pushed further in the next round, and what would surprise the audience about it.',
  ],
  output: record({
    question: string({ max: 300 }),
    from: string({ max: 200 }),
    to: string({ max: 200 }),
    carriers: list(string({ max: 200 }), { min: 1, max: 4 }),
    detail: string({ max: 300 }),
    nextFocus: string({ max: 300 }),
    surprise: string({ max: 300 }),
  }),
});

/**
 * Run the reframing loop on a focus question. Each round picks fresh lens families, reframes, drops repeated frames,
 * reads the literature and chooses the deepest connected question, which becomes the next focus. Returns the ladder
 * of chosen questions (concrete to deep) and every frame and reading.
 */
export async function reframeLoop(run, { brief, focus }, { rounds = 2, seed = 1 } = {}) {
  assert(
    Number.isInteger(rounds) && rounds >= 1 && rounds <= 5,
    'INVALID_OPTION',
    'Run between 1 and 5 reframing rounds.',
  );
  const ladder = [],
    frames = [],
    readings = [],
    used = [];
  let current = focus;
  for (let round = 0; round < rounds; round++) {
    const r = run.scope(`round-${round + 1}`);
    const { lenses } = await r.call(pickLenses, { seed, round, used });
    used.push(...lenses.map((l) => l.key));
    const history = ladder.map((step) => step.question);
    const proposed = await r.call(deepenFrame, { brief, focus: current, lenses, history: ladder });
    const fresh = await r.call(freshFrames, { frames: proposed.frames, history: [focus, ...history] });
    const read = await r.call(readAround, { brief, frames: fresh.frames });
    const chosen = await r.call(chooseDepth, {
      brief,
      focus: current,
      frames: fresh.frames,
      readings: read.readings,
      history: ladder,
    });
    frames.push(...fresh.frames.map((f) => ({ ...f, round: round + 1 })));
    readings.push(...read.readings.map((x) => ({ ...x, round: round + 1 })));
    ladder.push({ round: round + 1, lenses: lenses.map((l) => l.key), ...chosen });
    current = chosen.nextFocus || chosen.question;
  }
  return { ladder, frames, readings };
}
