// @recipe camera-shots
// @title Move a camera between regions of a large world
// @task Register named regions in a big scene and choreograph camera shots: frame, cut, zoom and whip pan.
// @uses explainerkit/core
// @keywords camera, pan, zoom, frame, cut, whip pan, regions, shots, overview and detail, close-up
// @guide docs/modules/camera-choreography.md
import {scene} from 'explainerkit/core';

const drawing = scene({width: 960, height: 540, duration: 7, label: 'The camera visits a small detail and returns'});
for (let i = 0; i < 40; i++) drawing.circle({x: 60 + (i % 10) * 200, y: 60 + Math.floor(i / 10) * 260, r: 18, fill: '#cfd8d2'});
const star = drawing.circle({x: 1560, y: 860, r: 30, fill: '#a74a2d'});
drawing.text({x: 1500, y: 930, text: 'the detail', fontSize: 28, fill: '#262d2b'});

drawing.region('overview', {x: 0, y: 0, width: 2000, height: 1125});
drawing.region('detail', {x: 1360, y: 720, width: 480, height: 270});
drawing.camera().shots([
  {at: 0, frame: 'overview'},
  {at: 1, frame: 'detail', duration: 1.6, ease: 'easeInOut'},
  {at: 4.5, whipPan: 'overview', duration: 0.9},
]);
void star;

export const player = await drawing.mount(document.querySelector('#stage'));
player.play();
