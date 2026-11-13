import { assert, number, options } from '../core/validate.js';
import { seedValue, randomAt, noise3, noiseRaw } from '../noise/vector.js';
import { cloudPoints } from '../graphics/cloud.js';
export { noise2, noise3, noiseField } from '../noise/vector.js';

function vector(input = {}, label) {
  options(input, ['x', 'y', 'z'], label);
  return Object.freeze({
    x: number(input.x ?? 0, `${label} x`),
    y: number(input.y ?? 0, `${label} y`),
    z: number(input.z ?? 0, `${label} z`),
  });
}
/** Counter-addressed particles: time and seed completely determine the sample. */
export function emitter(spec = {}) {
  options(
    spec,
    ['seed', 'rate', 'life', 'origin', 'velocity', 'spread', 'acceleration', 'drift', 'start', 'end', 'maxParticles'],
    'emitter',
  );
  const seed = seedValue(spec.seed),
    rate = number(spec.rate ?? 30, 'emission rate', 1e-6, 10000),
    life = number(spec.life ?? 2, 'particle lifetime', 1e-6, 3600),
    start = number(spec.start ?? 0, 'emission start', 0, 86400),
    end = number(spec.end ?? 86400, 'emission end', 0, 86400),
    limit = number(spec.maxParticles ?? 10000, 'particle cap', 1, 100000);
  assert(end >= start, 'INVALID_EMITTER', 'Emission end must follow start.');
  assert(Number.isInteger(limit), 'INVALID_EMITTER', 'Particle cap must be an integer.');
  assert(
    Math.ceil(Math.min(life, end - start) * rate) <= limit,
    'RESOURCE_LIMIT',
    'The live particle envelope exceeds maxParticles. Reduce rate/life or raise the declared cap.',
  );
  const origin = vector(spec.origin, 'origin'),
    velocity = vector(spec.velocity ?? { y: -30 }, 'velocity'),
    spread = vector(spec.spread, 'velocity spread'),
    acceleration = vector(spec.acceleration, 'acceleration');
  for (const v of Object.values(spread))
    assert(v >= 0, 'INVALID_EMITTER', 'Velocity spread components must be nonnegative.');
  const drift = typeof spec.drift === 'number' ? { amplitude: spec.drift } : (spec.drift ?? {});
  options(drift, ['amplitude', 'frequency'], 'particle drift');
  const amplitude = number(drift.amplitude ?? 0, 'drift amplitude', 0, 1e5),
    frequency = number(drift.frequency ?? 1, 'drift frequency', 1e-6, 1000);
  function particle(id, time) {
    number(id, 'particle index', 0, 0xffffffff);
    assert(Number.isInteger(id), 'INVALID_PARTICLE', 'Particle indices must be integers.');
    number(time, 'particle time', 0, 86400);
    // Address deaths in the same emission-index domain as births. In particular,
    // an integral life*rate ends exactly when the replacement particle is born.
    // The lower bound also respects a caller's computed birth + life boundary.
    const birth = start + id / rate,
      death = Math.min(birth + life, start + (id + life * rate) / rate),
      age = time - birth;
    if (birth >= end || time < birth || time >= death) return null;
    const v = Object.fromEntries(
      ['x', 'y', 'z'].map((key, i) => [
        key,
        number(velocity[key] + (randomAt(seed, id, i) * 2 - 1) * spread[key], `initial velocity ${key}`),
      ]),
    );
    const position = {};
    for (const [i, key] of ['x', 'y', 'z'].entries()) {
      const salt = randomAt(seed, id, i + 3) * 1000,
        offset =
          amplitude === 0
            ? 0
            : amplitude *
              (noise3(salt, 0, age * frequency, { seed: (seed + i) >>> 0 }) -
                noise3(salt, 0, 0, { seed: (seed + i) >>> 0 }));
      position[key] = number(
        origin[key] + v[key] * age + 0.5 * acceleration[key] * age * age + offset,
        `particle ${key}`,
      );
    }
    return Object.freeze({
      id,
      birth,
      age,
      progress: age / life,
      life,
      position: Object.freeze(position),
      initialVelocity: Object.freeze(v),
    });
  }
  const sample = (time) => {
    number(time, 'particle time', 0, 86400);
    if (time < start || start === end) return Object.freeze([]);
    // Broaden inverse-index bounds, then test exact computed birth/death times.
    // Multiplication need not invert start + id/rate exactly in binary floats.
    const first = Math.max(0, Math.floor((time - life - start) * rate) - 1),
      last = Math.min(Math.floor((time - start) * rate) + 1, Math.ceil((end - start) * rate) + 1);
    assert(last - first + 1 <= limit + 6, 'RESOURCE_LIMIT', 'Sample exceeds the live particle candidate cap.');
    const result = [];
    for (let id = first; id <= last; id++) {
      const p = particle(id, time);
      if (p) result.push(p);
    }
    assert(result.length <= limit, 'RESOURCE_LIMIT', 'Sample exceeds the live particle cap.');
    return Object.freeze(result);
  };
  return Object.freeze({
    seed,
    rate,
    life,
    start,
    end,
    maxParticles: limit,
    particle,
    sample,
    /**
     * Positions (x,y) plus optional radius/color, ready for scene.cloud({points}). Writes straight into typed
     * arrays with the same arithmetic as particle(), so 100k particles sample in a few milliseconds. The
     * object passed to radius/color functions is a light, unfrozen view: {id, age, progress, life, x, y}.
     */
    cloud(time, localSpec1 = {}) {
      options(localSpec1, ['radius', 'color'], 'particle cloud');
      number(time, 'particle time', 0, 86400);
      assert(
        localSpec1.radius === undefined ||
          typeof localSpec1.radius === 'function' ||
          typeof localSpec1.radius === 'number',
        'INVALID_EMITTER',
        'radius is a number or a function of the particle.',
      );
      assert(
        localSpec1.color === undefined || typeof localSpec1.color === 'function',
        'INVALID_EMITTER',
        'color is a function returning [r,g,b,a] in 0..1.',
      );
      const first = time < start || start === end ? 1 : Math.max(0, Math.floor((time - life - start) * rate) - 1),
        last =
          time < start || start === end
            ? 0
            : Math.min(Math.floor((time - start) * rate) + 1, Math.ceil((end - start) * rate) + 1);
      assert(last - first + 1 <= limit + 6, 'RESOURCE_LIMIT', 'Sample exceeds the live particle candidate cap.');
      const capacity = Math.max(0, last - first + 1),
        positions = new Float32Array(capacity * 2),
        radii = localSpec1.radius === undefined ? null : new Float32Array(capacity),
        colors = localSpec1.color ? new Float32Array(capacity * 4) : null;
      const seeds = [seedValue(seed >>> 0), seedValue((seed + 1) >>> 0)],
        keys = ['x', 'y'];
      let n = 0;
      for (let id = first; id <= last; id++) {
        const birth = start + id / rate,
          death = Math.min(birth + life, start + (id + life * rate) / rate),
          age = time - birth;
        if (birth >= end || time < birth || time >= death) continue;
        let x = 0,
          y = 0;
        for (let i = 0; i < 2; i++) {
          const key = keys[i],
            v = velocity[key] + (randomAt(seed, id, i) * 2 - 1) * spread[key];
          let offset = 0;
          if (amplitude !== 0) {
            const salt = randomAt(seed, id, i + 3) * 1000;
            offset = amplitude * (noiseRaw(salt, 0, age * frequency, seeds[i]) - noiseRaw(salt, 0, 0, seeds[i]));
          }
          const value = origin[key] + v * age + 0.5 * acceleration[key] * age * age + offset;
          if (i) y = value;
          else x = value;
        }
        positions[n * 2] = x;
        positions[n * 2 + 1] = y;
        if (radii || colors) {
          const view = { id, age, progress: age / life, life, x, y };
          if (radii) radii[n] = typeof localSpec1.radius === 'number' ? localSpec1.radius : localSpec1.radius(view);
          if (colors) colors.set(localSpec1.color(view), n * 4);
        }
        n++;
      }
      assert(n <= limit, 'RESOURCE_LIMIT', 'Sample exceeds the live particle cap.');
      return cloudPoints({
        positions: positions.subarray(0, n * 2),
        radii: radii?.subarray(0, n) ?? null,
        colors: colors?.subarray(0, n * 4) ?? null,
      });
    },
    buffers(time) {
      const rows = sample(time),
        positions = new Float32Array(rows.length * 3),
        ids = new Uint32Array(rows.length);
      rows.forEach((p, i) => {
        positions.set([p.position.x, p.position.y, p.position.z], i * 3);
        ids[i] = p.id;
      });
      return Object.freeze({ positions, ids, count: rows.length });
    },
  });
}
