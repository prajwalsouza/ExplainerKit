import { assert, options } from './validate.js';
import { prepareTrack, prepareKeyframes, trackValue } from './timing.js';
import { strokeDasharray } from '../graphics/index.js';
const axes = (tracks, count) =>
  Array.from({ length: count }, (_, i) => tracks.map((t) => ({ ...t, from: t.from[i], to: t.to[i] })));
const endpoints = (from, to) => {
  from = strokeDasharray(from);
  to = strokeDasharray(to);
  assert(
    from.length > 0 && from.length === to.length,
    'INVALID_DASH_ANIMATION',
    'Animate dash patterns using equal-length nonempty arrays.',
  );
  return { from, to };
};
export function prepareDashTrack(tracks, spec, baseline, settings) {
  const { from, to } = endpoints(spec.from ?? baseline, spec.to);
  assert(
    tracks.every((t) => t.from.length === from.length),
    'INVALID_DASH_ANIMATION',
    'A dash channel keeps one pattern length.',
  );
  const parts = axes(tracks, from.length).map((ts, i) =>
    prepareTrack(ts, { ...spec, from: from[i], to: to[i] }, baseline?.[i] ?? from[i], settings),
  );
  return Object.freeze({
    ...parts[0],
    from: Object.freeze(parts.map((p) => p.from)),
    to: Object.freeze(parts.map((p) => p.to)),
  });
}
export function dashTrackValue(tracks, time, baseline) {
  if (!tracks.length) return baseline;
  return axes(tracks, tracks[0].from.length).map((ts, i) => trackValue(ts, time, baseline?.[i] ?? tracks[0].from[i]));
}
export function prepareDashKeys(tracks, keys, baseline) {
  assert(
    Array.isArray(keys) && keys.length >= 2 && keys.length <= 10000,
    'INVALID_KEYFRAMES',
    'Use2–10000 dash keyframes.',
  );
  let count;
  for (let i = 0; i < keys.length; i++) {
    const d = Object.getOwnPropertyDescriptor(keys, i);
    assert(d && 'value' in d, 'INVALID_KEYFRAMES', 'Use dense dash keyframes.');
    options(d.value, ['at', 'value', 'ease'], 'dash keyframe');
    const v = strokeDasharray(d.value.value);
    count ??= v.length;
    assert(count > 0 && count === v.length, 'INVALID_DASH_ANIMATION', 'Dash keys need one nonempty array length.');
  }
  assert(
    tracks.every((t) => t.from.length === count),
    'INVALID_DASH_ANIMATION',
    'A dash channel keeps one pattern length.',
  );
  const parts = axes(tracks, count).map((ts, i) =>
    prepareKeyframes(
      ts,
      'strokeDasharray',
      keys.map((k) => ({ ...k, value: k.value[i] })),
      baseline?.[i] ?? keys[0].value[i],
    ),
  );
  return parts[0].map((t, j) =>
    Object.freeze({
      ...t,
      from: Object.freeze(parts.map((a) => a[j].from)),
      to: Object.freeze(parts.map((a) => a[j].to)),
    }),
  );
}
