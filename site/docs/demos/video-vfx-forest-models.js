import { hsla, toRGBA } from '../../runtime/src/color/index.js';
import { solveTwoBone3D } from '../../runtime/src/rigs/index.js';

const TAU = Math.PI * 2;
const up = [0, 1, 0];
const add = (a, b, weight = 1) => a.map((value, i) => value + weight * b[i]);
const sub = (a, b) => add(a, b, -1);
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => {
  const length = Math.hypot(...v);
  return length > 1e-8 ? v.map((a) => a / length) : [0, 1, 0];
};
const light = unit([0.65, 1.2, -0.55]);
const clamp = (value) => Math.max(0, Math.min(1, value));
const ease = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const vec = ([x, y, z]) => ({ x, y, z });
const list = ({ x, y, z }) => [x, y, z];

function paint(h, s, l, alpha = 1) {
  return Array.from({ length: 17 }, (_, i) =>
    toRGBA(hsla(h, s, Math.max(0, Math.min(100, l * (0.7 + i * 0.03))), alpha)).map((v) => Math.round(v * 255)),
  );
}

const palette = {
  moss: paint(89, 34, 39),
  edge: paint(80, 37, 30),
  bark: paint(32, 36, 27),
  pine: paint(149, 37, 32),
  sage: paint(108, 35, 41),
  mint: paint(151, 31, 45),
  stone: paint(191, 8, 45),
  fern: paint(87, 47, 43),
  petal: paint(36, 78, 68),
  shadow: paint(39, 17, 15, 0.24),
  cast: paint(39, 17, 15, 0.16),
  penumbra: [0.04, 0.08, 0.14, 0.21, 0.29].map((alpha) => paint(38, 20, 13, alpha)),
  rust: paint(21, 71, 47),
  gold: paint(32, 69, 54),
  cream: paint(44, 51, 85),
  ink: paint(19, 22, 15),
  blue: paint(190, 64, 70),
  amber: paint(35, 82, 66),
  rubber: paint(209, 13, 23),
  metal: paint(199, 16, 59),
  solar: paint(212, 40, 27),
  seam: paint(191, 38, 57),
  lamp: paint(169, 74, 72),
};

