// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Opt into one uniform-root union filter for contiguous world roots, preserving paint order.
 * @param {import('../../core/scene.js').Scene} scene
 * @param {any[]} handles
 * @param {{blur?:number|{radius?:number,space?:'world'|'screen',maxScreen?:number,strict?:boolean},glow?:any,time?:number}} [spec]
 */
export function effectBatch(scene: import("../../core/scene.js").Scene, handles: any[], spec?: {
    blur?: number | {
        radius?: number;
        space?: "world" | "screen";
        maxScreen?: number;
        strict?: boolean;
    };
    glow?: any;
    time?: number;
}): any;
