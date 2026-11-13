// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** @typedef {import('./projection.js').ProjectionPlayer} ProjectionPlayer */
/** @typedef {import('./projection.js').ProjectionOptions} ProjectionOptions */
/** Browser ownership lives here, never in scene/model evaluation. No auto-start. */
export function mount(input: any, container: any, spec?: {}): Promise<{
    readonly time: number;
    readonly duration: any;
    readonly disposed: boolean;
    readonly reducedMotion: any;
    speed: number;
    readonly ambientTime: number;
    readonly ambientPaused: boolean;
    /** Pause only ambient motion; authored playback and manual interactions remain available.
     * @param {boolean} paused
     */
    setAmbientPaused(paused: boolean): /*elided*/ any;
    readonly cost: any;
    seekAmbient(seconds: any): /*elided*/ any;
    profile(): any;
    _acquireAmbient(): () => void;
    /** @param {import('../core/scene.js').Scene} child @param {Parameters<typeof attachSceneLayer>[2]} layerOptions */
    layer(child: import("../core/scene.js").Scene, layerOptions: Parameters<typeof attachSceneLayer>[2]): Readonly<{
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
}>;
export { attachSceneLayer } from "./layers.js";
export { createProjectionPlayer } from "./projection.js";
export { createTimelinePlayer } from "./timeline.js";
export type ProjectionPlayer = import("./projection.js").ProjectionPlayer;
export type ProjectionOptions = import("./projection.js").ProjectionOptions;
export type TimelinePlayerOptions = import("./timeline.js").TimelinePlayerOptions;
export type TimelinePlayer = import("./timeline.js").TimelinePlayer;
export type TimelinePlayerContext = import("./timeline.js").TimelinePlayerContext;
import { attachSceneLayer } from './layers.js';
