import { assert, number, options, text } from '../core/validate.js';
import { toRGBA, toHex } from '../color/space.js';
import { addRGB, clusterPalette, paletteDrift } from './palette-clusters.js';
import { coverageBalance, paletteHarmony } from './palette-policy.js';

const MAX_PIXELS = 16777216;
const MAX_SAMPLES = 65536;
const MAX_GROUPS = 64;
const MAX_ELEMENTS = 4096;
const PROTOCOL = 'explainerkit.palette-audit/1';
const typedArray = Object.getPrototypeOf(Uint8Array.prototype);
const viewLength = Object.getOwnPropertyDescriptor(typedArray, 'length').get;
const viewBuffer = Object.getOwnPropertyDescriptor(typedArray, 'buffer').get;

function arrayData(value, limit, name) {
  assert(Array.isArray(value) && value.length <= limit, 'RESOURCE_LIMIT', `${name} needs at most ${limit} entries.`);
  assert(
    Reflect.ownKeys(value).length === value.length + 1,
    'INVALID_PALETTE_AUDIT',
    `${name} needs dense indexed data without extra properties.`,
  );
  const result = [];
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    assert(
      descriptor && descriptor.enumerable && 'value' in descriptor,
      'INVALID_PALETTE_AUDIT',
      `${name} cannot contain holes or accessors.`,
    );
    result.push(descriptor.value);
  }
  return result;
}

function capturePixels(raw) {
  options(raw, ['width', 'height', 'data'], 'palette pixels');
  const width = number(raw.width, 'image width', 1, 16384),
    height = number(raw.height, 'image height', 1, 16384);
  assert(
    Number.isInteger(width) && Number.isInteger(height),
    'INVALID_PALETTE_AUDIT',
    'Image dimensions must be integers.',
  );
  assert(width * height <= MAX_PIXELS, 'RESOURCE_LIMIT', 'RGBA images may contain at most 16,777,216 pixels (64 MiB).');
  const data = raw.data,
    prototype = data && Object.getPrototypeOf(data);
  assert(
    prototype === Uint8Array.prototype || prototype === Uint8ClampedArray.prototype,
    'INVALID_PALETTE_AUDIT',
    'Use a Uint8Array or Uint8ClampedArray of straight-alpha RGBA bytes.',
  );
  assert(
    viewLength.call(data) === width * height * 4,
    'INVALID_PALETTE_AUDIT',
    'RGBA byte length must equal width × height × 4.',
  );
  assert(
    Object.getPrototypeOf(viewBuffer.call(data)) === ArrayBuffer.prototype,
    'INVALID_PALETTE_AUDIT',
    'Shared pixel buffers are not deterministic input.',
  );
  return { width, height, data, count: width * height };
}

function capturePolicy(raw = {}) {
  options(raw, ['balanceTarget', 'hueTolerance', 'chromaThreshold', 'minimumShare'], 'palette policy');
  let target = raw.balanceTarget === undefined ? [0.6, 0.3, 0.1] : raw.balanceTarget;
  if (target !== null) {
    target = arrayData(target, 3, 'balance target');
    assert(target.length === 3, 'INVALID_PALETTE_AUDIT', 'A coverage balance target needs three shares.');
    target = target.map((value) => number(value, 'target share', 0, 1));
    assert(
      Math.abs(target.reduce((sum, share) => sum + share, 0) - 1) <= 1e-9,
      'INVALID_PALETTE_AUDIT',
      'Coverage balance target shares must sum to 1.',
    );
  }
  return {
    balanceTarget: target,
    hueTolerance: number(raw.hueTolerance ?? 20, 'hue tolerance', 1, 30),
    chromaThreshold: number(raw.chromaThreshold ?? 0.03, 'chroma threshold', 0, 0.5),
    minimumShare: number(raw.minimumShare ?? 0.02, 'minimum harmony share', 0, 1),
  };
}

