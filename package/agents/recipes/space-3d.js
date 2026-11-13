// @recipe space-3d
// @title Draw rotating 3D line art inside a 2D scene
// @task Add a perspective space to a scene and animate a wireframe sphere and box without Three.js.
// @uses explainerkit/core, explainerkit/spatial
// @keywords 3d, globe, sphere, wireframe, perspective camera, rotate, box, spatial, projection
// @guide docs/modules/spatial-three.md
import {scene} from 'explainerkit/core';
import {perspectiveCamera} from 'explainerkit/spatial';

const drawing = scene({width: 640, height: 400, duration: 6, label: 'A wireframe globe turns beside a box'});
const space = drawing.space({camera: perspectiveCamera({z: 600}, {width: 640, height: 400})});
const globe = space.sphereLines({radius: 110});
globe.set({x: -110});
globe.to(0, {rotationY: 2 * Math.PI}, {duration: 6, ease: 'linear'});
const box = space.box({width: 90, height: 90, depth: 90});
box.set({x: 150});
box.to(0, {rotationX: Math.PI, rotationY: Math.PI}, {duration: 6, ease: 'linear'});

export const player = await drawing.mount(document.querySelector('#stage'));
player.play();
