// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Write a character as an artist-editable SVG in its rest pose. Structure (all coordinates in character
 * space, ground at y = 0, no transforms, so editors that flatten transforms keep it intact):
 *   <g id="palette">  one swatch per slot tone: slot-<name>-base | -shade | -light
 *   <g id="pivots">   one circle per bone: pivot-<bone>; move it to move the joint
 *   <g id="registration"> mark-origin at (0, 0) and mark-unit at (0, -100); leave these where they are
 *   <g id="parts">    one group per part in draw order: <g id="<part>"> with <path id="<part>-art">;
 *                     extra paths drawn inside a static part's group are kept as decoration on its bone.
 * Procedural parts (faces, limbs, waves) are written for reference and marked data-procedural.
 */
export function exportCharacterSVG(definition: any, spec?: {}): string;
/**
 * Load an artist-edited character SVG back onto its rig. Moved pivot circles move joints, recolored swatches
 * recolor the palette, edited <part>-art paths replace static artwork, and extra paths drawn inside a part's
 * group become decoration that follows that part's bone. Procedural parts keep their code but take the
 * edited colors. Returns a new definition for character().
 */
export function characterFromSVG(definition: any, source: any, spec?: {}): any;
