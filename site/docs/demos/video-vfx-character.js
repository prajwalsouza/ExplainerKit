import { bipedMotion } from '../../runtime/src/characters/index.js';
import { hsla, toHex } from '../../runtime/src/color/index.js';
import { solveTwoBone3D } from '../../runtime/src/rigs/index.js';
import { projectPoints } from '../../runtime/src/spatial/index.js';
import worldDemo, { drawGroundBin, prepareGroundBin } from './video-vfx-world.js';

const up = { x: 0, y: 1, z: 0 };
const alongPavement = { x: 1, y: 0, z: 0 };
const authoredLight = unit({ x: 0.7, y: 1, z: -0.9 });
const lightAlloy = [41, 7, 57];
const darkAlloy = [32, 11, 34];
const dark = [207, 4, 16];
const glass = [205, 8, 12];
const mint = [164, 38, 52];
const castTint = toHex(hsla(34, 4, 7, 0.39));
const contactTint = toHex(hsla(34, 4, 5, 0.6));
const strikeTime = 2.64;
const footHeight = 0.046;
const footToe = 0.105;
const legLength = 0.29;
const hipWidth = 0.158;

function unit({ x, y, z }) {
  const length = Math.hypot(x, y, z);
  return { x: x / length, y: y / length, z: z / length };
}

const add = (a, b, weight = 1) => ({ x: a.x + b.x * weight, y: a.y + b.y * weight, z: a.z + b.z * weight });
const sub = (a, b) => add(a, b, -1);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const blend = (a, b, t) => a + (b - a) * t;
const clamp = (u) => Math.max(0, Math.min(1, u));
const smooth = (u) => clamp(u) ** 2 * (3 - 2 * clamp(u));
const eased = (t, start, end) => smooth((t - start) / (end - start));
const forward = (yaw) => ({ x: Math.sin(yaw), y: 0, z: Math.cos(yaw) });

function strikeTarget(time) {
  const poses = [
    [2.04, 0, footHeight],
    [2.32, -0.078, 0.158],
    [strikeTime, 0.295, 0.105],
    [2.76, 0.337, 0.127],
    [3.18, 0, footHeight],
  ];
  const index = poses.findIndex(([at]) => at > time);
  if (index < 1) return [0, footHeight];
  const [start, x1, y1] = poses[index - 1];
  const [end, x2, y2] = poses[index];
  const u = eased(time, start, end);
  return [blend(x1, x2, u), blend(y1, y2, u)];
}

export function sidewalkPerformance(anchor) {
  const stationX = anchor.x - 0.582;
  const stationZ = anchor.z + hipWidth / 2;
  const motion = bipedMotion({
    path: (time) => ({
      x: blend(anchor.x - 1.43, stationX, eased(time, -0.24, 1.62)),
      z: stationZ,
      heading: Math.PI / 2,
    }),
    stride: 0.81,
    legLength,
    armLength: 0.164,
    hipWidth,
    hipHeight: 0.51,
    stepHeight: 0.063,
    footHeight,
    spineLength: 0.31,
    shoulderWidth: 0.28,
    armSwing: 0.32,
  });
  return (time) => {
    const recoil = eased(time, 2.6, 2.79) * (1 - eased(time, 2.92, 3.37));
    const shift = eased(time, 1.92, 2.27) * (1 - eased(time, 2.82, 3.19));
    const response = eased(time, strikeTime, 2.84) * (1 - eased(time, 3.52, 4.14));
    const attention = eased(time, 2.7, 3.62);
    const intent = {
      crouch: shift * 0.061,
      posture: { lean: 0.13 * shift - 0.22 * recoil, twist: -0.18 * recoil },
      lookAt: { x: anchor.x + 0.5, y: 0.95, z: anchor.z + 0.4 + attention * 0.94 },
    };
    if (time >= 1.92) intent.weightShift = -0.73 * shift;
    const pose = motion.sample(time, intent);
    if (time >= 2.04 && time <= 3.18) {
      const [x, y] = strikeTarget(time);
      pose.legs[1] = solveTwoBone3D({
        root: pose.legs[1].root,
        target: { x: stationX + x, y, z: anchor.z },
        lengths: [legLength, legLength],
        pole: alongPavement,
      });
    }
    const slide = 0.34 * (1 - (1 - clamp((time - strikeTime) / 0.7)) ** 2);
    const toe = add(pose.legs[1].tip, alongPavement, footToe);
    return { pose, response, slide, toe };
  };
}

