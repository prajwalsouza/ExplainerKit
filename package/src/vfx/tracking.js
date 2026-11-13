import { assert, number, options } from '../core/validate.js';
import { apply, corners, fit, orientation, point } from './geometry.js';
import { cutHint, exclusions, featuresIn, grayFrame, patchFits, regionOf } from './frames.js';

function template(frame, x, y) {
  const values = new Float64Array(49);
  let sum = 0,
    square = 0,
    i = 0;
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const value = frame.gray[(y + dy) * frame.width + x + dx];
      values[i++] = value;
      sum += value;
      square += value * value;
    }
  }
  const variance = square - (sum * sum) / 49;
  if (variance < 49 * 16) return null;
  for (let k = 0; k < 49; k++) values[k] -= sum / 49;
  return { values, variance };
}

function similarity(frame, x, y, ref) {
  let sum = 0,
    square = 0,
    cross = 0,
    i = 0;
  for (let dy = -3; dy <= 3; dy++) {
    let index = (y + dy) * frame.width + x - 3;
    for (let dx = -3; dx <= 3; dx++) {
      const value = frame.gray[index++];
      sum += value;
      square += value * value;
      cross += ref.values[i++] * value;
    }
  }
  const variance = square - (sum * sum) / 49;
  return variance >= 49 * 16 ? cross / Math.sqrt(variance * ref.variance) : -1;
}

function search(frame, ref, x, y, radius, excluded) {
  const size = radius * 2 + 1;
  const scores = new Float32Array(size * size).fill(-1);
  let best = -1,
    bx = 0,
    by = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (!patchFits(frame, x + dx, y + dy, excluded)) continue;
      const score = similarity(frame, x + dx, y + dy, ref);
      scores[(dy + radius) * size + dx + radius] = score;
      if (score > best) {
        best = score;
        bx = dx;
        by = dy;
      }
    }
  }
  if (best < 0.76) return null;
  let alternative = -1;
  for (let i = 0; i < scores.length; i++) {
    const dx = (i % size) - radius,
      dy = Math.floor(i / size) - radius;
    if (Math.max(Math.abs(dx - bx), Math.abs(dy - by)) > 2) alternative = Math.max(alternative, scores[i]);
  }
  if (best - alternative < 0.055) return null;
  const index = (by + radius) * size + bx + radius;
  function offset(a, b) {
    const denominator = 2 * (2 * best - a - b);
    return a > -0.99 && b > -0.99 && denominator > 0 ? Math.max(-0.5, Math.min(0.5, (b - a) / denominator)) : 0;
  }
  return {
    x: x + bx,
    y: y + by,
    dx: Math.abs(bx) < radius ? offset(scores[index - 1], scores[index + 1]) : 0,
    dy: Math.abs(by) < radius ? offset(scores[index - size], scores[index + size]) : 0,
    score: best,
  };
}

function match(a, b, x, y, radius, excludedA, excludedB) {
  if (!patchFits(a, x, y, excludedA)) return null;
  const ref = template(a, x, y);
  if (!ref) return null;
  const hit = search(b, ref, x, y, radius, excludedB);
  if (!hit) return null;
  const back = search(a, template(b, hit.x, hit.y), hit.x, hit.y, radius, excludedA);
  if (!back || Math.hypot(back.x - x, back.y - y) > 1) return null;
  return { x, y, u: hit.x + hit.dx, v: hit.y + hit.dy, score: hit.score };
}

function scoreModel(matrix, matches) {
  const inliers = [];
  let error = 0;
  for (const item of matches) {
    const prediction = apply(matrix, item.x, item.y);
    const distance = Math.hypot(prediction.x - item.u, prediction.y - item.v);
    if (distance > 1.5 || !Number.isFinite(distance)) continue;
    inliers.push(item);
    error += distance * distance;
  }
  return { matrix, inliers, error };
}

function consensus(matches, motion, scale, area) {
  const count = { translation: 1, affine: 3, perspective: 4 }[motion];
  const minimum = Math.max(4, count + 2, Math.ceil(matches.length * 0.55));
  if (matches.length < minimum) return null;
  let state = 4141,
    best = null;
  for (let trial = 0; trial < (count === 1 ? matches.length : 144); trial++) {
    const picked = new Set();
    for (let j = 0; j < count; j++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      let index = count === 1 ? trial : Math.floor((state / 4294967296) * matches.length);
      while (picked.has(index)) index = (index + 1) % matches.length;
      picked.add(index);
    }
    const matrix = fit(
      [...picked].map((index) => matches[index]),
      motion,
      scale,
    );
    if (!matrix) continue;
    const result = scoreModel(matrix, matches);
    const n = result.inliers.length,
      old = best?.inliers.length ?? 0;
    if (n >= minimum && (n > old || (n === old && result.error < best.error))) best = result;
  }
  if (!best) return null;
  const matrix = fit(best.inliers, motion, scale);
  if (!matrix) return null;
  const refined = scoreModel(matrix, matches);
  if (refined.inliers.length < minimum) return null;
  const xs = refined.inliers.map((m) => m.x),
    ys = refined.inliers.map((m) => m.y);
  if (
    motion !== 'translation' &&
    (Math.max(...xs) - Math.min(...xs) < area.width * 0.25 || Math.max(...ys) - Math.min(...ys) < area.height * 0.25)
  )
    return null;
  return refined;
}