function captureGroups(raw = {}) {
  assert(
    raw && (Object.getPrototypeOf(raw) === Object.prototype || Object.getPrototypeOf(raw) === null),
    'INVALID_PALETTE_AUDIT',
    'Groups must be a plain record of named solid-color arrays.',
  );
  const keys = Reflect.ownKeys(raw);
  assert(keys.length <= MAX_GROUPS, 'RESOURCE_LIMIT', 'Palette audits allow at most 64 groups.');
  const result = [],
    budget = { elements: 0 };
  for (const key of keys) {
    assert(typeof key === 'string' && key.length > 0, 'INVALID_PALETTE_AUDIT', 'Group names must be nonempty strings.');
    text(key, 'group name', 128);
    const descriptor = Object.getOwnPropertyDescriptor(raw, key);
    assert(
      descriptor.enumerable && 'value' in descriptor,
      'INVALID_PALETTE_AUDIT',
      'Group properties cannot be accessors or hidden.',
    );
    const fills = arrayData(descriptor.value, MAX_ELEMENTS - budget.elements, 'group fills');
    budget.elements += fills.length;
    result.push({ name: key, fills: fills.map((fill) => toRGBA(fill)) });
  }
  return result.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Bounded pixel measurements and explicit palette heuristics; never reads the DOM or installs a clock. */
export function auditPalette(spec) {
  options(spec, ['pixels', 'background', 'groups', 'maxColors', 'maxSamples', 'policy'], 'palette audit');
  const image = capturePixels(spec.pixels);
  const background = toRGBA(spec.background ?? '#ffffff');
  assert(background[3] === 1, 'INVALID_PALETTE_AUDIT', 'The compositing/contrast background must be opaque.');
  const maxColors = number(spec.maxColors ?? 8, 'palette cluster limit', 1, 16);
  const maxSamples = number(spec.maxSamples ?? MAX_SAMPLES, 'palette sample limit', 1, MAX_SAMPLES);
  assert(
    Number.isInteger(maxColors) && Number.isInteger(maxSamples),
    'INVALID_PALETTE_AUDIT',
    'Cluster/sample limits must be integers.',
  );
  const policy = capturePolicy(spec.policy),
    groups = captureGroups(spec.groups);
  const histogram = new Map(),
    sampledPixels = Math.min(image.count, maxSamples);
  for (let sample = 0; sample < sampledPixels; sample++) {
    const offset = Math.floor(((sample + 0.5) * image.count) / sampledPixels) * 4;
    addRGB(
      histogram,
      [image.data[offset] / 255, image.data[offset + 1] / 255, image.data[offset + 2] / 255],
      image.data[offset + 3] / 255,
      background,
    );
  }
  const clusters = clusterPalette(histogram, maxColors, background),
    balance = coverageBalance(clusters, policy.balanceTarget);
  const groupReports = groups.map((group) => {
    const colors = new Map();
    for (const fill of group.fills) addRGB(colors, fill.slice(0, 3), fill[3], background);
    const groupClusters = clusterPalette(colors, maxColors, background);
    return {
      name: group.name,
      elements: group.fills.length,
      clusters: groupClusters,
      harmony: paletteHarmony(groupClusters, policy),
    };
  });
  return freeze({
    protocol: PROTOCOL,
    background: toHex(spec.background ?? '#ffffff'),
    image: {
      width: image.width,
      height: image.height,
      pixels: image.count,
      sampledPixels,
      sampling: 'stratified-linear',
      compositing: 'encoded-srgb-straight-alpha',
    },
    clusters,
    harmony: paletteHarmony(clusters, policy),
    balance,
    groups: groupReports,
    score: balance.score,
    reasons: [
      {
        rule: 'coverageBalance',
        score: balance.score,
        message:
          balance.score === null
            ? 'Coverage balance scoring is disabled.'
            : 'Score is agreement with the configured coverage target, not an aesthetic rating.',
      },
    ],
    policy: { ...policy, maxColors, maxSamples, iterations: 8, seedSeparation: 0.025 },
  });
}

function reportClusters(raw) {
  const clusters = arrayData(raw, 16, 'report clusters').map((cluster) => {
    options(cluster, ['color', 'oklab', 'count', 'coverage', 'chroma', 'hue', 'contrast'], 'palette report cluster');
    const lab = arrayData(cluster.oklab, 3, 'OKLab coordinates');
    assert(lab.length === 3, 'INVALID_PALETTE_AUDIT', 'An OKLab cluster requires three coordinates.');
    return {
      oklab: lab.map((value) => number(value, 'OKLab coordinate', -2, 2)),
      coverage: number(cluster.coverage, 'cluster coverage', 0, 1),
    };
  });
  assert(
    !clusters.length || Math.abs(clusters.reduce((sum, cluster) => sum + cluster.coverage, 0) - 1) < 1e-7,
    'INVALID_PALETTE_AUDIT',
    'Report cluster coverage must sum to 1.',
  );
  // Greedy transport ties must depend on the distribution, not serialized array order.
  return clusters.sort(
    (a, b) => a.oklab[0] - b.oklab[0] || a.oklab[1] - b.oklab[1] || a.oklab[2] - b.oklab[2] || b.coverage - a.coverage,
  );
}

function captureReport(raw) {
  options(
    raw,
    ['protocol', 'background', 'image', 'clusters', 'harmony', 'balance', 'groups', 'score', 'reasons', 'policy'],
    'palette report',
  );
  assert(raw.protocol === PROTOCOL, 'INVALID_PALETTE_AUDIT', 'Compare reports created by auditPalette.');
  const clusters = reportClusters(raw.clusters);
  assert(clusters.length > 0, 'INVALID_PALETTE_AUDIT', 'A pixel palette report needs at least one cluster.');
  const names = new Set();
  let aggregateElements = 0;
  const groups = arrayData(raw.groups, MAX_GROUPS, 'report groups').map((group) => {
    options(group, ['name', 'elements', 'clusters', 'harmony'], 'palette report group');
    const name = text(group.name, 'group name', 128);
    assert(
      name.length > 0 && !names.has(name),
      'INVALID_PALETTE_AUDIT',
      'Report group names must be nonempty and unique.',
    );
    names.add(name);
    const elements = number(group.elements, 'group element count', 0, MAX_ELEMENTS);
    assert(Number.isInteger(elements), 'INVALID_PALETTE_AUDIT', 'Group element counts must be integers.');
    aggregateElements += elements;
    assert(
      aggregateElements <= MAX_ELEMENTS,
      'RESOURCE_LIMIT',
      'Compared reports allow at most 4096 aggregate group elements.',
    );
    const distribution = reportClusters(group.clusters);
    assert(
      (elements === 0) === (distribution.length === 0),
      'INVALID_PALETTE_AUDIT',
      'Empty groups need zero elements and no clusters; populated groups need both.',
    );
    return { name, elements, clusters: distribution };
  });
  return { clusters, groups };
}

/** Compare composited color distributions, including count-based distributions of named groups. */
export function comparePalettes(a, b, spec = {}) {
  options(spec, ['threshold'], 'palette comparison');
  const threshold = number(spec.threshold ?? 0.05, 'palette drift threshold', 0, 2);
  const first = captureReport(a),
    second = captureReport(b);
  const from = new Map(first.groups.map((group) => [group.name, group]));
  const to = new Map(second.groups.map((group) => [group.name, group]));
  const names = [...new Set([...from.keys(), ...to.keys()])].sort();
  const groups = names.map((name) => {
    const before = from.get(name),
      after = to.get(name);
    const drift = before && after ? paletteDrift(before.clusters, after.clusters) : null;
    const change = !before ? 'added' : !after ? 'removed' : drift === null || drift > threshold ? 'changed' : 'stable';
    return {
      name,
      change,
      changed: change !== 'stable',
      drift,
      elementsFrom: before?.elements ?? null,
      elementsTo: after?.elements ?? null,
    };
  });
  const drift = paletteDrift(first.clusters, second.clusters);
  return freeze({
    protocol: 'explainerkit.palette-comparison/1',
    method: 'symmetric-greedy-oklab-transport',
    drift,
    threshold,
    changed: drift > threshold || groups.some((group) => group.changed),
    groups,
  });
}
