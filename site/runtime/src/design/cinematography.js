// Cinematography: the visual structure of the whole film, not shot by shot. Shots are grouped into sequences, and each
// sequence gets a visual intensity and a choice, for each of Bruce Block's visual components, of contrast (which
// raises intensity) or affinity (which calms it). Intensity is planned to rise and fall with the story and to rise
// where the viewer's patience runs low. Framing, camera and transitions follow the classic grammar of shots, cutting
// and continuity.
//
//   design structure     (model) sequences, their intensity and component choices, the central image's returns,
//                        screen direction, and patches to framing, camera and transitions
//   structure measures   (measure) shot lengths and cut rate, framing runs, sequence coverage, intensity contrast
//                        between sequences, intensity where attention is low, the central image at both ends
import { assert } from '../core/validate.js';
import { defineOperation } from './run.js';
import { list, number, oneOf, record, string } from './schema.js';
import { principleRules, principles, referenceExamples, referencesFor } from './references.js';
import { patchShape, shotDigest, timeShots } from './shots.js';

/** Bruce Block's visual components. */
export const VISUAL_COMPONENTS = Object.freeze(['space', 'line', 'shape', 'tone', 'color', 'movement', 'rhythm']);

export const CINEMATOGRAPHY_PRINCIPLES = principles([
  {
    id: 'contrast-affinity',
    rule: 'Contrast in a visual component raises intensity and affinity lowers it. Choose, per sequence and per component, which the story needs.',
    source: 'Block, The Visual Story',
    evidence: 'practice',
  },
  {
    id: 'intensity-follows-story',
    rule: 'Plan visual intensity to rise toward the reveal and the hooks and fall in the breathing room after them; a film at one intensity is flat.',
    source: 'Block, The Visual Story',
    evidence: 'practice',
  },
  {
    id: 'emotion-first',
    rule: 'Cut for emotion first, then story, then rhythm; a cut lands best on the viewer’s intent to look somewhere new.',
    source: 'Murch, In the Blink of an Eye',
    evidence: 'practice',
  },
  {
    id: 'five-cs',
    rule: 'Choose camera angle, continuity, cutting, close-ups and composition deliberately: a close-up or detail for what matters most, a wide to place things.',
    source: 'Mascelli, The Five C’s of Cinematography',
    evidence: 'practice',
  },
  {
    id: 'closure',
    rule: 'Between two frames the viewer fills the gap. Moment-to-moment and action-to-action changes are read effortlessly; a jump to a new scene needs a bridge.',
    source: 'McCloud, Understanding Comics',
    evidence: 'practice',
  },
  {
    id: 'screen-direction',
    rule: 'Keep a recurring subject’s direction on screen consistent (light travelling left to right, say), and change it only on purpose.',
    source: 'Continuity editing practice (the 180-degree rule)',
    evidence: 'practice',
  },
  {
    id: 'central-image',
    rule: 'The central image opens the film and returns at the end, changed.',
    source: 'Explainer practice; this library’s design processes',
    evidence: 'practice',
  },
]);

/** Editorial thresholds for the structure gate. */
export const STRUCTURE_GATE = Object.freeze({
  framingRun: 4,
  minContrast: 0.12,
  lowIntensity: 0.4,
  maxCutsPerMinute: 12,
});

export const designStructure = defineOperation({
  name: 'design-structure',
  role: 'You are the director of photography for a motion-graphics explainer. You plan the visual structure of the whole film before any frame is finished, the way a director plans contrast and affinity across a feature.',
  purpose:
    'Group the shots into sequences, give each a visual intensity and a contrast or affinity choice for each visual component, plan the central image and screen direction, and patch framing, camera and transitions to fit.',
  method: [
    'Read the narration and the shots. Group consecutive shots into sequences, each with one dramatic purpose (set up, build, reveal, breathe, return).',
    'Give each sequence an intensity from 0 (calm) to 1 (the peak). Raise it toward the reveal and the hooks and where the attention measures show patience running low; let it fall after a peak.',
    'For each sequence and each visual component (space, line, shape, tone, color, movement, rhythm), choose contrast or affinity and say in a few words what that means on screen.',
    'Name the central image and the shots where it appears; it should open the film and return at the end changed.',
    'State the screen direction of each recurring subject.',
    'Patch framing, camera and transitions where they fight the plan: a close-up or detail on what matters most, a wide to place things, a match or morph when one idea grows out of the last, a cut for something new.',
  ],
  examples: referenceExamples(referencesFor('cinematography')),
  rules: principleRules(CINEMATOGRAPHY_PRINCIPLES),
  output: record({
    sequences: list(
      record({
        id: string({ max: 40 }),
        shots: list(string({ max: 40 }), { min: 1, max: 60 }),
        purpose: oneOf(['set-up', 'build', 'reveal', 'breathe', 'return', 'hook']),
        intensity: number({ min: 0, max: 1 }),
        components: list(
          record({
            component: oneOf(VISUAL_COMPONENTS),
            choice: oneOf(['contrast', 'affinity']),
            means: string({ max: 160 }),
          }),
          { min: 1, max: 7 },
        ),
      }),
      { min: 1, max: 40 },
    ),
    centralImage: record({ image: string({ max: 200 }), shots: list(string({ max: 40 }), { max: 20 }) }),
    directions: list(record({ subject: string({ max: 80 }), direction: string({ max: 80 }) }), { max: 10 }),
    patches: list(patchShape, { max: 60 }),
  }),
});

