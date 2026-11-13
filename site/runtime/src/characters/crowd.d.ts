// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Stage a crowd standing in rows on a ground. Row 0 is the front row and stands on `ground`; each row
 * behind stands on the ground raised by `rise` (and scaled by depthScale), so farther rows are smaller and
 * higher. With stagger 'half' each row sits half a place off the row in front, so heads fall in the gaps;
 * the rise grows where needed so no head overlaps a head in the adjacent row. Members are painted back row
 * first and all carry `tag`, so the composition audit treats the crowd as one group and checks its footing.
 *
 * cast: an array of character definitions (one member each) or a count of seeded beans.
 * Returns {actors, spots, rows, surfaces, tag}; actors[i] and spots[i] belong to cast member i.
 * @param {import('../core/scene.js').Scene} scene
 * @param {number|any[]} cast
 * @param {{rows?:number,ground?:any,x0?:number,x1?:number,stagger?:'half'|'none',depthScale?:number,rise?:number,size?:number,height?:number|string,unit?:number,seed?:number,tag?:string|null,facing?:'center'|1|-1,each?:{idle?:boolean,shade?:any,secondaryMotion?:boolean},lod?:{below?:number,displayWidth?:number}}} [spec]
 */
export function crowd(scene: import("../core/scene.js").Scene, cast: number | any[], spec?: {
    rows?: number;
    ground?: any;
    x0?: number;
    x1?: number;
    stagger?: "half" | "none";
    depthScale?: number;
    rise?: number;
    size?: number;
    height?: number | string;
    unit?: number;
    seed?: number;
    tag?: string | null;
    facing?: "center" | 1 | -1;
    each?: {
        idle?: boolean;
        shade?: any;
        secondaryMotion?: boolean;
    };
    lod?: {
        below?: number;
        displayWidth?: number;
    };
}): any;
