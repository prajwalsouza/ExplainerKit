import { assert, number, options } from '../core/validate.js';
import { Scene } from '../core/scene.js';
import { character, compileCharacter } from './runtime.js';
import { auditCharacter } from './audit.js';
import { restBounds } from './staging.js';
import { rgbaOf } from '../graphics/cloud.js';

/** Clone a raw definition with costume edits; compile transactionally before returning.
 * @param {any} definition
 * @param {{name?:string,palette?:Record<string,string|{base:string,shade:string,light:string}>,add?:any[],remove?:string[]}} [spec]
 */
export function restyle(definition, spec = {}) {
  options(spec, ['name', 'palette', 'add', 'remove'], 'restyle');
  assert(
    definition && !definition.order,
    'INVALID_CHARACTER',
    'restyle takes a raw definition, before compileCharacter.',
  );
  const remove = spec.remove ?? [],
    add = spec.add ?? [],
    palette = spec.palette ?? {};
  assert(
    Array.isArray(remove) &&
      remove.length <= 1024 &&
      remove.every((id) => typeof id === 'string') &&
      new Set(remove).size === remove.length,
    'INVALID_CHARACTER',
    'remove needs distinct part IDs.',
  );
  assert(Array.isArray(add) && add.length <= 1024, 'RESOURCE_LIMIT', 'Add at most 1024 costume parts.');
  const known = new Set(definition.parts.map((p) => p.id));
  assert(
    remove.every((id) => known.has(id)),
    'INVALID_CHARACTER',
    'Cannot remove an unknown costume part.',
  );
  const tones = Object.fromEntries(
    Object.entries(palette).map(([slot, value]) => {
      const tone = typeof value === 'string' ? { base: value, shade: value, light: value } : { ...value };
      options(tone, ['base', 'shade', 'light'], 'palette tone');
      for (const c of ['base', 'shade', 'light']) rgbaOf(tone[c]);
      return [slot, Object.freeze(tone)];
    }),
  );
  const gone = new Set(remove),
    parts = [...definition.parts.filter((p) => !gone.has(p.id)).map((p) => ({ ...p })), ...add.map((p) => ({ ...p }))];
  const result = {
    ...definition,
    name: spec.name ?? definition.name,
    palette: { ...definition.palette, ...tones },
    parts,
    joints: definition.joints
      ?.filter((j) => !gone.has(j.part))
      .map((j) => ({ ...j, to: j.to.filter((id) => !gone.has(id)) }))
      .filter((j) => j.to.length),
    contacts: definition.contacts?.filter((id) => !gone.has(id)),
  };
  compileCharacter(result);
  return Object.freeze(result);
}

/** Original scene per character/action for renderers or contact-sheet tooling; no DOM ownership.
 * @param {any[]} definitions
 * @param {{actions?:string[],at?:number,width?:number,height?:number,audit?:boolean,fps?:number}} [spec]
 */
export function contactSheet(definitions, spec = {}) {
  options(spec, ['actions', 'at', 'width', 'height', 'audit', 'fps'], 'contact sheet');
  assert(
    Array.isArray(definitions) && definitions.length > 0 && definitions.length <= 64,
    'RESOURCE_LIMIT',
    'Contact sheet takes 1–64 definitions.',
  );
  const at = number(spec.at ?? 0.8, 'contact sheet time', 0, 60),
    width = number(spec.width ?? 240, 'cell width', 32, 2048),
    height = number(spec.height ?? 280, 'cell height', 32, 2048);
  assert(spec.audit === undefined || typeof spec.audit === 'boolean', 'INVALID_CHARACTER', 'audit is boolean.');
  const cells = [];
  for (const source of definitions) {
    const def = source.order ? source : compileCharacter(source),
      actions = spec.actions ?? ['rest', ...Object.keys(def.actions).filter((k) => !k.startsWith('__'))];
    assert(
      Array.isArray(actions) &&
        actions.length > 0 &&
        actions.length <= 32 &&
        actions.every((k) => k === 'rest' || typeof def.actions[k] === 'function'),
      'UNKNOWN_ACTION',
      'Contact sheet actions must exist on every definition.',
    );
    const badge = spec.audit
      ? auditCharacter(def, {
          actions: actions.filter((k) => k !== 'rest'),
          fps: spec.fps ?? 12,
          duration: Math.max(1, at),
        })
      : null;
    for (const action of actions) {
      const scene = new Scene({ width, height, duration: Math.max(2, at) }),
        bounds = restBounds(def),
        size = Math.min((width * 0.7) / bounds.width, (height * 0.7) / bounds.height),
        actor = character(scene, def, { x: width / 2, y: height * 0.88, size, idle: false });
      if (action !== 'rest') actor.act(action, { at: 0, duration: Math.max(2, at) });
      cells.push(
        Object.freeze({ name: def.name, action, scene, actor, time: at, frame: scene.sample({ time: at }), badge }),
      );
    }
  }
  return Object.freeze({ width, height, cells: Object.freeze(cells) });
}
