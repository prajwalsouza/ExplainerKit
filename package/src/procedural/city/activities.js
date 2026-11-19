import { assert, number, options } from '../../core/validate.js';
import { randomAt } from '../../noise/vector.js';

// What the people in a street are doing. Not everyone walks: some stand in small groups and
// talk, some wait on their own or look at a phone, some drift along the shop fronts and stop
// to look, and some walk side by side with a companion. Every one of these is a pure function
// of time, like a walker, so a shot stays seekable.

/** Activity codes, as stored in `city.people.activity`. */
export const ACTIVITY = Object.freeze({ walk: 0, pair: 1, talk: 2, stand: 3, browse: 4 });
/** The activity names, in code order. */
export const personActivities = Object.freeze(['walk', 'pair', 'talk', 'stand', 'browse']);

/**
 * The default mix. `walk`, `talk`, `stand` and `browse` are relative shares of the people on a
 * street; `pairs` is the share of walkers who walk beside a companion; `groupSize` is the
 * largest talking group.
 */
export const PERSON_ACTIVITIES = Object.freeze({
  walk: 0.6,
  talk: 0.2,
  stand: 0.1,
  browse: 0.1,
  pairs: 0.3,
  groupSize: 4,
});

/** Read the `activities` setting of `people`: 'walk', 'mixed' or an object of shares. */
export function activityMix(value) {
  if (value === 'mixed') return PERSON_ACTIVITIES;
  if (value === undefined || value === 'walk')
    return Object.freeze({ ...PERSON_ACTIVITIES, walk: 1, talk: 0, stand: 0, browse: 0, pairs: 0 });
  assert(
    value && typeof value === 'object' && !Array.isArray(value),
    'INVALID_CITY',
    "activities is 'mixed', 'walk' or an object of shares.",
  );
  options(value, ['walk', 'talk', 'stand', 'browse', 'pairs', 'groupSize'], 'activities');
  const mix = { ...PERSON_ACTIVITIES };
  for (const key of ['walk', 'talk', 'stand', 'browse', 'pairs']) {
    if (value[key] !== undefined) mix[key] = number(value[key], `activities.${key}`, 0, 1);
  }
  if (value.groupSize !== undefined) mix.groupSize = Math.round(number(value.groupSize, 'activities.groupSize', 2, 6));
  assert(
    mix.walk + mix.talk + mix.stand + mix.browse > 0,
    'INVALID_CITY',
    'At least one of walk, talk, stand and browse must be above 0.',
  );
  return Object.freeze(mix);
}

/** Pick an activity for one person from the mix, with a number from 0 to 1. */
export function chooseActivity(mix, r) {
  const total = mix.walk + mix.talk + mix.stand + mix.browse;
  let u = r * total;
  if ((u -= mix.walk) < 0) return 'walk';
  if ((u -= mix.talk) < 0) return 'talk';
  if ((u -= mix.stand) < 0) return 'stand';
  return 'browse';
}

