// @recipe scene-and-player
// @title Draw a scene, animate it and play it
// @task Create a scene with shapes, schedule a move with easing, mount it in the page and play it.
// @uses explainerkit/core
// @keywords first scene, animation, circle, rect, text, move, ease, to, mount, play, player, svg, start here
// @guide docs/getting-started.md
import {scene} from 'explainerkit/core';

const drawing = scene({width: 640, height: 360, duration: 3, label: 'A ball rolls to a box'});
drawing.rect({x: 470, y: 150, width: 120, height: 80, fill: '#e7e2d3', stroke: '#262d2b'});
const ball = drawing.circle({x: 80, y: 190, r: 28, fill: '#34766b'});
drawing.text({x: 40, y: 50, text: 'One scene, sampled at any time', fontSize: 22, fill: '#262d2b'});

// Move at time 0.5 for 1.5 seconds. Seeking to any time gives the same frame.
ball.to(0.5, {x: 530, y: 190}, {duration: 1.5, ease: 'easeInOut'});

export const player = await drawing.mount(document.querySelector('#stage'));
player.play();
