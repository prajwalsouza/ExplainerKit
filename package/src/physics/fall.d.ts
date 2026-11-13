// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Seekable fall with exponential drag: terminal is speed in units/s, ramp is seconds.
 * @param {{from?:number,to:number,terminal?:number,ramp?:number,at?:number}} spec
 */
export function fall(spec?: {
    from?: number;
    to: number;
    terminal?: number;
    ramp?: number;
    at?: number;
}): Readonly<{
    from: any;
    to: any;
    at: any;
    end: any;
    duration: any;
    terminal: any;
    ramp: any;
    state: (time: any) => Readonly<{
        value: any;
        velocity: 0;
        landed: true;
    }> | Readonly<{
        value: any;
        velocity: number;
        landed: false;
    }>;
    sample: (time: any) => any;
    velocity: (time: any) => number;
}>;
