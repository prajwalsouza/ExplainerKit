// Production: the visual design process and its deliverables. It runs the visual modules in the order studios work
// (look up how others showed the subject, decide what each idea needs to show, storyboard it, plan the visual
// structure, the look, the feeling, the motion and the sound, then check it all against the multimedia principles),
// and it runs as a loop: the visual work may propose small narration changes, and when the process's gate accepts
// them the shots are re-timed, the shots that lost their words are replanned and the checks run again. The result is
// a storyboard, an animatic timing table, a colour script, style frames and, when allowed, generated images.
//
// Image generation is optional and explicit. The medium must allow images and the caller must pass an `imager`, a
// function ({id, prompt, kind}) => Promise<{file}>. This module never generates images itself. The repository's
// adapter (scripts/design/codex-image.mjs) uses Codex's built-in image tool, which only Codex has; Claude cannot
// generate images, and other generators can be plugged in with the same function shape.
//
// Generated images are references, not the film. A reference frame shows the storyboard and the builders what a shot
// should communicate and feel like, in the house style, so they have something to aim for; the shot that is finally
// built may look quite different. Every prompt carries the house style (see VISUAL_STYLES in look.js).
import { assert } from '../core/validate.js';
import { defineOperation } from './run.js';
import { list, oneOf, record, string } from './schema.js';
import { principleRules, principles, referenceExamples, referencesFor } from './references.js';
import { applyEdits } from './terms.js';
import {
  VISUAL_VOCABULARY,
  applyShotPatches,
  decodePatches,
  depictIdeas,
  planShots,
  replanShots,
  researchVisuals,
  resolveMedium,
  shotDigest,
  shotSpans,
  timeShots,
} from './shots.js';
import { checkMultimedia, multimediaMeasures } from './multimedia.js';
import { planStructure, structureMeasures } from './cinematography.js';
import { DEFAULT_STYLE, planLook, resolveStyle } from './look.js';
import { planEmotion, emotionMeasures } from './emotion.js';
import { planMotion, motionMeasures } from './motion-language.js';
import { planSound } from './sound-design.js';

export const PRODUCTION_PRINCIPLES = principles([
  {
    id: 'reference-first',
    rule: 'Gather how others have shown the subject, and references that share the wanted mood, before choosing a style.',
    source: 'Giant Ant on its process',
    evidence: 'practice',
  },
  {
    id: 'look-before-motion',
    rule: 'Fix the look in a few style frames before anything moves.',
    source: 'Austin Shaw, Design for Motion; motion-design practice',
    evidence: 'practice',
  },
  {
    id: 'cheap-before-expensive',
    rule: 'Iterate where change is cheap: storyboard, then an animatic timed to the narration, then animation.',
    source: 'Storyboard and animatic practice (Pixar story reels; studio workflows)',
    evidence: 'practice',
  },
  {
    id: 'picture-changes-words',
    rule: 'The script is a guide: once the pictures exist, small changes to the words are expected, through review.',
    source: 'Grant Sanderson on his process; Kurzgesagt reviewing every few days',
    evidence: 'practice',
  },
  {
    id: 'review-cadence',
    rule: 'Review the work at every stage, and keep a record of what changed and why.',
    source: 'Kurzgesagt on its process',
    evidence: 'practice',
  },
]);

/** The image-prompt use cases Codex's image tool recognises that suit explainers. */
export const IMAGE_USE_CASES = Object.freeze([
  'scientific-educational',
  'infographic-diagram',
  'illustration-story',
  'stylized-concept',
  'historical-scene',
  'photorealistic-natural',
]);

/**
 * A labelled image prompt in the layout Codex's image generation guidance recommends: use case, asset type, request,
 * scene, subject, style, composition, mood, palette, exact text, constraints and what to avoid. Empty lines are left
 * out.
 */
export function imagePromptSpec(p) {
  const lines = [
    ['Use case', p.useCase],
    ['Asset type', p.assetType],
    ['Primary request', p.request],
    ['Scene/backdrop', p.scene],
    ['Subject', p.subject],
    ['Style/medium', p.style],
    ['Composition/framing', p.composition],
    ['Lighting/mood', p.mood],
    ['Color palette', p.palette],
    ['Text (verbatim)', p.text ? `"${p.text}"` : ''],
    ['Constraints', p.constraints],
    ['Avoid', p.avoid],
  ];
  return lines
    .filter(([, v]) => String(v ?? '').trim())
    .map(([k, v]) => `${k}: ${String(v).trim()}`)
    .join('\n');
}

