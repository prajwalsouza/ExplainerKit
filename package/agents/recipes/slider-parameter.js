// @recipe slider-parameter
// @title Let the reader drag a value that drives the drawing
// @task Add a parameter with a slider control and bind shape properties to it so the picture updates live.
// @uses explainerkit/core
// @keywords interactive, slider, control, parameter, bind, derive, reader input, explorable
// @guide docs/runtime-api.md
import {scene} from 'explainerkit/core';

const drawing = scene({width: 640, height: 300, label: 'A circle whose size follows a slider'});
const radius = drawing.parameter(40, {min: 10, max: 120});
const area = drawing.derive([radius], (r) => Math.PI * r * r);

drawing.circle({x: 220, y: 150, fill: '#a74a2d'}).bind('r', {inputs: [radius], map: (r) => r});
drawing.text({x: 400, y: 150, fontSize: 22, fill: '#262d2b'})
  .bind('text', {inputs: [area], map: (a) => `area ≈ ${Math.round(a)}`});

// A labelled slider appears with the mounted scene.
drawing.control(radius, {label: 'Radius', step: 1});
export const player = await drawing.mount(document.querySelector('#stage'));
