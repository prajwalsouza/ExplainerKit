import { assert, number, options } from './validate.js';
export const easings = Object.freeze({
  linear: (t) => t,
  smooth: (t) => t * t * (3 - 2 * t),
  easeOut: (t) => 1 - (1 - t) ** 3,
  easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  launch: cubicBezier(0.4, 1.2, 0.56, 1.02),
  titleOpen: cubicBezier(0.3, 1.24, 0.22, 0.97),
  anticipateOut: cubicBezier(0.04, -0.2, 0.64, 0.22),
  linearStop: (t) => Math.max(0, Math.min(1, t)),
  snapIn: snapCurve,
});
/** CSS cubic-bezier: invert x, then evaluate y. End tangents extrapolate outside [0,1]. */
export function cubicBezier(x1, y1, x2, y2) {
  number(x1, 'bezier x1', 0, 1);
  number(x2, 'bezier x2', 0, 1);
  number(y1, 'bezier y1');
  number(y2, 'bezier y2');
  const curve = (t, a, b) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
  const derivative = (t) => 3 * (1 - t) * (1 - t) * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2);
  return Object.freeze((progress) => {
    number(progress, 'bezier progress');
    if (progress === 0 || progress === 1) return progress;
    if (progress < 0) return number(progress * (x1 > 0 ? y1 / x1 : x2 > 0 ? y2 / x2 : 0), 'bezier output');
    if (progress > 1)
      return number(
        1 + (progress - 1) * (x2 < 1 ? (1 - y2) / (1 - x2) : x1 < 1 ? (1 - y1) / (1 - x1) : 0),
        'bezier output',
      );
    let lo = 0,
      hi = 1,
      t = progress;
    for (let i = 0; i < 8; i++) {
      const x = curve(t, x1, x2);
      if (x === progress) return number(curve(t, y1, y2), 'bezier output');
      if (x < progress) lo = t;
      else hi = t;
      const slope = derivative(t),
        candidate = slope > 1e-12 ? t - (x - progress) / slope : NaN;
      t = Number.isFinite(candidate) && candidate > lo && candidate < hi ? candidate : (lo + hi) / 2;
    }
    // A parameter-space bracket controls y error even at a flat x tangent.
    for (let i = 0; i < 64; i++) {
      if (curve(t, x1, x2) < progress) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return number(curve(t, y1, y2), 'bezier output');
  });
}

/** Plan all segments before the caller mutates a channel. Each key eases its outgoing segment. */
export function prepareKeyframes(tracks, property, keys, baseline) {
  assert(
    Array.isArray(keys) && keys.length >= 2 && keys.length <= 10000,
    'INVALID_KEYFRAMES',
    'Use 2–10000 strictly time-ordered keys.',
  );
  const captured = [];
  for (let i = 0; i < keys.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(keys, i);
    assert(descriptor && 'value' in descriptor, 'INVALID_KEYFRAMES', 'Keyframes must be dense data without accessors.');
    const key = descriptor.value;
    options(key, ['at', 'value', 'ease'], 'keyframe');
    const at = number(key.at, 'key time', 0, 86400),
      value = number(key.value, 'key value'),
      ease = key.ease ?? 'smooth';
    assert(
      typeof ease === 'function' || (typeof ease === 'string' && Object.hasOwn(easings, ease)),
      'INVALID_EASING',
      'Use a named easing or a trusted progress function.',
    );
    assert(
      !captured.length || at - captured.at(-1).at >= 1e-6,
      'INVALID_KEYFRAMES',
      'Keys must be increasing and separated by at least one microsecond.',
    );
    captured.push(Object.freeze({ at, value, ease }));
  }
  let candidate = [...tracks];
  for (let i = 0; i < captured.length - 1; i++) {
    const a = captured[i],
      b = captured[i + 1],
      track = prepareTrack(
        candidate,
        { property, from: a.value, to: b.value, at: a.at, duration: b.at - a.at, ease: a.ease },
        baseline,
      );
    candidate.push(track);
  }
  return Object.freeze(candidate.sort((a, b) => a.at - b.at));
}
export function makeTrack(spec) {
  const { property, from, to, at = 0, duration = 1, ease = 'smooth' } = spec;
  number(at + duration, 'animation end', 0, 86400);
  number(from, 'from');
  number(to, 'to');
  number(at, 'at', 0);
  number(duration, 'duration', 1e-6);
  assert(
    typeof ease === 'function' || (typeof ease === 'string' && Object.hasOwn(easings, ease)),
    'INVALID_EASING',
    'Use a named easing or a trusted progress function.',
  );
  return Object.freeze({ property, from, to, at, duration, end: at + duration, ease });
}
/** Prepare a track without changing its channel. Helpers infer starts only from authored history. */
export function prepareTrack(tracks, spec, baseline, { continuation = false } = {}) {
  let track = makeTrack({ from: baseline, ...spec });
  assert(
    !tracks.some((other) => track.at < other.end && other.at < track.end),
    'CHANNEL_OWNED',
    'Animation intervals for a property cannot overlap.',
  );
  if (continuation) {
    assert(
      !tracks.some((other) => other.at > track.at),
      'AMBIGUOUS_CONTINUATION',
      'Schedule to() moves chronologically within a channel, or use explicit from/to tracks.',
    );
    track = Object.freeze({ ...track, from: trackValue(tracks, track.at, baseline), continuation: true });
  }
  assert(
    !tracks.some((other) => other.continuation && track.end <= other.at),
    'AMBIGUOUS_CONTINUATION',
    'An earlier insertion would change a later to() start; rebuild that channel or use explicit from/to tracks.',
  );
  return track;
}
function activeTrackValue(track, time) {
  let progress;
  try {
    progress = (typeof track.ease === 'function' ? track.ease : easings[track.ease])(
      (time - track.at) / track.duration,
    );
  } catch (cause) {
    const error = new Error('Trusted easing callback failed.');
    error.code = 'EASING_FAILED';
    error.cause = cause;
    throw error;
  }
  number(progress, 'easing result');
  return number(track.from + (track.to - track.from) * progress, 'animated value');
}
export function trackValue(tracks, time, baseline) {
  // Prepared timeline frames contain one track. Avoid creating an iterator for
  // each channel while retaining the same easing and result validation.
  if (tracks.length === 1) {
    const track = tracks[0];
    if (time >= track.at && time < track.end) return activeTrackValue(track, time);
    return time >= track.end ? track.to : baseline;
  }
  let completed = null;
  for (const t of tracks) {
    if (time >= t.at && time < t.end) {
      return activeTrackValue(t, time);
    }
    if (time >= t.end && (!completed || completed.end < t.end)) completed = t;
  }
  return completed ? completed.to : baseline;
}

/** Original snap convention shared with keyed poses; empirical Clip3 fit remains a separate gate. */
function snapCurve(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (t < 0.15) return -0.05 * Math.sin((Math.PI * t) / 0.15);
  if (t < 0.75) {
    const u = (t - 0.15) / 0.6;
    return 1.04 * u * u * (3 - 2 * u);
  }
  return 1 + 0.04 * (1 - (t - 0.75) / 0.25) ** 2;
}
