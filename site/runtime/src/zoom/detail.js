import { assert, number, options, safeCopy } from '../core/validate.js';
import { Parameter } from '../core/data.js';
import { Derived } from '../core/scene.js';

/** A deterministic size-on-screen selector; thresholds and fades are CSS pixels. */
export function detailLevels(input, spec = {}) {
  options(spec, ['fade'], 'detail levels');
  assert(Array.isArray(input) && input.length > 0 && input.length <= 32, 'RESOURCE_LIMIT', 'Use 1–32 detail levels.');
  const fade = number(spec.fade ?? 0, 'detail crossfade width', 0, 1e6),
    levels = [];
  let previous = 0;
  for (let i = 0; i < input.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, i);
    assert(descriptor && 'value' in descriptor, 'INVALID_DETAIL', 'Detail levels must be dense values.');
    const item = descriptor.value;
    options(item, ['below', 'draw'], 'detail level');
    const below = item.below === undefined ? Infinity : number(item.below, 'detail threshold', Number.MIN_VALUE, 1e7);
    assert(i === input.length - 1 || Number.isFinite(below), 'INVALID_DETAIL', 'Only the final level can omit below.');
    assert(below > previous, 'INVALID_DETAIL', 'Detail thresholds must strictly increase.');
    assert(item.draw !== undefined, 'INVALID_DETAIL', 'Each level needs drawing data or a trusted factory.');
    if (Number.isFinite(below))
      assert(
        fade === 0 || below - previous >= fade,
        'INVALID_DETAIL',
        'Crossfade bands must not overlap or cross size zero.',
      );
    levels.push(Object.freeze({ below, draw: typeof item.draw === 'function' ? item.draw : safeCopy(item.draw) }));
    previous = below;
  }
  assert(
    levels.at(-1).below === Infinity,
    'INVALID_DETAIL',
    'The final detail level must omit below to cover large sizes.',
  );
  return Object.freeze({
    levels: Object.freeze(levels),
    fade,
    sample(extent) {
      number(extent, 'screen extent', 0, 1e150);
      let chosen = levels.findIndex((level) => extent < level.below);
      if (chosen < 0) chosen = levels.length - 1;
      if (fade)
        for (let i = 0; i < levels.length - 1; i++) {
          const edge = levels[i].below,
            start = edge - fade / 2,
            end = edge + fade / 2;
          if (extent >= start && extent <= end) {
            const t = (extent - start) / fade;
            return Object.freeze({
              extent,
              selected: t < 0.5 ? i : i + 1,
              weights: Object.freeze(levels.map((_, j) => (j === i ? 1 - t : j === i + 1 ? t : 0))),
            });
          }
        }
      return Object.freeze({
        extent,
        selected: chosen,
        weights: Object.freeze(levels.map((_, i) => (i === chosen ? 1 : 0))),
      });
    },
  });
}

/** Compile each detail drawing once; bind only wrapper opacity during sampling. */
export function detail(scene, spec = {}) {
  options(spec, ['levels', 'extent', 'fade'], 'scene detail');
  assert(scene && typeof scene.component === 'function', 'INVALID_DETAIL', 'Use an ExplainerKit scene.');
  assert(scene._ownsInput(spec.extent), 'INVALID_BINDING', 'Detail extent must be an input owned by this scene.');
  const selector = detailLevels(spec.levels, { fade: spec.fade ?? 0 }),
    extent =
      spec.extent instanceof Parameter
        ? spec.extent.sample(0)
        : spec.extent instanceof Derived
          ? spec.extent.sample(scene._context())
          : null;
  selector.sample(extent);
  const children = Object.create(null);
  selector.levels.forEach((level, i) => {
    let blueprint;
    try {
      blueprint = typeof level.draw === 'function' ? level.draw() : level.draw;
    } catch (cause) {
      const e = new Error('A trusted detail drawing factory failed.');
      e.code = 'DETAIL_BUILD_FAILED';
      e.cause = cause;
      throw e;
    }
    children[`level${i}`] = { type: 'group', children: { art: blueprint } };
  });
  const component = scene.component({ type: 'group', children });
  function count(node) {
    return 1 + Object.values(node.children).reduce((n, child) => n + count(child), 0);
  }
  scene._capacity(count(component.definition));
  return scene._batch(() => {
    const choice = scene.derive([spec.extent], (value) => selector.sample(value)),
      group = scene.instance(component);
    selector.levels.forEach((_, i) =>
      group.part(`level${i}`).bind('opacity', { inputs: [choice], map: (selection) => selection.weights[i] }),
    );
    return Object.freeze({
      group,
      choice,
      selector,
      levels: Object.freeze(selector.levels.map((_, i) => group.part(`level${i}.art`))),
    });
  });
}