export const writeImagePrompts = defineOperation({
  name: 'write-image-prompts',
  role: 'You are the art director briefing an image generator. You write prompts that produce exactly the frame the storyboard and the look describe, and nothing else.',
  purpose: 'Write image prompts for the style frames and for every shot whose source is an image.',
  method: [
    'For each style frame, and each shot whose source is image, write one prompt in labelled parts: use case, asset type, request, scene, subject, style, composition, mood, palette (the look’s colours by name and HSLA), any exact text, constraints and what to avoid.',
    'Style frames show the look of the finished film: flat motion-graphics illustration unless the medium says otherwise, the palette, the composition of the storyboard frame. When previewsOnly is true, the frame is a reference for the storyboard and the builders: the best picture of this idea in the style, showing what the shot should communicate and feel like. The built shot may differ, so aim for clarity and beauty rather than a technical drawing.',
    'Image generators draw exact quantities and relationships poorly. For a diagram, state the one relation that matters in plain words (two identical waves, the same height and wavelength, the second shifted right by a quarter of a cycle), keep counts small, and leave out numbers and labels unless the frame is about them.',
    'Do not add objects, people, slogans or text the storyboard does not have. Ask for no text at all unless a label is part of the frame, and give such text verbatim.',
  ],
  output: record({
    prompts: list(
      record({
        id: string({ max: 40 }),
        shot: string({ max: 40 }),
        kind: oneOf(['style-frame', 'asset']),
        useCase: oneOf(IMAGE_USE_CASES),
        assetType: string({ max: 120 }),
        request: string({ max: 400 }),
        scene: string({ max: 300 }),
        subject: string({ max: 300 }),
        style: string({ max: 200 }),
        composition: string({ max: 200 }),
        mood: string({ max: 160 }),
        palette: string({ max: 300 }),
        text: string({ max: 120 }),
        constraints: string({ max: 300 }),
        avoid: string({ max: 300 }),
      }),
      { max: 24 },
    ),
  }),
});

const overlaps = (text, lines) => {
  const t = String(text).toLowerCase();
  return lines.some((l) => {
    const line = String(l ?? '')
      .toLowerCase()
      .trim();
    return line.length > 0 && (t.includes(line) || line.includes(t.trim()));
  });
};

/**
 * Put a style into an image prompt: its look leads the style line and its avoid list joins the prompt's, so every
 * image follows the house style whatever the prompt-writing model wrote.
 */
export function withStyle(prompt, style) {
  const s = resolveStyle(style);
  const extra = String(prompt.style ?? '').trim();
  const avoid = String(prompt.avoid ?? '').trim();
  return {
    ...prompt,
    useCase: s.useCase ?? prompt.useCase,
    style: extra.startsWith(s.look) ? extra : extra ? `${s.look}; ${extra}` : s.look,
    avoid: avoid.startsWith(s.avoid) ? avoid : avoid ? `${s.avoid}; ${avoid}` : s.avoid,
  };
}

/**
 * Generate images through the caller's `imager`, one call per prompt, recording each result or error. When a
 * `reviewer` is given, a function ({file, spec, previewsOnly}) => Promise<{fits, problems}>, each image is checked
 * against its prompt: whether it shows the idea it was asked for, whether it would mislead, and whether it follows the
 * style. Generated images are a model's work and often miss the one thing the frame was for.
 */
