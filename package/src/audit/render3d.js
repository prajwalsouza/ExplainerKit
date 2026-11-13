// 3D rendering audit: the artefacts a shaded scene shows most often, checked before anyone has to spot them.
//
//   shadow-bias        a light casts shadows onto objects that also cast them, with no depth or normal bias.
//                      Curved surfaces then shadow themselves in fine parallel stripes ("shadow acne").
//   shadow-resolution  one texel of the shadow map covers several screen pixels at the subject's distance, so
//                      shadow edges come out stair-stepped or hatched.
//   shadow-coverage    objects that receive shadows lie outside the light's shadow camera, so their shadows are
//                      cut off or missing.
//   depth-precision    the camera's far/near ratio leaves too little depth resolution, so surfaces close together
//                      flicker between each other ("z-fighting").
//   coplanar-surfaces  two opaque flat objects overlap at almost the same depth: z-fighting regardless of camera.
//
// The rules read a plain description, so they work for any renderer. `describeThreeScene` builds that description
// from a three.js scene, camera and renderer by reading their properties; it never imports three.js. The pixel
// check `auditStripes` looks for the artefacts themselves in a rendered image. Thresholds are engineering choices,
// listed in RENDER_3D so a project can tighten or loosen them. A finding names the objects and the measurement.
import { assert, number } from '../core/validate.js';

export const RENDER_3D = Object.freeze({
  maxTexelPixels: 3, // shadow-map texels may cover at most this many screen pixels at the subject distance
  maxDepthRatio: 1e5, // far / near above this without logarithmic depth risks z-fighting at distance
  depthBits: 24,
  coplanarDepthSteps: 4, // flat surfaces closer than this many depth steps apart will fight
  flatness: 1e-3, // a box is flat when its thinnest side is below this share of its largest side
  minNormalBiasTexels: 2, // normal bias below this many shadow texels lets surfaces shadow themselves
  // auditStripes thresholds, measured on the landing city: its clean frame has 1 striped tile at these settings, the
  // same view with too little shadow bias has 10.
  stripeScore: 0.4, // periodicity needed to flag a tile
  stripeEnergy: 3, // high-frequency luminance amplitude (0–255) needed to flag a tile
  stripeTiles: 3, // flagged tiles needed before the image is reported
});

const MAX_MESHES = 20000;
const MAX_LIGHTS = 64;

// --- reading a three.js scene ---------------------------------------------------------------------------

function transform(e, [x, y, z]) {
  const w = e[3] * x + e[7] * y + e[11] * z + e[15] || 1;
  return [
    (e[0] * x + e[4] * y + e[8] * z + e[12]) / w,
    (e[1] * x + e[5] * y + e[9] * z + e[13]) / w,
    (e[2] * x + e[6] * y + e[10] * z + e[14]) / w,
  ];
}

function corners(min, max) {
  const out = [];
  for (const x of [min[0], max[0]])
    for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) out.push([x, y, z]);
  return out;
}

function worldBox(object) {
  let box = null;
  if (object.isInstancedMesh && typeof object.computeBoundingBox === 'function') {
    object.computeBoundingBox();
    box = object.boundingBox;
  } else if (object.geometry) {
    if (!object.geometry.boundingBox && typeof object.geometry.computeBoundingBox === 'function')
      object.geometry.computeBoundingBox();
    box = object.geometry.boundingBox;
  }
  if (!box || !Number.isFinite(box.min?.x)) return null;
  const e = object.matrixWorld?.elements;
  const points = corners([box.min.x, box.min.y, box.min.z], [box.max.x, box.max.y, box.max.z]).map((p) =>
    e ? transform(e, p) : p,
  );
  const min = [0, 1, 2].map((i) => Math.min(...points.map((p) => p[i])));
  const max = [0, 1, 2].map((i) => Math.max(...points.map((p) => p[i])));
  return { min, max };
}

