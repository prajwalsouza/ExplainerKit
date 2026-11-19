import { assert, number, options } from '../core/validate.js';
import { hsla, toRGBA } from '../color/space.js';
import { resolveWeather } from '../procedural/city/weather.js';
import { walkerPose, trafficState } from '../procedural/city/index.js';
import { cityGroundHeight, citySurfaceHeight } from '../procedural/city/terrain.js';
import {
  FRAG_FACADE,
  FRAG_GROUND,
  FRAG_HEAD,
  FRAG_LIGHTS,
  FRAG_ROOF,
  FRAG_SOLID,
  FRAG_WATER,
  HALO_FRAG,
  HALO_VERT,
  RAIN_FRAG,
  RAIN_VERT,
  SKY_FRAG,
  SKY_VERT,
  SNOW_FRAG,
  SNOW_VERT,
  VERT_BODY,
  VERT_PEOPLE,
  VERT_PEOPLE_NORMAL,
  DEPTH_HEAD,
  DEPTH_BODY,
  VERT_COLOR,
  VERT_HEAD,
} from './three-city-shaders.js';

// Cinematic streets in Three.js. `cityScene` turns a model from explainerkit/procedural/city
// into meshes, a shaded ground, water, a sky, lights, lamp halos, rain and snow, and applies a
// weather condition to all of them at once. Three is supplied by the caller and never imported
// here. Nothing is fetched. Every object created here is released by dispose().

const isThree = (T) =>
  T && typeof T.Mesh === 'function' && typeof T.BufferGeometry === 'function' && typeof T.ShaderMaterial === 'function';
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

export const pavingStyles = Object.freeze(['flags', 'clinker', 'setts', 'stone']);
const PAVING_FOR = Object.freeze({
  temperate: 'flags',
  brick: 'clinker',
  pastel: 'setts',
  mediterranean: 'stone',
  modern: 'flags',
});

/**
 * The quality ladder. Each step says how much is drawn and how far away detail survives.
 * Distances are metres from the camera: within `near` trees use their full model, `small` and
 * `medium` are where small and medium street objects stop being drawn, `fine` is how far
 * railings and other small building parts reach, `cover` how far grass and flowers reach and
 * `people` how far walkers are shown and `peopleNear` how far they keep their full figure. `reflection` scales the mirrored renders. 'draft' and
 * 'live' are meant for interactive pages, 'high' for strong machines and stills, and 'film' for
 * frames rendered one at a time, where speed does not matter.
 */
export const CITY_QUALITY = Object.freeze({
  draft: Object.freeze({
    skyRays: 0,
    traceSteps: 0,
    shadowMapSize: 1024,
    reflection: 0.35,
    near: 40,
    small: 60,
    medium: 140,
    fine: 80,
    cover: 0,
    people: 70,
    peopleNear: 14,
    rain: 5000,
    snow: 4000,
  }),
  live: Object.freeze({
    skyRays: 2,
    traceSteps: 8,
    shadowMapSize: 2048,
    reflection: 0.5,
    near: 75,
    small: 110,
    medium: 260,
    fine: 170,
    cover: 60,
    people: 140,
    peopleNear: 32,
    rain: 12000,
    snow: 8000,
  }),
  high: Object.freeze({
    skyRays: 4,
    traceSteps: 14,
    shadowMapSize: 4096,
    reflection: 0.75,
    near: 130,
    small: 220,
    medium: 520,
    fine: 340,
    cover: 120,
    people: 240,
    peopleNear: 70,
    rain: 20000,
    snow: 12000,
  }),
  film: Object.freeze({
    skyRays: 1,
    traceSteps: 24,
    shadowMapSize: 8192,
    reflection: 1,
    near: 320,
    small: 600,
    medium: 3000,
    fine: 1200,
    cover: 260,
    people: 800,
    peopleNear: 260,
    rain: 30000,
    snow: 18000,
  }),
});
export const cityQualities = Object.freeze(Object.keys(CITY_QUALITY));

/**
 * Build the Three.js objects for a city model.
 *
 * Options: `weather` (a condition or a name from `weatherNames`), `paving` (one of
 * `pavingStyles`; by default it follows the model's palette), `shadowMapSize` (512 to 8192),
 * `shadowRange` (half-width in metres of the area that receives sun shadows), `reflections`
 * (false turns off the mirrored renders that wet roads and water use), `rainCount` and
 * `snowCount` (how many streaks and flakes exist), and `apron` (metres of plain ground drawn
 * beyond the model).
 *
 * Add `object` to your scene, call `update({time, camera})` once per frame before rendering,
 * and `setWeather(condition)` whenever the weather changes.
 */
