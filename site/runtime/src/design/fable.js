// The science fable: a short story whose plot runs on a real mechanism, so the reader understands the science by
// following the story, and is changed by it. References: Bostrom's "The Fable of the Dragon-Tyrant" (ageing as a
// dragon a kingdom has learned to accept) and the genie whose wish counter underflows (how computers store
// numbers, as the rules of magic).
//
//   brief → explore wide (one search: surprises · stories · unusual sources) ┐ in parallel
//         → lateral pass (reframe · provoke · random entry · distant links · frames) ┘
//         → propose truths → rank (measure) → choose
//         → investigate → allegories (kingdom · rules of magic · small fable, in parallel)
//         → check coverage (measure) → choose allegory → plot → write
//         → measure (incl. leaked field vocabulary) → review (allegory · craft, in parallel) → revise → measure
//         → name it
import { assert } from '../core/validate.js';
import { defineOperation } from './run.js';
import { boolean, list, number, oneOf, record, string } from './schema.js';
import { allegoryCoverage, scriptStats, termHits } from './measures.js';
import { STOCK_RULE, ids } from './shared.js';
import { exploreWide, investigate } from './explore.js';
import { lateralPass } from './lateral.js';
import { chooseSeed, nameIt, rankSeeds } from './craft.js';

const FABULIST =
  'You are a writer of short fiction that teaches without preaching, in the tradition of Aesop, Borges, Calvino, Ted Chiang and the best science fables. Your stories are funny or haunting, specific, and they run on real ideas.';

export const proposeTruths = defineOperation({
  name: 'propose-truths',
  role: FABULIST,
  purpose:
    'From the exploration, propose six truths worth a fable: real science that people misjudge, accept without thinking, or cannot feel because of its scale, time or abstraction.',
  method: [
    'Look for blind spots: something people treat as natural that is not, a risk they cannot feel, a rule they follow without knowing why, a consequence that arrives too slowly to notice, a system that behaves exactly as designed with absurd results.',
    'For each, say what people get wrong (the blind spot), the mechanism that shows the truth, and why a story would make it felt where an explanation would not.',
    'Every truth must use at least two exploration items by id, including one from the stories, unusual sources or lateral thinking.',
    "Score from 0 to 1: surprise, wonder, closeness (how much it matters to the reader's own life), depth (how much real mechanism the plot can carry). Mark textbook first examples.",
  ],
  examples: [
    'Ageing: we treat it as natural and dignified, though it kills more people than anything else; a story about a kingdom that feeds a dragon makes the scale and the excuses visible.',
    'Integer storage: a counter that cannot go below zero wraps to its maximum; a genie who decrements before granting makes the rule a plot.',
  ],
  output: record({
    seeds: list(
      record({
        id: string({ max: 60 }),
        seed: string({ max: 300 }),
        blindSpot: string({ max: 400 }),
        mechanism: string({ max: 500 }),
        whyAStory: string({ max: 400 }),
        insight: string({ max: 400 }),
        uses: ids,
        surprise: number({ min: 0, max: 1 }),
        wonder: number({ min: 0, max: 1 }),
        closeness: number({ min: 0, max: 1 }),
        depth: number({ min: 0, max: 1 }),
        textbookFirst: boolean(),
        risk: string({ max: 300 }),
      }),
      { min: 4, max: 8 },
    ),
  }),
});

export const ALLEGORIES = Object.freeze({
  kingdom:
    'A society living with the problem: a kingdom, a city or a village with its institutions, rituals, experts and excuses. The science arrives as a discovery that changes what the people owe each other. The cost of delay is shown, not argued.',
  'rules-of-magic':
    'A magical bargain, creature or artefact whose rules are exactly the science. The hero follows the rules literally, and the plot turns on a consequence of the mechanism that nobody expected. The reader learns the rules by watching them bite.',
  'small-fable':
    'A short fable of a few characters (animals, objects, forces) who each embody one part of the mechanism. It moves fast and ends on a turn the reader works out a moment before it is said, never on a stated moral.',
});

