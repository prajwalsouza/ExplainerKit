// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function sceneLight(spec?: {}): Readonly<{
    angle: any;
    color: any;
    ambient: any;
}>;
/** Inner alpha differences are stylized flat artwork, not physical illumination. */
export function validateShade(value: any): Readonly<{
    rim: Readonly<{
        color: any;
        width: any;
        amount: any;
    }>;
    highlight: Readonly<{
        color: any;
        amount: any;
        x: any;
        y: any;
        r: any;
    }>;
}> | null;
export function shadePasses(shade: any, light: any, localAngle: any): {
    role: string;
    color: any;
    amount: any;
    dx: number;
    dy: number;
    blur: number;
}[];
