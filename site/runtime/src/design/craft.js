// Craft operations shared by every form (explainer, fable): choosing what to tell, working backward from the
// insight, finding what it means, reviewing a draft, and naming the finished piece.
import { defineOperation } from './run.js';
import { boolean, list, number, record, string } from './schema.js';
import { PLAIN_RULES, findings, ids, section } from './shared.js';

const seedFields = {
  id: string({ max: 60 }),
  seed: string({ max: 300 }),
  openingQuestion: string({ max: 300 }),
  insight: string({ max: 400 }),
  expectation: string({ max: 300 }),
  uses: ids,
  surprise: number({ min: 0, max: 1 }),
  wonder: number({ min: 0, max: 1, description: 'How much it changes how the audience sees the world or themselves.' }),
  closeness: number({ min: 0, max: 1 }),
  depth: number({ min: 0, max: 1 }),
  reach: number({
    min: 0,
    max: 1,
    description: 'How far it can lead toward a deep or philosophical question that still connects to the science.',
  }),
  textbookFirst: boolean({ description: 'Would this be the first example in a textbook chapter on the topic?' }),
  hookIsCore: boolean({ description: "Is the seed's hook the topic's textbook core concept itself?" }),
  risk: string({ max: 300 }),
};

export const proposeSeeds = defineOperation({
  name: 'propose-seeds',
  role: 'You are the head writer of a science channel deciding what this piece is really about.',
  purpose: 'Turn the exploration into six candidate story seeds. A seed is one specific thing to tell, not a topic.',
  method: [
    "First name the topic's textbook core concept: the idea a standard course would open with. Seeds may land on it, but the best seeds hook the audience with something else and arrive at the core as a surprise, or leave it aside.",
    'Read all the exploration, including the lateral thinking and the wanderings (playful tangents that can become the hook or a parallel). The best seeds join two pieces that look unrelated: a human story and a mechanism, a reframed question and a surprising result, a random connection and a real measurement.',
    'Every seed must use at least two items (by id) from different parts of the exploration, and at least one of them must come from the stories, the unusual sources or the lateral thinking.',
    'For each seed write the one-line seed, the opening question the audience would ask, the insight they should leave with, and what they expect before.',
    'Score honestly from 0 to 1: surprise, wonder (does it change how they see the world or themselves, not just add a fact), closeness (how personally they meet it), depth (how much real science it carries). A seed cannot score high on everything.',
    'Mark whether the seed would be the first example in a textbook chapter. Those are allowed but usually lose.',
    'Read the depth ladder in the exploration: questions the topic opens when it is reread in philosophical frames, with the thinkers who carry them. When the topic invites it, at least one seed should be carried by one of those questions, the way a great explainer turns "do we see the same colour?" into a story about other minds.',
    'Score reach from 0 to 1: how far the seed can lead toward a deep question that still connects to the science.',
    'Name the main risk.',
  ],
  examples: [
    'Topic probability → seed: a court convicted a mother because an expert multiplied two "independent" chances that were not independent. Joins a legal story to the birthday problem. Opening: "How can a number send someone to prison?"',
    'Topic geology → seed: rocks in a dry lakebed move by themselves; it took a stake-out with GPS-tagged stones to catch thin ice and light wind pushing them. Joins a mystery to a measurement.',
  ],
  output: record({ seeds: list(record(seedFields), { min: 4, max: 8 }) }),
});

export const rankSeeds = defineOperation({
  name: 'rank-seeds',
  kind: 'measure',
  purpose:
    'Order seeds by a weighted score that favours wonder and surprise, penalises textbook first examples, and keep the best few.',
  compute({
    seeds,
    keep = 3,
    weights = {
      surprise: 0.2,
      wonder: 0.25,
      closeness: 0.15,
      depth: 0.15,
      reach: 0.15,
      combined: 0.1,
      textbook: 0.25,
      core: 0.2,
    },
  }) {
    const scored = seeds.map((s) => {
      const value =
        s.surprise * weights.surprise +
        s.wonder * weights.wonder +
        s.closeness * weights.closeness +
        s.depth * weights.depth +
        (s.reach ?? 0) * weights.reach +
        ((s.uses?.length ?? 0) >= 2 ? weights.combined : 0) -
        (s.textbookFirst ? weights.textbook : 0) -
        (s.hookIsCore ? weights.core : 0);
      return { ...s, score: Math.round(value * 100) / 100 };
    });
    return { shortlist: scored.sort((a, b) => b.score - a.score).slice(0, keep) };
  },
});

