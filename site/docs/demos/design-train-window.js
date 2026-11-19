import {scene} from '../../runtime/src/core/index.js';
import {parallaxRig} from '../../runtime/src/parallax/index.js';
import {colour, ground} from './_kit.js';
import {disc, dragStudy, label, polygon, WIDTH} from './design-stage.js';

const HEIGHT = 270;
const START = 75;
const END = WIDTH - 75;
const WINDOW = {x: 16, y: 17, width: WIDTH - 32, height: 184};
const FENCE_SPACING = 64;

function hills(g, start, baseline, color) {
  polygon(g, [
    {x: start - 150, y: baseline}, {x: start + 27, y: baseline - 58},
    {x: start + 124, y: baseline - 104}, {x: start + 177, y: baseline - 66},
    {x: start + 238, y: baseline - 92}, {x: start + 346, y: baseline - 33},
    {x: start + 584, y: baseline - 102}, {x: start + 741, y: baseline},
  ], color);
}

export default function trainWindow(stage, ctx) {
  const drawing = scene({width: WIDTH, height: HEIGHT, duration: 1});
  const rig = parallaxRig(drawing, {
    layers: [{name: 'sky', depth: 24}, {name: 'hills', depth: 7}, {name: 'fence', depth: 1}],
    travel: 330,
  });
  const train = {name: 'the train', x: START, y: 231, minX: START, maxX: END, axis: 'x'};

  return dragStudy(stage, ctx, {
    height: HEIGHT,
    handles: [train],
    draw(g, {width, height, ink}) {
      const time = (train.x - START) / (END - START);
      const sky = rig.offset('sky', time).x;
      const ridge = rig.offset('hills', time).x;
      const fence = rig.offset('fence', time).x;
      g.fillStyle = ground(ctx);
      g.fillRect(0, 0, width, height);
      g.save();
      g.beginPath();
      g.roundRect(WINDOW.x, WINDOW.y, WINDOW.width, WINDOW.height, 15);
      g.clip();

      g.fillStyle = colour(ctx, 3, 41, 77);
      g.fillRect(0, 0, width, 202);
      disc(g, 411 + sky, 68, 24, colour(ctx, 47, 80, 77));
      hills(g, ridge, 170, colour(ctx, 18, 22, 46));
      hills(g, ridge + 139, 210, colour(ctx, -17, 29, 44));
      g.fillStyle = colour(ctx, -44, 32, 35);
      g.fillRect(0, 157, width, 48);
      g.fillStyle = colour(ctx, 41, 51, 57);
      for (let x = fence % FENCE_SPACING - FENCE_SPACING; x < width; x += FENCE_SPACING) {
        g.fillRect(x, 169, 10, 36);
      }
      g.fillRect(0, 177, width, 5);
      g.fillRect(0, 188, width, 5);
      g.restore();

      g.fillStyle = ink;
      g.fillRect(START - 18, train.y + 12, END - START + 36, 2);
      g.fillStyle = colour(ctx, -128, 63, 37);
      g.beginPath();
      g.roundRect(train.x - 20, train.y - 11, 40, 19, [4, 9, 3, 3]);
      g.fill();
      g.fillStyle = colour(ctx, -113, 51, 79);
      g.fillRect(train.x - 5, train.y - 7, 14, 6);
      disc(g, train.x - 12, train.y + 8, 4, ink);
      disc(g, train.x + 12, train.y + 8, 4, ink);
      label(g, 'Train route', width / 2, 257, ink, 12);

      const distance = Math.round(-fence);
      return distance
        ? `Fence posts moved ${distance} px. Hills moved ${Math.round(-ridge)} px.`
        : 'Drag the train down the track to compare the scenery.';
    },
  });
}
