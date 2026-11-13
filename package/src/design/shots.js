// Shots: the shared plan of what is on screen, when, and for which words. Every visual module reads it and writes to
// it, so it is the contract between them: depiction decides what each idea needs to show, the shot plan places those
// pictures against the narration, and code times every shot from the spoken words.
//
//   depict ideas   (model) for every idea the narration carries: what must be seen, what must not be seen yet, and a
//                  ladder of depictions from the plainest that communicates to the most artful that stays simple
//   plan shots     (model) the shots: where each starts in the narration, what it shows, its elements and their roles,
//                  on-screen text, framing, camera, transition, motion and the library capabilities it uses
//   time shots     (measure) each shot's start, end and duration in spoken seconds, found from its cue in the text
//   replan shots   (model) only the shots whose cue was lost when the narration changed
//
// The default medium is motion graphics: everything is drawn by the library. Images and generated video are explicit
// opt-ins in the medium, and image generation needs an image adapter the caller supplies (see production.js).
import { assert } from '../core/validate.js';
import { defineOperation } from './run.js';
import { boolean, list, number, oneOf, record, shapeErrors, string } from './schema.js';
import { locateQuote } from './insight.js';
import { principleRules, principles, referenceExamples, referencesFor } from './references.js';
import { PLAIN_RULES } from './shared.js';

/** What a medium may put on screen. Motion graphics, drawn by the library, is the default and the optimised case. */
export const MEDIA = Object.freeze({
  'motion-graphics': Object.freeze({
    sources: Object.freeze(['drawn']),
    about:
      'Everything is drawn and animated by the library: shapes, strokes, text, diagrams, plots, particles, simple characters and camera moves. No photographs, footage or generated images.',
  }),
  'motion-graphics-with-images': Object.freeze({
    sources: Object.freeze(['drawn', 'image']),
    about:
      'Drawn motion graphics, plus still images the makers supply or generate (photographs, archival pictures, generated illustrations), animated by the library.',
  }),
  'generated-video': Object.freeze({
    sources: Object.freeze(['drawn', 'image', 'video']),
    about: 'Drawn motion graphics and images, plus video clips from a video generator or footage.',
  }),
});

/**
 * A medium: its kind, whether sound is available (music, effects, voice), whether images may be generated for the film
 * (`images.generate`) and whether style frames may be generated as previews for the makers (`images.previews`).
 * Generation also needs an image adapter at run time; the medium only says it is allowed.
 */
export function resolveMedium(medium = {}) {
  const m = typeof medium === 'string' ? { kind: medium } : (medium ?? {});
  const kind = m.kind ?? 'motion-graphics';
  assert(
    Object.hasOwn(MEDIA, kind),
    'INVALID_OPTION',
    `Unknown medium ${kind}; use one of ${Object.keys(MEDIA).join(', ')}.`,
  );
  const sound = { music: false, effects: false, voice: true, ...(m.sound ?? {}) };
  const generate = Boolean(m.images?.generate) && MEDIA[kind].sources.includes('image');
  // Previews are style frames generated only for the makers to judge the look; they never appear in the film, so any
  // medium may have them.
  const previews = Boolean(m.images?.previews);
  return Object.freeze({
    kind,
    sources: MEDIA[kind].sources,
    about: MEDIA[kind].about,
    sound: Object.freeze(sound),
    images: Object.freeze({ generate, previews }),
  });
}

