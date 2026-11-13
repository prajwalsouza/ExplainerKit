// Look: the colour script and style frames. A colour script plans how colour and light move through the whole film,
// one key per sequence, before any scene is finished; style frames are a few finished-looking stills that fix the look
// before anything moves. Colours are HSLA, as the colour module expects, and code checks that they are valid, that
// text reads against its background, that the palette stays small, that one accent is kept for what matters and that
// light and dark follow the intensity of the visual structure.
//
//   design look    (model) the palette with roles, a key per sequence, consistent colour meanings and style frames
//   look measures  (measure) valid colours, palette size, text contrast, accent use, value contrast at peaks
import { assert } from '../core/validate.js';
import { hsla, toRGBA, toHex } from '../color/space.js';
import { contrastRGB } from '../color/perceptual.js';
import { defineOperation } from './run.js';
import { list, number, oneOf, record, string } from './schema.js';
import { principleRules, principles, referenceExamples, referencesFor } from './references.js';
import { shotDigest } from './shots.js';

/**
 * Visual styles: the house look a film's colour script, style frames and generated images follow. The default is a
 * soft, clean, 2.5D minimalism: simple shapes with rounded edges, gentle depth from soft shadows and layered planes,
 * matte surfaces with a hint of clay without its texture, soft light and a small harmonious palette. It is chosen to be
 * beautiful and still simple enough for the library to draw with layered shapes, soft gradients, blurred shadows and a
 * little parallax. A style's `look` and `avoid` are added to every image prompt in code, so a model cannot drop them.
 */
export const VISUAL_STYLES = Object.freeze({
  'soft-minimal-2.5d': Object.freeze({
    name: 'Soft 2.5D minimalism',
    look: 'soft 2.5D minimalist motion-graphics illustration: every shape is slightly raised, like smooth matte paper or soft clay cut-outs resting just above the background, each casting a soft diffuse shadow beneath it; lines and curves become soft rounded ribbons with a gentle highlight along their top edge; simple geometric shapes with softly rounded corners; light from the top left; subtle depth between a few layered planes; smooth soft gradients; no clay texture; a small harmonious palette with one warm accent; generous negative space; calm, artistic and beautiful',
    keywords: Object.freeze([
      'soft 2.5D',
      'raised shapes',
      'soft diffuse shadows',
      'rounded ribbons',
      'clean minimalism',
      'simple shapes',
      'matte',
      'layered depth',
      'artistic',
      'beautiful',
    ]),
    avoid:
      'flat vector look, hard thin hairlines, photorealism, realistic human faces or skin, fine texture, film grain or noise, clutter, busy backgrounds, glossy plastic, hyper-detailed 3D render, lens flares, text unless it is asked for',
    useCase: 'stylized-concept',
    drawable:
      'layered shapes with rounded corners, soft linear and radial gradients, blurred offset shadows, thick rounded strokes with a highlight stroke, a little parallax between planes and soft glows for emphasis',
  }),
  'flat-vector': Object.freeze({
    name: 'Flat vector',
    look: 'flat vector motion-graphics illustration, simple shapes, clean thin lines, solid fills, no shading, small palette, generous negative space',
    keywords: Object.freeze(['flat', 'vector', 'simple shapes', 'clean lines']),
    avoid: 'photorealism, texture, gradients, shadows, 3D, clutter, text unless it is asked for',
    drawable: 'solid-filled shapes and strokes',
  }),
});
export const DEFAULT_STYLE = 'soft-minimal-2.5d';

/** A style by name, or a custom style object with at least `look`; missing parts come from the default. */
export function resolveStyle(style = DEFAULT_STYLE) {
  if (typeof style === 'string') {
    assert(
      Object.hasOwn(VISUAL_STYLES, style),
      'INVALID_OPTION',
      `Unknown style ${style}; use one of ${Object.keys(VISUAL_STYLES).join(', ')} or a style object.`,
    );
    return VISUAL_STYLES[style];
  }
  assert(
    style && typeof style.look === 'string' && style.look.length <= 1200,
    'INVALID_OPTION',
    'A custom style needs a look of at most 1200 characters.',
  );
  return Object.freeze({ ...VISUAL_STYLES[DEFAULT_STYLE], name: 'Custom', keywords: [], ...style });
}

