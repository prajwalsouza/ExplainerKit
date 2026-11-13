import { assert, number, options, safeCopy } from '../core/validate.js';
/** Shoulder in the current character-space pose. Shared by actions and keyed-pose interpolation. */
export function bipedShoulder(pose, side, layout) {
  const hip = layout.HIP,
    shoulder = layout.SHOULDER[side],
    r = pose['body.r'] ?? 0,
    c = Math.cos(r),
    s = Math.sin(r),
    x = (shoulder[0] - hip[0]) * (pose['body.sx'] ?? 1),
    y = (shoulder[1] - hip[1]) * (pose['body.sy'] ?? 1);
  return [hip[0] + (pose['body.x'] ?? 0) + c * x - s * y, hip[1] + (pose['body.y'] ?? 0) + s * x + c * y];
}

/** Capture only data; all layout points use character coordinates and lengths are positive. */
export function capturePoseLayout(value) {
  if (value === undefined) return undefined;
  const layout = safeCopy(value);
  const point = (p, name) => {
    assert(Array.isArray(p) && p.length === 2, 'INVALID_CHARACTER', `${name} requires two coordinates.`);
    p.forEach((v) => number(v, name));
  };
  point(layout.HIP, 'hip');
  for (const side of ['F', 'B']) {
    point(layout.SHOULDER?.[side], 'shoulder');
    point(layout.FOOT_REST?.[side], 'foot rest');
    if (layout.hipX?.[side] !== undefined) number(layout.hipX[side], 'hip offset');
  }
  number(layout.leg, 'leg reach', 0.001, 1e5);
  number(layout.ankle ?? 0, 'ankle offset', 0, 1e5);
  if (layout.limbs) {
    options(layout.limbs, ['armF', 'armB', 'legF', 'legB'], 'limb layout');
    for (const limb of Object.values(layout.limbs)) {
      options(limb, ['effector', 'lengths', 'origin', 'bend', 'offsetY'], 'limb');
      assert(
        ['handF', 'handB', 'footF', 'footB'].includes(limb.effector),
        'INVALID_CHARACTER',
        'Known limb effector required.',
      );
      point(limb.origin, 'limb origin');
      assert(
        Array.isArray(limb.lengths) && limb.lengths.length === 2,
        'INVALID_CHARACTER',
        'Two limb lengths required.',
      );
      limb.lengths.forEach((v) => number(v, 'limb length', 1e-6, 1e5));
      assert(limb.bend === 1 || limb.bend === -1, 'INVALID_CHARACTER', 'Limb bend must be ±1.');
      number(limb.offsetY ?? 0, 'limb offset', -1e5, 1e5);
    }
  }
  return layout;
}
