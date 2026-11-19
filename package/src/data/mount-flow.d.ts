// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Mount a Mermaid flowchart drawn as silk light, with a replay of the steps that pass through it: each step's
 * message travels its edge, the receiving node lights up, and a readout shows the step's input and output.
 * @param {HTMLElement} container
 * @param {string} source Mermaid flowchart text (flowchart TD …)
 * @param {{theme?: 'silk'|'pearl'|'signal'|'midnight'|'paper', label?: string, motion?: boolean,
 *          steps?: ReadonlyArray<{from?: string, to?: string, node?: string, label?: string, input?: string,
 *                                 output?: string}>, stepDuration?: number}} [spec]
 */
export function mountFlowChart(container: HTMLElement, source: string, spec?: {
    theme?: "silk" | "pearl" | "signal" | "midnight" | "paper";
    label?: string;
    motion?: boolean;
    steps?: ReadonlyArray<{
        from?: string;
        to?: string;
        node?: string;
        label?: string;
        input?: string;
        output?: string;
    }>;
    stepDuration?: number;
}): Promise<Readonly<{
    player: {
        readonly time: number;
        readonly duration: any;
        readonly disposed: boolean;
        readonly reducedMotion: any;
        speed: number;
        readonly ambientTime: number;
        readonly ambientPaused: boolean;
        setAmbientPaused(paused: boolean): /*elided*/ any;
        readonly cost: any;
        seekAmbient(seconds: any): /*elided*/ any;
        profile(): any;
        _acquireAmbient(): () => void;
        layer(child: import("../index.js").Scene, layerOptions: Parameters<typeof import("../player.js").attachSceneLayer>[2]): Readonly<{
            readonly disposed: boolean;
            refresh: () => void;
            dispose: () => void;
        }>;
        nativeLayer(handle: any, keyframes: any, nativeOptions?: {}): Readonly<{
            effect: Readonly<{
                play(): /*elided*/ any;
                pause(): /*elided*/ any;
                seek(next: any): /*elided*/ any;
                finish(): /*elided*/ any;
                dispose: () => void;
                readonly disposed: boolean;
                readonly time: any;
                readonly duration: any;
                readonly end: any;
                readonly reducedMotion: any;
                readonly error: any;
                readonly playState: any;
            }>;
            readonly disposed: boolean;
            dispose: () => void;
        }>;
        syncTime(time: any, syncOptions: any): /*elided*/ any;
        readonly playing: boolean;
        readonly driver: any;
        readonly frame: any;
        readonly view: any;
        element: any;
        on: (name: any, fn: any) => () => any;
        setDriver(next: any): /*elided*/ any;
        seek(seconds: any, seekOptions?: {}): /*elided*/ any;
        play(): /*elided*/ any;
        pause(): /*elided*/ any;
        refresh(): any;
        reportError: (error: any) => void;
        dispose: () => void;
    };
    readonly theme: "paper" | "silk" | "pearl" | "midnight" | "signal";
    readonly step: number;
    layout: {
        direction: string;
        horizontal: boolean;
        scale: number;
        nodes: {
            rank: any;
            x: number;
            y: number;
            w: number;
            h: number;
            lines: number;
            id: string;
            label: string;
            shape: string;
            group: string | null;
        }[];
        edges: {
            back: boolean;
            points: any[][];
            from: string;
            to: string;
            label: string;
            style: string;
            arrow: boolean;
        }[];
        groups: {
            id: string;
            title: string;
            x: number;
            y: number;
            w: number;
            h: number;
        }[];
    };
    /** @param {'silk'|'pearl'|'signal'|'midnight'|'paper'} name */
    setTheme(name: "silk" | "pearl" | "signal" | "midnight" | "paper"): void;
    /** Show the start of one step, paused there. @param {number} index */
    setStep(index: number): void;
    play(): void;
    pause(): void;
    dispose(): void;
}>>;
