// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function barTable(beats: any, curves: any, audibleEnd: any): any;
/**
 * Drops: the first half of a bar is clearly louder (3 LU or more) and heavier
 * in the bass than the fuller half of the bar before it, and the music stays
 * full afterwards. Comparing with the fuller half means a short stop before a
 * bar that simply continues is not mistaken for a drop.
 */
export function findDrops(bars: any, curves: any): {
    index: number;
    lift: number;
    bassLift: number;
}[];
export function deriveEvents(context: any): {
    sections: any;
    events: any[];
};
