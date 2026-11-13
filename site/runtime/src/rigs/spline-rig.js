import { assert, number, options } from '../core/validate.js';
import { properties } from '../core/geometry.js';
import { Parameter } from '../core/data.js';
import { measurePath } from '../geometry/path.js';

/** A sampled curve rig for stations/attachments, not an inextensible bone chain. */
export function splineRig(scene, spec = {}) {
  return scene._batch(() => buildSpline(scene, spec));
}
function buildSpline(scene, spec) {
  options(
    spec,
    ['commands', 'count', 'start', 'end', 'phase', 'offset', 'outside', 'tolerance', 'stroke', 'strokeWidth'],
    'spline rig',
  );
  const path = measurePath(spec.commands, { tolerance: spec.tolerance ?? 0.25 }),
    count = number(spec.count ?? 8, 'spline station count', 1, 128);
  assert(Number.isInteger(count), 'INVALID_RIG', 'Station count must be an integer.');
  const start = number(spec.start ?? 0, 'spline start', 0, 1),
    end = number(spec.end ?? 1, 'spline end', 0, 1);
  assert(end >= start, 'INVALID_RIG', 'Spline end must follow start.');
  const outside = spec.outside ?? (path.closed ? 'wrap' : 'clamp');
  assert(['wrap', 'clamp', 'error'].includes(outside), 'INVALID_RIG', 'outside must be wrap, clamp or error.');
  assert(outside !== 'wrap' || path.closed, 'INVALID_RIG', 'Wrapping stations requires a closed contour.');
  const style = properties('line', { stroke: spec.stroke ?? '#193d4b', strokeWidth: spec.strokeWidth ?? 2 });
  function input(value, fallback, label, min, max) {
    const v = value ?? fallback;
    if (v instanceof Parameter) {
      assert(scene._ownsParameter(v), 'INVALID_BINDING', `Use this scene's ${label} parameter.`);
      return v;
    }
    return number(v, label, min, max);
  }
  const phaseValue = input(spec.phase, 0, 'spline phase', -1e3, 1e3),
    offsetValue = input(spec.offset, 0, 'normal offset', -1e5, 1e5);
  function positions(phase, offset) {
    number(phase, 'spline phase', -1e3, 1e3);
    number(offset, 'normal offset', -1e5, 1e5);
    return Object.freeze(
      Array.from({ length: count }, (_, i) => {
        const fullClosed = path.closed && end - start === 1;
        let fraction = start + (end - start) * (count === 1 ? 0 : i / (fullClosed ? count : count - 1)) + phase;
        if (outside === 'wrap') fraction = ((fraction % 1) + 1) % 1;
        else if (outside === 'clamp') fraction = Math.max(0, Math.min(1, fraction));
        else number(fraction, 'station fraction', 0, 1);
        const p = path.at(fraction);
        return Object.freeze({
          index: i,
          fraction,
          x: p.x - Math.sin(p.rotation) * offset,
          y: p.y + Math.cos(p.rotation) * offset,
          rotation: p.rotation,
        });
      }),
    );
  }
  positions(
    phaseValue instanceof Parameter ? phaseValue.sample(0) : phaseValue,
    offsetValue instanceof Parameter ? offsetValue.sample(0) : offsetValue,
  );
  const children = Object.fromEntries(
    Array.from({ length: count }, (_, i) => [
      `station${i}`,
      {
        type: 'group',
        children: {
          center: { type: 'circle', props: { r: 3, fill: style.stroke } },
          direction: { type: 'line', props: { x2: 12, stroke: style.stroke, strokeWidth: style.strokeWidth } },
        },
      },
    ]),
  );
  const component = scene.component({ type: 'group', children });
  scene._capacity(1 + count * 3);
  const phase = phaseValue instanceof Parameter ? phaseValue : scene.parameter(phaseValue, { min: -1e3, max: 1e3 }),
    offset = offsetValue instanceof Parameter ? offsetValue : scene.parameter(offsetValue, { min: -1e5, max: 1e5 });
  const pose = scene.derive([phase, offset], positions),
    group = scene.instance(component);
  let tag = `spline-${group.id}`,
    suffix = 0;
  while (scene.tagPath(tag).length) tag = `spline-${group.id}-${++suffix}`;
  group.tag(tag);
  const policy = scene.adaptivePolicy;
  scene.adaptive({ ...policy, together: [...policy.together, tag] });
  for (let i = 0; i < count; i++)
    group.part(`station${i}`).bind(['x', 'y', 'rotation'], { inputs: [pose], map: (p) => p[i] });
  function station(index) {
    number(index, 'station index', 0, count - 1);
    assert(Number.isInteger(index), 'INVALID_RIG', 'Station index must be an integer.');
    return scene.derive([pose], (p) => p[index]);
  }
  function attach(handle, index, localSpec1 = {}) {
    assert(
      scene._isRootHandle(handle) && handle.id !== group.id,
      'INVALID_ATTACHMENT',
      'Attach a top-level drawable from the same scene, excluding this rig.',
    );
    number(index, 'station index', 0, count - 1);
    assert(Number.isInteger(index), 'INVALID_RIG', 'Station index must be an integer.');
    options(localSpec1, ['offset', 'rotation'], 'spline attachment');
    const normal = number(localSpec1.offset ?? 0, 'attachment offset', -1e5, 1e5),
      rotation = number(localSpec1.rotation ?? 0, 'attachment rotation', -1e4, 1e4);
    handle.bind(['x', 'y', 'rotation'], {
      inputs: [pose],
      map: (p) => {
        const q = p[index];
        return {
          x: q.x - Math.sin(q.rotation) * normal,
          y: q.y + Math.cos(q.rotation) * normal,
          rotation: q.rotation + rotation,
        };
      },
    });
    handle.tag(tag);
    return handle;
  }
  return Object.freeze({
    path,
    group,
    tag,
    phase,
    offset,
    pose,
    count,
    station,
    attach,
    diagnostics: Object.freeze({ method: 'sampledArcLength', outside, rigidLengths: false }),
  });
}
