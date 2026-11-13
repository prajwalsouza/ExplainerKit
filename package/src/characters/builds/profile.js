import { stick } from './stick.js';
import { ellipse } from '../shapes.js';
import { faceParts, tone } from './common.js';
import { blend, solveBones, boneToRoot } from '../runtime.js';
import { assert, number, options, text } from '../../core/validate.js';
import { hsla, toHex } from '../../color/index.js';

const BONES = { body: { parent: null, at: [0, -80] }, head: { parent: 'body', at: [0, -136] } };
const EARS = { F: [-7, -19], B: [-10, -20] };
const freezePath = (commands) => Object.freeze(commands.map((command) => Object.freeze(command)));
const HEAD = freezePath([
  ['M', -3, -174],
  ['C', -16, -174, -20, -162, -17, -151],
  ['Q', -15, -139, -5, -137],
  ['L', 5, -138],
  ['Q', 13, -140, 12, -146],
  ['L', 17, -148],
  ['L', 12, -152],
  ['L', 23, -155],
  ['Q', 17, -159, 13, -164],
  ['Q', 9, -174, -3, -174],
  ['Z'],
]);

/**
 * Target just the profile rig's hands and expression from a normalized input.
 * The pose is in character space; facing and scene scale remain runtime-owned.
 * This pure mapping neither captures sound nor installs a clock.
 * @param {Record<string, number>} pose
 * @param {number} amount
 * @returns {Readonly<Record<string, number>>}
 */
export function profileReaction(pose, amount) {
  number(amount, 'profile reaction amount', 0, 1);
  assert(
    pose && (Object.getPrototypeOf(pose) === Object.prototype || Object.getPrototypeOf(pose) === null),
    'INVALID_PROFILE_POSE',
    'Use a plain numeric profile pose.',
  );
  // Read a fixed set of own data channels, never access user getters or traverse a large descriptor.
  const read = (key, fallback = 0) => {
    const descriptor = Object.getOwnPropertyDescriptor(pose, key);
    if (!descriptor) return fallback;
    assert('value' in descriptor, 'INVALID_PROFILE_POSE', 'Profile pose channels must be data values.');
    return number(descriptor.value, 'profile ' + key);
  };
  const captured = {};
  for (const bone of ['body', 'head'])
    for (const field of ['x', 'y', 'r', 'sx', 'sy'])
      captured[bone + '.' + field] = read(bone + '.' + field, field === 'sx' || field === 'sy' ? 1 : 0);
  const world = solveBones({ bones: BONES, order: ['body', 'head'] }, captured);
  const out = {};
  for (const side of ['F', 'B']) {
    const target = boneToRoot(world, 'head', ...EARS[side]);
    const fromX = read('hand' + side + '.x', side === 'F' ? 12 : -10);
    const fromY = read('hand' + side + '.y', -76);
    out['hand' + side + '.x'] = fromX + (target[0] - fromX) * amount;
    out['hand' + side + '.y'] = fromY + (target[1] - fromY) * amount;
    // Explicit hand targets take precedence over an earlier FK or joint-goal layer.
    out['arm' + side + '.mix'] = read('arm' + side + '.mix', 1) * (1 - amount) + amount;
    out['arm' + side + '.targetEnabled'] = amount > 0 ? 0 : read('arm' + side + '.targetEnabled');
  }
  for (const [key, target] of [
    ['face.squint', 0.75],
    ['face.browTilt', 0.5],
    ['face.smile', -0.4],
    ['mouth.open', 0.25],
  ]) {
    const from = read(key);
    out[key] = from + (target - from) * amount;
  }
  return Object.freeze(out);
}

/**
 * A true side-view biped: asymmetric nose/chin silhouette, one visible eye,
 * an ear socket, and separately articulated near/far limbs. Mirror through
 * character(..., {facing:-1}); ordinary biped actions and joint goals apply.
 * @param {{name?:string,line?:number,ink?:string|{h:number,s:number,l:number,a?:number},paper?:string|{h:number,s:number,l:number,a?:number},skin?:string|{h:number,s:number,l:number,a?:number},shirt?:string|{h:number,s:number,l:number,a?:number}}} [spec]
 */
