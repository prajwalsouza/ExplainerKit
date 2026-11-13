// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Media is the time authority. No integration or accumulated drift correction.
 * @param {any} player
 * @param {HTMLMediaElement|any} media
 * @param {{offset?:number,onError?:(error:any)=>void,reducedMotion?:'respect'|'audio-only'}} [spec]
 */
export function attachMedia(player: any, media: HTMLMediaElement | any, spec?: {
    offset?: number;
    onError?: (error: any) => void;
    reducedMotion?: "respect" | "audio-only";
}): Readonly<{
    readonly disposed: boolean;
    readonly media: any;
    play: () => Promise<void>;
    pause(): void;
    seek(time: any): void;
    refresh: () => void;
    dispose: (release?: boolean) => void;
}>;
