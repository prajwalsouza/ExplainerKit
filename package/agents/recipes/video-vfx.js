// @recipe video-vfx
// @title Place an annotation on a tracked surface
// @task Sample a saved planar track and pin an ExplainerKit annotation to the surface.
// @uses explainerkit/core, explainerkit/vfx
// @keywords video, vfx, planar tracking, matchmove, corner pin, footage, annotation, camera stabilization
// @guide docs/modules/video-vfx.md
// @times 0, 1, 2
// For a 3D insert, prepare the fitted poses with compileCameraTrack before projection.
// Camera track compilation repairs isolated pose spikes by default.
import {scene} from 'explainerkit/core';
import {compileTrack, projectSurface, sampleTrack} from 'explainerkit/vfx';

const drawing = scene({width: 640, height: 360, duration: 2, label: 'Follow a recorded surface'});
const track = compileTrack({kind: 'plane', samples: [
  {time: 0, value: [{x: 85, y: 92}, {x: 410, y: 88}, {x: 405, y: 255}, {x: 72, y: 252}]},
  {time: 2, value: [{x: 211, y: 105}, {x: 553, y: 74}, {x: 565, y: 230}, {x: 213, y: 263}]},
]});
const initial = projectSurface(sampleTrack(track, 0), 0.65, 0.5);
drawing.rect({x: 0, y: 0, width: 640, height: 360, fill: '#182321'});
const marker = drawing.circle({x: initial.x, y: initial.y, r: 11, fill: '#76e4ba'});
const label = drawing.text({x: initial.x + 20, y: initial.y, text: 'Signal path', fill: '#eff8f4', fontSize: 24});
const player = await drawing.mount(document.querySelector('#stage'), {controls: false});

// Call this with the presented clip time when composing over a video.
export function seek(seconds) {
  const surface = sampleTrack(track, seconds);
  if (!surface) return;
  const anchor = projectSurface(surface, 0.65, 0.5);
  marker.set({x: anchor.x, y: anchor.y});
  label.set({x: anchor.x + 20, y: anchor.y});
  player.seek(seconds);
}
