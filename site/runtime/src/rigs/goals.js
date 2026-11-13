import { assert, number, options, safeCopy } from '../core/validate.js';
import { solveTwoBone } from './two-bone.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angular = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Hierarchical coordinate descent over a shared, immutable skeleton pose. */
export function solveRigGoals(model, spec = {}) {
  options(
    spec,
    ['goals', 'from', 'iterations', 'restarts', 'tolerance', 'angleTolerance', 'priorityTolerance', 'unreachable'],
    'rig goals',
  );
  const from = spec.from ?? model.pose();
  model.socket(from, model.bones[0].id);
  const byId = new Map(model.bones.map((b) => [b.id, { ...b, length: b.length * from.scale[b.id] }])),
    input = safeCopy(spec.goals);
  assert(
    Array.isArray(input) && input.length > 0 && input.length <= 16,
    'RESOURCE_LIMIT',
    'Solve 1–16 simultaneous goals.',
  );
  const tolerance = number(spec.tolerance ?? 0.01, 'position tolerance', 1e-8, 1e4),
    angleTolerance = number(spec.angleTolerance ?? 0.01, 'angle tolerance', 1e-8, Math.PI);
  const priorityTolerance = number(spec.priorityTolerance ?? 1e-10, 'priority cost tolerance', 0, 0.1),
    iterations = number(spec.iterations ?? 100, 'goal iterations', 1, 256),
    restarts = number(spec.restarts ?? 2, 'goal restarts', 0, 4);
  assert(
    Number.isInteger(iterations) && Number.isInteger(restarts),
    'INVALID_RIG',
    'Iteration counts must be integers.',
  );
  const policy = spec.unreachable ?? 'report';
  assert(['report', 'error'].includes(policy), 'INVALID_RIG', 'Use report or error for non-convergence.');
  const point = (p, label) => {
    options(p, ['x', 'y'], label);
    return Object.freeze({ x: number(p.x, `${label} x`, -2e6, 2e6), y: number(p.y, `${label} y`, -2e6, 2e6) });
  };
  const used = new Set(),
    active = new Set();
  const goals = input.map((g, i) => {
    options(
      g,
      [
        'id',
        'end',
        'target',
        'rotation',
        'weight',
        'rotationWeight',
        'priority',
        'chainRoot',
        'pole',
        'poleWeight',
        'stretch',
        'compress',
        'softness',
      ],
      'goal',
    );
    const id = g.id ?? `goal-${i + 1}`;
    assert(
      typeof id === 'string' && /^[A-Za-z][\w-]{0,63}$/.test(id) && !used.has(id),
      'INVALID_GOAL',
      'Use distinct short goal IDs.',
    );
    used.add(id);
    assert(byId.has(g.end), 'UNKNOWN_BONE', 'Every goal needs a known end bone.');
    const target = g.target === undefined ? null : point(g.target, 'goal target'),
      rotation = g.rotation === undefined ? null : number(g.rotation, 'goal rotation', -1e4, 1e4);
    assert(target !== null || rotation !== null, 'INVALID_GOAL', 'A goal needs a target position, rotation or both.');
    const chain = [];
    let b = byId.get(g.end);
    while (b) {
      chain.push(b);
      if (b.id === g.chainRoot) break;
      b = byId.get(b.parent);
    }
    assert(
      g.chainRoot === undefined || chain.at(-1).id === g.chainRoot,
      'INVALID_CHAIN',
      'chainRoot must be an ancestor of end.',
    );
    for (const localB1 of chain) active.add(localB1.id);
    const length = chain.reduce((n, localB2) => n + localB2.length, 0),
      priority = number(g.priority ?? 0, 'goal priority', 0, 15);
    assert(Number.isInteger(priority), 'INVALID_GOAL', 'Priority must be an integer; zero is highest.');
    const weight = number(g.weight ?? 1, 'goal weight', 1e-8, 1e6),
      rotationWeight = number(g.rotationWeight ?? 1, 'rotation weight', 1e-8, 1e6),
      poleWeight = number(g.poleWeight ?? 1, 'pole weight', 1e-8, 1e6);
    const controlled = ['stretch', 'compress', 'softness'].some((name) => g[name] !== undefined),
      stretch = number(g.stretch === undefined ? 1 : g.stretch, 'goal stretch', 1, 4),
      compress = number(g.compress === undefined ? 1 : g.compress, 'goal compress', 0.25, 1),
      softness = number(g.softness === undefined ? 0 : g.softness, 'goal softness', 0, 2e6);
    assert(
      !controlled || (target && chain.length === 2),
      'INVALID_CHAIN',
      'Length/softness controls need a two-bone position chain.',
    );
    let pole = null,
      bend = null;
    if (g.pole !== undefined) {
      assert(
        target && chain.length === 2,
        'INVALID_POLE',
        'A pole needs a position goal over exactly two bones. Set chainRoot to that two-bone base.',
      );
      pole = point(g.pole, 'pole');
      const base = from.bones.find((localB3) => localB3.id === chain[1].id).start,
        dx = target.x - base.x,
        dy = target.y - base.y,
        cross = dx * (pole.y - base.y) - dy * (pole.x - base.x);
      assert(
        Math.hypot(dx, dy) > 1e-12 && Math.abs(cross) > 1e-12,
        'INVALID_POLE',
        'A pole must lie off the base-to-target line.',
      );
      bend = cross > 0 ? -1 : 1;
    }
    return {
      id,
      end: g.end,
      target,
      originalTarget: target,
      rotation,
      weight,
      rotationWeight,
      priority,
      chainRoot: g.chainRoot,
      chain: Object.freeze(chain),
      length,
      pole,
      poleWeight,
      bend,
      controlled,
      stretch,
      compress,
      softness,
      scale: 1,
    };
  });
  // A prepared limb scale/effective target is valid while its base is fixed.
  // Explicitly refuse competing active ancestors rather than solving stale lengths.
  const scale = { ...from.scale };
  const ancestorOf = (id, child) => {
    for (let b = byId.get(child); b; b = byId.get(b.parent)) if (b.id === id) return true;
    return false;
  };
  for (const g of goals)
    if (g.controlled) {
      for (const other of goals)
        if (other !== g)
          assert(
            !other.chain.some((b) => g.chain.some((c) => c.id === b.id) || ancestorOf(b.id, g.chain[1].id)),
            'GOAL_CONTROL_CONFLICT',
            'Controlled two-bone chains need disjoint active bones and fixed base ancestors.',
          );
      const base = from.bones.find((b) => b.id === g.chain[1].id),
        bend = g.bend ?? (from.angles[g.end] < 0 ? -1 : 1),
        solved = solveTwoBone({
          root: base.start,
          target: g.target,
          lengths: [g.chain[1].length, g.chain[0].length],
          bend,
          stretch: g.stretch,
          compress: g.compress,
          softness: g.softness,
        });
      g.prepared = solved;
      g.scale = solved.scale;
      g.target = Object.freeze(solved.effectiveTarget);
      for (const bone of g.chain) {
        scale[bone.id] = number(from.scale[bone.id] * solved.scale, 'controlled pose scale', 0.01, 100);
        bone.length *= solved.scale;
      }
      g.length = g.chain.reduce((sum, b) => sum + b.length, 0);
    }
  for (const g of goals) Object.freeze(g);
  // Stable goal/joint order makes simultaneous solve results input-order independent.
  goals.sort((a, b) => a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const priorities = [...new Set(goals.map((g) => g.priority))],
    joints = model.bones.filter((b) => active.has(b.id)).toReversed();
  const ancestor = (joint, id) => {
    for (let b = byId.get(id); b; b = byId.get(b.parent)) if (b.id === joint) return true;
    return false;
  };
  // Trial poses stay private and mutable to avoid freezing an entire forest for
  // every candidate. Only the returned best pose is captured by the skeleton.
  function trialPose(angles) {
    const poses = new Map(),
      bones = [];
    for (const b of model.bones) {
      const length = byId.get(b.id).length,
        parent = poses.get(b.parent),
        start = parent?.end ?? from.root,
        rotation = (parent?.rotation ?? from.root.rotation) + angles[b.id],
        p = {
          id: b.id,
          parent: b.parent,
          start,
          end: { x: start.x + length * Math.cos(rotation), y: start.y + length * Math.sin(rotation) },
          rotation,
          angle: angles[b.id],
          length,
        };
      poses.set(b.id, p);
      bones.push(p);
    }
    return { root: from.root, angles, scale, bones };
  }
  function metrics(pose) {
    const poses = new Map(pose.bones.map((b) => [b.id, b])),
      costs = new Map(priorities.map((p) => [p, 0])),
      errors = [];
    let all = true;
    for (const g of goals) {
      const bone = poses.get(g.end),
        error = g.target === null ? null : distance(bone.end, g.target),
        originalError = g.originalTarget === null ? null : distance(bone.end, g.originalTarget),
        rotationError = g.rotation === null ? null : Math.abs(angular(bone.rotation, g.rotation));
      let poleError = null,
        polePoint = null;
      if (g.pole) {
        const root = poses.get(g.chain[1].id).start;
        polePoint =
          g.prepared?.elbow ??
          solveTwoBone({ root, target: g.target, lengths: [g.chain[1].length, g.chain[0].length], bend: g.bend }).elbow;
        poleError = distance(poses.get(g.chain[1].id).end, polePoint);
      }
      const cost =
        g.weight *
        ((error === null ? 0 : (error / g.length) ** 2) +
          (rotationError === null ? 0 : g.rotationWeight * 2 * (1 - Math.cos(rotationError))) +
          (poleError === null ? 0 : g.poleWeight * (poleError / g.length) ** 2));
      costs.set(g.priority, costs.get(g.priority) + cost);
      const converged =
        (error === null || error <= tolerance) &&
        (rotationError === null || rotationError <= angleTolerance) &&
        (poleError === null || poleError <= tolerance);
      all &&= converged;
      const base = poses.get(g.chain.at(-1).id).start,
        d = g.originalTarget === null ? 0 : distance(base, g.originalTarget),
        inner = Math.max(0, 2 * Math.max(...g.chain.map((b) => b.length)) - g.length);
      errors.push(
        Object.freeze({
          id: g.id,
          end: g.end,
          priority: g.priority,
          weight: g.weight,
          error: originalError,
          effectiveError: error,
          target: g.originalTarget,
          effectiveTarget: g.target,
          scale: g.scale,
          softness: g.softness,
          rotationError,
          poleError,
          converged,
          withinReach: g.target === null ? null : d <= g.length + tolerance && d >= inner - tolerance,
        }),
      );
    }
    return { costs, errors, all };
  }
  const lexBetter = (a, b) => {
    for (const tier of priorities) {
      if (a.get(tier) < b.get(tier) - 1e-14) return true;
      if (a.get(tier) > b.get(tier) + 1e-14) return false;
    }
    return false;
  };
  function seeds(attempt) {
    let angles = { ...from.angles };
    if (attempt) {
      // A solved target is a seed only; all goals are evaluated together afterwards.
      if (attempt === 1) {
        for (const g of goals) {
          if (!g.target) continue;
          const seed = model.solve({
            end: g.end,
            target: g.target,
            chainRoot: g.chainRoot,
            from: model.pose({ angles, root: from.root, scale }),
            iterations: Math.min(32, iterations),
            restarts: 0,
          });
          angles = { ...seed.pose.angles };
        }
      } else
        for (let i = 0; i < joints.length; i++) {
          const b = joints[i];
          angles[b.id] = clamp(angles[b.id] + 0.55 * (i % 2 ? 1 : -1) * (attempt % 2 ? 1 : -1), ...b.limits);
        }
    }
    for (const g of goals)
      if (g.pole) {
        const current = model.pose({ angles, root: from.root, scale }),
          base = current.bones.find((b) => b.id === g.chain[1].id),
          seed =
            g.prepared ??
            solveTwoBone({
              root: base.start,
              target: g.target,
              lengths: [g.chain[1].length, g.chain[0].length],
              bend: g.bend,
            });
        const heading = seed.angles[0] - (base.rotation - base.angle);
        angles[g.chain[1].id] = clamp(
          heading + TAU * Math.round((angles[g.chain[1].id] - heading) / TAU),
          ...g.chain[1].limits,
        );
        angles[g.chain[0].id] = clamp(
          seed.angles[1] + TAU * Math.round((angles[g.chain[0].id] - seed.angles[1]) / TAU),
          ...g.chain[0].limits,
        );
      }
    return model.pose({ angles, root: from.root, scale });
  }
  function finish(pose, state, work, status, method, owned = false) {
    assert(
      policy !== 'error' || state.all,
      'IK_NOT_CONVERGED',
      `Simultaneous IK ${status}. Inspect individual goal residuals.`,
    );
    return Object.freeze({
      pose: owned ? pose : model.pose({ root: pose.root, angles: pose.angles, scale }),
      converged: state.all,
      status,
      iterations: work,
      goals: Object.freeze(state.errors),
      priorityCosts: Object.freeze(
        priorities.map((priority) => Object.freeze({ priority, cost: state.costs.get(priority) })),
      ),
      diagnostics: Object.freeze({
        method,
        priorityTolerance,
        priorities: Object.freeze(priorities),
        activeJoints: Object.freeze(joints.map((b) => b.id)),
        tolerance,
        angleTolerance,
      }),
    });
  }
  if (
    goals.some((g) => g.controlled) &&
    goals.every(
      (g) =>
        g.target &&
        g.rotation === null &&
        g.chain.length === 2 &&
        (g.controlled || g.chain.every((b) => b.length >= 1e-6)),
    ) &&
    goals.every((g, i) =>
      goals.every(
        (other, j) =>
          i === j || !other.chain.some((b) => g.chain.some((c) => c.id === b.id) || ancestorOf(b.id, g.chain[1].id)),
      ),
    )
  ) {
    const angles = { ...from.angles };
    let valid = true;
    const nearest = (angle, bone) => {
      const centre = Math.round((from.angles[bone.id] - angle) / TAU);
      let candidates = [centre - 1, centre, centre + 1]
        .map((k) => angle + k * TAU)
        .filter((a) => a >= bone.limits[0] && a <= bone.limits[1]);
      if (!candidates.length) {
        valid = false;
        return from.angles[bone.id];
      }
      candidates.sort((a, b) => Math.abs(a - from.angles[bone.id]) - Math.abs(b - from.angles[bone.id]));
      return candidates[0];
    };
    for (const g of goals) {
      const base = from.bones.find((b) => b.id === g.chain[1].id),
        solved =
          g.prepared ??
          solveTwoBone({
            root: base.start,
            target: g.target,
            lengths: [g.chain[1].length, g.chain[0].length],
            bend: g.bend ?? (from.angles[g.end] < 0 ? -1 : 1),
          });
      angles[g.chain[1].id] = nearest(solved.angles[0] - (base.rotation - base.angle), g.chain[1]);
      angles[g.end] = nearest(solved.angles[1], g.chain[0]);
    }
    if (valid) {
      const pose = model.pose({ angles, root: from.root, scale }),
        state = metrics(pose);
      if (state.all) return finish(pose, state, 0, 'converged', 'analyticTwoBoneGoals', true);
    }
  }
  const initial = model.pose({ angles: from.angles, root: from.root, scale });
  const initialMetrics = metrics(initial);
  if (initialMetrics.all) return finish(initial, initialMetrics, 0, 'converged', 'initialPose', true);
  assert(
    model.bones.length * joints.length * goals.length * priorities.length * iterations * (restarts + 1) <= 4000000,
    'RESOURCE_LIMIT',
    'Simultaneous IK exceeds the bounded solve budget.',
  );
  let best = initial,
    bestMetrics = initialMetrics,
    work = 0,
    exhausted = false;
  for (let attempt = 0; attempt <= restarts; attempt++) {
    let current = seeds(attempt),
      state = metrics(current),
      angles = { ...current.angles };
    const ceilings = new Map();
    for (const tier of priorities) {
      let stopped = false;
      for (let sweep = 0; sweep < iterations; sweep++) {
        work++;
        let changed = false;
        for (const joint of joints) {
          const poses = new Map(current.bones.map((b) => [b.id, b])),
            pivot = poses.get(joint.id).start,
            old = angles[joint.id],
            choices = [old, joint.limits[0], joint.limits[1]];
          let c = 0,
            s = 0;
          const add = (v, t, w) => {
            c += w * (v.x * t.x + v.y * t.y);
            s += w * (v.x * t.y - v.y * t.x);
          };
          for (const g of goals) {
            if (g.priority !== tier || !ancestor(joint.id, g.end)) continue;
            const b = poses.get(g.end);
            if (g.target)
              add(
                { x: b.end.x - pivot.x, y: b.end.y - pivot.y },
                { x: g.target.x - pivot.x, y: g.target.y - pivot.y },
                g.weight / g.length ** 2,
              );
            if (g.rotation !== null) {
              const delta = angular(g.rotation, b.rotation);
              c += g.weight * g.rotationWeight * Math.cos(delta);
              s += g.weight * g.rotationWeight * Math.sin(delta);
            }
            if (g.pole && ancestor(joint.id, g.chain[1].id)) {
              const base = poses.get(g.chain[1].id).start,
                desired =
                  g.prepared?.elbow ??
                  solveTwoBone({
                    root: base,
                    target: g.target,
                    lengths: [g.chain[1].length, g.chain[0].length],
                    bend: g.bend,
                  }).elbow,
                elbow = poses.get(g.chain[1].id).end;
              add(
                { x: elbow.x - pivot.x, y: elbow.y - pivot.y },
                { x: desired.x - pivot.x, y: desired.y - pivot.y },
                (g.weight * g.poleWeight) / g.length ** 2,
              );
            }
          }
          const delta = Math.atan2(s, c),
            ideal = old + delta,
            k = Math.round((old - ideal) / TAU);
          for (let turn = k - 1; turn <= k + 1; turn++) choices.push(clamp(ideal + turn * TAU, ...joint.limits));
          // Small alternatives allow bounded movement while preserving earlier tiers.
          for (const step of [0.15, 0.03, 0.005])
            choices.push(clamp(old + step, ...joint.limits), clamp(old - step, ...joint.limits));
          let next = current,
            nextState = state,
            nextAngle = old;
          for (const angle of new Set(choices)) {
            if (angle === old) continue;
            const trial = trialPose({ ...angles, [joint.id]: angle }),
              m = metrics(trial);
            if (priorities.some((p) => p < tier && m.costs.get(p) > ceilings.get(p) + priorityTolerance)) continue;
            if (m.costs.get(tier) < nextState.costs.get(tier) - 1e-14) {
              next = trial;
              nextState = m;
              nextAngle = angle;
            }
          }
          if (nextAngle !== old) {
            changed = true;
            current = next;
            state = nextState;
            angles[joint.id] = nextAngle;
            for (const p of priorities) if (p < tier) ceilings.set(p, Math.min(ceilings.get(p), state.costs.get(p)));
          }
        }
        if (state.all || !changed) {
          stopped = true;
          break;
        }
      }
      if (!stopped) exhausted = true;
      ceilings.set(tier, state.costs.get(tier));
    }
    if (lexBetter(state.costs, bestMetrics.costs) || state.all) {
      best = current;
      bestMetrics = state;
    }
    if (bestMetrics.all) break;
  }
  const status = bestMetrics.all
    ? 'converged'
    : bestMetrics.errors.some((e) => e.withinReach === false)
      ? 'unreachable'
      : exhausted
        ? 'iterationLimit'
        : 'stalled';
  return finish(best, bestMetrics, work, status, 'hierarchicalCoordinateDescent');
}