export const mapAllegory = defineOperation({
  name: 'map-allegory',
  role: FABULIST,
  purpose:
    'Design one allegory for the chosen truth, in the strategy given in the input, with an exact correspondence between the story and the science.',
  method: [
    'Read the strategy and commit to it; another writer is trying the others.',
    'Invent the premise: the world, the hero, what they want, and what stands in the way.',
    'Map every step of the mechanism to something in the story. Write each correspondence as real → story, and why the story element behaves the way the real one does.',
    'Find the twist: the moment the mechanism produces a consequence the characters did not expect. It should be the most surprising true thing about the science.',
    'Say what the hero stands to lose: something specific and personal, not an abstraction.',
    'Write the moral the reader should arrive at, which the story will never state.',
    'Say honestly where the allegory misleads: what about the science the story gets wrong or exaggerates.',
    "List the real field's vocabulary the story must never use on the page (the technical names, units, systems and people), so the allegory is never explained inside the story.",
  ],
  output: record({
    strategy: oneOf(Object.keys(ALLEGORIES)),
    premise: string({ max: 700 }),
    correspondences: list(
      record({ real: string({ max: 300 }), story: string({ max: 300 }), why: string({ max: 300 }) }),
      { min: 3, max: 12 },
    ),
    twist: string({ max: 500 }),
    stakes: string({ max: 300 }),
    moral: string({ max: 300 }),
    misleads: list(string({ max: 300 }), { max: 5 }),
    forbiddenTerms: list(string({ max: 60 }), { min: 3, max: 30 }),
  }),
});

export const checkAllegories = defineOperation({
  name: 'check-allegories',
  kind: 'measure',
  purpose:
    'Check how many steps of the mechanism each allegory maps, by word overlap, and list the steps nobody mapped.',
  compute({ allegories, mechanism }) {
    return {
      checks: allegories.map((a) => ({
        strategy: a.strategy,
        ...allegoryCoverage(mechanism, a.correspondences),
        misleads: a.misleads.length,
      })),
    };
  },
});

export const chooseAllegory = defineOperation({
  name: 'choose-allegory',
  role: 'You are the editor of a magazine of short fiction that people forward to their friends.',
  purpose: 'Choose the allegory to write, with its coverage checks, and say what to fix first.',
  method: [
    'Read each premise and twist as a reader. Which would you finish? Which would you send to someone?',
    'Check faithfulness: an allegory that misleads about the central mechanism loses, however charming.',
    'Choose one. Name what to borrow from the others and what the writer must fix.',
  ],
  output: record({
    chosen: oneOf(Object.keys(ALLEGORIES)),
    borrow: list(string({ max: 300 }), { max: 4 }),
    changes: list(string({ max: 300 }), { max: 8 }),
    why: string({ max: 800 }),
  }),
});

export const plotFable = defineOperation({
  name: 'plot-fable',
  role: FABULIST,
  purpose: 'Plot the fable as a sequence of scenes, placing each piece of science where the story needs it.',
  method: [
    'Open in the world, with an image that will return at the end.',
    'Establish the normal: how everyone lives with the problem, and why it seems natural to them.',
    'Escalate: attempts, arguments, costs. Each scene teaches one correspondence through what happens, not through explanation.',
    'Raise the stakes until the hero is about to lose what matters to them. Plan the darkest moment: the scene where it seems the mechanism has won.',
    'The turn: the twist arrives as an event. The reader should realise what it means a moment before any character says so.',
    'Plan the punchline: the single line or image the reader will repeat to a friend. In a comic fable it is a joke that only works if you understood the mechanism; in a serious one, an image that hurts.',
    'The ending: return to the opening image, changed. Leave the moral unspoken.',
    'Give each scene its purpose, what happens, and which correspondence it carries.',
  ],
  output: record({
    scenes: list(
      record({
        id: string({ max: 60 }),
        purpose: string({ max: 200 }),
        happens: string({ max: 800 }),
        carries: string({ max: 300 }),
      }),
      { min: 4, max: 12 },
    ),
    openingImage: string({ max: 300 }),
    stakes: string({ max: 300 }),
    darkestMoment: string({ max: 400 }),
    punchline: string({ max: 300 }),
    finalImage: string({ max: 300 }),
  }),
});

const part = record({
  scene: string({ max: 60 }),
  text: string({ max: 8000 }),
  notes: string({ max: 600, description: 'For the editor: which science this carries and the liberties taken.' }),
  cites: list(string({ max: 60 }), { max: 10, description: 'Ids of the research claims this scene carries.' }),
});

const afterword = string({
  max: 1500,
  description:
    'A short key after the story: what each element stands for, the real science, and its sources. Plain prose.',
});

const STORY_RULES = [
  'Write it as fiction: scenes, characters, dialogue, specific sensory detail. No lecture paragraphs; the science lives in what happens.',
  'Never state the moral. Never explain the allegory. Trust the reader.',
  "Never use the real field's vocabulary on the page (the forbiddenTerms in the allegory). The real names belong only in the afterword.",
  'Humour and horror are both allowed; sentimentality is not.',
  'Vary the rhythm; a short paragraph after a long one lands harder.',
  STOCK_RULE,
];

