export { Scene } from './scene.js';
export { KitError } from './validate.js';
export { linearScale } from './geometry.js';
export { clamp, lerp, ease, seeded, beats, readingPace } from './motion.js';
import { Scene } from './scene.js';
/** @param {ConstructorParameters<typeof Scene>[0]} [options] */
export function scene(options) {
  return new Scene(options);
}

export { cubicBezier } from './timing.js';

export { idle } from './idle.js';

export { motionStyle, MOTION_STYLES } from './motion-style.js';
