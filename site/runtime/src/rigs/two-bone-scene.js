import { Parameter } from '../core/data.js';
import { assert, options, number } from '../core/validate.js';
import { solveTwoBone } from './two-bone.js';

/** A reusable articulated drawing. Controllers and precise parts share one rig. */
export function twoBoneRig(scene, spec = {}) {
  options(spec, ['lengths', 'root', 'target', 'bend', 'stroke', 'strokeWidth']);
  const lengths = spec.lengths ?? [120, 80],
    root = spec.root ?? { x: 0, y: 0 },
    target = spec.target ?? { x: 120, y: 80 };
  // Solve once before creating scene objects: invalid geometry has no partial effect.
  const initialX = target.x instanceof Parameter ? target.x.value : target.x;
  const initialY = target.y instanceof Parameter ? target.y.value : target.y;
  solveTwoBone({ root: { x: 0, y: 0 }, lengths, target: { x: initialX, y: initialY }, bend: spec.bend ?? 1 });
  options(root, ['x', 'y']);
  number(root.x, 'root x');
  number(root.y, 'root y');
  const reach = lengths[0] + lengths[1];
  const component = scene.component({
    type: 'group',
    props: { x: root.x, y: root.y },
    children: {
      upper: { type: 'line', props: { stroke: spec.stroke ?? '#193d4b', strokeWidth: spec.strokeWidth ?? 8 } },
      lower: { type: 'line', props: { stroke: spec.stroke ?? '#193d4b', strokeWidth: spec.strokeWidth ?? 8 } },
      elbow: { type: 'circle', props: { r: 5, fill: '#ffffff' } },
      tip: { type: 'circle', props: { r: 5, fill: '#ffffff' } },
    },
  });
  scene._capacity(5);
  number(reach * 2, 'rig control range', 1e-6, 1e7);
  if (!(target.x instanceof Parameter)) number(target.x, 'target x', -reach * 2, reach * 2);
  if (!(target.y instanceof Parameter)) number(target.y, 'target y', -reach * 2, reach * 2);
  if (target.x instanceof Parameter)
    assert(scene._ownsParameter(target.x), 'INVALID_BINDING', 'Use this scene’s target parameter.');
  if (target.y instanceof Parameter)
    assert(scene._ownsParameter(target.y), 'INVALID_BINDING', 'Use this scene’s target parameter.');
  const x = target.x instanceof Parameter ? target.x : scene.parameter(target.x, { min: -reach * 2, max: reach * 2 });
  const y = target.y instanceof Parameter ? target.y : scene.parameter(target.y, { min: -reach * 2, max: reach * 2 });
  const bend = scene.parameter(spec.bend ?? 1, { min: -1, max: 1 });
  const group = scene.instance(component);
  const fixedLengths = Object.freeze([...lengths]);
  // One solve per sample, shared by every part.
  const pose = scene.derive([x, y, bend], (a, b, branch) =>
    solveTwoBone({
      root: { x: 0, y: 0 },
      target: { x: a, y: b },
      lengths: fixedLengths,
      bend: branch < 0 ? -1 : 1,
      unreachable: 'clamp',
    }),
  );
  const at = (point, keys) => ({ inputs: [pose], map: (r) => ({ [keys[0]]: r[point].x, [keys[1]]: r[point].y }) });
  group.part('upper').bind(['x2', 'y2'], at('elbow', ['x2', 'y2']));
  group
    .part('lower')
    .bind(['x1', 'y1'], at('elbow', ['x1', 'y1']))
    .bind(['x2', 'y2'], at('tip', ['x2', 'y2']));
  group.part('elbow').bind(['x', 'y'], at('elbow', ['x', 'y']));
  group.part('tip').bind(['x', 'y'], at('tip', ['x', 'y']));
  return Object.freeze({ group, target: Object.freeze({ x, y }), bend, pose, lengths: fixedLengths });
}