export const chooseSeed = defineOperation({
  name: 'choose-seed',
  role: 'You are the editor. You have killed hundreds of weak pitches and you can tell a story from a topic.',
  purpose: 'Choose the one candidate to make, against the brief, and say what would make it fail.',
  method: [
    'For each candidate, imagine the first 30 seconds. Would the audience feel the question themselves, or only be told it is interesting?',
    'Imagine the last minute. Does the insight land as a new way of seeing, or only as a fact? Would anyone tell a friend about it?',
    'Check it against the audience and goals in the brief.',
    'Choose one. Say why it beats the others, and what the writer must protect while developing it.',
  ],
  output: record({
    chosen: string({ max: 60 }),
    why: string({ max: 800 }),
    protect: string({ max: 500 }),
    againstOthers: string({ max: 800 }),
  }),
});

export const workBackward = defineOperation({
  name: 'work-backward',
  role: 'You are a teacher planning backward from the moment you want a student to understand.',
  purpose: 'Start from the insight and work out what the audience must already have in mind for it to click.',
  method: [
    'State the ending: the single moment where the audience should think "oh, so that is why".',
    'List the ideas that moment needs. For each idea, list the ideas it needs in turn. Stop when you reach something this audience already knows.',
    'Give each idea a short kebab-case id. Mark which ideas the audience already knows.',
    'For each idea the audience does not know, suggest a concrete way to meet it (an example, a demonstration, a story) that does not give the ending away.',
  ],
  output: record({
    ending: string({ max: 500 }),
    ideas: list(
      record({
        id: string({ max: 60 }),
        idea: string({ max: 300 }),
        needs: ids,
        known: boolean(),
        meetItThrough: string({ max: 400 }),
      }),
      { min: 3, max: 20 },
    ),
  }),
});

export const findMeaning = defineOperation({
  name: 'find-meaning',
  role: 'You are the writer asking the question every good piece answers: so what?',
  purpose:
    'Find what the insight changes about how the audience sees the world or themselves, and how the piece should end.',
  method: [
    'Write the insight as a plain fact. Then ask "so what?" three times, each time going one level up: what does it say about the world, about people, about how we know things?',
    'Find the bigger idea that the specific story is an example of, and the moment where the piece can widen to it without lecturing. Use the depth ladder in the input: its deepest question and the thinkers who carry it.',
    'Design the ending: return to the opening image or question, now seen differently. Write a candidate last line in the voice of the piece.',
    'Say what the audience might do, notice or ask differently tomorrow.',
  ],
  examples: [
    'Fact: the bottom of a rolling wheel is still. So what? Motion depends on what you measure it against. So what? Everything you call "still" is moving. Ending: back to the wheel, now a reminder that the ground under you is racing round the Sun.',
  ],
  output: record({
    levels: list(string({ max: 300 }), { min: 3, max: 3 }),
    bigger: string({ max: 400 }),
    ending: string({ max: 400 }),
    lastLine: string({ max: 300 }),
    tomorrow: string({ max: 300 }),
  }),
});

// Reviews ----------------------------------------------------------------------------------------------------

export const reviewScience = defineOperation({
  name: 'review-science',
  role: 'You are a working scientist reviewing popular writing. You are generous about simplification and strict about anything false or misleading.',
  purpose:
    'Check every claim for accuracy, missing conditions and misleading simplification, and decide where each fix belongs.',
  method: [
    'Go through the text claim by claim, against the research dossier. Mark any claim the dossier does not support, and any number that differs from it.',
    'Separate a harmless simplification from one that leaves the audience believing something false. Only the second kind is must-fix.',
    'For every qualification you would add, decide its placement: narration only if the audience would otherwise believe something false; notes for everything else. Prefer notes.',
    'Note any number that is wrong, unsourced or given with false precision, and give the correct published figure.',
    'Read the measures: if spoken hedges exceed about two per hundred words, find qualifications that can move to notes.',
  ],
  output: findings,
});

