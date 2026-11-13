import { skeleton } from './skeleton.js';
import { Parameter } from '../core/data.js';
import { assert, number, options } from '../core/validate.js';
import { properties } from '../core/geometry.js';
import { prepareGoalDriver } from './goal-driver.js';

/** Scene bridge: authored FK angles, optional IK target, a blend and named sockets. */
export function skeletonRig(scene, spec = {}) {
  return scene._batch(() => buildRig(scene, spec));
}
function buildRig(scene, spec) {
  options(spec, ['bones', 'root', 'stroke', 'strokeWidth', 'ik', 'goals', 'solver'], 'skeleton rig');
  const model = skeleton({ bones: spec.bones, root: spec.root }),
    rest = model.pose();
  const style = properties('line', { stroke: spec.stroke ?? '#193d4b', strokeWidth: spec.strokeWidth ?? 8 });
  const ik = spec.ik;
  assert(!(ik && spec.goals), 'INVALID_GOAL', 'Choose ik or simultaneous goals for one rig.');
  assert(
    spec.solver === undefined || spec.goals !== undefined,
    'INVALID_GOAL',
    'solver options belong to simultaneous goals.',
  );
  const goalDriver = spec.goals === undefined ? null : prepareGoalDriver(scene, model, spec.goals, spec.solver);
  if (ik) {
    options(ik, ['end', 'target', 'chainRoot', 'iterations', 'tolerance', 'restarts'], 'rig IK');
    options(ik.target, ['x', 'y'], 'rig target');
    for (const v of [ik.target.x, ik.target.y])
      if (v instanceof Parameter)
        assert(scene._ownsParameter(v), 'INVALID_BINDING', 'Use this scene’s target parameter.');
    model.solve({
      ...ik,
      target: {
        x: ik.target.x instanceof Parameter ? ik.target.x.sample(0) : ik.target.x,
        y: ik.target.y instanceof Parameter ? ik.target.y.sample(0) : ik.target.y,
      },
    });
  }
  const children = Object.fromEntries(
    model.bones.map((b) => [
      b.id,
      {
        type: 'group',
        children: {
          bone: { type: 'line', props: { x2: b.length, stroke: style.stroke, strokeWidth: style.strokeWidth } },
          joint: { type: 'circle', props: { r: Math.max(2, style.strokeWidth * 0.7), fill: style.stroke } },
        },
      },
    ]),
  );
  const component = scene.component({ type: 'group', children });
  scene._capacity(1 + model.bones.length * 3);
  const angles = Object.freeze(
    Object.fromEntries(
      model.bones.map((b) => [b.id, scene.parameter(b.angle, { min: b.limits[0], max: b.limits[1] })]),
    ),
  );
  const root = Object.freeze(
    Object.fromEntries(
      ['x', 'y', 'rotation'].map((k) => [
        k,
        scene.parameter(rest.root[k], { min: k === 'rotation' ? -1e4 : -1e6, max: k === 'rotation' ? 1e4 : 1e6 }),
      ]),
    ),
  );
  const ids = model.bones.map((b) => b.id),
    fk = scene.derive([...Object.values(angles), root.x, root.y, root.rotation], (...values) =>
      model.pose({
        angles: Object.fromEntries(ids.map((id, i) => [id, values[i]])),
        root: { x: values[ids.length], y: values[ids.length + 1], rotation: values[ids.length + 2] },
      }),
    );
  let target = null,
    mix = null,
    solution = null,
    pose = fk,
    goals = null;
  if (ik) {
    const param = (v) =>
      v instanceof Parameter ? v : scene.parameter(number(v, 'target', -2e6, 2e6), { min: -2e6, max: 2e6 });
    target = Object.freeze({ x: param(ik.target.x), y: param(ik.target.y) });
    mix = scene.parameter(1, { min: 0, max: 1 });
    const settings = Object.fromEntries(
      ['end', 'chainRoot', 'iterations', 'tolerance', 'restarts']
        .filter((k) => ik[k] !== undefined)
        .map((k) => [k, ik[k]]),
    );
    solution = scene.derive([fk, target.x, target.y], (from, x, y) =>
      model.solve({ ...settings, from, target: { x, y } }),
    );
    pose = scene.derive([fk, solution, mix], (a, b, w) => model.blend(a, b.pose, w));
  } else if (goalDriver) {
    const driver = goalDriver.create(fk);
    goals = driver.goals;
    solution = driver.solution;
    mix = scene.parameter(1, { min: 0, max: 1 });
    pose = scene.derive([fk, solution, mix], (a, b, w) => model.blend(a, b.pose, w));
  }
  const group = scene.instance(component);
  // Articulation is a semantic connection, stronger than a perceptual guess.
  let tag = `rig-${group.id}`,
    suffix = 0;
  while (scene.tagPath(tag).length) tag = `rig-${group.id}-${++suffix}`;
  group.tag(tag);
  const policy = scene.adaptivePolicy;
  scene.adaptive({ ...policy, together: [...policy.together, tag] });
  for (const b of model.bones) {
    group.part(b.id).bind(['x', 'y', 'rotation'], {
      inputs: [pose],
      map: (p) => {
        const joint = p.bones.find((j) => j.id === b.id);
        return { x: joint.start.x, y: joint.start.y, rotation: joint.rotation };
      },
    });
    group.part(b.id + '.bone').bind('x2', { inputs: [pose], map: (p) => p.bones.find((j) => j.id === b.id).length });
  }
  function socket(id, localSpec1 = {}) {
    model.socket(rest, id, localSpec1);
    const fixed = { ...localSpec1 };
    return scene.derive([pose], (p) => model.socket(p, id, fixed));
  }
  function attach(handle, id, localSpec2 = {}) {
    assert(scene._isRootHandle(handle), 'INVALID_ATTACHMENT', 'Attach a top-level drawable from the same scene.');
    assert(handle.id !== group.id, 'INVALID_ATTACHMENT', 'A rig cannot attach its own group.');
    model.socket(rest, id, localSpec2);
    const fixed = { ...localSpec2 };
    handle.bind(['x', 'y', 'rotation'], { inputs: [pose], map: (p) => model.socket(p, id, fixed) });
    handle.tag(tag);
    return handle;
  }
  return Object.freeze({ model, group, tag, angles, root, fk, pose, target, mix, solution, goals, socket, attach });
}
