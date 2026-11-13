import { assert, number, options, safeCopy } from '../core/validate.js';
import { corners, matteOutline, orientation, point } from './geometry.js';

const prepared = new WeakSet();

/** Copy and validate an editable point, plane or matte track before playback. */
export function compileTrack(input) {
  options(input, ['kind', 'samples'], 'footage track');
  const { kind, samples } = input;
  assert(
    kind === 'point' || kind === 'plane' || kind === 'matte',
    'INVALID_DATA',
    'Choose a point, plane or matte track.',
  );
  assert(
    Array.isArray(samples) && samples.length >= 1 && samples.length <= 4096,
    'RESOURCE_LIMIT',
    'Use between 1 and 4096 time samples.',
  );
  const read = kind === 'point' ? point : kind === 'plane' ? corners : matteOutline;
  let previous = -1;
  const entries = safeCopy(samples).map((sample) => {
    options(sample, ['time', 'value'], 'track sample');
    const time = number(sample.time, 'track time', 0, 86400);
    assert(time > previous, 'INVALID_DATA', 'Track sample times must increase.');
    previous = time;
    return Object.freeze({ time, value: sample.value === null ? null : read(sample.value) });
  });
  const result = Object.freeze({ kind, samples: Object.freeze(entries) });
  prepared.add(result);
  return result;
}

function lerp(a, b, t) {
  return Object.freeze({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
}

/** Reduce frame-to-frame noise in measured point or plane samples before playback. */
export function stabilizeTrack(track) {
  assert(prepared.has(track), 'INVALID_DATA', 'Use a compiled footage track.');
  const { kind, samples } = track;
  assert(kind !== 'matte', 'INVALID_DATA', 'Stabilize a point or plane track.');
  let rows = samples;
  for (let pass = 0; pass < 3; pass++) {
    rows = rows.map((row, i) => {
      const before = rows[i - 1],
        after = rows[i + 1];
      if (!before?.value || !row.value || !after?.value) return row;
      if (row.time - before.time > 0.25 || after.time - row.time > 0.25) return row;
      const fraction = (row.time - before.time) / (after.time - before.time);
      const center = (a, b, c) => lerp(b, lerp(a, c, fraction), 0.5);
      if (kind === 'point') return { time: row.time, value: center(before.value, row.value, after.value) };
      const value = row.value.map((p, corner) => center(before.value[corner], p, after.value[corner]));
      return orientation(value) === orientation(row.value) ? { time: row.time, value } : row;
    });
  }
  return compileTrack({ kind, samples: rows });
}

/** Sample at clip time, returning null outside the track or across a missing sample. */
export function sampleTrack(track, time) {
  assert(prepared.has(track), 'INVALID_DATA', 'Use a compiled footage track.');
  number(time, 'clip time', 0, 86400);
  const rows = track.samples;
  if (time < rows[0].time || time > rows.at(-1).time) return null;
  let lo = 0,
    hi = rows.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].time < time) lo = mid + 1;
    else hi = mid;
  }
  const right = rows[lo];
  if (right.time === time) return right.value;
  const left = rows[lo - 1];
  if (!left.value || !right.value) return null;
  const t = (time - left.time) / (right.time - left.time);
  if (track.kind === 'point') return lerp(left.value, right.value, t);
  if (track.kind === 'matte' && left.value.length !== right.value.length) return left.value;
  const quad = left.value.map((value, index) => lerp(value, right.value[index], t));
  if (track.kind === 'matte') return Object.freeze(quad);
  return orientation(quad) && orientation(quad) === orientation(left.value) ? Object.freeze(quad) : null;
}
