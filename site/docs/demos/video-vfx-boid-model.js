import { randomAt } from '../../runtime/src/noise/index.js';
import { meshDistance, obstacleMesh } from './video-vfx-boid-geometry.js';

export const boidCount = 22;
export const boidRadius = 0.15;
const ticksPerSecond = 60;
const separation = 2 * boidRadius;
const neighbors = 1.35;
const stride = 6;
const axes = [0, 1, 2];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// The exported scene samples contain the same body bands in anatomical order.
export function movingBoxes(frames, fps, time) {
  const at = clamp(time * fps, 0, frames.length - 1);
  const index = Math.floor(at);
  const a = frames[index];
  const b = frames[Math.min(index + 1, frames.length - 1)];
  if (!a.length || !b.length) return at - index < 0.5 ? a : b;
  const fraction = at - index;
  return a.map((box, i) => ({
    min: box.min.map((value, axis) => value + fraction * (b[i].min[axis] - value)),
    max: box.max.map((value, axis) => value + fraction * (b[i].max[axis] - value)),
  }));
}

export function sceneObstacles({ furniture, people, fps }, mode) {
  const mesh = mode === 'mesh';
  return {
    fixtures: mesh ? furniture.map((box) => obstacleMesh(box)) : furniture,
    person(time) {
      const bands = movingBoxes(people, fps, time);
      return mesh ? bands.map((box, i) => obstacleMesh(box, i)) : bands;
    },
  };
}

function meshForce(out, x, y, z, mesh) {
  if (!overlapsBox([x, y, z], 0, mesh, 0.45)) return;
  const { distance, normal } = meshDistance(mesh, x, y, z);
  const gain = 26 * Math.max(0, 1 - Math.max(0, distance) / 0.45) ** 2;
  for (const i of axes) out[i] += gain * normal[i];
}

export function overlapsMesh(p, offset, mesh, radius = boidRadius) {
  return (
    overlapsBox(p, offset, mesh, radius) &&
    meshDistance(mesh, p[offset], p[offset + 1], p[offset + 2]).distance < radius
  );
}

function escapeMeshes(position, meshes, room) {
  let best;
  for (const axis of axes) {
    const intervals = [];
    for (const mesh of meshes) {
      if (
        axes.some(
          (i) => i !== axis && (position[i] <= mesh.min[i] - boidRadius || position[i] >= mesh.max[i] + boidRadius),
        )
      )
        continue;
      let low = mesh.min[axis] - boidRadius - position[axis];
      let high = mesh.max[axis] + boidRadius - position[axis];
      for (const { normal, offset } of mesh.planes) {
        const extent = offset + boidRadius - normal.reduce((sum, n, i) => sum + n * position[i], 0);
        const slope = normal[axis];
        if (slope > 1e-8) high = Math.min(high, extent / slope);
        else if (slope < -1e-8) low = Math.max(low, extent / slope);
        else if (extent <= 0) high = -Infinity;
      }
      if (high > low) intervals.push([low, high]);
    }
    for (const direction of [-1, 1]) {
      let shift = 0;
      for (let pass = 0; pass < intervals.length; pass++) {
        const blocked = intervals.find(([low, high]) => shift > low && shift < high);
        if (!blocked) break;
        shift = direction > 0 ? blocked[1] + 0.0002 : blocked[0] - 0.0002;
      }
      const value = position[axis] + shift;
      if (shift === 0 || value < room.min[axis] + boidRadius || value > room.max[axis] - boidRadius) continue;
      const distance = Math.abs(shift);
      if (!best || distance < best.distance) {
        const next = position.slice();
        next[axis] = value;
        const normal = [0, 0, 0];
        normal[axis] = direction;
        best = { distance, next, normal };
      }
    }
  }
  return best;
}

function separateMeshes(p, v, offset, meshes, room) {
  if (!meshes.some((mesh) => overlapsMesh(p, offset, mesh))) return;
  let best;
  const position = Array.from(p.subarray(offset, offset + 3));
  for (const mesh of meshes) {
    if (!overlapsMesh(p, offset, mesh)) continue;
    for (const { normal, offset: planeOffset } of mesh.planes) {
      const distance =
        boidRadius + planeOffset - position.reduce((sum, value, i) => sum + value * normal[i], 0) + 0.0002;
      if (distance < 0 || (best && distance >= best.distance)) continue;
      const next = position.map((value, i) => value + normal[i] * distance);
      if (next.some((value, i) => value < room.min[i] + boidRadius || value > room.max[i] - boidRadius)) continue;
      if (meshes.some((other) => overlapsMesh(next, 0, other))) continue;
      best = { distance, next, normal };
    }
  }
  best ??= escapeMeshes(position, meshes, room);
  if (!best) return;
  const speed = best.normal.reduce((sum, n, i) => sum + n * v[offset + i], 0);
  for (const i of axes) {
    p[offset + i] = best.next[i];
    v[offset + i] -= Math.min(0, speed) * best.normal[i];
  }
}

