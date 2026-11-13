import { mountDepthDemo } from './video-vfx-rgbd.js';
import { prepareDisplay } from './video-vfx-inserts.js';

// An inset on the desk's receiving plane, measured in the shot's world coordinates.
const deskOutline = [
  { x: -0.88171, y: 0, z: -0.49829 },
  { x: 1.00922, y: 0, z: -0.26483 },
  { x: 0.96768, y: 0, z: 0.16296 },
  { x: -0.63678, y: 0, z: 0.03528 },
];

export default function tabletop(stage) {
  return mountDepthDemo(stage, {
    source: 'video-vfx-tabletop',
    shotLabel: 'A virtual display stands on a desk as a person walks past it',
    footageLabel: 'Desk footage',
    objectLabel: 'Display',
    surface: 'tabletop',
    prepare: prepareDisplay,
    guideOutline: deskOutline,
    cue: { label: 'Jump to crossing', frame: 66 },
  });
}