/** What the library can draw, by capability id. Shots name the capabilities they use; code checks them. */
export const VISUAL_VOCABULARY = Object.freeze(
  [
    ['shapes', 'explainerkit/geometry', 'paths, circles, polygons, arrows, measured constructions and polyhedra'],
    ['shape-operations', 'explainerkit/geometry/shapes', 'combining, cutting and splitting outlines'],
    ['strokes', 'explainerkit/geometry', 'lines drawn on over time, springy paths and hand-drawn strokes'],
    ['paint', 'explainerkit/graphics', 'fills, gradients, clipping and textures'],
    ['color', 'explainerkit/color', 'procedural HSLA palettes, mixing and colour changes over time'],
    ['glyphs', 'explainerkit/typography', 'editable letters and symbols that move, split and morph as objects'],
    ['text', 'explainerkit/typography', 'animated HTML text and typewriter reveals'],
    ['labels', 'explainerkit/layout/labels', 'measured labels and callouts placed beside their targets'],
    [
      'annotations',
      'explainerkit/layout/annotations',
      'annotation policy: arrows, brackets and highlights that point at things',
    ],
    ['plots', 'explainerkit/data', 'axes, scales, plots and units'],
    ['morph', 'explainerkit/morph', 'one shape becoming another, splits and merges'],
    ['deformation', 'explainerkit/geometry', 'bending and warping artwork'],
    ['motion-paths', 'explainerkit/motion', 'timelines, easing, staggering, motion along paths and springs'],
    ['effects', 'explainerkit/motion/effects', 'typewriter, wipe, fly-in, pulse, teeter and colour flash presets'],
    ['physics', 'explainerkit/physics', 'analytic oscillators and trajectories'],
    ['mechanisms', 'explainerkit/mechanisms', 'gears, rolling objects, cranks and belts that drive each other'],
    ['particles', 'explainerkit/particles', 'seeded emitters: streams, sprays and swarms of points'],
    ['fields', 'explainerkit/noise', 'scalar and vector fields, noise and warped grids'],
    ['procedural', 'explainerkit/procedural', 'point sets, density fields, networks and generated crowds of instances'],
    ['characters', 'explainerkit/characters', 'simple characters with faces, poses, walking and acting'],
    ['rigs', 'explainerkit/rigs', 'skeletons that deform artwork'],
    ['camera', 'explainerkit/camera', 'framing, pans, pushes, focus and depth of field'],
    ['depth', 'explainerkit/parallax', 'layered depth and parallax'],
    ['zoom', 'explainerkit/zoom', 'deep zoom through nested scales'],
    ['three-d', 'explainerkit/spatial', '3D transforms, projection and simple 3D scenes'],
    ['look', 'explainerkit/look', 'glow, blur, grain and colour grading effects'],
    ['svg-art', 'explainerkit/import/svg', 'supplied SVG artwork'],
    ['interaction', 'explainerkit/inputs', 'what the viewer can change when the film is paused'],
    ['image', null, 'a still image (photograph, archive or generated); only in media that allow images'],
    ['video', null, 'a video clip; only in media that allow video'],
  ].map(([id, from, draws]) => Object.freeze({ id, from, draws })),
);
const VOCABULARY_IDS = VISUAL_VOCABULARY.map((v) => v.id);

/** Rungs of the ladder of abstraction (after Bret Victor) a depiction can sit on. */
export const ABSTRACTIONS = Object.freeze(['concrete', 'schematic', 'symbolic']);
/** Depiction levels: the plainest picture that communicates, an artful one that stays simple, and a rich one. */
export const DEPICTIONS = Object.freeze(['plain', 'artful', 'rich']);
export const FRAMINGS = Object.freeze(['wide', 'medium', 'close', 'detail', 'diagram', 'text']);
export const CAMERA_MOVES = Object.freeze(['static', 'push-in', 'pull-out', 'pan', 'track', 'zoom-through', 'orbit']);
export const TRANSITIONS = Object.freeze(['cut', 'match', 'morph', 'camera-move', 'continuous', 'wipe']);
export const ELEMENT_ROLES = Object.freeze(['subject', 'context', 'label', 'highlight', 'guide', 'decoration']);

export const SHOT_PRINCIPLES = principles([
  {
    id: 'simplest-that-communicates',
    rule: 'Choose the plainest depiction that still communicates the idea; add one artistic move only when it costs the viewer nothing to read.',
    source: 'Mayer, coherence principle; motion-graphics practice of minimal frames',
    evidence: 'measured',
  },
  {
    id: 'one-idea-per-shot',
    rule: 'Each shot carries one idea. A sentence does not need its own picture; a storyboard has far fewer frames than the script has sentences.',
    source: 'Storyboard practice (Vidico: ten to twenty frames for a sixty to ninety second explainer)',
    evidence: 'practice',
  },
  {
    id: 'show-while-said',
    rule: 'A thing appears on screen while the narration names it, not long before or after.',
    source: 'Mayer, temporal contiguity principle',
    evidence: 'measured',
  },
  {
    id: 'no-early-reveal',
    rule: 'Do not show the reveal, or a picture that makes it guessable, before the narration reaches it.',
    source: 'Insight engineering: leak bounds',
    evidence: 'practice',
  },
  {
    id: 'ladder-of-abstraction',
    rule: 'Move between the concrete case, the schematic and the symbol deliberately, and come back down to the concrete after a symbol.',
    source: 'Bret Victor, Up and Down the Ladder of Abstraction',
    evidence: 'practice',
  },
  {
    id: 'medium-honesty',
    rule: 'Plan only what the medium can render: in motion graphics everything is drawn, so a photograph becomes a drawn image of the thing.',
    source: 'Production constraint',
    evidence: 'practice',
  },
]);

