import {auditFrame} from '../../runtime/src/audit/index.js';
import {scene} from '../../runtime/src/core/index.js';
import {colour, ground} from './_kit.js';
import {dragStudy, label, WIDTH} from './design-stage.js';

const HEIGHT = 265;
const PANEL_WIDTH = 158;
const PANEL_HEIGHT = 57;
const TREND = [['M', 54, 57], ['L', 155, 84], ['L', 226, 102], ['L', 303, 160], ['L', 464, 214]];

export default function coverUpAudit(stage, ctx) {
  const drawing = scene({width: WIDTH, height: HEIGHT});
  const trend = drawing.path({commands: TREND, strokeWidth: 5, fill: 'none'});
  const notice = drawing.rect({width: PANEL_WIDTH, height: PANEL_HEIGHT});
  const handle = {name: 'the Everything is fine sign', x: 379, y: 61, minX: 97, maxX: 423, minY: 43, maxY: 211};

  return dragStudy(stage, ctx, {
    height: HEIGHT,
    handles: [handle],
    draw(g, {width, height, dark, ink}) {
      const background = ground(ctx);
      const line = colour(ctx, -139, 63, dark ? 60 : 35);
      const panel = colour(ctx, 26, 43, dark ? 21 : 85);
      trend.set({stroke: line});
      notice.set({x: handle.x - PANEL_WIDTH / 2, y: handle.y - PANEL_HEIGHT / 2, fill: panel});
      const {findings} = auditFrame(drawing.sample(), {background, displayWidth: g.canvas.clientWidth});
      const covered = findings.some(finding => finding.rule === 'hidesData' && finding.ids.includes(notice.id));

      g.fillStyle = background;
      g.fillRect(0, 0, width, height);
      g.strokeStyle = dark ? '#ffffff42' : '#25221e35';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(41, 35);
      g.lineTo(41, 227);
      g.lineTo(475, 227);
      for (let y = 65; y < 226; y += 40) {
        g.moveTo(41, y);
        g.lineTo(475, y);
      }
      g.stroke();
      g.strokeStyle = line;
      g.lineWidth = 5;
      g.lineJoin = 'round';
      g.beginPath();
      for (const [command, x, y] of TREND) {
        if (command === 'M') g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();

      const x = handle.x - PANEL_WIDTH / 2;
      const y = handle.y - PANEL_HEIGHT / 2;
      g.fillStyle = panel;
      g.fillRect(x, y, PANEL_WIDTH, PANEL_HEIGHT);
      g.strokeStyle = covered ? line : ink;
      g.lineWidth = covered ? 3 : 1;
      g.strokeRect(x, y, PANEL_WIDTH, PANEL_HEIGHT);
      label(g, 'Everything is fine', handle.x, handle.y, ink, 15);
      label(g, 'Time', width / 2, 246, ink, 13);
      return covered ? 'hidesData. The sign covers too much of the chart line.' : 'The audit reports no hidesData finding here.';
    },
  });
}
