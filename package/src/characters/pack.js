import { assert, options, safeCopy } from '../core/validate.js';
import { bean } from './builds/bean.js';
import { stick } from './builds/stick.js';
import { bird, fish, microbe } from './builds/creatures.js';
import { quadruped, winged, jumper, cow, mouse, dragonfly, frog } from './builds/families.js';
import { characterFromSVG } from './svg.js';

/** Rig builders a pack manifest may name. Packs carry data and art only, never code. */
export const BUILDERS = Object.freeze({
  bean,
  stick,
  bird,
  fish,
  microbe,
  quadruped,
  winged,
  jumper,
  cow,
  mouse,
  dragonfly,
  frog,
});

/** The starter cast: every entry is a builder plus options, rendered to character.svg by the pack script. */
export const STARTERS = Object.freeze(
  [
    { id: 'cow', builder: 'cow', options: {}, about: 'Parametric spotted quadruped' },
    { id: 'mouse', builder: 'mouse', options: {}, about: 'Parametric small quadruped' },
    { id: 'dragonfly', builder: 'dragonfly', options: {}, about: 'Parametric four-wing insect' },
    { id: 'frog', builder: 'frog', options: {}, about: 'Parametric jumping animal' },
    {
      id: 'bean-everyday',
      builder: 'bean',
      options: { palette: 'teal', skin: 'tan', hair: 'dark', hairStyle: 'bun' },
      about: 'Everyday explainer person',
    },
    {
      id: 'bean-scientist',
      builder: 'bean',
      options: { palette: 'lab', skin: 'light', hair: 'gray', hairStyle: 'short', accessory: 'glasses' },
      about: 'Scientist in a lab coat',
    },
    {
      id: 'bean-engineer',
      builder: 'bean',
      options: { palette: 'mustard', skin: 'deep', hairStyle: 'none', accessory: 'hardhat' },
      about: 'Engineer with a hard hat',
    },
    {
      id: 'bean-student',
      builder: 'bean',
      options: { palette: 'coral', skin: 'brown', hair: 'dark', hairStyle: 'curly', accessory: 'glasses' },
      about: 'Student',
    },
    {
      id: 'bean-night',
      builder: 'bean',
      options: { palette: 'night', skin: 'light', hair: 'red', hairStyle: 'short' },
      about: 'Night-shift worker',
    },
    {
      id: 'stick-classic',
      builder: 'stick',
      options: { style: 'classic' },
      about: 'Classic stick figure with a dot face',
    },
    { id: 'stick-xkcd', builder: 'stick', options: { style: 'xkcd' }, about: 'Thin-line stick figure, no face' },
    { id: 'stick-bold', builder: 'stick', options: { style: 'bold' }, about: 'Bold silhouette stick figure' },
    {
      id: 'stick-heavy',
      builder: 'stick',
      options: { style: 'heavy' },
      about: 'Big-headed heavy-line stick figure for action animation',
    },
    {
      id: 'stick-pill',
      builder: 'stick',
      options: { style: 'pill' },
      about: 'Colored pill-limb figure with a full face',
    },
    { id: 'bird-robin', builder: 'bird', options: { palette: 'robin' }, about: 'Robin' },
    { id: 'bird-canary', builder: 'bird', options: { palette: 'canary' }, about: 'Canary' },
    { id: 'bird-bluebird', builder: 'bird', options: { palette: 'bluebird' }, about: 'Bluebird' },
    { id: 'fish-clown', builder: 'fish', options: { palette: 'clown' }, about: 'Clownfish' },
    { id: 'fish-teal', builder: 'fish', options: { palette: 'teal' }, about: 'Teal reef fish' },
    { id: 'microbe-mint', builder: 'microbe', options: { palette: 'mint' }, about: 'Friendly microbe' },
    { id: 'microbe-violet', builder: 'microbe', options: { palette: 'violet' }, about: 'Violet microbe' },
  ].map((entry) => Object.freeze({ ...entry, options: Object.freeze(entry.options) })),
);

/** Build a starter character by id. */
export function starter(id, overrides = {}) {
  const entry = STARTERS.find((s) => s.id === id);
  assert(entry, 'UNKNOWN_CHARACTER', `No starter character ${id}.`);
  return BUILDERS[entry.builder]({ ...entry.options, name: entry.id, ...overrides });
}

/**
 * Load a character from a pack: manifest is the parsed character.json; svg is the optional (possibly edited)
 * character.svg text. Without svg, the builder's own art is used.
 */
export function loadCharacterPack(manifest, svg = null, spec = {}) {
  const m = safeCopy(manifest);
  options(
    m,
    ['format', 'id', 'builder', 'options', 'about', 'license', 'author', 'rig', 'actions', 'files'],
    'character manifest',
  );
  assert(m.format === 'explainerkit-character@1', 'INVALID_CHARACTER_PACK', 'Unsupported character pack format.');
  assert(Object.hasOwn(BUILDERS, m.builder), 'INVALID_CHARACTER_PACK', `Unknown character builder ${m.builder}.`);
  const def = BUILDERS[m.builder]({ ...(m.options ?? {}), name: m.id });
  return svg == null ? def : characterFromSVG(def, svg, spec);
}

/** The manifest written next to each character.svg. */
export function manifestFor(entry, def) {
  return {
    format: 'explainerkit-character@1',
    id: entry.id,
    builder: entry.builder,
    options: entry.options,
    about: entry.about,
    rig: def.rig,
    actions: Object.keys(def.actions).filter((a) => !a.startsWith('__')),
    license: 'CC0-1.0',
    author: 'ExplainerKit contributors',
    files: ['character.svg', 'character.json', 'LICENSE.txt'],
  };
}
