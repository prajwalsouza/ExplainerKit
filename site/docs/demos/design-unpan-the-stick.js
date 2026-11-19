import {scene} from '../../runtime/src/core/index.js';
import {character, keysFromPoseTrack, stick} from '../../runtime/src/characters/index.js';
import {disc, label, paintColor} from './design-stage.js';
import {characterStudy, rail} from './design-character-study.js';
import {CAMERA, makeObservations} from './design-pose-observations.js';

const HEIGHT = 303;

export default async function unpanTheStick(stage, ctx) {
  const drawing = scene({width: 520, height: HEIGHT, duration: 1});
  const track = makeObservations();
  const rig = stick({ink: paintColor(204, 32, 46), line: 4.5});
  const recovered = keysFromPoseTrack(track, {camera: CAMERA, ground: 221, rig});
  const performer = character(drawing, rig, {idle: false, secondaryMotion: false});
  performer.keys(recovered.keys);
  performer.follow(recovered.rootTrack, recovered.followOptions);
  const reel = {name: 'the measured frame reel', x: 154, y: 264, axis: 'x', minX: 68, maxX: 452};
  return characterStudy(stage, ctx, drawing, {
    height: HEIGHT,
    handles: [reel],
    draw(g, {dark, ink}, paint) {
      const index = Math.round(4 * (reel.x - reel.minX) / (reel.maxX - reel.minX));
      const {t, pose} = track.samples[index];
      const pan = CAMERA(t)[4];
      const measured = paintColor(319, 64, dark ? 74 : 43);
      const world = paintColor(180, 56, dark ? 70 : 40);
      const pale = paintColor(ctx.hue, 25, dark ? 33 : 81);
      g.fillStyle = pale;
      g.fillRect(83, 222, 340, 2);
      paint(g, t);
      for (const [x, y] of Object.values(pose.labelled.ends)) disc(g, x, y, 4, measured);
      disc(g, pose.head.cx, pose.head.cy, 5, measured);
      g.strokeStyle = measured;
      g.lineWidth = 1;
      g.setLineDash([3,4]);
      g.beginPath();
      g.moveTo(pose.head.cx - pan, pose.head.cy);
      g.lineTo(pose.head.cx, pose.head.cy);
      g.stroke();
      g.setLineDash([]);
      disc(g, pose.head.cx - pan, pose.head.cy, 3, world);
      label(g, 'Measured image points', 353, 33, measured, 15);
      label(g, 'World pose', 156, 33, world, 15);
      rail(g, reel, world, ink, 'First frame', 'Last frame');
      label(g, '◉', reel.x, reel.y, paintColor(43, 44, 98), 17);
      return `Frame ${index + 1}. The known camera shift adds ${pan.toFixed(1)} units to the image points.`;
    },
  });
}
