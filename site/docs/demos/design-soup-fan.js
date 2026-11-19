import {inputSource, thresholdInput} from '../../runtime/src/inputs/index.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

const ON = 70;
const OFF = 50;
const BOTTOM = 256;
const PIXELS_PER_DEGREE = 12 / 5;
const yAt = value => BOTTOM - PIXELS_PER_DEGREE * (value - 20);
const TOP = yAt(90);

function oval(g, x, y, rx, ry, fill) {
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
  g.fill();
}

export default async function soupFan(stage, ctx) {
  const temperature = inputSource({id: 'soup-temperature', unit: '°C', maxAge: 86400});
  const cooling = thresholdInput(temperature, {id: 'soup-fan', above: ON, below: OFF, initial: false});
  await temperature.start();
  await cooling.start();
  const bead = {name: 'the thermometer bead', x: 139, y: yAt(60), axis: 'y', minY: TOP, maxY: BOTTOM};
  let recorded;
  let stop;
  try {
    stop = dragStudy(stage, ctx, {
      height: 285,
      handles: [bead],
      draw(g, {dark, ink}) {
        const degrees = Math.round(20 + (BOTTOM - bead.y) / PIXELS_PER_DEGREE);
        if (degrees !== recorded) {
          temperature.push(degrees);
          recorded = degrees;
        }
        const on = cooling.snapshot().latest?.value === true;
        const wash = paintColor(42, 82, dark ? 63 : 53, .15);
        const track = paintColor(214, 17, dark ? 44 : 77);
        const red = paintColor(10, 78, dark ? 70 : 48);
        const copper = paintColor(27, 56, dark ? 64 : 42);
        const broth = paintColor(44, 89, dark ? 73 : 57);
        const enamel = paintColor(171, 49, dark ? 63 : 43);
        const fan = on ? paintColor(202, 66, dark ? 73 : 41) : track;

        g.fillStyle = wash;
        g.fillRect(112, yAt(ON), 55, yAt(OFF) - yAt(ON));
        g.fillStyle = track;
        g.fillRect(bead.x - 2, TOP, 4, BOTTOM - TOP);
        g.fillStyle = red;
        g.fillRect(bead.x - 2, bead.y, 4, BOTTOM - bead.y);
        for (const [value, text] of [[ON, 'On ≥ 70°'], [OFF, 'Off ≤ 50°']]) {
          const y = yAt(value);
          g.fillStyle = track;
          g.fillRect(109, y - 1, 21, 2);
          label(g, text, 73, y, ink, 15);
        }
        disc(g, bead.x, bead.y, 13, red);
        disc(g, bead.x - 3, bead.y - 3, 3, paintColor(19, 77, 93));
        label(g, '90°', 83, TOP, ink, 14);
        label(g, '20°', 83, BOTTOM, ink, 14);

        oval(g, 300, 245, 85, 8, paintColor(211, 15, dark ? 26 : 89));
        g.fillStyle = copper;
        g.fillRect(203, 182, 29, 9);
        g.fillRect(367, 182, 29, 9);
        g.fillStyle = enamel;
        g.beginPath();
        g.roundRect(225, 160, 150, 77, [0, 0, 20, 20]);
        g.fill();
        oval(g, 300, 160, 77, 17, copper);
        oval(g, 300, 158, 70, 12, broth);
        for (const [x,y,r] of [[267,157,4], [295,162,3], [326,154,3], [343,160,4]]) disc(g, x, y, r, copper);
        g.lineWidth = 2;
        g.lineCap = 'round';
        g.strokeStyle = paintColor(24, 49, dark ? 77 : 51, .23 + .4 * (degrees - 20) / 70);
        for (const x of [267, 292, 317]) {
          g.beginPath();
          g.moveTo(x, 139);
          g.bezierCurveTo(x - 13, 122, x + 13, 114, x, 100);
          g.stroke();
        }

        if (on) {
          g.strokeStyle = fan;
          for (const y of [93, 106, 119]) {
            g.beginPath();
            g.moveTo(395, y);
            g.quadraticCurveTo(373, y - 5, 350, y + 9);
            g.stroke();
          }
        }
        g.strokeStyle = fan;
        g.beginPath();
        g.arc(434, 106, 32, 0, 2 * Math.PI);
        g.stroke();
        g.save();
        g.translate(434, 106);
        for (let blade = 0; blade < 3; blade++) {
          g.rotate(2 * Math.PI / 3);
          oval(g, 0, -13, 6, 13, fan);
        }
        g.restore();
        disc(g, 434, 106, 6, fan);
        label(g, on ? 'Fan on' : 'Fan off', 434, 153, ink, 16);
        const between = degrees > OFF && degrees < ON;
        return `${degrees} °C. Fan ${on ? 'on' : 'off'}.${between ? ' It keeps its state between the marks.' : ''}`;
      },
    });
  } catch (error) {
    cooling.dispose();
    temperature.dispose();
    throw error;
  }
  return () => {
    stop();
    cooling.dispose();
    temperature.dispose();
  };
}