function quality(featureCount, matchCount, inlierCount, residual, confidence, possibleCut) {
  return Object.freeze({ featureCount, matchCount, inlierCount, residual, confidence, possibleCut });
}

function outcome(value, diagnostics, reason = null) {
  return Object.freeze({ value, diagnostics, reason });
}

function pair(previous, next, spec, keys) {
  options(spec, [...keys, 'searchRadius', 'excludePrevious', 'excludeNext'], 'footage tracking');
  const a = grayFrame(previous),
    b = grayFrame(next);
  assert(
    a.width === b.width && a.height === b.height,
    'INVALID_DATA',
    'Tracking frames must have the same dimensions.',
  );
  return {
    a,
    b,
    radius: Math.round(number(spec.searchRadius ?? 10, 'search radius', 2, 20)),
    excludedA: exclusions(spec.excludePrevious),
    excludedB: exclusions(spec.excludeNext),
    possibleCut: cutHint(a, b),
  };
}

/** Follow a textured feature between adjacent decoded frames. */
export function trackPoint(previous, next, spec) {
  const { a, b, radius, excludedA, excludedB, possibleCut } = pair(previous, next, spec, ['point']);
  const start = point(spec.point),
    x = Math.round(start.x),
    y = Math.round(start.y);
  const hit = match(a, b, x, y, radius, excludedA, excludedB);
  if (!hit) return outcome(null, quality(1, 0, 0, null, 0, possibleCut), possibleCut ? 'possible-cut' : 'lost-feature');
  const value = point({ x: start.x + hit.u - x, y: start.y + hit.v - y });
  return outcome(value, quality(1, 1, 1, null, Math.min(1, hit.score), possibleCut));
}

/** Estimate a planar transform from a region and apply it to a separate insert surface. */
export function trackPlane(previous, next, spec) {
  const { a, b, radius, excludedA, excludedB, possibleCut } = pair(previous, next, spec, [
    'region',
    'surface',
    'motion',
  ]);
  const area = regionOf(spec.region),
    region = area.bounds;
  const surface = spec.surface === undefined ? corners(area.quad) : corners(spec.surface);
  const motion = spec.motion ?? 'perspective';
  assert(
    ['translation', 'affine', 'perspective'].includes(motion),
    'INVALID_OPTIONS',
    'Choose translation, affine or perspective motion.',
  );
  const features = featuresIn(a, area, excludedA);
  const centerX = region.x + region.width / 2,
    centerY = region.y + region.height / 2;
  const matches = [];
  for (const { x, y } of features) {
    const m = match(a, b, x, y, radius, excludedA, excludedB);
    if (m) matches.push({ x: m.x - centerX, y: m.y - centerY, u: m.u - centerX, v: m.v - centerY, score: m.score });
  }
  const fitted = consensus(matches, motion, Math.max(region.width, region.height), region);
  const failure = (reason) => outcome(null, quality(features.length, matches.length, 0, null, 0, possibleCut), reason);
  if (!fitted) return failure(possibleCut ? 'possible-cut' : features.length < 6 ? 'weak-texture' : 'lost-plane');
  const move = ({ x, y }) => {
    const value = apply(fitted.matrix, x - centerX, y - centerY);
    return { x: value.x + centerX, y: value.y + centerY };
  };
  const regionCorners = area.quad.map(move);
  if (
    regionCorners.some((p, i) => {
      const start = area.quad[i];
      return !Number.isFinite(p.x + p.y) || Math.hypot(p.x - start.x, p.y - start.y) > radius * 3;
    })
  )
    return failure('unstable-plane');
  if (orientation(regionCorners) !== orientation(area.quad)) return failure('unstable-plane');
  const projected = surface.map(move);
  if (
    projected.some(
      (p, i) =>
        !Number.isFinite(p.x + p.y) ||
        Math.abs(p.x) > 32768 ||
        Math.abs(p.y) > 32768 ||
        Math.hypot(p.x - surface[i].x, p.y - surface[i].y) > radius * 6,
    ) ||
    orientation(projected) !== orientation(surface)
  )
    return failure('unstable-plane');
  const n = fitted.inliers.length,
    residual = Math.sqrt(fitted.error / n);
  const confidence = Math.min(1, fitted.inliers.reduce((sum, item) => sum + item.score, 0) / features.length);
  return Object.freeze({
    ...outcome(corners(projected), quality(features.length, matches.length, n, residual, confidence, possibleCut)),
    region: corners(regionCorners),
  });
}
