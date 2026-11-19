// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Read the `activities` setting of `people`: 'walk', 'mixed' or an object of shares. */
export function activityMix(value: any): Readonly<{
    walk: 0.6;
    talk: 0.2;
    stand: 0.1;
    browse: 0.1;
    pairs: 0.3;
    groupSize: 4;
}> | Readonly<{
    walk: 1;
    talk: 0;
    stand: 0;
    browse: 0;
    pairs: 0;
    groupSize: 4;
}>;
/** Pick an activity for one person from the mix, with a number from 0 to 1. */
export function chooseActivity(mix: any, r: any): "walk" | "talk" | "stand" | "browse";
/** How many people a talking group holds: pairs most often, larger groups less often. */
export function groupSize(mix: any, r: any): number;
/**
 * Who speaks in talking group `group` during conversation turn `slot`, as a member number. The
 * same group and turn always give the same speaker.
 */
export function speakerAt(seed: any, group: any, slot: any, size: any): number;
/**
 * What a standing person's arms and head do at `time`. `a` is the person's twelve activity
 * numbers, `index` its number, `activity` the whole activity array and `seed` the city seed.
 * Returns {arms: [leftArm, leftElbow, leftWeight, rightArm, rightElbow, rightWeight],
 * head: [yaw, nod], turn: extra body turn, sway: sideways shift in metres}. The weights say how
 * much of each arm's pose replaces the hanging arm; angles are radians.
 */
export function standingGesture(a: any, index: any, activity: any, seed: any, time: any): {
    arms: number[];
    head: number[];
    turn: number;
    sway: number;
};
/** Activity codes, as stored in `city.people.activity`. */
export const ACTIVITY: Readonly<{
    walk: 0;
    pair: 1;
    talk: 2;
    stand: 3;
    browse: 4;
}>;
/** The activity names, in code order. */
export const personActivities: readonly string[];
/**
 * The default mix. `walk`, `talk`, `stand` and `browse` are relative shares of the people on a
 * street; `pairs` is the share of walkers who walk beside a companion; `groupSize` is the
 * largest talking group.
 */
export const PERSON_ACTIVITIES: Readonly<{
    walk: 0.6;
    talk: 0.2;
    stand: 0.1;
    browse: 0.1;
    pairs: 0.3;
    groupSize: 4;
}>;
