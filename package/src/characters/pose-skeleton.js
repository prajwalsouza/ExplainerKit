import { assert, number, options, safeCopy } from '../core/validate.js';
import { skeleton } from '../rigs/skeleton.js';
import { solveTwoBone } from '../rigs/two-bone.js';
import {
  poseCameraReader,
  invertPoseCamera,
  measuredPosePoint,
  transformPosePoint,
  poseCameraMatrix,
} from './rotoscope.js';
const CHAIN_NAMES = ['armLeft', 'armRight', 'legLeft', 'legRight'];
const LABELS = { armLeft: 'handLeft', armRight: 'handRight', legLeft: 'footLeft', legRight: 'footRight' };
const median = (values) => {
  const a = [...values].sort((x, y) => x - y),
    n = a.length;
  return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
};
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const heading = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
const mean = (points) =>
  points.length ? points.reduce((a, b) => [a[0] + b[0] / points.length, a[1] + b[1] / points.length], [0, 0]) : null;
const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const frozenPoint = (p) => Object.freeze({ x: p[0], y: p[1] });

/** Fill missing measurements once; sampling later has no temporal solver state. */
function measuredCurve(
  times,
  input,
  { angle = false, maxGapFrames, nominalStep, name, evidence, despikeFrames = 0, filterChanges },
) {
  const values = input.map((value) => (Array.isArray(value) ? [...value] : value)),
    status = input.map((v, i) => (v === null ? 'missing' : (evidence?.[i] ?? 'measured'))),
    breakBefore = new Set();
  let previous = null;
  if (angle)
    for (let i = 0; i < values.length; i++)
      if (values[i] !== null) {
        if (previous !== null) values[i] = previous + angleDelta(previous, values[i]);
        previous = values[i];
      }
  assert(
    values.some((v) => v !== null),
    'POSE_FIT_INCOMPLETE',
    `No measured ${name} is available.`,
  );
  const mix = (a, b, k) => (Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * k) : a + (b - a) * k);
  for (let i = 0; i < values.length;) {
    if (values[i] !== null) {
      i++;
      continue;
    }
    const start = i;
    while (i < values.length && values[i] === null) i++;
    const end = i - 1,
      left = start - 1,
      right = i < values.length ? i : -1,
      missing = end - start + 1,
      short =
        left >= 0 &&
        right >= 0 &&
        missing <= maxGapFrames &&
        times[right] - times[left] <= nominalStep * (maxGapFrames + 1) * 1.05;
    for (let j = start; j <= end; j++) {
      values[j] = short
        ? mix(values[left], values[right], (times[j] - times[left]) / (times[right] - times[left]))
        : left >= 0
          ? values[left]
          : values[right];
      status[j] = short ? 'interpolated' : 'held';
    }
    if (!short && right >= 0) breakBefore.add(right);
  }
  // Work from a snapshot so a centred filter never cascades in time or crosses missing evidence.
  if (despikeFrames) {
    const original = values.map((v) => (Array.isArray(v) ? [...v] : v)),
      changes = [];
    for (let i = despikeFrames; i < values.length - despikeFrames; i++) {
      const from = i - despikeFrames,
        to = i + despikeFrames;
      if (status.slice(from, to + 1).some((v) => v !== 'measured' && v !== 'estimated')) continue;
      const window = original.slice(from, to + 1),
        filtered = Array.isArray(original[i])
          ? original[i].map((_, axis) => median(window.map((v) => v[axis])))
          : median(window),
        delta = Array.isArray(filtered) ? distance(filtered, original[i]) : Math.abs(filtered - original[i]);
      if (delta > 1e-12) {
        values[i] = filtered;
        changes.push({ index: i, time: times[i], delta });
      }
    }
    filterChanges[name] = Object.freeze(changes.map((value) => Object.freeze(value)));
  }
  const statusAt = (time) => {
    let i = 0,
      j = times.length;
    while (i < j) {
      const middle = (i + j) >> 1;
      if (times[middle] <= time + 1e-9) i = middle + 1;
      else j = middle;
    }
    const index = Math.max(0, i - 1);
    if (Math.abs(times[index] - time) < 1e-8 || index === times.length - 1) return status[index];
    return breakBefore.has(index + 1) || (status[index] === 'held' && status[index + 1] === 'held')
      ? 'held'
      : 'interpolated';
  };
  const at = (time) => {
    if (time <= times[0]) return values[0];
    if (time >= times.at(-1)) return values.at(-1);
    let lo = 0,
      hi = times.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= time) lo = mid;
      else hi = mid;
    }
    if (breakBefore.has(hi)) return values[lo];
    return mix(values[lo], values[hi], (time - times[lo]) / (times[hi] - times[lo]));
  };
  return { values, status, statusAt, at, breakBefore };
}
function measuredRows(track, camera, threshold, labels) {
  assert(
    track && (Object.getPrototypeOf(track) === Object.prototype || Object.getPrototypeOf(track) === null),
    'INVALID_POSE_TRACK',
    'Use a plain measured pose record.',
  );
  const protocol = Object.getOwnPropertyDescriptor(track, 'protocol'),
    sampleData = Object.getOwnPropertyDescriptor(track, 'samples');
  assert(
    protocol && 'value' in protocol && protocol.value === 'explainerkit.pose/2' && sampleData && 'value' in sampleData,
    'INVALID_POSE_TRACK',
    'Use explainerkit.pose/2 data properties.',
  );
  const samples = sampleData.value;
  assert(
    Array.isArray(samples) &&
      samples.length >= 2 &&
      samples.length <= 10000 &&
      Reflect.ownKeys(samples).length === samples.length + 1,
    'INVALID_POSE_TRACK',
    'Fit2–10000 dense native pose frames.',
  );
  let previous = -1,
    totalValues = 0;
  return Array.from({ length: samples.length }, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(samples, index);
    assert(descriptor && 'value' in descriptor, 'INVALID_POSE_TRACK', 'Pose frames cannot contain holes or accessors.');
    const budget = { count: 0 },
      row = safeCopy(descriptor.value, 0, budget);
    totalValues += budget.count;
    assert(totalValues <= 2000000, 'RESOURCE_LIMIT', 'Dense pose input exceeds two million captured values.');
    const time = number(row.t, 'pose frame time', 0, 86400);
    assert(time > previous, 'INVALID_POSE_TRACK', 'Pose frame times must increase.');
    previous = time;
    const pose = row.pose,
      confidence = row.confidence ?? pose?.confidence ?? null;
    if (confidence !== null) number(confidence, 'pose frame confidence', 0, 1);
    const out = {
      time,
      confidence,
      head: null,
      neck: null,
      hip: null,
      limbs: {},
      headRadius: null,
      reason: null,
      invalidLimbs: [],
      invalidSegments: [],
      limbEvidence: {},
      neckEvidence: 'measured',
      hipEvidence: 'measured',
    };
    if (!pose || (confidence !== null && confidence < threshold)) {
      out.reason = pose ? 'confidence' : 'pose-missing';
      return out;
    }
    const value = camera(time);
    if (value == null) {
      out.reason = 'camera-unavailable';
      return out;
    }
    const inverse = invertPoseCamera(poseCameraMatrix(value)),
      world = (point) => transformPosePoint(inverse, measuredPosePoint(point, 'measured joint'));
    if (pose.head) {
      out.head = world(pose.head);
      if (pose.head.r !== undefined)
        out.headRadius =
          number(pose.head.r, 'measured head radius', 0.000001, 1e6) *
          Math.sqrt(Math.abs(inverse[0] * inverse[3] - inverse[1] * inverse[2]));
    }
    const labelled = pose.labelled ?? {},
      confidenceLimbs = labelled.confidence ?? null;
    if (confidenceLimbs !== null) number(confidenceLimbs, 'labelled confidence', 0, 1);
    const labelledAvailable =
      labelled.status === undefined || ['measured', 'partial', 'estimated'].includes(labelled.status);
    if (!labelledAvailable)
      for (const name of CHAIN_NAMES)
        if (labelled.limbs?.[labels[name]])
          out.invalidLimbs.push({ limb: name, reason: 'label-status-' + labelled.status });
    if (labelledAvailable && (confidenceLimbs === null || confidenceLimbs >= threshold))
      for (const name of CHAIN_NAMES) {
        const chain = labelled.limbs?.[labels[name]],
          localConfidence = labelled.limbConfidence?.[labels[name]];
        if (localConfidence !== undefined && number(localConfidence, 'limb confidence', 0, 1) < threshold) continue;
        if (chain === undefined) continue;
        assert(
          Array.isArray(chain) && chain.length >= 3 && chain.length <= 128,
          'INVALID_POSE_TRACK',
          'Each fitted limb needs3–128 ordered joint points.',
        );
        let points = chain.map(world);
        if (name.startsWith('leg') && points.length > 3) {
          const total = points.slice(1).reduce((sum, p, i) => sum + distance(points[i], p), 0);
          if (distance(points.at(-2), points.at(-1)) < 0.3 * total) points = points.slice(0, -1);
        }
        if (points.length > 3) {
          const a = points[0],
            c = points.at(-1),
            norm = Math.max(1e-9, distance(a, c));
          let bend = points[1],
            maximum = -1;
          for (const p of points.slice(1, -1)) {
            const area = Math.abs((c[0] - a[0]) * (p[1] - a[1]) - (c[1] - a[1]) * (p[0] - a[0])) / norm;
            if (area > maximum) {
              maximum = area;
              bend = p;
            }
          }
          points = [a, bend, c];
        }
        if (distance(points[0], points[1]) < 1e-6 || distance(points[1], points[2]) < 1e-6) {
          out.invalidLimbs.push({ limb: name, reason: 'degenerate-chain' });
          continue;
        }
        out.limbs[name] = points;
        out.limbEvidence[name] = labelled.status === 'estimated' ? 'estimated' : 'measured';
      }
    out.neck = pose.neck
      ? world(pose.neck)
      : labelled.neck
        ? world(labelled.neck)
        : mean(['armLeft', 'armRight'].map((name) => out.limbs[name]?.[0]).filter(Boolean));
    out.hip = pose.hip
      ? world(pose.hip)
      : mean(['legLeft', 'legRight'].map((name) => out.limbs[name]?.[0]).filter(Boolean));
    if (labelled.status === 'estimated') {
      if (!pose.neck) out.neckEvidence = 'estimated';
      if (!pose.hip) out.hipEvidence = 'estimated';
    }
    const neck = out.neck,
      hip = out.hip;
    if (out.head && neck && distance(out.head, neck) < 1e-6) {
      out.invalidSegments.push({ segment: 'neck', reason: 'degenerate-segment' });
      out.neck = null;
      out.hip = null;
    }
    if (neck && hip && distance(neck, hip) < 1e-6) {
      out.invalidSegments.push({ segment: 'torso', reason: 'degenerate-segment' });
      out.hip = null;
    }
    return out;
  });
}