const quote = (description) => string({ max: 300, description: `${description} Copy it exactly from the narration.` });

export const depictIdeas = defineOperation({
  name: 'depict-ideas',
  role: 'You are a motion designer and an explainer at once. You read a script for what the viewer must see, and you look for the simplest picture that does it, then the most artful picture that stays that simple.',
  purpose:
    'For every idea the narration carries, decide what must be seen and what must not be seen yet, and propose a ladder of depictions: plain, artful and rich, with the one to use.',
  method: [
    'The sections are numbered from 1. Read them in order. List the ideas the viewer must understand or feel, in order: usually one every twenty to sixty spoken seconds, not one per sentence.',
    'For each idea, quote the exact words where the narration says it, say what must be seen for it to land, and say what must not be shown yet because a later section reveals it.',
    'Write three depictions. Plain: the fewest elements that communicate the idea (often two or three shapes and one motion). Artful: the same idea with one artistic move that adds feeling or beauty without adding anything to read (a colour shift, a metaphor, a character-like motion, a satisfying transformation). Rich: the fullest version the medium allows.',
    'For each depiction, count its elements, name its rung on the ladder of abstraction (concrete, schematic or symbolic) and list the library capabilities it uses, from the vocabulary given.',
    'Choose one. Prefer artful when it is as easy to read as plain; choose plain when the idea is hard; choose rich only when the idea needs it. Say why.',
  ],
  examples: [
    'For "a lens brings light from one point together again": plain, three rays bend at a lens outline and meet at a dot; artful, the rays are drawn on as glowing strokes that converge and the dot blooms when they meet; rich, a fan of thirty rays with the object and image as small drawn candles.',
    'For "frequency is how many cycles fit in a second": plain, a wave with a one-second bracket and the crests counted aloud; artful, the crests light up one by one as they pass a ticking clock hand.',
    ...referenceExamples(referencesFor('emotion')),
  ],
  rules: [
    `Library vocabulary (use these ids): ${VISUAL_VOCABULARY.map((v) => `${v.id} (${v.draws})`).join('; ')}.`,
    ...principleRules(SHOT_PRINCIPLES),
    ...PLAIN_RULES,
  ],
  output: record({
    ideas: list(
      record({
        id: string({ max: 40 }),
        section: number({ min: 1, max: 60 }),
        quote: quote('The words where the narration says this idea.'),
        idea: string({ max: 240 }),
        mustShow: string({ max: 300 }),
        notYet: string({ max: 240, description: 'What must not be shown yet, or empty.' }),
        depictions: list(
          record({
            level: oneOf(DEPICTIONS),
            depiction: string({ max: 400 }),
            elements: number({ min: 1, max: 40 }),
            abstraction: oneOf(ABSTRACTIONS),
            uses: list(oneOf(VOCABULARY_IDS), { min: 1, max: 6 }),
          }),
          { min: 3, max: 3 },
        ),
        chosen: oneOf(DEPICTIONS),
        why: string({ max: 240 }),
      }),
      { min: 1, max: 60 },
    ),
  }),
});

const element = record({
  id: string({ max: 40 }),
  what: string({ max: 160 }),
  role: oneOf(ELEMENT_ROLES),
  carries: string({ max: 120, description: 'The idea id this element carries, or empty if it carries none.' }),
});

