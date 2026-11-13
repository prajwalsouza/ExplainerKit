// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** A pure ambient-clock input. Browser scheduling belongs to the mounted player. */
export class Ambient {
    /** @param {{rate?:number,offset?:number}} [spec] */
    constructor(spec?: {
        rate?: number;
        offset?: number;
    });
    rate: any;
    offset: any;
    sample(seconds?: number): any;
}
