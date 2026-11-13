import { assert, number, options, safeCopy } from '../core/validate.js';
import { solveTwoBone } from './two-bone.js';
import { solveRigGoals } from './goals.js';

const TAU = 2 * Math.PI;
const freezePoint = (p) => Object.freeze(p);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function rootSpec(value = {}) {
  options(value, ['x', 'y', 'rotation'], 'root');
  return Object.freeze({
    x: number(value.x ?? 0, 'root x', -1e6, 1e6),
    y: number(value.y ?? 0, 'root y', -1e6, 1e6),
    rotation: number(value.rotation ?? 0, 'root rotation', -1e4, 1e4),
  });
}

/** Compile a bounded 2D bone forest. All poses belong to this skeleton. */
export function skeleton(spec = {}) {
  options(spec, ['bones', 'root'], 'skeleton');
  const input = safeCopy(spec.bones);
  assert(Array.isArray(input) && input.length > 0 && input.length <= 128, 'RESOURCE_LIMIT', 'Use 1–128 bones.');
  const byId = new Map(),
    ordered = [],
    visiting = new Set();
  for (const b of input) {
    options(b, ['id', 'parent', 'length', 'angle', 'limits'], 'bone');
    assert(
      typeof b.id === 'string' &&
        /^[A-Za-z][\w-]{0,63}$/.test(b.id) &&
        !['constructor', 'prototype', '__proto__'].includes(b.id),
      'INVALID_BONE',
      'Use a unique short bone name.',
    );
    assert(!byId.has(b.id), 'DUPLICATE_ID', `Duplicate bone ${b.id}.`);
    const limits = b.limits ?? [-Math.PI, Math.PI];
    assert(Array.isArray(limits) && limits.length === 2, 'INVALID_RIG', 'Limits need [minimum, maximum].');
    const min = number(limits[0], 'minimum angle', -1e4, 1e4),
      max = number(limits[1], 'maximum angle', -1e4, 1e4);
    assert(max > min, 'INVALID_RIG', 'Joint limits must have positive width.');
    const angle = number(b.angle ?? 0, 'rest angle', min, max);
    assert(
      b.parent === undefined || b.parent === null || typeof b.parent === 'string',
      'INVALID_BONE',
      'A parent must be a bone name or null.',
    );
    byId.set(
      b.id,
      Object.freeze({
        id: b.id,
        parent: b.parent ?? null,
        length: number(b.length, 'bone length', 1e-6, 1e5),
        angle,
        limits: Object.freeze([min, max]),
      }),
    );
  }
  function visit(b) {
    if (ordered.includes(b)) return;
    assert(!visiting.has(b.id), 'RIG_CYCLE', 'Bone parents must form an acyclic forest.');
    visiting.add(b.id);
    if (b.parent !== null) {
      assert(byId.has(b.parent), 'UNKNOWN_BONE', `Missing parent ${b.parent}.`);
      visit(byId.get(b.parent));
    }
    visiting.delete(b.id);
    ordered.push(b);
  }
  for (const b of byId.values()) visit(b);
  assert(
    ordered.reduce((s, b) => s + b.length, 0) <= 1e6,
    'RESOURCE_LIMIT',
    'Total bone length exceeds 1,000,000 units.',
  );
  const bones = Object.freeze(ordered),
    boneIds = Object.freeze(bones.map((b) => b.id)),
    defaultRoot = rootSpec(spec.root),
    owned = new WeakSet(),
    ownedRoots = new WeakSet([defaultRoot]);
  function pose(value = {}) {
    options(value, ['angles', 'root', 'scale'], 'pose');
    const angles = value.angles ?? {};
    options(angles, boneIds, 'pose angles');
    // Per-pose length factors (squash and stretch): a scaled bone moves its children's starts with it.
    const scales = value.scale ?? {};
    options(scales, boneIds, 'pose scale');
    const requestedRoot = value.root ?? defaultRoot,
      origin = ownedRoots.has(requestedRoot) ? requestedRoot : rootSpec(requestedRoot),
      map = new Map(),
      local = Object.create(null),
      factor = Object.create(null);
    for (const b of bones) {
      const a = number(angles[b.id] ?? b.angle, `${b.id} angle`, ...b.limits),
        k = number(scales[b.id] ?? 1, `${b.id} scale`, 0.01, 100),
        parent = map.get(b.parent),
        length = b.length * k;
      const start = parent?.end ?? freezePoint({ x: origin.x, y: origin.y }),
        rotation = (parent?.rotation ?? origin.rotation) + a;
      local[b.id] = a;
      factor[b.id] = k;
      map.set(
        b.id,
        Object.freeze({
          id: b.id,
          parent: b.parent,
          start,
          end: freezePoint({ x: start.x + length * Math.cos(rotation), y: start.y + length * Math.sin(rotation) }),
          rotation,
          angle: a,
          length,
          scale: k,
        }),
      );
    }
    const result = Object.freeze({
      root: origin,
      angles: Object.freeze(local),
      scale: Object.freeze(factor),
      bones: Object.freeze([...map.values()]),
    });
    owned.add(result);
    ownedRoots.add(origin);
    return result;
  }
  function requirePose(p) {
    assert(owned.has(p), 'FOREIGN_POSE', 'Use a pose from this skeleton.');
    return p;
  }
  function socket(p, id, localSpec1 = {}) {
    requirePose(p);
    options(localSpec1, ['along', 'offset', 'rotation'], 'socket');
    assert(typeof id === 'string', 'UNKNOWN_BONE', 'A socket needs a bone name.');
    const b = p.bones.find((localB2) => localB2.id === id);
    assert(b, 'UNKNOWN_BONE', `Unknown bone ${id}.`);
    const along = number(localSpec1.along ?? 1, 'socket along', 0, 1),
      offset = number(localSpec1.offset ?? 0, 'socket offset', -1e5, 1e5);
    return Object.freeze({
      x: b.start.x + (b.end.x - b.start.x) * along - Math.sin(b.rotation) * offset,
      y: b.start.y + (b.end.y - b.start.y) * along + Math.cos(b.rotation) * offset,
      rotation: b.rotation + number(localSpec1.rotation ?? 0, 'socket rotation', -1e4, 1e4),
    });
  }
  function blend(a, b, mix) {
    requirePose(a);
    requirePose(b);
    number(mix, 'pose mix', 0, 1);
    if (mix === 0) return a;
    if (mix === 1) return b;
    // Signed local interpolation preserves the convex interval of every hinge.
    const angles = Object.fromEntries(
      bones.map((bone) => [bone.id, a.angles[bone.id] + (b.angles[bone.id] - a.angles[bone.id]) * mix]),
    );
    const root = Object.fromEntries(['x', 'y', 'rotation'].map((k) => [k, a.root[k] + (b.root[k] - a.root[k]) * mix]));
    const scale = Object.fromEntries(
      bones.map((bone) => [bone.id, a.scale[bone.id] + (b.scale[bone.id] - a.scale[bone.id]) * mix]),
    );
    return pose({ angles, root, scale });
  }
  /** Bounded CCD. An approximate best candidate is never labelled converged. */
  function solve(localSpec3 = {}) {
    options(
      localSpec3,
      ['end', 'target', 'from', 'chainRoot', 'iterations', 'tolerance', 'restarts', 'unreachable'],
      'IK',
    );
    assert(byId.has(localSpec3.end), 'UNKNOWN_BONE', 'IK end must name a bone.');
    options(localSpec3.target, ['x', 'y'], 'IK target');
    const target = freezePoint({
      x: number(localSpec3.target.x, 'target x', -2e6, 2e6),
      y: number(localSpec3.target.y, 'target y', -2e6, 2e6),
    });
    const from = requirePose(localSpec3.from ?? pose()),
      chain = [];
    let b = byId.get(localSpec3.end);
    while (b) {
      chain.push({ ...b, length: b.length * from.scale[b.id] });
      if (b.id === localSpec3.chainRoot) break;
      b = byId.get(b.parent);
    }
    assert(
      localSpec3.chainRoot === undefined || chain.at(-1).id === localSpec3.chainRoot,
      'INVALID_CHAIN',
      'chainRoot must be an ancestor of end.',
    );
    const iterations = number(localSpec3.iterations ?? 80, 'IK iterations', 1, 256),
      restarts = number(localSpec3.restarts ?? 2, 'IK restarts', 0, 4),
      tolerance = number(localSpec3.tolerance ?? 0.01, 'IK tolerance', 1e-8, 1e4);
    assert(
      Number.isInteger(iterations) && Number.isInteger(restarts),
      'INVALID_RIG',
      'Iteration counts must be integers.',
    );
    assert(
      bones.length * chain.length * iterations * (restarts + 1) <= 2000000,
      'RESOURCE_LIMIT',
      'IK work exceeds the bounded solve budget.',
    );
    const policy = localSpec3.unreachable ?? 'report';
    assert(['report', 'error'].includes(policy), 'INVALID_RIG', 'Use report or error for unreachable.');
    const endpoint = (p) => p.bones.find((localB4) => localB4.id === localSpec3.end).end;
    const base = from.bones.find((localB5) => localB5.id === chain.at(-1).id).start;
    const length = chain.reduce((s, localB6) => s + localB6.length, 0),
      inner = Math.max(0, 2 * Math.max(...chain.map((localB7) => localB7.length)) - length),
      d = distance(base, target);
    const withinReach = d <= length + tolerance && d >= inner - tolerance;
    let best = from,
      error = distance(endpoint(from), target),
      work = 0,
      exhausted = false;
    for (let attempt = 0; attempt <= restarts && error > tolerance; attempt++) {
      const angles = { ...from.angles };
      if (attempt && chain.length > 1 && d > Math.abs(length - 2 * chain[0].length) + tolerance) {
        // A two-link aggregate seeds near-straight reaches where plain CCD is slow.
        // It is only a candidate: all original hinge limits still apply.
        const leaf = chain[0],
          first = chain.at(-1),
          basePose = from.bones.find((localB8) => localB8.id === first.id);
        const seed = solveTwoBone({
          root: base,
          lengths: [length - leaf.length, leaf.length],
          target,
          bend: attempt % 2 ? 1 : -1,
        });
        for (const localB9 of chain) angles[localB9.id] = clamp(0, ...localB9.limits);
        const heading = seed.angles[0] - (basePose.rotation - basePose.angle);
        angles[first.id] = clamp(heading + TAU * Math.round((from.angles[first.id] - heading) / TAU), ...first.limits);
        angles[leaf.id] = clamp(seed.angles[1], ...leaf.limits);
      } else if (attempt)
        chain.forEach((localB10, i) => {
          angles[localB10.id] = clamp(
            angles[localB10.id] + (attempt % 2 ? 1 : -1) * 0.45 * (i % 2 ? 1 : -1),
            ...localB10.limits,
          );
        });
      let current = pose({ angles, root: from.root, scale: from.scale }),
        previous = distance(endpoint(current), target),
        stopped = false;
      if (previous < error) {
        best = current;
        error = previous;
      }
      for (let i = 0; i < iterations && error > tolerance; i++) {
        work++;
        for (const joint of chain) {
          const pivot = current.bones.find((localB11) => localB11.id === joint.id).start,
            tip = endpoint(current);
          const ux = tip.x - pivot.x,
            uy = tip.y - pivot.y,
            vx = target.x - pivot.x,
            vy = target.y - pivot.y;
          if (Math.hypot(ux, uy) < 1e-12 || Math.hypot(vx, vy) < 1e-12) continue;
          const delta = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy),
            old = angles[joint.id],
            ideal = old + delta;
          // Equivalent angles and interval boundaries handle crossing ±pi.
          const [lo, hi] = joint.limits,
            k0 = Math.round((old - ideal) / TAU),
            choices = [old, lo, hi];
          for (let k = k0 - 1; k <= k0 + 1; k++) choices.push(clamp(ideal + k * TAU, lo, hi));
          let chosen = old,
            localError = distance(tip, target);
          for (const q of choices) {
            const a = q - old,
              c = Math.cos(a),
              s = Math.sin(a),
              e = Math.hypot(pivot.x + ux * c - uy * s - target.x, pivot.y + ux * s + uy * c - target.y);
            if (
              e < localError - 1e-12 ||
              (Math.abs(e - localError) <= 1e-12 && Math.abs(q - old) < Math.abs(chosen - old))
            ) {
              chosen = q;
              localError = e;
            }
          }
          angles[joint.id] = chosen;
          current = pose({ angles, root: from.root, scale: from.scale });
        }
        const next = distance(endpoint(current), target);
        if (next < error) {
          best = current;
          error = next;
        }
        if (previous - next < 1e-12) {
          stopped = true;
          break;
        }
        previous = next;
      }
      if (error > tolerance && !stopped) exhausted = true;
    }
    const converged = error <= tolerance,
      status = converged ? 'converged' : !withinReach ? 'unreachable' : exhausted ? 'iterationLimit' : 'stalled';
    assert(policy !== 'error' || converged, 'IK_NOT_CONVERGED', `IK ${status}; residual ${error}.`);
    return Object.freeze({ pose: best, target, error, converged, withinReach, status, iterations: work });
  }
  const model = { bones, pose, solve, blend, socket };
  model.solveGoals = (localSpec12) => solveRigGoals(model, localSpec12);
  return Object.freeze(model);
}