function boxForce(out, x, y, z, { min, max }) {
  const px = x - clamp(x, min[0], max[0]);
  const py = y - clamp(y, min[1], max[1]);
  const pz = z - clamp(z, min[2], max[2]);
  const distance = Math.hypot(px, py, pz);
  const reach = 0.45;
  if (distance >= reach || distance <= 1e-8) return;
  const gain = ((1 - distance / reach) ** 2 * 26) / distance;
  out[0] += gain * px;
  out[1] += gain * py;
  out[2] += gain * pz;
}

export function overlapsBox(p, offset, box, radius = boidRadius) {
  return axes.every((axis) => p[offset + axis] > box.min[axis] - radius && p[offset + axis] < box.max[axis] + radius);
}

function bound(p, v, offset, room) {
  for (const axis of axes) {
    const i = offset + axis;
    const low = room.min[axis] + boidRadius;
    const high = room.max[axis] - boidRadius;
    if (p[i] < low) {
      p[i] = low;
      v[i] = Math.max(0, v[i]);
    } else if (p[i] > high) {
      p[i] = high;
      v[i] = Math.min(0, v[i]);
    }
  }
}

function separateObstacles(p, v, offset, boxes, room) {
  if (!boxes.some((box) => overlapsBox(p, offset, box))) return;
  let best;
  for (const axis of axes) {
    const index = offset + axis;
    const previous = p[index];
    for (const box of boxes) {
      const low = box.min[axis] - boidRadius - 0.0002;
      const high = box.max[axis] + boidRadius + 0.0002;
      for (const value of [low, high]) {
        if (value < room.min[axis] + boidRadius || value > room.max[axis] - boidRadius) continue;
        const delta = value - previous;
        if (best && Math.abs(delta) >= Math.abs(best.delta)) continue;
        p[index] = value;
        if (!boxes.some((obstacle) => overlapsBox(p, offset, obstacle))) best = { index, value, delta };
      }
    }
    p[index] = previous;
  }
  if (!best) return;
  p[best.index] = best.value;
  if (v[best.index] * best.delta < 0) v[best.index] = 0;
}

function separatePeers(p, v) {
  for (let a = 0; a < p.length; a += 3) {
    for (let b = a + 3; b < p.length; b += 3) {
      const dx = p[b] - p[a];
      const dy = p[b + 1] - p[a + 1];
      const dz = p[b + 2] - p[a + 2];
      const distance = Math.hypot(dx, dy, dz);
      if (distance >= separation) continue;
      const n = distance > 1e-8 ? [dx / distance, dy / distance, dz / distance] : [1, 0, 0];
      const push = (separation - distance + 0.001) * 0.5;
      const closing = (v[b] - v[a]) * n[0] + (v[b + 1] - v[a + 1]) * n[1] + (v[b + 2] - v[a + 2]) * n[2];
      for (const axis of axes) {
        p[a + axis] -= n[axis] * push;
        p[b + axis] += n[axis] * push;
        if (closing < 0) {
          v[a + axis] += n[axis] * closing * 0.5;
          v[b + axis] -= n[axis] * closing * 0.5;
        }
      }
    }
  }
}

