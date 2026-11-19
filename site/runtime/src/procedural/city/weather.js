import { assert, number, options } from '../../core/validate.js';
import { toRGBA } from '../../color/space.js';

// Weather and time of day as plain numbers. A condition says where the sun is, what colour the
// sky and its light are, how wet or snowy every surface is, what is falling, and which lights
// are on. Renderers read these numbers; nothing here draws. Two conditions blend field by
// field, so a shot can move from one to another over time.

const C = (value) => Object.freeze(value);
/**
 * The named conditions. Light levels are scene-referred and relative: 1 is a bright overcast
 * surface, and a clear noon sun is about 3. Angles are degrees: azimuth clockwise from north,
 * elevation above the horizon. Fog density is the optical depth at 100 metres under a
 * squared-exponential falloff: light kept at distance d is exp(-density * (d / 100)^2).
 */
export const WEATHER = C({
  clear: C({
    sun: C({ azimuth: 150, elevation: 48, color: 'hsla(44, 60%, 90%, 1)', intensity: 3.1 }),
    sky: C({ zenith: 'hsla(214, 62%, 46%, 1)', horizon: 'hsla(204, 52%, 78%, 1)', glow: 0.5 }),
    ambient: C({ sky: 'hsla(212, 50%, 76%, 1)', ground: 'hsla(34, 22%, 46%, 1)', intensity: 0.62 }),
    fog: C({ color: 'hsla(206, 40%, 82%, 1)', density: 0.012 }),
    clouds: C({ cover: 0.28, dark: 0.15, speed: 1 }),
    wet: 0,
    puddles: 0,
    rain: 0,
    snow: 0,
    snowfall: 0,
    wind: 2.5,
    windows: 0.02,
    lamps: 0,
    signs: 0.15,
    stars: 0,
    shadow: 1,
  }),
  golden: C({
    sun: C({ azimuth: 262, elevation: 13, color: 'hsla(28, 96%, 66%, 1)', intensity: 3.6 }),
    sky: C({ zenith: 'hsla(218, 46%, 44%, 1)', horizon: 'hsla(30, 88%, 72%, 1)', glow: 1.4 }),
    ambient: C({ sky: 'hsla(224, 34%, 70%, 1)', ground: 'hsla(26, 46%, 46%, 1)', intensity: 1.15 }),
    fog: C({ color: 'hsla(28, 70%, 76%, 1)', density: 0.03 }),
    clouds: C({ cover: 0.35, dark: 0.3, speed: 0.8 }),
    wet: 0,
    puddles: 0,
    rain: 0,
    snow: 0,
    snowfall: 0,
    wind: 1.5,
    windows: 0.12,
    lamps: 0,
    signs: 0.3,
    stars: 0,
    shadow: 1,
  }),
  overcast: C({
    sun: C({ azimuth: 170, elevation: 40, color: 'hsla(210, 10%, 88%, 1)', intensity: 0.5 }),
    sky: C({ zenith: 'hsla(212, 12%, 62%, 1)', horizon: 'hsla(210, 10%, 78%, 1)', glow: 0.1 }),
    ambient: C({ sky: 'hsla(212, 14%, 84%, 1)', ground: 'hsla(30, 8%, 50%, 1)', intensity: 1.55 }),
    fog: C({ color: 'hsla(210, 10%, 78%, 1)', density: 0.03 }),
    clouds: C({ cover: 1, dark: 0.45, speed: 1.2 }),
    wet: 0.12,
    puddles: 0,
    rain: 0,
    snow: 0,
    snowfall: 0,
    wind: 3.5,
    windows: 0.1,
    lamps: 0,
    signs: 0.35,
    stars: 0,
    shadow: 0.25,
  }),
  rain: C({
    sun: C({ azimuth: 170, elevation: 38, color: 'hsla(212, 14%, 82%, 1)', intensity: 0.28 }),
    sky: C({ zenith: 'hsla(214, 14%, 48%, 1)', horizon: 'hsla(212, 12%, 68%, 1)', glow: 0.05 }),
    ambient: C({ sky: 'hsla(214, 18%, 76%, 1)', ground: 'hsla(210, 8%, 44%, 1)', intensity: 1.7 }),
    fog: C({ color: 'hsla(212, 14%, 62%, 1)', density: 0.12 }),
    clouds: C({ cover: 1, dark: 0.75, speed: 2 }),
    wet: 1,
    puddles: 0.75,
    rain: 0.8,
    snow: 0,
    snowfall: 0,
    wind: 6,
    windows: 0.3,
    lamps: 0.6,
    signs: 0.8,
    stars: 0,
    shadow: 0.12,
  }),
  snow: C({
    sun: C({ azimuth: 180, elevation: 16, color: 'hsla(210, 16%, 90%, 1)', intensity: 0.5 }),
    sky: C({ zenith: 'hsla(214, 12%, 64%, 1)', horizon: 'hsla(212, 12%, 82%, 1)', glow: 0.1 }),
    ambient: C({ sky: 'hsla(214, 20%, 88%, 1)', ground: 'hsla(214, 16%, 78%, 1)', intensity: 1.5 }),
    fog: C({ color: 'hsla(212, 12%, 84%, 1)', density: 0.14 }),
    clouds: C({ cover: 1, dark: 0.3, speed: 0.6 }),
    wet: 0.2,
    puddles: 0,
    rain: 0,
    snow: 0.92,
    snowfall: 0.75,
    wind: 1.8,
    windows: 0.3,
    lamps: 0.45,
    signs: 0.7,
    stars: 0,
    shadow: 0.2,
  }),
  fog: C({
    sun: C({ azimuth: 120, elevation: 22, color: 'hsla(40, 30%, 86%, 1)', intensity: 0.6 }),
    sky: C({ zenith: 'hsla(210, 10%, 70%, 1)', horizon: 'hsla(40, 12%, 80%, 1)', glow: 0.6 }),
    ambient: C({ sky: 'hsla(210, 10%, 84%, 1)', ground: 'hsla(34, 10%, 56%, 1)', intensity: 1.35 }),
    fog: C({ color: 'hsla(40, 10%, 79%, 1)', density: 1.6 }),
    clouds: C({ cover: 1, dark: 0.1, speed: 0.3 }),
    wet: 0.4,
    puddles: 0.1,
    rain: 0,
    snow: 0,
    snowfall: 0,
    wind: 0.6,
    windows: 0.25,
    lamps: 0.7,
    signs: 0.7,
    stars: 0,
    shadow: 0.15,
  }),
  dusk: C({
    sun: C({ azimuth: 285, elevation: -5, color: 'hsla(14, 80%, 60%, 1)', intensity: 0.35 }),
    sky: C({ zenith: 'hsla(230, 46%, 22%, 1)', horizon: 'hsla(22, 56%, 50%, 1)', glow: 1.1 }),
    ambient: C({ sky: 'hsla(234, 44%, 56%, 1)', ground: 'hsla(250, 20%, 30%, 1)', intensity: 1.0 }),
    fog: C({ color: 'hsla(262, 30%, 44%, 1)', density: 0.035 }),
    clouds: C({ cover: 0.4, dark: 0.55, speed: 0.6 }),
    wet: 0,
    puddles: 0,
    rain: 0,
    snow: 0,
    snowfall: 0,
    wind: 1.5,
    windows: 0.62,
    lamps: 1,
    signs: 1,
    stars: 0.25,
    shadow: 0.5,
  }),
  night: C({
    // After dark the key light is the moon: cool, dim and high.
    sun: C({ azimuth: 200, elevation: 46, color: 'hsla(220, 40%, 80%, 1)', intensity: 0.11 }),
    sky: C({ zenith: 'hsla(232, 52%, 7%, 1)', horizon: 'hsla(226, 40%, 15%, 1)', glow: 0.25 }),
    ambient: C({ sky: 'hsla(226, 46%, 46%, 1)', ground: 'hsla(240, 24%, 22%, 1)', intensity: 0.95 }),
    fog: C({ color: 'hsla(228, 36%, 12%, 1)', density: 0.03 }),
    clouds: C({ cover: 0.3, dark: 0.85, speed: 0.6 }),
    wet: 0,
    puddles: 0,
    rain: 0,
    snow: 0,
    snowfall: 0,
    wind: 1.5,
    windows: 0.4,
    lamps: 1,
    signs: 1,
    stars: 1,
    shadow: 0.7,
  }),
  nightRain: C({
    sun: C({ azimuth: 200, elevation: 46, color: 'hsla(220, 30%, 70%, 1)', intensity: 0.04 }),
    sky: C({ zenith: 'hsla(232, 26%, 9%, 1)', horizon: 'hsla(250, 14%, 17%, 1)', glow: 0.1 }),
    ambient: C({ sky: 'hsla(226, 30%, 46%, 1)', ground: 'hsla(24, 18%, 26%, 1)', intensity: 1.05 }),
    fog: C({ color: 'hsla(258, 12%, 11%, 1)', density: 0.14 }),
    clouds: C({ cover: 1, dark: 0.9, speed: 2 }),
    wet: 1,
    puddles: 0.85,
    rain: 0.9,
    snow: 0,
    snowfall: 0,
    wind: 6,
    windows: 0.44,
    lamps: 1,
    signs: 1,
    stars: 0,
    shadow: 0.3,
  }),
  nightSnow: C({
    sun: C({ azimuth: 200, elevation: 40, color: 'hsla(220, 30%, 80%, 1)', intensity: 0.06 }),
    sky: C({ zenith: 'hsla(232, 26%, 11%, 1)', horizon: 'hsla(270, 12%, 20%, 1)', glow: 0.1 }),
    ambient: C({ sky: 'hsla(226, 30%, 46%, 1)', ground: 'hsla(26, 26%, 34%, 1)', intensity: 0.85 }),
    fog: C({ color: 'hsla(266, 10%, 17%, 1)', density: 0.14 }),
    clouds: C({ cover: 1, dark: 0.8, speed: 0.6 }),
    wet: 0.15,
    puddles: 0,
    rain: 0,
    snow: 0.95,
    snowfall: 0.8,
    wind: 1.6,
    windows: 0.46,
    lamps: 1,
    signs: 1,
    stars: 0,
    shadow: 0.3,
  }),
});
export const weatherNames = Object.freeze(Object.keys(WEATHER));

