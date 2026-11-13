// Research operations: finding material. Four explorations look at a topic from different directions at once
// (surprises, human stories, unusual sources, everyday encounters); two go deep once a story is chosen (the people
// who carry it, and the full investigation of its mechanism and evidence). They search the web and must return
// the sources they opened.
import { defineOperation } from './run.js';
import { boolean, list, oneOf, record, string } from './schema.js';
import { confidence, sources } from './shared.js';

export const EXPLORER =
  'You are a researcher for a science channel known for finding the story nobody else found. You are curious, sceptical and specific. You care about what is true and about what would make a person lean in.';

export const exploreSurprises = defineOperation({
  name: 'explore-surprises',
  role: EXPLORER,
  purpose: 'Find results in the topic that contradict what an ordinary, intelligent person would expect.',
  search: true,
  method: [
    'Write down eight things a typical person believes about the topic, including ones that sound too obvious to question.',
    'For each belief, search for evidence that it is wrong, incomplete or true only under conditions. Useful searches combine the topic with words like "misconception", "actually", "paradox", "counterintuitive", "illusion", "surprisingly", "contrary to".',
    'Keep only results where the expectation is genuinely plausible and the correction is solid. A surprise nobody would have expected the other way is not a surprise.',
    'State the expectation and the correction in one plain sentence each. Name the conditions under which the correction holds.',
  ],
  examples: [
    'Expectation: a heavier object falls faster. Correction: without air, a hammer and a feather land together; the expectation comes from air resistance, not weight.',
    'Expectation: a rolling wheel moves forward everywhere. Correction: the point touching the road is momentarily at rest.',
  ],
  output: record({
    items: list(
      record({
        id: string({ max: 60 }),
        expectation: string({ max: 400 }),
        correction: string({ max: 600 }),
        conditions: string({ max: 400 }),
        confidence,
        sources,
      }),
      { min: 3, max: 10 },
    ),
  }),
});

export const exploreStories = defineOperation({
  name: 'explore-stories',
  role: EXPLORER,
  purpose: 'Find human stories inside the topic: people, accidents, disputes, obsessions, failures and money.',
  search: true,
  method: [
    'Search the history of the topic for a moment when someone was wrong, stubborn, lucky, ruined, sued, ridiculed or vindicated.',
    'Look beyond scientists: engineers, artists, traders, patients, soldiers, lawyers, children and companies. Search phrases like "history of", "dispute", "lawsuit", "patent", "accident", "obsessed", "forgotten", "first person to".',
    'For each story, say what it reveals about the science, not just what happened.',
    'Mark stories that are retold widely but poorly sourced as contested.',
  ],
  examples: [
    'A geochemist dating meteorites keeps getting impossible numbers; the contamination turns out to be lead from petrol, and he spends decades fighting the fuel industry.',
    'A ship sinks because two teams used different units; the story reveals why measurement standards exist.',
  ],
  output: record({
    items: list(
      record({
        id: string({ max: 60 }),
        story: string({ max: 700 }),
        people: string({ max: 300 }),
        when: string({ max: 100 }),
        reveals: string({ max: 400 }),
        confidence,
        sources,
      }),
      { min: 3, max: 8 },
    ),
  }),
});

export const exploreUnusualSources = defineOperation({
  name: 'explore-unusual-sources',
  role: EXPLORER,
  purpose: 'Find recent, niche or unexpected sources about the topic that a popular summary would miss.',
  search: true,
  method: [
    'Search where general articles do not look: university press releases from the last few years, small news outlets, museum and archive blogs, patents, court cases, industry and trade journals, hobbyist and craft communities, medical case reports, and sources in other languages.',
    'Prefer a concrete finding (a measurement, a case, a strange object, an experiment) over an opinion.',
    'Say why the source is unusual and what it adds that the obvious sources do not.',
  ],
  examples: [
    'A paper conservator explaining why a famous painting has changed colour since it was painted.',
    'A patent dispute over a material that reveals how the property works.',
  ],
  output: record({
    items: list(
      record({
        id: string({ max: 60 }),
        finding: string({ max: 600 }),
        kindOfSource: string({ max: 120 }),
        whyUnusual: string({ max: 300 }),
        date: string({ max: 40 }),
        sources,
      }),
      { min: 3, max: 8 },
    ),
  }),
});

/**
 * The three searching explorations in one call: surprises, human stories and unusual sources. Cheaper than three
 * separate searches (each search call re-reads its results), at the price of fewer items of each kind.
 */
export const exploreWide = defineOperation({
  name: 'explore-wide',
  role: EXPLORER,
  purpose:
    'In one research session, find surprises (results that contradict a plausible expectation), human stories (people, accidents, disputes, money) and unusual sources (recent, niche or unexpected) about the topic.',
  search: true,
  method: [
    'Plan about eight searches before you start, spread across the three kinds: misconceptions and paradoxes; history, disputes, lawsuits, accidents and forgotten people; recent press releases, small outlets, archives, patents, court cases, trade journals and hobbyist communities.',
    'Surprises: keep only those where the expectation is genuinely plausible and the correction is solid; name the conditions.',
    'Stories: look beyond scientists. Say what each story reveals about the science, and mark poorly sourced retellings as contested.',
    'Unusual sources: prefer a concrete finding (a measurement, a case, a strange object) and say why the source is unusual.',
    'Stop searching once you have enough; depth on a few good leads beats many shallow ones.',
  ],
  examples: [
    ...exploreSurprises.examples.slice(0, 1),
    ...exploreStories.examples.slice(0, 1),
    ...exploreUnusualSources.examples.slice(0, 1),
  ],
  output: record({
    surprises: list(exploreSurprises.output.fields.items.item, { min: 3, max: 6 }),
    stories: list(exploreStories.output.fields.items.item, { min: 3, max: 6 }),
    unusualSources: list(exploreUnusualSources.output.fields.items.item, { min: 2, max: 5 }),
  }),
});