const label = (object, i) => object.name || object.userData?.id || `${object.type ?? 'object'}-${i}`;

/**
 * Describe a three.js scene for auditRender3D, by reading properties only. `input` is {scene, camera, renderer,
 * viewport, subject}. `viewport` is the drawing size in CSS
 * pixels ({width, height}); `subject` (optional) is the world point the audience looks at, by default the centre of
 * the objects that receive shadows.
 */
export function describeThreeScene(input) {
  assert(input && typeof input === 'object', 'INVALID_3D_AUDIT', 'Pass {scene, camera, renderer, viewport}.');
  const { scene, camera, renderer, viewport, subject } = input;
  assert(scene && typeof scene.traverse === 'function', 'INVALID_3D_AUDIT', 'Pass a three.js scene.');
  assert(
    camera && Number.isFinite(camera.near) && Number.isFinite(camera.far),
    'INVALID_3D_AUDIT',
    'Pass the camera that renders the scene.',
  );
  scene.updateMatrixWorld?.(true);
  camera.updateMatrixWorld?.(true);
  const meshes = [];
  const lights = [];
  let i = 0;
  scene.traverse((object) => {
    i++;
    if (object.visible === false) return;
    if ((object.isMesh || object.isInstancedMesh) && meshes.length < MAX_MESHES) {
      const box = worldBox(object);
      const materials = [].concat(object.material ?? []);
      if (box)
        meshes.push({
          id: label(object, i),
          castShadow: Boolean(object.castShadow),
          receiveShadow: Boolean(object.receiveShadow),
          transparent: materials.some((m) => m.transparent || (m.opacity ?? 1) < 1),
          shadowOnly: materials.every((m) => m.type === 'ShadowMaterial'),
          color: materials[0]?.color?.getHexString?.() ?? null,
          box,
        });
    }
    if (object.isLight && object.castShadow && object.shadow && lights.length < MAX_LIGHTS) {
      const c = object.shadow.camera;
      c?.updateMatrixWorld?.(true);
      lights.push({
        id: label(object, i),
        kind: object.isDirectionalLight
          ? 'directional'
          : object.isSpotLight
            ? 'spot'
            : object.isPointLight
              ? 'point'
              : 'other',
        mapSize: [object.shadow.mapSize?.x ?? 512, object.shadow.mapSize?.y ?? 512],
        bias: object.shadow.bias ?? 0,
        normalBias: object.shadow.normalBias ?? 0,
        radius: object.shadow.radius ?? 1,
        frustum: c?.isOrthographicCamera
          ? { left: c.left, right: c.right, top: c.top, bottom: c.bottom, near: c.near, far: c.far }
          : null,
        view: c?.matrixWorldInverse?.elements ? [...c.matrixWorldInverse.elements] : null,
      });
    }
  });
  const e = camera.matrixWorld?.elements;
  return {
    camera: {
      kind: camera.isOrthographicCamera ? 'orthographic' : 'perspective',
      near: camera.near,
      far: camera.far,
      fov: camera.fov ?? null,
      height: camera.isOrthographicCamera ? (camera.top - camera.bottom) / (camera.zoom ?? 1) : null,
      position: e ? [e[12], e[13], e[14]] : [0, 0, 0],
      logarithmicDepth: Boolean(renderer?.capabilities?.logarithmicDepthBuffer),
    },
    viewport: viewport ?? {
      width: renderer?.domElement?.clientWidth || 1280,
      height: renderer?.domElement?.clientHeight || 720,
    },
    shadows: { enabled: Boolean(renderer?.shadowMap?.enabled), type: renderer?.shadowMap?.type ?? null },
    lights,
    meshes,
    ...(subject ? { subject } : {}),
  };
}

// --- the rules ------------------------------------------------------------------------------------------

const centre = (b) => [0, 1, 2].map((k) => (b.min[k] + b.max[k]) / 2);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const round = (v, digits = 3) => Number(v.toPrecision(digits));

