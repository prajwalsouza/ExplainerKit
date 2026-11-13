import { blend, add } from '../runtime.js';
import { clamp, smooth } from '../timing.js';
import { bipedShoulder } from '../pose-layout.js';
import { assert, number } from '../../core/validate.js';

/**
 * The shared biped action library: walk and run (Williams's contact, down, passing, up with planted feet),
 * hop with anticipation and squash, and common poses. Any rig with channels handF/handB/footF/footB
 * (character space), body.x/y/r/sx/sy, head.r/turn and the face channels can use it.
 * L: {HIP, SHOULDER: {F, B}, FOOT_REST: {F, B}, arm (arm length / 54), stride, runStride, chin: [x, y]}.
 */
export function bipedActions(L) {
  const { FOOT_REST } = L,
    K = L.arm ?? 1;
  /** Place a hand relative to its shoulder as solved this frame, so poses follow leans and squashes. */
  const shoulder = (pose, side) => bipedShoulder(pose, side, L);
  const reach = (pose, side, dx, dy, w) => {
    const [sx, sy] = shoulder(pose, side);
    blend(pose, `hand${side}.x`, sx + dx, w);
    blend(pose, `hand${side}.y`, sy + dy, w);
  };

  /**
   * Footstep plan for a walk of total distance D: a half step to start, full steps, and a closing step, so the
   * gait begins and ends in the standing pose. Each foot is planted in world space between its swings; the
   * swing of step i spans the middle `swing` fraction of its body-distance slot (the rest is double support).
   */
  function plan(D, stepLength, minimumSteps = 0) {
    const count = Math.max(1, minimumSteps, Math.round(D / stepLength)),
      slot = D / (count + 1),
      steps = [];
    assert(
      count <= 10000,
      'RESOURCE_LIMIT',
      'A biped action supports at most10000 planned steps; split a longer travel clip.',
    );
    for (let i = 0; i <= count; i++)
      steps.push({ side: i % 2 ? 'B' : 'F', land: i < count ? ((i + 1) * D) / count : D, slot: i });
    return { K: count, slot, steps };
  }
  function maximumHorizontal(planned, swing) {
    let maximum = 0;
    for (const side of ['F', 'B']) {
      let from = FOOT_REST[side][0];
      const hip = L.hipX?.[side] ?? 0;
      for (const step of planned.steps) {
        if (step.side !== side) continue;
        const a = (step.slot + (1 - swing) / 2) * planned.slot,
          b = (step.slot + (1 + swing) / 2) * planned.slot,
          to = FOOT_REST[side][0] + step.land,
          delta = to - from;
        const roots = [0, 1],
          discriminant = delta > 0 ? 1 - (4 * (b - a)) / (6 * delta) : -1;
        if (discriminant >= 0) {
          roots.push((1 - Math.sqrt(discriminant)) / 2, (1 + Math.sqrt(discriminant)) / 2);
        }
        for (const k of roots)
          maximum = Math.max(maximum, Math.abs(from + delta * smooth(k) - (a + (b - a) * k) - hip));
        from = to;
      }
    }
    return maximum;
  }
  function footAt(planned, side, d, swing) {
    const rest = FOOT_REST[side][0];
    let from = rest,
      x = rest,
      y = 0,
      phase = 0;
    for (const st of planned.steps) {
      if (st.side !== side) continue;
      const a = (st.slot + (1 - swing) / 2) * planned.slot,
        b = (st.slot + (1 + swing) / 2) * planned.slot,
        to = rest + st.land;
      if (d >= b) {
        from = to;
        x = to;
        continue;
      }
      if (d > a) {
        const k = (d - a) / (b - a);
        x = from + (to - from) * smooth(k);
        y = -Math.sin(Math.PI * k);
        phase = k;
      }
      break;
    }
    return { x: x - d, lift: y, phase };
  }

  // Walk after Williams: contact, down, passing, up on each step; feet stay planted between swings.
  const reachGround = bipedReach(L);

  function walk(pose, u, params, c, w) {
    const swing = number(params.swing ?? 0.8, 'gait swing fraction', 0.001, 1),
      lift = number(params.lift ?? L.lift ?? 11, 'gait lift', 0, 1000),
      bob = number(params.bob ?? L.bob ?? 4.5, 'gait bob', 0, 1000),
      lean = number(params.lean ?? 0.06, 'gait lean', -1, 1);
    let stepLength = number(params.stride ?? L.stride ?? 70, 'gait stride', 0.001, 1e5) / 2;
    if (L.leg) {
      const restOffset = Math.max(...['F', 'B'].map((side) => Math.abs(FOOT_REST[side][0] - (L.hipX?.[side] ?? 0))));
      const available = L.leg * 0.985 - restOffset;
      assert(available > 0, 'CHARACTER_GAIT_REACH', 'The rest stance is wider than the available leg reach.');
      stepLength = Math.min(stepLength, available / (1 + (1 - swing) / 2));
    }
    const D = number(c.clip.distance(c.clip.duration), 'gait travel', 0, 1e9),
      d = c.clip.distance(u);
    if (D === 0) {
      for (const side of ['F', 'B']) {
        pose[`foot${side}.x`] = FOOT_REST[side][0];
        pose[`foot${side}.y`] = FOOT_REST[side][1];
      }
      reachGround(pose);
      return;
    }
    let planned = plan(D, stepLength);
    if (L.minimumHipHeight) {
      const allowed = Math.sqrt(Math.max(0, (L.leg * 0.985) ** 2 - L.minimumHipHeight ** 2));
      const restOffset = Math.max(...['F', 'B'].map((side) => Math.abs(FOOT_REST[side][0] - (L.hipX?.[side] ?? 0))));
      assert(allowed > restOffset, 'CHARACTER_GAIT_REACH', 'The stance leaves no safe knee clearance for this build.');
      for (let attempt = 0; attempt < 16 && maximumHorizontal(planned, swing) > allowed; attempt++) {
        const ratio = (maximumHorizontal(planned, swing) - restOffset) / (allowed - restOffset);
        planned = plan(D, stepLength, Math.max(planned.K + 1, Math.ceil(planned.K * ratio)));
      }
      assert(
        maximumHorizontal(planned, swing) <= allowed,
        'CHARACTER_GAIT_REACH',
        'A safe build-aware step plan could not be found within the bounded work.',
      );
    }
    for (const side of ['F', 'B']) {
      const f = footAt(planned, side, d, swing);
      // Feet are set, not blended: the plan starts and ends in the standing pose, so blending would only slide them.
      pose[`foot${side}.x`] = f.x;
      pose[`foot${side}.y`] = lift * f.lift;
      // Arms swing against the legs on the same side, relative to the foot's rest place.
      const [sx, sy] = shoulder(pose, side),
        x = f.x - FOOT_REST[side][0];
      blend(pose, `hand${side}.x`, sx + (side === 'F' ? 6 : -4) * K - x * 0.9, w);
      blend(pose, `hand${side}.y`, sy + (L.handDrop ?? 41 * K) - Math.abs(x) * 0.12, w);
    }
    // One bob per step: lowest just after contact (down), highest after passing (up).
    const step = clamp(d / planned.slot, 0, planned.K + 1) % 1,
      moving = Math.min(1, c.clip.speed / 70) * Math.sin(Math.PI * clamp(d / D));
    add(pose, 'body.y', bob * Math.cos(2 * Math.PI * (step - 0.25)) * Math.sqrt(Math.max(0, moving)), w);
    add(pose, 'body.r', lean * Math.min(2.5, c.clip.speed / 70) * Math.sqrt(Math.max(0, moving)), w);
    add(pose, 'head.r', -0.035 * Math.cos(2 * Math.PI * (step - 0.4)) * moving, w);
    // Last, so the bob can never lift a planted foot out of reach.
    reachGround(pose);
  }

  return {
    walk,
    run(pose, u, params, c, w) {
      walk(
        pose,
        u,
        { stride: L.runStride, swing: 0.94, lift: L.runLift ?? 20, bob: L.runBob ?? 7, lean: 0.07, ...params },
        c,
        w,
      );
      for (const s of ['F', 'B']) {
        const sy = shoulder(pose, s)[1];
        blend(pose, `hand${s}.y`, sy + 26 * K, w * 0.6);
      }
    },
    hop(pose, u, params, c, w) {
      const D = c.clip.duration,
        h = params.height ?? 46,
        k = u / D;
      // Anticipation squash, stretch on takeoff, airborne arc, squash on landing, settle.
      const crouch =
        k < 0.22
          ? smooth(k / 0.22)
          : k < 0.28
            ? 1 - smooth((k - 0.22) / 0.06)
            : k > 0.74 && k < 0.84
              ? smooth((k - 0.74) / 0.05) * (1 - smooth((k - 0.79) / 0.05))
              : 0;
      const air = k >= 0.26 && k <= 0.76 ? Math.sin((Math.PI * (k - 0.26)) / 0.5) : 0;
      add(pose, 'root.y', -h * air, w);
      blend(pose, 'body.sy', (pose['body.sy'] ?? 1) * (1 - 0.14 * crouch + 0.1 * air * (k < 0.5 ? 1 : 0)), w);
      blend(pose, 'body.sx', (pose['body.sx'] ?? 1) * (1 + 0.12 * crouch - 0.05 * air), w);
      add(pose, 'body.y', 7 * crouch, w);
      // Arms swing down and back in the crouch, then up and forward in the air.
      for (const s of ['F', 'B']) {
        const side = s === 'F' ? 1 : 0.6;
        reach(
          pose,
          s,
          (-14 * crouch + 14 * air) * K * side,
          (34 * crouch - 38 * air + 40 * (1 - crouch - air)) * K,
          w * Math.max(air, crouch),
        );
        add(pose, `foot${s}.y`, -8 * air, w);
      }
      blend(pose, 'face.browRaise', 0.5 * air, w);
      blend(pose, 'mouth.open', 0.35 * air, w);
    },
    wave(pose, u, params, c, w) {
      const side = params.hand === 'back' ? 'B' : 'F',
        lift = smooth(u / 0.3),
        wag = Math.sin(2 * Math.PI * 2.4 * Math.max(0, u - 0.2));
      reach(pose, side, ((side === 'F' ? 18 : -18) + 9 * wag * lift) * K, (-44 * lift + 40 * (1 - lift)) * K, w);
      add(pose, 'head.r', -0.06 * lift, w);
      blend(pose, 'face.smile', 0.7, w * lift);
      blend(pose, 'face.browRaise', 0.3, w * lift);
    },
    point(pose, u, params, c, w) {
      const a = Math.atan2(params.y ?? -0.2, params.x ?? 1),
        k = smooth(u / 0.25),
        over = 1 + 0.08 * Math.sin(Math.PI * clamp((u - 0.25) / 0.2));
      reach(pose, 'F', Math.cos(a) * 46 * K * over, Math.sin(a) * 46 * K * over, w * k);
      add(pose, 'look.x', clamp(params.x ?? 1, -1, 1) * k, w);
      add(pose, 'look.y', clamp(params.y ?? -0.2, -1, 1) * k, w);
      add(pose, 'head.turn', 0.6 * k, w);
    },
    think(pose, u, params, c, w) {
      const k = smooth(u / 0.35),
        [chinX, chinY] = L.chin;
      blend(pose, 'handF.x', chinX, w * k);
      blend(pose, 'handF.y', chinY, w * k);
      add(pose, 'look.x', -0.5 * k, w);
      add(pose, 'look.y', -0.7 * k, w);
      add(pose, 'head.r', -0.12 * k, w);
      blend(pose, 'face.browRaise', 0.5, w * k);
      blend(pose, 'face.browTilt', 0.3, w * k);
      blend(pose, 'face.smile', -0.15, w * k);
    },
    cheer(pose, u, params, c, w) {
      const k = smooth(u / 0.25),
        b = Math.abs(Math.sin(2 * Math.PI * 1.6 * u));
      reach(pose, 'F', 20 * K, (-50 - 6 * b) * K, w * k);
      reach(pose, 'B', -20 * K, (-48 - 6 * b) * K, w * k);
      add(pose, 'root.y', -10 * b * k, w);
      blend(pose, 'face.smile', 1, w * k);
      blend(pose, 'face.squint', 0.5, w * k);
      blend(pose, 'mouth.open', 0.5, w * k);
      blend(pose, 'mouth.teeth', 0.6, w * k);
    },
    shrug(pose, u, params, c, w) {
      const k = Math.sin(Math.PI * clamp(u / Math.min(1.1, c.clip.duration)));
      reach(pose, 'F', 30 * K, 20 * K, w * k);
      reach(pose, 'B', -28 * K, 20 * K, w * k);
      add(pose, 'body.y', -3 * k, w);
      add(pose, 'head.r', 0.1 * k, w);
      blend(pose, 'face.browRaise', 0.7, w * k);
      blend(pose, 'face.browTilt', 0.4, w * k);
      blend(pose, 'face.smile', -0.2, w * k);
    },
    present(pose, u, params, c, w) {
      const k = smooth(u / 0.3),
        dir = params.side === 'back' ? -1 : 1,
        side = dir > 0 ? 'F' : 'B';
      reach(pose, side, dir * 40 * K, 8 * K, w * k);
      add(pose, 'head.turn', 0.5 * dir * k, w);
      add(pose, 'look.x', 0.8 * dir * k, w);
      blend(pose, 'face.smile', 0.5, w * k);
    },
    hold(pose, u, params, c, w) {
      const k = smooth(u / 0.25);
      reach(pose, 'F', 18 * K, 22 * K, w * k);
      reach(pose, 'B', 10 * K, 26 * K, w * k * (params.twoHands ? 1 : 0));
    },
    nod(pose, u, params, c, w) {
      add(pose, 'head.r', 0.12 * Math.sin(2 * Math.PI * 2 * u) * Math.sin(Math.PI * clamp(u / c.clip.duration)), w);
    },
    shake(pose, u, params, c, w) {
      add(pose, 'head.turn', 0.5 * Math.sin(2 * Math.PI * 2.5 * u) * Math.sin(Math.PI * clamp(u / c.clip.duration)), w);
    },
  };
}

