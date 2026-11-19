// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Two-bone reach in 2D: the joint position for a chain from `root` toward `target`. */
export function twoBoneJoint(root: any, target: any, upper: any, lower: any, bend?: number): {
    x: any;
    y: any;
    reached: boolean;
};
/**
 * Plan a gait. `speed` is in body units per second and `stride` is the distance the body moves
 * per full cycle. `hip` and `shoulder` are offsets from the body centre to the hind and fore leg
 * roots (y down, so a root above the feet has negative y). `ground` is the ground's y.
 * pose(time) returns the body position and pitch, each foot (and whether it is planted) and each knee.
 */
export function quadrupedGait(spec?: {}): Readonly<{
    gait: any;
    period: number;
    duty: any;
    pose(time: any): Readonly<{
        body: Readonly<{
            x: any;
            y: number;
            pitch: number;
        }>;
        roots: Readonly<{
            hind: {
                x: number;
                y: number;
            };
            fore: {
                x: number;
                y: number;
            };
        }>;
        feet: Readonly<{
            [k: string]: Readonly<{
                x: any;
                y: any;
                planted: boolean;
                phase: number;
            }>;
        }>;
        knees: Readonly<{
            [k: string]: Readonly<{
                x: any;
                y: any;
                reached: boolean;
            }>;
        }>;
    }>;
}>;
export const QUADRUPED_GAITS: Readonly<{
    walk: Readonly<{
        phases: Readonly<{
            LH: 0;
            LF: 0.25;
            RH: 0.5;
            RF: 0.75;
        }>;
        duty: 0.7;
        bob: 0.02;
    }>;
    trot: Readonly<{
        phases: Readonly<{
            LH: 0;
            RF: 0;
            RH: 0.5;
            LF: 0.5;
        }>;
        duty: 0.5;
        bob: 0.04;
    }>;
    pace: Readonly<{
        phases: Readonly<{
            LH: 0;
            LF: 0;
            RH: 0.5;
            RF: 0.5;
        }>;
        duty: 0.5;
        bob: 0.04;
    }>;
    canter: Readonly<{
        phases: Readonly<{
            LH: 0;
            RH: 0.3;
            LF: 0.3;
            RF: 0.6;
        }>;
        duty: 0.4;
        bob: 0.07;
    }>;
    gallop: Readonly<{
        phases: Readonly<{
            LH: 0;
            RH: 0.1;
            LF: 0.5;
            RF: 0.6;
        }>;
        duty: 0.3;
        bob: 0.08;
    }>;
}>;