function mesh(transform) {
  const positions = [];
  const triangles = [];
  const colors = [];

  function patch(points, faces, material, flat = false) {
    const base = positions.length / 3;
    if (transform) points = points.map(transform);
    for (const p of points) positions.push(...p);
    for (const face of faces) {
      const [a, b, c] = face.map((i) => points[i]);
      const normal = unit(cross(sub(b, a), sub(c, a)));
      const shade = flat ? 9 : Math.round(16 * Math.max(0, dot(normal, light)));
      for (let i = 1; i < face.length - 1; i++) {
        triangles.push(base + face[0], base + face[i], base + face[i + 1]);
        colors.push(material[shade]);
      }
    }
  }

  function band(a, b, radii, material, count = 8, jagged = false) {
    const axis = unit(sub(b, a));
    const tangent = unit(cross(Math.abs(axis[1]) > 0.8 ? [0, 0, 1] : up, axis));
    const bitangent = cross(axis, tangent);
    const ring = (point, radius) =>
      Array.from({ length: count }, (_, i) => {
        const angle = (TAU * i) / count;
        const r = radius * (jagged && i % 2 ? 0.79 : 1);
        return add(add(point, tangent, r * Math.cos(angle)), bitangent, r * Math.sin(angle));
      });
    const faces = Array.from({ length: count }, (_, i) => [i, (i + 1) % count, count + ((i + 1) % count), count + i]);
    faces.push(
      [...Array(count).keys()].reverse(),
      [...Array(count).keys()].map((i) => i + count),
    );
    patch([...ring(a, radii[0]), ...ring(b, radii[1])], faces, material);
  }

  function oval(at, radii, material, yaw = 0, detail = 8) {
    const points = [];
    const faces = [];
    const bands = 5;
    for (let j = 0; j <= bands; j++) {
      const latitude = (Math.PI * j) / bands;
      for (let i = 0; i < detail; i++) {
        const lon = (TAU * i) / detail;
        const x = radii[0] * Math.sin(latitude) * Math.cos(lon);
        const z = radii[2] * Math.sin(latitude) * Math.sin(lon);
        points.push(
          add(at, [
            x * Math.cos(yaw) + z * Math.sin(yaw),
            radii[1] * Math.cos(latitude),
            -x * Math.sin(yaw) + z * Math.cos(yaw),
          ]),
        );
        if (j) {
          const index = j * detail + i;
          const next = j * detail + ((i + 1) % detail);
          faces.push([index - detail, next - detail, next, index]);
        }
      }
    }
    patch(points, faces, material);
  }

  function box(at, dimensions, material, transform = (p) => p) {
    const [a, b, c] = dimensions.map((n) => n / 2);
    const points = [
      [-a, -b, -c],
      [a, -b, -c],
      [a, -b, c],
      [-a, -b, c],
      [-a, b, -c],
      [a, b, -c],
      [a, b, c],
      [-a, b, c],
    ];
    patch(
      points.map((p) => transform(add(at, p))),
      [
        [0, 1, 2, 3],
        [7, 6, 5, 4],
        [4, 5, 1, 0],
        [5, 6, 2, 1],
        [6, 7, 3, 2],
        [7, 4, 0, 3],
      ],
      material,
    );
  }

  function disc(at, radii, material) {
    const perimeter = Array.from({ length: 22 }, (_, i) => {
      const angle = (-TAU * i) / 22;
      return add(at, [radii[0] * Math.cos(angle), 0, radii[1] * Math.sin(angle)]);
    });
    patch(perimeter, [perimeter.map((_, i) => i)], material, true);
  }

  function finish() {
    return { positions: new Float64Array(positions), triangles, colors };
  }
  return { patch, band, oval, box, disc, finish };
}

function tree(m, x, z, h, variant) {
  m.band([x, 0.016, z], [x + 0.016, h * 0.77, z], [0.023 * h + 0.009, 0.01], palette.bark, 7);
  const green = [palette.pine, palette.sage, palette.mint][variant];
  for (let i = 0; i < 4; i++) {
    const y = h * (0.25 + 0.164 * i);
    const r = h * (0.228 - 0.033 * i);
    m.band([x, y, z], [x + 0.015 + i * 0.003, y + h * 0.36, z - 0.011], [r, 0.003], green, 12, true);
  }
}

export function woodland() {
  const m = mesh();
  for (const [x, z, a, b] of [
    [-0.64, 0.16, 0.44, 0.42],
    [-0.84, 0.46, 0.38, 0.33],
    [-0.44, -0.18, 0.34, 0.27],
  ]) {
    m.disc([x, 0.008, z], [a, b], palette.edge);
    m.oval([x, 0.006, z], [a * 0.96, 0.04, b * 0.96], palette.moss, 0, 18);
  }
  for (const [x, z, h, variant] of [
    [-0.78, -0.14, 0.89, 0],
    [-0.44, -0.34, 0.76, 2],
    [-1.05, 0.18, 0.59, 1],
    [-0.25, -0.27, 0.54, 0],
    [-0.79, 0.36, 0.44, 2],
    [-1.11, 0.49, 0.43, 0],
  ]) {
    m.disc([x - 0.09, 0.012, z + 0.065], [h * 0.21, h * 0.14], palette.shadow);
    tree(m, x, z, h, variant);
  }
  for (const [x, z, size] of [
    [-0.39, 0.35, 0.07],
    [-0.66, 0.51, 0.052],
    [-1.02, -0.05, 0.084],
    [-0.38, -0.04, 0.045],
    [-0.57, 0.6, 0.042],
  ]) {
    m.oval([x, 0.034, z], [size, size * 0.65, size * 0.8], palette.stone, x);
  }
  for (let i = 0; i < 38; i++) {
    const angle = i * 2.39996;
    const radius = 0.17 + (i % 11) * 0.031;
    const x = -0.65 + Math.cos(angle) * radius;
    const z = 0.21 + Math.sin(angle) * radius * 0.94;
    const height = 0.038 + (i % 5) * 0.009;
    for (let blade = 0; blade < 3; blade++) {
      const direction = angle + (blade * TAU) / 3;
      m.patch(
        [
          [x - 0.012, 0.022, z],
          [x + 0.012, 0.022, z],
          [x + Math.cos(direction) * height * 0.64, height + 0.023, z + Math.sin(direction) * height * 0.64],
        ],
        [[0, 1, 2]],
        i % 4 === 0 ? palette.sage : palette.fern,
        true,
      );
    }
    if (i % 7 === 0) m.oval([x, height + 0.018, z], [0.017, 0.009, 0.017], palette.petal);
  }
  return m.finish();
}

