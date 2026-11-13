import { resolveMotionStyle } from './motion-style.js';
import { jointPoseRest, materializeJointPose, jointPoseSnapshot, fitJointContacts } from './joint-pose.js';
import { poseVocabulary } from './pose-vocabulary.js';
import { holdProp } from './holding.js';
import { capturePoseLayout } from './pose-layout.js';
import { preparePoseKeys, samplePoseKeys } from './keyed-poses.js';
import { captureRootTrack, followOptions, planRootFollow } from './root-follow.js';
import { assert, number, options, safeCopy } from '../core/validate.js';
import { Derived } from '../core/scene.js';
import { rgbaOf } from '../graphics/cloud.js';
import { lag, jiggle } from '../physics/secondary.js';
import { clipPath, pathCommands } from '../graphics/index.js';
import { translate, bounds, ellipse } from './shapes.js';
import { MOODS, speech } from './face.js';
import { speechFromRhubarb } from './lip-sync.js';
import { clamp, lerp, smooth, smoothIntegral, dampedStep, envelope } from './timing.js';
import { easings } from '../core/timing.js';
import { isSurface, restBounds, sceneLength } from './staging.js';

const f = (v) => Object.freeze(v);
const NAME = /^[a-zA-Z][\w-]{0,63}$/;

/** Blend a pose channel toward value by weight w. */
export function blend(pose, key, value, w) {
  pose[key] = lerp(pose[key] ?? 0, value, w);
}
/** Add to a pose channel scaled by weight w. */
export function add(pose, key, value, w = 1) {
  pose[key] = (pose[key] ?? 0) + value * w;
}

/**
 * Forward kinematics for a cut-out rig. Each bone has a rest position in character space and channels
 * `${bone}.x`, `.y` (offset), `.r` (rotation, inherited), `.sx`, `.sy` (squash of its own art and of its
 * children's attachment points, not inherited as orientation).
 */
export function solveBones(def, pose) {
  const world = {};
  for (const name of def.order) {
    const bone = def.bones[name],
      p = bone.parent ? world[bone.parent] : { x: 0, y: 0, r: 0, sx: 1, sy: 1 };
    const parentRest = bone.parent ? def.bones[bone.parent].at : [0, 0];
    const ox = (bone.at[0] - parentRest[0] + (pose[`${name}.x`] ?? 0)) * p.sx,
      oy = (bone.at[1] - parentRest[1] + (pose[`${name}.y`] ?? 0)) * p.sy;
    const c = Math.cos(p.r),
      s = Math.sin(p.r);
    world[name] = {
      x: p.x + c * ox - s * oy,
      y: p.y + s * ox + c * oy,
      r: p.r + (pose[`${name}.r`] ?? 0),
      sx: pose[`${name}.sx`] ?? 1,
      sy: pose[`${name}.sy`] ?? 1,
    };
  }
  return world;
}
/** A point given in a bone's rest-local frame, carried to character space by the solved pose. */
export function boneToRoot(world, bone, x, y) {
  const b = world[bone],
    c = Math.cos(b.r),
    s = Math.sin(b.r),
    lx = x * b.sx,
    ly = y * b.sy;
  return [b.x + c * lx - s * ly, b.y + s * lx + c * ly];
}

/**
 * Compile a character definition: validate names, order bones parent-first and move static art into
 * bone-local coordinates. Definitions come from the starter builders or from characterFromSVG.
 */
export function compileCharacter(def) {
  options(
    def,
    [
      'name',
      'rig',
      'height',
      'palette',
      'bones',
      'parts',
      'rest',
      'idle',
      'post',
      'actions',
      'travelWarp',
      'joints',
      'contacts',
      'actionDefaults',
      'sockets',
      'light',
      'meta',
      'reach',
      'poseLayout',
      'poses',
    ],
    'character definition',
  );
  assert(typeof def.name === 'string' && NAME.test(def.name), 'INVALID_CHARACTER', 'A character needs a short name.');
  const bones = def.bones,
    order = [],
    seen = new Set();
  const visit = (name, depth = 0) => {
    assert(depth < 64 && Object.hasOwn(bones, name), 'INVALID_CHARACTER', `Unknown or cyclic bone ${name}.`);
    if (seen.has(name)) return;
    if (bones[name].parent) visit(bones[name].parent, depth + 1);
    seen.add(name);
    order.push(name);
  };
  for (const name of Object.keys(bones)) {
    assert(NAME.test(name), 'INVALID_CHARACTER', `Bad bone name ${name}.`);
    visit(name);
  }
  const ids = new Set();
  const parts = def.parts
    .map((part) => {
      assert(
        NAME.test(part.id) && !ids.has(part.id),
        'INVALID_CHARACTER',
        `Part IDs must be unique short names (${part.id}).`,
      );
      ids.add(part.id);
      assert(
        part.bone == null || Object.hasOwn(bones, part.bone),
        'INVALID_CHARACTER',
        `Part ${part.id} uses an unknown bone.`,
      );
      assert(
        part.commands || typeof part.draw === 'function',
        'INVALID_CHARACTER',
        `Part ${part.id} needs commands or a draw function.`,
      );
      assert(
        Object.hasOwn(def.palette, part.slot),
        'INVALID_CHARACTER',
        `Part ${part.id} uses an unknown palette slot ${part.slot}.`,
      );
      if (part.stretchChannel !== undefined)
        assert(
          typeof part.stretchChannel === 'string' && Object.hasOwn(def.rest, part.stretchChannel),
          'INVALID_CHARACTER',
          'Limb audit stretch channels must name a declared pose channel.',
        );
      const origin = part.bone ? bones[part.bone].at : [0, 0];
      const local = part.commands ? pathCommands(translate(part.commands, -origin[0], -origin[1])) : null;
      let secondary = null;
      if (part.secondary) {
        options(part.secondary, ['driver', 'amount', 'maxAngle'], 'appendage secondary motion');
        assert(
          typeof part.secondary.driver === 'string' && Object.hasOwn(def.rest, part.secondary.driver),
          'INVALID_CHARACTER',
          'Appendage driver must name a numeric rest-pose channel.',
        );
        secondary = f({
          driver: part.secondary.driver,
          amount: number(part.secondary.amount ?? 0.35, 'appendage response amount', 0, 1),
          maxAngle: number(part.secondary.maxAngle ?? 0.025, 'appendage rotation bound', 0, 0.1),
        });
      }
      return f({ ...part, local, secondary, z: part.z ?? 0 });
    })
    .sort((a, b) => a.z - b.z);
  const poseLayout = capturePoseLayout(def.poseLayout),
    rest = jointPoseRest(def.rest, poseLayout);
  return f({
    ...def,
    rest,
    poseLayout,
    poses: def.poses === undefined ? undefined : safeCopy(def.poses),
    order: f(order),
    parts: f(parts),
    light: def.light ?? [-0.6, -0.8],
  });
}

