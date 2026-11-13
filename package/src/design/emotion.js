// Emotion: feeling, character, metaphor and play in the pictures, with a guard against decoration. The evidence points
// both ways. Emotional design (pleasant colours, faces on the objects of a lesson) improves retention and
// comprehension, while interesting but irrelevant details lower them, most of all when they are visual and early.
// So every emotional move here must carry an idea, and code checks that it does. Motion alone can give a shape a mind
// (Heider and Simmel), which makes character the strongest emotional lever in pure motion graphics.
//
//   design emotion    (model) the feeling of each shot, who acts with intent, visual metaphors by type, play and
//                     humour tied to the mechanism, the emotional arc, and narration lines that let the narrator feel it
//   emotion measures  (measure) moves that carry no idea, decoration early, untied humour, character and metaphor
//                     coverage, and whether the arc has a reflective close
import { assert } from '../core/validate.js';
import { defineOperation } from './run.js';
import { boolean, list, number, oneOf, record, string } from './schema.js';
import { principleRules, principles, referenceExamples, referencesFor } from './references.js';
import { narrationEditShape, patchShape, shotDigest, timeShots } from './shots.js';

/** Charles Forceville's kinds of visual metaphor, plus none. */
export const METAPHOR_TYPES = Object.freeze(['none', 'hybrid', 'contextual', 'simile', 'multimodal']);
/** Don Norman's three levels at which a design is felt. */
export const FEELING_LEVELS = Object.freeze(['visceral', 'behavioral', 'reflective']);

export const EMOTION_PRINCIPLES = principles([
  {
    id: 'carry-the-idea',
    rule: 'Every emotional, playful or beautiful move must carry an idea of the lesson; one that carries none is decoration and is cut.',
    source: 'Rey 2012 and Sundararajan and Adesope 2020 meta-analyses of seductive details',
    evidence: 'measured',
  },
  {
    id: 'emotional-design',
    rule: 'Pleasant colours and simple faces or character on the objects of the lesson raise retention and comprehension.',
    source: 'Brom et al. 2018 meta-analysis; Wong and Adesope 2021',
    evidence: 'measured',
  },
  {
    id: 'agency',
    rule: 'Give a shape intent through motion alone (hesitation, chasing, arriving late) when the idea is about a process or a cause.',
    source: 'Heider and Simmel 1944; later animacy research',
    evidence: 'measured',
  },
  {
    id: 'metaphor',
    rule: 'Use a visual metaphor when it maps the mechanism step by step: a hybrid fuses two things, a contextual metaphor changes a thing by its setting, a simile places two side by side, a multimodal metaphor shows one side while the narration says the other.',
    source: 'Forceville, pictorial and multimodal metaphor',
    evidence: 'observed',
  },
  {
    id: 'three-levels',
    rule: 'Design for the immediate look (visceral), for being easy to follow (behavioral) and for what it means to the viewer (reflective).',
    source: 'Norman, Emotional Design',
    evidence: 'practice',
  },
  {
    id: 'humour',
    rule: 'Humour builds goodwill, but its effect on learning is mixed: keep it about the mechanism, never mocking, and never in place of the explanation.',
    source: 'Banas et al. 2011 review of humour in education',
    evidence: 'measured',
  },
  {
    id: 'narrator-feels',
    rule: 'Let the narrator react to what is on screen in a few words; a person who is surprised invites the viewer to be.',
    source: 'Mayer, personalization principle; explainer practice',
    evidence: 'measured',
  },
]);

/** Editorial thresholds for the emotion gate. */
export const EMOTION_GATE = Object.freeze({ openingSeconds: 60, minAgentShare: 0.15, maxHumour: 0.2 });