/** One shot of the plan. Modules patch shots by id through applyShotPatches. */
export const shotShape = record({
  id: string({ max: 40 }),
  section: number({ min: 1, max: 60 }),
  cue: quote('The first words of the narration this shot starts on.'),
  idea: string({ max: 40, description: 'The idea id this shot carries.' }),
  shows: string({ max: 500 }),
  elements: list(element, { min: 1, max: 8 }),
  text: list(string({ max: 120 }), { max: 4, description: 'On-screen text, exactly as it would appear.' }),
  framing: oneOf(FRAMINGS),
  camera: oneOf(CAMERA_MOVES),
  transition: oneOf(TRANSITIONS, { description: 'How this shot arrives from the previous one.' }),
  motion: string({ max: 300 }),
  uses: list(oneOf(VOCABULARY_IDS), { min: 1, max: 8 }),
  source: oneOf(['drawn', 'image', 'video']),
  hold: boolean({ description: 'Whether the shot ends on a pause where the viewer can take it in or interact.' }),
});

export const planShots = defineOperation({
  name: 'plan-shots',
  role: 'You are the storyboard artist for a motion-graphics explainer. You turn chosen depictions into shots that a library can animate, timed to the narration.',
  purpose:
    'Turn the chosen depictions into a shot list: where each shot starts in the narration, what it shows, its elements and their roles, any on-screen text, framing, camera, transition, motion and the capabilities it uses.',
  method: [
    'Use the chosen depiction of each idea. A shot usually covers one idea; a long idea may take two shots, and a short bridge may share a shot with its neighbour.',
    'Give every shot a cue: the first words of the narration where it starts, copied exactly. Shots follow the narration in order, and the first shot of each section starts on its first words.',
    'List the elements on screen and give each a role: subject (what the idea is about), context, label, highlight (what points attention), guide (an arrow or path) or decoration. Name the idea each element carries; decoration carries none.',
    'Keep on-screen text short and never a copy of the narration: a label, a number, a term at the moment it is named.',
    'Choose framing, camera move and the transition in from the previous shot. Prefer a match or a morph when the next idea grows out of the last one, and a cut when it is new.',
    'Keep what the viewer must track to three elements at a time, counting labels and guides; stagger the rest so they arrive and leave one by one, or move them into a later shot.',
    'Mark a hold where the viewer should be able to pause, look or interact.',
    'Use only sources the medium allows.',
  ],
  examples: referenceExamples(referencesFor('production')),
  rules: [
    `Library vocabulary (use these ids): ${VISUAL_VOCABULARY.map((v) => `${v.id} (${v.draws})`).join('; ')}.`,
    ...principleRules(SHOT_PRINCIPLES),
  ],
  output: record({ shots: list(shotShape, { min: 1, max: 120 }) }),
});

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
const countWords = (text) => (String(text).match(WORD) ?? []).length;
const round = (v, p = 1) => Math.round(v * 10 ** p) / 10 ** p;

/** Editorial limits on shot length, in spoken seconds. */
export const SHOT_GATE = Object.freeze({ wordsPerMinute: 150, minSeconds: 2, maxSeconds: 45 });

/**
 * Time every shot: find its cue in its section's narration and place it in spoken seconds. A shot ends where the next
 * one starts. Returns the timed shots, the total, and errors (a cue not found, shots out of order, a section with no
 * shot at its start) and notes (shots shorter or longer than the gate allows, sources the medium does not allow).
 */
