// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Linear blend skinning of absolute path points/control points, in skeleton space. */
export function bindSkin(model: any, spec?: {}): Readonly<{
    rest: any;
    weights: any;
    diagnostics: Readonly<{
        method: "linearBlend";
        points: any;
        maxInfluences: 4;
        preservesRigidity: false;
    }>;
    sample(pose: any, sampleSpec?: {}): any;
}>;
