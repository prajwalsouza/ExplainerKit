// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** A named set of topic colours, so one idea keeps one accent across a page. */
export function topics(map: any): Readonly<{
    names: readonly string[];
    colors: {};
    color(name: any): any;
    has: (name: any) => boolean;
}>;
/**
 * Create an emphasis track. Call on(target, {...}) for each moment of emphasis and off({...})
 * to let the context return. Targets are names; adapters map names to elements or handles.
 */
export function emphasis(spec?: {}): Readonly<{
    readonly events: readonly any[];
    recede: any;
    palette: any;
    /** Emphasise one target or several at `at` seconds. The previous emphasis hands over directly. */
    on(target: any, s?: {}): /*elided*/ any;
    /** End emphasis at `at`: the target settles and the context returns. */
    off(s?: {}): /*elided*/ any;
    /**
     * The emphasis state at `time`: how strongly each target is emphasised (0 to 1), how far the
     * context has receded, and the recede settings in force.
     */
    state(time: any): Readonly<{
        time: any;
        targets: Readonly<{}>;
        topics: Readonly<{}>;
        scales: Readonly<{}>;
        lifts: Readonly<{}>;
        context: number;
        recede: any;
    }>;
    /** Paint for a target at `time`, mixing its own colour toward its topic accent. */
    targetStyle(name: any, time: any, base?: {}): Readonly<{
        amount: any;
        topic: any;
        color: any;
        scale: number;
        lift: number;
    }>;
    /** How a context item looks at `time`: opacity multiplier, desaturation and blur. */
    contextStyle(time: any, base?: {}): Readonly<{
        amount: number;
        opacity: number;
        desaturate: number;
        blur: number;
        color: string | null;
    }>;
    /**
     * Check that receded context text stays readable. Compares the context text colour,
     * composited at the most receded opacity over the background, against the floor.
     */
    audit(): Readonly<{
        ok: boolean;
        findings: readonly Readonly<{
            code: "RECEDE_TOO_FAINT";
            opacity: any;
            ratio: number;
            floor: any;
            message: `Context text at opacity ${any} has contrast ${string}:1, below ${any}:1. Recede less.`;
        }>[];
    }>;
}>;
/**
 * Find words in token elements (for example kineticText tokens) and group them by target name,
 * so emphasis survives text splitting. `terms` maps a target name to a word or phrase.
 */
export function tagTokens(tokens: any, terms: any): Readonly<{}>;
/**
 * Apply an emphasis track to existing DOM elements. `targets` maps names to elements; every
 * element in `context` recedes. `ink` is the normal text colour that targets mix from.
 * Call update(time) yourself or pass a player whose frame events supply time.
 */
export function emphasizeDOM(track: any, spec?: {}): Readonly<{
    update: (time: any) => void;
    dispose: () => void;
    readonly disposed: boolean;
}>;
/**
 * Bind an emphasis track to scene handles through ordinary bindings, so the scene's own
 * sampling, seeking and export see it. Each target entry is {handle, fill}; each context
 * entry is {handle, fill?, opacity?}. release() unbinds every property it bound.
 */
export function emphasizeScene(track: any, spec?: {}): Readonly<{
    release(): void;
}>;
