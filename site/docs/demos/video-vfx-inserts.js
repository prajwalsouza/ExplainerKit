import { hsla, toHex } from '../../runtime/src/color/index.js';

const color = (h, s, l, a = 1) => toHex(hsla(h, s, l, a));

function insertMesh(anchor, yaw) {
  const vertices = [];
  const faces = [];
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const localToWorld = ([x, y, z]) => [anchor.x + c * x + s * z, anchor.y + y, anchor.z - s * x + c * z];
  const append = (points) => points.map((point) => vertices.push(localToWorld(point)) - 1);

  function shell(lower, upper, tint) {
    const bottom = append(lower);
    const top = append(upper);
    for (let i = 0; i < bottom.length; i++) {
      const next = (i + 1) % bottom.length;
      faces.push({ indices: [bottom[i], top[i], top[next], bottom[next]], fill: tint(i, bottom.length) });
    }
    faces.push({ indices: top.reverse(), fill: tint(-1, bottom.length) });
  }

  function box(x, y, z, width, height, depth, tint) {
    const halfX = width / 2;
    const halfZ = depth / 2;
    const ring = (at) => [
      [x + halfX, at, z - halfZ],
      [x + halfX, at, z + halfZ],
      [x - halfX, at, z + halfZ],
      [x - halfX, at, z - halfZ],
    ];
    shell(ring(y), ring(y + height), tint);
  }

  function finish(width, depth) {
    const shadow = (x, z, shiftX, shiftZ) =>
      new Float64Array(
        [
          [-x, 0, -z],
          [x, 0, -z],
          [x, 0, z],
          [-x, 0, z],
        ]
          .map(([px, y, pz]) => localToWorld([px + shiftX, y, pz + shiftZ]))
          .flat(),
      );
    return {
      positions: new Float64Array(vertices.flat()),
      faces,
      shadow: {
        contact: shadow(width / 2, depth / 2, 0, 0),
        cast: shadow(width * 0.7, depth * 0.6, 0.035, -0.055),
      },
      castTint: color(26, 13, 12, 0.29),
      contactTint: color(26, 12, 8, 0.55),
      castVisible: true,
    };
  }

  return { shell, box, finish };
}

export function prepareCone(anchor) {
  const { shell, box, finish } = insertMesh(anchor, Math.PI / 9);
  box(0, 0, 0, 0.33, 0.034, 0.33, (i) => color(220, 8, i < 0 ? 23 : 13));
  const bands = [
    [0.034, 0.135, false],
    [0.166, 0.099, true],
    [0.244, 0.077, false],
    [0.321, 0.056, true],
    [0.392, 0.036, false],
    [0.495, 0.008, false],
  ];
  const ring = ([y, radius]) =>
    Array.from({ length: 40 }, (_, i) => {
      const angle = (2 * Math.PI * i) / 40;
      return [radius * Math.cos(angle), y, radius * Math.sin(angle)];
    });
  for (let i = 0; i < bands.length - 1; i++) {
    const white = bands[i][2];
    shell(ring(bands[i]), ring(bands[i + 1]), (side, count) => {
      const lit = side < 0 ? 1 : (1 + Math.cos((side * 2 * Math.PI) / count + 1.9)) / 2;
      return white ? color(43, 14, 61 + lit * 22) : color(23, 87, 39 + lit * 20);
    });
  }
  return {
    ...finish(0.32, 0.32),
    castTint: color(34, 8, 15, 0.12),
    contactTint: color(34, 8, 12, 0.3),
    shadowDepthBias: 0.1,
  };
}

export function prepareDisplay(anchor) {
  const { box, finish } = insertMesh(anchor, -Math.PI / 14);
  const metal = (i) => color(206, 15, i < 0 ? 51 : [23, 33, 40, 28][i]);
  box(0, 0, 0, 0.21, 0.018, 0.15, metal);
  box(0, 0.018, -0.014, 0.055, 0.075, 0.049, metal);
  box(0, 0.068, 0, 0.275, 0.176, 0.064, metal);
  box(0, 0.082, 0.034, 0.248, 0.147, 0.005, () => color(199, 41, 12));
  box(0, 0.093, 0.038, 0.212, 0.092, 0.002, () => color(187, 37, 20));
  box(-0.062, 0.202, 0.039, 0.082, 0.009, 0.003, () => color(179, 35, 66));
  box(0.092, 0.199, 0.039, 0.011, 0.011, 0.003, () => color(151, 74, 61));
  for (const [i, height] of [0.03, 0.053, 0.041, 0.071, 0.059].entries()) {
    box(-0.078 + 0.039 * i, 0.103, 0.041, 0.024, height, 0.002, () => color(171, 66, 43 + i * 4));
  }
  return finish(0.21, 0.15);
}
