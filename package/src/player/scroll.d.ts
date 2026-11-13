// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Clamp a position into an authored interval. A zero-length interval is a cut. */
export function scrollProgress({ position, start, end }: {
    position: any;
    start?: number | undefined;
    end: any;
}): number;
/** Map progress to time, optionally selecting the latest reached chapter. */
export function scrollTime(progress: any, duration: any, chapters?: null): number;
/**
 * Drive an existing player from native scrolling. The region should be an
 * untransformed block containing a sticky stage; this driver does not pin it.
 * start/end are pixel offsets into the region's available scroll travel.
 * reducedMotion:'chapters' quantizes only when the media query requests it.
 * A later scheduled failure detaches and reports through onError or the player.
 * Initial attachment and explicit refresh failures remain synchronous errors.
 */
export function attachScroll(player: any, config: any): Readonly<{
    refresh: () => void;
    dispose: () => void;
    /** The reader's scroll pace now: velocity (px/s), speed (viewports/s), direction and pace class. */
    readonly pace: Readonly<{
        position: any;
        velocity: any;
        speed: number;
        direction: number;
        pace: "reading" | "still" | "skimming" | "rushing";
    }>;
    /** The arrival plan when the scroll opened part-way (with waiting and done), else null. */
    readonly arrival: any;
}>;
export { scrollPace, arrivalPlan, arrivalTime, SCROLL_PACES, DEFAULT_PACE_BOUNDS, ARRIVALS } from "./pace.js";
