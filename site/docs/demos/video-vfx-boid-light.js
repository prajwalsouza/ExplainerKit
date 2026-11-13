import { hsla, mix, toRGBA } from '../../runtime/src/color/index.js';
import { projectPoints } from '../../runtime/src/spatial/index.js';
import { boidCount } from './video-vfx-boid-model.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const linear = (value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
const srgb = (value) => (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055);
const color = (r, g, b, a = 1) => [r, g, b, a].map((channel) => Math.round(clamp(channel, 0, 1) * 255));
const floor = { axis: 1, value: 0, normal: 1, min: [-20, 0, -20], max: [20, 0, 20] };

// Positions and directions are fitted in the same world coordinates as the room proxies.
export const boidLighting = {
  '': {
    palette: [hsla(215, 90, 72), hsla(241, 76, 72), hsla(273, 77, 76)],
    ambient: [0.42, 0.4, 0.43],
    sources: [
      { position: [-2.65, 2.4, 0.18], tint: [0.78, 0.9, 1], power: 1.1, range: 3.3, radius: 0.085, shadow: 0.62 },
      { position: [-0.15, 1.68, -0.54], tint: [1, 0.72, 0.47], power: 0.66, range: 1.5, radius: 0.065, shadow: 0.47 },
    ],
    receivers: [floor],
  },
  '-house': {
    palette: [hsla(206, 91, 68), hsla(229, 86, 66), hsla(258, 87, 72)],
    ambient: [0.36, 0.43, 0.5],
    sources: [
      { direction: [-0.13, 0.59, -0.8], tint: [1, 0.86, 0.72], power: 1.05, radius: 0.015, beam: true, shadow: 0.32 },
    ],
    receivers: [{ ...floor, min: [-2.7, 0, -5.15], max: [2.1, 0, 0] }],
  },
  '-sitting-room': {
    palette: [hsla(231, 70, 73), hsla(254, 59, 72), hsla(279, 61, 79)],
    ambient: [0.46, 0.47, 0.5],
    sources: [
      { position: [2.05, 2.45, -4.3], tint: [0.91, 0.96, 1], power: 0.92, range: 3.4, radius: 0.18, shadow: 0.32 },
    ],
    receivers: [floor, { fixture: 1, axis: 2, normal: 1 }],
  },
  '-hallway': {
    palette: [hsla(217, 73, 65), hsla(246, 83, 70), hsla(271, 80, 69)],
    ambient: [0.32, 0.34, 0.4],
    sources: [-2.9, -5.5, -8.1].map((z) => ({
      position: [0.04, 2.7, z],
      tint: [0.9, 0.93, 1],
      power: 0.98,
      range: 1.4,
      radius: 0.085,
      shadow: 0.44,
    })),
    receivers: [
      { ...floor, min: [-0.98, 0, -13], max: [1.02, 0, 0] },
      { fixture: 0, axis: 0, normal: 1 },
      { fixture: 1, axis: 0, normal: -1 },
    ],
  },
};

export function paperAlbedo({ palette }, index) {
  const stop = (((index * 7) % boidCount) * (palette.length - 1)) / boidCount;
  const base = Math.floor(stop);
  return toRGBA(mix(palette[base], palette[base + 1], stop - base))
    .slice(0, 3)
    .map(linear);
}

function sunlightAtGround(x, z) {
  // The sunlit floor stripe opens toward the camera from the glass door.
  const edge = x + 0.4 - 0.1 * (z + 4.4);
  const fade = clamp((0.65 - Math.abs(edge)) / 0.35, 0, 1);
  return fade * fade * (3 - 2 * fade);
}

export function receiverLight(source, receiver, x, y, z) {
  if (source.beam) return sunlightAtGround(x, z);
  const delta = [source.position[0] - x, source.position[1] - y, source.position[2] - z];
  const distance = Math.max(0.001, Math.hypot(...delta));
  const incidence = clamp((1.4 * receiver.normal * delta[receiver.axis]) / distance, 0, 1);
  return incidence / (1 + (distance / (source.range * 1.5)) ** 2);
}

export function lightAt({ sources }, x, y, z) {
  return sources.map((source) => {
    const delta = source.direction ?? [source.position[0] - x, source.position[1] - y, source.position[2] - z];
    const length = Math.max(0.001, Math.hypot(...delta));
    const direction = delta.map((channel) => channel / length);
    let strength = source.power;
    if (source.range) strength /= 1 + (length / source.range) ** 2;
    if (source.beam) {
      const groundX = x - (y * direction[0]) / direction[1];
      const groundZ = z - (y * direction[2]) / direction[1];
      strength *= sunlightAtGround(groundX, groundZ);
    }
    return {
      ...source,
      direction,
      strength,
      spread: source.position ? source.radius / Math.max(0.7, length) : source.radius,
    };
  });
}

