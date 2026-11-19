// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Named easings used by the source-document motion pack. `outBack(1.2)` sets the overshoot. */
export function sourceEase(name?: string): any;
/**
 * Flow text into a document template's slots (the `layout.slots` of a source-document pack).
 * `content` maps slot names to text. Returns measured lines with each word's box, in
 * millimetres from the surface's top-left corner, plus any text that did not fit.
 */
export function layoutDocument(template: any, content: any, spec?: {}): Readonly<{
    lines: readonly Readonly<{
        slot: string;
        column: number;
        index: number;
        text: string;
        x: any;
        y: any;
        width: number;
        height: any;
        baseline: any;
        size: any;
        words: readonly Readonly<{
            text: any;
            x: any;
            width: any;
        }>[];
    }>[];
    overflow: Readonly<{}>;
}>;
/**
 * Find a phrase in a layout. Returns one rectangle per line the phrase covers (a phrase split
 * across a line break gives two), or an empty list. `occurrence` picks a later match.
 */
export function findPhrase(layout: any, phrase: any, spec?: {}): readonly Readonly<{
    x: number;
    y: number;
    width: number;
    height: any;
    slot: any;
    column: any;
}>[];
/**
 * Map millimetres on a printable surface to 3D. `positions` holds (cols + 1) x (rows + 1)
 * vertices as x, y, z triples in metres, with vertex (i, j) at index j * (cols + 1) + i, as
 * the source-document packs store them. Normals are computed from the grid when not given.
 */
export function surfaceMapper(spec?: {}): Readonly<{
    /** The 3D point and unit normal under page position (xMm, yMm). */
    at(xMm: any, yMm: any): Readonly<{
        x: number;
        y: number;
        z: number;
        normal: Readonly<{
            x: number;
            y: number;
            z: number;
        }>;
    }>;
}>;
/**
 * A highlight drawn over phrase rectangles: a marker stroke, underline, circle or glow from the
 * motion pack. at(time) returns each rectangle with its drawn fraction, line by line.
 */
export function highlightSchedule(rects: any, style: any, spec?: {}): Readonly<{
    end: number;
    at(time: any): any;
}>;
/**
 * The lift of a phrase off the page: unstick, rise, travel and settle, as specified by the
 * motion pack's `lift` block. `from` and `to` are 3D points in metres with +y up; `index`
 * staggers several phrases lifting together. pose(time) is a pure function of time.
 */
export function liftSchedule(lift: any, spec?: {}): Readonly<{
    start: any;
    phases: Readonly<{
        unstick: any;
        rise: any;
        travel: any;
        settle: any;
        done: any;
    }>;
    pose(time: any): Readonly<{
        phase: "rise" | "rest" | "travel" | "done" | "unstick" | "settle";
        position: Readonly<{
            x: any;
            y: any;
            z: any;
        }>;
        rise: number;
        scale: number;
        faceCamera: number;
        curl: number;
        shadow: any;
        imprint: number;
        motionBlur: boolean;
        flutterDeg: number;
        page: Readonly<{
            dim: number;
            desaturate: number;
        }>;
    }>;
}>;
