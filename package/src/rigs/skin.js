import { assert, number, options, safeCopy } from '../core/validate.js';
import { validateProperty } from '../core/geometry.js';

/** Linear blend skinning of absolute path points/control points, in skeleton space. */
export function bindSkin(model, spec = {}) {
  options(spec, ['commands', 'weights', 'rest', 'normalize'], 'skin');
  const rest = spec.rest ?? model.pose();
  model.socket(rest, model.bones[0].id);
  const commands = validateProperty('path', 'commands', safeCopy(spec.commands)),
    raw = safeCopy(spec.weights);
  const count = commands.reduce((n, c) => n + (c.length - 1) / 2, 0);
  assert(count > 0 && count <= 10000, 'RESOURCE_LIMIT', 'A skin supports 1–10000 coordinate pairs.');
  assert(
    Array.isArray(raw) && raw.length === count,
    'INVALID_SKIN',
    'Provide one influence list per path coordinate pair, including curve controls.',
  );
  const normalize = spec.normalize ?? false;
  assert(typeof normalize === 'boolean', 'INVALID_SKIN', 'normalize must be boolean.');
  const ids = new Set(model.bones.map((b) => b.id));
  const weights = Object.freeze(
    raw.map((list) => {
      assert(
        Array.isArray(list) && list.length > 0 && list.length <= 4,
        'INVALID_SKIN',
        'Each coordinate pair needs 1–4 influences.',
      );
      const seen = new Set(),
        values = list.map((v) => {
          options(v, ['bone', 'weight'], 'influence');
          assert(ids.has(v.bone) && !seen.has(v.bone), 'INVALID_SKIN', 'Influences need distinct known bone names.');
          seen.add(v.bone);
          return { bone: v.bone, weight: number(v.weight, 'skin weight', 0, 1e6) };
        });
      const total = values.reduce((s, v) => s + v.weight, 0);
      assert(
        total > 0 && (normalize || Math.abs(total - 1) <= 1e-9),
        'INVALID_SKIN',
        'Weights must sum to one, or request normalization.',
      );
      return Object.freeze(values.map((v) => Object.freeze({ ...v, weight: v.weight / total })));
    }),
  );
  return Object.freeze({
    rest,
    weights,
    diagnostics: Object.freeze({ method: 'linearBlend', points: count, maxInfluences: 4, preservesRigidity: false }),
    sample(pose, sampleSpec = {}) {
      // Binding callbacks receive the evaluation context after their inputs.
      // Keep the existing direct `map: skin.sample` contract while accepting
      // explicit rest-space commands from callers who apply shape keys.
      const context =
        sampleSpec !== null &&
        typeof sampleSpec === 'object' &&
        Object.hasOwn(sampleSpec, 'time') &&
        !Object.hasOwn(sampleSpec, 'commands');
      options(
        sampleSpec,
        context ? ['time', 'width', 'height', 'effects', 'ambient', 'displayWidth'] : ['commands'],
        'skin sample',
      );
      const input =
        context || sampleSpec.commands === undefined
          ? commands
          : validateProperty('path', 'commands', safeCopy(sampleSpec.commands));
      assert(
        input.length === commands.length &&
          input.every((c, i) => c.length === commands[i].length && c[0] === commands[i][0]),
        'SKIN_TOPOLOGY',
        'Dynamic rest-space commands must preserve the bound skin command topology.',
      );
      model.socket(pose, model.bones[0].id);
      const transforms = new Map();
      for (const b of pose.bones) {
        const a = rest.bones.find((v) => v.id === b.id),
          rotation = b.rotation - a.rotation,
          c = Math.cos(rotation),
          s = Math.sin(rotation),
          ratio = b.length / a.length;
        let xx = c,
          xy = -s,
          yx = s,
          yy = c;
        if (ratio !== 1) {
          const ca = Math.cos(a.rotation),
            sa = Math.sin(a.rotation),
            cb = Math.cos(b.rotation),
            sb = Math.sin(b.rotation);
          xx = cb * ratio * ca + sb * sa;
          xy = cb * ratio * sa - sb * ca;
          yx = sb * ratio * ca - cb * sa;
          yy = sb * ratio * sa + cb * ca;
        }
        transforms.set(b.id, {
          xx,
          xy,
          yx,
          yy,
          x: b.start.x - xx * a.start.x - xy * a.start.y,
          y: b.start.y - yx * a.start.x - yy * a.start.y,
        });
      }
      let index = 0;
      const output = input.map((command) => {
        const result = [command[0]];
        for (let i = 1; i < command.length; i += 2) {
          let x = 0,
            y = 0;
          for (const w of weights[index++]) {
            const t = transforms.get(w.bone);
            x += w.weight * (t.xx * command[i] + t.xy * command[i + 1] + t.x);
            y += w.weight * (t.yx * command[i] + t.yy * command[i + 1] + t.y);
          }
          result.push(x, y);
        }
        return result;
      });
      return validateProperty('path', 'commands', output);
    },
  });
}