function solid(list, base, top, facing, sizes, color) {
  const axis = unit(sub(top, base));
  const across = unit(cross(axis, facing));
  const front = cross(across, axis);
  const ring = (center, width, depth) => {
    const b = Math.min(width, depth) * 0.3;
    return [
      [-width + b, -depth],
      [width - b, -depth],
      [width, -depth + b],
      [width, depth - b],
      [width - b, depth],
      [-width + b, depth],
      [-width, depth - b],
      [-width, -depth + b],
    ].map(([x, z]) => add(add(center, across, x), front, z));
  };
  const points = [...ring(base, sizes[0], sizes[1]), ...ring(top, sizes[2] ?? sizes[0], sizes[3] ?? sizes[1])];
  const faces = Array.from({ length: 8 }, (_, index) => {
    const next = (index + 1) % 8;
    return [index, index + 8, next + 8, next];
  });
  faces.push([0, 1, 2, 3, 4, 5, 6, 7], [15, 14, 13, 12, 11, 10, 9, 8]);
  list.push({ points, faces, color });
}

function between(a, b, t) {
  return add(a, sub(b, a), t);
}

function drawParts(pose, response, ground) {
  const parts = [];
  const world = (point) => ({ ...point, y: point.y + ground });
  const bodyFront = forward(pose.chestHeading);
  const vertical = (center, halfHeight, front, size, color) => {
    solid(parts, add(center, up, -halfHeight), add(center, up, halfHeight), front, size, color);
  };
  const segment = (from, to, width, depth, color) => {
    // Limb motion is mainly sagittal, so world Z provides a stable cross section for the plating.
    solid(
      parts,
      between(from, to, 0.08),
      between(from, to, 0.93),
      { x: 0, y: 0, z: 1 },
      [width, depth, width * 0.8, depth * 0.83],
      color,
    );
  };
  const feet = [];
  for (let i = 0; i < 2; i++) {
    const { root, joint, tip } = pose.legs[i];
    const hip = world(root),
      knee = world(joint),
      ankle = world(tip);
    segment(hip, knee, 0.043, 0.048, darkAlloy);
    vertical(knee, 0.026, bodyFront, [0.035, 0.037], dark);
    segment(knee, ankle, 0.04, 0.047, lightAlloy);
    const foot = add(ankle, alongPavement, 0.043);
    const sole = add(foot, up, -footHeight);
    solid(parts, sole, add(sole, up, 0.017), alongPavement, [0.056, 0.062], dark);
    solid(parts, add(sole, up, 0.017), add(sole, up, 0.061), alongPavement, [0.055, 0.061, 0.05, 0.052], lightAlloy);
    feet.push(sole);
  }
  const pelvis = world(pose.pelvis),
    chest = world(pose.chest);
  vertical(pelvis, 0.034, bodyFront, [0.093, 0.061], dark);
  solid(parts, add(pelvis, up, 0.038), add(chest, up, 0.016), bodyFront, [0.087, 0.069, 0.118, 0.082], lightAlloy);
  const panel = add(between(pelvis, chest, 0.69), bodyFront, 0.082);
  vertical(panel, 0.058, bodyFront, [0.064, 0.011], darkAlloy);
  vertical(add(panel, bodyFront, 0.015), 0.009, bodyFront, [0.037, 0.006], dark);
  for (const arm of pose.arms) {
    const shoulder = world(arm.root),
      elbow = world(arm.joint),
      hand = world(arm.tip);
    vertical(shoulder, 0.034, bodyFront, [0.04, 0.046], darkAlloy);
    segment(shoulder, elbow, 0.029, 0.03, lightAlloy);
    vertical(elbow, 0.021, bodyFront, [0.024, 0.022], dark);
    segment(elbow, hand, 0.032, 0.037, darkAlloy);
    vertical(hand, 0.032, bodyFront, [0.031, 0.028], dark);
  }
  const head = world(pose.head);
  const headFront = forward(pose.headYaw);
  vertical(add(chest, up, 0.049), 0.036, headFront, [0.034, 0.036], dark);
  vertical(add(head, up, 0.028), 0.079, headFront, [0.118, 0.092], lightAlloy);
  const visor = add(add(head, up, 0.032), headFront, 0.093);
  vertical(visor, 0.052, headFront, [0.103, 0.01], glass);
  const headRight = cross(up, headFront);
  for (const side of [-1, 1]) {
    const eye = add(add(visor, headRight, side * 0.047), headFront, 0.012);
    vertical(eye, blend(0.008, 0.024, response), headFront, [blend(0.024, 0.017, response), 0.002], mint);
  }
  return { parts, feet };
}

