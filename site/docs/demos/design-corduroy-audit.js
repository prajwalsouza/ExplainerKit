import {auditRender3D, describeThreeScene} from '../../runtime/src/audit/index.js';
import {disc, dragStudy, label, paintColor, WIDTH} from './design-stage.js';

const VIEW_HEIGHT = 224;
const HEIGHT = 310;
const MAP_SIZES = [16, 32, 64, 128, 256, 512];
const color = (h, s, l) => paintColor(h, s, l).slice(0, 7);

async function loadThree() {
  const directory = new URL('.', import.meta.url).pathname;
  return directory.endsWith('/docs/demos/')
    ? import('../../vendor/three/three.module.js')
    : import('../../three/three.module.js');
}

export default async function shadowDetailAudit(stage, ctx) {
  let THREE;
  try {
    THREE = await loadThree();
  } catch {
    stage.textContent = 'The local 3D renderer could not be loaded.';
    return;
  }
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', {antialias: true, alpha: false});
  if (!context) {
    stage.textContent = 'This 3D audit preview requires WebGL 2.';
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({canvas, context, antialias: true, alpha: false});
  } catch {
    stage.textContent = 'This browser could not start the 3D renderer.';
    return;
  }

  renderer.setPixelRatio(1);
  renderer.setSize(WIDTH, VIEW_HEIGHT, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, WIDTH / VIEW_HEIGHT, .1, 28);
  const meshes = [];
  function addMesh(name, geometry, fill, x, y, z, casts = true) {
    const material = new THREE.MeshStandardMaterial({color: fill, roughness: .55, metalness: .06});
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = casts;
    mesh.receiveShadow = true;
    meshes.push(mesh);
    scene.add(mesh);
    return mesh;
  }

  const platform = addMesh('Stone platform', new THREE.BoxGeometry(5.2, .26, 4.2), color(44, 31, 74), 0, -.13, 0, false);
  addMesh('Ring pedestal', new THREE.CylinderGeometry(.53, .62, .31, 36), color(216, 48, 42), -.95, .155, -.45).material.roughness = .65;
  addMesh('Turquoise ring', new THREE.TorusGeometry(.72, .16, 18, 64), color(169, 58, 42), -.95, 1.19, -.45).rotation.y = -.15;
  addMesh('Coral sculpture', new THREE.IcosahedronGeometry(.68, 0), color(19, 86, 57), .93, .68, .54).rotation.set(.21, .56, .08);
  addMesh('Blue step', new THREE.BoxGeometry(.73, .42, .75), color(218, 68, 47), -1.25, .21, 1.05).rotation.y = -.18;
  addMesh('Marigold column', new THREE.CylinderGeometry(.25, .34, 1.14, 40), color(46, 77, 54), 1.35, .57, -.94);

  scene.add(new THREE.HemisphereLight(color(42, 44, 94), color(220, 35, 66), 1.7));
  const key = new THREE.DirectionalLight(color(45, 58, 92), 3.2);
  key.name = 'Gallery light';
  key.position.set(-3.8, 6.5, 3.5);
  key.castShadow = true;
  key.shadow.bias = -.0003;
  key.shadow.normalBias = .021;
  Object.assign(key.shadow.camera, {left: -4.3, right: 4.3, top: 4.3, bottom: -4.3, near: .2, far: 16});
  key.shadow.camera.updateProjectionMatrix();
  scene.add(key);

  const detail = {name: 'the shadow-map dial', x: 74, y: 246, minX: 74, maxX: 446, axis: 'x'};
  const orbit = {name: 'the camera orbit marker', x: 451, y: 65, minX: 412, maxX: 491, axis: 'x'};
  const subject = [0, .35, 0];
  let currentMap;
  let stop;
  let disposed = false;

  function dispose() {
    if (disposed) return;
    disposed = true;
    stop?.();
    for (const mesh of meshes) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    key.shadow.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  try {
    stop = dragStudy(stage, ctx, {
      height: HEIGHT,
      handles: [detail, orbit],
      draw(g, {dark, ink}) {
        const mapIndex = Math.round((MAP_SIZES.length - 1) * (detail.x - detail.minX) / (detail.maxX - detail.minX));
        const mapSize = MAP_SIZES[mapIndex];
        if (mapSize !== currentMap) {
          key.shadow.map?.dispose();
          key.shadow.map = null;
          key.shadow.mapSize.set(mapSize, mapSize);
          key.shadow.needsUpdate = true;
          currentMap = mapSize;
        }

        const angle = .35 + .94 * (orbit.x - orbit.minX) / (orbit.maxX - orbit.minX);
        camera.position.set(7.1 * Math.sin(angle), 3.65, 7.1 * Math.cos(angle));
        camera.lookAt(0, .54, 0);
        scene.background = new THREE.Color(dark ? color(219, 34, 18) : color(217, 36, 86));
        platform.material.color.set(dark ? color(229, 24, 51) : color(44, 31, 74));
        renderer.render(scene, camera);
        g.drawImage(canvas, 0, 0, WIDTH, VIEW_HEIGHT);

        const availableWidth = Math.max(60, stage.clientWidth - 2);
        const viewport = {width: availableWidth, height: VIEW_HEIGHT * availableWidth / WIDTH};
        const report = auditRender3D(describeThreeScene({scene, camera, renderer, viewport, subject}));
        const warning = report.findings.some(finding => finding.rule === 'shadow-resolution');
        const texels = report.measures.lights[0].texelPixels;
        const accent = warning ? paintColor(15, 66, dark ? 70 : 40) : paintColor(172, 56, dark ? 69 : 35);
        const soft = paintColor(212, 20, dark ? 70 : 47, .48);
        const paper = paintColor(42, 33, dark ? 15 : 95);
        const badge = warning ? 'Shadow resolution warning' : 'Shadow resolution passes';

        g.fillStyle = paper;
        g.fillRect(17, 16, 222, 29);
        label(g, badge, 128, 30, accent, 14);
        g.fillStyle = paper;
        g.fillRect(395, 14, 109, 68);
        label(g, 'Orbit view', 449, 25, ink, 13);
        g.fillStyle = soft;
        g.fillRect(orbit.minX, orbit.y - 1, orbit.maxX - orbit.minX, 2);
        disc(g, orbit.x, orbit.y, 8, accent);
        g.fillRect(detail.minX, detail.y - 1, detail.maxX - detail.minX, 2);
        g.fillStyle = soft;
        for (let index = 0; index < MAP_SIZES.length; index++) {
          disc(g, detail.minX + index * (detail.maxX - detail.minX) / (MAP_SIZES.length - 1), detail.y, 3, soft);
        }
        disc(g, detail.x, detail.y, 12, accent);
        label(g, '◐', detail.x, detail.y, paper, 15);
        label(g, 'Coarse shadow map', 94, 286, ink, 15);
        label(g, 'Fine shadow map', 430, 286, ink, 15);
        return `${mapSize} × ${mapSize} shadow map. ${texels} screen pixels per shadow texel. ${badge}.`;
      },
    });
  } catch (error) {
    dispose();
    throw error;
  }
  return dispose;
}
