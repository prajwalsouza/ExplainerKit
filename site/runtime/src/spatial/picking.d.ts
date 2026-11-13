// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function rayPlane(input: any, spec?: {}): Readonly<{
    distance: any;
    point: Readonly<{
        x: any;
        y: any;
        z: any;
    }>;
    normal: any;
}> | null;
export function raySphere(input: any, spec?: {}): Readonly<{
    normal: Readonly<{
        x: number;
        y: number;
        z: number;
    }> | null;
    distance: any;
    point: Readonly<{
        x: any;
        y: any;
        z: any;
    }>;
}> | null;
/** Exact ray against a transformed local box, including nested nonuniform scale. */
export function rayBox(input: any, spec?: {}): Readonly<{
    distance: any;
    point: Readonly<{
        x: any;
        y: any;
        z: any;
    }>;
    normal: any;
}> | null;
/** Nearest declared bound, not a claim of exact arbitrary-mesh picking. */
export function pickBounds(input: any, items: any): Readonly<{
    distance: any;
    point: Readonly<{
        x: any;
        y: any;
        z: any;
    }>;
    normal: any;
    id: any;
}> | null;
