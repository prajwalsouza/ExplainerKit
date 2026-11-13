// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Original animation convention. @deprecated Use motionStyle for new style-aware authoring. */
export function snapPose(t: any): number;
/** Capture arrivals/holds transactionally; authoring arrays never leak into later seeks. */
export function preparePoseKeys(def: any, input: any, namedPose: any, settings?: {}): Readonly<{
    entries: readonly Readonly<{
        at: any;
        start: number;
        hold: any;
        arc: any;
        space: any;
        from: any;
        to: any;
        ease: any;
    }>[];
    channels: readonly any[];
    events: readonly Readonly<{
        turn?: Readonly<{
            duration: any;
            style: "edge";
        }> | undefined;
        at: any;
        facing: any;
    }>[];
    start: number;
    end: any;
}>;
export function samplePoseKeys(plan: any, time: any, layout: any): {
    [k: string]: any;
};
