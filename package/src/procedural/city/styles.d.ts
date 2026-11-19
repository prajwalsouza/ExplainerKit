// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** The style whose rough region contains a place, or 'central' when none does. */
export function regionStyle(lat: any, lon: any): string | number;
/**
 * The built-in styles. `trees` weighs the forms round, oval, spreading, columnar, birch and
 * conifer. `cars` weighs hatch, sedan, estate, suv and van. `lamps` names the lamp for a lane,
 * an ordinary street, an avenue and a park. Chances run from 0 to 1; `bikes`, `cafes` and
 * `people` scale how many are placed (1 is typical).
 */
export const CITY_STYLES: any;
export const cityStyles: readonly string[];