export function timeShots(sections, shots, { medium = null, gate = SHOT_GATE } = {}) {
  assert(
    Array.isArray(sections) && sections.length >= 1 && sections.length <= 60,
    'INVALID_DATA',
    'Give between 1 and 60 sections.',
  );
  assert(Array.isArray(shots) && shots.length <= 400, 'INVALID_DATA', 'Give at most 400 shots.');
  const wps = gate.wordsPerMinute / 60;
  const starts = [];
  let total = 0;
  for (const s of sections) {
    starts.push(total);
    total += countWords(s.narration ?? '') / wps;
  }
  const errors = [],
    notes = [];
  const located = shots.map((shot) => {
    const i = shot.section - 1;
    if (!Number.isInteger(i) || i < 0 || i >= sections.length) {
      errors.push(`Shot ${shot.id} names section ${shot.section}, which does not exist.`);
      return { shot, at: null };
    }
    const text = String(sections[i].narration ?? '');
    const span = locateQuote(text, shot.cue);
    if (!span) {
      errors.push(`Shot ${shot.id}'s cue is not in section ${shot.section}: "${String(shot.cue).slice(0, 80)}".`);
      return { shot, at: null };
    }
    return { shot, at: starts[i] + countWords(text.slice(0, span[0])) / wps };
  });
  const placed = located.filter((x) => x.at !== null);
  for (let k = 1; k < placed.length; k++)
    if (placed[k].at < placed[k - 1].at)
      errors.push(
        `Shot ${placed[k].shot.id} starts before shot ${placed[k - 1].shot.id}; shots must follow the narration.`,
      );
  const ordered = [...placed].sort((a, b) => a.at - b.at);
  sections.forEach((_, i) => {
    const first = ordered.find((x) => x.shot.section === i + 1);
    if (!first) errors.push(`Section ${i + 1} has no shot.`);
    else if (first.at - starts[i] > 1)
      notes.push(`Section ${i + 1} starts ${round(first.at - starts[i])} s before its first shot.`);
  });
  const allowed = medium ? resolveMedium(medium).sources : null;
  const timed = ordered.map((x, k) => {
    const end = ordered[k + 1]?.at ?? total;
    const seconds = end - x.at;
    if (seconds < gate.minSeconds)
      notes.push(`Shot ${x.shot.id} lasts ${round(seconds)} s, shorter than ${gate.minSeconds} s.`);
    if (seconds > gate.maxSeconds)
      notes.push(`Shot ${x.shot.id} lasts ${round(seconds)} s, longer than ${gate.maxSeconds} s.`);
    if (allowed && !allowed.includes(x.shot.source))
      errors.push(
        `Shot ${x.shot.id} uses a ${x.shot.source} source, which the ${medium.kind ?? medium} medium does not allow.`,
      );
    if (allowed)
      for (const u of x.shot.uses ?? [])
        if ((u === 'image' || u === 'video') && !allowed.includes(u))
          errors.push(`Shot ${x.shot.id} uses ${u}, which the medium does not allow.`);
    return { id: x.shot.id, section: x.shot.section, from: round(x.at), to: round(end), seconds: round(seconds) };
  });
  return { shots: timed, seconds: round(total), errors, notes };
}

export const timeShotsMeasure = defineOperation({
  name: 'time-shots',
  kind: 'measure',
  purpose: 'Time every shot from its cue in the narration, and check order, coverage, length and the medium.',
  compute: ({ sections, shots, medium = null }) => timeShots(sections, shots, { medium }),
});

/** Fields a module may change on a shot. */
export const PATCHABLE = Object.freeze([
  'shows',
  'elements',
  'text',
  'framing',
  'camera',
  'transition',
  'motion',
  'uses',
  'hold',
]);

/**
 * Apply patches to a shot plan: each patch is {shot, field, value, why}. Only PATCHABLE fields change, the value must
 * fit the shot shape, and a patch naming an unknown shot is skipped. Returns the new shots and what applied.
 */
export function applyShotPatches(shots, patches) {
  assert(
    Array.isArray(shots) && Array.isArray(patches) && patches.length <= 400,
    'INVALID_DATA',
    'Give shots and at most 400 patches.',
  );
  const next = shots.map((s) => ({ ...s }));
  const byId = new Map(next.map((s) => [s.id, s]));
  const applied = [],
    skipped = [];
  for (const p of patches) {
    const shot = byId.get(p.shot);
    if (!shot || !PATCHABLE.includes(p.field)) {
      skipped.push(p);
      continue;
    }
    const value = p.field === 'hold' ? Boolean(p.value) : p.value;
    if (shapeErrors(shotShape.fields[p.field], value).length) {
      skipped.push(p);
      continue;
    }
    shot[p.field] = value;
    applied.push(p);
  }
  return { shots: next, applied, skipped };
}

export const replanShots = defineOperation({
  name: 'replan-shots',
  role: planShots.role,
  purpose: 'The narration changed and some shots lost their cue. Replan only those shots against the new narration.',
  method: [
    'Read the shots listed as lost and the current narration of their sections.',
    'For each, write the shot again with a cue copied exactly from the current narration, keeping its id, idea and as much of its design as still fits.',
    'Do not change shots that were not listed.',
  ],
  rules: planShots.rules,
  output: planShots.output,
});

