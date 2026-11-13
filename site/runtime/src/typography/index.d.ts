// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Split visual text without recreating original child nodes or hiding its semantic copy. */
export function kineticText(element: any, spec?: {}): Readonly<{
    text: any;
    method: string;
    tokens: readonly any[];
    sample: (time: any, localSpec2?: {}) => Readonly<{
        time: any;
        progress: readonly number[];
        end: any;
    }>;
    bind: (scene: any, localSpec5?: {}) => Readonly<{
        end: any;
        update: (time: any) => void;
        dispose(): void;
        readonly disposed: boolean;
    }>;
    dispose: () => void;
    readonly disposed: boolean;
}>;
export { glyphs } from "./glyphs.js";
export { segmentText, textStagger } from "./segment.js";
