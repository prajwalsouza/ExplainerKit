// @recipe gears
// @title Turn meshing gears and a crank from one angle
// @task Build a mechanism of meshing gears and a crank linkage, sample it from a driving angle and draw it.
// @uses explainerkit/core, explainerkit/mechanisms
// @keywords gears, mechanism, crank, linkage, rod, machine, engine, rotation, rolling wheel
// @guide docs/modules/particles-mechanisms.md
import {scene} from 'explainerkit/core';
import {mechanism} from 'explainerkit/mechanisms';

const engine = mechanism();
const driver = engine.gear({id: 'driver', teeth: 20, module: 4});
engine.gear({id: 'driven', x: 100, teeth: 30, module: 4}).meshWith(driver);

const drawing = scene({width: 640, height: 360, duration: 6, label: 'A small gear drives a larger one'});
const angle = drawing.parameter(0, {min: 0, max: 4 * Math.PI});
angle.animate({from: 0, to: 4 * Math.PI, duration: 6, ease: 'linear'});
const state = drawing.derive([angle], (a) => engine.sample(a));

const spokes = (group, r) => { for (let k = 0; k < 6; k++) group.line({x1: 0, y1: 0, x2: r * Math.cos(k * Math.PI / 3), y2: r * Math.sin(k * Math.PI / 3), stroke: '#262d2b', strokeWidth: 3}); };
const small = drawing.group({x: 240, y: 180});
small.circle({r: 40, fill: '#d9a441'});
spokes(small, 40);
small.bind('rotation', {inputs: [state], map: (s) => s.driver.rotation});
const large = drawing.group({x: 340, y: 180});
large.circle({r: 60, fill: '#34766b'});
spokes(large, 60);
large.bind('rotation', {inputs: [state], map: (s) => s.driven.rotation});

export const player = await drawing.mount(document.querySelector('#stage'));
player.play();
