// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function rendererError(message: any, code?: string): Error;
export function assertContainer(container: any): void;
export function validateFrame(frame: any): Set<any>;
/** Capture descriptor defaults before a backend can mutate its last valid output. */
export function prepareFrame(frame: any): {
    ids: Set<any>;
    frame: any;
};
export function pathData(commands: any): any;
/** Backend capability negotiation before any DOM or raster mutation. */
export function prepare2D(frame: any): Map<any, any>;
export function transformString(p: any, node: any): string;
export function textContent(frame: any): string;
export const MAX_NODES: 10000;
export const MAX_DEPTH: 64;
export const MAX_RASTER_PIXELS: 8294400;
export const MAX_SCRATCH_PIXELS: 16000000;
export const MAX_FRAME_POINTS: 1000000;
