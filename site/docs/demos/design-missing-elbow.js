import {skeletonFromPoseTrack} from '../../runtime/src/characters/index.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';
import {rail} from './design-character-study.js';
import {CAMERA, makeObservations} from './design-pose-observations.js';

export default async function missingElbow(stage, ctx) {
  const track = makeObservations({missingHand: true});
  const fitted = skeletonFromPoseTrack(track, {camera: CAMERA});
  const reel = {name: 'the skeleton frame reel', x: 130, y: 262, axis: 'x', minX: 72, maxX: 448};
  return dragStudy(stage, ctx, {
    height: 301,
    handles: [reel],
    draw(g, {dark, ink}) {
      const index = Math.round(4 * (reel.x - reel.minX) / (reel.maxX - reel.minX));
      const time = track.samples[index].t;
      const pose = fitted.sample(time);
      const status = fitted.frames[index].status.armRightUpper;
      const measured = paintColor(189, 56, dark ? 72 : 39);
      const inferred = paintColor(33, 74, dark ? 73 : 43);
      const faded = paintColor(ctx.hue, 21, dark ? 45 : 72);
      g.fillStyle = faded;
      g.fillRect(90, 224, 340, 2);
      g.lineCap = 'round';
      g.lineWidth = 5;
      for (const bone of pose.bones) {
        g.strokeStyle = bone.id.startsWith('armRight') && status === 'interpolated' ? inferred : measured;
        g.beginPath();
        g.moveTo(bone.start.x,bone.start.y);
        g.lineTo(bone.end.x,bone.end.y);
        g.stroke();
        disc(g, bone.end.x, bone.end.y, 3.5, g.strokeStyle);
      }
      disc(g, pose.root.x, pose.root.y, fitted.headRadius, faded);
      disc(g, pose.root.x + 4, pose.root.y - 1, 2, ink);
      const observed = track.samples[index].pose.labelled.limbs.handRight;
      for (const [x, y] of observed ?? []) disc(g, x - CAMERA(time)[4], y, 2.5, ink);
      rail(g, reel, measured, ink, 'First frame', 'Last frame');
      label(g, '◉', reel.x, reel.y, paintColor(43, 54, 95), 17);
      return status === 'interpolated'
        ? 'An elbow went camera-shy. This frame’s right arm uses interpolated angles and keeps the same bone lengths.'
        : `Frame ${index + 1}. The fit uses a measured right arm. The small dots show its measured points.`;
    },
  });
}
