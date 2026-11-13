import { assert, number, options } from '../../core/validate.js';
import { validateBlur, validateGlow, blurRadius } from '../../graphics/look.js';
import { dynamicClipId } from '../../core/dynamic-clip.js';

/** Opt into one uniform-root union filter for contiguous world roots, preserving paint order.
 * @param {import('../../core/scene.js').Scene} scene
 * @param {any[]} handles
 * @param {{blur?:number|{radius?:number,space?:'world'|'screen',maxScreen?:number,strict?:boolean},glow?:any,time?:number}} [spec]
 */
export function effectBatch(scene, handles, spec = {}) {
  options(spec, ['blur', 'glow', 'time'], 'effect batch');
  assert(
    Array.isArray(handles) && handles.length > 0 && handles.length <= 1000,
    'RESOURCE_LIMIT',
    'Batch 1–1000 contiguous root handles.',
  );
  const captured = [];
  for (let i = 0; i < handles.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(handles, i);
    assert(descriptor && 'value' in descriptor, 'INVALID_EFFECT_BATCH', 'Batch handles must be a dense data array.');
    captured.push(descriptor.value);
  }
  handles = captured;
  assert(
    new Set(handles).size === handles.length && handles.every((h) => scene._isAdoptableRoot(h)),
    'INVALID_EFFECT_BATCH',
    'Use distinct adoptable roots from this scene.',
  );
  const context = scene._sampleContext({ time: number(spec.time ?? 0, 'batch inspection time', 0, 86400) }),
    world = scene._sampleWorld(context),
    ids = world.children.map((n) => n.id),
    indices = handles.map((h) => ids.indexOf(h.id));
  assert(
    indices.every((value, i) => value >= 0 && (i === 0 || value === indices[i - 1] + 1)),
    'INVALID_EFFECT_BATCH',
    'Batch handles in their contiguous scene paint order.',
  );
  const projection = scene.activeCamera?.project(world, context),
    screen = new Set(projection?.screenRoots ?? projection?.overlayRoots ?? []);
  assert(
    handles.every((h) => !screen.has(h.id)),
    'INVALID_EFFECT_BATCH',
    'Screen-space roots must keep their own camera assignments.',
  );
  const first = handles[0]._record.props,
    blur = validateBlur(spec.blur ?? first.blur ?? 0),
    glow = validateGlow(spec.glow === undefined ? (first.glow ?? null) : spec.glow);
  assert(
    blurRadius(blur) > 0 || glow,
    'INVALID_EFFECT_BATCH',
    'Provide a blur or glow, or batch matching existing effects.',
  );
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b),
    childHas = blurRadius(first.blur) > 0 || first.glow;
  const inspect = (r, root = false) => {
    const p = r.props;
    assert(
      !dynamicClipId(r) && !p.mask && !p.clip && !p.shade && !p.texture && (p.blend ?? 'normal') === 'normal',
      'INVALID_EFFECT_BATCH',
      'Batched branches cannot contain clips, masks, shading, textures or non-normal blending.',
    );
    for (const key of ['blur', 'glow', 'mask', 'clip', 'shade', 'texture', 'blend'])
      assert(
        !r.bindings.has(key) && !r.tracks.has(key) && !r.collectionOwned.has(key),
        'CHANNEL_OWNED',
        'Effect batching requires static effect channels.',
      );
    if (root) {
      if (childHas)
        assert(
          same(p.blur, first.blur) &&
            same(p.glow, first.glow) &&
            same(blur, validateBlur(p.blur ?? 0)) &&
            same(glow, validateGlow(p.glow ?? null)),
          'INVALID_EFFECT_BATCH',
          'Only identical root effects may be hoisted.',
        );
      else
        assert(
          !blurRadius(p.blur) && !p.glow,
          'INVALID_EFFECT_BATCH',
          'Do not mix filtered and unfiltered batch roots.',
        );
    } else
      assert(
        !blurRadius(p.blur) && !p.glow,
        'INVALID_EFFECT_BATCH',
        'Nested filters need their own authored compositing boundary.',
      );
    for (const child of r.children.values()) inspect(child);
  };
  for (const handle of handles) inspect(handle._record, true);
  const kept = new Set(scene.activeCamera?._stagingState().keepingTargets ?? []),
    containsKept = (r) => kept.has(r.id) || [...r.children.values()].some(containsKept);
  assert(
    !handles.some((h) => containsKept(h._record)),
    'INVALID_EFFECT_BATCH',
    'Release camera keeping before filtering its targets.',
  );
  if (scene.activeCamera) {
    const start = indices[0],
      children = world.children
        .slice(start, start + handles.length)
        .map((node) => ({ ...node, props: { ...node.props, blur: 0, glow: null } })),
      group = { id: 'effect-batch-preview', type: 'group', props: { blur, glow }, children },
      proposed = {
        ...world,
        children: [...world.children.slice(0, start), group, ...world.children.slice(start + handles.length)],
      };
    scene.activeCamera.project(proposed, context);
  }
  // Core preflights capacity, hierarchy, region ownership and contiguous root order before mutation.
  return scene._batch(() => {
    const group = scene._groupContiguous(handles, { blur, glow });
    for (const handle of handles) handle.set({ blur: 0, glow: null });
    return group;
  });
}
