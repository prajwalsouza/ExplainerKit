// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Mount a film on the page.
 * - `chapters`: [{ name, scenes: [{ title: 'first | second', beats: [lines], build(s, b, film) }] }]
 * - `terms`: [[RegExp, colour]] tints caption words in the colour their kind has on stage
 * - `store`: viewer state that should survive from one scene to the next
 * - `notes`: provenance shown with the chapters
 * - `prebuild`: 1 (default) builds the next scene ahead, in idle time or a few seconds before its boundary, so
 *   crossing it only swaps layers; 0 builds on demand. A prebuilt scene is discarded and rebuilt if a top-level
 *   `store` value changed after it was built.
 * `build` receives the ExplainerKit scene `s`, its beat timeline `b`, and `film` for player-level services.
 */
export function film(definition: any): {
    seek: (t: any, options: any) => any;
    play(): any;
    pause(): any;
    readonly reducedMotion: any;
    speed: number;
    syncTime(syncTime: any, options: any): any;
    setDriver(driver: any): any;
    on: (name: any, fn: any) => () => any;
    reportError: (error: any) => void;
    refresh(): any;
    dispose: () => void;
    readonly time: number;
    readonly duration: number;
    readonly total: number;
    readonly playing: boolean;
    readonly disposed: boolean;
    readonly driver: any;
    readonly scene: any;
    readonly prebuilt: any;
    readonly frame: any;
    readonly view: any;
    readonly plan: any;
    scenes: {
        start: any;
        duration: any;
        title: any;
    }[];
};
/**
 * One ground, one ink, one accent; kinds of thing take one colour each, on stage and in captions.
 * The bright kind colours are for marks. Words in a kind's colour use its `…Ink` variant, the same hue
 * darkened to at least 4.5:1 on paper, card and the warm grounds (WCAG 2.2 text contrast). `ink3` is
 * for rules and decoration only: at 2.6:1 it is too faint for text.
 */
export const palette: Readonly<{
    paper: "#fbfaf7";
    ink: "#17181c";
    ink2: "#5d5f66";
    ink3: "#9a9ca3";
    line: "#e7e4dc";
    card: "#ffffff";
    accent: "#ff5b2e";
    blue: "#3b6fd4";
    green: "#2f9a6f";
    violet: "#7b61c9";
    accentInk: "#c93c14";
    blueInk: "#2f5fbf";
    greenInk: "#1f7a55";
    violetInk: "#6247b0";
}>;
