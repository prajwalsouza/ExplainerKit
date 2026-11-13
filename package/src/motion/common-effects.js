import { assert, number, options, safeCopy, text } from '../core/validate.js';
import { mix, toHSLA } from '../color/index.js';
import { segmentText } from '../typography/segment.js';

const effects = new WeakSet();
const names = Object.freeze(['typewriter', 'wipe', 'flyIn', 'pulse', 'teeter', 'colorFlash']);
const directions = ['left', 'right', 'up', 'down'];
const clamp = (value) => Math.max(0, Math.min(1, value));
const smooth = (value) => value * value * (3 - 2 * value);

/** Pure, seekable presets for one handle. No clock or renderer is installed. */
export function commonEffect(name, input = {}) {
  assert(names.includes(name), 'INVALID_EFFECT', `Use ${names.join(', ')}.`);
  const fields = {
    typewriter: ['at', 'duration', 'text', 'locale'],
    wipe: ['at', 'duration', 'direction', 'x', 'y', 'width', 'height'],
    flyIn: ['at', 'duration', 'direction', 'distance', 'x', 'y', 'opacity'],
    pulse: ['at', 'duration', 'scaleX', 'scaleY', 'amount'],
    teeter: ['at', 'duration', 'rotation', 'angle'],
    colorFlash: ['at', 'duration', 'fill', 'flash'],
  };
  options(input, fields[name], 'common effect');
  const spec = safeCopy(input);
  const at = number(spec.at ?? 0, 'effect onset', 0, 86400);
  const duration = number(spec.duration ?? 0.6, 'effect duration', 0.001, 30);
  const end = number(at + duration, 'effect end', 0, 86400);
  let channels;
  let sample;
  if (name === 'typewriter') {
    const value = text(spec.text, 'typewriter text', 10000);
    const parts = segmentText(value, { split: 'graphemes', locale: spec.locale }).segments;
    channels = ['text'];
    sample = (p) => ({ text: value.slice(0, parts[Math.floor(p * parts.length) - 1]?.end ?? 0) });
  } else if (name === 'wipe') {
    const direction = spec.direction ?? 'right';
    assert(directions.includes(direction), 'INVALID_EFFECT', 'Wipe direction must be left, right, up or down.');
    const x = number(spec.x ?? 0, 'wipe x');
    const y = number(spec.y ?? 0, 'wipe y');
    const width = number(spec.width, 'wipe width', 0, 1e6);
    const height = number(spec.height, 'wipe height', 0, 1e6);
    number(x + width, 'wipe right edge');
    number(y + height, 'wipe bottom edge');
    channels = ['clip'];
    sample = (p) => {
      const horizontal = direction === 'left' || direction === 'right';
      const w = horizontal ? width * p : width;
      const h = horizontal ? height : height * p;
      return {
        clip: {
          type: 'rect',
          x: x + (direction === 'left' ? width - w : 0),
          y: y + (direction === 'up' ? height - h : 0),
          width: w,
          height: h,
          rx: 0,
        },
      };
    };
  } else if (name === 'flyIn') {
    const direction = spec.direction ?? 'left';
    assert(directions.includes(direction), 'INVALID_EFFECT', 'Fly-in direction must be left, right, up or down.');
    const distance = number(spec.distance ?? 80, 'fly-in distance', 0, 1e6);
    const x = number(spec.x ?? 0, 'fly-in target x');
    const y = number(spec.y ?? 0, 'fly-in target y');
    const opacity = number(spec.opacity ?? 1, 'fly-in opacity', 0, 1);
    number(x + (direction === 'left' ? -distance : direction === 'right' ? distance : 0), 'fly-in start x');
    number(y + (direction === 'up' ? -distance : direction === 'down' ? distance : 0), 'fly-in start y');
    channels = ['x', 'y', 'opacity'];
    sample = (p) => {
      const remain = 1 - smooth(p);
      return {
        x: x + (direction === 'left' ? -distance * remain : direction === 'right' ? distance * remain : 0),
        y: y + (direction === 'up' ? -distance * remain : direction === 'down' ? distance * remain : 0),
        opacity: opacity * smooth(p),
      };
    };
  } else if (name === 'pulse') {
    const scaleX = number(spec.scaleX ?? 1, 'pulse scaleX', -1e4, 1e4);
    const scaleY = number(spec.scaleY ?? 1, 'pulse scaleY', -1e4, 1e4);
    const amount = number(spec.amount ?? 0.15, 'pulse amount', 0, 2);
    channels = ['scaleX', 'scaleY'];
    sample = (p) => ({
      scaleX: scaleX * (1 + amount * (p === 0 || p === 1 ? 0 : Math.sin(Math.PI * p))),
      scaleY: scaleY * (1 + amount * (p === 0 || p === 1 ? 0 : Math.sin(Math.PI * p))),
    });
  } else if (name === 'teeter') {
    const rotation = number(spec.rotation ?? 0, 'teeter rotation');
    const angle = number(spec.angle ?? 0.18, 'teeter angle', 0, Math.PI);
    channels = ['rotation'];
    sample = (p) => ({ rotation: rotation + angle * Math.sin(4 * Math.PI * p) * (1 - p) });
  } else {
    const fill = text(spec.fill, 'base fill', 256);
    const flash = text(spec.flash, 'flash fill', 256);
    toHSLA(fill);
    toHSLA(flash);
    channels = ['fill'];
    sample = (p) => ({ fill: p <= 0 || p >= 1 ? fill : mix(fill, flash, Math.sin(Math.PI * p)) });
  }
  const effect = Object.freeze({
    name,
    at,
    end,
    channels: Object.freeze(channels),
    sample(time, reducedMotion = false) {
      const t = number(time, 'effect sample time', 0, 86400);
      assert(typeof reducedMotion === 'boolean', 'INVALID_EFFECT', 'reducedMotion must be boolean.');
      const p = reducedMotion ? (t < at ? 0 : 1) : clamp((t - at) / duration);
      return safeCopy(sample(p));
    },
  });
  effects.add(effect);
  return effect;
}

/** Bind one preset to its ordinary scene channels; the caller owns unbinding. */
export function bindCommonEffect(handle, effect, spec = {}) {
  assert(
    handle && typeof handle.bind === 'function' && effects.has(effect),
    'INVALID_EFFECT',
    'Use a scene handle and a common effect.',
  );
  options(spec, ['reducedMotion'], 'effect binding');
  const reducedMotion = spec.reducedMotion ?? false;
  assert(typeof reducedMotion === 'boolean', 'INVALID_EFFECT', 'reducedMotion must be boolean.');
  handle.bind(effect.channels, { map: (context) => effect.sample(context.time, reducedMotion) });
  return handle;
}