export const structureMeasures = defineOperation({
  name: 'structure-measures',
  kind: 'measure',
  purpose:
    'Measure the visual structure: shot lengths and cut rate, runs of one framing, whether every shot is in one sequence, intensity contrast between sequences, intensity where attention is low and the central image at both ends.',
  compute({ sections, shots, structure, timing = null, attention = null, gate = STRUCTURE_GATE }) {
    assert(
      Array.isArray(shots) && structure && Array.isArray(structure.sequences),
      'INVALID_DATA',
      'Give the shots and the structure.',
    );
    const t = timing ?? timeShots(sections, shots);
    const problems = [];
    const lengths = t.shots.map((x) => x.seconds).sort((a, b) => a - b);
    const minutes = (t.seconds || 1) / 60;
    const cutsPerMinute = Math.round((Math.max(0, t.shots.length - 1) / minutes) * 10) / 10;
    if (cutsPerMinute > gate.maxCutsPerMinute)
      problems.push(`${cutsPerMinute} cuts a minute; most explanations need time to look.`);
    let run = 1;
    for (let i = 1; i < shots.length; i++) {
      run = shots[i].framing === shots[i - 1].framing ? run + 1 : 1;
      if (run === gate.framingRun)
        problems.push(
          `${gate.framingRun} shots in a row use ${shots[i].framing} framing, ending at shot ${shots[i].id}.`,
        );
    }
    const ids = new Set(shots.map((s) => s.id));
    const seen = new Map();
    for (const q of structure.sequences) for (const id of q.shots) seen.set(id, (seen.get(id) ?? 0) + 1);
    const missing = [...ids].filter((id) => !seen.has(id));
    const twice = [...seen].filter(([, n]) => n > 1).map(([id]) => id);
    if (missing.length) problems.push(`Shots in no sequence: ${missing.join(', ')}.`);
    if (twice.length) problems.push(`Shots in more than one sequence: ${twice.join(', ')}.`);
    const intensities = structure.sequences.map((q) => q.intensity);
    const steps = intensities.slice(1).map((v, i) => Math.abs(v - intensities[i]));
    const contrast = steps.length ? Math.round((steps.reduce((a, b) => a + b, 0) / steps.length) * 100) / 100 : 0;
    if (steps.length && contrast < gate.minContrast)
      problems.push(
        `Intensity barely changes between sequences (mean step ${contrast}); the film will feel visually flat.`,
      );
    // Where attention runs low, visual intensity should rise.
    const at = new Map(t.shots.map((x) => [x.id, x]));
    const sequenceTime = structure.sequences.map((q) => {
      const times = q.shots.map((id) => at.get(id)).filter(Boolean);
      return {
        id: q.id,
        from: Math.min(...times.map((x) => x.from)),
        to: Math.max(...times.map((x) => x.to)),
        intensity: q.intensity,
      };
    });
    const lows = [...(attention?.lows ?? []), ...(attention?.droughts ?? [])];
    for (const low of lows)
      for (const q of sequenceTime)
        if (q.from < low.to && q.to > low.from && q.intensity < gate.lowIntensity)
          problems.push(
            `Sequence ${q.id} is visually calm (${q.intensity}) where attention runs low (${Math.round(low.from)} to ${Math.round(low.to)} s).`,
          );
    const central = new Set(structure.centralImage.shots);
    if (shots.length && !central.has(shots[0].id)) problems.push('The central image is not in the first shot.');
    if (shots.length > 1 && !central.has(shots.at(-1).id))
      problems.push('The central image does not return in the last shot.');
    return {
      shots: t.shots.length,
      medianSeconds: lengths.length ? lengths[Math.floor(lengths.length / 2)] : 0,
      longestSeconds: lengths.at(-1) ?? 0,
      cutsPerMinute,
      sequences: structure.sequences.length,
      intensityContrast: contrast,
      intensity: sequenceTime,
      problems,
    };
  },
});

/** Design the visual structure for a shot plan and measure it. `attention` is an attention-measures result, if any. */
export async function planStructure(run, { brief, sections, shots, timing, attention = null }) {
  const structure = await run.call(designStructure, {
    brief,
    narration: sections.map((s, i) => ({ section: i + 1, narration: s.narration })),
    shots: shotDigest(shots, timing),
    ...(attention
      ? {
          attentionLows: [...(attention.lows ?? []), ...(attention.droughts ?? [])].map((l) => ({
            from: l.from,
            to: l.to,
          })),
        }
      : {}),
  });
  const measures = await run.call(structureMeasures, { sections, shots, structure, timing, attention });
  return { structure, measures, problems: measures.problems };
}
