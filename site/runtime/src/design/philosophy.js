// Philosophy: the module that asks what a story means beyond itself, and whether it should say so. It maps the
// philosophical debates a topic genuinely touches (the positions, the strongest argument for each, the thought
// experiment that makes it vivid, who holds it and where to read it), then weighs how strongly the piece is invited to
// leap there: not at all, lightly, or centrally. "Not at all" is a real answer; a leap the topic does not invite reads
// as a lecture. Later steps follow the verdict instead of a blanket rule.
//
// The research is for the writer, never for the audience. On the page, depth arrives the way it would for a child:
// through an everyday question and a real-world analogy, without the names of debates, schools or technical terms.
//
//   map debates (searches) → weigh the leap → check (measure: a thought experiment and a reading when invited)
import { defineOperation } from './run.js';
import { list, oneOf, record, string } from './schema.js';

const PHILOSOPHER =
  'You are a philosopher who can explain the deepest ideas to a curious ten-year-old. You know the real debates and their literature, but on the page you use only everyday questions and real-world analogies, never the names of debates or technical terms. You can tell a deep question from a pretentious one, and you never force philosophy onto a subject that does not invite it.';

export const INVITATIONS = Object.freeze(['none', 'light', 'central']);

export const mapDebates = defineOperation({
  name: 'map-debates',
  role: PHILOSOPHER,
  purpose:
    'Map the philosophical debates that the chosen story genuinely touches, with their positions, arguments, thought experiments and literature.',
  search: true,
  method: [
    'Read the story, its insight and the depth ladder, if any. Ask which established debates in philosophy (of mind, of science, of language, ethics, metaphysics, epistemology) this material actually bears on. Name the debate as philosophers name it.',
    'For each debate, give two or three positions, the strongest argument for each in one sentence, and a philosopher or scientist who holds it.',
    'Give the thought experiment or classic case that makes the debate vivid, with its source.',
    'Say exactly how this story touches the debate: which detail of the science raises the question. If the connection is loose, say so.',
    'Find one or two readings per debate with a URL you opened, preferring the Stanford Encyclopedia of Philosophy and the original work.',
    'For each debate, write the everyday version: the question a child might ask about something ordinary (a pet, a sandwich, a shadow, a birthday) that holds the same puzzle, in plain words with no technical terms.',
    'It is fine to find only one debate, or none worth raising.',
  ],
  examples: [
    'Topic sleep: the debate about personal identity (is the person who wakes the one who slept?), with Locke on memory and Parfit on what matters; touched by the story only if it is about memory consolidation.',
  ],
  output: record({
    debates: list(
      record({
        id: string({ max: 60 }),
        debate: string({ max: 120 }),
        question: string({ max: 300 }),
        positions: list(
          record({ position: string({ max: 120 }), argument: string({ max: 300 }), holder: string({ max: 120 }) }),
          { min: 1, max: 3 },
        ),
        thoughtExperiment: record({
          name: string({ max: 120 }),
          gist: string({ max: 400 }),
          source: string({ max: 200 }),
        }),
        bearing: string({ max: 400 }),
        everyday: string({
          max: 300,
          description: 'The same puzzle as a child-level question about something ordinary, with no technical terms.',
        }),
        readings: list(
          record({ work: string({ max: 200 }), author: string({ max: 120 }), url: string({ max: 600 }) }),
          { max: 3 },
        ),
      }),
      { max: 5 },
    ),
  }),
});

export const weighLeap = defineOperation({
  name: 'weigh-leap',
  role: PHILOSOPHER,
  purpose:
    'Decide how strongly the piece is invited to leap into philosophy, which debate to use, and where the leap belongs.',
  method: [
    'Ask whether an audience would feel the philosophical question rising from this story on its own, or whether it would have to be dragged in.',
    'Choose: none (the story is better without it), light (one earned moment of wonder, late in the piece), or central (the philosophical question can be the story itself, the hook and the ending).',
    'If not none, choose the one debate to use and where the leap belongs (which part of the story earns it).',
    'Write the leap as the audience will hear it: a question in everyday words, raised by something ordinary in the story, with a real-world analogy a child would understand. Never name the debate, a school of thought or a technical term; never lecture. The depth should be felt in the question, not announced.',
    'Name the risk: preachy, off-topic, too abstract, or claiming more than philosophy has settled.',
  ],
  output: record({
    invites: oneOf(INVITATIONS),
    why: string({ max: 500 }),
    debate: string({ max: 60, description: 'The id of the chosen debate, or an empty string.' }),
    placement: string({ max: 300 }),
    line: string({ max: 300, description: 'The leap as a plain spoken question, with no technical terms.' }),
    analogy: string({ max: 300, description: 'The everyday analogy that carries the question.' }),
    risk: string({ max: 300 }),
  }),
});

export const checkPhilosophy = defineOperation({
  name: 'check-philosophy',
  kind: 'measure',
  purpose:
    'Check that an invited leap has a debate behind it, with a thought experiment and at least one reading with a URL.',
  compute({ debates, verdict }) {
    const errors = [];
    if (verdict.invites !== 'none') {
      const chosen = debates.find((d) => d.id === verdict.debate);
      if (!chosen)
        errors.push(
          `The leap is ${verdict.invites}, but its debate ${verdict.debate || '(none)'} is not among the mapped debates.`,
        );
      else {
        if (!chosen.thoughtExperiment.name.trim())
          errors.push(`${chosen.id} has no thought experiment to carry the leap.`);
        if (!chosen.readings.some((r) => /^https?:\/\//.test(r.url)))
          errors.push(`${chosen.id} has no reading with a URL.`);
      }
    }
    return { errors, debates: debates.length, invites: verdict.invites };
  },
});

/**
 * Consult philosophy on a chosen story. `input` is {brief, story, depth}, where depth is a reframing ladder (optional).
 * Returns the mapped debates, the verdict on the leap and its check.
 */
export async function consultPhilosophy(run, { brief, story, depth = [] }) {
  const { debates } = await run.call(mapDebates, { brief, story, depth });
  const verdict = await run.call(weighLeap, { brief, story, debates });
  const check = await run.call(checkPhilosophy, { debates, verdict });
  return { debates, verdict, check, debate: debates.find((d) => d.id === verdict.debate) ?? null };
}
