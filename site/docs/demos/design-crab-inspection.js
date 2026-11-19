import {planAnnotations} from '../../runtime/src/layout/annotations.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

const subjects = [
  {id: 'claws', text: 'Claws', anchor: {x: 183, y: 114}, essential: true},
  {id: 'eyes', text: 'Eyes', anchor: {x: 270, y: 76}},
  {id: 'legs', text: 'Legs', anchor: {x: 335, y: 152}},
];

export default function crabInspection(stage, ctx) {
  const clock = {name: 'the crab inspection clock', x: 84, y: 238, axis: 'x', minX: 84, maxX: 436};
  return dragStudy(stage, ctx, {height: 264, handles: [clock], draw(g, {dark, ink}) {
    const time = (clock.x - clock.minX) / (clock.maxX - clock.minX);
    const inspection = time >= .4;
    const ground = paintColor(32, 23, dark ? 16 : 98);
    const shell = paintColor(11, 69, dark ? 68 : 53);
    g.fillStyle = ground;
    g.fillRect(0, 0, 520, 217);
    const plan = planAnnotations(subjects.map(subject => ({...subject, color: ink, fontSize: 19})), {
      bounds: {x: 16, y: 12, width: 488, height: 197},
      obstacles: [{x: 171, y: 73, width: 181, height: 87}],
      measure(text, {fontSize}) {
        g.font = `600 ${fontSize}px system-ui, sans-serif`;
        const m = g.measureText(text);
        return {width: m.width, height: fontSize + 3};
      },
      background: ground,
      phase: inspection ? 'inspect' : 'motion',
      inspectionAge: inspection ? time - .4 : 0,
    });
    g.fillStyle = shell;
    g.beginPath();
    g.ellipse(261, 129, 56, 31, 0, 0, 2 * Math.PI);
    g.fill();
    for (const side of [-1, 1]) {
      disc(g, 261 + side * 76, 111, 17, shell);
      disc(g, 261 + side * 80, 99, 7, ground);
      disc(g, 261 + side * 16, 90, 10, shell);
      disc(g, 261 + side * 17, 88, 4, ink);
      g.strokeStyle = shell;
      g.lineWidth = 5;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(261 + side * (38 + i * 5), 137);
        g.lineTo(261 + side * (56 + i * 7), 152 + i * 5);
        g.stroke();
      }
    }
    for (const item of plan.visible) label(g, item.text, item.x + item.width / 2, item.y + item.height / 2, item.color, item.fontSize);
    g.fillStyle = paintColor(32, 24, dark ? 65 : 49, .45);
    g.fillRect(clock.minX, clock.y - 2, clock.maxX - clock.minX, 4);
    disc(g, clock.x, clock.y, 12, ink);
    return `${inspection ? 'Inspection' : 'Motion'}. ${plan.visible.length} labels placed and ${plan.deferred.length} deferred.`;
  }});
}