export async function generateImages(imager, prompts, { limit = 12, reviewer = null, previewsOnly = false } = {}) {
  assert(typeof imager === 'function', 'INVALID_OPTION', 'Image generation needs an imager function.');
  const results = [];
  for (const p of prompts.slice(0, limit)) {
    try {
      const spec = imagePromptSpec(p);
      const out = await imager({ id: p.id, kind: p.kind, prompt: spec });
      const row = { id: p.id, shot: p.shot, kind: p.kind, file: out?.file ?? null, ok: Boolean(out?.file) };
      if (row.ok && typeof reviewer === 'function') {
        const review = await reviewer({ file: row.file, spec, previewsOnly }).catch((error) => ({
          fits: null,
          problems: [`The review failed: ${String(error?.message ?? error).slice(0, 200)}`],
        }));
        row.review = { fits: review?.fits ?? null, problems: (review?.problems ?? []).slice(0, 8) };
      }
      results.push(row);
    } catch (error) {
      results.push({
        id: p.id,
        shot: p.shot,
        kind: p.kind,
        file: null,
        ok: false,
        error: String(error?.message ?? error).slice(0, 300),
      });
    }
  }
  return results;
}

/**
 * Run the visual design process on a finished script. `medium` is a medium name or object (motion graphics by
 * default). `protect` lists lines no narration edit may touch (the eureka, planted cues). Narration edits proposed by
 * the visual modules are applied only when `recheck` is given: a function (run, sections) => Promise<problems[]>,
 * usually the attention audit, whose problem count must not rise above `baseline`. Without it the edits are returned
 * as suggestions. `imager` enables image generation when the medium allows it. `rounds` bounds the loop.
 * @param {any} run
 * @param {{brief: any, sections: Array<{beat?: string, narration: string, chapter?: string}>, medium?: any, persona?: any, protect?: string[], terms?: string[], attention?: any, recheck?: ((run: any, sections: any[]) => Promise<string[]>) | null, baseline?: number | null, imager?: ((request: {id: string, kind: string, prompt: string}) => Promise<{file: string | null}>) | null, reviewer?: ((request: {file: string, spec: string, previewsOnly: boolean}) => Promise<{fits: boolean | null, problems: string[]}>) | null, style?: any, rounds?: number, research?: boolean}} options
 */
