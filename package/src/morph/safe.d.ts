// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Reject invalid emitted polygons; does not certify every instant between samples. */
export function createSafeMorph(from: any, to: any, spec?: {}): Readonly<{
    diagnostics: Readonly<{
        safety: "perSamplePolygon";
        continuousTopologyGuaranteed: false;
        closed: any;
        samples: any;
        offset: any;
        reversed: any;
        landmarks: any;
        approximationBound: Readonly<{
            from: any;
            to: any;
        }>;
        topologyGuaranteed: false;
    }>;
    sample(time: any): any;
    inspect: (t: any) => Readonly<{
        closed: any;
        samples: any;
        offset: any;
        reversed: any;
        landmarks: any;
        approximationBound: Readonly<{
            from: any;
            to: any;
        }>;
        topologyGuaranteed: false;
        properCrossings: number;
        sampledArea: number | null;
    }>;
}>;
/** Fixed-command-topology keys, blended in rest space before optional skinning. */
export function createShapeKeys(input: any, targets: any): Readonly<{
    names: readonly string[];
    sample(weights?: {}): any;
}>;