const NUMBERS = ['wet', 'puddles', 'rain', 'snow', 'snowfall', 'wind', 'windows', 'lamps', 'signs', 'stars', 'shadow'];
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linear = (color) => toRGBA(color).slice(0, 3).map(toLinear);
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/**
 * Resolve a condition into numbers a renderer can use directly: colours as linear RGB triples
 * and the sun as a unit direction toward the light (x east, y up, z south).
 */
export function resolveWeather(input) {
  const w = typeof input === 'string' ? WEATHER[input] : input;
  assert(
    w && w.sun && w.sky && w.ambient && w.fog && w.clouds,
    'INVALID_WEATHER',
    `Pass a condition or one of ${weatherNames.join(', ')}.`,
  );
  if (w.resolved) return w;
  const az = (number(w.sun.azimuth, 'sun azimuth', -720, 720) * Math.PI) / 180,
    el = (number(w.sun.elevation, 'sun elevation', -90, 90) * Math.PI) / 180;
  const out = {
    resolved: true,
    sun: {
      azimuth: w.sun.azimuth,
      elevation: w.sun.elevation,
      direction: [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)],
      color: linear(w.sun.color),
      intensity: number(w.sun.intensity, 'sun intensity', 0, 100),
    },
    sky: {
      zenith: linear(w.sky.zenith),
      horizon: linear(w.sky.horizon),
      glow: number(w.sky.glow ?? 0.5, 'sky glow', 0, 10),
    },
    ambient: {
      sky: linear(w.ambient.sky),
      ground: linear(w.ambient.ground),
      intensity: number(w.ambient.intensity, 'ambient intensity', 0, 100),
    },
    fog: { color: linear(w.fog.color), density: number(w.fog.density, 'fog density', 0, 20) },
    clouds: {
      cover: number(w.clouds.cover, 'cloud cover', 0, 1),
      dark: number(w.clouds.dark ?? 0.3, 'cloud dark', 0, 1),
      speed: number(w.clouds.speed ?? 1, 'cloud speed', 0, 20),
    },
  };
  for (const k of NUMBERS) out[k] = number(w[k] ?? 0, k, 0, k === 'wind' ? 40 : 1);
  return out;
}

