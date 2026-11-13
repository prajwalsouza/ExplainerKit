import { motionTransition, resolveMotionStyle } from './motion-style.js';
import { assert, number, options, safeCopy } from '../core/validate.js';
import { easings } from '../core/timing.js';
import { sampledEasing } from '../core/measured-easing.js';
import { flattenJointPose, materializeJointPose, interpolateJointAngles } from './joint-pose.js';
import { bipedShoulder } from './pose-layout.js';
const lerp = (a, b, t) => a + (b - a) * t;
/** Original animation convention. @deprecated Use motionStyle for new style-aware authoring. */
export function snapPose(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (t < 0.15) return -0.05 * Math.sin((Math.PI * t) / 0.15);
  if (t < 0.75) {
    const u = (t - 0.15) / 0.6;
    return 1.04 * u * u * (3 - 2 * u);
  }
  return 1 + 0.04 * (1 - (t - 0.75) / 0.25) ** 2;
}
function flatten(def, input) {
  input = safeCopy(input);
  const out = {};
  flattenJointPose(def.poseLayout, input, out);
  for (const [key, value] of Object.entries(input)) {
    if (key === 'joints' || key === 'effectors' || key === 'diagnostics') continue;
    const channel = key === 'lean' ? 'body.r' : key === 'head' ? 'head.r' : key === 'hip' ? 'body' : key;
    if (['handF', 'handB', 'footF', 'footB', 'body'].includes(channel)) {
      assert(Array.isArray(value) && value.length === 2, 'INVALID_POSE', 'Point pose channels need [x,y].');
      out[channel + '.x'] = number(value[0], key + ' x');
      out[channel + '.y'] = number(value[1], key + ' y');
    } else out[channel] = number(value, key);
  }
  for (const key of Object.keys(out))
    assert(Object.hasOwn(def.rest, key), 'UNKNOWN_POSE_CHANNEL', `Rig has no ${key} pose channel.`);
  return out;
}
/** Capture arrivals/holds transactionally; authoring arrays never leak into later seeks. */
export function preparePoseKeys(def, input, namedPose, settings = {}) {
  const style = resolveMotionStyle(settings.motionStyle),
    seed = settings.seed ?? 1;
  const keys = safeCopy(input);
  assert(
    Array.isArray(keys) && keys.length > 0 && keys.length <= 10000,
    'INVALID_POSE_KEYS',
    'Use 1–10000 ordered pose keys.',
  );
  let previous = { ...def.rest },
    priorAt = 0,
    priorHold = 0,
    count = 0;
  const channels = new Set(),
    events = [],
    entries = [];
  for (const key of keys) {
    options(key, ['at', 'pose', 'facing', 'ease', 'hold', 'duration', 'turn', 'space', 'arc'], 'pose key');
    const transition = motionTransition(style, seed, entries.length);
    const at = number(key.at, 'pose arrival', 0, 86400),
      hold = number(key.hold ?? (settings.motionStyle ? transition.hold : 0), 'pose hold', 0, 86400);
    assert(
      at + hold <= 86400 && (!entries.length || at > priorAt),
      'INVALID_POSE_KEYS',
      'Pose keys must increase within the supported timeline.',
    );
    assert(at >= priorAt + priorHold, 'INVALID_POSE_KEYS', 'A new arrival cannot interrupt an explicit hold.');
    if (key.facing !== undefined) {
      assert(key.facing === 1 || key.facing === -1, 'INVALID_CHARACTER', 'Facing must be 1 or -1.');
      let turn;
      if (key.turn !== undefined) {
        options(key.turn, ['duration', 'style'], 'turn');
        assert((key.turn.style ?? 'edge') === 'edge', 'INVALID_TURN', 'Use the edge turnaround style.');
        turn = Object.freeze({
          duration: number(key.turn.duration ?? 0.12, 'turn duration', 0.001, at),
          style: 'edge',
        });
      }
      events.push(Object.freeze({ at, facing: key.facing, ...(turn ? { turn } : {}) }));
    }
    assert(key.turn === undefined || key.facing !== undefined, 'INVALID_TURN', 'A turnaround requires a facing key.');
    const patch =
        key.pose === undefined ? {} : flatten(def, typeof key.pose === 'string' ? namedPose(key.pose) : key.pose),
      state = { ...previous },
      source = { ...previous };
    Object.assign(state, patch);
    if (def.poseLayout && ['body.r', 'body.x', 'body.y', 'body.sx', 'body.sy'].some((k) => Object.hasOwn(patch, k)))
      for (const side of ['F', 'B'])
        if (Object.hasOwn(state, `hand${side}.x`)) {
          const before = bipedShoulder(previous, side, def.poseLayout),
            after = bipedShoulder(state, side, def.poseLayout);
          for (let i = 0; i < 2; i++) {
            const k = `hand${side}.${i ? 'y' : 'x'}`;
            if (!Object.hasOwn(patch, k)) state[k] += after[i] - before[i];
            channels.add(k);
          }
        }
    const space = key.space ?? style.interpolation;
    assert(space === 'joints' || space === 'targets', 'INVALID_POSE_KEYS', 'Pose space is joints or targets.');
    if (def.poseLayout?.limbs) {
      for (const [name, limb] of Object.entries(def.poseLayout.limbs)) {
        const targetChanged = ['.x', '.y'].some((suffix) => Object.hasOwn(patch, limb.effector + suffix)),
          jointChanged = ['.upper', '.lower'].some((suffix) => Object.hasOwn(patch, name + suffix)),
          bodyChanged = ['body.r', 'body.x', 'body.y', 'body.sx', 'body.sy'].some((k) => Object.hasOwn(patch, k));
        if (!targetChanged && !jointChanged && !bodyChanged && !Object.hasOwn(patch, name + '.mix')) continue;
        const explicitMix = Object.hasOwn(patch, name + '.mix'),
          contact =
            previous[name + '.targetEnabled'] > 0 &&
            (previous[name + '.mix'] ?? 1) > 0 &&
            !targetChanged &&
            !jointChanged;
        if (patch[name + '.targetEnabled'] > 0 && !(previous[name + '.targetEnabled'] > 0)) {
          source[name + '.targetEnabled'] = 1;
          source[name + '.targetX'] = previous[limb.effector + '.x'];
          source[name + '.targetY'] = previous[limb.effector + '.y'];
        }
        if (jointChanged && space === 'joints' && state[name + '.mix'] === 0) source[name + '.mix'] = 0;
        if (targetChanged && !explicitMix) {
          state[name + '.targetEnabled'] = 0;
          source[name + '.targetEnabled'] = 0;
          state[name + '.mix'] = 1;
          channels.add(name + '.targetEnabled');
          if (space === 'targets') source[name + '.mix'] = 1;
        }
        if (bodyChanged && !targetChanged && !explicitMix && !contact && space === 'joints') state[name + '.mix'] = 0;
        materializeJointPose(state, def.poseLayout);
        if (space === 'joints' && !explicitMix && !contact) {
          state[name + '.mix'] = 0;
          source[name + '.mix'] = 0;
        }
        for (const suffix of ['.upper', '.lower', '.mix']) channels.add(name + suffix);
        for (const suffix of ['.x', '.y']) channels.add(limb.effector + suffix);
      }
    }
    for (const k of Object.keys(patch)) channels.add(k);
    count += Object.keys(state).length;
    assert(count <= 200000, 'RESOURCE_LIMIT', 'Pose key/channel capture budget exceeded.');
    const available = at - (entries.length ? priorAt + priorHold : 0),
      duration = number(
        key.duration ?? Math.min(settings.motionStyle ? transition.duration : 0.3, available),
        'pose transition',
        0,
        86400,
      );
    assert(duration <= available, 'INVALID_POSE_KEYS', 'Pose transition overlaps a prior hold.');
    const easing = key.ease ?? (settings.motionStyle ? 'style' : 'snap');
    let ease;
    if (easing && typeof easing === 'object') {
      // The outer safeCopy already captured JSON data without running authored accessors.
      options(easing, ['type', 'times', 'values'], 'pose sampled easing');
      assert(easing.type === 'samples', 'INVALID_EASING', 'Use easing type samples.');
      assert(
        Array.isArray(easing.times) && Array.isArray(easing.values),
        'INVALID_EASING_SAMPLES',
        'Pose sampled easing requires paired times and values arrays.',
      );
      ease = sampledEasing(easing.times, easing.values);
    } else {
      assert(
        easing === 'style' || easing === 'snap' || (typeof easing === 'string' && Object.hasOwn(easings, easing)),
        'INVALID_EASING',
        'Use snap, a named easing, or {type:samples,times,values}.',
      );
      ease = easing === 'style' ? transition.ease : easing === 'snap' ? snapPose : easings[easing];
    }
    entries.push(
      Object.freeze({
        at,
        start: at - duration,
        hold,
        arc: number(key.arc ?? transition.arc, 'pose arc', 0, 1),
        space,
        from: Object.freeze(source),
        to: Object.freeze(state),
        ease,
      }),
    );
    previous = state;
    priorAt = at;
    priorHold = hold;
  }
  return Object.freeze({
    entries: Object.freeze(entries),
    channels: Object.freeze([...channels]),
    events: Object.freeze(events),
    start: entries[0].start,
    end: entries.at(-1).at + entries.at(-1).hold,
  });
}
export function samplePoseKeys(plan, time, layout) {
  let from = plan.entries[0].from,
    to = from,
    k = 1,
    arc = 0,
    space = 'joints';
  for (const entry of plan.entries) {
    if (time >= entry.at) {
      from = entry.to;
      to = from;
      continue;
    }
    if (time > entry.start) {
      from = entry.from;
      to = entry.to;
      k = entry.ease((time - entry.start) / (entry.at - entry.start));
      arc = entry.arc ?? 0;
      space = entry.space ?? 'joints';
    }
    break;
  }
  const pose = { ...from };
  for (const key of plan.channels)
    pose[key] =
      key.endsWith('.upper') || key.endsWith('.lower')
        ? interpolateJointAngles(from[key], to[key], k)
        : lerp(from[key], to[key], k);
  if (layout && from !== to)
    for (const side of ['F', 'B'])
      if (plan.channels.includes(`hand${side}.x`) && (pose[`arm${side}.mix`] ?? 1) > 0) {
        const a = bipedShoulder(from, side, layout),
          b = bipedShoulder(to, side, layout),
          now = bipedShoulder(pose, side, layout);
        for (let i = 0; i < 2; i++) {
          const key = `hand${side}.${i ? 'y' : 'x'}`;
          pose[key] = now[i] + lerp(from[key] - a[i], to[key] - b[i], k);
        }
      }
  if (space === 'targets' && arc && from !== to)
    for (const side of ['F', 'B']) {
      const x = `hand${side}.x`,
        y = `hand${side}.y`;
      if (!plan.channels.includes(x)) continue;
      const dx = to[x] - from[x],
        dy = to[y] - from[y],
        bow = arc * Math.sin(Math.PI * Math.max(0, Math.min(1, k)));
      pose[x] -= dy * bow;
      pose[y] += dx * bow;
    }
  for (const key of plan.channels) {
    if (key.endsWith('.mix')) pose[key] = Math.max(0, Math.min(1, pose[key]));
    if (key.endsWith('.stretch')) pose[key] = Math.max(1, Math.min(4, pose[key]));
    if (key.endsWith('.compress')) pose[key] = Math.max(0.25, Math.min(1, pose[key]));
    if (key.endsWith('.softness')) pose[key] = Math.max(0, Math.min(2e6, pose[key]));
  }
  materializeJointPose(pose, layout);
  return Object.fromEntries(plan.channels.map((key) => [key, pose[key]]));
}