export const writeFable = defineOperation({
  name: 'write-fable',
  role: FABULIST,
  purpose: 'Write the fable, scene by scene, at the length given in the brief.',
  method: [
    "Follow the plot and the editor's changes.",
    'Give the hero a voice and a want. Give the world one or two invented details so specific they feel real.',
    'Make every correspondence exact: what the characters can and cannot do must match the science.',
    'Let the darkest moment hurt. Let the twist happen on the page, land the punchline, then end on the final image.',
    'List in cites the ids of the research claims each scene carries.',
    'After the story, write the afterword: a short key to the allegory, with the real names.',
  ],
  rules: STORY_RULES,
  output: record({ parts: list(part, { min: 3, max: 12 }), afterword }),
});

export const fableMeasures = defineOperation({
  name: 'fable-measures',
  kind: 'measure',
  purpose:
    "Count words, rhythm, dialogue lines, questions and stock phrases in the fable, and any of the real field's vocabulary that leaked onto the page.",
  compute({ parts, forbidden = [] }) {
    const text = parts.map((p) => p.text).join('\n\n');
    return {
      ...scriptStats(text, { wordsPerMinute: 230 }),
      dialogueLines: (text.match(/[“"][^”"]{2,}[”"]/g) ?? []).length,
      leakedTerms: termHits(text, forbidden),
    };
  },
});

const fableFindings = record({
  strengths: list(string({ max: 300 }), { max: 6 }),
  findings: list(
    record({
      where: string({ max: 60 }),
      problem: string({ max: 400 }),
      why: string({ max: 400 }),
      fix: string({ max: 500 }),
      severity: oneOf(['must-fix', 'should-fix', 'consider']),
    }),
    { max: 12 },
  ),
});

export const reviewAllegory = defineOperation({
  name: 'review-allegory',
  role: 'You are a scientist who loves fiction and hates being misled by it.',
  purpose:
    'Check that the science survives the story: the correspondences are exact, the twist is true, and a reader would leave with the real mechanism.',
  method: [
    'For each correspondence, check that the story element behaves like the real one, including its limits.',
    'Ask: if a reader retold the science from the story alone, what would they get right and what wrong?',
    'Check the twist is a real consequence of the mechanism, not a convenience.',
    'Check the afterword: is the key accurate and are its sources real?',
    'This is fiction. Simplification and invention are fine; only mark must-fix what would leave a reader believing something false about the science. Put needed caveats in the afterword, never in the story.',
  ],
  output: fableFindings,
});

export const reviewFable = defineOperation({
  name: 'review-fable',
  role: 'You are the fiction editor. You read a thousand submissions a month and you know in a paragraph whether a story is alive.',
  purpose: 'Review the craft: opening, voice, specificity, character, the turn, the ending, restraint and rhythm.',
  method: [
    'Does the first paragraph make you want the second? Quote the line that does, or say it is missing.',
    'Where does it lecture? Mark every sentence that explains instead of dramatises.',
    'Is the twist felt, and does the reader get there a moment before the text says it?',
    "Does it state its moral, or use the real field's vocabulary (see leakedTerms in the measures)? Mark it for cutting.",
    'Are the stakes personal? Is there a darkest moment that hurts, or a comic punchline that only works if you understood the idea? If not, say exactly where one should go.',
    'Is there one image or line a reader would quote to a friend? If not, where could one be?',
  ],
  output: fableFindings,
});

export const reviseFable = defineOperation({
  name: 'revise-fable',
  role: FABULIST,
  purpose: "Revise the fable with the reviewers' notes, keeping what works.",
  method: [
    'Fix every must-fix finding. Fix should-fix findings unless they kill the story; say which you declined.',
    'Cut explanation wherever a scene can carry it. Remove every leaked term listed in the measures; move real names to the afterword.',
    'Keep the strengths the reviewers named. Length is not a constraint; keep what works.',
  ],
  rules: STORY_RULES,
  output: record({
    parts: list(part, { min: 3, max: 12 }),
    afterword,
    declined: list(string({ max: 300 }), { max: 8 }),
  }),
});

/** Run the fable process. `brief` is {topic, audience, goals, words}; `seed` fixes the lateral stimuli. */
export async function designFable(run, brief, { seed = 1 } = {}) {
  assert(brief && typeof brief.topic === 'string' && brief.topic.trim(), 'INVALID_DATA', 'The brief needs a topic.');
  const b = {
    topic: brief.topic,
    audience: brief.audience ?? 'curious adult readers',
    goals: brief.goals ?? 'a story people remember and retell, carrying real understanding',
    words: brief.words ?? 1800,
  };
  const about = { brief: b };

  const [wide, lateral] = await run.all([run.call(exploreWide, about), lateralPass(run, b, { seed })]);
  const exploration = { ...wide, ...lateral };

  const { seeds } = await run.call(proposeTruths, { brief: b, exploration });
  const { shortlist } = await run.call(rankSeeds, { seeds });
  const choice = await run.call(chooseSeed, { brief: b, shortlist });
  const truth = shortlist.find((s) => s.id === choice.chosen) ?? shortlist[0];
  const used = new Set(truth.uses ?? []);
  const material = Object.fromEntries(
    Object.entries(exploration)
      .filter(([, v]) => Array.isArray(v))
      .map(([k, items]) => [k, items.filter((i) => used.has(i.id))]),
  );
  const story = { truth, editor: { why: choice.why, protect: choice.protect } };

  const research = await run.call(investigate, { brief: b, story, material });
  const allegories = await run.all(
    Object.entries(ALLEGORIES).map(([strategy, description]) =>
      run.call(
        mapAllegory,
        { brief: b, story, research, strategy: `${strategy}: ${description}` },
        { label: `allegory-${strategy}` },
      ),
    ),
  );
  const { checks } = await run.call(checkAllegories, { allegories, mechanism: research.mechanism });
  const picked = await run.call(chooseAllegory, { brief: b, story, allegories, checks });
  const allegory = allegories.find((a) => a.strategy === picked.chosen) ?? allegories[0];

  const plot = await run.call(plotFable, { brief: b, story, research, allegory, editorChanges: picked });
  const draft = await run.call(writeFable, {
    brief: b,
    allegory,
    plot,
    editorChanges: picked,
    research: {
      mechanism: research.mechanism,
      numbers: research.numbers,
      claims: research.claims.map((c) => ({ id: c.id, claim: c.claim })),
    },
  });
  const forbidden = allegory.forbiddenTerms;
  const draftMeasures = await run.call(fableMeasures, { ...draft, forbidden }, { label: 'draft-measures' });

  const asScript = draft.parts.map((p) => ({ section: p.scene, text: p.text }));
  const [allegoryNotes, craftNotes] = await run.all([
    run.call(reviewAllegory, { brief: b, allegory, research, fable: asScript, afterword: draft.afterword }),
    run.call(reviewFable, { brief: b, plot, fable: asScript, measures: draftMeasures }),
  ]);
  const revised = await run.call(reviseFable, {
    brief: b,
    allegory,
    fable: draft.parts,
    afterword: draft.afterword,
    measures: draftMeasures,
    reviews: { allegory: allegoryNotes, craft: craftNotes },
  });
  const measures = await run.call(fableMeasures, { ...revised, forbidden }, { label: 'final-measures' });
  const title = await run.call(nameIt, {
    brief: b,
    story,
    script: revised.parts.map((p) => ({ section: p.scene, text: p.text })),
  });

  return {
    form: 'fable',
    brief: b,
    exploration,
    seeds,
    truth,
    research,
    allegories,
    checks,
    allegory,
    plot,
    draft,
    draftMeasures,
    reviews: { allegory: allegoryNotes, craft: craftNotes },
    fable: revised,
    measures,
    title,
  };
}

/** The fable process as stages, for diagrams and documentation; see EXPLAINER_STAGES for the fields. */
export const FABLE_STAGES = Object.freeze([
  {
    id: 'explore',
    phase: 'discover',
    title: 'Explore and think laterally',
    first: ['pick-stimuli'],
    parallel: true,
    ops: ['explore-wide', 'reframe', 'provoke', 'random-entry', 'connect-distant', 'create-frames', 'wander'],
    variants: { wander: ['a', 'b'] },
    then: ['keep-wanderings'],
  },
  {
    id: 'choose',
    phase: 'discover',
    title: 'Choose a truth people misjudge',
    parallel: false,
    ops: ['propose-truths', 'rank-seeds', 'choose-seed'],
  },
  { id: 'research', phase: 'research', title: 'Research it', parallel: false, ops: ['investigate'] },
  {
    id: 'allegory',
    phase: 'research',
    title: 'Try three allegories',
    parallel: true,
    ops: ['map-allegory'],
    variants: { 'map-allegory': Object.keys(ALLEGORIES) },
    then: ['check-allegories', 'choose-allegory'],
  },
  {
    id: 'write',
    phase: 'write',
    title: 'Plot, write and measure',
    parallel: false,
    ops: ['plot-fable', 'write-fable', 'fable-measures'],
  },
  {
    id: 'review',
    phase: 'refine',
    title: 'Review the science and the craft',
    parallel: true,
    ops: ['review-allegory', 'review-fable'],
  },
  {
    id: 'revise',
    phase: 'refine',
    title: 'Revise and name it',
    parallel: false,
    ops: ['revise-fable', 'fable-measures', 'name-it'],
  },
]);