/** World size of one screen pixel at distance `d` from the camera. */
function pixelSize(camera, viewport, d) {
  if (camera.kind === 'orthographic') return camera.height / viewport.height;
  return (2 * d * Math.tan(((camera.fov ?? 50) * Math.PI) / 360)) / viewport.height;
}

/** Smallest depth difference a perspective depth buffer separates at distance `d`. */
function depthStep(camera, d, bits) {
  if (camera.logarithmicDepth) return (d * Math.LN2 * Math.log2(camera.far / camera.near)) / 2 ** bits;
  if (camera.kind === 'orthographic') return (camera.far - camera.near) / 2 ** bits;
  return (d * d) / (camera.near * 2 ** bits);
}

/**
 * Audit a 3D scene description (see describeThreeScene). Returns {status, findings, measures}; each finding has a
 * rule, a severity, the objects involved, a message saying what to change, and the measured value.
 */
export function auditRender3D(description, spec = {}) {
  assert(
    description && description.camera && Array.isArray(description.meshes) && Array.isArray(description.lights),
    'INVALID_3D_AUDIT',
    'Pass a description from describeThreeScene.',
  );
  const rules = { ...RENDER_3D, ...spec };
  const { camera, viewport, lights, meshes } = description;
  number(viewport?.height, 'viewport height', 1, 16384);
  const findings = [];
  const receivers = meshes.filter((m) => m.receiveShadow && !m.transparent);
  const solid = meshes.filter((m) => !m.transparent && !m.shadowOnly);
  const subject =
    description.subject ??
    (receivers.length
      ? centre({
          min: [0, 1, 2].map((k) => Math.min(...receivers.map((m) => m.box.min[k]))),
          max: [0, 1, 2].map((k) => Math.max(...receivers.map((m) => m.box.max[k]))),
        })
      : [0, 0, 0]);
  const subjectDistance = Math.max(camera.near, distance(camera.position, subject));
  const pixel = pixelSize(camera, viewport, subjectDistance);
  const measures = { subjectDistance: round(subjectDistance), pixelWorld: round(pixel), lights: [] };

  if (description.shadows?.enabled !== false)
    for (const light of lights) {
      const selfShadowing = meshes.filter((m) => m.castShadow && m.receiveShadow);
      const texelWorld = light.frustum
        ? Math.max(
            (light.frustum.right - light.frustum.left) / light.mapSize[0],
            (light.frustum.top - light.frustum.bottom) / light.mapSize[1],
          )
        : null;
      const noDepthBias = light.bias > -1e-4;
      const tooLittle = texelWorld !== null && light.normalBias < texelWorld * rules.minNormalBiasTexels;
      if (selfShadowing.length && noDepthBias && (light.normalBias === 0 || tooLittle))
        findings.push({
          rule: 'shadow-bias',
          severity: 'warning',
          ids: [light.id, ...selfShadowing.slice(0, 6).map((m) => m.id)],
          message: `${light.id} has ${light.normalBias === 0 ? 'no' : 'too little'} shadow bias while ${selfShadowing.length} objects both cast and receive its shadows, so surfaces will shadow themselves in fine stripes (shadow acne). Set normalBias to at least ${rules.minNormalBiasTexels} shadow texels${texelWorld ? ` (${round(texelWorld * rules.minNormalBiasTexels)} world units)` : ''}, or add a small negative bias. Sharper shadow maps show the stripes more, so revisit the bias whenever the map size or frustum changes.`,
          value: {
            bias: light.bias,
            normalBias: light.normalBias,
            texelWorld: texelWorld === null ? null : round(texelWorld),
          },
        });
      if (light.frustum) {
        const width = light.frustum.right - light.frustum.left,
          height = light.frustum.top - light.frustum.bottom;
        const texel = Math.max(width / light.mapSize[0], height / light.mapSize[1]);
        const ratio = texel / pixel;
        measures.lights.push({ id: light.id, texelWorld: round(texel), texelPixels: round(ratio) });
        if (ratio > rules.maxTexelPixels)
          findings.push({
            rule: 'shadow-resolution',
            severity: 'warning',
            ids: [light.id],
            message: `One shadow-map texel of ${light.id} covers about ${round(ratio, 2)} screen pixels at the subject, so shadow edges will look stair-stepped. Fit the shadow camera to the visible area or raise mapSize (at most ${rules.maxTexelPixels} pixels per texel).`,
            value: { texelWorld: round(texel), pixelWorld: round(pixel), texelPixels: round(ratio) },
          });
        if (light.view) {
          // Only objects near what the camera looks at: a shadow focused on the subject leaves far objects out on purpose.
          const nearby = receivers.filter((m) => distance(centre(m.box), subject) < subjectDistance * 1.5);
          const outside = nearby.filter((m) => {
            const points = corners(m.box.min, m.box.max).map((p) => transform(light.view, p));
            return points.some(
              ([x, y, z]) =>
                x < light.frustum.left ||
                x > light.frustum.right ||
                y < light.frustum.bottom ||
                y > light.frustum.top ||
                -z < light.frustum.near ||
                -z > light.frustum.far,
            );
          });
          if (outside.length)
            findings.push({
              rule: 'shadow-coverage',
              severity: 'info',
              ids: [light.id, ...outside.slice(0, 8).map((m) => m.id)],
              message: `${outside.length} objects that receive ${light.id}'s shadows extend beyond its shadow camera, so their shadows can be cut off at the edge.`,
              value: outside.length,
            });
        }
      }
    }

  const ratio = camera.far / camera.near;
  measures.depthRatio = round(ratio);
  const step = depthStep(camera, subjectDistance, rules.depthBits);
  measures.depthStepAtSubject = round(step);
  if (!camera.logarithmicDepth && camera.kind === 'perspective' && ratio > rules.maxDepthRatio)
    findings.push({
      rule: 'depth-precision',
      severity: 'warning',
      ids: ['camera'],
      message: `The camera's far plane is ${round(ratio, 2)} times its near plane, so distant surfaces close together will flicker. Move near out, bring far in, or enable a logarithmic depth buffer.`,
      value: { near: camera.near, far: camera.far, depthStepAtSubject: round(step) },
    });

  // Flat opaque objects at nearly the same depth along their thin axis, overlapping across the other two.
  const flat = [];
  for (const m of solid) {
    const size = [0, 1, 2].map((k) => m.box.max[k] - m.box.min[k]);
    const largest = Math.max(...size);
    const axis = size.indexOf(Math.min(...size));
    if (largest > 0 && size[axis] <= largest * rules.flatness)
      flat.push({ m, axis, at: (m.box.min[axis] + m.box.max[axis]) / 2 });
  }
  const pairs = [];
  for (const axis of [0, 1, 2]) {
    const group = flat.filter((f) => f.axis === axis).sort((a, b) => a.at - b.at);
    for (let a = 0; a < group.length && pairs.length < 50; a++)
      for (let b = a + 1; b < group.length; b++) {
        const d = distance(camera.position, centre(group[a].m.box));
        const tolerance = Math.max(depthStep(camera, d, rules.depthBits) * rules.coplanarDepthSteps, 1e-6);
        if (group[b].at - group[a].at > tolerance) break;
        const others = [0, 1, 2].filter((k) => k !== axis);
        const overlap = others.every(
          (k) => group[a].m.box.min[k] < group[b].m.box.max[k] && group[b].m.box.min[k] < group[a].m.box.max[k],
        );
        if (overlap)
          pairs.push([
            group[a].m.id,
            group[b].m.id,
            round(group[b].at - group[a].at),
            group[a].m.color !== null && group[a].m.color === group[b].m.color,
          ]);
      }
  }
  for (const [a, b, gap, sameColour] of pairs)
    findings.push({
      rule: 'coplanar-surfaces',
      // Same-coloured surfaces fight invisibly except at their edges and under shading; still worth knowing.
      severity: sameColour ? 'info' : 'warning',
      ids: [a, b],
      message: `${a} and ${b} overlap at almost the same depth (${gap} apart), so they will flicker through each other. Separate them, merge them, or give one a polygon offset.`,
      value: gap,
    });

  const status = findings.some((f) => f.severity === 'error')
    ? 'fail'
    : findings.some((f) => f.severity === 'warning')
      ? 'warn'
      : 'pass';
  return { status, findings, measures };
}