export function createBoidFlock({
  duration,
  room,
  furniture,
  people,
  fps,
  geometry = 'boxes',
  obstacles = sceneObstacles({ furniture, people, fps }, geometry),
}) {
  const ticks = Math.round(duration * ticksPerSecond);
  if (!Number.isInteger(ticks) || ticks < 1 || ticks > 1800) throw Error('The flock accepts at most 30 seconds.');
  const count = boidCount;
  const history = new Float32Array((ticks + 1) * count * stride);
  const p = new Float64Array(count * 3);
  const v = new Float64Array(count * 3);
  const nextVelocity = new Float64Array(count * 3);
  const center = room.min.map((lo, axis) => (lo + room.max[axis]) * 0.5);
  const span = room.min.map((lo, axis) => room.max[axis] - lo);
  const force = new Float64Array(3);
  const separate = geometry === 'mesh' ? separateMeshes : separateObstacles;
  const avoid = geometry === 'mesh' ? meshForce : boxForce;
  let held = null;
  let filled = 0;
  let viewed = 0;

  function store(step) {
    for (let i = 0; i < count; i++) {
      const dest = (step * count + i) * stride;
      for (const axis of axes) {
        history[dest + axis] = p[i * 3 + axis];
        history[dest + 3 + axis] = v[i * 3 + axis];
      }
    }
  }

  function restore(step) {
    for (let i = 0; i < count; i++) {
      const src = (step * count + i) * stride;
      for (const axis of axes) {
        p[i * 3 + axis] = history[src + axis];
        v[i * 3 + axis] = history[src + 3 + axis];
      }
    }
  }

  function constrain(boxes, repeat) {
    for (let pass = 0; pass < repeat; pass++) {
      separatePeers(p, v);
      for (let offset = 0; offset < p.length; offset += 3) {
        bound(p, v, offset, room);
        separate(p, v, offset, boxes, room);
      }
    }
  }

  function reset() {
    filled = viewed = 0;
    held = null;
    for (let i = 0; i < count; i++) {
      const offset = i * 3;
      for (const axis of axes) {
        p[offset + axis] = center[axis] + (randomAt(931, i, axis) - 0.5) * span[axis] * 0.7;
        v[offset + axis] = (randomAt(941, i, axis) - 0.5) * 0.5;
      }
    }
    constrain([...obstacles.fixtures, ...obstacles.person(0)], 12);
    store(0);
  }

  function advance(step, lure, fixed) {
    const time = fixed?.time ?? step / ticksPerSecond;
    const boxes = fixed?.boxes ?? [...obstacles.fixtures, ...obstacles.person(time)];
    const lookAhead = 0.29;
    const ahead = fixed?.boxes ?? [...obstacles.fixtures, ...obstacles.person(time + lookAhead)];
    const target = lure ?? [
      center[0] + span[0] * 0.36 * Math.sin(1.28 * time + 0.5),
      center[1] + span[1] * 0.22 * Math.sin(1.53 * time),
      center[2] + span[2] * 0.29 * Math.cos(1.12 * time),
    ];
    for (let i = 0; i < count; i++) {
      const a = i * 3;
      let near = 0;
      let dxSum = 0,
        dySum = 0,
        dzSum = 0;
      let vxSum = 0,
        vySum = 0,
        vzSum = 0;
      const gain = lure ? 7.2 : 3.5;
      force[0] = (target[0] - p[a]) * gain;
      force[1] = (target[1] - p[a + 1]) * gain;
      force[2] = (target[2] - p[a + 2]) * gain;
      for (let j = 0; j < count; j++) {
        if (i === j) continue;
        const b = j * 3;
        const dx = p[b] - p[a],
          dy = p[b + 1] - p[a + 1],
          dz = p[b + 2] - p[a + 2];
        const distance = Math.hypot(dx, dy, dz);
        if (distance > neighbors) continue;
        near++;
        dxSum += dx;
        dySum += dy;
        dzSum += dz;
        vxSum += v[b];
        vySum += v[b + 1];
        vzSum += v[b + 2];
        if (distance < 0.56) {
          const repulsion = (15 * (0.56 - distance)) / Math.max(distance, 0.01);
          force[0] -= dx * repulsion;
          force[1] -= dy * repulsion;
          force[2] -= dz * repulsion;
        }
      }
      if (near) {
        force[0] += (dxSum / near) * 0.63 + (vxSum / near - v[a]) * 0.9;
        force[1] += (dySum / near) * 0.63 + (vySum / near - v[a + 1]) * 0.9;
        force[2] += (dzSum / near) * 0.63 + (vzSum / near - v[a + 2]) * 0.9;
      }
      for (const box of ahead) {
        avoid(force, p[a] + lookAhead * v[a], p[a + 1] + lookAhead * v[a + 1], p[a + 2] + lookAhead * v[a + 2], box);
      }
      for (const axis of axes) {
        const index = a + axis;
        const phase = time * (3.2 + 0.08 * i) + 1.76 * i + axis * 2.3;
        nextVelocity[index] = v[index] * 0.992 + (force[axis] + Math.sin(phase) * 1.2) / ticksPerSecond;
      }
      const speed = Math.hypot(nextVelocity[a], nextVelocity[a + 1], nextVelocity[a + 2]);
      if (speed > 3.2) for (const axis of axes) nextVelocity[a + axis] *= 3.2 / speed;
    }
    v.set(nextVelocity);
    for (let i = 0; i < p.length; i++) p[i] += v[i] / ticksPerSecond;
    constrain(boxes, 16);
    store(step);
  }

  reset();
  return {
    reset,
    sample(seconds, lure = null) {
      const target = clamp(Math.round(seconds * ticksPerSecond), 0, ticks);
      if (target !== viewed) held = null;
      const live = lure && target > viewed && target - viewed <= 12;
      if (live && viewed < filled) {
        filled = viewed;
        restore(filled);
      }
      while (filled < target) advance(++filled, live ? lure : null);
      viewed = target;
      return history.subarray(target * count * stride, (target + 1) * count * stride);
    },
    hold(seconds, lure, steps) {
      const tick = clamp(Math.round(seconds * ticksPerSecond), 0, ticks);
      if (held?.tick !== tick) {
        this.sample(seconds);
        filled = tick;
        restore(tick);
        held = { tick, time: seconds, boxes: [...obstacles.fixtures, ...obstacles.person(seconds)], previous: null };
      }
      held.previous = history.slice(tick * count * stride, (tick + 1) * count * stride);
      for (let i = 0; i < Math.min(4, steps); i++) advance(tick, lure, held);
      return history.subarray(tick * count * stride, (tick + 1) * count * stride);
    },
    previous() {
      if (held?.previous) return held.previous;
      const tick = Math.max(0, viewed - 6);
      return history.subarray(tick * count * stride, (tick + 1) * count * stride);
    },
  };
}