/**
 * Blend two conditions. `t` runs from 0 (all `a`) to 1 (all `b`). The sun turns the short way
 * round, and surfaces dry or freeze at their own pace: `t` is used as given, so ease it first
 * if the change should start gently.
 */
export function mixWeather(a, b, t) {
  const A = resolveWeather(a),
    B = resolveWeather(b);
  const k = number(t, 'mix', 0, 1);
  let da = B.sun.azimuth - A.sun.azimuth;
  da -= Math.round(da / 360) * 360;
  const azimuth = A.sun.azimuth + da * k,
    elevation = lerp(A.sun.elevation, B.sun.elevation, k);
  const az = (azimuth * Math.PI) / 180,
    el = (elevation * Math.PI) / 180;
  const out = {
    resolved: true,
    sun: {
      azimuth,
      elevation,
      direction: [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)],
      color: lerp3(A.sun.color, B.sun.color, k),
      intensity: lerp(A.sun.intensity, B.sun.intensity, k),
    },
    sky: {
      zenith: lerp3(A.sky.zenith, B.sky.zenith, k),
      horizon: lerp3(A.sky.horizon, B.sky.horizon, k),
      glow: lerp(A.sky.glow, B.sky.glow, k),
    },
    ambient: {
      sky: lerp3(A.ambient.sky, B.ambient.sky, k),
      ground: lerp3(A.ambient.ground, B.ambient.ground, k),
      intensity: lerp(A.ambient.intensity, B.ambient.intensity, k),
    },
    fog: { color: lerp3(A.fog.color, B.fog.color, k), density: lerp(A.fog.density, B.fog.density, k) },
    clouds: {
      cover: lerp(A.clouds.cover, B.clouds.cover, k),
      dark: lerp(A.clouds.dark, B.clouds.dark, k),
      speed: lerp(A.clouds.speed, B.clouds.speed, k),
    },
  };
  for (const n of NUMBERS) out[n] = lerp(A[n], B[n], k);
  return out;
}