export const LOOK_PRINCIPLES = principles([
  {
    id: 'colour-script',
    rule: 'Plan colour across the whole film first, one key per sequence, so colour changes with the story rather than shot by shot.',
    source: 'Pixar colour scripts (Ralph Eggleston)',
    evidence: 'practice',
  },
  {
    id: 'value-first',
    rule: 'Plan light and dark before hue: the brightest value contrast belongs to the peak moments.',
    source: 'Colour-script and painting practice',
    evidence: 'practice',
  },
  {
    id: 'limited-palette',
    rule: 'Keep the palette small (about five colours) so a change of colour means something.',
    source: 'Motion-design practice; Block on colour affinity',
    evidence: 'practice',
  },
  {
    id: 'one-accent',
    rule: 'Keep one accent colour for what the viewer must look at; using it everywhere spends it.',
    source: 'Mayer, signalling principle',
    evidence: 'measured',
  },
  {
    id: 'consistent-meaning',
    rule: 'A colour that stands for a thing keeps meaning that thing through the film (one hue for phase, another for brightness).',
    source: 'Information-design practice (Tufte; Munzner on channel consistency)',
    evidence: 'observed',
  },
  {
    id: 'feeling',
    rule: 'Warm, saturated keys raise energy and cool, desaturated keys calm it; choose them for the sequence’s feeling.',
    source: 'Bellantoni, If It’s Purple, Someone’s Gonna Die; Plass et al. 2014',
    evidence: 'observed',
  },
  {
    id: 'readable',
    rule: 'Text and thin lines need contrast with their background of at least 4.5 to 1.',
    source: 'WCAG 2 contrast minimum',
    evidence: 'measured',
  },
]);

const colour = record({
  h: number({ min: 0, max: 360 }),
  s: number({ min: 0, max: 100 }),
  l: number({ min: 0, max: 100 }),
});

export const PALETTE_ROLES = Object.freeze(['background', 'ink', 'text', 'accent', 'support', 'secondary']);

export const designLook = defineOperation({
  name: 'design-look',
  role: 'You are the art director and colour-script painter for a motion-graphics explainer. You decide the look of the whole film before any scene is finished.',
  purpose:
    'Write the palette with roles, a colour key per sequence that follows the visual structure, the colour meanings that stay fixed through the film, and three to six style frames.',
  method: [
    'Read the brief, the style, the sequences with their intensity and purpose, and the shots. Everything you design belongs to the style: its shapes, its depth, its light and its kind of palette.',
    'Style frames are references to aim for, not specifications: describe the best picture of each idea in the style, and add a short note on how it could be approached with what the style lists as drawable. The built shot may differ.',
    'Choose a small palette in HSLA (hue in degrees, saturation and lightness in percent) with roles: background, ink (lines and shapes), text, one accent, and up to two support colours.',
    'Fix colour meanings: which colour always stands for which recurring thing.',
    'For each sequence, give a key: background and dominant colour, whether it reads light, mid or dark, and the feeling. Let value contrast and saturation rise with intensity.',
    'Choose three to six style frames: shots that show the look at its most characteristic (the opening, a build, the peak, the return). Describe each frame as a finished still: composition, colours by role, the one thing the eye goes to.',
  ],
  examples: referenceExamples(referencesFor('look')),
  rules: [...principleRules(LOOK_PRINCIPLES), 'Use only colours from the palette in sequence keys, by role name.'],
  output: record({
    palette: list(record({ role: oneOf(PALETTE_ROLES), name: string({ max: 40 }), colour }), { min: 3, max: 7 }),
    meanings: list(record({ thing: string({ max: 80 }), role: oneOf(PALETTE_ROLES) }), { max: 10 }),
    keys: list(
      record({
        sequence: string({ max: 40 }),
        background: oneOf(PALETTE_ROLES),
        dominant: oneOf(PALETTE_ROLES),
        value: oneOf(['light', 'mid', 'dark']),
        feeling: string({ max: 120 }),
      }),
      { min: 1, max: 40 },
    ),
    styleFrames: list(record({ shot: string({ max: 40 }), frame: string({ max: 600 }), eye: string({ max: 160 }) }), {
      min: 1,
      max: 6,
    }),
  }),
});