export async function designVisuals(
  run,
  {
    brief,
    sections,
    medium = 'motion-graphics',
    persona = null,
    protect = [],
    terms = [],
    attention = null,
    recheck = null,
    baseline = null,
    imager = null,
    reviewer = null,
    style = brief?.style ?? DEFAULT_STYLE,
    rounds = 2,
    research = true,
  } = {},
) {
  assert(Array.isArray(sections) && sections.length >= 1, 'INVALID_DATA', 'Give the script sections.');
  const m = resolveMedium(medium);
  const vocabulary = VISUAL_VOCABULARY.filter((v) =>
    v.id === 'image' || v.id === 'video' ? m.sources.includes(v.id) : true,
  ).map((v) => v.id);
  const narration = (secs) => secs.map((s, i) => ({ section: i + 1, title: s.beat, narration: s.narration }));
  const found = research ? await run.call(researchVisuals, { brief, ideas: sections.map((s) => s.beat) }) : null;
  const { ideas } = await run.call(depictIdeas, {
    brief,
    medium: { kind: m.kind, about: m.about, vocabulary },
    ...(persona ? { persona } : {}),
    ...(found ? { research: found } : {}),
    narration: narration(sections),
  });
  let { shots } = await run.call(planShots, {
    brief,
    medium: { kind: m.kind, about: m.about, vocabulary },
    depictions: ideas.map((d) => ({
      id: d.id,
      section: d.section,
      quote: d.quote,
      idea: d.idea,
      notYet: d.notYet,
      use: d.depictions.find((x) => x.level === d.chosen) ?? d.depictions[0],
    })),
    narration: narration(sections),
  });

  let current = sections;
  let timing = timeShots(current, shots, { medium: m });
  const layers = {};
  const steps = [];
  let gateBaseline = baseline;
  for (let round = 1; round <= rounds; round++) {
    const r = run.scope(`visual-${round}`);
    // Replan only the shots whose cue was lost.
    const lost = shots.filter((s) => timing.errors.some((e) => e.startsWith(`Shot ${s.id}'s cue`)));
    if (lost.length) {
      const { shots: fresh } = await r.call(replanShots, {
        brief,
        lost: shotDigest(lost),
        narration: narration(current),
      });
      const byId = new Map(fresh.map((s) => [s.id, s]));
      shots = shots.map((s) => byId.get(s.id) ?? s);
      timing = timeShots(current, shots, { medium: m });
    }
    if (round === 1) {
      const structure = await planStructure(r, { brief, sections: current, shots, timing, attention });
      shots = applyShotPatches(shots, decodePatches(structure.structure.patches)).shots;
      const [look, emotion, motion] = await r.all([
        planLook(r, { brief, shots, timing, structure: structure.structure, style }),
        planEmotion(r, { brief, sections: current, shots, timing, structure: structure.structure }),
        planMotion(r, { brief, sections: current, shots, timing }),
      ]);
      shots = applyShotPatches(shots, decodePatches(emotion.emotion.patches)).shots;
      shots = applyShotPatches(shots, [
        ...motion.motion.shots.map((x) => ({ shot: x.shot, field: 'motion', value: x.motion, why: 'motion design' })),
        ...decodePatches(motion.motion.patches),
      ]).shots;
      const sound = await planSound(r, {
        brief,
        shots,
        timing,
        structure: structure.structure,
        motion: motion.motion,
        medium: m,
      });
      Object.assign(layers, { structure, look, emotion, motion, sound });
    }
    const multimedia = await checkMultimedia(r, { brief, sections: current, shots, timing, protect, terms });
    shots = applyShotPatches(shots, decodePatches(multimedia.audit.patches)).shots;
    layers.multimedia = multimedia;

    // Narration edits from the visual work, through the gate.
    const proposed = [
      ...(round === 1 ? (layers.emotion.emotion.narration ?? []) : []),
      ...(multimedia.audit.narration ?? []),
    ];
    const safe = proposed.filter((e) => String(e.carries ?? '').trim() && !overlaps(e.find, protect));
    const step = {
      round,
      lostShots: lost.map((s) => s.id),
      proposed: proposed.length,
      protected: proposed.length - safe.length,
      applied: 0,
      kept: false,
    };
    if (safe.length && recheck && round < rounds) {
      const edited = applyEdits(current, safe);
      const after = await recheck(r.scope('recheck'), edited.sections);
      const before = gateBaseline ?? Infinity;
      step.applied = edited.applied.length;
      step.kept = after.length <= before;
      step.gate = { before: Number.isFinite(before) ? before : null, after: after.length };
      if (step.kept) {
        current = edited.sections;
        gateBaseline = after.length;
        step.changes = edited.applied.map((e) => ({
          section: e.section,
          find: e.find,
          replace: e.replace,
          why: e.why,
        }));
        timing = timeShots(current, shots, { medium: m });
      }
    } else step.suggestions = safe;
    steps.push(step);
    if (!step.kept) break;
  }

  // Re-measure every layer on the final shots and narration.
  timing = timeShots(current, shots, { medium: m });
  const final = {
    multimedia: multimediaMeasures.compute({ sections: current, shots, timing, protect, terms }),
    structure: structureMeasures.compute({
      sections: current,
      shots,
      structure: layers.structure.structure,
      timing,
      attention,
    }),
    emotion: emotionMeasures.compute({ sections: current, shots, emotion: layers.emotion.emotion, timing }),
    motion: motionMeasures.compute({ sections: current, shots, motion: layers.motion.motion, timing }),
  };

  // Deliverables: storyboard, animatic, colour script, style frames and, when allowed, images.
  const spans = shotSpans(current, shots);
  const animatic = timing.shots.map((t) => ({
    shot: t.id,
    section: t.section,
    from: t.from,
    to: t.to,
    seconds: t.seconds,
    says: (spans.get(t.id) ?? '').slice(0, 160),
  }));
  const house = resolveStyle(style);
  const allowed = m.images.generate || m.images.previews;
  const wantImages = allowed && typeof imager === 'function';
  const needsPrompts = allowed && (wantImages || shots.some((s) => s.source === 'image'));
  const forPrompts = shots.filter(
    (s) => (m.images.generate && s.source === 'image') || layers.look.look.styleFrames.some((f) => f.shot === s.id),
  );
  const prompts = needsPrompts
    ? (
        await run.call(writeImagePrompts, {
          brief,
          medium: { kind: m.kind, about: m.about },
          look: { palette: layers.look.look.palette, meanings: layers.look.look.meanings },
          styleFrames: layers.look.look.styleFrames,
          shots: shotDigest(forPrompts, timing),
          previewsOnly: !m.images.generate,
          style: { name: house.name, look: house.look, avoid: house.avoid },
        })
      ).prompts.map((p) => withStyle(p, house))
    : [];
  const images = wantImages
    ? await generateImages(imager, prompts, { reviewer, previewsOnly: !m.images.generate })
    : [];
  const problems = [
    ...timing.errors.map((p) => `Shots: ${p}`),
    ...final.multimedia.problems.map((p) => `Multimedia: ${p}`),
    ...final.structure.problems.map((p) => `Structure: ${p}`),
    ...layers.look.problems.map((p) => `Look: ${p}`),
    ...final.emotion.problems.map((p) => `Emotion: ${p}`),
    ...final.motion.problems.map((p) => `Motion: ${p}`),
    ...(layers.sound.problems ?? []).map((p) => `Sound: ${p}`),
    ...images.flatMap((i) =>
      i.review && i.review.fits === false ? i.review.problems.map((p) => `Frames: ${i.id}: ${p}`) : [],
    ),
    ...images.filter((i) => !i.ok).map((i) => `Frames: ${i.id} was not generated: ${i.error ?? 'no file'}`),
  ];
  return {
    medium: m,
    research: found,
    ideas,
    shots,
    timing,
    structure: layers.structure.structure,
    look: { ...layers.look.look, measures: layers.look.measures },
    emotion: layers.emotion.emotion,
    motion: layers.motion.motion,
    sound: layers.sound.skipped ? { skipped: true, reason: layers.sound.reason } : layers.sound.sound,
    multimedia: { audit: layers.multimedia.audit },
    measures: { ...final, look: layers.look.measures, sound: layers.sound.measures ?? null },
    sections: current,
    rounds: steps,
    production: {
      storyboard: shotDigest(shots, timing),
      animatic,
      colourScript: layers.look.look.keys,
      styleFrames: layers.look.look.styleFrames,
      prompts: prompts.map((p) => ({ ...p, spec: imagePromptSpec(p) })),
      images,
      imagesNote: !allowed
        ? 'The medium does not generate images.'
        : !wantImages
          ? 'Images are allowed but no imager was given, so prompts were written and nothing was generated.'
          : m.images.generate
            ? null
            : 'These are reference frames for the storyboard: what each shot should communicate and feel like. They do not appear in the film, and the built shots may differ.',
    },
    problems,
  };
}

