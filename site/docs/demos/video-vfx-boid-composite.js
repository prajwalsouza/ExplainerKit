import { hsla, toHex } from '../../runtime/src/color/index.js';
import { projectPoints } from '../../runtime/src/spatial/index.js';
import { applyDepthHoldout } from '../../runtime/src/vfx/index.js';
import { meshHit } from './video-vfx-boid-geometry.js';
import { boidCount } from './video-vfx-boid-model.js';
import { lightAt, makeBoidShadows, paperAlbedo, receiverLight, shadePaper } from './video-vfx-boid-light.js';

// Coordinates follow the dart: nose to tail, across the wings, and above the keel.
const shape = [
  [0.137, 0, 0.006],
  [-0.095, 0, 0.004],
  [-0.096, -0.103, 0.027],
  [-0.096, 0.103, 0.027],
  [-0.064, 0, -0.045],
  [-0.097, -0.026, 0.008],
  [-0.097, 0.026, 0.008],
];
const pointsPerBoid = shape.length;
const faces = [
  [0, 2, 5, 1],
  [0, 5, 1, 0.91],
  [0, 1, 6, 0.91],
  [0, 6, 3, 1],
  [0, 4, 1, 0.63],
];
const palette = {
  fixture: toHex(hsla(164, 63, 74, 0.9)),
  person: toHex(hsla(35, 91, 70, 0.9)),
  lure: toHex(hsla(45, 87, 81, 0.9)),
};

function vertices(buffer, boids, previous) {
  for (let i = 0; i < boidCount; i++) {
    const offset = i * 6;
    const [x, y, z, vx, vy, vz] = boids.subarray(offset, offset + 6);
    const speed = Math.hypot(vx, vz);
    const oldX = previous[offset + 3];
    const oldZ = previous[offset + 5];
    const oldSpeed = Math.hypot(oldX, oldZ);
    const heading = speed > 0.06 ? Math.atan2(vz, vx) : oldSpeed > 0.06 ? Math.atan2(oldZ, oldX) : i * 2.4;
    const fx = Math.cos(heading);
    const fz = Math.sin(heading);
    const pitch = Math.max(-0.55, Math.min(0.55, Math.atan2(vy, Math.max(0.15, speed))));
    const turn = speed > 0.12 && oldSpeed > 0.12 ? Math.atan2(oldX * vz - oldZ * vx, oldX * vx + oldZ * vz) : 0;
    const roll = Math.max(-0.62, Math.min(0.62, turn * 2.3));
    const cp = Math.cos(pitch),
      sp = Math.sin(pitch);
    const cr = Math.cos(roll),
      sr = Math.sin(roll);
    const scale = 0.82 + (i % 7) * 0.029;
    for (let j = 0; j < pointsPerBoid; j++) {
      const [forward, lateral, up] = shape[j];
      const horizontal = lateral * cr - up * sr;
      const lift = lateral * sr + up * cr;
      const index = (i * pointsPerBoid + j) * 3;
      const along = forward * cp - lift * sp;
      buffer[index] = x + scale * (along * fx + horizontal * fz);
      buffer[index + 1] = y + scale * (lift * cp + forward * sp);
      buffer[index + 2] = z + scale * (along * fz - horizontal * fx);
    }
  }
}

function hitDepth(origin, x, y, z, box) {
  let near = 0,
    far = Infinity;
  for (let axis = 0; axis < 3; axis++) {
    const direction = axis === 0 ? x : axis === 1 ? y : z;
    const base = origin[axis];
    if (Math.abs(direction) < 1e-8) {
      if (base < box.min[axis] || base > box.max[axis]) return Infinity;
      continue;
    }
    const a = (box.min[axis] - base) / direction;
    const b = (box.max[axis] - base) / direction;
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
    if (near > far) return Infinity;
  }
  return near > 0.01 ? near : Infinity;
}

function paintBox(ctx, camera, box, offsetX, offsetY, color) {
  const world = new Float64Array(24);
  for (let i = 0; i < 8; i++) {
    for (let axis = 0; axis < 3; axis++) world[i * 3 + axis] = (i & (1 << axis) ? box.max : box.min)[axis];
  }
  const { positions, cameraDepths } = projectPoints(camera, world);
  ctx.strokeStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    for (const mask of [1, 2, 4]) {
      const j = i ^ mask;
      if (j < i || Math.min(cameraDepths[i], cameraDepths[j]) <= 0.01) continue;
      ctx.moveTo(positions[2 * i] + offsetX, positions[2 * i + 1] + offsetY);
      ctx.lineTo(positions[2 * j] + offsetX, positions[2 * j + 1] + offsetY);
    }
  }
  ctx.stroke();
}

