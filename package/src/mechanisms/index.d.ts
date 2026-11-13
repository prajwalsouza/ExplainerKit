// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Closed involute gear outline, one tooth centred on +x before rotation. Pitch radius is teeth×module/2,
 * addendum one module, dedendum 1.25 modules. Teeth below 17 are drawn without undercut correction.
 */
export function gearPath(spec?: {}): readonly (readonly any[])[];
/** Phase for meshWith so a driven gear's gap faces the driver's tooth along the line between centres. */
export function meshPhase(driver: any, driven: any): number;
/** Slider point constrained to a line, at exact rod distance from the crank tip. */
export function sliderCrank(spec?: {}): any;
/** Exact external/internal common tangents of two pulley pitch circles. */
export function beltGeometry(spec?: {}): any;
/** A bounded DAG of solved 2D relations, driven by one scalar input. */
export function mechanism(spec?: {}): any;