export function cityScene(T, city, spec = {}) {
  assert(isThree(T), 'INVALID_THREE', 'Pass the Three.js module namespace as the first argument.');
  assert(
    city?.meshes?.walls && city.field && Array.isArray(city.props),
    'INVALID_CITY',
    'Pass a model from buildCity.',
  );
  options(
    spec,
    [
      'weather',
      'quality',
      'lod',
      'paving',
      'shadowMapSize',
      'shadowRange',
      'reflections',
      'rainCount',
      'snowCount',
      'apron',
    ],
    'cityScene',
  );
  const qualityName = spec.quality ?? 'live';
  assert(Object.hasOwn(CITY_QUALITY, qualityName), 'INVALID_CITY', `quality is one of ${cityQualities.join(', ')}.`);
  const Q = { ...CITY_QUALITY[qualityName], ...(spec.lod ?? {}) };
  options(
    Q,
    [
      'skyRays',
      'traceSteps',
      'shadowMapSize',
      'reflection',
      'near',
      'small',
      'medium',
      'fine',
      'cover',
      'people',
      'peopleNear',
      'rain',
      'snow',
    ],
    'lod',
  );
  const paving = spec.paving ?? city.style?.paving ?? PAVING_FOR[city.palette] ?? 'flags';
  assert(pavingStyles.includes(paving), 'INVALID_CITY', `paving is one of ${pavingStyles.join(', ')}.`);
  const shadowMapSize = number(spec.shadowMapSize ?? Q.shadowMapSize, 'shadowMapSize', 512, 8192);
  const shadowRange = number(spec.shadowRange ?? 150, 'shadowRange', 20, 1500);
  const reflections = spec.reflections ?? true;
  const rainCount = Math.round(number(spec.rainCount ?? Q.rain, 'rainCount', 0, 60000));
  const snowCount = Math.round(number(spec.snowCount ?? Q.snow, 'snowCount', 0, 60000));
  const apron = number(
    spec.apron ?? (city.terrain ? (city.meshes.water?.vertexCount ? 0 : 12) : 500),
    'apron',
    0,
    5000,
  );

  const owned = [];
  const keep = (o) => {
    owned.push(o);
    return o;
  };
  const group = new T.Group();
  group.name = 'city';

  // -------------------------------------------------------------------- uniforms
  const field = city.field;
  const terrain = city.terrain;
  const groundHeight = (x, z) => cityGroundHeight(city, x, z);
  const roadHeight = (x, z, roadId) => citySurfaceHeight(city, x, z, roadId);
  const packed = packField(T, field);
  const bridgeField = city.bridgeField;
  const bridgePacked = bridgeField ? packField(T, bridgeField).map(keep) : null;
  const passage = city.underpass?.mask;
  const passageTexture = passage
    ? keep(new T.DataTexture(passage.values, passage.width, passage.height, T.RGBAFormat, T.FloatType))
    : null;
  if (passageTexture) passageTexture.needsUpdate = true;
  const traced = packLights(T, field, city.lights, terrain ? groundHeight : undefined);
  for (const t of [traced.height, traced.lamps, traced.grid]) keep(t);
  for (const t of packed) keep(t);
  const seasonalColor = (h, s, l) =>
    new T.Vector3(
      ...toRGBA(hsla(h, s, l))
        .slice(0, 3)
        .map(toLinear),
    );
  const U = {
    uTime: { value: 0 },
    uWet: { value: 0 },
    uPuddles: { value: 0 },
    uSnow: { value: 0 },
    uRain: { value: 0 },
    uLamps: { value: 0 },
    uWindows: { value: 0 },
    uSigns: { value: 0 },
    uCloudShadow: { value: 0 },
    uPaving: { value: pavingStyles.indexOf(paving) },
    uReflectOn: { value: 0 },
    uWaterOn: { value: 0 },
    uSunDir: { value: new T.Vector3(0.3, 0.8, 0.5).normalize() },
    uSunColor: { value: new T.Vector3(1, 1, 1) },
    uSkyZenith: { value: new T.Vector3(0.1, 0.2, 0.5) },
    uSkyHorizon: { value: new T.Vector3(0.5, 0.6, 0.8) },
    uFogTint: { value: new T.Vector3(0.6, 0.7, 0.8) },
    uLampColor: { value: new T.Vector3(1.0, 0.62, 0.28) },
    uWind: { value: new T.Vector3(1, 1, 0) },
    uMarkColor: {
      value: city.style?.centreLine === 'yellow' ? new T.Vector3(0.62, 0.42, 0.04) : new T.Vector3(0.62, 0.62, 0.58),
    },
    uFieldRect: { value: new T.Vector4(field.x0, field.y0, field.width * field.cell, field.height * field.cell) },
    uCloud: { value: new T.Vector4(0.3, 0.3, 0, 0) },
    uFieldA: { value: packed[0] },
    uFieldB: { value: packed[1] },
    uFieldC: { value: packed[2] },
    uFieldD: { value: packed[3] },
    uAutumnGrass: { value: seasonalColor(52, 36, 30) },
    uLeafOchre: { value: seasonalColor(43, 78, 52) },
    uLeafCopper: { value: seasonalColor(22, 73, 43) },
    uLeafBrown: { value: seasonalColor(32, 51, 29) },
    uPassage: { value: passageTexture },
    uPassageEnabled: { value: passage ? 1 : 0 },
    uPassageRect: {
      value: passage
        ? new T.Vector4(passage.x0, passage.z0, passage.width * passage.cell, passage.height * passage.cell)
        : new T.Vector4(0, 0, 1, 1),
    },
    uHeightMap: { value: traced.height },
    uLampData: { value: traced.lamps },
    uLampGrid: { value: traced.grid },
    uLampGridInfo: { value: new T.Vector4(traced.cols, traced.rows, traced.cellSize, city.lights.length) },
    uTraceSteps: { value: Q.traceSteps },
    uSkyRays: { value: Q.skyRays },
    uSample: { value: 0 },
    uHeadlights: { value: 0 },
    uBeamCount: { value: 0 },
    uBeamPos: { value: Array.from({ length: 16 }, () => new T.Vector4()) },
    uBeamDir: { value: Array.from({ length: 16 }, () => new T.Vector4(1, 0, 0, 0)) },
    uFieldCell: { value: field.cell },
    uReflect: { value: null },
    uReflectWater: { value: null },
    uReflectMatrix: { value: new T.Matrix4() },
    uReflectWaterMatrix: { value: new T.Matrix4() },
  };

  // ------------------------------------------------------------------- materials
  const cityMaterial = (define, surface, params = {}, people = false) => {
    const m = keep(new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, ...params }));
    const slope = terrain && (define === 'CITY_GROUND' || define === 'CITY_WATER' || define === 'CITY_BRIDGE');
    const autumn = city.season === 'autumn' && (define === 'CITY_GROUND' || define === 'CITY_BRIDGE');
    m.defines = {
      ...(m.defines ?? {}),
      [define]: 1,
      ...(people ? { CITY_PEOPLE: 1 } : {}),
      ...(slope ? { CITY_TERRAIN: 1 } : {}),
      ...(autumn ? { CITY_AUTUMN: 1 } : {}),
    };
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, U);
      if (define === 'CITY_BRIDGE' && bridgePacked) {
        const { x0, y0, width, height, cell } = bridgeField;
        Object.assign(shader.uniforms, {
          uFieldRect: { value: new T.Vector4(x0, y0, width * cell, height * cell) },
          uFieldCell: { value: cell },
          uFieldA: { value: bridgePacked[0] },
          uFieldB: { value: bridgePacked[1] },
          uFieldC: { value: bridgePacked[2] },
          uFieldD: { value: bridgePacked[3] },
        });
      }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${VERT_HEAD}${people ? VERT_PEOPLE : ''}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_BODY}`);
      // Figures are posed where normals are set up, so their lighting follows the pose.
      if (people)
        shader.vertexShader = shader.vertexShader.replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>\n${VERT_PEOPLE_NORMAL}`,
        );
      if (define === 'CITY_SOLID')
        shader.vertexShader = shader.vertexShader.replace(
          '#include <color_vertex>',
          `#include <color_vertex>\n${VERT_COLOR}`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${FRAG_HEAD}`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${surface}`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${FRAG_LIGHTS}`);
    };
    m.customProgramCacheKey = () =>
      `city-${define}${people ? '-people' : ''}${slope ? '-terrain' : ''}${autumn ? '-autumn' : ''}`;
    return m;
  };
  // Shadows of street objects are drawn with the same moving vertices as the objects, so a
  // walker's shadow walks, and leaves cast a broken shadow: light falls through the gaps in a
  // crown and dapples the ground, which a solid lump of shadow never does.
  const solidDepth = keep(new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, side: T.DoubleSide }));
  solidDepth.defines = { CITY_SOLID: 1 };
  solidDepth.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uTime: U.uTime, uWind: U.uWind, uSunDir: U.uSunDir });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_HEAD}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${DEPTH_HEAD}`)
      .replace('void main() {', `void main() {\n${DEPTH_BODY}`);
  };
  solidDepth.customProgramCacheKey = () => 'city-solid-depth';
  // The same for walking figures, which are posed joint by joint.
  const peopleDepth = keep(new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, side: T.DoubleSide }));
  peopleDepth.defines = { CITY_SOLID: 1, CITY_PEOPLE: 1, CITY_PEOPLE_DEPTH: 1 };
  peopleDepth.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uTime: U.uTime, uWind: U.uWind, uSunDir: U.uSunDir });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_HEAD}${VERT_PEOPLE}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${DEPTH_HEAD}`)
      .replace('void main() {', `void main() {\n${DEPTH_BODY}`);
  };
  peopleDepth.customProgramCacheKey = () => 'city-people-depth';
  const wallMaterial = cityMaterial('CITY_FACADE', FRAG_FACADE);
  const roofMaterial = cityMaterial('CITY_ROOF', FRAG_ROOF, { side: T.DoubleSide });
  const solidMaterial = cityMaterial('CITY_SOLID', FRAG_SOLID, { side: T.DoubleSide });
  const peopleMaterial = cityMaterial('CITY_SOLID', FRAG_SOLID, { side: T.DoubleSide }, true);
  const groundMaterial = cityMaterial('CITY_GROUND', FRAG_GROUND, { vertexColors: false });
  const waterMaterial = cityMaterial('CITY_WATER', FRAG_WATER, { vertexColors: false });

  // -------------------------------------------------------------------- geometry
  const geometryOf = (mesh, names) => {
    const g = keep(new T.BufferGeometry());
    g.setAttribute('position', new T.BufferAttribute(mesh.positions, 3));
    g.setAttribute('normal', new T.BufferAttribute(mesh.normals, 3));
    const colors = new Float32Array(mesh.colors.length);
    for (let i = 0; i < colors.length; i++) colors[i] = toLinear(mesh.colors[i]);
    g.setAttribute('color', new T.BufferAttribute(colors, 3));
    const stride = mesh.extraStride;
    names.forEach((name, k) => {
      const a = new Float32Array(mesh.vertexCount * 4);
      for (let i = 0; i < mesh.vertexCount; i++)
        for (let j = 0; j < 4; j++) a[i * 4 + j] = mesh.extra[i * stride + k * 4 + j];
      g.setAttribute(name, new T.BufferAttribute(a, 4));
    });
    g.setIndex(new T.BufferAttribute(mesh.indices, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  };
  const add = (geometry, material, cast = true, receive = true) => {
    const m = new T.Mesh(geometry, material);
    m.castShadow = cast;
    m.receiveShadow = receive;
    group.add(m);
    return m;
  };
  const walls = add(geometryOf(city.meshes.walls, ['fa', 'fb', 'fc']), wallMaterial);
  const roofs = add(geometryOf(city.meshes.roofs, ['roof']), roofMaterial);
  const trim = add(geometryOf(city.meshes.trim, ['surf']), solidMaterial);
  walls.name = 'city-walls';
  roofs.name = 'city-roofs';
  trim.name = 'city-trim';
  if (city.meshes.bridges) {
    const bridgeMaterial = cityMaterial('CITY_BRIDGE', FRAG_GROUND);
    add(geometryOf(city.meshes.bridges, []), bridgeMaterial).name = 'city-bridges';
  }
  if (city.meshes.underpasses) {
    const material = cityMaterial('CITY_SOLID', FRAG_SOLID, { side: T.DoubleSide, defines: { CITY_PASSAGE: 1 } });
    add(geometryOf(city.meshes.underpasses, ['surf']), material).name = 'city-underpasses';
  }

  // Small building parts, tile by tile, so distant tiles can be left out.
  const fineTiles = (city.fine ?? []).map((t) => {
    const m = add(geometryOf(t.mesh, ['surf']), solidMaterial);
    m.name = 'city-fine';
    return { mesh: m, x: t.x, z: t.z, radius: t.radius };
  });

  // Street objects: an instanced mesh per kind of object, plus a simpler one for far away
  // where the kit supplies it. Which objects are drawn, and with which model, is decided from
  // their distance to the camera each time the camera has moved a few metres.
  const dummy = new T.Object3D();
  const linearTint = (t, k) => [toLinear(t[k + 5]), toLinear(t[k + 6]), toLinear(t[k + 7])];
  const instanced = (geometry, count, cast, material = solidMaterial, depth = solidDepth) => {
    const mesh = new T.InstancedMesh(geometry, material, Math.max(1, count));
    mesh.instanceColor = new T.InstancedBufferAttribute(new Float32Array(Math.max(1, count) * 3), 3);
    mesh.count = 0;
    mesh.castShadow = cast;
    mesh.customDepthMaterial = depth;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
    keep(mesh);
    return mesh;
  };
  const matrixOf = (t, k, out, o) => {
    dummy.position.set(t[k], t[k + 1], t[k + 2]);
    dummy.rotation.set(0, t[k + 3], 0);
    dummy.scale.setScalar(t[k + 4]);
    dummy.updateMatrix();
    dummy.matrix.toArray(out, o);
  };
  let instances = 0;
  const props = city.props.map((p) => {
    const matrices = new Float32Array(p.count * 16),
      tints = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      matrixOf(p.transforms, i * 8, matrices, i * 16);
      tints.set(linearTint(p.transforms, i * 8), i * 3);
    }
    const cast = !p.name.startsWith('bike') && p.name !== 'cafeChair';
    const near = instanced(geometryOf(p.mesh, ['surf']), p.count, cast);
    near.name = `city-${p.name}`;
    const far = p.far ? instanced(geometryOf(p.far, ['surf']), p.count, cast) : null;
    instances += p.count;
    return {
      p,
      matrices,
      tints,
      near,
      far,
      reach: p.range === 'small' ? Q.small : p.range === 'medium' ? Q.medium : Infinity,
    };
  });
  const bucket = (cx, cz) => {
    for (const o of props) {
      const t = o.p.transforms;
      let n = 0,
        f = 0;
      for (let i = 0; i < o.p.count; i++) {
        const d = Math.hypot(t[i * 8] - cx, t[i * 8 + 2] - cz);
        if (d > o.reach) continue;
        const target = o.far && d > Q.near ? o.far : o.near;
        const slot = target === o.far ? f++ : n++;
        target.instanceMatrix.array.set(o.matrices.subarray(i * 16, i * 16 + 16), slot * 16);
        target.instanceColor.array.set(o.tints.subarray(i * 3, i * 3 + 3), slot * 3);
      }
      for (const [mesh, count] of [
        [o.near, n],
        [o.far, f],
      ]) {
        if (!mesh) continue;
        mesh.count = count;
        mesh.visible = count > 0;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.needsUpdate = true;
      }
    }
    for (const t of fineTiles) t.mesh.visible = Math.hypot(t.x - cx, t.z - cz) < Q.fine + t.radius;
    for (const t of coverTiles) t.mesh.visible = Q.cover > 0 && Math.hypot(t.x - cx, t.z - cz) < Q.cover + t.radius;
  };

  // Ground cover: one small instanced mesh per map tile and kind of plant.
  const coverGeometry = new Map();
  const coverTiles =
    Q.cover > 0
      ? (city.cover ?? []).map((t) => {
          if (!coverGeometry.has(t.name)) coverGeometry.set(t.name, geometryOf(city.coverMeshes[t.name], ['surf']));
          const mesh = new T.InstancedMesh(coverGeometry.get(t.name), solidMaterial, t.count);
          const colors = new Float32Array(t.count * 3);
          for (let i = 0; i < t.count; i++) {
            matrixOf(t.transforms, i * 8, mesh.instanceMatrix.array, i * 16);
            colors.set(linearTint(t.transforms, i * 8), i * 3);
          }
          mesh.instanceColor = new T.InstancedBufferAttribute(colors, 3);
          mesh.castShadow = false;
          mesh.receiveShadow = true;
          mesh.visible = false;
          mesh.computeBoundingSphere();
          mesh.name = 'city-cover';
          group.add(mesh);
          keep(mesh);
          return { mesh, x: t.x, z: t.z, radius: t.radius };
        })
      : [];

  // People: two instanced meshes per figure, the full one and a simpler one for far away,
  // moved along their routes every frame. Each walker carries its point in the stride, its
  // step, arm swing and lean, where its figure's joints are, and its own five colours.
  const crowd = (city.people?.count ?? 0) > 0 && Q.people > 0 ? city.people : null;
  const packTone = (c, k) =>
    Math.round(Math.min(1, Math.max(0, c[k])) * 255) +
    Math.round(Math.min(1, Math.max(0, c[k + 1])) * 255) * 256 +
    Math.round(Math.min(1, Math.max(0, c[k + 2])) * 255) * 65536;
  // Two signed 12-bit values fit exactly in one Float32 attribute component.
  // This keeps the figure inside WebGL's minimum vertex attribute budget.
  const gestureCode = (value) => Math.min(4095, Math.max(0, Math.round(value * 512) + 2048));
  const packGesture = (a, b) => gestureCode(a) + gestureCode(b) * 4096;
  const figures = crowd
    ? crowd.variants.map((mesh, v) => {
        const members = [];
        for (let i = 0; i < crowd.count; i++) if (crowd.walkers[i * 12 + 4] === v) members.push(i);
        const size = Math.max(1, members.length);
        const level = (source) => {
          const g = geometryOf(source, ['surf', 'bind']);
          for (const name of ['aLook', 'aRig', 'aTones', 'aAct'])
            g.setAttribute(name, new T.InstancedBufferAttribute(new Float32Array(size * 4), 4));
          const m = instanced(g, members.length, true, peopleMaterial, peopleDepth);
          m.name = 'city-people';
          return {
            mesh: m,
            look: g.getAttribute('aLook'),
            rig: g.getAttribute('aRig'),
            tones: g.getAttribute('aTones'),
            act: g.getAttribute('aAct'),
          };
        };
        const far = crowd.far?.[v];
        return { members, rig: crowd.rigs[v], near: level(mesh), far: far ? level(far) : null };
      })
    : [];
  // Traffic: one instanced mesh per vehicle model, moved to where the traffic plan puts each
  // vehicle at this time, with wheels turned by the distance driven.
  const fleet = city.traffic
    ? Object.entries(city.traffic.meshes).map(([name, mesh]) => {
        const units = [];
        city.traffic.plan.units.forEach((u, k) => {
          if (u.mesh === name) units.push(k);
        });
        const g = geometryOf(mesh, ['surf']);
        g.setAttribute('aPhase', new T.InstancedBufferAttribute(new Float32Array(Math.max(1, units.length)), 1));
        const m = instanced(g, units.length, true);
        m.name = 'city-traffic';
        return { mesh: m, units, spin: g.getAttribute('aPhase'), wheel: city.traffic.wheels[name] };
      })
    : [];
  const beams = [];
  const moveTraffic = (time, cx = 0, cz = 0) => {
    if (!fleet.length) return;
    beams.length = 0;
    const st = trafficState(city.traffic.plan, time);
    const vehicles = city.traffic.plan.vehicles,
      units = city.traffic.plan.units;
    for (const f of fleet) {
      let n = 0;
      for (const k of f.units) {
        if (!st.visible[k]) continue;
        const x = st.x[k],
          z = -st.y[k],
          turn = st.turn[k];
        const dx = Math.cos(turn),
          dz = -Math.sin(turn);
        const route = city.bridgeProfiles ? city.traffic.plan.edges[st.edge[k]] : null;
        const height = (atX, atZ) => (route ? roadHeight(atX, atZ, route.road) : groundHeight(atX, atZ));
        dummy.position.set(x, height(x, z), z);
        dummy.rotation.set(0, turn, 0);
        if (terrain) {
          const rise = height(x + dx, z + dz) - height(x - dx, z - dz);
          dummy.rotateZ(Math.atan2(rise, 2));
        }
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        dummy.matrix.toArray(f.mesh.instanceMatrix.array, n * 16);
        const paint = vehicles[units[k].vehicle].paint;
        f.mesh.instanceColor.array.set([toLinear(paint[0]), toLinear(paint[1]), toLinear(paint[2])], n * 3);
        f.spin.array[n] = st.travelled[k] / f.wheel;
        // Road vehicles and the leading tram section carry headlights.
        const kind = vehicles[units[k].vehicle].type;
        if (kind < 2 || (kind === 2 && units[k].offset > 0)) {
          const reach = (kind === 2 ? 4.6 : vehicles[units[k].vehicle].length / 2) - 0.1;
          const frontX = x + dx * reach,
            frontZ = z + dz * reach;
          beams.push({ x: frontX, y: height(frontX, frontZ), z: frontZ, dx, dz, d: Math.hypot(x - cx, z - cz) });
        }
        n++;
      }
      f.mesh.count = n;
      f.mesh.visible = n > 0;
      f.mesh.instanceMatrix.needsUpdate = true;
      f.mesh.instanceColor.needsUpdate = true;
      f.spin.needsUpdate = true;
    }
    // The sixteen sets of headlights nearest the camera light the scene.
    beams.sort((a, b) => a.d - b.d);
    const count = Math.min(16, beams.length);
    for (let i = 0; i < count; i++) {
      const b = beams[i];
      U.uBeamPos.value[i].set(b.x, 0.68 + b.y, b.z, 17);
      // Dipped: aimed a little below level.
      const tilt = 0.07;
      U.uBeamDir.value[i].set(b.dx * (1 - tilt * tilt), -tilt, b.dz * (1 - tilt * tilt), 0);
    }
    U.uBeamCount.value = count;
  };
  const movePeople = (time, cx, cz) => {
    const w = crowd?.walkers,
      tones = crowd?.colors,
      motion = crowd?.motion;
    for (const f of figures) {
      let near = 0,
        far = 0;
      for (const i of f.members) {
        const pose = walkerPose(city, i, time);
        const d = Math.hypot(pose.x - cx, pose.z - cz);
        if (d > Q.people) continue;
        const level = f.far && d > Q.peopleNear ? f.far : f.near,
          n = level === f.far ? far++ : near++,
          k = i * 12;
        dummy.position.set(pose.x, pose.y, pose.z);
        dummy.rotation.set(0, pose.turn, 0);
        dummy.scale.setScalar(w[k + 5]);
        dummy.updateMatrix();
        dummy.matrix.toArray(level.mesh.instanceMatrix.array, n * 16);
        level.mesh.instanceColor.array.set([toLinear(w[k + 9]), toLinear(w[k + 10]), toLinear(w[k + 11])], n * 3);
        level.look.array.set([pose.phase % (2 * Math.PI), pose.step, motion[k + 1], motion[k + 2]], n * 4);
        level.rig.array.set([f.rig.hip, f.rig.knee, f.rig.shoulder, f.rig.elbow], n * 4);
        // Talking, waiting and looking: the arms' gestures and where the head turns.
        const g = pose.arms,
          h = pose.head;
        level.act.array.set(
          [packGesture(g[2], g[5]), packGesture(h[0], h[1]), packGesture(g[0], g[1]), packGesture(g[3], g[4])],
          n * 4,
        );
        const c = i * 15;
        level.tones.array.set(
          [packTone(tones, c + 3), packTone(tones, c + 6), packTone(tones, c + 9), packTone(tones, c + 12)],
          n * 4,
        );
      }
      for (const [level, count] of [
        [f.near, near],
        [f.far, far],
      ]) {
        if (!level) continue;
        level.mesh.count = count;
        level.mesh.visible = count > 0;
        level.mesh.instanceMatrix.needsUpdate = true;
        level.mesh.instanceColor.needsUpdate = true;
        level.look.needsUpdate = true;
        level.rig.needsUpdate = true;
        level.tones.needsUpdate = true;
        level.act.needsUpdate = true;
      }
    }
  };

  // Ground follows the DEM. Mapped bodies of water each have their own level.
  const b = city.bounds;
  const plane = (y) => {
    const g = keep(new T.BufferGeometry());
    const x0 = b.x0 - apron,
      x1 = b.x1 + apron,
      z0 = b.z0 - apron,
      z1 = b.z1 + apron;
    g.setAttribute(
      'position',
      new T.BufferAttribute(new Float32Array([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z0]), 3),
    );
    g.setAttribute('normal', new T.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeBoundingSphere();
    return g;
  };
  const surfaceGeometry = (level) => {
    if (!terrain) return plane(level);
    const g = keep(new T.BufferGeometry());
    const axis = (low, high, samples, start, end) => {
      const steps = [start];
      for (let i = 0; i < samples; i++) {
        const point = low + ((high - low) * i) / (samples - 1);
        if (point > start && point < end) steps.push(point);
      }
      steps.push(end);
      return steps;
    };
    const t = terrain.bounds;
    const xs = axis(t.x0, t.x1, terrain.columns, b.x0 - apron, b.x1 + apron);
    const zs = axis(-t.y1, -t.y0, terrain.rows, b.z0 - apron, b.z1 + apron);
    const columns = xs.length,
      rows = zs.length;
    const position = new Float32Array(columns * rows * 3);
    const indices = new Uint32Array((columns - 1) * (rows - 1) * 6);
    let at = 0;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < columns; i++) {
        const x = xs[i],
          z = zs[j],
          v = j * columns + i;
        position.set([x, groundHeight(x, z) + level, z], v * 3);
        if (j < rows - 1 && i < columns - 1) {
          indices.set([v, v + columns, v + 1, v + 1, v + columns, v + columns + 1], at);
          at += 6;
        }
      }
    g.setAttribute('position', new T.BufferAttribute(position, 3));
    g.setIndex(new T.BufferAttribute(indices, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  };
  const ground = add(surfaceGeometry(0), groundMaterial, false, true);
  ground.name = 'city-ground';
  const waterMesh = city.meshes.water;
  const hasWater = waterMesh ? waterMesh.vertexCount > 0 : field.water.some((v) => v < 0);
  const water = add(waterMesh ? geometryOf(waterMesh, []) : plane(city.waterLevel), waterMaterial, false, true);
  water.name = 'city-water';
  water.visible = hasWater;
  if (city.meshes.waterBank)
    add(geometryOf(city.meshes.waterBank, ['surf']), solidMaterial, false).name = 'city-shoreline';

  // ------------------------------------------------------------------------- sky
  const skyMaterial = keep(
    new T.ShaderMaterial({
      uniforms: {
        uSkyZenith: U.uSkyZenith,
        uSkyHorizon: U.uSkyHorizon,
        uSunDir: U.uSunDir,
        uSunColor: U.uSunColor,
        uFogTint: U.uFogTint,
        uCloud: U.uCloud,
        uTime: U.uTime,
        uGlow: { value: 0.5 },
        uStars: { value: 0 },
        uDark: { value: 0.3 },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: T.BackSide,
      depthWrite: false,
      depthTest: true,
      fog: false,
    }),
  );
  const sky = new T.Mesh(keep(new T.SphereGeometry(1, 32, 16)), skyMaterial);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  sky.name = 'city-sky';
  group.add(sky);

  // ---------------------------------------------------------------------- lights
  const sun = new T.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.06;
  const hemi = new T.HemisphereLight(0xffffff, 0x444444, 1);
  group.add(sun, sun.target, hemi);
  const fog = new T.FogExp2(0xffffff, 0.001);

  // Lamp halos: one soft point per lamp head.
  const haloGeometry = keep(new T.BufferGeometry());
  const haloPositions = new Float32Array(city.lights.length * 3),
    haloSizes = new Float32Array(city.lights.length);
  city.lights.forEach((l, i) => {
    haloPositions.set([l.x, l.y, l.z], i * 3);
    haloSizes[i] = l.kind === 'underpass' ? 0.3 : l.kind === 'bollard' ? 0.5 : l.kind === 'globe' ? 1.0 : 1.25;
  });
  haloGeometry.setAttribute('position', new T.BufferAttribute(haloPositions, 3));
  haloGeometry.setAttribute('aSize', new T.BufferAttribute(haloSizes, 1));
  const haloMaterial = keep(
    new T.ShaderMaterial({
      uniforms: { uLampColor: U.uLampColor, uLamps: U.uLamps, uScale: { value: 600 }, uHaze: { value: 0 } },
      vertexShader: HALO_VERT,
      fragmentShader: HALO_FRAG,
      blending: T.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      fog: false,
    }),
  );
  const halos = new T.Points(haloGeometry, haloMaterial);
  halos.frustumCulled = false;
  halos.name = 'city-halos';
  halos.renderOrder = 5;
  group.add(halos);

  // --------------------------------------------------------------- rain and snow
  const seeds = (count, perItem) => {
    const a = new Float32Array(count * perItem * 4);
    let s = 0x2545f491 ^ (city.seed ?? 1);
    const rand = () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return ((s >>> 0) % 1000003) / 1000003;
    };
    for (let i = 0; i < count; i++) {
      const x = rand(),
        y = rand(),
        z = rand();
      for (let k = 0; k < perItem; k++) a.set([x, y, z, perItem === 2 ? k : rand()], (i * perItem + k) * 4);
    }
    return a;
  };
  const box = new T.Vector3(44, 26, 44);
  const fallUniforms = () => ({
    uTime: U.uTime,
    uCenter: { value: new T.Vector3() },
    uFall: { value: new T.Vector3(0, -9, 0) },
    uBox: { value: box },
    uColor: { value: new T.Vector3(1, 1, 1) },
  });
  const rainGeometry = keep(new T.BufferGeometry());
  rainGeometry.setAttribute('aSeed', new T.BufferAttribute(seeds(rainCount, 2), 4));
  rainGeometry.setAttribute('position', new T.BufferAttribute(new Float32Array(rainCount * 6), 3));
  const rainMaterial = keep(
    new T.ShaderMaterial({
      uniforms: { ...fallUniforms(), uRain: U.uRain },
      vertexShader: RAIN_VERT,
      fragmentShader: RAIN_FRAG,
      transparent: true,
      depthWrite: false,
      blending: T.NormalBlending,
      fog: false,
    }),
  );
  const rain = new T.LineSegments(rainGeometry, rainMaterial);
  rain.frustumCulled = false;
  rain.visible = false;
  rain.renderOrder = 8;
  const snowGeometry = keep(new T.BufferGeometry());
  snowGeometry.setAttribute('aSeed', new T.BufferAttribute(seeds(snowCount, 1), 4));
  snowGeometry.setAttribute('position', new T.BufferAttribute(new Float32Array(snowCount * 3), 3));
  const snowMaterial = keep(
    new T.ShaderMaterial({
      uniforms: { ...fallUniforms(), uSnowfall: { value: 0 }, uScale: { value: 600 } },
      vertexShader: SNOW_VERT,
      fragmentShader: SNOW_FRAG,
      transparent: true,
      depthWrite: false,
      fog: false,
    }),
  );
  const snow = new T.Points(snowGeometry, snowMaterial);
  snow.frustumCulled = false;
  snow.visible = false;
  snow.renderOrder = 8;
  group.add(rain, snow);

  // ------------------------------------------------------------------ reflections
  // Wet roads and water show the street upside down. Each is rendered from a camera mirrored
  // in its plane, just before the surface itself is drawn, and only when it is needed.
  const mirrorCamera = new T.PerspectiveCamera();
  const mirror = { target: null, waterTarget: null, key: '', waterKey: '', busy: false, version: 0 };
  const clip = new T.Plane(new T.Vector3(0, 1, 0), 0);
  const tmp = {
    p: new T.Vector3(),
    look: new T.Vector3(),
    up: new T.Vector3(),
    m: new T.Matrix4(),
    size: new T.Vector2(),
  };
  const makeTarget = (w, h, mips) => {
    const t = new T.WebGLRenderTarget(Math.max(8, w), Math.max(8, h), {
      type: T.HalfFloatType,
      depthBuffer: true,
      generateMipmaps: mips,
      minFilter: mips ? T.LinearMipmapLinearFilter : T.LinearFilter,
      magFilter: T.LinearFilter,
    });
    return t;
  };
  const renderMirror = (renderer, scene, camera, height, which) => {
    const current = renderer.getRenderTarget();
    const w = current ? current.width : renderer.getDrawingBufferSize(tmp.size).x,
      h = current ? current.height : renderer.getDrawingBufferSize(tmp.size).y;
    const tw = Math.round(w * Q.reflection),
      th = Math.round(h * Q.reflection);
    const slot = which === 'ground' ? 'target' : 'waterTarget';
    if (!mirror[slot] || mirror[slot].width !== tw || mirror[slot].height !== th) {
      mirror[slot]?.dispose();
      mirror[slot] = makeTarget(tw, th, which === 'ground');
    }
    // The camera mirrored in the plane y = height.
    camera.updateMatrixWorld();
    tmp.p.setFromMatrixPosition(camera.matrixWorld);
    tmp.look.set(0, 0, -1).applyMatrix4(camera.matrixWorld);
    tmp.up.set(0, 1, 0).transformDirection(camera.matrixWorld);
    mirrorCamera.position.set(tmp.p.x, 2 * height - tmp.p.y, tmp.p.z);
    mirrorCamera.up.set(tmp.up.x, -tmp.up.y, tmp.up.z);
    mirrorCamera.lookAt(tmp.look.x, 2 * height - tmp.look.y, tmp.look.z);
    mirrorCamera.near = camera.near;
    mirrorCamera.far = camera.far;
    mirrorCamera.updateMatrixWorld();
    mirrorCamera.matrixWorldInverse.copy(mirrorCamera.matrixWorld).invert();
    mirrorCamera.projectionMatrix.copy(camera.projectionMatrix);
    mirrorCamera.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    const matrix = which === 'ground' ? U.uReflectMatrix.value : U.uReflectWaterMatrix.value;
    matrix.copy(mirrorCamera.projectionMatrix).multiply(mirrorCamera.matrixWorldInverse);
    // Cut away everything below the mirror by tilting the camera's near plane onto it (an
    // oblique frustum). Nothing under the road or the water can then show in its reflection.
    clip.set(tmp.up.set(0, 1, 0), -height + 0.02).applyMatrix4(mirrorCamera.matrixWorldInverse);
    const e = mirrorCamera.projectionMatrix.elements;
    const qx = (Math.sign(clip.normal.x) + e[8]) / e[0],
      qy = (Math.sign(clip.normal.y) + e[9]) / e[5],
      qw = (1 + e[10]) / e[14];
    const scale = 2 / (clip.normal.x * qx + clip.normal.y * qy - clip.normal.z + clip.constant * qw);
    e[2] = clip.normal.x * scale;
    e[6] = clip.normal.y * scale;
    e[10] = clip.normal.z * scale + 1;
    e[14] = clip.constant * scale;
    mirrorCamera.projectionMatrixInverse.copy(mirrorCamera.projectionMatrix).invert();
    // Skip the render when nothing it depends on has changed.
    const key = `${mirror.version}|${U.uTime.value}|${tw}x${th}|${Array.from(camera.matrixWorld.elements, (v) => v.toFixed(4)).join(',')}`;
    const keySlot = which === 'ground' ? 'key' : 'waterKey';
    if (mirror[keySlot] === key) return;
    mirror[keySlot] = key;
    const saved = {
      xr: renderer.xr.enabled,
      shadow: renderer.shadowMap.autoUpdate,
      ground: ground.visible,
      water: water.visible,
      rain: rain.visible,
      snow: snow.visible,
    };
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;
    ground.visible = false;
    water.visible = false;
    rain.visible = false;
    snow.visible = false;
    mirror.busy = true;
    try {
      renderer.setRenderTarget(mirror[slot]);
      renderer.clear();
      renderer.render(scene, mirrorCamera);
    } finally {
      mirror.busy = false;
      renderer.xr.enabled = saved.xr;
      renderer.shadowMap.autoUpdate = saved.shadow;
      ground.visible = saved.ground;
      water.visible = saved.water;
      rain.visible = saved.rain;
      snow.visible = saved.snow;
      renderer.setRenderTarget(current);
    }
  };
  ground.onBeforeRender = (renderer, scene, camera) => {
    if (mirror.busy || !reflections || terrain || U.uWet.value < 0.03 || camera.isOrthographicCamera) {
      if (!mirror.busy) U.uReflectOn.value = 0;
      return;
    }
    renderMirror(renderer, scene, camera, 0, 'ground');
    U.uReflect.value = mirror.target.texture;
    U.uReflectOn.value = 1;
  };
  water.onBeforeRender = (renderer, scene, camera) => {
    if (mirror.busy || !reflections || terrain || camera.isOrthographicCamera) {
      if (!mirror.busy) U.uWaterOn.value = 0;
      return;
    }
    renderMirror(renderer, scene, camera, city.waterLevel, 'water');
    U.uReflectWater.value = mirror.waterTarget.texture;
    U.uWaterOn.value = 1;
  };

  // --------------------------------------------------------------------- weather
  let weather = null;
  const focus = new T.Vector3();
  const bucketAt = { x: Infinity, z: Infinity };
  const last = { time: 0, camera: null };
  const forward = new T.Vector3();
  let disposed = false;
  const api = {
    object: group,
    /** The fog for your scene: assign it to `scene.fog`. Its colour and density follow the weather. */
    fog,
    sun,
    ambient: hemi,
    get weather() {
      return weather;
    },
    stats: Object.freeze({
      triangles: city.stats.triangles,
      instances,
      lamps: city.lights.length,
      plants: city.stats.plants ?? 0,
      people: crowd ? crowd.count : 0,
    }),
    quality: qualityName,
    /** Apply a condition from explainerkit/procedural/city: a name, a condition or a blend. */
    setWeather(condition) {
      assert(!disposed, 'DISPOSED', 'This city scene was disposed.');
      const w = resolveWeather(condition);
      weather = w;
      mirror.version++;
      const d = w.sun.direction;
      U.uSunDir.value.set(d[0], d[1], d[2]).normalize();
      // Below the horizon the sun lights nothing, and its shadows fade out before it sets.
      const above = Math.min(1, Math.max(0, (w.sun.elevation + 1) / 6));
      const power = w.sun.intensity * above;
      U.uSunColor.value.set(
        w.sun.color[0] * w.sun.intensity,
        w.sun.color[1] * w.sun.intensity,
        w.sun.color[2] * w.sun.intensity,
      );
      sun.color.setRGB(w.sun.color[0], w.sun.color[1], w.sun.color[2]);
      sun.intensity = power;
      sun.castShadow = power > 0.02 && w.shadow > 0.05;
      hemi.color.setRGB(...w.ambient.sky);
      hemi.groundColor.setRGB(...w.ambient.ground);
      hemi.intensity = w.ambient.intensity;
      U.uSkyZenith.value.set(...w.sky.zenith);
      U.uSkyHorizon.value.set(...w.sky.horizon);
      U.uFogTint.value.set(...w.fog.color);
      fog.color.setRGB(...w.fog.color);
      // Three's squared-exponential fog loses 1 - exp(-(k d)^2); the condition gives (k * 100)^2.
      fog.density = Math.sqrt(w.fog.density) / 100;
      U.uCloud.value.x = w.clouds.cover;
      U.uCloud.value.y = w.clouds.dark;
      U.uCloudShadow.value = 0.55 * w.shadow * Math.min(1, Math.max(0, (0.95 - w.clouds.cover) / 0.5)) * above;
      U.uWet.value = w.wet;
      U.uPuddles.value = w.puddles;
      U.uSnow.value = w.snow;
      U.uRain.value = w.rain;
      U.uLamps.value = w.lamps;
      U.uWindows.value = w.windows;
      U.uSigns.value = w.signs;
      U.uHeadlights.value = Math.min(1, Math.max(w.lamps, w.rain * 0.9, w.fog.density * 0.5, w.snowfall * 0.8));
      skyMaterial.uniforms.uGlow.value = w.sky.glow;
      skyMaterial.uniforms.uStars.value = w.stars;
      skyMaterial.uniforms.uDark.value = w.clouds.dark;
      haloMaterial.uniforms.uHaze.value = Math.min(1.5, w.fog.density * 0.6 + w.rain * 0.35 + w.snowfall * 0.3);
      // Wind blows from the west by default; its strength bends rain and drives the clouds.
      U.uWind.value.set(w.wind, Math.min(1, w.wind / 6), w.wind * 0.35);
      rain.visible = w.rain > 0.01 && rainCount > 0;
      rainMaterial.uniforms.uFall.value.set(w.wind * 0.55, -9.5, w.wind * 0.2);
      const light = [0, 1, 2].map(
        (i) =>
          w.ambient.sky[i] * w.ambient.intensity * 0.5 +
          w.sun.color[i] * power * 0.1 +
          [1.0, 0.62, 0.28][i] * w.lamps * 0.07,
      );
      rainMaterial.uniforms.uColor.value.set(light[0] * 0.9, light[1] * 0.95, light[2]);
      snow.visible = w.snowfall > 0.01 && snowCount > 0;
      snowMaterial.uniforms.uSnowfall.value = w.snowfall;
      snowMaterial.uniforms.uFall.value.set(w.wind * 0.5, -1.25, w.wind * 0.18);
      snowMaterial.uniforms.uColor.value.set(light[0] * 1.5 + 0.02, light[1] * 1.5 + 0.02, light[2] * 1.5 + 0.02);
      api.cloudSpeed = w.clouds.speed;
      return api;
    },
    cloudSpeed: 1,
    /**
     * Advance the scene to a time in seconds and follow a camera: the sky, the sun's shadow
     * area, the rain and the snow all stay centred on what the camera sees.
     */
    update(s = {}) {
      assert(!disposed, 'DISPOSED', 'This city scene was disposed.');
      options(s, ['time', 'camera', 'height'], 'update');
      const time = number(s.time ?? 0, 'time', -1e6, 1e6);
      U.uTime.value = time;
      U.uCloud.value.z = time * 0.004 * api.cloudSpeed;
      U.uCloud.value.w = time * 0.0016 * api.cloudSpeed;
      const camera = s.camera;
      if (!camera) return api;
      camera.updateMatrixWorld();
      const p = tmp.p.setFromMatrixPosition(camera.matrixWorld);
      last.time = time;
      last.camera = camera;
      // Re-sort objects into near, far and not drawn once the camera has moved a little.
      if (Math.hypot(p.x - bucketAt.x, p.z - bucketAt.z) > 5) {
        bucketAt.x = p.x;
        bucketAt.z = p.z;
        bucket(p.x, p.z);
      }
      movePeople(time, p.x, p.z);
      moveTraffic(time, p.x, p.z);
      sky.position.copy(p);
      sky.scale.setScalar(Math.max(10, camera.far * 0.9));
      forward.set(0, 0, -1).transformDirection(camera.matrixWorld);
      // Where the view meets the ground, or a point ahead when it looks at the horizon.
      const aboveGround = p.y - groundHeight(p.x, p.z);
      const reach = forward.y < -0.03 ? Math.min(shadowRange * 0.9, aboveGround / -forward.y) : shadowRange * 0.6;
      focus.copy(p).addScaledVector(forward, reach);
      focus.y = groundHeight(focus.x, focus.z);
      // Snap the shadow area to whole texels so shadow edges do not crawl as the camera moves.
      const texel = (shadowRange * 2) / shadowMapSize;
      focus.x = Math.round(focus.x / texel) * texel;
      focus.z = Math.round(focus.z / texel) * texel;
      const dir = U.uSunDir.value;
      sun.position.set(focus.x + dir.x * 600, focus.y + Math.max(dir.y, 0.05) * 600, focus.z + dir.z * 600);
      sun.target.position.copy(focus);
      const c = sun.shadow.camera;
      const stretch = 1 / Math.max(0.2, dir.y);
      c.left = -shadowRange;
      c.right = shadowRange;
      c.top = shadowRange * Math.min(3, stretch);
      c.bottom = -shadowRange * Math.min(3, stretch);
      c.near = 10;
      c.far = 1400;
      c.updateProjectionMatrix();
      const scale = (s.height ?? 1080) / (2 * Math.tan(((camera.fov ?? 40) * Math.PI) / 360));
      haloMaterial.uniforms.uScale.value = scale;
      snowMaterial.uniforms.uScale.value = scale;
      const centre = tmp.look.copy(p).addScaledVector(forward, box.x * 0.3);
      rainMaterial.uniforms.uCenter.value.copy(centre);
      snowMaterial.uniforms.uCenter.value.copy(centre);
      return api;
    },
    /**
     * For frames averaged from many renders: call this from the post chain's `onSample` with
     * the sample index and count. Each sample then sees the sun from a slightly different point
     * on its disc and the scene at a slightly different moment, and the average has soft-edged
     * shadows and motion blur. `sunSize` is the angular radius of the light in degrees and
     * `shutter` the exposure time in seconds; pass 0 to leave either out.
     */
    filmSample(index, count, s = {}) {
      options(s, ['sunSize', 'shutter'], 'filmSample');
      const sunSize = (number(s.sunSize ?? 1.1, 'sunSize', 0, 10) * Math.PI) / 180,
        shutter = number(s.shutter ?? 1 / 48, 'shutter', 0, 1);
      // A low-discrepancy pair for the disc, and an even spread across the shutter.
      const u = (index + 0.5) / Math.max(1, count),
        v = (index * 0.61803398875) % 1;
      const r = Math.sqrt(v) * Math.tan(sunSize),
        a = u * Math.PI * 2 * 7;
      const dir = U.uSunDir.value;
      tmp.up.set(-dir.z, 0, dir.x).normalize();
      tmp.look.crossVectors(dir, tmp.up).normalize();
      const jx = dir.x + (tmp.up.x * Math.cos(a) + tmp.look.x * Math.sin(a)) * r,
        jy = dir.y + (tmp.up.y * Math.cos(a) + tmp.look.y * Math.sin(a)) * r,
        jz = dir.z + (tmp.up.z * Math.cos(a) + tmp.look.z * Math.sin(a)) * r;
      sun.position.set(focus.x + jx * 600, focus.y + Math.max(jy, 0.05) * 600, focus.z + jz * 600);
      const time = last.time + (u - 0.5) * shutter;
      U.uSample.value = index + 1;
      U.uTime.value = time;
      if (last.camera) {
        const p = tmp.p.setFromMatrixPosition(last.camera.matrixWorld);
        movePeople(time, p.x, p.z);
        moveTraffic(time, p.x, p.z);
      }
      return api;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      ground.onBeforeRender = () => {};
      water.onBeforeRender = () => {};
      mirror.target?.dispose();
      mirror.waterTarget?.dispose();
      sun.shadow.map?.dispose();
      for (const o of owned) o.dispose?.();
      group.clear();
    },
  };
  api.setWeather(spec.weather ?? 'clear');
  return api;
}

/**
 * A lens for the miniature look: one sharp band across the frame, with the picture blurring
 * above and below it, as a tilt-shift lens renders a real street to look like a model. Pass
 * the result as `lens` to `cinematicPost`.
 *
 * `amount` runs from 0 (no blur) to 1 (strong); `center` is where the sharp band sits, from 0
 * at the top of the frame to 1 at the bottom; `width` is the height of the sharp band as a
 * share of the frame; `angle` tilts the band in degrees; `bloom` is the glow round bright
 * things, from 0 to 1.
 */
export function dioramaLens(spec = {}) {
  options(spec, ['amount', 'center', 'width', 'angle', 'bloom'], 'dioramaLens');
  const amount = number(spec.amount ?? 0.6, 'amount', 0, 1),
    center = number(spec.center ?? 0.52, 'center', 0, 1),
    width = number(spec.width ?? 0.3, 'width', 0.02, 1),
    angle = number(spec.angle ?? 0, 'angle', -90, 90),
    bloom = number(spec.bloom ?? 0.35, 'bloom', 0, 1);
  return {
    interactive: {
      kind: 'band',
      center,
      halfWidth: width / 2,
      falloff: 0.18 + 0.3 * (1 - amount),
      maxBlur: 0.011 * amount,
      angleDeg: angle,
    },
    bloom: { threshold: 1.1, strength: bloom },
  };
}

/**
 * Aim a camera for one sample of a thin lens. The camera moves to a point on a disc of radius
 * `aperture` metres round `position` and turns so that the point `focus` metres along the view
 * stays where it was. Averaged over many samples, things at the focus distance stay sharp and
 * everything nearer or farther blurs, as through a real lens. Call it from the post chain's
 * `onSample`; pass index -1 to put the camera back.
 */
export function thinLens(camera, view, index, count) {
  options(view, ['position', 'target', 'focus', 'aperture'], 'thinLens');
  const [px, py, pz] = view.position,
    [tx, ty, tz] = view.target;
  let dx = tx - px,
    dy = ty - py,
    dz = tz - pz;
  const l = Math.hypot(dx, dy, dz) || 1;
  dx /= l;
  dy /= l;
  dz /= l;
  const focus = number(view.focus ?? l, 'focus', 0.1, 1e5),
    aperture = number(view.aperture ?? 0.03, 'aperture', 0, 5);
  if (index < 0 || aperture === 0) {
    camera.position.set(px, py, pz);
    camera.lookAt(tx, ty, tz);
    return camera;
  }
  // Right and up of the view, then a point on the lens disc from a golden-angle spiral.
  let rx = -dz,
    rz = dx;
  const rl = Math.hypot(rx, rz) || 1;
  rx /= rl;
  rz /= rl;
  const ux = -rz * dy,
    uy = rz * dx - rx * dz,
    uz = rx * dy;
  const r = Math.sqrt((index + 0.5) / Math.max(1, count)) * aperture,
    a = index * 2.39996323;
  const ox = Math.cos(a) * r,
    oy = Math.sin(a) * r;
  camera.position.set(px + rx * ox + ux * oy, py + uy * oy, pz + rz * ox + uz * oy);
  camera.lookAt(px + dx * focus, py + dy * focus, pz + dz * focus);
  return camera;
}

// The street field as four half-float textures. Distances along a road are stored as the sine
// and cosine of a 9 m cycle, which stays exact where plain metres would lose precision.
function packField(T, f) {
  const n = f.width * f.height;
  const half = T.DataUtils.toHalfFloat;
  const clampHalf = (v) => half(Math.max(-1000, Math.min(1000, v)));
  const make = (fill) => {
    const data = new Uint16Array(n * 4);
    for (let i = 0; i < n; i++) fill(i, data, i * 4);
    const t = new T.DataTexture(data, f.width, f.height, T.RGBAFormat, T.HalfFloatType);
    t.magFilter = T.LinearFilter;
    t.minFilter = T.LinearFilter;
    t.wrapS = T.ClampToEdgeWrapping;
    t.wrapT = T.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  };
  const k = (Math.PI * 2) / 9;
  return [
    make((i, d, o) => {
      d[o] = clampHalf(f.edge[i]);
      d[o + 1] = clampHalf(f.centre[i]);
      d[o + 2] = half(Math.cos(f.along[i] * k));
      d[o + 3] = half(Math.sin(f.along[i] * k));
    }),
    make((i, d, o) => {
      d[o] = clampHalf(f.foot[i]);
      d[o + 1] = clampHalf(f.water[i]);
      d[o + 2] = clampHalf(f.green[i]);
      d[o + 3] = clampHalf(f.wall[i]);
    }),
    make((i, d, o) => {
      d[o] = clampHalf(f.half[i]);
      d[o + 1] = clampHalf(f.lanes[i]);
      d[o + 2] = clampHalf(f.junction[i]);
      d[o + 3] = clampHalf(f.zebra[i]);
    }),
    make((i, d, o) => {
      d[o] = clampHalf(f.footKind[i]);
      d[o + 1] = clampHalf(f.bridge[i]);
      d[o + 2] = clampHalf(f.leaves?.[i] ?? 0);
      d[o + 3] = clampHalf(f.greenKind[i]);
    }),
  ];
}

// What the traced light needs: roof heights as a texture, every lamp as a row of numbers, and a
// coarse grid that lists the lamps near each cell, so a pixel looks at a handful of lamps
// rather than at all of them.
function packLights(T, f, lights, groundHeight) {
  const n = f.width * f.height;
  const heights = new Uint16Array(n);
  const source = f.roof;
  for (let i = 0; i < n; i++) {
    const roof = source ? Math.min(1000, source[i]) : 0;
    const x = f.x0 + ((i % f.width) + 0.5) * f.cell;
    const z = -(f.y0 + (Math.floor(i / f.width) + 0.5) * f.cell);
    heights[i] = T.DataUtils.toHalfFloat(roof + (groundHeight ? groundHeight(x, z) : 0));
  }
  const height = new T.DataTexture(heights, f.width, f.height, T.RedFormat, T.HalfFloatType);
  height.magFilter = T.LinearFilter;
  height.minFilter = T.LinearFilter;
  height.needsUpdate = true;
  // Lamps: position and strength, 1024 to a row.
  const rowsOfLamps = Math.max(1, Math.ceil(lights.length / 1024));
  const data = new Float32Array(1024 * rowsOfLamps * 4);
  lights.forEach((l, i) =>
    data.set(
      [l.x, l.y, l.z, l.kind === 'underpass' ? -0.34 : l.kind === 'bollard' ? 0.3 : l.kind === 'globe' ? 0.65 : 1],
      i * 4,
    ),
  );
  const lamps = new T.DataTexture(data, 1024, rowsOfLamps, T.RGBAFormat, T.FloatType);
  lamps.magFilter = T.NearestFilter;
  lamps.minFilter = T.NearestFilter;
  lamps.needsUpdate = true;
  // The grid: up to eight lamps per cell, the nearest first.
  const cellSize = 16;
  const cols = Math.max(1, Math.ceil((f.width * f.cell) / cellSize)),
    rows = Math.max(1, Math.ceil((f.height * f.cell) / cellSize));
  const lists = Array.from({ length: cols * rows }, () => []);
  lights.forEach((l, i) => {
    const reach = l.kind === 'underpass' ? 10 : 24;
    const gx = (l.x - f.x0) / cellSize,
      gy = (-l.z - f.y0) / cellSize,
      r = reach / cellSize;
    for (let j = Math.max(0, Math.floor(gy - r)); j <= Math.min(rows - 1, Math.floor(gy + r)); j++)
      for (let k = Math.max(0, Math.floor(gx - r)); k <= Math.min(cols - 1, Math.floor(gx + r)); k++) {
        // Distance from the lamp to the nearest point of the cell.
        const dx = Math.max(k - gx, 0, gx - k - 1) * cellSize,
          dy = Math.max(j - gy, 0, gy - j - 1) * cellSize;
        const d = Math.hypot(dx, dy);
        if (d <= reach) lists[j * cols + k].push({ i, d });
      }
  });
  const ids = new Float32Array(cols * 2 * rows * 4).fill(-1);
  lists.forEach((list, c) => {
    list.sort((a, b) => a.d - b.d);
    for (let k = 0; k < Math.min(8, list.length); k++) ids[c * 8 + k] = list[k].i;
  });
  const grid = new T.DataTexture(ids, cols * 2, rows, T.RGBAFormat, T.FloatType);
  grid.magFilter = T.NearestFilter;
  grid.minFilter = T.NearestFilter;
  grid.needsUpdate = true;
  return { height, lamps, grid, cols, rows, cellSize };
}
