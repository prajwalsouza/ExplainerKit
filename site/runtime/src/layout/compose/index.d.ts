// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * The colour of `hue`'s family that reads on `ground`: same hue and saturation, lightness moved just far
 * enough to reach the WCAG ratio for this text size (4.5:1, or 3:1 for large text). Returns a hex colour.
 * If the hue itself already passes it is returned unchanged.
 */
export function inkFor(ground: any, hue: any, spec?: {}): string;
/** Greedy word wrap with the same estimate the audit uses (or a supplied measurer). Returns lines. */
export function wrapText(value: any, spec?: {}): readonly string[];
/**
 * Several lines of text as one group, one node per line (renderers draw one line per node).
 * `y` is the first line's middle; `lineHeight` is a multiple of `fontSize`. Returns {group, lines, width, height}.
 */
export function paragraph(scene: any, spec: any): Readonly<{
    group: any;
    lines: any;
    width: number;
    height: any;
}>;
/**
 * A card sized from its words. Padding is in ems of the largest text (default 0.9, above the audit's 0.6
 * minimum) and equal on opposite sides, so it is never cramped or lopsided. `x, y` is the card's centre.
 * `lines` is [{text, fontSize, fontWeight, fill}] top to bottom. Returns {group, card, box}.
 */
export function panel(scene: any, spec: any): Readonly<{
    group: any;
    card: any;
    box: Readonly<{
        x: number;
        y: number;
        width: number;
        height: any;
    }>;
}>;
/** Point and unit tangent at arc-length fraction `u` (0–1) along absolute path commands (curves sampled). */
export function pathPoint(commands: any, u?: number): Readonly<{
    x: number;
    y: number;
    tx: number;
    ty: number;
}>;
/**
 * Keep `label` next to `target` at every frame. `side`: right, left, above, below, center, or end (the
 * drawn end of a path, following its trim). `gap` is the clear space in scene units. The label's own
 * alignment is set to suit the side. Returns the label.
 */
export function attach(label: any, target: any, spec?: {}): any;
/**
 * Find a position for a box of `width × height` near `near` that stays clear of what is drawn during
 * [from, to]. Obstacles are the scene's marks, except those tagged with `ignore` (default decor and
 * background) and grounds covering more than half the stage. Candidates spiral out from `near`, trying
 * the preferred side first. Returns {x, y, box, clear, overlap}; x, y is the box centre. `clear: false`
 * means no clear spot was found within `radius`; the least obstructed one is returned.
 */
export function place(scene: any, spec: any): Readonly<{
    x: any;
    y: any;
    box: Readonly<{
        x: number;
        y: number;
        width: any;
        height: any;
    }>;
    clear: boolean;
    overlap: any;
}>;
/** A target-local anchor, scene-space ring and measured moving panel with an edge-to-edge leader.
 * @param {any} scene
 * @param {{target:any,anchor?:number[],ring?:number,panel?:{width?:number,height?:number,side?:string,content?:any,fill?:string},route?:string,at?:number,style?:string,label?:{text:string,font:any,size?:number,at?:number[],offset?:number[],fill?:any,gap?:number},timing?:{ring?:number,line?:number,panel?:number,word?:number},gap?:number,stroke?:string,strokeWidth?:number}} spec
 */
export function callout(scene: any, spec: {
    target: any;
    anchor?: number[];
    ring?: number;
    panel?: {
        width?: number;
        height?: number;
        side?: string;
        content?: any;
        fill?: string;
    };
    route?: string;
    at?: number;
    style?: string;
    label?: {
        text: string;
        font: any;
        size?: number;
        at?: number[];
        offset?: number[];
        fill?: any;
        gap?: number;
    };
    timing?: {
        ring?: number;
        line?: number;
        panel?: number;
        word?: number;
    };
    gap?: number;
    stroke?: string;
    strokeWidth?: number;
}): any;
/** Place a speech panel in clear space over a sampled interval, with a moving angled tail.
 * @param {import('../../characters/runtime.js').CharacterHandle} actor
 * @param {string} value
 * @param {{from?:number,to?:number,fontSize?:number,width?:number,padding?:number,fill?:string,ink?:string,prefer?:string,region?:{x:number,y:number,width:number,height:number},margin?:number,radius?:number,measure?:(text:string,size:number,weight:number)=>number}} [spec]
 */
export function bubble(actor: import("../../characters/runtime.js").CharacterHandle, value: string, spec?: {
    from?: number;
    to?: number;
    fontSize?: number;
    width?: number;
    padding?: number;
    fill?: string;
    ink?: string;
    prefer?: string;
    region?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    margin?: number;
    radius?: number;
    measure?: (text: string, size: number, weight: number) => number;
}): Readonly<{
    tail: any;
    placement: Readonly<{
        x: any;
        y: any;
        box: Readonly<{
            x: number;
            y: number;
            width: any;
            height: any;
        }>;
        clear: boolean;
        overlap: any;
    }>;
    group: any;
    card: any;
    box: Readonly<{
        x: number;
        y: number;
        width: number;
        height: any;
    }>;
}>;
export { stage } from "./staging.js";
export { effectBatch } from "./effect-batch.js";
