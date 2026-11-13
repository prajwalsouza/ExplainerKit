// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Pure palette grade: preserve geometry/identity/alpha, change supported paint and point colors.
 * Order: exposure (stops), contrast around mid-gray, saturation, tint mix, then an optional duotone map
 * from shadows to highlights by luminance. Every numeric control can be animated through scene.grade().
 */
export function gradeFrame(frame: any, spec?: {}): Readonly<{
    motionBlur?: Readonly<{
        frames: any;
        weights: any;
    }> | undefined;
    light?: Readonly<{
        angle: any;
        color: any;
        ambient: any;
    }> | undefined;
    width: any;
    height: any;
    children: any;
}>;
/**
 * Front-view shadow on a wall behind a figure, as in shadows thrown by a campfire. The light sits at depth
 * light.z in front of the figure (depth), the wall is farther back (wall). Each point moves along its ray
 * from the light, so the silhouette grows by (wall - light.z)/(depth - light.z) about the light. The
 * mapping is affine, so curves stay exact. scale is returned for choosing a softness blur.
 */
export function shadowOnWall(commands: any, spec?: {}): Readonly<{
    commands: any;
    scale: number;
}>;
/** Project supplied 3D vertices from a point light onto a horizontal plane. No occlusion inference. */
export function shadowOnPlane(points: any, spec?: {}): any;
export { filmGrain } from "./grain.js";
export { glow, alphaMask } from "../graphics/look.js";
