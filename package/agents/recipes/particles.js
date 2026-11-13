// @recipe particles
// @title Emit seeded particles that can be seeked
// @task Create a deterministic particle emitter and draw its particles at the scene time as a point cloud.
// @uses explainerkit/core, explainerkit/particles
// @keywords particles, sparks, emitter, smoke, fire, cloud, points, seeded
// @guide docs/modules/particles-mechanisms.md
import {scene} from 'explainerkit/core';
import {emitter} from 'explainerkit/particles';

const sparks = emitter({seed: 3, rate: 300, life: 1.6, origin: {x: 320, y: 300}, velocity: {y: -120}, spread: {x: 60, y: 20, z: 0}, acceleration: {y: 40}});
const drawing = scene({width: 640, height: 360, duration: 4, label: 'Sparks rise from a point'});
const t = drawing.parameter(0, {min: 0, max: 4});
t.animate({from: 0, to: 4, duration: 4, ease: 'linear'});
const points = drawing.derive([t], (time) => sparks.cloud(time, {radius: (p) => 6 * (1 - p.progress) + 1, color: (p) => [1, 0.6, 0.2, 1 - p.progress]}));
drawing.rect({x: 0, y: 0, width: 640, height: 360, fill: '#1c2023'});
drawing.cloud({pointShape: 'glow', pointBlend: 'add'}).bind('points', {inputs: [points], map: (v) => v});

export const player = await drawing.mount(document.querySelector('#stage'), {renderer: 'canvas'});
player.play();
