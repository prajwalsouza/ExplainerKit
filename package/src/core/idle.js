import { resolveMotionStyle, motionHolds } from './motion-style.js';
import { assert, number, options, safeCopy } from './validate.js';
import { Derived } from './scene.js';
import { Ambient } from './ambient.js';
import { installHandleEffect } from './sample-effects.js';
const smooth = (t) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
function oscillator(value, label, period, limit) {
  if (value === undefined) return { amplitude: 0, period, phase: 0 };
  const spec = typeof value === 'number' ? { amplitude: value } : safeCopy(value);
  options(spec, ['amplitude', 'period', 'phase'], `idle ${label}`);
  return Object.freeze({
    amplitude: number(spec.amplitude ?? 0, `${label} amplitude`, -limit, limit),
    period: number(spec.period ?? period, `${label} period`, 0.05, 86400),
    phase: number(spec.phase ?? 0, `${label} phase`, -1e6, 1e6),
  });
}
function captureWindows(input) {
  let list;
  if (Array.isArray(input)) {
    assert(input.length > 0 && input.length <= 64, 'RESOURCE_LIMIT', 'Idle supports1–64 time windows.');
    const first = Object.getOwnPropertyDescriptor(input, 0);
    assert(first && 'value' in first, 'INVALID_IDLE', 'Use dense time windows.');
    if (typeof first.value === 'number') {
      const pair = safeCopy(input);
      assert(pair.length === 2, 'INVALID_IDLE', 'A time pair needs exactly[from,to].');
      list = [{ from: pair[0], to: pair[1] }];
    } else
      list = Array.from({ length: input.length }, (_, i) => {
        const d = Object.getOwnPropertyDescriptor(input, i);
        assert(d && 'value' in d, 'INVALID_IDLE', 'Use dense time windows.');
        return d.value;
      });
  } else list = [input];
  return Object.freeze(
    list.map((spec) => {
      options(
        spec,
        [
          'at',
          'duration',
          'from',
          'to',
          'until',
          'end',
          'fade',
          'weight',
          'frame',
          'cut',
          'cutTo',
          'whipPan',
          'zoomThrough',
          'padding',
          'rotation',
          'ease',
          'drift',
          'start',
          'region',
        ],
        'idle window',
      );
      const numericTo = typeof spec.to === 'number' ? spec.to : undefined;
      assert(
        !(spec.at !== undefined && spec.from !== undefined) &&
          !(numericTo !== undefined && spec.duration !== undefined),
        'INVALID_IDLE',
        'Use either at/duration or from/to.',
      );
      const from = number(spec.from ?? spec.at ?? 0, 'idle start', 0, 86400),
        to = number(numericTo ?? spec.until ?? spec.end ?? from + spec.duration, 'idle end', from + 1e-6, 86400),
        fade = number(spec.fade ?? Math.min(0.2, (to - from) / 2), 'idle fade', Number.MIN_VALUE, (to - from) / 2),
        weight = number(spec.weight ?? 1, 'idle window weight', 0, 1);
      return Object.freeze({ from, to, fade, weight });
    }),
  );
}

/**
 * Pure additive/multiplicative secondary motion layered on authored transforms.
 * @param {ReturnType<import('./scene.js').Scene['shape']>} handle
 * @param {{sway?:number|{amplitude?:number,period?:number,phase?:number},turn?:number|{amplitude?:number,period?:number,phase?:number},breathe?:number|{amplitude?:number,period?:number,phase?:number},weight?:number|import('./data.js').Parameter|Derived|Ambient,clock?:Ambient}} [spec]
 */
export function idle(handle, spec = {}) {
  options(spec, ['sway', 'turn', 'breathe', 'weight', 'clock', 'motionStyle', 'holds'], 'idle');
  assert(handle && typeof handle._live === 'function', 'INVALID_IDLE', 'Use a live scene handle.');
  handle._live();
  const scene = handle._scene;
  const style = resolveMotionStyle(spec.motionStyle),
    holds = motionHolds(spec.holds);
  const clock = spec.clock;
  assert(
    clock === undefined || (clock instanceof Ambient && scene._ownsInput(clock)),
    'INVALID_IDLE',
    'clock must be an ambient input owned by this scene.',
  );
  const sway = oscillator(spec.sway, 'sway', 6, 1e5),
    turn = oscillator(spec.turn, 'turn', 8, 1000),
    breathe = oscillator(spec.breathe, 'breathe', 5, 0.9),
    weight = spec.weight ?? 1;
  assert(
    typeof weight === 'number' || (scene._ownsInput(weight) && typeof weight.sample === 'function'),
    'INVALID_BINDING',
    'Idle weight must be numeric or an owned numeric scene input.',
  );
  if (typeof weight === 'number') number(weight, 'idle weight', 0, 1);
  let windows = null,
    disposed = false;
  const sampleWeight = (context) =>
    number(
      typeof weight === 'number'
        ? weight
        : weight instanceof Derived
          ? weight.sample(context)
          : weight.sample(weight instanceof Ambient ? (context.ambient ?? 0) : context.time),
      'idle weight',
      0,
      1,
    );
  const value = (motion, time) => motion.amplitude * Math.sin((time * Math.PI * 2) / motion.period + motion.phase);
  const disposeEffect = installHandleEffect(handle, Symbol('idle'), (props, context) => {
    let w = sampleWeight(context) * style.idle;
    if (style.holdStill && holds.some(([from, to]) => context.time >= from && context.time <= to)) w = 0;
    if (windows)
      w *=
        1 -
        windows.reduce(
          (remaining, window) =>
            remaining *
            (1 -
              window.weight *
                smooth((context.time - window.from) / window.fade) *
                smooth((window.to - context.time) / window.fade)),
          1,
        );
    if (w === 0 || (!sway.amplitude && !turn.amplitude && !breathe.amplitude)) return {};
    const time = clock ? clock.sample(context.ambient ?? 0) : context.time;
    return {
      x: props.x + w * value(sway, time),
      rotation: props.rotation + w * value(turn, time),
      scaleX: props.scaleX * (1 + w * value(breathe, time)),
      scaleY: props.scaleY * (1 + w * value(breathe, time)),
    };
  });
  return Object.freeze({
    /** @param {{at?:number,duration?:number,from?:number,to?:number|string,until?:number,end?:number,fade?:number,weight?:number,zoomThrough?:any,frame?:any}|[number,number]|Array<{at?:number,duration?:number,from?:number,to?:number|string,fade?:number,weight?:number,zoomThrough?:any,frame?:any}>} shotOrTimes */
    during(shotOrTimes) {
      assert(!disposed, 'INVALID_IDLE', 'This idle effect has been disposed.');
      const next = captureWindows(shotOrTimes);
      windows = next;
      scene._changed();
      return this;
    },
    dispose() {
      if (!disposed) {
        disposeEffect();
        disposed = true;
      }
    },
  });
}
