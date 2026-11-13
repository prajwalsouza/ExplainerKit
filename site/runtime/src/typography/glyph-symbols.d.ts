// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function strokeParts(char: any, length: any, size: any): {
    cx: number;
    cy: number;
    length: any;
    thickness: number;
    angle: number;
}[];
export function blendParts(from: any, to: any, k: any): any;
export function barCommands(p: any): any;
export function barParameters(commands: any): {
    cx: number;
    cy: number;
    length: number;
    thickness: number;
    angle: number;
};
export function isStrokeSymbol(char: any): boolean;
export function partsCommands(parts: any): any;