/**
 * Compass-gait pelvis drop: lower the hips just enough that every foot is within leg reach, so legs never
 * over-stretch and planted feet never float (L.leg is hip-to-ankle length, L.ankle the ankle height). Rigs
 * also expose it as `reach`, which the runtime calls after placing the feet on an uneven surface.
 */
export function bipedReach(L) {
  const { HIP } = L;
  return (pose) => {
    if (!L.leg) return;
    let drop = 0;
    for (const side of ['F', 'B']) {
      const hipX = (L.hipX?.[side] ?? 0) + (pose['body.x'] ?? 0),
        dx = pose[`foot${side}.x`] - hipX;
      const needed = Math.sqrt(Math.max(0, (L.leg * 0.985) ** 2 - dx * dx)),
        actual = pose[`foot${side}.y`] - (L.ankle ?? 0) - (HIP[1] + (pose['body.y'] ?? 0));
      drop = Math.max(drop, actual - needed);
    }
    pose['body.y'] = (pose['body.y'] ?? 0) + drop;
  };
}
export function bipedDefaults({ speed = 70, runSpeed = 200, hop = 46 } = {}) {
  return {
    walk: { speed },
    run: { speed: runSpeed },
    hop: { duration: 0.9, height: hop },
    wave: { duration: 2, hand: 'front' },
    point: { duration: 1.5, x: 1, y: -0.2 },
    think: { duration: 2 },
    cheer: { duration: 1.6 },
    shrug: { duration: 1.2 },
    present: { duration: 2, side: 'front' },
    hold: { duration: 2, twoHands: false },
    nod: { duration: 0.8 },
    shake: { duration: 0.9 },
  };
}
