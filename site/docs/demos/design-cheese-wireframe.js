import {importGLTF} from '../../runtime/src/import/gltf.js';
import {perspectiveCamera, projectLines} from '../../runtime/src/spatial/index.js';
import {createCanvasRenderer} from '../../runtime/src/renderers/canvas.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

// Original six-vertex triangular prism with rectangular faces made of pairs of triangles.
const positions = [-1.5, -.65, -.8, 1.5, -.65, -.8, -.8, -.65, 1, -1.5, .65, -.8, 1.5, .65, -.8, -.8, .65, 1];
const indices = [0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 2, 0, 3, 2, 3, 5];
const buffer = new Uint8Array(positions.length * 4 + indices.length);
const view = new DataView(buffer.buffer);
positions.forEach((value, index) => view.setFloat32(index * 4, value, true));
buffer.set(indices, positions.length * 4);
const cheese = importGLTF({asset: {version: '2.0'}, scenes: [{nodes: [0]}], nodes: [{mesh: 0}],
  meshes: [{primitives: [{attributes: {POSITION: 0}, indices: 1}]}],
  buffers: [{uri: 'cheese.bin', byteLength: buffer.length}],
  bufferViews: [{buffer: 0, byteLength: positions.length * 4}, {buffer: 0, byteOffset: positions.length * 4, byteLength: indices.length}],
  accessors: [{bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3'}, {bufferView: 1, componentType: 5121, count: indices.length, type: 'SCALAR'}],
}, {buffers: {'cheese.bin': buffer}});

export default function cheeseWireframe(stage, ctx) {
  const spin = {name: 'the cheese turntable', x: 178, y: 247, axis: 'x', minX: 82, maxX: 438};
  const camera = perspectiveCamera({z: 5, y: 1.3, target: {x: 0, y: 0, z: 0}}, {width: 520, height: 225});
  const renderer = createCanvasRenderer(document.createElement('div'), {points: 'cpu'});
  const stop = dragStudy(stage, ctx, {height: 272, handles: [spin], draw(g, {dark, ink}) {
    const rotationY = (spin.x - spin.minX) * 2 * Math.PI / (spin.maxX - spin.minX);
    const frame = projectLines(cheese.geometry, camera, {transform: {rotationY}, stroke: paintColor(38, 74, dark ? 72 : 40), strokeWidth: 2.5});
    renderer.render(frame);
    g.drawImage(renderer.element, 0, 0, 520, 225);
    label(g, 'Cut lines are triangle edges', 260, 33, ink, 15);
    g.fillStyle = paintColor(38, 25, dark ? 70 : 43, .4);
    g.fillRect(spin.minX, spin.y - 2, spin.maxX - spin.minX, 4);
    disc(g, spin.x, spin.y, 12, ink);
    return `${cheese.diagnostics.triangles} triangles supplied ${cheese.geometry.edges.length} distinct edges.`;
  }});
  return () => { stop(); renderer.dispose(); };
}