function contactShadow(m, at, radii) {
  palette.penumbra.forEach((material, i) => {
    m.disc(
      add(at, [0, i * 0.0004, 0]),
      radii.map((r) => r * (1 - i * 0.118)),
      material,
    );
  });
}

function foxPath(distance) {
  const turnAt = 0.4;
  const radius = 0.25;
  const angle = Math.min(Math.PI / 2, Math.max(0, (distance - turnAt) / radius));
  return {
    x: 0.39 - Math.min(distance, turnAt) - radius * Math.sin(angle),
    z: -0.26 + radius * (1 - Math.cos(angle)) + Math.max(0, distance - turnAt - (radius * Math.PI) / 2),
    angle,
  };
}

function foxWorld([x, y, z], pose) {
  const c = Math.cos(pose.angle);
  const s = Math.sin(pose.angle);
  return [pose.x + x * c + z * s, y, pose.z - x * s + z * c];
}

function fox(t) {
  const distance = t * 0.37;
  const pose = foxPath(distance);
  const m = mesh((point) => foxWorld(point, pose));
  const stride = 0.235;
  const x = 0;
  const z = 0;
  const y = 0.248 + 0.008 * Math.sin(((distance * TAU) / stride) * 2);
  contactShadow(m, [0.046, 0.013, 0.032], [0.24, 0.12]);
  m.oval([x, y, z], [0.195, 0.087, 0.074], palette.rust, 0, 12);
  m.oval([x - 0.124, y + 0.008, z], [0.102, 0.09, 0.075], palette.gold);
  m.oval([x - 0.172, y - 0.006, z + 0.026], [0.071, 0.078, 0.051], palette.cream);
  const look = Math.sin(t * 2.1);
  const head = [x - 0.231, y + 0.097 + 0.012 * look, z + 0.014 * look];
  m.oval(head, [0.083, 0.065, 0.058], palette.rust, 0, 10);
  m.band(add(head, [-0.019, -0.016, 0]), add(head, [-0.108, -0.043, 0]), [0.048, 0.017], palette.cream, 7);
  m.oval(add(head, [-0.113, -0.044, 0]), [0.022, 0.017, 0.022], palette.ink);
  for (const side of [-1, 1]) {
    const ear = add(head, [0.025, 0.041, side * 0.04]);
    m.band(ear, add(ear, [0.004, 0.084, side * 0.021]), [0.034, 0.003], palette.rust, 4);
    m.oval(add(head, [-0.029, 0.009, side * 0.053]), [0.014, 0.01, 0.006], palette.ink);
  }
  const tail = [x + 0.17, y + 0.006, z];
  const bend = add(tail, [0.146, 0.022, 0.046 * Math.sin(t * 7.1)]);
  const tip = add(bend, [0.141, -0.045, 0.057 * Math.sin(t * 7.1 - 0.5)]);
  m.band(tail, bend, [0.029, 0.056], palette.rust);
  m.band(bend, tip, [0.056, 0.032], palette.rust);
  m.band(tip, add(tip, [0.076, 0.007, 0.018]), [0.032, 0.004], palette.cream);

  const phase = distance / stride;
  for (const [front, side, offset] of [
    [true, 1, 0.12],
    [true, -1, 0.62],
    [false, 1, 0.64],
    [false, -1, 0.14],
  ]) {
    const hip = front ? -0.125 : 0.128;
    const cycle = phase + offset;
    const fractional = cycle - Math.floor(cycle);
    const swing = clamp((fractional - 0.61) / 0.39);
    const step = stride * (Math.floor(cycle) - offset + 0.32);
    const start = foxWorld([hip, 0, side * 0.058], foxPath(step));
    const end = foxWorld([hip, 0, side * 0.058], foxPath(step + stride));
    const [dx, , dz] = sub(add(start, sub(end, start), ease(swing)), [pose.x, 0, pose.z]);
    const c = Math.cos(pose.angle);
    const s = Math.sin(pose.angle);
    const root = [x + hip, y - 0.025, z + side * 0.049];
    const target = [dx * c - dz * s, 0.022 + 0.065 * Math.sin(Math.PI * swing), dx * s + dz * c];
    const solved = solveTwoBone3D({
      root: vec(root),
      target: vec(target),
      lengths: [0.126, 0.124],
      pole: { x: front ? 1 : -1, y: 0, z: 0 },
    });
    const knee = list(solved.joint),
      paw = list(solved.tip);
    m.band(root, knee, [0.035, 0.023], palette.rust, 7);
    m.band(knee, paw, [0.022, 0.015], palette.ink, 7);
    m.oval(add(paw, [-0.014, 0, 0]), [0.034, 0.017, 0.022], palette.ink);
  }
  return m.finish();
}