/**
 * Put a character in a scene. Returns a handle whose methods add timed clips; every frame is computed from
 * time alone, so seeking and scrubbing backward are exact.
 */
export function character(scene, definition, spec = {}) {
  options(
    spec,
    [
      'x',
      'y',
      'size',
      'height',
      'unit',
      'standOn',
      'facing',
      'seed',
      'palette',
      'idle',
      'shade',
      'secondaryMotion',
      'motionStyle',
    ],
    'character',
  );
  assert(
    spec.secondaryMotion === undefined || typeof spec.secondaryMotion === 'boolean',
    'INVALID_CHARACTER',
    'secondaryMotion must be a boolean.',
  );
  const def = definition.order ? definition : compileCharacter(definition);
  assert(
    spec.height === undefined || spec.size === undefined,
    'INVALID_CHARACTER',
    'Give a character size or height, not both.',
  );
  assert(
    spec.standOn === undefined || isSurface(spec.standOn),
    'INVALID_CHARACTER',
    'standOn takes a surface() from explainerkit/characters.',
  );
  assert(
    spec.standOn === undefined || spec.y === undefined,
    'INVALID_CHARACTER',
    'A character standing on a surface takes its y from the surface; leave y out.',
  );
  let ground = spec.standOn ?? null;
  const x0 = number(spec.x ?? scene.width / 2, 'character x'),
    y0 = number(spec.y ?? scene.height * 0.8, 'character y');
  // height: the drawn rest height in scene units, from the rig's measured rest bounds.
  const size =
    spec.height !== undefined
      ? number(sceneLength(spec.height, spec.unit) / restBounds(def).height, 'character size', 0.001, 1000)
      : number(spec.size ?? 1, 'character size', 0.01, 100);
  assert(
    spec.unit === undefined || typeof spec.height === 'string',
    'INVALID_CHARACTER',
    "unit converts a height in metres; give height as a length such as '1.7m'.",
  );
  const motionStyle = resolveMotionStyle(spec.motionStyle);
  const seed = (spec.seed ?? 1) >>> 0,
    idleOn = spec.idle ?? true;
  const palette = { ...def.palette, ...(spec.palette ?? {}) };
  let facing0 = spec.facing ?? 1;
  assert(facing0 === 1 || facing0 === -1, 'INVALID_CHARACTER', 'facing is 1 or -1.');
  const keyedLayers = [],
    keyFacing = [],
    moveFacing = [],
    turns = [];
  let rootFollower = null,
    followPlan = null,
    followVersion = 0,
    plannedVersion = -1,
    planning = false;
  const clips = [],
    looks = [],
    speeches = [],
    drivers = [],
    scales = [];
  let lighting = null,
    proportionInputs = null,
    lightInstalled = false,
    widthInstalled = false;
  const scalar = (value, c, label, min, max) =>
    number(typeof value === 'number' ? value : read(value, c), label, min, max);
  const captureScalar = (value, label, min, max) => {
    if (typeof value === 'number') number(value, label, min, max);
    else assert(scene._ownsInput(value), 'INVALID_BINDING', `${label} needs a number or this scene's input.`);
    return value;
  };
  const litColor = (color, ambient) => {
    const rgba = rgbaOf(color);
    return (
      '#' +
      rgba
        .map((v, i) =>
          Math.round((i < 3 ? v * ambient : v) * 255)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')
    );
  };
  // Feet-rooted rigs (bipeds, birds) have their root on the ground; fish and microbes at the body centre.
  const feetRooted = (def.contacts?.length ?? 0) > 0;
  /** Size multiplier over time: each scaleTo eases from the value before it; clips never overlap. */
  const scaleAt = (t) => {
    let m = 1;
    for (const c of scales) {
      if (t <= c.at) break;
      m = c.to === c.from || t >= c.at + c.duration ? c.to : lerp(c.from, c.to, c.ease((t - c.at) / c.duration));
    }
    return m;
  };
  const sizeAt = (t) => (scales.length ? size * scaleAt(t) : size);
  // Holding a non-root anchor still while the size changes moves the root by −Δsize × anchor height.
  const anchorY = (t) => {
    let y = 0;
    for (const c of scales) {
      if (t <= c.at || !c.ay) continue;
      y -= size * (scaleAt(Math.min(t, c.at + c.duration)) - c.from) * c.ay;
    }
    return y;
  };
  const baseY = (x) => (ground ? ground.yAt(x) : y0);
  const read = (input, c) => (input instanceof Derived ? input.sample(c) : input.sample(c.time));

  // Native shading is explicit while its offscreen cost is measured. The legacy default remains
  // available without changing existing frames or the twelve-character budget.
  const nativeShade = spec.shade !== undefined;
  const children = {};
  for (const part of def.parts) {
    const tone = palette[part.slot];
    const kids = {};
    if (part.stroke)
      kids.line = {
        type: 'path',
        props: {
          fill: 'none',
          stroke: tone.base,
          strokeWidth: part.stroke,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          commands: part.local ?? [],
        },
      };
    else if (nativeShade || part.shade === false)
      kids.fill = { type: 'path', props: { fill: tone.base, commands: part.local ?? [] } };
    else {
      kids.under = { type: 'path', props: { fill: tone.shade, commands: part.local ?? [] } };
      kids.lit = { type: 'path', props: { fill: tone.base, commands: part.local ?? [] } };
      kids.hi = { type: 'path', props: { fill: tone.light, opacity: 0.4, commands: [] } };
    }
    children[part.id] = { type: 'group', props: { opacity: part.opacity ?? 1 }, children: kids };
  }
  const shade =
    spec.shade === true
      ? {
          shadow: { amount: 0.2, softness: 0.35, distance: 4 },
          light: { amount: 0.15, softness: 0.35, distance: 3 },
        }
      : (spec.shade ?? null);
  const handle = scene.instance(
    scene.component({ type: 'group', props: { x: x0, y: y0, scaleX: size * facing0, scaleY: size, shade }, children }),
  );

  const baseFacingAt = (t) => {
    const last = (list) => {
      let lo = 0,
        hi = list.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (list[mid].at <= t) lo = mid + 1;
        else hi = mid;
      }
      return list[lo - 1];
    };
    const move = last(moveFacing),
      key = last(keyFacing);
    return key && (!move || key.at >= move.at) ? key.facing : (move?.facing ?? facing0);
  };
  const turnAt = (t) => {
    const event = turns.find((key) => t >= key.at - key.turn.duration && t <= key.at);
    if (!event) return null;
    const previous = baseFacingAt(event.at - event.turn.duration - 1e-9);
    if (previous === event.facing) return null;
    const progress = (t - event.at + event.turn.duration) / event.turn.duration,
      edge = Math.abs(Math.cos(Math.PI * progress));
    return {
      facing: progress < 0.5 ? previous : event.facing,
      width: Math.max(0.001, edge),
      detail: edge < 1e-12 ? 0 : edge,
    };
  };
  const facingAt = (t) => turnAt(t)?.facing ?? baseFacingAt(t);
  // Root travel: each moving clip integrates its eased speed exactly. While a scaleTo overlaps a move, the
  // travel is ∫ size(t) dW over the overlap, by a fixed 32-step midpoint rule: pure in t, so rewind is exact.
  function travel(t) {
    let x = 0;
    for (const c of clips)
      if (c.speed && t > c.at) {
        const u = Math.min(t - c.at, c.duration),
          W = def.travelWarp?.[c.name] ? (d) => def.travelWarp[c.name](c.distance(d), c.params) : (d) => c.distance(d);
        x += c.facing * (scales.length ? scaledTravel(c, u, W) : size * W(u));
      }
    return x;
  }
  function scaledTravel(c, u, W) {
    const cuts = [0, u];
    for (const s of scales)
      for (const at of [s.at, s.at + s.duration]) if (at - c.at > 0 && at - c.at < u) cuts.push(at - c.at);
    cuts.sort((a, b) => a - b);
    let x = 0;
    for (let i = 1; i < cuts.length; i++) {
      const a = cuts[i - 1],
        b = cuts[i],
        mid = c.at + (a + b) / 2;
      if (b - a <= 0) continue;
      if (!scales.some((s) => mid > s.at && mid < s.at + s.duration)) {
        x += sizeAt(mid) * (W(b) - W(a));
        continue;
      }
      for (let k = 0, prev = W(a); k < 32; k++) {
        const next = W(a + ((b - a) * (k + 1)) / 32);
        x += sizeAt(c.at + a + ((b - a) * (k + 0.5)) / 32) * (next - prev);
        prev = next;
      }
    }
    return x;
  }
  function ensureFollow() {
    if (!rootFollower) return null;
    if (
      followPlan &&
      plannedVersion === followVersion &&
      followPlan.duration === Math.max(scene.duration, rootFollower.track.end)
    )
      return followPlan;
    assert(!planning, 'FOLLOW_CYCLE', 'Root-follow track cannot depend on this character pose.');
    planning = true;
    try {
      const follower = rootFollower,
        version = followVersion;
      followPlan = planRootFollow({
        sample: (t) => {
          if (follower.config.weight === 1) return follower.track.sample(t);
          const baseline = x0 + travel(t);
          return follower.config.weight === 0
            ? baseline
            : lerp(baseline, follower.track.sample(t), follower.config.weight);
        },
        ...(follower.track.hasY
          ? {
              sampleY: (t) =>
                follower.config.weight === 1
                  ? follower.track.sampleY(t)
                  : lerp(baseY(rootXBaseline(t)) + anchorY(t), follower.track.sampleY(t), follower.config.weight),
            }
          : {}),
        end: Math.max(scene.duration, follower.track.end),
        layout: def.poseLayout,
        rest: def.rest,
        sizeAt,
        facingAt,
        config: follower.config,
      });
      assert(version === followVersion, 'FOLLOW_CHANGED', 'A root-track callback changed the scene during planning.');
      plannedVersion = version;
      return followPlan;
    } finally {
      planning = false;
    }
  }
  const rootXBaseline = (t) => x0 + travel(t);
  const rootX = (t) => (rootFollower ? ensureFollow().sample(t).x : x0 + travel(t));
  const rootY = (t) => (rootFollower?.track.hasY ? ensureFollow().sample(t).y : baseY(rootX(t)) + anchorY(t));
  function look(t) {
    let eyes = [0, 0],
      head = [0, 0];
    const steps = [];
    for (const l of looks) {
      steps.push([l.at, l.target]);
      if (l.until !== null) steps.push([l.until, [0, 0]]);
    }
    steps.sort((a, b) => a[0] - b[0]);
    let prev = [0, 0];
    for (const [at, target] of steps) {
      const d = [target[0] - prev[0], target[1] - prev[1]];
      // Eyes lead quickly; the head follows more slowly (overlapping action).
      const e = smooth(dampedStep(t - at, 0.03)),
        h = dampedStep(t - at, 0.2);
      eyes = [eyes[0] + d[0] * e, eyes[1] + d[1] * e];
      head = [head[0] + d[0] * h, head[1] + d[1] * h];
      prev = target;
    }
    return { eyes, head };
  }

  let lastTime = 0;
  const heldAt = (time) =>
    motionStyle.holdStill &&
    keyedLayers.some(
      (layer) =>
        layer.weight > 0 &&
        time <= layer.until &&
        layer.plan.entries.some((entry) => entry.hold > 0 && time >= entry.at && time <= entry.at + entry.hold),
    );
  const ctx = { def, seed, size, clips, scene, travel, facingAt, look, motionStyle };
  const basePose = scene.derive([], (c) => {
    const t = c.time,
      pose = { ...def.rest },
      rx = rootX(t),
      sampledRoot = { x: rx, y: rootY(t) },
      sNow = sizeAt(t);
    if (idleOn && def.idle && !heldAt(t) && motionStyle.idle > 0) {
      def.idle(pose, t, ctx);
      if (motionStyle.idle < 1)
        for (const key of Object.keys(pose)) pose[key] = lerp(def.rest[key] ?? 0, pose[key], motionStyle.idle);
    }
    // Mood layers before actions so an action can still override the face.
    for (const action of clips) {
      const w = envelope(t, action.at, action.duration, action.fadeIn, action.fadeOut);
      if (!w) continue;
      if (action.mood) for (const [k, v] of Object.entries(MOODS[action.mood])) blend(pose, `face.${k}`, v, w);
      else def.actions[action.name](pose, t - action.at, action.params, { ...ctx, clip: action, t }, w);
    }
    for (const layer of keyedLayers) {
      if (t < layer.plan.start || t > layer.until) continue;
      const weight =
        layer.weight *
        (layer.fadeIn ? clamp((t - layer.plan.start) / layer.fadeIn) : 1) *
        (layer.fadeOut ? clamp((layer.until - t) / layer.fadeOut) : 1);
      for (const [key, value] of Object.entries(samplePoseKeys(layer.plan, t, def.poseLayout)))
        if (!layer.channels || layer.channels.has(key)) blend(pose, key, value, weight);
    }
    if (rootFollower) {
      const config = rootFollower.config,
        planned = ensureFollow().sample(t),
        weight = config.weight;
      const lean = number(
        typeof config.lean === 'function' ? config.lean(planned.velocity) : config.lean,
        'follow lean',
      );
      add(pose, 'body.r', lean, weight);
      if (config.feet === 'auto') {
        for (const side of ['F', 'B']) {
          const foot = planned[side];
          pose[`leg${side}.mix`] = 1;
          pose[`leg${side}.targetEnabled`] = 0;
          blend(pose, `foot${side}.x`, (foot.x - rx) / (sNow * facingAt(t)), weight);
          blend(pose, `foot${side}.y`, (rootFollower.track.hasY ? foot.y - rootY(t) : foot.y) / sNow, weight);
        }
        if (def.reach) def.reach(pose);
      }
    }
    const gaze = look(t);
    add(pose, 'look.x', gaze.eyes[0]);
    add(pose, 'look.y', gaze.eyes[1]);
    add(pose, 'head.turn', gaze.head[0]);
    add(pose, 'head.r', gaze.head[1] * 0.18 + gaze.head[0] * 0.04);
    for (const s of speeches) {
      const m = s.timeline.sample(t);
      if (m) {
        for (const [k, v] of Object.entries(m)) blend(pose, `mouth.${k}`, v, s.weight(t));
      }
    }
    // Live drivers (pointer tracking, reactions) layer on top of every timed clip.
    for (const d of drivers) {
      const v = d.map(...d.inputs.map((i) => read(i, c)), pose, { root: sampledRoot, size: sNow, facing: facingAt(t) });
      for (const [k, value] of Object.entries(v)) d.mode === 'set' ? (pose[k] = value) : add(pose, k, value);
    }
    // Standing on a surface: each foot channel drops or rises to the ground under its own world x, so a
    // planted foot (fixed world x) stays on one ground point, then the rig lowers its hips to reach.
    if (ground && !(rootFollower?.track.hasY && rootFollower.config.weight > 0)) {
      const ry = ground.yAt(rx),
        sx = sNow * facingAt(t);
      for (const side of ['F', 'B'])
        if (typeof pose[`foot${side}.x`] === 'number') {
          pose[`leg${side}.mix`] = 1;
          pose[`leg${side}.targetEnabled`] = 0;
          pose[`foot${side}.y`] += (ground.yAt(rx + sx * pose[`foot${side}.x`]) - ry) / sNow;
        }
      if (def.reach) def.reach(pose);
    }
    if (def.post) def.post(pose, t, ctx);
    if (proportionInputs) {
      const head = scalar(proportionInputs.headScale, c, 'head scale', 0.1, 4);
      pose['head.sx'] = (pose['head.sx'] ?? 1) * head;
      pose['head.sy'] = (pose['head.sy'] ?? 1) * head;
      pose.limbWidth = scalar(proportionInputs.limbWidth, c, 'limb width', 0.1, 8);
    }
    fitJointContacts(pose, def.poseLayout, rootFollower?.config.feet === 'auto' || !!ground);
    if (rootFollower?.config.feet === 'auto') {
      const L = def.poseLayout;
      for (const side of ['F', 'B']) {
        const hx = (L.hipX?.[side] ?? 0) + (pose['body.x'] ?? 0),
          hy = L.HIP[1] + (pose['body.y'] ?? 0),
          fx = pose[`foot${side}.x`],
          fy = pose[`foot${side}.y`] - (L.ankle ?? 0);
        assert(
          Math.hypot(fx - hx, fy - hy) <= L.leg + 1e-6,
          'FOLLOW_REACH',
          'Layered pose exceeds automatic leg reach.',
        );
      }
    }
    return materializeJointPose(pose, def.poseLayout);
  });
  // Seven bounded history intervals per appendage. Short history and the angle cap are explicit
  // animation conventions; this is approximate follow-through, not a physical tissue model.
  const followers = new Map();
  if (spec.secondaryMotion !== false && motionStyle.overlap > 0)
    for (const part of def.parts)
      if (part.secondary) {
        const driver = scene.derive([basePose], (pose) => number(pose[part.secondary.driver], 'appendage driver'));
        followers.set(
          part.id,
          jiggle(scene, driver, { frequency: 4, damping: 0.7, history: 0.18, step: 0.03, maxSteps: 8 }),
        );
      }
  const frame = scene.derive([], (c) => {
    const t = c.time,
      pose = basePose.sample(c);
    lastTime = t;
    const world = solveBones(def, pose),
      fc = facingAt(t),
      out = {},
      turn = turnAt(t);
    const lightFrame = lighting
      ? {
          ambient: scalar(lighting.ambient, c, 'ambient light', 0, 1),
          amount: scalar(lighting.amount, c, 'rim amount', 0, 1),
          rim: lighting.rim,
          direction: lighting.direction,
        }
      : null;
    for (const part of def.parts) {
      const b = part.bone ? world[part.bone] : { x: 0, y: 0, r: 0, sx: 1, sy: 1 };
      const commands = part.draw ? part.draw(pose, world, ctx) : part.local;
      const entry = {
        x: b.x,
        y: b.y,
        rotation: b.r,
        scaleX: b.sx,
        scaleY: b.sy,
        commands,
        opacity: clamp((part.opacity ?? 1) * (part.alpha ? part.alpha(pose) : 1)),
      };
      const follower = followers.get(part.id);
      if (follower && !heldAt(t))
        entry.rotation +=
          motionStyle.overlap *
          clamp(
            (follower.sample(c) - pose[part.secondary.driver]) * part.secondary.amount,
            -part.secondary.maxAngle,
            part.secondary.maxAngle,
          );
      if (part.clip) entry.clip = clipPath({ commands: part.clip(pose, world, ctx) });
      if (!nativeShade && !part.stroke && part.shade !== false && commands.length) {
        const bb = bounds(commands),
          k = Math.min(bb.width, bb.height) * 0.13,
          lx = (lightFrame?.direction ?? def.light)[0] * fc,
          ly = (lightFrame?.direction ?? def.light)[1];
        const cr = Math.cos(-b.r),
          sr = Math.sin(-b.r),
          dx = cr * lx - sr * ly,
          dy = sr * lx + cr * ly;
        entry.lit = translate(commands, dx * k, dy * k);
        entry.hi = ellipse(
          bb.cx + dx * bb.width * 0.24,
          bb.cy + dy * bb.height * 0.26,
          bb.width * 0.1,
          bb.height * 0.07,
        );
        entry.clip = clipPath({ commands });
        entry.commands = entry.clip.commands; // one validated path serves the fill and the clip
      }
      if (turn && (!part.bone || def.bones[part.bone]?.parent)) entry.opacity *= turn.detail;
      out[part.id] = entry;
    }
    const rx = rootX(t),
      s = sizeAt(t);
    return {
      root: { x: rx, y: rootY(t) + (pose['root.y'] ?? 0) * s, scaleX: s * fc * (turn?.width ?? 1), scaleY: s },
      parts: out,
      pose,
      lighting: lightFrame,
      ...(rootFollower ? { follow: ensureFollow().sample(t) } : {}),
    };
  });

  handle.bind(['x', 'y', 'scaleX', 'scaleY'], { inputs: [frame], map: (v) => v.root });
  for (const part of def.parts) {
    const group = handle.part(part.id),
      pick = (v) => v.parts[part.id];
    group.bind(['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'], {
      inputs: [frame],
      map: (v) => {
        const p = pick(v);
        return { x: p.x, y: p.y, rotation: p.rotation, scaleX: p.scaleX, scaleY: p.scaleY, opacity: p.opacity };
      },
    });
    if (part.stroke) group.part('line').bind('commands', { inputs: [frame], map: (v) => pick(v).commands });
    else if (nativeShade || part.shade === false) {
      if (part.clip)
        group.part('fill').bind(['commands', 'clip'], {
          inputs: [frame],
          map: (v) => {
            const p = pick(v);
            return { commands: p.commands, clip: p.clip };
          },
        });
      else if (part.draw) group.part('fill').bind('commands', { inputs: [frame], map: (v) => pick(v).commands });
    } else {
      if (part.draw) group.part('under').bind('commands', { inputs: [frame], map: (v) => pick(v).commands });
      group.part('lit').bind(['commands', 'clip'], {
        inputs: [frame],
        map: (v) => {
          const p = pick(v);
          return { commands: p.lit ?? [], clip: p.clip ?? null };
        },
      });
      group.part('hi').bind(['commands', 'clip'], {
        inputs: [frame],
        map: (v) => {
          const p = pick(v);
          return { commands: p.hi ?? [], clip: p.clip ?? null };
        },
      });
    }
  }

  function clip(name, s, defaults = {}) {
    options(s, ['at', 'duration', 'fadeIn', 'fadeOut', ...Object.keys(defaults)], `${name} clip`);
    assert(
      name === null || typeof def.actions?.[name] === 'function',
      'UNKNOWN_ACTION',
      `${def.name} has no ${name} action.`,
    );
    const at = number(s.at ?? 0, 'clip start', 0, 86400),
      duration = number(
        s.duration ??
          (spec.motionStyle !== undefined && motionStyle.name !== 'legacy'
            ? motionStyle.beat
            : (defaults.duration ?? 1)),
        'clip duration',
        0.01,
        86400,
      );
    const entry = {
      name,
      at,
      duration,
      fadeIn: number(s.fadeIn ?? Math.min(0.25, duration / 3), 'fade in', 0, duration),
      fadeOut: number(s.fadeOut ?? Math.min(0.3, duration / 3), 'fade out', 0, duration),
      params: { ...defaults, ...s },
    };
    clips.push(entry);
    clips.sort((a, b) => a.at - b.at);
    scene._extend(at + duration);
    scene._changed();
    return entry;
  }

  const api = {
    id: handle.id,
    handle,
    definition: def,
    /** Palette lighting for the cutout rig; numeric inputs are sampled with scene time. */
    light(settings = {}) {
      options(settings, ['ambient', 'rim', 'amount', 'direction'], 'character light');
      assert(
        !nativeShade,
        'CHARACTER_LIGHT_UNSUPPORTED',
        'Palette lighting uses the default cutout shading, not native shade.',
      );
      const direction = settings.direction ?? def.light;
      assert(Array.isArray(direction) && direction.length === 2, 'INVALID_CHARACTER', 'Light direction is [x,y].');
      const next = {
        ambient: captureScalar(settings.ambient ?? 1, 'ambient light', 0, 1),
        amount: captureScalar(settings.amount ?? 0.6, 'rim amount', 0, 1),
        rim: settings.rim ?? null,
        direction: f(direction.map((v) => number(v, 'light direction', -1, 1))),
      };
      if (next.rim !== null) rgbaOf(next.rim);
      lighting = next;
      if (!lightInstalled) {
        for (const part of def.parts) {
          const group = handle.part(part.id),
            tone = palette[part.slot];
          const bindColor = (child, channel, key, rim = false) =>
            child.bind(channel, {
              inputs: [frame],
              map: (v) => {
                const l = v.lighting;
                return rim && l?.rim ? litColor(l.rim, l.amount) : litColor(tone[key], l?.ambient ?? 1);
              },
            });
          if (part.stroke) bindColor(group.part('line'), 'stroke', 'base');
          else if (part.shade === false) bindColor(group.part('fill'), 'fill', 'base');
          else {
            bindColor(group.part('under'), 'fill', 'shade', true);
            bindColor(group.part('lit'), 'fill', 'base');
            bindColor(group.part('hi'), 'fill', 'light');
          }
        }
        lightInstalled = true;
      }
      scene._changed();
      return api;
    },
    /** Head scale and stroked-limb thickness, layered over existing actions. */
    proportions(settings = {}) {
      options(settings, ['headScale', 'limbWidth'], 'character proportions');
      assert(
        Object.hasOwn(def.bones, 'head') || settings.headScale === undefined,
        'CHARACTER_PROPORTION_UNSUPPORTED',
        'headScale requires a head bone.',
      );
      assert(
        settings.limbWidth === undefined || def.parts.some((p) => p.stroke && p.length),
        'CHARACTER_PROPORTION_UNSUPPORTED',
        'limbWidth requires stroked limbs with length metadata.',
      );
      proportionInputs = {
        headScale: captureScalar(settings.headScale ?? 1, 'head scale', 0.1, 4),
        limbWidth: captureScalar(settings.limbWidth ?? 1, 'limb width', 0.1, 8),
      };
      if (!widthInstalled) {
        for (const part of def.parts)
          if (part.stroke && part.length)
            handle
              .part(part.id)
              .part('line')
              .bind('strokeWidth', { inputs: [frame], map: (v) => part.stroke * (v.pose.limbWidth ?? 1) });
        widthInstalled = true;
      }
      scene._changed();
      return api;
    },
    pose(name, dials = {}) {
      return poseVocabulary(def, name, dials);
    },
    /**
     * Arrive at keyed poses; optional channels select the numeric contribution of this layer.
     * @param {{at:number,pose?:Record<string,number|number[]>|string,facing?:number,ease?:string|{type:'samples',times:readonly number[],values:readonly number[]},hold?:number,duration?:number}[]} keys
     * @param {{weight?:number,fadeIn?:number,fadeOut?:number,until?:number,channels?:readonly string[]}} settings
     */
    keys(keys, settings = {}) {
      options(settings, ['weight', 'fadeIn', 'fadeOut', 'until', 'channels'], 'character pose layer');
      const named = (name) => {
        if (
          ['stand', 'reach', 'brace', 'hands-on-hips', 'think', 'step-back', 'arms-up', 'hands-on-head'].includes(name)
        )
          return poseVocabulary(def, name);
        if (def.poses?.[name]) return def.poses[name];
        if (name === 'rest') return def.rest;
        if (typeof def.actions?.[name] === 'function' && def.actionDefaults?.[name]?.speed === undefined) {
          const pose = { ...def.rest },
            params = def.actionDefaults?.[name] ?? {},
            entry = { name, at: 0, duration: 1, params, distance: () => 0, speed: 0 };
          def.actions[name](pose, 0.35, params, { ...ctx, clip: entry, t: 0.35 }, 1);
          return Object.fromEntries(Object.entries(pose).filter(([k, v]) => v !== def.rest[k]));
        }
        if (name === 'flinch')
          return {
            lean: -0.1,
            head: 0.12,
            hip: [0, 3],
            handF: [def.rest['handF.x'] - 5, def.rest['handF.y'] - 12],
            handB: [def.rest['handB.x'] + 4, def.rest['handB.y'] - 8],
          };
        assert(false, 'UNKNOWN_POSE', `Rig has no named ${name} pose.`);
      };
      const plan = preparePoseKeys(def, keys, named, {
          motionStyle: spec.motionStyle !== undefined ? motionStyle : undefined,
          seed,
        }),
        until = number(settings.until ?? 86400, 'pose layer end', plan.end, 86400),
        layer = {
          plan,
          until,
          weight: number(settings.weight ?? 1, 'pose layer weight', 0, 1),
          fadeIn: number(settings.fadeIn ?? 0, 'pose fade in', 0, 86400),
          fadeOut: number(settings.fadeOut ?? 0, 'pose fade out', 0, 86400),
        };
      if (settings.channels !== undefined) {
        assert(
          Array.isArray(settings.channels) && settings.channels.length > 0 && settings.channels.length <= 256,
          'INVALID_POSE_CHANNELS',
          'Select 1–256 unique produced pose channels.',
        );
        const captured = safeCopy(settings.channels);
        const selected = new Set();
        for (const name of captured) {
          assert(
            typeof name === 'string' && name.length > 0 && name.length <= 128 && Object.hasOwn(def.rest, name),
            'UNKNOWN_POSE_CHANNEL',
            'Select known numeric pose channel names.',
          );
          assert(
            plan.channels.includes(name),
            'INVALID_POSE_CHANNELS',
            'A channel mask may only select channels produced by this key plan.',
          );
          assert(!selected.has(name), 'INVALID_POSE_CHANNELS', 'Channel selections must be unique.');
          selected.add(name);
        }
        layer.channels = selected;
      }
      const plannedTurns = layer.weight > 0 ? plan.events.filter((event) => event.turn) : [];
      assert(
        !plannedTurns.length || rootFollower?.config.feet !== 'auto',
        'TURN_FOLLOW_UNSUPPORTED',
        'Use feet:none when authoring an edge turnaround.',
      );
      for (const event of plannedTurns)
        assert(
          ![...turns, ...plannedTurns.filter((other) => other !== event)].some(
            (other) => event.at - event.turn.duration < other.at && event.at > other.at - other.turn.duration,
          ),
          'INVALID_TURN',
          'Edge turnaround windows cannot overlap.',
        );
      turns.push(...plannedTurns);
      turns.sort((a, b) => a.at - b.at);
      keyedLayers.push(layer);
      keyedLayers.sort((a, b) => a.plan.start - b.plan.start);
      if (layer.weight > 0) keyFacing.push(...plan.events);
      keyFacing.sort((a, b) => a.at - b.at);
      scene._extend(plan.end);
      scene._changed();
      return api;
    },
    /**
     * Follow an absolute scene-x track with a seekable120Hz foot plan. Automatic feet own foot placement at full weight.
     * @param {number[][]|((time:number)=>number)|{sample:Function}} track
     * @param {{feet?:'auto'|'none',step?:{threshold?:number,duration?:number,lift?:number,lead?:number,maxLead?:number},lean?:number|((velocity:number)=>number),weight?:number}} settings
     */
    follow(track, settings = {}) {
      const config = followOptions(
        spec.motionStyle === undefined
          ? settings
          : { ...settings, step: { ...motionStyle.stepping, ...settings.step } },
      );
      assert(
        config.feet !== 'auto' || !turns.length,
        'TURN_FOLLOW_UNSUPPORTED',
        'Use feet:none when following through an edge turnaround.',
      );
      const captured = captureRootTrack(scene, track, read);
      assert(
        config.feet !== 'auto' ||
          (def.poseLayout?.leg && ['footF.x', 'footB.x'].every((k) => typeof def.rest[k] === 'number')),
        'FOLLOW_UNSUPPORTED',
        'Automatic feet require biped poseLayout; use feet:none for other rigs.',
      );
      captured.sample(0);
      if (!rootFollower)
        scene.onChange(() => {
          followVersion++;
        });
      rootFollower = { track: captured, config };
      followPlan = null;
      scene._extend(captured.end);
      scene._changed();
      return api;
    },
    /** Inspect the cached procedural contact plan without exposing mutable internal arrays. */
    followPlan() {
      const plan = ensureFollow();
      return plan
        ? Object.freeze({ rate: plan.rate, samples: plan.samples, duration: plan.duration, steps: plan.steps })
        : null;
    },
    /** Run a named action from the character's rig, e.g. 'wave', 'hop', 'flap'. */
    act(name, s = {}) {
      if (def.actionDefaults?.[name]?.speed !== undefined) return api.move(name, { ...def.actionDefaults[name], ...s });
      clip(name, s, def.actionDefaults?.[name] ?? {});
      return api;
    },
    /** Walk (or swim/fly for rigs that travel) at a speed in character units per second; direction 1 or -1. */
    move(name, s = {}) {
      return scene._batch(() => {
        const bipedGait = def.poseLayout && ['walk', 'run'].includes(name),
          gaitOptions = bipedGait
            ? { stride: undefined, lift: undefined, swing: undefined, bob: undefined, lean: undefined }
            : {};
        const entry = clip(name, s, {
          ...gaitOptions,
          speed: 80,
          direction: null,
          ramp: 0.35,
          ...(def.actionDefaults?.[name] ?? {}),
        });
        if (bipedGait && spec.motionStyle !== undefined && motionStyle.name !== 'legacy') {
          if (entry.params.stride === undefined)
            entry.params.stride = Math.min(1e5, 2 * entry.params.speed * motionStyle.stepping.duration);
          if (entry.params.lift === undefined) entry.params.lift = motionStyle.stepping.lift;
        }
        const speed = number(entry.params.speed, 'speed', 0, 1e4),
          r = Math.min(number(entry.params.ramp, 'ramp', 0, 10), entry.duration / 2),
          D = entry.duration;
        entry.speed = speed;
        entry.facing = entry.params.direction ?? facingAt(entry.at - 1e-9);
        assert(entry.facing === 1 || entry.facing === -1, 'INVALID_CHARACTER', 'direction is 1 or -1.');
        moveFacing.push({ at: entry.at, facing: entry.facing });
        moveFacing.sort((a, b) => a.at - b.at);
        // Eased start and stop: distance is the exact integral of speed × smooth ramps.
        entry.distance = (u) =>
          r === 0
            ? speed * u
            : u < r
              ? speed * r * smoothIntegral(u / r)
              : u <= D - r
                ? speed * (r / 2 + u - r)
                : speed * (D - r) - speed * r * smoothIntegral((D - u) / r);
        scene._changed();
        return api;
      });
    },
    /** Hold a facial mood ('happy', 'sad', 'surprised', 'angry', 'thinking', 'sleepy', 'neutral'). */
    emote(mood, s = {}) {
      assert(Object.hasOwn(MOODS, mood), 'UNKNOWN_MOOD', `Unknown mood ${mood}.`);
      const entry = clip(null, s);
      entry.mood = mood;
      return api;
    },
    /** Look toward a direction (x, y in [-1, 1]); eyes lead, the head follows. until: time to look back. */
    look(s = {}) {
      options(s, ['at', 'x', 'y', 'until'], 'look');
      looks.push({
        at: number(s.at ?? 0, 'look time', 0, 86400),
        target: [clamp(number(s.x ?? 0, 'look x'), -1, 1), clamp(number(s.y ?? 0, 'look y'), -1, 1)],
        until: s.until == null ? null : number(s.until, 'look until', 0, 86400),
      });
      scene._changed();
      return api;
    },
    /** Speak text with mouth shapes timed at rate characters per second. */
    say(text, s = {}) {
      options(s, ['at', 'rate'], 'say');
      const timeline = speech(String(text), {
        at: number(s.at ?? 0, 'speech start', 0, 86400),
        rate: number(s.rate ?? 13, 'speech rate', 1, 60),
      });
      speeches.push({
        timeline,
        weight: (t) => Math.min(smooth((t - timeline.at) / 0.06), smooth((timeline.end + 0.12 - t) / 0.12)),
      });
      clips.push({
        name: '__talk',
        at: timeline.at,
        duration: timeline.end - timeline.at + 0.12,
        fadeIn: 0.05,
        fadeOut: 0.1,
        params: { words: timeline.words },
      });
      clips.sort((a, b) => a.at - b.at);
      scene._extend(timeline.end + 0.2);
      scene._changed();
      return api;
    },
    /** Use externally prepared audio-aligned Rhubarb cues; text speech remains the default. */
    lipSync(input, s = {}) {
      const timeline = speechFromRhubarb(input, s);
      speeches.push({ timeline, weight: () => 1 });
      scene._extend(timeline.end + (s.blend ?? 0.04));
      scene._changed();
      return api;
    },
    /**
     * Drive pose channels from live scene inputs (parameters or derived values). map receives the input values,
     * the current pose and {root, size, facing}, and returns {channel: value}; mode 'add' (default) adds, 'set' replaces.
     */
    drive(inputs, map, s = {}) {
      options(s, ['mode'], 'drive');
      assert(
        Array.isArray(inputs) && inputs.every((i) => scene._ownsInput(i)) && typeof map === 'function',
        'INVALID_BINDING',
        "drive needs this scene's inputs and a map function.",
      );
      drivers.push({ inputs, map, mode: s.mode ?? 'add' });
      scene._changed();
      return api;
    },
    /**
     * Follow a live point (scene coordinates) with the eyes and head. The target is smoothed by a seekable
     * critically damped lag, so the eyes settle naturally and scrubbing stays exact.
     */
    track(x, y, s = {}) {
      options(s, ['halfLife', 'reach'], 'track');
      const reach = number(s.reach ?? 420, 'track reach', 1, 1e5),
        lx = lag(scene, x, { halfLife: s.halfLife ?? 0.12 }),
        ly = lag(scene, y, { halfLife: s.halfLife ?? 0.12 });
      return api.drive([lx, ly], (px, py, pose, live) => {
        const fc = live.facing,
          hx = live.root.x,
          hy = live.root.y - (def.height ?? 100) * 0.8 * live.size,
          dx = (px - hx) * fc,
          dy = py - hy;
        const ex = clamp(dx / reach, -1, 1),
          ey = clamp(dy / reach, -1, 1);
        return {
          'look.x': ex - (pose['look.x'] ?? 0) * 0.5,
          'look.y': ey - (pose['look.y'] ?? 0) * 0.5,
          'head.turn': ex * 0.6,
          'head.r': ey * 0.12,
        };
      });
    },
    /** Queue a walk (or swim) to scene x, starting at time at or when the current move ends. Returns the arrival time. */
    walkTo(x, s = {}) {
      options(s, ['at', 'speed', 'action'], 'walkTo');
      number(x, 'walk target');
      const name = s.action ?? (def.actions.walk ? 'walk' : 'swim'),
        speed = number(s.speed ?? def.actionDefaults?.[name]?.speed ?? 70, 'speed', 1, 1e4);
      let at = number(s.at ?? 0, 'walk start', 0, 86400);
      for (const c of clips) if (c.speed) at = Math.max(at, c.at + c.duration);
      const from = x0 + travel(at),
        distance = Math.abs(x - from) / sizeAt(at);
      if (distance === 0 || (name !== 'leap' && distance < 4)) return at;
      const duration = Math.max(0.6, distance / speed + 0.35);
      const ramp = Math.min(0.35, duration / 2);
      if (name === 'leap')
        assert(
          !rootFollower && !scales.some((scale) => scale.at < at + duration && scale.at + scale.duration > at),
          'CHANNEL_OWNED',
          'Targeted leaps require root travel ownership and constant scale during flight.',
        );
      api.move(name, { at, duration, ramp, speed: distance / (duration - ramp), direction: x > from ? 1 : -1 });
      return at + duration;
    },
    /**
     * Scale to k × the authored size over [at, at + duration], holding the feet (or, for fish and microbes,
     * the body centre) still. Successive calls continue from the previous value and may not overlap.
     */
    scaleTo(k, s = {}) {
      options(s, ['at', 'duration', 'ease', 'anchor'], 'scaleTo');
      const to = number(k, 'scale', 0.001, 1000),
        at = number(s.at ?? 0, 'scale start', 0, 86400),
        duration = number(s.duration ?? 1, 'scale duration', 0, 86400);
      const ease = s.ease ?? 'easeInOut',
        anchor = s.anchor ?? (feetRooted ? 'feet' : 'center');
      assert(
        typeof ease === 'function' || (typeof ease === 'string' && Object.hasOwn(easings, ease)),
        'INVALID_EASING',
        'Use a named easing or a trusted progress function.',
      );
      assert(anchor === 'feet' || anchor === 'center', 'INVALID_CHARACTER', 'scaleTo anchor is feet or center.');
      const bb = restBounds(def),
        ay = anchor === 'feet' ? (feetRooted ? 0 : bb.y1) : feetRooted ? (bb.y0 + bb.y1) / 2 : 0;
      assert(!ground || ay === 0, 'INVALID_CHARACTER', 'A character standing on a surface scales about its feet.');
      assert(
        scales.every((c) => at >= c.at + c.duration || at + duration <= c.at),
        'INVALID_CHARACTER',
        'scaleTo clips may not overlap; start the next one when the last ends.',
      );
      scales.push({ at, duration, to, from: 1, ay, ease: typeof ease === 'function' ? ease : easings[ease] });
      scales.sort((a, b) => a.at - b.at);
      scales.forEach((c, i) => {
        c.from = i ? scales[i - 1].to : 1;
      });
      scene._extend(at + duration);
      scene._changed();
      return api;
    },
    /** Stand on a surface from now on: the root follows surface.yAt(x) and each foot meets the ground under it. */
    standOn(where) {
      assert(isSurface(where), 'INVALID_CHARACTER', 'standOn takes a surface() from explainerkit/characters.');
      assert(
        scales.every((c) => !c.ay),
        'INVALID_CHARACTER',
        'A character standing on a surface scales about its feet.',
      );
      ground = where;
      scene._changed();
      return api;
    },
    /** The surface this character stands on, or null. */
    get ground() {
      return ground;
    },
    /** Drawn size multiplier (authored size × scaleTo) at time t. */
    sizeAt(time = 0) {
      return sizeAt(number(time, 'time', 0, 86400));
    },
    get facing() {
      return facingAt(lastTime);
    },
    /** The solved frame at a time: pose channels, root transform and every part's transform and commands. For audits and tools. */
    inspect(time = 0) {
      const value = frame.sample(scene._sampleContext({ time }));
      return {
        root: value.root,
        parts: value.parts,
        pose: value.pose,
        jointPose: jointPoseSnapshot(value.pose, def.poseLayout),
        lighting: value.lighting,
        ...(value.follow ? { follow: value.follow } : {}),
      };
    },
    /** Hold a prop through its real parent transform; controller disposal restores authored motion. */
    hold(prop, settings = {}) {
      return holdProp(scene, handle, prop, (hand, time) => api.socket('hand' + hand, time), settings);
    },
    /** Position and world orientation of a declared socket. */
    socket(name, time = 0) {
      const sock = def.sockets?.[name];
      assert(sock, 'UNKNOWN_SOCKET', `${def.name} has no ${name} socket.`);
      const context = scene._sampleContext({ time: number(time, 'socket time', 0, 86400) }),
        v = frame.sample(context);
      let px,
        py,
        dx = 1,
        dy = 0;
      if (sock.channel) {
        px = v.pose[sock.channel + '.x'];
        py = v.pose[sock.channel + '.y'];
      } else {
        const part = v.parts[sock.part];
        assert(part, 'UNKNOWN_SOCKET', 'Socket part is unavailable.');
        const c = Math.cos(part.rotation),
          sn = Math.sin(part.rotation),
          x = sock.at[0] * part.scaleX,
          y = sock.at[1] * part.scaleY;
        px = part.x + c * x - sn * y;
        py = part.y + sn * x + c * y;
        dx = c * part.scaleX;
        dy = sn * part.scaleX;
      }
      if (sock.direction) {
        const part = v.parts[sock.direction.part];
        assert(part && part.commands.length, 'UNKNOWN_SOCKET', 'Socket direction part is unavailable.');
        let previous = [0, 0],
          vector = [1, 0];
        for (const command of part.commands) {
          const kind = command[0];
          if (kind === 'Z') continue;
          const next = command.slice(-2);
          if (kind === 'L') vector = [next[0] - previous[0], next[1] - previous[1]];
          if (kind === 'Q' || kind === 'C')
            vector = [next[0] - command[command.length - 4], next[1] - command[command.length - 3]];
          previous = next;
        }
        const c = Math.cos(part.rotation),
          sn = Math.sin(part.rotation);
        dx = c * vector[0] * part.scaleX - sn * vector[1] * part.scaleY;
        dy = sn * vector[0] * part.scaleX + c * vector[1] * part.scaleY;
      }
      const m = scene.locate(handle, { time: context }).matrix;
      return Object.freeze({
        x: m[0] * px + m[2] * py + m[4],
        y: m[1] * px + m[3] * py + m[5],
        rotation: Math.atan2(m[1] * dx + m[3] * dy, m[0] * dx + m[2] * dy),
      });
    },
  };
  // Talking adds small nods on word starts; available to every rig.
  def.actions.__talk ??= (pose, u, params, c, w) => {
    for (const at of params.words) add(pose, 'head.r', 0.05 * Math.sin(Math.PI * clamp((c.t - at) / 0.25)), w);
  };
  return f(api);
}