/** The patch shape modules return. */
export const patchShape = record({
  shot: string({ max: 40 }),
  field: oneOf(PATCHABLE),
  value: string({
    max: 800,
    description:
      'The new value. For text fields, the text. For elements, uses and text lists, a JSON array in the shot format. For hold, true or false.',
  }),
  why: string({ max: 200 }),
});

/** Decode patch values a model returned as text into the shot field's type. Undecodable values are dropped. */
export function decodePatches(patches) {
  const out = [];
  for (const p of patches ?? []) {
    let value = p.value;
    if (['elements', 'uses', 'text'].includes(p.field)) {
      try {
        value = JSON.parse(p.value);
      } catch {
        continue;
      }
    } else if (p.field === 'hold') value = p.value === true || p.value === 'true';
    out.push({ ...p, value });
  }
  return out;
}

/** The narration-suggestion shape visual modules return: exact edits, applied only through the process's gate. */
export const narrationEditShape = record({
  section: number({ min: 1, max: 60 }),
  find: string({ max: 600, description: 'The exact words to replace, copied from that section.' }),
  replace: string({ max: 800 }),
  why: string({ max: 200 }),
  carries: string({ max: 40, description: 'The idea id this change serves.' }),
});

/** A compact view of the shots for prompts: one line of fields per shot, with its timing when known. */
export function shotDigest(shots, timing = null) {
  const at = new Map((timing?.shots ?? []).map((t) => [t.id, t]));
  return shots.map((s) => ({
    id: s.id,
    section: s.section,
    ...(at.has(s.id) ? { from: at.get(s.id).from, seconds: at.get(s.id).seconds } : {}),
    idea: s.idea,
    cue: s.cue,
    shows: s.shows,
    elements: s.elements.map((e) => `${e.id}:${e.role}${e.carries ? `>${e.carries}` : ''} ${e.what}`),
    text: s.text,
    framing: s.framing,
    camera: s.camera,
    transition: s.transition,
    motion: s.motion,
    hold: s.hold,
  }));
}

/**
 * The narration each shot covers: from its cue to the next shot's cue in the same section, or the section's end.
 * Shots whose cue is not found get an empty span.
 */
export function shotSpans(sections, shots) {
  const located = shots.map((s) => {
    const text = String(sections[s.section - 1]?.narration ?? '');
    const span = text ? locateQuote(text, s.cue) : null;
    return { id: s.id, section: s.section, at: span ? span[0] : -1 };
  });
  const spans = new Map();
  for (const x of located) {
    if (x.at < 0) {
      spans.set(x.id, '');
      continue;
    }
    const text = String(sections[x.section - 1].narration);
    const next = located
      .filter((y) => y.section === x.section && y.at > x.at)
      .reduce((m, y) => Math.min(m, y.at), text.length);
    spans.set(x.id, text.slice(x.at, next));
  }
  return spans;
}

export const researchVisuals = defineOperation({
  name: 'research-visuals',
  role: 'You are a visual researcher for an explainer studio. Before anyone draws, you find how the best explainers, diagrams and films have shown this subject, and what each picture gets right and wrong.',
  purpose:
    'Find how others have depicted the ideas in this brief (videos, diagrams, textbooks, interactive explanations), and the practitioner advice that bears on showing them in the medium.',
  method: [
    'Search for well-made visual explanations of this topic: explainer videos, interactive explanations, textbook figures and diagrams. For each, describe in your own words how it shows one key idea, what makes the picture work and where it misleads.',
    'Search for practitioners describing how they plan visuals: motion-design studios, explainer channels, animators and directors writing about their own process.',
    'Note standard pictures that are known to mislead (for example a misconception a common diagram creates).',
    'Keep to what the sources show. Give the URLs you opened.',
  ],
  search: true,
  effort: 'high',
  output: record({
    depictions: list(
      record({
        idea: string({ max: 160 }),
        work: string({ max: 200 }),
        how: string({ max: 400, description: 'How it shows the idea, in your own words.' }),
        works: string({ max: 240 }),
        misleads: string({ max: 240 }),
        source: string({ max: 400 }),
      }),
      { max: 12 },
    ),
    practice: list(record({ advice: string({ max: 300 }), source: string({ max: 400 }) }), { max: 10 }),
    misleading: list(string({ max: 300 }), { max: 8 }),
  }),
});
