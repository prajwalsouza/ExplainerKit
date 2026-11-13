// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** @param {TimelineOptions} [spec] @returns {Timeline} */
export function createTimeline(spec?: TimelineOptions): Timeline;
export function isTimeline(value: any): boolean;
/** Pure, reusable named-channel orchestration. Native seconds throughout. */
export class Timeline {
    /** @param {TimelineOptions} [spec] */
    constructor(spec?: TimelineOptions);
    get version(): number;
    get labels(): any;
    get duration(): number;
    get iterationDuration(): number;
    get authoredDuration(): number;
    /** @param {TimelinePosition} [position] @param {number} [fallback] @returns {number} */
    resolvePosition(position?: TimelinePosition, fallback?: number): number;
    /** @param {string} label @param {TimelinePosition} [position] */
    label(label: string, position?: TimelinePosition): this;
    /** @param {number} duration @param {TimelinePosition} [position] */
    wait(duration: number, position?: TimelinePosition): this;
    /** @param {Record<string,TimelineChannel>|Timeline} channels @param {TimelinePosition} [position] */
    add(channels: Record<string, TimelineChannel> | Timeline, position?: TimelinePosition): this;
    /** @param {Record<string,TimelineValue>} channels @param {TimelinePosition} [position] */
    set(channels: Record<string, TimelineValue>, position?: TimelinePosition): this;
    /** @param {Timeline} child @param {TimelinePosition} [position] */
    child(child: Timeline, position?: TimelinePosition): this;
    /** @param {{name:string,data?:unknown}} spec @param {TimelinePosition} [position] */
    event(spec: {
        name: string;
        data?: unknown;
    }, position?: TimelinePosition): this;
    /** @param {string} key @param {number} [time] @returns {TimelineValue|undefined} */
    valueAt(key: string, time?: number): TimelineValue | undefined;
    /** @param {number} [time] @returns {TimelineSnapshot} */
    sample(time?: number): TimelineSnapshot;
    /** Capture an immutable plan with a stable positional channel layout.
     * Later authoring does not change this prepared plan.
     * @returns {PreparedTimeline}
     */
    prepare(): PreparedTimeline;
    /** @param {number} from @param {number} to @param {{maxEvents?:number}} [spec] @returns {ReadonlyArray<TimelineEvent>} */
    eventsBetween(from: number, to: number, spec?: {
        maxEvents?: number;
    }): ReadonlyArray<TimelineEvent>;
    /** @param {number} factor */
    scaleTime(factor: number): this;
    /** @param {number} duration */
    stretch(duration: number): this;
    #private;
}
export type TimelineValue = number | string;
export type TimelineEase = string | ((progress: number) => number);
export type TimelinePosition = number | string;
export type TimelineKeyframe = {
    from?: TimelineValue;
    to: TimelineValue;
    duration?: number;
    delay?: number;
    at?: number;
    ease?: TimelineEase;
    modifier?: (value: TimelineValue) => TimelineValue;
};
export type TimelineChannel = {
    from?: TimelineValue;
    to?: TimelineValue;
    duration?: number;
    delay?: number;
    ease?: TimelineEase;
    repeat?: number;
    repeatDelay?: number;
    alternate?: boolean;
    reversed?: boolean;
    keyframes?: TimelineKeyframe[];
    interpolate?: (from: TimelineValue, to: TimelineValue, progress: number) => TimelineValue;
    modifier?: (value: TimelineValue) => TimelineValue;
    type?: "color" | "string" | "discrete";
};
export type TimelineOptions = {
    defaults?: {
        duration?: number;
        ease?: TimelineEase;
    };
    repeat?: number;
    repeatDelay?: number;
    alternate?: boolean;
    reversed?: boolean;
};
export type TimelineSnapshot = Readonly<{
    values: Readonly<Record<string, TimelineValue>>;
    localTime: number;
    iteration: number;
    direction: number;
    duration: number;
}>;
export type TimelineValuesSnapshot = Readonly<{
    channels: readonly string[];
    values: readonly TimelineValue[];
    localTime: number;
    iteration: number;
    direction: number;
    duration: number;
}>;
export type PreparedTimeline = Readonly<{
    channels: readonly string[];
    version: number;
    duration: number;
    sample: (time?: number) => TimelineValuesSnapshot;
}>;
export type TimelineEvent = Readonly<{
    name: string;
    data?: unknown;
    time: number;
    at: number;
    direction: number;
    iteration: number;
    order: number;
}>;