export function shadePaper(world, a, b, c, albedo, ambient, lights, fold) {
  const i = 3 * a;
  const j = 3 * b;
  const k = 3 * c;
  const ux = world[j] - world[i],
    uy = world[j + 1] - world[i + 1],
    uz = world[j + 2] - world[i + 2];
  const vx = world[k] - world[i],
    vy = world[k + 1] - world[i + 1],
    vz = world[k + 2] - world[i + 2];
  const nx = uy * vz - uz * vy,
    ny = uz * vx - ux * vz,
    nz = ux * vy - uy * vx;
  const length = Math.max(1e-9, Math.hypot(nx, ny, nz));
  const reflected = [...ambient];
  for (const {
    direction: [x, y, z],
    strength,
    tint,
  } of lights) {
    const diffuse = Math.abs(nx * x + ny * y + nz * z) / length;
    for (let channel = 0; channel < 3; channel++) reflected[channel] += tint[channel] * strength * diffuse * 0.7;
  }
  // Paper is thin and both sides catch light. The folded center is less exposed.
  const [red, green, blue] = albedo.map((channel, i) => srgb(channel * Math.min(1.15, reflected[i]) * fold));
  return color(red, green, blue);
}

const aperture = [
  [0, 0],
  [0.8, 0.55],
  [-0.8, -0.55],
  [0.55, -0.8],
  [-0.55, 0.8],
];

function receiverPlane(receiver, fixtures) {
  if (receiver.fixture === undefined) return receiver;
  const { axis, normal, fixture } = receiver;
  const { min, max } = fixtures[fixture];
  return { axis, normal, min, max, value: (normal > 0 ? max : min)[axis] };
}

function projectShadow(buffer, world, offset, receiver, light, sample) {
  const { axis, value, normal } = receiver;
  const ray = [...light.direction];
  ray[(axis + 1) % 3] += sample[0] * light.spread;
  ray[(axis + 2) % 3] += sample[1] * light.spread;
  if (normal * ray[axis] < 0.2) return false;
  for (let i = 0; i < buffer.length / 3; i++) {
    const start = 3 * (offset + i);
    const distance = (world[start + axis] - value) / ray[axis];
    if (distance < 0 || distance > 7) return false;
    for (let component = 0; component < 3; component++) {
      buffer[3 * i + component] = world[start + component] - distance * ray[component];
    }
  }
  return true;
}

export function makeBoidShadows(context, scene, rig, faces, pointsPerBoid) {
  const { width, height, intrinsics, furniture } = scene;
  const offsetX = intrinsics.cx - width / 2;
  const offsetY = intrinsics.cy - height / 2;
  const receivers = rig.receivers.map((receiver) => receiverPlane(receiver, furniture));
  const layer = document.createElement('canvas');
  layer.width = width / 2;
  layer.height = height / 2;
  const mask = layer.getContext('2d', { willReadFrequently: true });
  const footprint = new Float64Array(pointsPerBoid * 3);

  function paintSource(camera, world, lightByBoid, receiver, source, sourceIndex, visible) {
    mask.clearRect(0, 0, layer.width, layer.height);
    mask.globalCompositeOperation = 'lighter';
    mask.fillStyle = `rgba(0, 0, 0, ${source.shadow / aperture.length})`;
    let left = layer.width,
      top = layer.height,
      right = 0,
      bottom = 0;
    // Each emitter sample is a union of casters. Overlapping planes block it once.
    for (const sample of aperture) {
      mask.beginPath();
      for (let i = 0; i < lightByBoid.length; i++) {
        const light = lightByBoid[i][sourceIndex];
        if (light.strength < 0.012 || !projectShadow(footprint, world, i * pointsPerBoid, receiver, light, sample))
          continue;
        const { positions, cameraDepths } = projectPoints(camera, footprint);
        if (cameraDepths.some((depth) => depth <= 0.1)) continue;
        for (let j = 0; j < pointsPerBoid; j++) {
          const x = (positions[j * 2] + offsetX) / 2;
          const y = (positions[j * 2 + 1] + offsetY) / 2;
          positions[j * 2] = x;
          positions[j * 2 + 1] = y;
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
        for (const [a, b, c] of faces) {
          const ax = positions[2 * a],
            ay = positions[2 * a + 1];
          const bx = positions[2 * b],
            by = positions[2 * b + 1];
          const cx = positions[2 * c],
            cy = positions[2 * c + 1];
          mask.moveTo(ax, ay);
          if ((bx - ax) * (cy - ay) > (by - ay) * (cx - ax)) {
            mask.lineTo(bx, by);
            mask.lineTo(cx, cy);
          } else {
            mask.lineTo(cx, cy);
            mask.lineTo(bx, by);
          }
          mask.closePath();
        }
      }
      mask.fill();
    }
    const x = Math.max(0, Math.floor(left - 1));
    const y = Math.max(0, Math.floor(top - 1));
    const w = Math.min(layer.width, Math.ceil(right + 1)) - x;
    const h = Math.min(layer.height, Math.ceil(bottom + 1)) - y;
    if (w <= 0 || h <= 0) return;
    const image = mask.getImageData(x, y, w, h);
    for (let row = 0; row < h; row++) {
      for (let column = 0; column < w; column++) {
        const alpha = 4 * (row * w + column) + 3;
        if (image.data[alpha]) image.data[alpha] *= visible((x + column) * 2 + 1, (y + row) * 2 + 1, receiver, source);
      }
    }
    mask.putImageData(image, x, y);
    context.drawImage(layer, x, y, w, h, x * 2, y * 2, w * 2, h * 2);
  }

  return (camera, world, lightByBoid, visible) => {
    for (const receiver of receivers) {
      rig.sources.forEach((source, index) => paintSource(camera, world, lightByBoid, receiver, source, index, visible));
    }
  };
}
