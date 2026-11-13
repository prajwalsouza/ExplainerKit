// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Parse SFNT/glyf TrueType outlines directly. No font engine or hint execution. */
export function parseFont(input: any): Readonly<{
    unitsPerEm: number;
    glyphCount: number;
    axes: any;
    format: string;
    variable: boolean;
    kerning: boolean;
    glyph: (index: any, values: any) => any;
}>;
/** Load explicit bytes or a user-selected File/Blob (TTF or WOFF); no implicit font/network access. */
export function loadFont(input: any): Promise<Readonly<{
    unitsPerEm: number;
    glyphCount: number;
    axes: any;
    format: string;
    variable: boolean;
    kerning: boolean;
    glyph: (index: any, values: any) => any;
}>>;
/** Unicode-to-outline layout with pair kerning and variable-font instances. No shaping engine or hinting. */
export function textOutline(font: any, value: any, spec?: {}): Readonly<{
    commands: any;
    advance: any;
    glyphs: readonly Readonly<{
        codePoint: any;
        index: any;
        x: any;
        advance: number;
    }>[];
    diagnostics: Readonly<{
        shaping: false;
        hinting: false;
        kerning: any;
        kernedPairs: number;
        variableAxes: boolean;
        format: any;
    }>;
}>;
