import { assert, number, options, safeCopy } from '../core/validate.js';

/** Find a slow arrival after a reach's peak in an authored world-space hand path.
 * @param {{socket:(name:string,time:number)=>{x:number,y:number}}} actor
 * @param {{from:number,to:number,hand?:'F'|'B',fps?:number,maxSpeedRatio?:number,target?:readonly number[],radius?:number}} spec
 */
export function contactTiming(actor, spec) {
  options(spec, ['from', 'to', 'hand', 'fps', 'maxSpeedRatio', 'target', 'radius'], 'contact timing');
  assert(typeof actor?.socket === 'function', 'INVALID_CONTACT', 'Contact timing needs a character socket.');
  const from = number(spec.from, 'reach start', 0, 86400),
    to = number(spec.to, 'reach end', from, 86400),
    fps = number(spec.fps ?? 120, 'contact sampling rate', 12, 240),
    ratio = number(spec.maxSpeedRatio ?? 0.2, 'arrival speed ratio', 0, 1),
    radius = number(spec.radius ?? 10, 'contact radius', 0, 1e5),
    hand = spec.hand ?? 'F';
  assert(hand === 'F' || hand === 'B', 'INVALID_CONTACT', 'Choose hand F or B.');
  const count = Math.ceil((to - from) * fps);
  assert(count >= 4 && count <= 4096, 'RESOURCE_LIMIT', 'Use a contact window of 4–4096 sample intervals.');
  let target = null;
  if (spec.target !== undefined) {
    target = safeCopy(spec.target);
    assert(Array.isArray(target) && target.length === 2, 'INVALID_CONTACT', 'Contact target needs world [x,y].');
    target.forEach((v) => number(v, 'contact target'));
  }
  const step = (to - from) / count,
    points = Array.from({ length: count + 1 }, (_, i) => {
      const p = actor.socket('hand' + hand, from + i * step);
      return { x: number(p?.x, 'hand x'), y: number(p?.y, 'hand y') };
    });
  const speed = points.map((p, i) => {
    const a = points[Math.max(0, i - 1)],
      b = points[Math.min(count, i + 1)];
    return Math.hypot(b.x - a.x, b.y - a.y) / (i === 0 || i === count ? step : 2 * step);
  });
  const peak = Math.max(...speed),
    peakIndex = speed.indexOf(peak),
    travel = points.reduce((sum, p, i) => (i ? sum + Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) : 0), 0);
  const unknown = (reason) =>
    Object.freeze({
      status: 'unknown',
      at: null,
      reason,
      peakTime: from + peakIndex * step,
      peakSpeed: peak,
      speed: null,
      speedRatio: null,
      travel,
      sampleStep: step,
    });
  if (peak <= 1e-8 || travel <= 1e-8) return unknown('no-reach');
  for (let i = peakIndex + 1; i <= count; i++) {
    if (speed[i] > peak * ratio || speed[i] > speed[i - 1] + 1e-8 || (i < count && speed[i] > speed[i + 1] + 1e-8))
      continue;
    if (target && Math.hypot(points[i].x - target[0], points[i].y - target[1]) > radius) continue;
    return Object.freeze({
      status: 'known',
      at: from + i * step,
      reason: 'slow-arrival-after-peak',
      peakTime: from + peakIndex * step,
      peakSpeed: peak,
      speed: speed[i],
      speedRatio: speed[i] / peak,
      travel,
      sampleStep: step,
    });
  }
  return unknown(target ? 'no-slow-contact-at-target' : 'no-slow-arrival');
}

/** Schedule the existing reversible hold at a spatially verified slow arrival.
 * Unknown contact returns without mutating the scene. The prop must be static
 * during the reach; use contactTiming with explicit targets for moving props.
 * @param {import('./runtime.js').CharacterHandle} actor
 * @param {any} prop
 * @param {{from:number,to:number,until:number,hand?:'F'|'B',fps?:number,maxSpeedRatio?:number,radius?:number,anchor?:readonly number[],offset?:readonly number[],align?:'hand'|'upright',blend?:number,release?:'freeze'|'authored'}} spec
 */
export function holdAtContact(actor, prop, spec) {
  options(
    spec,
    ['from', 'to', 'until', 'hand', 'fps', 'maxSpeedRatio', 'radius', 'anchor', 'offset', 'align', 'blend', 'release'],
    'contact hold',
  );
  const scene = actor?.handle?._scene;
  assert(scene && prop?._scene === scene, 'INVALID_CONTACT', 'The character and prop must belong to one scene.');
  assert(
    spec.release === undefined || spec.release === 'freeze' || spec.release === 'authored',
    'INVALID_HOLD',
    'Release freezes the prop or resumes authored motion.',
  );
  const from = number(spec.from, 'reach start', 0, 86400),
    to = number(spec.to, 'reach end', from, 86400),
    fps = number(spec.fps ?? 120, 'contact sampling rate', 12, 240),
    until = number(spec.until, 'contact hold end', to, 86400),
    anchor = safeCopy(spec.anchor ?? [0, 0]);
  assert(Array.isArray(anchor) && anchor.length === 2, 'INVALID_CONTACT', 'Prop anchor needs [x,y].');
  anchor.forEach((v) => number(v, 'prop anchor'));
  const position = (time) => {
    const m = scene.locate(prop, { time }).matrix;
    return [m[0] * anchor[0] + m[2] * anchor[1] + m[4], m[1] * anchor[0] + m[3] * anchor[1] + m[5]];
  };
  const target = position(from),
    checks = Math.ceil((to - from) * fps);
  assert(checks >= 4 && checks <= 4096, 'RESOURCE_LIMIT', 'Use a contact window of 4–4096 sample intervals.');
  for (let i = 1; i <= checks; i++) {
    const p = position(from + ((to - from) * i) / checks);
    assert(
      Math.hypot(p[0] - target[0], p[1] - target[1]) < 1e-7,
      'MOVING_CONTACT_TARGET',
      'Contact holds require a stationary prop during the reach.',
    );
  }
  const timing = contactTiming(actor, {
    from: spec.from,
    to: spec.to,
    hand: spec.hand,
    fps: spec.fps,
    maxSpeedRatio: spec.maxSpeedRatio,
    radius: spec.radius,
    target,
  });
  if (timing.at === null) return Object.freeze({ timing, hold: null });
  const hold = actor.hold(prop, {
    hand: spec.hand,
    from: timing.at,
    to: until,
    anchor,
    offset: spec.offset,
    align: spec.align,
    blend: spec.blend ?? 0,
    release: spec.release,
  });
  return Object.freeze({ timing, hold });
}
