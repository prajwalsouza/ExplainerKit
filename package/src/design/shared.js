// Shapes and guidance shared by the design operations: sources, ids, confidence labels, reviewer findings, and
// the voice and caveat rules every writing step follows. Kept in one place so every operation means the same
// thing by "a source" or "a must-fix finding".
import { boolean, list, oneOf, record, string } from './schema.js';
import { DEPTHS, REGISTERS } from './flow.js';

export const source = record({ title: string({ max: 300 }), url: string({ max: 600 }) });
export const sources = list(source, { max: 6 });
export const ids = list(string({ max: 60 }), { max: 12 });
export const confidence = oneOf(['established', 'likely', 'contested', 'unsure']);

export const findings = record({
  strengths: list(string({ max: 300 }), { max: 6 }),
  findings: list(
    record({
      where: string({ max: 60, description: 'The section or beat id.' }),
      problem: string({ max: 400 }),
      why: string({ max: 400 }),
      fix: string({ max: 500 }),
      severity: oneOf(['must-fix', 'should-fix', 'consider']),
      placement: oneOf(['narration', 'notes'], {
        description: 'Must the audience hear the fix, or does it belong in production notes?',
      }),
    }),
    { max: 12 },
  ),
});

/** A section of a finished script: what is said, what is seen, and production notes nobody hears. */
export const section = record({
  beat: string({ max: 60 }),
  narration: string({ max: 6000 }),
  visual: string({ max: 400 }),
  notes: string({ max: 800, description: 'Caveats and production details for the makers; never read aloud.' }),
  optional: boolean({ description: 'Could this section be removed later without breaking the through-line?' }),
  cites: list(string({ max: 60 }), {
    max: 10,
    description: 'Ids of the research claims this section relies on; the sources are attached from the research.',
  }),
});

export const STOCK_RULE =
  'Never use stock narration: "Have you ever wondered", "In this video", "Let\'s dive in", "fascinating", "mind-blowing", "journey", "delve", "buckle up", "stay tuned", "tapestry".';

export const CAVEAT_RULES = [
  'Say a qualification aloud only when, without it, the audience would leave believing something false. Put every other qualification, condition or production warning in the notes field.',
  'Keep spoken hedges (can, may, might, ideal, typically, under conditions...) to about two per hundred words.',
  'When the story needs a measurement, give the published number and its source in the notes; do not say that nobody has measured it.',
  'List in cites the ids of the research claims each section relies on. Do not paste URLs into the narration; sources travel with the claim ids.',
  'Never leave a placeholder for a result ("[report the actual result]"). If the piece shows an experiment, say what it shows, using a published result.',
];

/**
 * Plain words. A model told to avoid jargon tends to swap a technical term for a coined label ("a grid-related trace")
 * that is no clearer. These rules ask for the picture first, and for the picture again whenever the idea returns.
 */
export const PLAIN_RULES = [
  'Name things by what the viewer can picture, not by a label. Say "the faint hum from the power lines, whose pitch wobbles a little from minute to minute" rather than "a grid-related trace".',
  'Never coin a shorthand label for an idea and then use it as if it were a word ("the notch", "the trace", "the blind spot"). If a phrase must recur, it must first be a vivid picture and every return must still read plainly on its own.',
  'Introduce a technical word only when the piece needs it later, and only after the picture: show the thing, then give its name in one sentence. When it returns more than a few sections later, bring the picture back with it.',
  'At the eureka and in the ending, use only everyday words. The moment of understanding must not depend on remembering a term.',
];

export const VOICE_RULES = [
  'Talk like a person, not a narrator: react, have an opinion, admit what seemed strange to you, allow yourself a joke. Say "I" about once a minute, for a reaction, a confession or an opinion.',
  'Vary the rhythm: some sentences of three or four words, and in every section at least one long one (25 words or more) that carries the listener through a whole thought. Never three short sentences in a row.',
  'Tell and show; do not give orders. Instructions ("Put a lens over...") only when the viewer is genuinely doing something at home.',
  'Name real people, places, objects and numbers. Abstract nouns are a last resort.',
  STOCK_RULE,
  ...PLAIN_RULES,
];

/** Moves from good explainers, described in our own words on unrelated topics, for the writer to learn from. */
export const VOICE_EXAMPLES = [
  'Starting from something everyone agrees on, then quietly pulling the rug: "We both call this blue. Fine. Now prove it."',
  'A detour that seems unrelated (a lost expedition, a court case) and turns out to be the missing piece.',
  'Admitting the answer is unsatisfying, then finding something better than an answer in the question itself.',
  'A long sentence that piles up details about a ridiculous experiment, followed by a three-word verdict.',
  'Ending on the opening image, now seen differently, instead of a summary.',
  'A confession that makes the host a person: "I spent a week not believing this, and then I tried it."',
  'One long sentence that follows a chain of cause and effect all the way through, so the listener never has to hold a fragment.',
];

/** One beat of a telling: its job, content and setting, who and what it carries, and what it plants and recalls. */
export const tellingBeat = record({
  id: string({ max: 60 }),
  purpose: string({ max: 200 }),
  content: string({ max: 900 }),
  world: string({
    max: 60,
    description: "The setting the beat lives in: a kitchen, a lab in 1850, the viewer's own eye.",
  }),
  person: string({ max: 60, description: 'The id of the person this beat is about, or an empty string.' }),
  parallel: string({ max: 60, description: 'The id of the parallel story this beat tells, or an empty string.' }),
  register: oneOf(REGISTERS),
  depth: oneOf(DEPTHS),
  gives: ids,
  needs: ids,
  plants: ids,
  recalls: ids,
  opens: ids,
  closes: ids,
});
