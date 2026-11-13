// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * One browser timeline for scene players and films. A sample must succeed before
 * its time is committed. Rendering, models and narration remain caller concerns.
 */
export function createClock({ host, duration, sample, reducedMotion, advance, needsFrame, maxDelta, }: {
    host: any;
    duration: any;
    sample: any;
    reducedMotion: any;
    advance?: ((next: any) => any) | undefined;
    needsFrame?: (() => boolean) | undefined;
    maxDelta?: number | undefined;
}): {
    readonly time: number;
    readonly duration: any;
    readonly playing: boolean;
    readonly disposed: boolean;
    readonly driver: any;
    readonly reducedMotion: any;
    speed: number;
    on(name: any, listener: any): () => any;
    reportError(error: any): void;
    emit(name: any, value: any): void;
    setDriver(next: any): /*elided*/ any;
    seek(seconds: any, { reset, source }?: {
        reset?: boolean | undefined;
        source?: string | undefined;
    }): /*elided*/ any;
    sync(seconds: any, { source, playing: active }?: {
        source?: string | undefined;
        playing?: boolean | undefined;
    }): /*elided*/ any;
    play(): /*elided*/ any;
    pause(reason?: undefined): /*elided*/ any;
    refresh(): any;
    invalidate(): void;
    dispose(): void;
};