/** Fit a head-anchored fixed-length skeleton at every supplied native frame. */
export function skeletonFromPoseTrack(track, spec = {}) {
  options(
    spec,
    [
      'camera',
      'confidence',
      'maxGapFrames',
      'bendThreshold',
      'bendFrames',
      'lengths',
      'labels',
      'fps',
      'symmetry',
      'split',
      'despike',
    ],
    'pose skeleton fit',
  );
  const confidence = number(spec.confidence ?? 0.6, 'pose fit confidence', 0, 1),
    maxGapFrames = number(spec.maxGapFrames ?? 3, 'short gap frames', 0, 120),
    bendThreshold = number(spec.bendThreshold ?? 0.03, 'bend evidence threshold', 0, 0.25),
    bendFrames = number(spec.bendFrames ?? 2, 'bend confirmation frames', 1, 30);
  assert(
    Number.isInteger(maxGapFrames) && Number.isInteger(bendFrames),
    'INVALID_POSE_FIT',
    'Frame counts must be integers.',
  );
  const symmetry = spec.symmetry === undefined ? null : spec.symmetry;
  assert(spec.symmetry === undefined || symmetry === 'pairs', 'INVALID_POSE_FIT', "Symmetry must be 'pairs'.");
  const split = spec.split === undefined ? 'median' : spec.split;
  if (split !== 'median') {
    number(split, 'upper limb fraction', 0, 1);
    assert(split > 0 && split < 1, 'INVALID_POSE_FIT', 'Upper limb fraction must be strictly between zero and one.');
  }
  let despikeFrames = 0;
  if (spec.despike !== undefined) {
    options(spec.despike, ['frames'], 'pose despike');
    despikeFrames = number(spec.despike.frames, 'despike half-window frames', 1, 5);
    assert(Number.isInteger(despikeFrames), 'INVALID_POSE_FIT', 'Despike frames must be an integer.');
  }
  const filterChanges = {},
    straightThreshold = 0.995;
  const labels = { ...LABELS, ...safeCopy(spec.labels ?? {}) };
  options(labels, CHAIN_NAMES, 'fitted limb labels');
  assert(
    Object.values(labels).every((v) => typeof v === 'string' && v.length > 0),
    'INVALID_POSE_FIT',
    'Limb labels must be nonempty names.',
  );
  const rows = measuredRows(track, poseCameraReader(spec.camera), confidence, labels),
    times = rows.map((r) => r.time),
    nominalStep = median(times.slice(1).map((t, i) => t - times[i])),
    curveOptions = { maxGapFrames, nominalStep, despikeFrames, filterChanges },
    calibration = {},
    lengths = {},
    overrides = { ...safeCopy(spec.lengths ?? {}) },
    boneNames = ['neck', 'torso', ...CHAIN_NAMES.flatMap((n) => [n + 'Anchor', n + 'Upper', n + 'Lower'])];
  options(overrides, boneNames, 'fixed pose bone lengths');
  const choose = (name, observations, method, allowZero = false) => {
    const override = overrides[name];
    assert(
      override !== undefined || observations.length > 0,
      'POSE_FIT_INCOMPLETE',
      `Cannot calibrate ${name} without measurements or an explicit length.`,
    );
    const value = number(
      override === undefined ? median(observations) : override,
      name + ' fixed length',
      allowZero ? 0 : 1e-6,
      1e5,
    );
    lengths[name] = value;
    calibration[name] = {
      method: override !== undefined ? 'override' : method,
      observations: observations.length,
      length: value,
    };
    return value;
  };
  choose(
    'neck',
    rows.filter((r) => r.head && r.neck).map((r) => distance(r.head, r.neck)),
    'segment-median',
  );
  choose(
    'torso',
    rows.filter((r) => r.neck && r.hip).map((r) => distance(r.neck, r.hip)),
    'segment-median',
  );
  const observationsFor = (name) => rows.filter((r) => r.limbs[name]).map((r) => r.limbs[name]);
  for (const name of CHAIN_NAMES) {
    const partner = name.endsWith('Left') ? name.replace('Left', 'Right') : name.replace('Right', 'Left'),
      own = observationsFor(name);
    assert(own.length > 0, 'POSE_FIT_INCOMPLETE', `At least one measured ${name} chain is required.`);
    const observations = symmetry === 'pairs' ? [...own, ...observationsFor(partner)] : own,
      upper = observations.map((p) => distance(p[0], p[1])),
      lower = observations.map((p) => distance(p[1], p[2])),
      straight = observations.filter((p, i) => distance(p[0], p[2]) >= straightThreshold * (upper[i] + lower[i])),
      ratio = split === 'median' ? median(upper.map((v, i) => v / (v + lower[i]))) : split,
      reach = straight.length ? median(straight.map((p) => distance(p[0], p[2]))) : median(upper) + median(lower),
      method = straight.length ? 'straight-reach-median' : 'segment-median';
    for (const [suffix, value] of [
      ['Upper', reach * ratio],
      ['Lower', reach * (1 - ratio)],
    ]) {
      if (symmetry === 'pairs') {
        const key = name + suffix,
          other = partner + suffix;
        assert(
          overrides[key] === undefined || overrides[other] === undefined || overrides[key] === overrides[other],
          'INVALID_POSE_FIT',
          'Paired length overrides must agree.',
        );
        if (overrides[key] === undefined && overrides[other] !== undefined) overrides[key] = overrides[other];
      }
      choose(name + suffix, [value], method);
      calibration[name + suffix].observations = straight.length || observations.length;
    }
    const body = name.startsWith('arm') ? 'neck' : 'hip',
      offsets = rows.filter((r) => r[body] && r.limbs[name]).map((r) => distance(r[body], r.limbs[name][0]));
    choose(name + 'Anchor', offsets, 'offset-median', true);
  }

  const bones = [
    { id: 'neck', length: lengths.neck, limits: [-1e4, 1e4] },
    { id: 'torso', parent: 'neck', length: lengths.torso, limits: [-1e4, 1e4] },
  ];
  for (const name of CHAIN_NAMES) {
    const parent = name.startsWith('arm') ? 'neck' : 'torso',
      anchor = lengths[name + 'Anchor'] > 1e-5;
    if (anchor) bones.push({ id: name + 'Anchor', parent, length: lengths[name + 'Anchor'], limits: [-1e4, 1e4] });
    bones.push(
      {
        id: name + 'Upper',
        parent: anchor ? name + 'Anchor' : parent,
        length: lengths[name + 'Upper'],
        limits: [-1e4, 1e4],
      },
      { id: name + 'Lower', parent: name + 'Upper', length: lengths[name + 'Lower'], limits: [-1e4, 1e4] },
    );
  }
  const model = skeleton({ bones }),
    rootCurve = measuredCurve(
      times,
      rows.map((r) => r.head),
      { ...curveOptions, name: 'head anchor' },
    ),
    curves = {},
    neckAngles = rows.map((r) => (r.head && r.neck ? heading(r.head, r.neck) : null));
  curves.neck = measuredCurve(times, neckAngles, {
    ...curveOptions,
    angle: true,
    name: 'neck direction',
    evidence: rows.map((r) => r.neckEvidence),
  });
  const neckEnd = (i) => {
    const p = rootCurve.values[i],
      a = curves.neck.values[i];
    return [p[0] + lengths.neck * Math.cos(a), p[1] + lengths.neck * Math.sin(a)];
  };
  curves.torso = measuredCurve(
    times,
    rows.map((r, i) => (r.hip ? heading(neckEnd(i), r.hip) - curves.neck.values[i] : null)),
    { ...curveOptions, angle: true, name: 'torso direction', evidence: rows.map((r) => r.hipEvidence) },
  );
  const bodyPose = (i) =>
    model.pose({
      root: frozenPoint(rootCurve.values[i]),
      angles: { neck: curves.neck.values[i], torso: curves.torso.values[i] },
    });
  for (const name of CHAIN_NAMES)
    if (lengths[name + 'Anchor'] > 1e-5) {
      const parent = name.startsWith('arm') ? 'neck' : 'torso';
      curves[name + 'Anchor'] = measuredCurve(
        times,
        rows.map((r, i) => {
          if (!r.limbs[name]) return null;
          const base = bodyPose(i).bones.find((b) => b.id === parent);
          return heading([base.end.x, base.end.y], r.limbs[name][0]) - base.rotation;
        }),
        { ...curveOptions, angle: true, name: name + ' anchor', evidence: rows.map((r) => r.limbEvidence[name]) },
      );
    }
  const solveErrors = {},
    bendChanges = {};
  for (const name of CHAIN_NAMES) {
    const upper = [],
      lower = [],
      changes = [];
    const initialEvidence = rows
      .map((row, index) => {
        const chain = row.limbs[name];
        if (!chain) return null;
        const [a, b, c] = chain,
          reach = lengths[name + 'Upper'] + lengths[name + 'Lower'];
        return { index, value: ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / (reach * reach) };
      })
      .find((value) => value && Math.abs(value.value) > bendThreshold);
    let branch = initialEvidence ? Math.sign(initialEvidence.value) : 1,
      pending = null,
      pendingCount = 0;
    solveErrors[name] = [];
    const anchorId = lengths[name + 'Anchor'] > 1e-5 ? name + 'Anchor' : name.startsWith('arm') ? 'neck' : 'torso';
    for (let i = 0; i < rows.length; i++) {
      const chain = rows[i].limbs[name];
      if (!chain) {
        upper.push(null);
        lower.push(null);
        pending = null;
        pendingCount = 0;
        continue;
      }
      const [a, b, c] = chain,
        reach = lengths[name + 'Upper'] + lengths[name + 'Lower'],
        evidence = ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / (reach * reach),
        candidate = Math.sign(evidence);
      if (Math.abs(evidence) > bendThreshold && candidate !== branch) {
        if (pending === candidate) pendingCount++;
        else {
          pending = candidate;
          pendingCount = 1;
        }
        if (pendingCount >= bendFrames) {
          changes.push({ time: times[i], from: branch, to: candidate, evidence });
          branch = candidate;
          pending = null;
          pendingCount = 0;
        }
      } else {
        pending = null;
        pendingCount = 0;
      }
      const angles = Object.fromEntries(Object.entries(curves).map(([id, curve]) => [id, curve.values[i]])),
        body = model.pose({ root: frozenPoint(rootCurve.values[i]), angles }),
        base = body.bones.find((bone) => bone.id === anchorId),
        solved = solveTwoBone({
          root: base.end,
          lengths: [lengths[name + 'Upper'], lengths[name + 'Lower']],
          target: { x: c[0], y: c[1] },
          bend: branch,
          unreachable: 'clamp',
        }); // At a fully folded equal-length chain the target gives no upper direction; retain the observed bend joint.
      const folded =
        Math.hypot(c[0] - base.end.x, c[1] - base.end.y) < 1e-6 &&
        Math.abs(lengths[name + 'Upper'] - lengths[name + 'Lower']) < 1e-6;
      upper.push((folded ? heading([base.end.x, base.end.y], b) : solved.angles[0]) - base.rotation);
      lower.push(folded ? branch * Math.PI : solved.angles[1]);
      solveErrors[name].push({ time: times[i], error: solved.error, reachable: solved.reachable });
    }
    curves[name + 'Upper'] = measuredCurve(times, upper, {
      ...curveOptions,
      angle: true,
      name: name + ' upper angle',
      evidence: rows.map((r) => r.limbEvidence[name]),
    });
    curves[name + 'Lower'] = measuredCurve(times, lower, {
      ...curveOptions,
      angle: true,
      name: name + ' lower angle',
      evidence: rows.map((r) => r.limbEvidence[name]),
    });
    bendChanges[name] = {
      initial: {
        branch: initialEvidence ? Math.sign(initialEvidence.value) : 1,
        method: initialEvidence ? 'clear-evidence' : 'straight-default',
        time: initialEvidence ? times[initialEvidence.index] : null,
      },
      changes,
    };
  }
  const start = times[0],
    end = times.at(-1),
    frameTimes =
      spec.fps === undefined
        ? times
        : (() => {
            const fps = number(spec.fps, 'output pose fps', 1, 240),
              count = Math.floor((end - start) * fps + 1e-8) + 1;
            assert(count <= 10000, 'RESOURCE_LIMIT', 'Resampled pose output exceeds10000 frames.');
            return Array.from({ length: count }, (_, i) => start + i / fps);
          })();
  const sample = (time) => {
    number(time, 'fitted pose time', 0, 86400);
    const root = rootCurve.at(time),
      angles = Object.fromEntries(Object.entries(curves).map(([id, curve]) => [id, curve.at(time)]));
    return model.pose({ root: frozenPoint(root), angles });
  };
  const indexAt = (time) => {
    let lo = 0,
      hi = times.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= time + 1e-9) lo = mid + 1;
      else hi = mid;
    }
    return Math.max(0, lo - 1);
  };
  const frames = frameTimes.map((time) => {
    const i = indexAt(time),
      exact = Math.abs(times[i] - time) < 1e-8,
      status = Object.fromEntries([
        ['head', rootCurve.statusAt(time)],
        ...Object.entries(curves).map(([id, curve]) => [id, curve.statusAt(time)]),
      ]);
    return Object.freeze({
      time,
      pose: sample(time),
      confidence: exact ? rows[i].confidence : null,
      status: Object.freeze(status),
    });
  });
  const coverage = Object.fromEntries(
    [['head', rootCurve], ...Object.entries(curves)].map(([id, curve]) => [
      id,
      Object.freeze({
        measured: curve.status.filter((v) => v === 'measured').length,
        estimated: curve.status.filter((v) => v === 'estimated').length,
        interpolated: curve.status.filter((v) => v === 'interpolated').length,
        held: curve.status.filter((v) => v === 'held').length,
      }),
    ]),
  );
  const diagnostics = {
    symmetry,
    split,
    straightThreshold,
    despike: Object.freeze({
      frames: despikeFrames,
      window: despikeFrames * 2 + 1,
      scope: 'observed-native-frames-only',
      evidence: 'measured-and-estimated-without-promotion',
      changes: Object.freeze(filterChanges),
    }),
    inputFrames: times.length,
    outputFrames: frames.length,
    nativeFramesPreserved: spec.fps === undefined,
    nominalFrameSeconds: nominalStep,
    maxGapFrames,
    coverage: Object.freeze(coverage),
    calibration: safeCopy(calibration),
    bendChanges: Object.freeze(
      Object.fromEntries(Object.entries(bendChanges).map(([name, data]) => [name, safeCopy(data)])),
    ),
    residuals: Object.freeze(
      Object.fromEntries(Object.entries(solveErrors).map(([name, data]) => [name, safeCopy(data)])),
    ),
    invalidLimbs: Object.freeze(
      rows.flatMap((row) => row.invalidLimbs.map((value) => Object.freeze({ time: row.time, ...value }))),
    ),
    invalidSegments: Object.freeze(
      rows.flatMap((row) => row.invalidSegments.map((value) => Object.freeze({ time: row.time, ...value }))),
    ),
    coverageScope: 'input-native-frames',
    inputValueBudget: 2000000,
    unavailableFrames: Object.freeze(
      rows.filter((r) => r.reason).map((r) => Object.freeze({ time: r.time, reason: r.reason })),
    ),
    confidencePolicy:
      'Unspecified confidence stays unknown; interpolation/holding is labelled, never promoted to measured.',
  };
  const radii = rows.map((r) => r.headRadius).filter((r) => r !== null);
  return Object.freeze({
    skeleton: model,
    frames: Object.freeze(frames),
    sample,
    lengths: Object.freeze(lengths),
    headRadius: radii.length ? median(radii) : null,
    diagnostics: Object.freeze(diagnostics),
  });
}
