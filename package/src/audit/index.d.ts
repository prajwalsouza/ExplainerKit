// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Parse a hex or named color to [r, g, b, a] in 0–1; transparent and none give null. */
export function parseColor(value: any): any[] | null;
/** WCAG relative luminance of an sRGB color given as [r, g, b] in 0–1. */
export function relativeLuminance([r, g, b]: [any, any, any]): number;
/** WCAG contrast ratio between two opaque colors, 1–21. */
export function contrastRatio(a: any, b: any): number;
/**
 * Flatten a sampled frame into painted marks in frame space, in paint order. Each mark records its root
 * (top-level node), type, frame box, effective opacity and blur, fill and stroke, and for text its
 * string and on-frame font size; for strokes, the visible polylines.
 */
export function frameMarks(frame: any, { measure, cameraId }?: {
    measure?: ((text: any, fontSize: any, fontWeight?: number) => number) | undefined;
    cameraId?: null | undefined;
}): any[];
/**
 * Check one sampled frame. Returns findings ({rule, severity, ids, message, value}) and measures
 * ({texts, words, units, marks}). `displayWidth` is the CSS width the stage is shown at.
 */
export function auditFrame(frame: any, spec?: {}): {
    findings: any[];
    measures: {
        renderer?: {
            clampedFilters: any;
            isolatedLayers: any;
            source: string;
        } | undefined;
        texts: any;
        words: any;
        units: number;
        marks: any;
    };
};
/** Warn from actual last-frame renderer counters; missing counters remain unmeasured. */
export function auditRendererStats(input: any, spec?: {}): {
    findings: {
        rule: string;
        severity: string;
        ids: never[];
        message: string;
        value: any;
        evidence: string;
    }[];
    measures: {
        clampedFilters: any;
        isolatedLayers: any;
        source: string;
    };
};
/**
 * Sample a scene over [from, to] at `fps` and audit every frame. Findings that persist are merged into
 * spans; text dwell (time on screen against reading time) and onset bursts are judged across frames.
 * Returns {spans, frames, summary}. `sample(time)` overrides how a frame is taken.
 */
export function auditScene(scene: any, spec?: {}): {
    spans: any[];
    frames: any[];
    summary: {
        from: any;
        to: any;
        fps: any;
        frames: number;
        errors: number;
        warnings: number;
        byRule: {};
        peakUnits: number;
        peakWords: number;
        sampleMsP95: any;
        marksMax: number;
    };
};
export { auditMotion } from "./motion.js";
export { auditTextOverPixels } from "./pixels.js";
/** @typedef {import('./motion.js').MotionAuditOptions} MotionAuditOptions */
/** @typedef {import('./motion.js').MotionAuditReport} MotionAuditReport */
/** @typedef {import('./motion.js').MotionPoint} MotionPoint */
/** @typedef {import('./motion.js').MotionSampler} MotionSampler */
/** @typedef {import('./palette.js').PaletteAuditOptions} PaletteAuditOptions */
/** @typedef {import('./palette.js').PaletteAuditReport} PaletteAuditReport */
/** @typedef {import('./palette.js').PaletteCluster} PaletteCluster */
/** @typedef {import('./palette.js').PaletteGroup} PaletteGroup */
/** @typedef {import('./palette.js').PalettePolicy} PalettePolicy */
/** @typedef {import('./palette.js').PalettePixels} PalettePixels */
/** @typedef {import('./palette.js').PaletteComparison} PaletteComparison */
export const RULES: Readonly<{
    instanceOutside: 0.75;
    contrast: Readonly<{
        normal: 4.5;
        large: 3;
        largeSize: 24;
        largeBoldSize: 18.66;
    }>;
    minText: 12;
    settled: 0.6;
    textOverlap: 0.08;
    cover: 0.15;
    blur: 0.75;
    reading: Readonly<{
        lead: 0.5;
        wordsPerSecond: 3.3;
        minimum: 1;
    }>;
    clutter: Readonly<{
        units: 7;
        words: 24;
        onsetsPerSecond: 4;
    }>;
    busyGround: 3;
    card: Readonly<{
        padding: 0.6;
        balance: 0.45;
        boxes: 2;
        coverUp: 3;
    }>;
    orphan: 0.16;
    safeArea: 0.035;
    effects: Readonly<{
        nodes: 64;
        pixels: 64000000;
        width: 1920;
        height: 1080;
        warn: 0.75;
    }>;
    cost: Readonly<{
        sampleMs: 16;
        marks: 4000;
    }>;
}>;
export type MotionAuditOptions = import("./motion.js").MotionAuditOptions;
export type MotionAuditReport = import("./motion.js").MotionAuditReport;
export type MotionPoint = import("./motion.js").MotionPoint;
export type MotionSampler = import("./motion.js").MotionSampler;
export type PaletteAuditOptions = import("./palette.js").PaletteAuditOptions;
export type PaletteAuditReport = import("./palette.js").PaletteAuditReport;
export type PaletteCluster = import("./palette.js").PaletteCluster;
export type PaletteGroup = import("./palette.js").PaletteGroup;
export type PalettePolicy = import("./palette.js").PalettePolicy;
export type PalettePixels = import("./palette.js").PalettePixels;
export type PaletteComparison = import("./palette.js").PaletteComparison;
export { CONTINUITY, auditHandover, auditHandoverWindow, fitSimilarity, colorDistance } from "./continuity.js";
export { auditPalette, comparePalettes } from "./palette.js";
export { RENDER_3D, auditRender3D, auditStripes, describeThreeScene } from "./render3d.js";