function butterfly(m, t, phase, wing, size) {
  const theta = t * 2.04 + phase;
  const at = [-0.34 + 0.34 * Math.cos(theta), 0.49 + 0.17 * Math.sin(theta * 1.57), 0.24 + 0.25 * Math.sin(theta)];
  m.band(add(at, [-0.027 * size, 0, 0]), add(at, [0.022 * size, 0, 0]), [0.005, 0.004], palette.ink, 5);
  const flap = 0.38 + 0.93 * Math.sin(t * TAU * 7.5 + phase * 3);
  for (const side of [-1, 1]) {
    const wingPoint = (x, spread) =>
      add(at, [size * x, spread * size * Math.sin(flap), side * spread * size * Math.cos(flap)]);
    const points = [
      wingPoint(-0.012, 0),
      wingPoint(-0.041, 0.046),
      wingPoint(-0.008, 0.071),
      wingPoint(0.028, 0.053),
      wingPoint(0.016, 0),
    ];
    m.patch(points, [[0, 1, 2, 3, 4]], wing, true);
    m.patch(
      [wingPoint(-0.015, 0.021), wingPoint(-0.017, 0.044), wingPoint(0.007, 0.049), wingPoint(0.011, 0.022)],
      [[0, 1, 2, 3]],
      palette.cream,
      true,
    );
  }
}

export function wildlife(t) {
  const m = mesh();
  butterfly(m, t, 0.4, palette.amber, 0.88);
  butterfly(m, t, 2.2, palette.blue, 0.71);
  return [fox(t), m.finish()];
}

const roverTravel = (time) => 0.33 * ease((time - 1.43) / 1.19);

export function roverLocation(time, table) {
  const travel = roverTravel(time);
  return { x: table.x + 0.84 - travel, z: table.z + table.depth * 0.56 + travel * 0.18 };
}

