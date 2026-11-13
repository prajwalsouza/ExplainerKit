import { mountDepthDemo } from './video-vfx-rgbd.js';
import { prepareCone } from './video-vfx-inserts.js';

export default function crossing(stage) {
  return mountDepthDemo(stage, {
    source: 'video-vfx-crossing',
    shotLabel: 'A pedestrian crosses in front of a virtual cone in an office aisle',
    footageLabel: 'Aisle footage',
    objectLabel: 'Cone',
    surface: 'floor',
    prepare: prepareCone,
    cue: { label: 'Jump to crossing', frame: 20 },
  });
}