export const exploreEveryday = defineOperation({
  name: 'explore-everyday',
  role: EXPLORER,
  purpose:
    'Find places where the audience has already met the topic without noticing, and the question hiding in each.',
  method: [
    'List encounters from ordinary life: the home, the kitchen, the phone in their hand, their own body, sport, shops, travel, school, the night sky.',
    'For each, write the question a curious child would ask about it, which the topic answers.',
    'Prefer encounters the audience can check right now.',
  ],
  examples: [
    'The bathroom tiles feel colder than the bath mat at the same temperature: why does touch lie?',
    'The bottom of a spoon shows you upside down, the back shows you upright: what decides?',
  ],
  output: record({
    items: list(
      record({
        id: string({ max: 60 }),
        encounter: string({ max: 300 }),
        question: string({ max: 300 }),
        checkNow: boolean(),
      }),
      { min: 4, max: 10 },
    ),
  }),
});

export const findPeople = defineOperation({
  name: 'find-people',
  role: EXPLORER,
  purpose:
    'Find the people and events that carry the chosen story, so the telling is about someone, not only about something.',
  search: true,
  method: [
    'Who first noticed this, got it wrong, proved it, suffered from it, profited from it or still argues about it? Search history, current research groups, news and personal accounts.',
    'Include at least one person who is not a scientist, and at least one story from the last thirty years.',
    'For each, say what happened, why it matters to them, and which part of the science their story makes visible.',
    'Find one concrete detail per person that a listener would remember: an object, a sentence they said, a number, a place.',
  ],
  output: record({
    people: list(
      record({
        id: string({ max: 60 }),
        who: string({ max: 200 }),
        when: string({ max: 80 }),
        happened: string({ max: 700 }),
        stakes: string({ max: 300 }),
        shows: string({ max: 300 }),
        detail: string({ max: 300 }),
        confidence,
        sources,
      }),
      { min: 2, max: 6 },
    ),
  }),
});

export const investigate = defineOperation({
  name: 'investigate',
  role: 'You are a fact-checker and science adviser. Nothing goes into the script unless you could defend it.',
  purpose:
    'Research the chosen story in depth: the mechanism, the evidence, the numbers, the conditions and what is still unknown.',
  search: true,
  method: [
    'Explain the mechanism behind the story step by step, as a chain a listener could follow.',
    'List the key claims a script would make. For each, find a reliable source and mark how sure science is.',
    'Find concrete numbers worth saying aloud, and check them. When the story needs a measurement, find a published one (a paper, a teardown, a dataset) rather than leaving it unmeasured.',
    'Find demonstrations or experiments the audience could see or try, including simple ones at home.',
    'State the conditions and boundaries: when the claim is false or misleading.',
    'List the misconceptions an audience is likely to bring, and the open questions experts still argue about.',
  ],
  output: record({
    mechanism: list(string({ max: 400 }), { min: 3, max: 12 }),
    claims: list(record({ id: string({ max: 60 }), claim: string({ max: 400 }), confidence, sources }), {
      min: 3,
      max: 15,
    }),
    numbers: list(record({ value: string({ max: 80 }), meaning: string({ max: 300 }), source: string({ max: 600 }) }), {
      max: 10,
    }),
    demonstrations: list(record({ demonstration: string({ max: 400 }), atHome: boolean() }), { max: 8 }),
    boundaries: list(string({ max: 400 }), { max: 8 }),
    misconceptions: list(string({ max: 300 }), { max: 8 }),
    openQuestions: list(string({ max: 300 }), { max: 6 }),
  }),
});

export const findParallels = defineOperation({
  name: 'find-parallels',
  role: EXPLORER,
  purpose:
    'Find parallel stories: real stories from other subjects that share the deep question under the chosen story, so the piece can step sideways and come back with more than it left with.',
  search: true,
  method: [
    'Name the deep question under the chosen story in one sentence, with none of the topic\'s own vocabulary. ("Can anyone know what another mind experiences?" rather than "Do we see the same colours?")',
    'Search for stories that attack that same question from somewhere else: a thought experiment, an experiment on animals or children, a person with an unusual body or life, a historical argument, a philosopher, an engineering failure, a game. Use the wandering ideas as leads.',
    'Find stories at three distances: near (the same field, a different case), middle (a neighbouring field) and far (something that seems unrelated until it clicks).',
    'For each, say what it adds to the deep question, and the question it hands to the next story, so the parallels can form a chain that returns to the topic.',
    'Prefer stories with a person, a number or an image someone would retell. Mark poorly sourced ones as contested.',
  ],
  examples: [
    'Deep question "can a mind know it is being fooled?": near, an optical illusion that persists after you know it; middle, a patient whose brain invents explanations for a paralysed arm; far, a chess computer that cannot tell it is losing.',
  ],
  output: record({
    deepQuestion: string({ max: 300 }),
    parallels: list(
      record({
        id: string({ max: 60 }),
        story: string({ max: 700 }),
        distance: oneOf(['near', 'middle', 'far']),
        adds: string({ max: 300 }),
        handsOn: string({ max: 300 }),
        confidence,
        sources,
      }),
      { min: 4, max: 9 },
    ),
  }),
});
