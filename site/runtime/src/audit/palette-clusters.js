import { fromRGBA, toHex } from '../color/space.js';
import { rgbaToOKLab, contrastRGB } from '../color/perceptual.js';

export const labDistanceSquared = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** Histogram keys describe composited 8-bit sRGB, not arbitrary CSS strings. */
export function addRGB(histogram, rgb, alpha, background) {
  const channels = rgb.map((value, index) => Math.round((value * alpha + background[index] * (1 - alpha)) * 255));
  const key = channels[0] * 65536 + channels[1] * 256 + channels[2];
  histogram.set(key, (histogram.get(key) ?? 0) + 1);
}

/** Deterministic farthest-point seeds, then eight weighted Lloyd updates in OKLab. */
export function clusterPalette(histogram, maxColors, background) {
  const points = [...histogram]
    .map(([key, count]) => {
      const rgb = [Math.floor(key / 65536) / 255, (Math.floor(key / 256) % 256) / 255, (key % 256) / 255];
      return { key, count, rgb, lab: rgbaToOKLab(rgb) };
    })
    .sort((a, b) => b.count - a.count || a.key - b.key);
  if (!points.length) return [];
  const centers = [points[0].lab.slice()];
  const nearest = (lab) => {
    let best = 0,
      distance = Infinity;
    for (let index = 0; index < centers.length; index++) {
      const value = labDistanceSquared(lab, centers[index]);
      if (value < distance) {
        best = index;
        distance = value;
      }
    }
    return { index: best, distance };
  };
  while (centers.length < maxColors) {
    let farthest = null,
      distance = 0.025 ** 2;
    for (const point of points) {
      const value = nearest(point.lab).distance;
      if (value > distance) {
        distance = value;
        farthest = point;
      }
    }
    if (!farthest) break;
    centers.push(farthest.lab.slice());
  }
  for (let iteration = 0; iteration < 8; iteration++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const point of points) {
      const sum = sums[nearest(point.lab).index];
      for (let channel = 0; channel < 3; channel++) sum[channel] += point.lab[channel] * point.count;
      sum[3] += point.count;
    }
    for (let index = 0; index < centers.length; index++) {
      if (sums[index][3]) centers[index] = sums[index].slice(0, 3).map((value) => value / sums[index][3]);
    }
  }
  const bins = centers.map((lab) => ({ lab, count: 0, representative: null, distance: Infinity }));
  let total = 0;
  for (const point of points) {
    const match = nearest(point.lab),
      bin = bins[match.index];
    bin.count += point.count;
    total += point.count;
    if (match.distance < bin.distance) {
      bin.representative = point;
      bin.distance = match.distance;
    }
  }
  return bins
    .filter((bin) => bin.count)
    .map((bin) => {
      const chroma = Math.hypot(bin.lab[1], bin.lab[2]);
      const representative = fromRGBA(...bin.representative.rgb);
      return {
        color: toHex(representative),
        oklab: bin.lab.slice(),
        count: bin.count,
        coverage: bin.count / total,
        chroma,
        hue: representative.s === 0 ? null : representative.h,
        contrast: contrastRGB(bin.representative.rgb, background),
      };
    })
    .sort((a, b) => b.count - a.count || (a.color < b.color ? -1 : a.color > b.color ? 1 : 0));
}

/** Symmetric, deterministic greedy transport; it is not an optimal-transport solver. */
function transport(first, second) {
  if (!first.length && !second.length) return 0;
  if (!first.length || !second.length) return null;
  const edges = [];
  for (let a = 0; a < first.length; a++)
    for (let b = 0; b < second.length; b++) {
      edges.push({ a, b, distance: Math.sqrt(labDistanceSquared(first[a].oklab, second[b].oklab)) });
    }
  // Ties only route equal-cost mass; row/column tie order is explicit and stable.
  edges.sort((a, b) => a.distance - b.distance || a.a - b.a || a.b - b.b);
  const left = first.map((cluster) => cluster.coverage),
    right = second.map((cluster) => cluster.coverage);
  let distance = 0;
  for (const edge of edges) {
    const amount = Math.min(left[edge.a], right[edge.b]);
    distance += amount * edge.distance;
    left[edge.a] -= amount;
    right[edge.b] -= amount;
  }
  return distance;
}

export function paletteDrift(first, second) {
  const forward = transport(first, second);
  return forward === null ? null : (forward + transport(second, first)) / 2;
}
