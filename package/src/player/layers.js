import { captureLayerTransition, layerTransitionAt } from './layer-transitions.js';
import { assert, number, options } from '../core/validate.js';
const leases = new WeakMap();
const counts = new WeakMap(),
  layers = new WeakMap();
/** One parent clock owns an explicitly supplied child renderer and its time window.
 * @param {any} player
 * @param {import('../core/scene.js').Scene} scene
 * @param {{renderer:{element:any,render:(frame:any)=>unknown,dispose:()=>unknown},from?:number,until?:number,offset?:number,fade?:number,ownRenderer?:boolean,z?:number,enter?:{kind?:'fade'|'opening'|'wipe'|'flyThrough',duration?:number,direction?:'left'|'right'|'up'|'down',shape?:any,through?:any},exit?:{kind?:'fade'|'opening'|'wipe'|'flyThrough',duration?:number,direction?:'left'|'right'|'up'|'down',shape?:any,through?:any}}} spec
 */
export function attachSceneLayer(player, scene, spec = {}) {
  options(spec, ['renderer', 'from', 'until', 'offset', 'fade', 'ownRenderer', 'z', 'enter', 'exit'], 'scene layer');
  assert(
    player && !player.disposed && typeof player.on === 'function' && scene && typeof scene.sample === 'function',
    'INVALID_SCENE_LAYER',
    'Use a live player and child scene.',
  );
  const renderer = spec.renderer;
  assert(
    renderer &&
      typeof renderer.render === 'function' &&
      typeof renderer.dispose === 'function' &&
      renderer.element?.style,
    'INVALID_SCENE_LAYER',
    'Supply a dedicated renderer with element, render and dispose.',
  );
  assert(
    !leases.has(renderer) && !leases.has(renderer.element),
    'LAYER_OWNED',
    'This renderer or element already belongs to a scene layer.',
  );
  assert((counts.get(player) ?? 0) < 64, 'RESOURCE_LIMIT', 'Use at most 64 child scene layers per player.');
  const from = number(spec.from ?? 0, 'layer start', 0, player.duration),
    until = number(spec.until ?? player.duration, 'layer end', from, player.duration),
    offset = number(spec.offset ?? 0, 'layer offset', 0, 86400),
    fade = number(spec.fade ?? 0, 'layer fade', 0, (until - from) / 2);
  assert(
    spec.ownRenderer === undefined || typeof spec.ownRenderer === 'boolean',
    'INVALID_SCENE_LAYER',
    'ownRenderer must be boolean.',
  );
  const z = spec.z === undefined ? undefined : number(spec.z, 'layer z', -10000, 10000);
  assert(z === undefined || Number.isInteger(z), 'INVALID_SCENE_LAYER', 'Layer z must be an integer.');
  const enter = captureLayerTransition(
      spec.enter ?? (fade ? { kind: 'fade', duration: fade } : undefined),
      until - from,
    ),
    exit = captureLayerTransition(spec.exit ?? (fade ? { kind: 'fade', duration: fade } : undefined), until - from);
  assert(
    (enter?.duration ?? 0) + (exit?.duration ?? 0) <= until - from,
    'INVALID_LAYER_TRANSITION',
    'Layer enter and exit windows must not overlap.',
  );
  const shaped = [enter, exit].some((t) => t && t.kind !== 'fade');
  const existingClip =
    renderer.element.ownerDocument?.defaultView?.getComputedStyle?.(renderer.element).clipPath ??
    renderer.element.style.clipPath;
  assert(
    !shaped || !existingClip || existingClip === 'none',
    'LAYER_OWNED',
    'Release an existing CSS clip before assigning layer transitions.',
  );
  let disposed = false,
    unframe = () => {},
    unend = () => {},
    unchange = () => {},
    releaseAmbient = null;
  const element = renderer.element,
    saved = { display: element.style.display, opacity: element.style.opacity },
    savedPriority = {
      display: element.style.getPropertyPriority?.('display') ?? '',
      opacity: element.style.getPropertyPriority?.('opacity') ?? '',
    };
  const extraKeys = [...(shaped ? ['clipPath'] : []), ...(z !== undefined ? ['zIndex', 'position'] : [])],
    cssNames = { clipPath: 'clip-path', zIndex: 'z-index', position: 'position' },
    extra = extraKeys.map((key) => ({
      key,
      value: element.style[key],
      own: Object.hasOwn(element.style, key),
      priority: element.style.getPropertyPriority?.(cssNames[key]) ?? '',
    }));
  const record = { scene, from, until, offset },
    registered = layers.get(player) ?? [];
  const resolveTime = (owner) => {
    const choices = registered.filter((r) => r.scene === owner),
      active = choices.filter(
        (r) =>
          player.time >= r.from &&
          (player.time < r.until || (player.time === player.duration && player.time === r.until)),
      );
    assert(
      active.length <= 1,
      'INVALID_LAYER_TRANSITION',
      'A transition source scene has ambiguous overlapping layer clocks.',
    );
    const source =
      active[0] ??
      choices
        .filter((r) => r.from <= player.time)
        .reduce((best, r) => (!best || r.from > best.from ? r : best), null) ??
      choices[0];
    return Math.max(0, Math.min(owner.duration, source ? player.time - source.from + source.offset : player.time));
  };
  const sample = (time) => {
    const context = {
        width: player.frame?.width ?? scene.width,
        height: player.frame?.height ?? scene.height,
        ambient: player.ambientTime ?? 0,
      },
      a = layerTransitionAt(enter, enter ? (time - from) / enter.duration : 1, context, resolveTime),
      b = layerTransitionAt(exit, exit ? (until - time) / exit.duration : 1, context, resolveTime);
    return {
      context,
      opacity: time >= from && time <= until ? a.opacity * b.opacity : 0,
      clip: a.clip !== 'none' ? a.clip : b.clip,
    };
  };
  const render = () => {
    if (disposed) return;
    if (scene.hasAmbient && !releaseAmbient) releaseAmbient = player._acquireAmbient?.() ?? null;
    const time = player.time,
      state = sample(time),
      weight = state.opacity;
    if (shaped) {
      const css = element.ownerDocument?.defaultView?.CSS;
      assert(
        !css?.supports || css.supports('clip-path', state.clip),
        'RENDER_UNSUPPORTED',
        'This browser does not support the requested CSS layer clip.',
      );
    }
    if (weight > 0)
      renderer.render(
        scene.sample({ time: Math.max(0, Math.min(scene.duration, time - from + offset)), ...state.context }),
      );
    element.style.display = weight > 0 ? saved.display : 'none';
    element.style.opacity = String(weight);
    if (shaped) element.style.clipPath = state.clip;
    if (z !== undefined) {
      element.style.zIndex = String(z);
      const position =
        element.ownerDocument?.defaultView?.getComputedStyle?.(element).position ?? element.style.position;
      if (!position || position === 'static') element.style.position = 'relative';
    }
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    unframe();
    unend();
    unchange();
    releaseAmbient?.();
    leases.delete(renderer);
    leases.delete(element);
    counts.set(player, counts.get(player) - 1);
    const index = registered.indexOf(record);
    if (index >= 0) registered.splice(index, 1);
    for (const item of extra) {
      if (item.value !== undefined) {
        if (element.style.setProperty) element.style.setProperty(cssNames[item.key], item.value, item.priority);
        else element.style[item.key] = item.value;
      } else if (item.own) element.style[item.key] = '';
      else delete element.style[item.key];
    }
    if (element.style.setProperty) {
      element.style.setProperty('display', saved.display, savedPriority.display);
      element.style.setProperty('opacity', saved.opacity, savedPriority.opacity);
    } else {
      element.style.display = saved.display;
      element.style.opacity = saved.opacity;
    }
    if (spec.ownRenderer !== false) renderer.dispose();
  };
  leases.set(renderer, true);
  leases.set(element, true);
  counts.set(player, (counts.get(player) ?? 0) + 1);
  registered.push(record);
  layers.set(player, registered);
  try {
    render();
    unframe = player.on('frame', render);
    unend = player.on('dispose', dispose);
    unchange = scene.onChange?.(render) ?? (() => {});
  } catch (error) {
    dispose();
    throw error;
  }
  return Object.freeze({
    get disposed() {
      return disposed;
    },
    refresh: render,
    dispose,
  });
}