/** How many people a talking group holds: pairs most often, larger groups less often. */
export function groupSize(mix, r) {
  const largest = Math.max(2, mix.groupSize);
  // Weights 1, 1/2, 1/4 ... for sizes 2, 3, 4 ...
  let total = 0;
  for (let s = 2; s <= largest; s++) total += 2 ** (2 - s);
  let u = r * total;
  for (let s = 2; s <= largest; s++) if ((u -= 2 ** (2 - s)) < 0) return s;
  return largest;
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Who speaks in talking group `group` during conversation turn `slot`, as a member number. The
 * same group and turn always give the same speaker.
 */
export function speakerAt(seed, group, slot, size) {
  return Math.floor(randomAt(seed, 610000 + group, slot) * size) % size;
}

/**
 * What a standing person's arms and head do at `time`. `a` is the person's twelve activity
 * numbers, `index` its number, `activity` the whole activity array and `seed` the city seed.
 * Returns {arms: [leftArm, leftElbow, leftWeight, rightArm, rightElbow, rightWeight],
 * head: [yaw, nod], turn: extra body turn, sway: sideways shift in metres}. The weights say how
 * much of each arm's pose replaces the hanging arm; angles are radians.
 */
export function standingGesture(a, index, activity, seed, time) {
  const r = (k) => randomAt(seed, 620000 + index, k);
  const arms = [0, 0, 0, 0, 0, 0],
    head = [0, 0];
  // Everyone standing shifts their weight now and then and turns a little.
  const sway = 0.018 * Math.sin(time * (0.35 + 0.2 * r(1)) + 6.28 * r(2));
  let turn = 0.06 * Math.sin(time * (0.11 + 0.08 * r(3)) + 6.28 * r(4));
  if (a[0] === ACTIVITY.talk) {
    const size = a[6],
      member = a[5],
      first = index - member,
      slotLength = a[9],
      energy = a[10],
      hand = a[11] > 0.5 ? 0 : 3;
    const at = time + a[4] * 1.7;
    const slot = Math.floor(at / slotLength),
      u = at - slot * slotLength;
    const speaker = speakerAt(seed, a[4], slot, size),
      before = speakerAt(seed, a[4], slot - 1, size);
    const speaking = speaker === member;
    if (speaking) {
      // The speaker talks with the hands: one forearm comes up and moves with the words, the
      // other joins in now and then.
      const on = smooth(0, 0.7, u) * smooth(slotLength, slotLength - 0.6, u);
      const beat = time * (2.2 + 1.4 * r(5)) + 6.28 * r(6);
      arms[hand] = 0.3 + 0.18 * energy + 0.12 * Math.sin(beat);
      arms[hand + 1] = 1.35 + 0.35 * Math.sin(beat * 0.7 + 1.1);
      arms[hand + 2] = on * (0.55 + 0.45 * energy);
      const other = 3 - hand;
      const both = Math.max(0, Math.sin(time * 0.9 + 6.28 * r(7)));
      arms[other] = 0.22 + 0.1 * Math.sin(beat * 1.3 + 2);
      arms[other + 1] = 1.2 + 0.3 * Math.sin(beat * 0.9);
      arms[other + 2] = on * energy * both;
      head[1] = 0.05 * Math.sin(beat * 0.5);
    } else if (a[7] > 0.5) {
      // Some listeners hold their hands together in front.
      arms[0] = arms[3] = 0.2;
      arms[1] = arms[4] = 1.25;
      arms[2] = arms[5] = 0.85;
    }
    // Everyone looks at whoever is speaking; the speaker looks round the group.
    const lookAt = (who) => {
      if (who === member) return 0.35 * Math.sin(time * 0.6 + member);
      const b = (first + who) * 12;
      const dx = activity[b + 1] - a[1],
        dy = activity[b + 2] - a[2];
      return Math.max(-1.1, Math.min(1.1, wrap(Math.atan2(dy, dx) - a[3])));
    };
    const blend = smooth(0, 0.5, u);
    head[0] = lookAt(before) * (1 - blend) + lookAt(speaker) * blend;
    // Listeners nod now and then.
    if (!speaking) head[1] += 0.12 * Math.max(0, Math.sin(time * (0.8 + 0.5 * r(8)) + 6.28 * r(9))) ** 6;
    // Turn the shoulders a little toward the speaker rather than only the head.
    turn += head[0] * 0.25;
    head[0] *= 0.75;
  } else if (a[0] === ACTIVITY.stand) {
    if (a[4] > 0.5) {
      // Looking at a phone held in both hands.
      arms[0] = 0.42;
      arms[1] = 1.75;
      arms[2] = 0.9;
      arms[3] = 0.5;
      arms[4] = 1.95;
      arms[5] = 1;
      head[1] = 0.38;
      head[0] = 0.05 * Math.sin(time * 0.3 + a[5]);
    } else {
      // Waiting: looking along the street one way and then the other.
      const look = Math.sin(time * (0.18 + 0.1 * r(10)) + a[5]);
      head[0] = 0.85 * Math.sign(look) * Math.abs(look) ** 0.4;
      head[1] = -0.04;
    }
  }
  return { arms, head, turn, sway };
}
