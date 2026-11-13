// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Describe a three.js scene for auditRender3D, by reading properties only. `input` is {scene, camera, renderer,
 * viewport, subject}. `viewport` is the drawing size in CSS
 * pixels ({width, height}); `subject` (optional) is the world point the audience looks at, by default the centre of
 * the objects that receive shadows.
 */
export function describeThreeScene(input: any): {
    subject?: any;
    camera: {
        kind: string;
        near: any;
        far: any;
        fov: any;
        height: number | null;
        position: any[];
        logarithmicDepth: boolean;
    };
    viewport: any;
    shadows: {
        enabled: boolean;
        type: any;
    };
    lights: any[];
    meshes: any[];
};
/**
 * Audit a 3D scene description (see describeThreeScene). Returns {status, findings, measures}; each finding has a
 * rule, a severity, the objects involved, a message saying what to change, and the measured value.
 */
export function auditRender3D(description: any, spec?: {}): {
    status: string;
    findings: {
        rule: string;
        severity: string;
        ids: any[];
        message: string;
        value: any;
    }[];
    measures: {
        subjectDistance: number;
        pixelWorld: number;
        lights: never[];
    };
};
/**
 * Find striped artefacts in a rendered image: tiles whose fine detail repeats regularly in one direction, as shadow
 * acne, moiré and aliased shadow edges do. `image` is {width, height, data} with 8-bit RGBA rows. A real striped
 * texture is flagged too; the finding says where to look, not what caused it. Returns {status, tiles, checked}.
 */
export function auditStripes(image: any, spec?: {}): {
    status: string;
    tiles: {
        x: number;
        y: number;
        width: any;
        height: any;
        score: number;
        period: any;
        direction: any;
        amplitude: number;
    }[];
    checked: number;
};
export const RENDER_3D: Readonly<{
    maxTexelPixels: 3;
    maxDepthRatio: 100000;
    depthBits: 24;
    coplanarDepthSteps: 4;
    flatness: 0.001;
    minNormalBiasTexels: 2;
    stripeScore: 0.4;
    stripeEnergy: 3;
    stripeTiles: 3;
}>;
