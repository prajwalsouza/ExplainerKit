import { assert, number, options } from '../core/validate.js';

/** Share frames rendered by a caller-owned Canvas renderer with a Three scene. */
export function createThreeFramePlane(spec = {}) {
  options(spec, ['THREE', 'source', 'width'], 'Three frame plane');
  const { THREE, source } = spec;
  for (const name of ['CanvasTexture', 'PlaneGeometry', 'MeshBasicMaterial', 'Mesh', 'Group']) {
    assert(typeof THREE?.[name] === 'function', 'THREE_REQUIRED', `The frame plane requires THREE.${name}.`);
  }
  const canvas = source?.element;
  assert(
    typeof canvas?.getContext === 'function' && typeof source.render === 'function',
    'INVALID_RENDERER',
    'Supply a Canvas renderer as the source of the frame plane.',
  );
  const width = number(spec.width ?? 1, 'Three frame plane width', 1e-4, 1e6);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 1 / 255,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  const object = new THREE.Group();
  object.add(mesh);
  mesh.visible = false;
  let disposed = false;

  return Object.freeze({
    object,
    render(frame) {
      assert(!disposed, 'DISPOSED', 'The Three frame plane has been disposed.');
      const logicalWidth = number(Object.getOwnPropertyDescriptor(frame ?? {}, 'width')?.value, 'frame width', 1, 8192);
      const logicalHeight = number(
        Object.getOwnPropertyDescriptor(frame ?? {}, 'height')?.value,
        'frame height',
        1,
        8192,
      );
      source.render(frame);
      mesh.scale.set(width, (width * logicalHeight) / logicalWidth, 1);
      mesh.visible = true;
      texture.needsUpdate = true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mesh.visible = false;
      object.removeFromParent();
      object.remove(mesh);
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  });
}