export function rover(t, table, placement, deployed = null) {
  const m = mesh();
  const travel = placement ? 0 : roverTravel(t);
  const heading = Math.atan(0.18);
  const spin = travel / (0.057 * Math.cos(heading));
  const { x, z } = placement ?? roverLocation(t, table);
  const position = [x, table.height + 0.008, z];
  const world = ([x, y, z]) =>
    add(position, [x * Math.cos(heading) + z * Math.sin(heading), y, -x * Math.sin(heading) + z * Math.cos(heading)]);
  contactShadow(m, add(position, [0.025, 0, 0.02]), [0.243, 0.183]);
  m.box([0, 0.104, 0], [0.326, 0.074, 0.228], palette.amber, world);
  m.box([0, 0.152, 0], [0.238, 0.026, 0.174], palette.metal, world);
  m.box([-0.154, 0.106, 0], [0.046, 0.027, 0.13], palette.rubber, world);
  m.oval(world([-0.174, 0.109, 0.043]), [0.012, 0.012, 0.013], palette.lamp);
  m.oval(world([-0.174, 0.109, -0.043]), [0.012, 0.012, 0.013], palette.lamp);
  for (const axle of [-0.104, 0.104])
    for (const side of [-1, 1]) {
      const center = [axle, 0.057, side * 0.13];
      m.band(world(add(center, [0, 0, -0.027])), world(add(center, [0, 0, 0.027])), [0.057, 0.057], palette.rubber, 14);
      m.band(
        world(add(center, [0, 0, side * 0.027])),
        world(add(center, [0, 0, side * 0.03])),
        [0.033, 0.03],
        palette.metal,
        10,
      );
      for (let spoke = 0; spoke < 5; spoke++) {
        const angle = spin + (spoke * TAU) / 5;
        m.oval(
          world(add(center, [0.024 * Math.cos(angle), 0.024 * Math.sin(angle), side * 0.032])),
          [0.006, 0.006, 0.003],
          palette.rubber,
          0,
          5,
        );
      }
    }
  const fold = 1.22 * (1 - (deployed === null ? ease((t - 0.21) / 1.22) : Number(deployed)));
  for (const side of [-1, 1]) {
    const hinge = ([x, y, z]) =>
      world([
        x,
        0.166 + y * Math.cos(fold) + z * Math.sin(fold),
        side * (0.079 + z * Math.cos(fold) - y * Math.sin(fold)),
      ]);
    m.box([0, 0, 0.094], [0.246, 0.012, 0.182], palette.solar, hinge);
    for (let i = 1; i < 5; i++) m.box([-0.123 + i * 0.041, 0.007, 0.094], [0.003, 0.003, 0.166], palette.seam, hinge);
    m.box([0, 0.007, 0.094], [0.233, 0.003, 0.003], palette.seam, hinge);
  }
  const mast = deployed === null ? ease((t - 0.52) / 0.86) : Number(deployed);
  const base = world([0.033, 0.155, 0]);
  const camera = world([0.033 + 0.076 * (1 - mast), 0.177 + 0.152 * mast, 0.017 * Math.sin(t * 4)]);
  m.band(base, camera, [0.012, 0.009], palette.metal, 7);
  m.oval(camera, [0.031, 0.026, 0.029], palette.amber);
  m.oval(add(camera, [-0.024, 0.004, 0.002]), [0.016, 0.014, 0.018], palette.lamp);
  const model = m.finish();
  const receiver = table.height + 0.003;
  const positions = model.positions.slice();
  for (let i = 0; i < positions.length; i += 3) {
    const reach = (positions[i + 1] - receiver) / light[1];
    positions[i] -= reach * light[0];
    positions[i + 1] = receiver;
    positions[i + 2] -= reach * light[2];
  }
  const cast = { positions, triangles: model.triangles, colors: model.colors.map(() => palette.cast[9]) };
  return [cast, model];
}

export function coffeeTable(table) {
  const m = mesh();
  m.box(
    [table.x + table.width / 2, table.height / 2, table.z + table.depth / 2],
    [table.width, table.height, table.depth],
    palette.shadow,
  );
  return m.finish();
}
