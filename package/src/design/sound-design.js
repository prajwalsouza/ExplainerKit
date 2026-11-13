// Sound design: music, effects, ambience and silence, planned when the medium has sound. Music sets tone and momentum,
// but under a technical explanation it should sit well back or it costs clarity; an effect in sync with a motion fuses
// with it and makes it feel physical; silence before a reveal makes the reveal land. When the medium has no music or
// effects, the plan is skipped and says so, and the narration alone carries the sound.
//
//   design sound    (model) cues per shot: music, effect, ambience or silence, with intensity and ducking
//   sound measures  (measure) music too loud under dense shots, effects not tied to a motion, no space before the
//                   reveal, and cues the medium cannot play
import { assert } from '../core/validate.js';
import { defineOperation } from './run.js';
import { boolean, list, number, oneOf, record, string } from './schema.js';
import { principleRules, principles } from './references.js';
import { resolveMedium, shotDigest } from './shots.js';

export const SOUND_PRINCIPLES = principles([
  {
    id: 'music-recedes',
    rule: 'Under a technical explanation, music is decidedly in the background or absent; it never calls attention to itself.',
    source: 'Grant Sanderson, judging the Summer of Math Exposition',
    evidence: 'practice',
  },
  {
    id: 'coherence',
    rule: 'Sounds that do not carry the idea are cut, like decoration.',
    source: 'Mayer, coherence principle',
    evidence: 'measured',
  },
  {
    id: 'synchresis',
    rule: 'An effect in exact sync with a motion fuses with it and makes the motion feel physical.',
    source: 'Michel Chion, Audio-Vision (synchresis)',
    evidence: 'practice',
  },
  {
    id: 'duck',
    rule: 'Lower music and ambience under the narration, and let them rise only in the breaths between ideas.',
    source: 'Broadcast mixing practice',
    evidence: 'practice',
  },
  {
    id: 'silence',
    rule: 'A moment of silence or near silence before the reveal makes it land.',
    source: 'Film sound practice',
    evidence: 'practice',
  },
]);

export const designSound = defineOperation({
  name: 'design-sound',
  role: 'You are the sound designer for a narrated explainer. You use sound to make motion physical and moments land, and you never let it compete with the explanation.',
  purpose:
    'Plan the sound cues for each shot: music, effects, ambience or silence, with intensity and whether it ducks under the narration.',
  method: [
    'Read the shots, their motion and the sequences with their intensity. Mark the shots that are dense (an equation, a derivation, several new terms).',
    'Plan music by sequence: its feeling and intensity, low under dense shots and rising only in the breathing room.',
    'Tie each effect to one motion in its shot (a click as two things meet, a soft rise as something grows).',
    'Leave space before the reveal.',
    'Only plan what the medium can play.',
  ],
  rules: principleRules(SOUND_PRINCIPLES),
  output: record({
    cues: list(
      record({
        shot: string({ max: 40 }),
        kind: oneOf(['music', 'effect', 'ambience', 'silence']),
        what: string({ max: 200 }),
        intensity: number({ min: 0, max: 1 }),
        duck: boolean(),
        syncsWith: string({ max: 120, description: 'For an effect, the motion it is tied to; otherwise empty.' }),
        dense: boolean({ description: 'Whether the shot it sits under is dense.' }),
      }),
      { max: 160 },
    ),
    reveal: string({ max: 40, description: 'The shot id of the reveal, or empty.' }),
  }),
});

export const soundMeasures = defineOperation({
  name: 'sound-measures',
  kind: 'measure',
  purpose:
    'Check the sound plan: music too loud under dense shots, effects not tied to a motion, no space before the reveal, and cues the medium cannot play.',
  compute({ shots, sound, medium }) {
    assert(sound && Array.isArray(sound.cues), 'INVALID_DATA', 'Give the sound plan.');
    const m = resolveMedium(medium);
    const problems = [];
    for (const c of sound.cues) {
      if (c.kind === 'music' && !m.sound.music)
        problems.push(`Shot ${c.shot} plans music, which the medium does not have.`);
      if (c.kind === 'effect' && !m.sound.effects)
        problems.push(`Shot ${c.shot} plans an effect, which the medium does not have.`);
      if (c.kind === 'music' && c.dense && c.intensity > 0.3)
        problems.push(`Music under dense shot ${c.shot} is at ${c.intensity}; keep it below 0.3.`);
      if ((c.kind === 'music' || c.kind === 'ambience') && !c.duck)
        problems.push(`The ${c.kind} in shot ${c.shot} does not duck under the narration.`);
      if (c.kind === 'effect' && !c.syncsWith.trim())
        problems.push(`The effect in shot ${c.shot} is not tied to a motion.`);
    }
    const order = shots.map((s) => s.id);
    const r = order.indexOf(sound.reveal);
    if (r > 0) {
      const before = sound.cues.filter((c) => c.shot === order[r - 1]);
      if (before.length && !before.some((c) => c.kind === 'silence' || c.intensity <= 0.2))
        problems.push(`Nothing makes space before the reveal in shot ${sound.reveal}.`);
    }
    return {
      cues: sound.cues.length,
      music: sound.cues.filter((c) => c.kind === 'music').length,
      effects: sound.cues.filter((c) => c.kind === 'effect').length,
      problems,
    };
  },
});

/** Plan and measure sound, or skip with a reason when the medium has neither music nor effects. */
export async function planSound(run, { brief, shots, timing, structure, motion = null, medium }) {
  const m = resolveMedium(medium);
  if (!m.sound.music && !m.sound.effects)
    return {
      skipped: true,
      reason: 'The medium has no music or effects; the narration carries the sound.',
      problems: [],
    };
  const sound = await run.call(designSound, {
    brief,
    medium: { music: m.sound.music, effects: m.sound.effects },
    shots: shotDigest(shots, timing),
    sequences: structure.sequences.map((q) => ({
      id: q.id,
      purpose: q.purpose,
      intensity: q.intensity,
      shots: q.shots,
    })),
    ...(motion ? { motion: motion.shots.map((x) => ({ shot: x.shot, verb: x.verb, motion: x.motion })) } : {}),
  });
  const measures = await run.call(soundMeasures, { shots, sound, medium: m });
  return { skipped: false, sound, measures, problems: measures.problems };
}