export const reviewLearning = defineOperation({
  name: 'review-learning',
  role: 'You are a learning scientist who has watched people misunderstand thousands of explanations.',
  purpose: 'Check whether someone from the stated audience could follow the explanation and use it afterwards.',
  method: [
    'Find every point where the text uses an idea before the audience has it.',
    'Find every technical term and every coined label (a phrase the script made up and then reuses as if it were a word). For each, ask whether a newcomer could picture it at that moment. A label that was explained once, sections ago, and returns bare is a problem, and so is a term in the eureka line.',
    'Find where the audience is told instead of shown, and where an example or contrast would make the idea visible.',
    'Find where a likely misconception is left standing.',
    'Ask: afterwards, could they explain the insight to a friend and apply it to a new case? If not, what is missing?',
  ],
  output: findings,
});

export const reviewStory = defineOperation({
  name: 'review-story',
  role: 'You are a story editor for a channel with millions of subscribers. You read for the moment the audience leaves.',
  purpose: 'Check the hook, the pull of open questions, people, surprise, payoff, meaning, voice and rhythm.',
  method: [
    'Does the first 20 seconds make the audience feel a question personally? Quote the line that does, or say it is missing.',
    'Is there a person in it? A story about someone is stronger than a story about something.',
    'Mark where the audience would get bored or leave, and why.',
    'Check that every planted cue pays off, that the reveal is earned rather than announced, and that the ending widens to something bigger and returns to the opening.',
    'Read the measures. Mark sentences that sound generic, over-hedged, like instructions, or like a textbook, and write a line with a human voice instead. Flat sentence rhythm (a small sentence spread) is a problem.',
    'Is there one moment the audience would tell a friend about? If not, where could one be?',
    'Read the philosophy verdict in the input. If it invites a leap (light or central), check that the piece makes it in everyday words, through a question and a real-world analogy rather than the names of debates or technical terms, that the beats before it earn it, that a real thinker or thought experiment carries it, and that the ending does not shrink it back to a practical tip. Mark a missing, tacked-on or deflated leap as should-fix. If the verdict is none, do not ask for one.',
  ],
  output: findings,
});

export const polishVoice = defineOperation({
  name: 'polish-voice',
  role: 'You are a script doctor brought in only for voice. You never change the facts or the structure.',
  purpose: 'Rewrite the sections so they sound like a person talking, keeping every fact, cue and beat.',
  method: [
    'Read the measures and the problems listed. Fix those first.',
    'Move qualifications that do not prevent a false belief into notes.',
    'Rewrite every passage listed in choppyPassages. Merge most of each run into one or two flowing sentences joined with and, but, so, which, because or a dash; keep at most one short sentence as a punch. Some sentences should run past 25 words.',
    'Turn instructions into narration ("If you put a lens over the screen, ...").',
    'Bring the narrator in as a person: in most sections, one first-person reaction, confession or opinion ("I didn\'t believe this at first", "this is my favourite part"). Keep it under a joke a minute.',
  ],
  rules: ['Return every section, in the same order, with the same beat ids and the same cites.', ...PLAIN_RULES],
  output: record({ sections: list(section, { min: 3, max: 16 }) }),
});

export const nameIt = defineOperation({
  name: 'name-it',
  role: 'You are the packaging editor: titles and thumbnails.',
  purpose: 'Now that the piece exists, propose titles and choose one.',
  method: [
    'Write six titles. Make each one promise the question the piece actually answers; no clickbait it does not pay off.',
    'Prefer short titles that make the audience feel the question.',
    'Choose one, and write the two to four words that would go on a thumbnail or cover.',
  ],
  output: record({
    titles: list(string({ max: 120 }), { min: 4, max: 8 }),
    chosen: string({ max: 120 }),
    thumbnail: string({ max: 60 }),
  }),
});
