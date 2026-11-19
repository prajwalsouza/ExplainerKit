/** Shared motion vocabulary; no player, renderer, or browser side effects. */
export { ease, beats, readingPace } from '../core/motion.js';
export { cubicBezier } from '../core/timing.js';
export { idle } from '../core/idle.js';
export { motionStyle, MOTION_STYLES } from '../core/motion-style.js';
export { spring, springEasing, inertia, lag, jiggle, squashStretch } from '../physics/index.js';
export { motionPath, bindMotionPath } from '../geometry/motion-path.js';
export { springTiming } from './spring-timing.js';
export { easingCurve, stagger } from './curves.js';
export { commonEffect, bindCommonEffect } from './common-effects.js';

/** @typedef {import('./spring-timing.js').SpringTimingOptions} SpringTimingOptions */

export { Timeline, createTimeline } from './timeline.js';
/** @typedef {import('./timeline.js').TimelineValue} TimelineValue */
/** @typedef {import('./timeline.js').TimelineOptions} TimelineOptions */
/** @typedef {import('./timeline.js').TimelineChannel} TimelineChannel */
/** @typedef {import('./timeline.js').TimelineSnapshot} TimelineSnapshot */
/** @typedef {import('./timeline.js').TimelineValuesSnapshot} TimelineValuesSnapshot */
/** @typedef {import('./timeline.js').PreparedTimeline} PreparedTimeline */
/** @typedef {import('./timeline.js').TimelineEvent} TimelineEvent */
export { smoothWindow, remap, envelope, keyed } from './ranges.js';
