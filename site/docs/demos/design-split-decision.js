import {fracture, polygon} from '../../runtime/src/geometry/shapes/index.js';
import {createMergeMorph, createSplitMorph} from '../../runtime/src/morph/index.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

const shape = coordinates => polygon(coordinates.map(([x, y]) => ({x, y})));
const capsule = shape([[191, 109], [260, 68], [329, 109], [329, 158], [260, 193], [191, 158]]);
const docked = shape([[260, 57], [311, 116], [320, 176], [260, 199], [200, 176], [209, 116]]);
const fleet = [
  {id: 'port', shape: shape([[88, 138], [135, 107], [165, 143], [127, 160]])},
  {id: 'nose', shape: shape([[242, 109], [229, 70], [260, 37], [291, 70], [278, 109]])},
  {id: 'starboard', shape: shape([[355, 143], [385, 107], [432, 138], [393, 160]])},
];
const origin = fracture(capsule, {pieces: 3, sites: [{x: 218, y: 136}, {x: 260, y: 104}, {x: 302, y: 136}]});
const destination = fracture(docked, {pieces: 3, sites: [{x: 230, y: 150}, {x: 260, y: 103}, {x: 290, y: 150}]});
const split = createSplitMorph(origin, fleet, {assign: 'index', stagger: .1, samples: 48});
const merge = createMergeMorph(fleet, destination, {assign: 'index', stagger: .1, samples: 48});
const SPLIT_END = .43;
const MERGE_START = .57;
const toPath = commands => new Path2D(commands.map(command => command.join(' ')).join(' '));
const STARS = [[57,71,1.7], [105,58,1.4], [174,92,1.2], [198,44,1.2], [329,31,1.6], [351,81,2], [411,58,1.6], [454,109,1.3], [70,181,1.8], [448,185,1.2]];

export default async function splitDecision(stage, ctx) {
  const shuttle = {name: 'the shuttle on the flight path', x: 88, y: 233, axis: 'x', minX: 75, maxX: 445};
  return dragStudy(stage, ctx, {
    height: 292,
    handles: [shuttle],
    draw(g, {dark, ink}) {
      const p = (shuttle.x - shuttle.minX) / (shuttle.maxX - shuttle.minX);
      const separating = p < SPLIT_END;
      const docking = p > MERGE_START;
      const pieces = docking
        ? merge.sample((p - MERGE_START) / (1 - MERGE_START))
        : split.sample(separating ? p / SPLIT_END : 1);
      const wash = paintColor(218, 43, dark ? 15 : 96);
      const orbit = paintColor(220, 27, dark ? 63 : 43, .3);
      const track = paintColor(218, 31, dark ? 69 : 44);
      const colors = {
        port: paintColor(175, 58, dark ? 67 : 42),
        nose: paintColor(32, 83, dark ? 72 : 49),
        starboard: paintColor(216, 72, dark ? 76 : 51),
      };
      const cabin = paintColor(214, 48, dark ? 34 : 90);
      g.fillStyle = wash;
      g.fillRect(29, 22, 462, 181);
      for (const [x, y, r] of STARS) disc(g, x, y, r, orbit);
      g.lineWidth = 1.5;
      g.strokeStyle = orbit;
      g.setLineDash([4, 4]);
      g.beginPath();
      g.moveTo(126, 165);
      g.quadraticCurveTo(174, 67, 260, 74);
      g.quadraticCurveTo(346, 67, 394, 165);
      g.stroke();
      g.setLineDash([]);
      for (const piece of pieces) {
        g.fillStyle = colors[docking ? piece.from : piece.to];
        g.fill(toPath(piece.commands));
      }

      g.fillStyle = orbit;
      g.fillRect(shuttle.minX, shuttle.y - 1, shuttle.maxX - shuttle.minX, 2);
      for (const x of [shuttle.minX, 260, shuttle.maxX]) disc(g, x, shuttle.y, 4, track);
      g.fillStyle = track;
      g.beginPath();
      g.moveTo(shuttle.x + 16, shuttle.y);
      g.lineTo(shuttle.x - 12, shuttle.y - 9);
      g.lineTo(shuttle.x - 7, shuttle.y);
      g.lineTo(shuttle.x - 12, shuttle.y + 9);
      g.closePath();
      g.fill();
      disc(g, shuttle.x + 2, shuttle.y, 3.5, cabin);
      label(g, 'Launch', shuttle.minX, 277, ink, 16);
      label(g, 'Formation', 260, 277, ink, 16);
      label(g, 'Dock', shuttle.maxX, 277, ink, 16);

      if (p === 0) return 'Launch ready. Three colored pieces fill the capsule.';
      if (p === 1) return 'Docked. The same three colors fill a new outline.';
      if (docking) return 'Merge. Each craft moves toward its part of the new capsule.';
      if (separating) return 'Split. Each piece moves from the capsule toward a separate craft.';
      return 'Formation. All three craft are apart. Scrub onward to dock.';
    },
  });
}