/** The visual design stages, for diagrams and documentation. */
export const VISUAL_STAGES = Object.freeze([
  {
    id: 'visual-research',
    phase: 'visual',
    title: 'Look up how others showed it',
    parallel: false,
    ops: ['research-visuals'],
  },
  {
    id: 'depict',
    phase: 'visual',
    title: 'Decide what each idea must show',
    parallel: false,
    ops: ['depict-ideas', 'plan-shots', 'time-shots'],
  },
  {
    id: 'structure',
    phase: 'visual',
    title: 'Plan the visual structure',
    parallel: false,
    ops: ['design-structure', 'structure-measures'],
  },
  {
    id: 'layers',
    phase: 'visual',
    title: 'Look, feeling, motion and sound',
    parallel: true,
    ops: [
      'design-look',
      'look-measures',
      'design-emotion',
      'emotion-measures',
      'design-motion',
      'motion-measures',
      'design-sound',
      'sound-measures',
    ],
    when: {
      'design-sound': 'only when the medium has music or effects',
      'sound-measures': 'only when the medium has music or effects',
    },
  },
  {
    id: 'multimedia',
    phase: 'visual',
    title: 'Check against the multimedia principles',
    parallel: false,
    ops: ['multimedia-measures', 'audit-multimedia', 'replan-shots'],
    loop: 2,
    when: { 'replan-shots': 'only for shots whose words changed in a kept narration edit' },
  },
  {
    id: 'deliver',
    phase: 'visual',
    title: 'Storyboard, animatic, style frames and images',
    parallel: false,
    ops: ['write-image-prompts'],
    when: { 'write-image-prompts': 'only when the medium allows images' },
  },
]);

/** Principles of the production process as prompt rules, for operations that plan production work. */
export const PRODUCTION_RULES = principleRules(PRODUCTION_PRINCIPLES);
export const PRODUCTION_EXAMPLES = referenceExamples(referencesFor('production'));