export const designEmotion = defineOperation({
  name: 'design-emotion',
  role: 'You are the animation director who makes explainers feel alive: shapes that seem to want things, metaphors that make a mechanism obvious, a moment of delight, a narrator who is moved. You never add anything that does not teach.',
  purpose:
    'Give each shot a feeling and, where it helps, a character with intent, a visual metaphor or a moment of play, each tied to the idea it carries; shape the emotional arc; and propose small narration lines that let the narrator feel it.',
  method: [
    'Read the narration, the shots and the sequences with their intensity.',
    'For each shot, name the feeling it aims for (curiosity, tension, surprise, delight, awe, calm, resolve) and the level it works at: visceral, behavioral or reflective.',
    'Where the idea is a process or a cause, give one element intent through motion alone and say which element and what it wants.',
    'Where a metaphor maps the mechanism step by step, choose its type (hybrid, contextual, simile, multimodal) and say what stands for what. Say where it breaks.',
    'Where play or humour fits, make it about the mechanism itself.',
    'Every move names the idea id it carries. A move that carries none is not made.',
    'Shape the arc across sequences: rising curiosity, the peak at the reveal, and a reflective close.',
    'Patch shots to realise the moves (motion, elements, shows), and propose up to eight narration edits where the narrator reacts to the picture in a few words. Change no facts and keep the line’s length close.',
  ],
  examples: referenceExamples(referencesFor('emotion')),
  rules: principleRules(EMOTION_PRINCIPLES),
  output: record({
    shots: list(
      record({
        shot: string({ max: 40 }),
        feeling: oneOf(['curiosity', 'tension', 'surprise', 'delight', 'awe', 'calm', 'resolve', 'neutral']),
        level: oneOf(FEELING_LEVELS),
        carries: string({
          max: 40,
          description: 'The idea id the emotional move serves, or empty if the shot makes none.',
        }),
        agent: string({ max: 120, description: 'The element given intent and what it wants, or empty.' }),
        metaphor: record({
          type: oneOf(METAPHOR_TYPES),
          source: string({ max: 120 }),
          target: string({ max: 120 }),
          breaks: string({ max: 160 }),
        }),
        play: string({ max: 160, description: 'The moment of play or humour, or empty.' }),
        decorative: boolean({ description: 'True if any emotional element here carries no idea.' }),
      }),
      { min: 1, max: 120 },
    ),
    arc: list(
      record({ sequence: string({ max: 40 }), feeling: string({ max: 80 }), level: number({ min: 0, max: 1 }) }),
      { max: 40 },
    ),
    patches: list(patchShape, { max: 40 }),
    narration: list(narrationEditShape, { max: 8 }),
  }),
});

export const emotionMeasures = defineOperation({
  name: 'emotion-measures',
  kind: 'measure',
  purpose:
    'Check the emotional design: moves that carry no idea, decoration early, untied humour, character and metaphor coverage and a reflective close.',
  compute({ sections, shots, emotion, timing = null, gate = EMOTION_GATE }) {
    assert(emotion && Array.isArray(emotion.shots), 'INVALID_DATA', 'Give the emotion design.');
    const t = timing ?? timeShots(sections, shots);
    const at = new Map(t.shots.map((x) => [x.id, x]));
    const ideas = new Set(shots.map((s) => s.idea));
    const problems = [];
    const moved = emotion.shots.filter((e) => e.agent || e.metaphor.type !== 'none' || e.play);
    for (const e of moved) {
      const tied = String(e.carries ?? '').trim();
      if (!tied || !ideas.has(tied))
        problems.push(
          `Shot ${e.shot} makes an emotional move that carries no idea of the lesson; cut it or tie it to one.`,
        );
      if (e.decorative && (at.get(e.shot)?.from ?? Infinity) < gate.openingSeconds)
        problems.push(
          `Shot ${e.shot} is decorative in the first ${gate.openingSeconds} seconds, where decoration does most harm.`,
        );
    }
    const agents = emotion.shots.filter((e) => e.agent).length;
    const metaphors = emotion.shots.filter((e) => e.metaphor.type !== 'none');
    const play = emotion.shots.filter((e) => e.play).length;
    if (shots.length >= 6 && agents / shots.length < gate.minAgentShare)
      problems.push(
        `Only ${agents} of ${shots.length} shots give anything intent; motion graphics feel alive when something wants something.`,
      );
    if (shots.length && play / shots.length > gate.maxHumour)
      problems.push(`${play} of ${shots.length} shots play for fun; keep play for where it teaches.`);
    for (const m of metaphors)
      if (!m.metaphor.breaks.trim()) problems.push(`The metaphor in shot ${m.shot} does not say where it breaks.`);
    const last = emotion.arc.at(-1);
    if (emotion.arc.length > 2 && last && !/reflect|wonder|calm|resolve|meaning/i.test(last.feeling))
      problems.push('The emotional arc does not end on a reflective close.');
    return {
      moves: moved.length,
      agents,
      metaphors: metaphors.map((m) => ({ shot: m.shot, type: m.metaphor.type })),
      play,
      feelings: Object.fromEntries(
        ['curiosity', 'tension', 'surprise', 'delight', 'awe', 'calm', 'resolve', 'neutral'].map((f) => [
          f,
          emotion.shots.filter((e) => e.feeling === f).length,
        ]),
      ),
      problems,
    };
  },
});

/** Design and measure the emotional layer of a shot plan. */
export async function planEmotion(run, { brief, sections, shots, timing, structure }) {
  const emotion = await run.call(designEmotion, {
    brief,
    narration: sections.map((s, i) => ({ section: i + 1, narration: s.narration })),
    shots: shotDigest(shots, timing),
    sequences: structure.sequences.map((q) => ({ id: q.id, purpose: q.purpose, intensity: q.intensity })),
  });
  const measures = await run.call(emotionMeasures, { sections, shots, emotion, timing });
  return { emotion, measures, problems: measures.problems };
}
