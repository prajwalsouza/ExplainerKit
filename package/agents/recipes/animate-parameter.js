// @recipe animate-parameter
// @title Animate a value over time and bind several properties to it
// @task Animate one parameter from a start to an end value and derive positions, colour and labels from it.
// @uses explainerkit/core, explainerkit/color
// @keywords parameter animate, derive, bind, colour mix, hsla, value over time
// @guide docs/runtime-api.md
import {scene} from 'explainerkit/core';
import {hsla, mix} from 'explainerkit/color';

const drawing = scene({width: 640, height: 300, duration: 4, label: 'A dot warms as it travels'});
const progress = drawing.parameter(0, {min: 0, max: 1});
progress.animate({from: 0, to: 1, duration: 3, ease: 'smooth'});

const cool = hsla(200, 60, 45), warm = hsla(15, 70, 50);
drawing.line({x1: 60, y1: 150, x2: 580, y2: 150, stroke: '#cfcabb', strokeWidth: 4});
drawing.circle({y: 150, r: 26})
  .bind(['x', 'fill'], {inputs: [progress], map: (p) => ({x: 60 + 520 * p, fill: mix(cool, warm, p)})});
drawing.text({x: 60, y: 230, fontSize: 20, fill: '#262d2b'})
  .bind('text', {inputs: [progress], map: (p) => `${Math.round(p * 100)} % of the way`});

export const player = await drawing.mount(document.querySelector('#stage'));
player.play();
