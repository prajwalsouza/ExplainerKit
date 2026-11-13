import { Parameter } from '../core/data.js';
import { assert, number, options } from '../core/validate.js';

/** Capture controller descriptions and preflight before allocating scene state. */
export function prepareGoalDriver(scene, model, input, solver = {}) {
  options(
    solver,
    ['iterations', 'restarts', 'tolerance', 'angleTolerance', 'priorityTolerance', 'unreachable'],
    'goal solver',
  );
  const settings = { ...solver };
  assert(Array.isArray(input) && input.length > 0 && input.length <= 16, 'RESOURCE_LIMIT', 'Use 1–16 scene rig goals.');
  const templates = [],
    controlNames = ['stretch', 'compress', 'softness'];
  function capture(value, label) {
    if (value instanceof Parameter) {
      assert(scene._ownsParameter(value), 'INVALID_BINDING', `${label} must use a parameter owned by this scene.`);
      return value;
    }
    return number(value, label, -2e6, 2e6);
  }
  function point(value, label) {
    options(value, ['x', 'y'], label);
    return Object.freeze({ x: capture(value.x, `${label} x`), y: capture(value.y, `${label} y`) });
  }
  for (let i = 0; i < input.length; i++) {
    const d = Object.getOwnPropertyDescriptor(input, i);
    assert(d && 'value' in d, 'INVALID_GOAL', 'Goal arrays must be dense values without accessors.');
    const g = d.value;
    options(
      g,
      [
        'id',
        'end',
        'target',
        'rotation',
        'weight',
        'rotationWeight',
        'priority',
        'chainRoot',
        'pole',
        'poleWeight',
        ...controlNames,
      ],
      'scene goal',
    );
    const template = { ...g };
    if (g.target !== undefined) template.target = point(g.target, 'target');
    if (g.pole !== undefined) template.pole = point(g.pole, 'pole');
    if (g.rotation !== undefined) template.rotation = capture(g.rotation, 'goal rotation');
    for (const name of controlNames) if (g[name] !== undefined) template[name] = capture(g[name], 'goal ' + name);
    templates.push(Object.freeze(template));
  }
  // Scene bindings preflight at authored time zero. A parameter's stored value
  // can differ from an already authored track at that time.
  const value = (v) => (v instanceof Parameter ? v.sample(0) : v);
  const resolve = (g) => ({
    ...g,
    ...(g.target ? { target: { x: value(g.target.x), y: value(g.target.y) } } : {}),
    ...(g.pole ? { pole: { x: value(g.pole.x), y: value(g.pole.y) } } : {}),
    ...(g.rotation !== undefined ? { rotation: value(g.rotation) } : {}),
    ...Object.fromEntries(controlNames.filter((name) => g[name] !== undefined).map((name) => [name, value(g[name])])),
  });
  model.solveGoals({ goals: templates.map(resolve), ...settings });
  // Pairing with normalized result IDs ensures defaults agree with the numerical API.
  const initialIds = templates.map((g, i) => g.id ?? `goal-${i + 1}`);
  return Object.freeze({
    create(fk) {
      const param = (v, rotation = false) =>
        v instanceof Parameter ? v : scene.parameter(v, { min: rotation ? -1e4 : -2e6, max: rotation ? 1e4 : 2e6 });
      const controllers = templates.map((g, i) =>
        Object.freeze({
          ...g,
          id: initialIds[i],
          ...(g.target ? { target: Object.freeze({ x: param(g.target.x), y: param(g.target.y) }) } : {}),
          ...(g.pole ? { pole: Object.freeze({ x: param(g.pole.x), y: param(g.pole.y) }) } : {}),
          ...(g.rotation !== undefined ? { rotation: param(g.rotation, true) } : {}),
          ...Object.fromEntries(
            controlNames
              .filter((name) => g[name] !== undefined)
              .map((name) => [
                name,
                g[name] instanceof Parameter
                  ? g[name]
                  : scene.parameter(g[name], {
                      min: name === 'stretch' ? 1 : name === 'compress' ? 0.25 : 0,
                      max: name === 'stretch' ? 4 : name === 'compress' ? 1 : 2e6,
                    }),
              ]),
          ),
        }),
      );
      const inputs = [fk];
      for (const g of controllers) {
        if (g.target) inputs.push(g.target.x, g.target.y);
        if (g.pole) inputs.push(g.pole.x, g.pole.y);
        if (g.rotation !== undefined) inputs.push(g.rotation);
        for (const name of controlNames) if (g[name] !== undefined) inputs.push(g[name]);
      }
      const solution = scene.derive(inputs, (...values) => {
        const from = values[0];
        let i = 1;
        const goals = controllers.map((g) => {
          const result = { ...g };
          if (g.target) result.target = { x: values[i++], y: values[i++] };
          if (g.pole) result.pole = { x: values[i++], y: values[i++] };
          if (g.rotation !== undefined) result.rotation = values[i++];
          for (const name of controlNames) if (g[name] !== undefined) result[name] = values[i++];
          return result;
        });
        return model.solveGoals({ goals, from, ...settings });
      });
      return Object.freeze({ goals: Object.freeze(controllers), solution });
    },
  });
}
