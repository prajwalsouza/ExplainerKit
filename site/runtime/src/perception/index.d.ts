// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Explainable grouping suggestions. Explicit semantic exclusions win over heuristics.
 * @param {Array<{id:string,bounds:{x:number,y:number,width:number,height:number},ink?:number[][],inkWidth?:number,velocity?:{x:number,y:number},similarity?:string,region?:string}>} input
 * @param {{distance?:number,similarityDistance?:number,motionDistance?:number,velocityTolerance?:number,minSpeed?:number,together?:string[][],apart?:string[][],connections?:string[][]}} [spec]
 */
export function perceptualGroups(input: Array<{
    id: string;
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    ink?: number[][];
    inkWidth?: number;
    velocity?: {
        x: number;
        y: number;
    };
    similarity?: string;
    region?: string;
}>, spec?: {
    distance?: number;
    similarityDistance?: number;
    motionDistance?: number;
    velocityTolerance?: number;
    minSpeed?: number;
    together?: string[][];
    apart?: string[][];
    connections?: string[][];
}): Readonly<{
    groups: readonly Readonly<{
        id: `group:${any}`;
        members: readonly any[];
    }>[];
    edges: readonly Readonly<{
        accepted: boolean;
        blockedBy: any;
        a: any;
        b: any;
        reasons: readonly string[];
        gap: number;
        priority: number;
    }>[];
    policy: Readonly<{
        distance: any;
        similarityDistance: any;
        motionDistance: any;
        velocityTolerance: any;
        minSpeed: any;
    }>;
    semanticGroups: any;
}>;
/** Common onset: keep each proposed group together in an authored entrance sequence. */
export function groupStagger(plan: any, spec?: {}): any;