/** Editorial thresholds for the look gate. */
export const LOOK_GATE = Object.freeze({ maxPalette: 6, minTextContrast: 4.5, peakIntensity: 0.7, minPeakContrast: 3 });

export const lookMeasures = defineOperation({
  name: 'look-measures',
  kind: 'measure',
  purpose:
    'Check the look: valid HSLA colours, palette size, text contrast, accent use and value contrast at the peaks.',
  compute({ look, structure = null, gate = LOOK_GATE }) {
    assert(look && Array.isArray(look.palette) && Array.isArray(look.keys), 'INVALID_DATA', 'Give the look.');
    const problems = [];
    const byRole = new Map();
    const palette = look.palette.map((p) => {
      const css = hsla(p.colour.h, p.colour.s, p.colour.l);
      if (!byRole.has(p.role)) byRole.set(p.role, toRGBA(css));
      return { role: p.role, name: p.name, css, hex: toHex(css) };
    });
    if (palette.length > gate.maxPalette)
      problems.push(`The palette has ${palette.length} colours; keep it to about ${gate.maxPalette}.`);
    for (const role of ['background', 'text', 'accent'])
      if (!byRole.has(role)) problems.push(`The palette has no ${role} colour.`);
    const ratio = (a, b) =>
      byRole.has(a) && byRole.has(b) ? Math.round(contrastRGB(byRole.get(a), byRole.get(b)) * 100) / 100 : null;
    const text = ratio('text', 'background'),
      ink = ratio('ink', 'background'),
      accent = ratio('accent', 'background');
    if (text !== null && text < gate.minTextContrast)
      problems.push(`Text against the background is ${text} to 1; it needs ${gate.minTextContrast}.`);
    if (ink !== null && ink < 3)
      problems.push(`Lines against the background are ${ink} to 1; thin lines will be hard to see.`);
    const accentKeys = look.keys.filter((k) => k.dominant === 'accent').length;
    if (look.keys.length > 2 && accentKeys > look.keys.length / 2)
      problems.push(`The accent dominates ${accentKeys} of ${look.keys.length} sequences; keep it for what matters.`);
    const intensity = new Map((structure?.sequences ?? []).map((q) => [q.id, q.intensity]));
    const keys = look.keys.map((k) => {
      const c = ratio(k.dominant, k.background);
      const peak = (intensity.get(k.sequence) ?? 0) >= gate.peakIntensity;
      if (peak && c !== null && c < gate.minPeakContrast)
        problems.push(`Sequence ${k.sequence} is a peak but its key has little value contrast (${c} to 1).`);
      if (structure && !intensity.has(k.sequence))
        problems.push(`The key names sequence ${k.sequence}, which the structure does not have.`);
      return { sequence: k.sequence, contrast: c, peak };
    });
    return { palette, textContrast: text, inkContrast: ink, accentContrast: accent, keys, problems };
  },
});

/** Design the look for a structure and shot plan and measure it. */
export async function planLook(run, { brief, shots, timing, structure, style = DEFAULT_STYLE }) {
  const s = resolveStyle(style);
  const look = await run.call(designLook, {
    brief,
    style: { name: s.name, look: s.look, avoid: s.avoid, drawable: s.drawable },
    sequences: structure.sequences.map((q) => ({
      id: q.id,
      purpose: q.purpose,
      intensity: q.intensity,
      shots: q.shots,
    })),
    shots: shotDigest(shots, timing),
  });
  const measures = await run.call(lookMeasures, { look, structure });
  return { look, measures, problems: measures.problems };
}