export function profile(spec = {}) {
  options(spec, ['name', 'ink', 'paper', 'skin', 'shirt', 'line'], 'profile character');
  const line = number(spec.line ?? 2.8, 'profile line width', 0.5, 12);
  const ink = spec.ink ?? hsla(25, 8, 14),
    paper = spec.paper ?? hsla(40, 30, 94);
  const skin = spec.skin ?? paper,
    shirt = spec.shirt ?? ink;
  // Public color helpers validate safe authored color records/strings at the boundary.
  const color = (value) => toHex(value);
  const name = spec.name ?? 'profile';
  text(name, 'profile name', 64);
  assert(/^[a-zA-Z][\w-]{0,63}$/.test(name), 'INVALID_CHARACTER', 'Use a short profile character name.');
  const definition = stick({ name, style: 'classic', face: 'none', line, ink: color(ink), paper: color(paper) });
  const flat = (value) => tone(color(value), color(value), color(value));
  definition.palette = {
    ...definition.palette,
    skin: flat(skin),
    headFill: flat(skin),
    shirt: flat(shirt),
    eye: flat(skin),
    lid: flat(skin),
    pupil: flat(ink),
    mouth: flat(ink),
    hair: flat(ink),
  };
  definition.parts = definition.parts.filter((part) => !['shadow', 'headFill', 'headLine'].includes(part.id));
  for (const part of definition.parts) {
    part.shade = false;
    if (part.id === 'armB' || part.id === 'legB') part.opacity = 0.5;
  }
  definition.parts.push(
    { id: 'headFill', bone: 'head', z: 20, slot: 'headFill', shade: false, commands: HEAD },
    { id: 'headLine', bone: 'head', z: 21, slot: 'ink', stroke: line, encloses: true, commands: HEAD },
    { id: 'ear', bone: 'head', z: 27, slot: 'ink', stroke: line * 0.6, commands: ellipse(-7, -155, 3, 4.5) },
    ...faceParts({
      bone: 'head',
      origin: [0, -136],
      eyes: [[9, -160]],
      eyeRx: 2.6,
      eyeRy: 3,
      pupil: 1.8,
      brows: true,
      browY: -166,
      browLength: 5,
      browThickness: 1.5,
      mouth: [12, -147],
      mouthSize: 4,
      turn: 1.1,
      z: 30,
      lidSlot: 'lid',
    }),
    ...['F', 'B'].flatMap((side) => {
      const draw = (pose) => ellipse(pose['hand' + side + '.x'], pose['hand' + side + '.y'], line * 1.15);
      const z = side === 'F' ? 55 : 53;
      return [
        { id: 'hand' + side, bone: null, z, slot: 'skin', shade: false, draw },
        { id: 'hand' + side + 'Line', bone: null, z: z + 1, slot: 'ink', stroke: line * 0.55, shade: false, draw },
      ];
    }),
  );
  definition.actions = {
    ...definition.actions,
    coverEars(pose, elapsed, params, context, weight) {
      const intensity = number(params.intensity ?? 1, 'cover ears intensity', 0, 1);
      const raised = Math.min(1, Math.max(0, elapsed / 0.25));
      const target = profileReaction(pose, intensity * raised * raised * (3 - 2 * raised));
      for (const [key, value] of Object.entries(target)) blend(pose, key, value, weight);
    },
  };
  definition.actionDefaults = { ...definition.actionDefaults, coverEars: { duration: 2, intensity: 1 } };
  definition.sockets = {
    ...definition.sockets,
    earF: { part: 'headFill', at: EARS.F },
    earB: { part: 'headFill', at: EARS.B },
  };
  definition.meta = Object.freeze({ author: 'ExplainerKit', license: 'CC0-1.0', style: 'flat side-profile biped' });
  return definition;
}