function project(camera, intrinsics, points) {
  const coordinates = new Float64Array(points.flatMap((p) => [p.x, p.y, p.z]));
  const { positions, cameraDepths } = projectPoints(camera, coordinates);
  return Array.from(cameraDepths, (depth, index) => ({
    x: positions[index * 2] + intrinsics.cx - camera.viewport.width / 2,
    y: positions[index * 2 + 1] + intrinsics.cy - camera.viewport.height / 2,
    depth,
  }));
}

function addPath(context, points) {
  context.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) context.lineTo(point.x, point.y);
  context.closePath();
}

function turn(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function hull(points) {
  const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const edge = (path) => {
    const result = [];
    for (const point of path) {
      while (result.length > 1 && turn(result.at(-2), result.at(-1), point) <= 0) result.pop();
      result.push(point);
    }
    return result.slice(0, -1);
  };
  return [...edge(sorted), ...edge(sorted.reverse())];
}

function drawShadow(context, camera, intrinsics, { parts, feet }, ground, light) {
  const cast = (p) => ({
    x: p.x - ((p.y - ground) * light.x) / light.y,
    y: ground,
    z: p.z - ((p.y - ground) * light.z) / light.y,
  });
  context.save();
  context.filter = 'blur(1.4px)';
  context.fillStyle = castTint;
  context.beginPath();
  for (const part of parts) {
    const outline = hull(project(camera, intrinsics, part.points.map(cast)));
    if (outline.length >= 3) addPath(context, outline);
  }
  context.fill();
  context.filter = 'blur(1px)';
  for (const foot of feet) {
    const opacity = 1 - clamp((foot.y - ground) / 0.13);
    if (opacity === 0) continue;
    const ring = Array.from({ length: 16 }, (_, i) => {
      const angle = (i * Math.PI) / 8;
      return { x: foot.x + 0.071 * Math.cos(angle), y: ground, z: foot.z + 0.056 * Math.sin(angle) };
    });
    context.globalAlpha = opacity;
    context.fillStyle = contactTint;
    context.beginPath();
    addPath(context, project(camera, intrinsics, ring));
    context.fill();
  }
  context.restore();
}

function drawActor(context, camera, intrinsics, parts, light) {
  const visible = [];
  for (const { points, faces, color } of parts) {
    const projected = project(camera, intrinsics, points);
    for (const indices of faces) {
      const polygon = indices.map((index) => projected[index]);
      if (turn(polygon[0], polygon[1], polygon[2]) >= 0) continue;
      const [a, b, c] = indices.map((index) => points[index]);
      const normal = unit(cross(sub(b, a), sub(c, a)));
      const [hue, saturation, lightness] = color;
      const direct = color === mint ? 0 : 22 * Math.max(0, dot(normal, light));
      visible.push({
        polygon,
        depth: polygon.reduce((sum, point) => sum + point.depth, 0) / polygon.length,
        fill: toHex(hsla(hue, saturation, lightness + direct)),
        visorOverlay: color === mint,
      });
    }
  }
  visible.sort((a, b) => Number(a.visorOverlay) - Number(b.visorOverlay) || b.depth - a.depth);
  context.lineWidth = 0.4;
  for (const { polygon, fill } of visible) {
    context.beginPath();
    addPath(context, polygon);
    context.fillStyle = context.strokeStyle = fill;
    context.fill();
    context.stroke();
  }
}

function translateBin(bin, x) {
  if (x === 0) return bin;
  const translated = (points) => points.map((coordinate, index) => (index % 3 === 0 ? coordinate + x : coordinate));
  return {
    ...bin,
    positions: translated(bin.positions),
    shadow: { contact: translated(bin.shadow.contact), cast: translated(bin.shadow.cast) },
  };
}

function createInsert({ anchor, lightDirection }) {
  const performance = sidewalkPerformance(anchor);
  const matchedBin = prepareGroundBin(anchor, 1, { lightDirection });
  const defaultBin = prepareGroundBin(anchor, 1, { lightDirection: authoredLight });
  return (context, camera, intrinsics, { time, matchLight }) => {
    const { pose, response, slide } = performance(time);
    const robot = drawParts(pose, response, anchor.y);
    const light = matchLight ? lightDirection : authoredLight;
    drawShadow(context, camera, intrinsics, robot, anchor.y, light);
    drawGroundBin(context, translateBin(matchLight ? matchedBin : defaultBin, slide), camera, intrinsics);
    drawActor(context, camera, intrinsics, robot.parts, light);
  };
}

export default function characterDemo(stage) {
  return worldDemo(stage, { createInsert });
}