// --- the pixels ---------------------------------------------------------------------------------------

/**
 * Find striped artefacts in a rendered image: tiles whose fine detail repeats regularly in one direction, as shadow
 * acne, moiré and aliased shadow edges do. `image` is {width, height, data} with 8-bit RGBA rows. A real striped
 * texture is flagged too; the finding says where to look, not what caused it. Returns {status, tiles, checked}.
 */
export function auditStripes(image, spec = {}) {
  assert(image && typeof image === 'object', 'INVALID_PIXEL_AUDIT', 'Pass an image {width, height, data}.');
  const width = number(image.width, 'image width', 8, 8192),
    height = number(image.height, 'image height', 8, 8192);
  assert(
    Number.isInteger(width) && Number.isInteger(height) && image.data?.length === width * height * 4,
    'INVALID_PIXEL_AUDIT',
    'Image data must hold width × height RGBA bytes.',
  );
  const tile = number(spec.tile ?? 32, 'tile size', 12, 128);
  const rules = { ...RENDER_3D, ...spec };
  const lum = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++)
    lum[i] = 0.2126 * image.data[i * 4] + 0.7152 * image.data[i * 4 + 1] + 0.0722 * image.data[i * 4 + 2];
  // High-pass: luminance minus its 5×5 box blur, so smooth shading and soft gradients drop out.
  const high = new Float32Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let sum = 0,
        n = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx,
            yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < width && yy < height) ((sum += lum[yy * width + xx]), n++);
        }
      high[y * width + x] = lum[y * width + x] - sum / n;
    }
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  const tiles = [];
  let checked = 0;
  for (let ty = 0; ty + tile <= height; ty += tile)
    for (let tx = 0; tx + tile <= width; tx += tile) {
      checked++;
      let energy = 0;
      for (let y = ty; y < ty + tile; y++) for (let x = tx; x < tx + tile; x++) energy += high[y * width + x] ** 2;
      const amplitude = Math.sqrt(energy / (tile * tile));
      if (amplitude < rules.stripeEnergy) continue;
      let best = { score: 0 };
      for (const [dx, dy] of directions)
        for (let lag = 2; lag <= 8; lag++) {
          // Correlation at `lag` steps, against correlation at half that lag: a periodic pattern correlates at its
          // period and anti-correlates near half of it; noise does neither.
          const corr = (k) => {
            let s = 0,
              n = 0;
            for (let y = ty; y < ty + tile; y++)
              for (let x = tx; x < tx + tile; x++) {
                const xx = x + dx * k,
                  yy = y + dy * k;
                if (xx < tx || yy < ty || xx >= tx + tile || yy >= ty + tile) continue;
                ((s += high[y * width + x] * high[yy * width + xx]), n++);
              }
            return n ? s / n / (energy / (tile * tile)) : 0;
          };
          const score = corr(lag) - corr(Math.round(lag / 2));
          if (score > best.score) best = { score, period: lag, direction: [dx, dy] };
        }
      if (best.score / 2 >= rules.stripeScore)
        tiles.push({
          x: tx,
          y: ty,
          width: tile,
          height: tile,
          score: round(best.score / 2, 2),
          period: best.period,
          direction: best.direction,
          amplitude: round(amplitude, 2),
        });
    }
  return { status: tiles.length >= rules.stripeTiles ? 'warn' : 'pass', tiles, checked };
}