/**
 * A schedule of conditions over time: [{at, weather, ease?}], sorted by `at` in seconds. Returns
 * `at(time)`, the blended condition, a pure function of time so a shot can be scrubbed. Each
 * change takes `change` seconds (default 4) ending at its `at`.
 */
export function weatherSchedule(steps, spec = {}) {
  options(spec, ['change'], 'weatherSchedule');
  assert(Array.isArray(steps) && steps.length >= 1 && steps.length <= 64, 'INVALID_WEATHER', 'Pass 1 to 64 steps.');
  const change = number(spec.change ?? 4, 'change', 0.01, 3600);
  const list = steps.map((s, i) => {
    options(s, ['at', 'weather', 'change'], 'weather step');
    return {
      at: number(s.at ?? 0, 'step time', 0, 1e6),
      state: resolveWeather(s.weather),
      change: number(s.change ?? change, 'step change', 0.01, 3600),
      i,
    };
  });
  for (let i = 1; i < list.length; i++)
    assert(list[i].at >= list[i - 1].at, 'INVALID_WEATHER', 'Steps must be in time order.');
  const smooth = (x) => x * x * (3 - 2 * x);
  return Object.freeze({
    duration: list[list.length - 1].at,
    at(time) {
      const t = number(time, 'time', -1e6, 1e6);
      let state = list[0].state;
      for (let i = 1; i < list.length; i++) {
        const s = list[i];
        const k = Math.min(1, Math.max(0, (t - (s.at - s.change)) / s.change));
        if (k <= 0) break;
        state = k >= 1 ? s.state : mixWeather(state, s.state, smooth(k));
      }
      return state;
    },
  });
}
