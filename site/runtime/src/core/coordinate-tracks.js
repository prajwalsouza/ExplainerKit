import { assert, options } from './validate.js';
import { prepareTrack, prepareKeyframes, trackValue } from './timing.js';
import { validateProperty } from './geometry.js';
const axes = (tracks) => [0, 1].map((i) => tracks.map((t) => ({ ...t, from: t.from[i], to: t.to[i] })));
/** Coordinate pivots share exactly the scalar channel's timing and ownership rules. */
export function preparePivotTrack(tracks, spec, baseline, settings) {
  const from = spec.from ?? baseline,
    to = spec.to;
  assert(
    Array.isArray(from) && Array.isArray(to),
    'INVALID_PIVOT',
    'Animate coordinate pivots using coordinate endpoints.',
  );
  validateProperty('group', 'pivot', from);
  validateProperty('group', 'pivot', to);
  const split = axes(tracks),
    parts = split.map((ts, i) => prepareTrack(ts, { ...spec, from: from[i], to: to[i] }, baseline?.[i], settings));
  return Object.freeze({
    ...parts[0],
    from: Object.freeze(parts.map((p) => p.from)),
    to: Object.freeze(parts.map((p) => p.to)),
  });
}
export function pivotTrackValue(tracks, time, baseline) {
  if (!tracks.length) return baseline;
  const split = axes(tracks);
  return split.map((ts, i) => trackValue(ts, time, Array.isArray(baseline) ? baseline[i] : tracks[0].from[i]));
}
export function preparePivotKeys(tracks, keys, baseline) {
  assert(
    Array.isArray(keys) && keys.length >= 2 && keys.length <= 10000,
    'INVALID_KEYFRAMES',
    'Use 2–10000 coordinate keyframes.',
  );
  for (let i = 0; i < keys.length; i++) {
    const d = Object.getOwnPropertyDescriptor(keys, i);
    assert(d && 'value' in d, 'INVALID_KEYFRAMES', 'Use dense keyframes without accessors.');
    const key = d.value;
    options(key, ['at', 'value', 'ease'], 'keyframe');
    assert(key && Array.isArray(key.value), 'INVALID_PIVOT', 'Pivot keys need coordinate values.');
    validateProperty('group', 'pivot', key.value);
  }
  const split = axes(tracks),
    parts = split.map((ts, i) =>
      prepareKeyframes(
        ts,
        'pivot',
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
