import { measurePath } from './path.js';
import { assert, number, options } from '../core/validate.js';

/** A reusable position/tangent sampler driven by progress, independent from wall time. */
export function motionPath(commands, spec = {}) {
  options(spec, ['start', 'end', 'offset', 'rotate', 'rotation', 'wrap', 'tolerance'], 'motion path');
  const path = measurePath(commands, { tolerance: spec.tolerance ?? 0.25 }),
    start = number(spec.start ?? 0, 'path start', 0, 1),
    end = number(spec.end ?? 1, 'path end', 0, 1),
    offset = number(spec.offset ?? 0, 'normal offset'),
    rotation = number(spec.rotation ?? 0, 'path rotation offset'),
    rotate = spec.rotate ?? true,
    wrap = spec.wrap ?? false;
  assert(
    typeof rotate === 'boolean' && typeof wrap === 'boolean',
    'INVALID_MOTION_PATH',
    'rotate and wrap must be boolean.',
  );
  return Object.freeze({
    length: path.length,
    closed: path.closed,
    sample(progress) {
      number(progress, 'path progress', wrap ? -1e6 : 0, wrap ? 1e6 : 1);
      if (wrap) progress = ((progress % 1) + 1) % 1;
      const p = path.at(start + (end - start) * progress),
        angle = p.rotation + (end < start ? Math.PI : 0);
      return Object.freeze({
        x: p.x - Math.sin(p.rotation) * offset,
        y: p.y + Math.cos(p.rotation) * offset,
        rotation: rotate ? angle + rotation : rotation,
      });
    },
  });
}
/** Bind an ordinary scene parameter/derived value to real motion along a path. */
export function bindMotionPath(handle, spec = {}) {
  options(
    spec,
    ['commands', 'progress', 'start', 'end', 'offset', 'rotate', 'rotation', 'wrap', 'tolerance'],
    'path binding',
  );
  assert(handle?._scene && typeof handle.bind === 'function', 'INVALID_MOTION_PATH', 'Use a drawable scene handle.');
  assert(handle._scene._ownsInput(spec.progress), 'INVALID_BINDING', 'Use a progress input from the same scene.');
  const { commands, progress, ...settings } = spec,
    path = motionPath(commands, settings),
    keys = spec.rotate === false ? ['x', 'y'] : ['x', 'y', 'rotation'];
  handle.bind(keys, { inputs: [progress], map: path.sample });
  return Object.freeze({ handle, path });
}
