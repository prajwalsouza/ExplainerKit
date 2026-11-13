// Design: programmable processes for writing explanations and stories. Operations are narrow steps with declared
// output shapes; measures are deterministic counts and checks; a run calls them with a model the caller supplies
// and records every result and its token use. Complete processes: `designExplainer` (a topic to a reviewed
// narrated script), `designFable` (a topic to a reviewed science fable) and `designSeries` (several subtopics or
// learning objectives to one stitched piece or a series). Research tooling for studying creators' transcripts is
// internal to the repository (scripts/design/study.mjs) and not part of this module.
//
//   schema.js     output shapes, which become strict JSON Schema and check answers
//   run.js        operations, prompt rendering, the recorded and resumable run
//   measures.js   deterministic counts and structural checks
//   shared.js     shared shapes and the voice and caveat rules
//   explore.js    research: surprises, stories, unusual sources, everyday encounters, people, investigation
//   lateral.js    lateral thinking: reframing, provocation, random entry, bisociation, frame creation, images
//   craft.js      choosing, working backward, meaning, reviews, voice polish, naming
//   explainer.js  the narrated explainer process
//   fable.js      the science fable process
//   flow.js       registers and depths for how a telling moves, and the measure that summarises them
//   philosophy.js the debates a story touches and whether to leap there: none, light or central
//   insight.js    insight engineering: the cascade engineer, the reader audit and the insight measures
//   audience.js   who is watching: personas across mastery levels, and the insight audit run once for each
//   terms.js      the technical words and coined labels a viewer must hold, and whether each is pictured first
//   attention.js  the hook and keeping people there: research, the hook engineer, the viewer audit and the patience ledger
//   references.js practitioner and research references and the principles each module follows
//   shots.js      the shared shot plan: media, the drawable vocabulary, depictions, shots and their timing
//   multimedia.js Mayer's multimedia principles checked against the shot plan
//   cinematography.js  visual structure: sequences, intensity, contrast and affinity, framing and cutting
//   look.js       the colour script, palette and style frames
//   emotion.js    feeling, character, metaphor and play, each tied to an idea
//   motion-language.js how things move: congruence, staging, the principles of animation
//   sound-design.js    music, effects and silence when the medium has sound
//   production.js the visual design process and its loop, deliverables and optional image generation
//   outline.js    the final script as a tagged outline, with claims and sources nested under each section
//   series.js     several subtopics or learning objectives: per-topic discovery, cohesion filter, stitching
import * as explore from './explore.js';
import * as lateral from './lateral.js';
import * as craft from './craft.js';
import * as explainer from './explainer.js';
import * as fable from './fable.js';
import * as flow from './flow.js';
import * as series from './series.js';
import * as philosophy from './philosophy.js';
import * as insight from './insight.js';
import * as audience from './audience.js';
import * as terms from './terms.js';
import * as attention from './attention.js';
import * as shots from './shots.js';
import * as multimedia from './multimedia.js';
import * as cinematography from './cinematography.js';
import * as look from './look.js';
import * as emotion from './emotion.js';
import * as motionLanguage from './motion-language.js';
import * as soundDesign from './sound-design.js';
import * as production from './production.js';

export { boolean, expectShape, list, number, oneOf, record, shapeErrors, string } from './schema.js';
export { EFFORTS, OPERATION_KINDS, createDesignRun, defineOperation, renderPrompt } from './run.js';
export {
  HEDGES,
  INSTRUCTIONS,
  PHILOSOPHY_JARGON,
  STOCK_PHRASES,
  allegoryCoverage,
  checkTelling,
  philosophyJargon,
  scriptStats,
  shortRuns,
  termHits,
} from './measures.js';
export { CAVEAT_RULES, PLAIN_RULES, VOICE_EXAMPLES, VOICE_RULES } from './shared.js';
export * from './explore.js';
export * from './lateral.js';
export * from './craft.js';
export * from './explainer.js';
export * from './fable.js';
export * from './flow.js';
export * from './series.js';
export * from './philosophy.js';
export * from './insight.js';
export * from './audience.js';
export * from './terms.js';
export * from './attention.js';
export * from './references.js';
export * from './shots.js';
export * from './multimedia.js';
export * from './cinematography.js';
export * from './look.js';
export * from './emotion.js';
export * from './motion-language.js';
export * from './sound-design.js';
export * from './production.js';
export { outlineExplainer, outlineFable, outlineSeries, renderOutline } from './outline.js';

const isOperation = (value) =>
  value &&
  typeof value === 'object' &&
  typeof value.name === 'string' &&
  (value.kind === 'model' || value.kind === 'measure') &&
  'purpose' in value;
const group = (module) =>
  Object.freeze(
    Object.fromEntries(
      Object.values(module)
        .filter(isOperation)
        .map((op) => [op.name, op]),
    ),
  );

/** Every operation, grouped by the stage it belongs to, keyed by operation name. */
export const OPERATIONS = Object.freeze({
  explore: group(explore),
  lateral: group(lateral),
  craft: group(craft),
  explainer: group(explainer),
  fable: group(fable),
  flow: group(flow),
  series: group(series),
  philosophy: group(philosophy),
  insight: group(insight),
  audience: group(audience),
  terms: group(terms),
  attention: group(attention),
  shots: group(shots),
  multimedia: group(multimedia),
  cinematography: group(cinematography),
  look: group(look),
  emotion: group(emotion),
  motion: group(motionLanguage),
  sound: group(soundDesign),
  production: group(production),
});
