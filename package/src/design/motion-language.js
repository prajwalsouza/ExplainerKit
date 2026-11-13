// Motion language: how things move on screen and why. Animation helps understanding only when its motion matches the
// change the idea describes (congruence) and is simple and slow enough to follow (apprehension). The principles of
// traditional animation make that motion feel physical and give it appeal; staging keeps one main action at a time;
// launching and causality (Michotte) let motion show that one thing made another happen.
//
//   design motion    (model) for each shot: the change that moves, the animation principles it uses, whether the
//                    motion mirrors the idea, how many things move at once, its timing and screen direction
//   motion measures  (measure) several movers at once, long static shots, incongruent motion and screen direction
//                    that flips for one subject
import { assert } from '../core/validate.js';
import { defineOperation } from './run.js';
import { boolean, list, number, oneOf, record, string } from './schema.js';
import { principleRules, principles } from './references.js';
import { patchShape, shotDigest, timeShots } from './shots.js';

/** The changes motion can show. */
export const MOTION_VERBS = Object.freeze([
  'appear',
  'disappear',
  'move',
  'grow',
  'shrink',
  'split',
  'merge',
  'transform',
  'rotate',
  'oscillate',
  'flow',
  'collide',
  'draw-on',
  'highlight',
  'none',
]);
/** The principles of animation (Thomas and Johnston, The Illusion of Life). */
export const ANIMATION_PRINCIPLES = Object.freeze([
  'squash-and-stretch',
  'anticipation',
  'staging',
  'straight-ahead-and-pose-to-pose',
  'follow-through-and-overlap',
  'slow-in-and-slow-out',
  'arcs',
  'secondary-action',
  'timing',
  'exaggeration',
  'solid-drawing',
  'appeal',
]);

export const MOTION_PRINCIPLES = principles([
  {
    id: 'congruence',
    rule: 'Move things the way the idea changes: if the idea is that something spreads, it spreads on screen; if two things combine, they merge.',
    source: 'Tversky, Morrison and Bétrancourt 2002, Animation: can it facilitate?',
    evidence: 'measured',
  },
  {
    id: 'apprehension',
    rule: 'Keep motion simple and slow enough to follow: one main mover at a time, two at most.',
    source: 'Tversky, Morrison and Bétrancourt 2002',
    evidence: 'measured',
  },
  {
    id: 'staging',
    rule: 'Stage one main action at a time so the eye knows where to go.',
    source: 'Thomas and Johnston, The Illusion of Life',
    evidence: 'practice',
  },
  {
    id: 'physical-feel',
    rule: 'Use anticipation, slow-in and slow-out, arcs and follow-through so motion feels physical; reserve squash and exaggeration for emphasis.',
    source: 'Thomas and Johnston; Lasseter 1987',
    evidence: 'practice',
  },
  {
    id: 'causality',
    rule: 'When one thing causes another, let the first arrive and the second respond at once; a delay or a gap breaks the impression of cause.',
    source: 'Michotte, The Perception of Causality',
    evidence: 'measured',
  },
  {
    id: 'screen-direction',
    rule: 'A recurring subject keeps its screen direction unless the change means something.',
    source: 'Continuity editing practice',
    evidence: 'practice',
  },
]);

/** Editorial thresholds for the motion gate. */
export const MOTION_GATE = Object.freeze({ maxMovers: 2, maxStatic: 8 });

export const designMotion = defineOperation({
  name: 'design-motion',
  role: 'You are the lead animator for a motion-graphics explainer. You decide how every element moves so the motion itself explains.',
  purpose:
    'For each shot, decide the change that moves, the animation principles it uses, whether the motion mirrors the idea, how many things move at once, its timing and its screen direction, and patch the shot’s motion to fit.',
  method: [
    'Read the shots with their ideas, elements, durations and the narration.',
    'For each shot, name the main change (appear, move, grow, split, merge, transform, rotate, oscillate, flow, collide, draw-on, highlight or none) and describe the motion in one or two sentences an animator could follow.',
    'Say whether the motion mirrors the idea’s change, and why. If it does not, change it.',
    'Count how many things move at once. Keep it to one main mover, two at most; stagger the rest.',
    'Choose the animation principles that make it feel physical and give it appeal, and the timing: how long the main move takes and when it settles.',
    'Give the screen direction of moving subjects, and keep each subject’s direction across shots.',
    'Where a shot is still for long, give it a small purposeful movement or a reason to hold.',
  ],
  rules: principleRules(MOTION_PRINCIPLES),
  output: record({
    shots: list(
      record({
        shot: string({ max: 40 }),
        verb: oneOf(MOTION_VERBS),
        motion: string({ max: 300 }),
        congruent: boolean(),
        why: string({ max: 200 }),
        movers: number({ min: 0, max: 20 }),
        principles: list(oneOf(ANIMATION_PRINCIPLES), { max: 4 }),
        settles: number({ min: 0, max: 60, description: 'Seconds after the shot starts when the main move settles.' }),
        direction: record({
          subject: string({ max: 80 }),
          way: oneOf(['left-to-right', 'right-to-left', 'up', 'down', 'toward', 'away', 'around', 'none']),
        }),
      }),
      { min: 1, max: 120 },
    ),
    patches: list(patchShape, { max: 60 }),
  }),
});

export const motionMeasures = defineOperation({
  name: 'motion-measures',
  kind: 'measure',
  purpose:
    'Check the motion plan: too many movers at once, long static shots, incongruent motion and a subject whose screen direction flips.',
  compute({ sections, shots, motion, timing = null, gate = MOTION_GATE }) {
    assert(motion && Array.isArray(motion.shots), 'INVALID_DATA', 'Give the motion design.');
    const t = timing ?? timeShots(sections, shots);
    const at = new Map(t.shots.map((x) => [x.id, x]));
    const problems = [];
    const directions = new Map();
    for (const m of motion.shots) {
      if (m.movers > gate.maxMovers) problems.push(`Shot ${m.shot} moves ${m.movers} things at once; stagger them.`);
      const seconds = at.get(m.shot)?.seconds ?? 0;
      if (m.verb === 'none' && seconds > gate.maxStatic)
        problems.push(`Shot ${m.shot} is still for ${Math.round(seconds)} seconds.`);
      if (!m.congruent) problems.push(`The motion in shot ${m.shot} does not mirror its idea: ${m.why}`);
      const subject = m.direction.subject.trim().toLowerCase();
      if (subject && ['left-to-right', 'right-to-left'].includes(m.direction.way)) {
        const before = directions.get(subject);
        if (before && before.way !== m.direction.way)
          problems.push(
            `"${m.direction.subject}" moves ${before.way} in shot ${before.shot} and ${m.direction.way} in shot ${m.shot}.`,
          );
        directions.set(subject, { way: m.direction.way, shot: m.shot });
      }
    }
    const verbs = {};
    for (const m of motion.shots) verbs[m.verb] = (verbs[m.verb] ?? 0) + 1;
    return { verbs, incongruent: motion.shots.filter((m) => !m.congruent).length, problems };
  },
});

/** Design and measure the motion of a shot plan. */
export async function planMotion(run, { brief, sections, shots, timing }) {
  const motion = await run.call(designMotion, {
    brief,
    narration: sections.map((s, i) => ({ section: i + 1, narration: s.narration })),
    shots: shotDigest(shots, timing),
  });
  const measures = await run.call(motionMeasures, { sections, shots, motion, timing });
  return { motion, measures, problems: measures.problems };
}