function paintMesh(ctx, camera, mesh, offsetX, offsetY, color) {
  const { positions, cameraDepths } = projectPoints(camera, mesh.vertices);
  ctx.strokeStyle = color;
  ctx.beginPath();
  for (const face of mesh.faces) {
    for (let i = 0; i < face.length; i++) {
      const a = face[i],
        b = face[(i + 1) % face.length];
      if (Math.min(cameraDepths[a], cameraDepths[b]) <= 0.01) continue;
      ctx.moveTo(positions[a * 2] + offsetX, positions[a * 2 + 1] + offsetY);
      ctx.lineTo(positions[b * 2] + offsetX, positions[b * 2 + 1] + offsetY);
    }
  }
  ctx.stroke();
}

export function makeBoidComposite(canvas, scene, mattes, rig) {
  const { width, height, intrinsics, matte } = scene;
  const { fx, fy, cx, cy } = intrinsics;
  const offsetX = cx - width / 2,
    offsetY = cy - height / 2;
  const ctx = canvas.getContext('2d', { alpha: false });
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  const overlay = layer.getContext('2d');
  const image = overlay.createImageData(width, height);
  const depth = new Float32Array(width * height);
  const observed = new Float32Array(width * height);
  const vertices3D = new Float64Array(boidCount * pointsPerBoid * 3);
  const material = Array.from({ length: boidCount }, (_, index) => paperAlbedo(rig, index));
  const drawShadows = makeBoidShadows(ctx, scene, rig, faces, pointsPerBoid);
  const touched = [];
  const matteSize = matte.width * matte.height;

  function rasterize(a, b, c, positions, cameraDepths, color) {
    const za = cameraDepths[a],
      zb = cameraDepths[b],
      zc = cameraDepths[c];
    if (Math.min(za, zb, zc) <= 0.02) return;
    const ax = positions[2 * a] + offsetX,
      ay = positions[2 * a + 1] + offsetY;
    const bx = positions[2 * b] + offsetX,
      by = positions[2 * b + 1] + offsetY;
    const cx = positions[2 * c] + offsetX,
      cy = positions[2 * c + 1] + offsetY;
    const area = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(area) < 1e-6) return;
    const left = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const right = Math.min(width - 1, Math.floor(Math.max(ax, bx, cx)));
    const top = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const bottom = Math.min(height - 1, Math.floor(Math.max(ay, by, cy)));
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        const px = x + 0.5 - cx,
          py = y + 0.5 - cy;
        const u = ((by - cy) * px + (cx - bx) * py) / area;
        const v = ((cy - ay) * px + (ax - cx) * py) / area;
        const w = 1 - u - v;
        if (Math.min(u, v, w) < 0) continue;
        const z = 1 / (u / za + v / zb + w / zc);
        const pixel = y * width + x;
        if (z >= depth[pixel]) continue;
        if (!image.data[4 * pixel + 3]) touched.push(pixel);
        depth[pixel] = z;
        image.data.set(color, pixel * 4);
      }
    }
  }

  function draw(
    video,
    camera,
    frame,
    boids,
    previous,
    moving,
    { fixtures, mesh, showGuides, hideBehindPerson, castShadows, lure },
  ) {
    ctx.drawImage(video, 0, 0, width, height);
    const origin = camera.matrixWorld.slice(12, 15);
    const { rotation: r } = scene.frames[frame];
    const plane = hideBehindPerson ? scene.personDepth[frame] : null;
    const [leftTop, leftBottom, rightTop, rightBottom] = scene.doorway[frame];
    const matteOffset = frame * matteSize;

    function doorwayCoverage(x, y) {
      const left = leftTop + ((leftBottom - leftTop) * y) / height;
      const right = rightTop + ((rightBottom - rightTop) * y) / height;
      return Math.max(0, Math.min(1, 0.5 + Math.min(x - left, right - x)));
    }

    function cameraRay(x, y) {
      const u = (x - cx) / fx,
        v = (y - cy) / fy;
      return [r[0] * u + r[3] * v + r[6], r[1] * u + r[4] * v + r[7], r[2] * u + r[5] * v + r[8]];
    }

    function obstacleDepth(ray, obstacles) {
      let closest = Infinity;
      for (const obstacle of obstacles) {
        const boxDepth = hitDepth(origin, ...ray, obstacle);
        if (boxDepth < closest) closest = Math.min(closest, mesh ? meshHit(obstacle, origin, ray) : boxDepth);
      }
      return closest;
    }

    function personCoverage(x, y, at, ray) {
      if (plane === null || Math.abs(ray[2]) <= 1e-8) return 1;
      const index = matteOffset + Math.floor(y / 2) * matte.width + Math.floor(x / 2);
      if (!mattes[index]) return 1;
      const meshDepth = mesh ? obstacleDepth(ray, moving) : Infinity;
      const bodyDepth = Number.isFinite(meshDepth) ? meshDepth : (plane - origin[2]) / ray[2];
      if (bodyDepth <= 0.01 || at <= bodyDepth + 0.015) return 1;
      return 1 - mattes[index] / 255;
    }

    vertices(vertices3D, boids, previous);
    const lights = material.map((_, i) => lightAt(rig, boids[i * 6], boids[i * 6 + 1], boids[i * 6 + 2]));
    if (castShadows)
      drawShadows(camera, vertices3D, lights, (x, y, receiver, source) => {
        const coverage = doorwayCoverage(x, y);
        if (!coverage) return 0;
        const ray = cameraRay(x, y);
        const { axis, value, normal, min, max } = receiver;
        if (ray[axis] * normal >= -1e-5) return 0;
        const at = (value - origin[axis]) / ray[axis];
        if (at <= 0.02 || at > 20) return 0;
        const world = ray.map((direction, i) => origin[i] + direction * at);
        if (world.some((value, i) => i !== axis && (value < min[i] || value > max[i]))) return 0;
        if (at > obstacleDepth(ray, fixtures) + 0.018) return 0;
        return coverage * personCoverage(x, y, at, ray) * receiverLight(source, receiver, ...world);
      });

    depth.fill(Infinity);
    image.data.fill(0);
    touched.length = 0;
    const { positions, cameraDepths } = projectPoints(camera, vertices3D);
    for (let i = 0; i < boidCount; i++) {
      const offset = i * pointsPerBoid;
      for (const [a, b, c, fold] of faces) {
        const fill = shadePaper(
          vertices3D,
          offset + a,
          offset + b,
          offset + c,
          material[i],
          rig.ambient,
          lights[i],
          fold,
        );
        rasterize(offset + a, offset + b, offset + c, positions, cameraDepths, fill);
      }
    }
    for (const pixel of touched) {
      const x = pixel % width,
        y = Math.floor(pixel / width);
      image.data[pixel * 4 + 3] *= doorwayCoverage(x, y);
      if (!image.data[pixel * 4 + 3]) continue;
      const ray = cameraRay(x + 0.5, y + 0.5);
      observed[pixel] = obstacleDepth(ray, fixtures);
      image.data[pixel * 4 + 3] *= personCoverage(x, y, depth[pixel], ray);
    }
    const masked = applyDepthHoldout({
      width,
      height,
      insert: image.data,
      insertDepth: depth,
      observed: { width, height, data: observed },
      bias: 0.02,
      softness: 0.02,
    });
    image.data.set(masked);
    overlay.putImageData(image, 0, 0);
    ctx.drawImage(layer, 0, 0);

    if (showGuides) {
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 3]);
      const paint = mesh ? paintMesh : paintBox;
      for (const obstacle of fixtures) paint(ctx, camera, obstacle, offsetX, offsetY, palette.fixture);
      for (const obstacle of moving) paint(ctx, camera, obstacle, offsetX, offsetY, palette.person);
      ctx.setLineDash([]);
    }
    if (lure) {
      const { positions, cameraDepths } = projectPoints(camera, new Float64Array(lure));
      if (cameraDepths[0] > 0.01) {
        ctx.strokeStyle = palette.lure;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(positions[0] + offsetX, positions[1] + offsetY, 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  return { draw };
}
