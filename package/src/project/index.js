import { Scene } from '../core/scene.js';
import { character, starter } from '../characters/index.js';
import { assert, number, options, safeCopy, text, KitError } from '../core/validate.js';

const FORMAT = 'explainerkit-project';
const lists = ['parameters', 'data', 'components', 'nodes', 'bindings', 'tracks', 'characters', 'assets'];
function capture(input) {
  let document = safeCopy(input);
  options(document, ['format', 'version', 'scene', ...lists, 'inputs', 'metadata'], 'project document');
  assert(document.format === FORMAT, 'PROJECT_FORMAT', 'Use an explainerkit-project JSON document.');
  assert(
    document.version === 0 || document.version === 1,
    'PROJECT_VERSION',
    'This reader supports project versions 0 and 1; migrate newer documents explicitly.',
  );
  if (document.version === 0) {
    const migrated = JSON.parse(JSON.stringify(document));
    assert(
      !migrated.parameters || !migrated.inputs,
      'PROJECT_MIGRATION',
      'Version 0 cannot define both inputs and parameters.',
    );
    migrated.parameters = migrated.parameters ?? migrated.inputs ?? [];
    delete migrated.inputs;
    migrated.version = 1;
    document = safeCopy(migrated);
  } else assert(document.inputs === undefined, 'PROJECT_VERSION', 'Version 1 uses parameters, not inputs.');
  for (const key of lists)
    assert(
      document[key] === undefined || (Array.isArray(document[key]) && document[key].length <= 1000),
      'RESOURCE_LIMIT',
      `Project ${key} must be an array with at most 1000 records.`,
    );
  options(
    document.scene ?? {},
    ['width', 'height', 'renderer', 'label', 'description', 'maxNodes', 'duration'],
    'project scene',
  );
  return document;
}
function index(records = [], label) {
  const map = new Map();
  for (const record of records) {
    assert(
      record && typeof record === 'object' && !Array.isArray(record),
      'PROJECT_RECORD',
      `Each ${label} must be a plain record with an ID.`,
    );
    text(record.id, `${label} ID`, 200);
    assert(record.id && !map.has(record.id), 'DUPLICATE_ID', `${label} IDs must be unique nonempty text.`);
    map.set(record.id, record);
  }
  return map;
}
function requireRef(map, id, label) {
  assert(map.has(id), 'PROJECT_REFERENCE', `Unknown ${label}: ${id}. Repair the project reference.`);
  return map.get(id);
}

/** Compile a bounded, declarative project recipe. Never evaluates code or fetches assets. */
export function buildProject(input) {
  const document = capture(input),
    scene = new Scene(document.scene ?? {});
  const parameters = new Map(),
    data = new Map(),
    components = new Map(),
    nodes = new Map(),
    characters = new Map();
  const assets = index(document.assets, 'asset');
  for (const asset of assets.values()) {
    options(asset, ['id', 'uri', 'mime', 'integrity'], 'asset reference');
    text(asset.uri, 'asset URI', 2000);
    let url;
    try {
      url = new URL(asset.uri, 'https://project.invalid/');
    } catch {
      throw new KitError('PROJECT_ASSET_UNSAFE', 'Use a relative or HTTP(S) asset reference.');
    }
    assert(
      ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password,
      'PROJECT_ASSET_UNSAFE',
      'Use credential-free relative or HTTP(S) asset references.',
    );
    if (asset.mime !== undefined) text(asset.mime, 'asset MIME', 100);
    if (asset.integrity !== undefined) text(asset.integrity, 'asset integrity', 200);
  }
  for (const [id, p] of index(document.parameters, 'parameter')) {
    options(p, ['id', 'value', 'min', 'max'], 'project parameter');
    parameters.set(id, scene.parameter(p.value, { min: p.min, max: p.max }));
  }
  for (const [id, value] of index(document.data, 'data')) {
    options(value, ['id', 'rows', 'key', 'maxRows'], 'project data');
    data.set(id, scene.data(value.rows, { key: value.key, maxRows: value.maxRows }));
  }
  for (const [id, component] of index(document.components, 'component')) {
    options(component, ['id', 'definition'], 'project component');
    components.set(id, scene.component(component.definition));
  }
  const nodeSpecs = index(document.nodes, 'node');
  for (const [id, node] of nodeSpecs) {
    options(node, ['id', 'type', 'component', 'props', 'parent'], 'project node');
    assert(
      Boolean(node.type) !== Boolean(node.component),
      'PROJECT_NODE',
      'Declare exactly one node type or component reference.',
    );
    const handle = node.component
      ? scene.instance(requireRef(components, node.component, 'component'))
      : scene.shape(node.type, node.props ?? {});
    if (node.component && node.props) handle.set(node.props);
    nodes.set(id, handle);
  }
  // Validate ancestry independently before adopting any handle.
  for (const [id, node] of nodeSpecs) {
    const ancestors = new Set([id]);
    let parent = node.parent;
    while (parent !== undefined) {
      assert(!ancestors.has(parent), 'PROJECT_CYCLE', 'Project node parents must form an acyclic hierarchy.');
      ancestors.add(parent);
      parent = requireRef(nodeSpecs, parent, 'parent node').parent;
    }
  }
  for (const [id, node] of nodeSpecs)
    if (node.parent !== undefined) requireRef(nodes, node.parent, 'parent node').add(nodes.get(id));
  for (const binding of document.bindings ?? []) {
    options(binding, ['node', 'property', 'parameter', 'scale', 'offset'], 'project binding');
    const handle = requireRef(nodes, binding.node, 'binding node'),
      parameter = requireRef(parameters, binding.parameter, 'binding parameter');
    const scale = number(binding.scale ?? 1, 'binding scale'),
      offset = number(binding.offset ?? 0, 'binding offset');
    handle.bind(binding.property, { inputs: [parameter], map: (value) => value * scale + offset });
  }
  for (const track of document.tracks ?? []) {
    options(track, ['target', 'property', 'keys'], 'project track');
    text(track.target, 'track target', 250);
    if (track.target.startsWith('parameter:')) {
      assert(track.property === undefined, 'PROJECT_TRACK', 'Parameter tracks have no property name.');
      requireRef(parameters, track.target.slice(10), 'track parameter').keys(track.keys);
    } else {
      assert(track.target.startsWith('node:'), 'PROJECT_TRACK', 'Use node:ID or parameter:ID for track targets.');
      requireRef(nodes, track.target.slice(5), 'track node').keys(track.property, track.keys);
    }
  }
  for (const [id, value] of index(document.characters, 'character')) {
    options(value, ['id', 'starter', 'options', 'actions', 'speech'], 'project character');
    const actor = character(scene, starter(value.starter), value.options ?? {});
    assert(
      value.actions === undefined || (Array.isArray(value.actions) && value.actions.length <= 1000),
      'RESOURCE_LIMIT',
      'Use at most 1000 character action clips.',
    );
    for (const action of value.actions ?? []) {
      assert(action && typeof action === 'object', 'PROJECT_CLIP', 'Use a named action clip record.');
      const { name, ...spec } = action;
      actor.act(name, spec);
    }
    assert(
      value.speech === undefined || (Array.isArray(value.speech) && value.speech.length <= 1000),
      'RESOURCE_LIMIT',
      'Use at most 1000 speech clips.',
    );
    for (const speech of value.speech ?? []) {
      options(speech, ['text', 'at', 'rate'], 'project speech');
      actor.say(speech.text, { at: speech.at, rate: speech.rate });
    }
    characters.set(id, actor);
  }
  scene.sample({ time: 0 });
  return Object.freeze({ document, scene, parameters, data, components, nodes, characters, assets });
}

export function parseProject(json) {
  text(json, 'project JSON', 8_000_000);
  let input;
  try {
    input = JSON.parse(json);
  } catch {
    throw new KitError('PROJECT_JSON', 'Project is not valid JSON.');
  }
  return buildProject(input).document;
}
export function serializeProject(document) {
  const json = JSON.stringify(buildProject(document).document, null, 2);
  text(json, 'project JSON', 8_000_000);
  return json + '\n';
}

/** Transactional recipe history. Runtime resources are rebuilt explicitly, outside history. */
export function createProject(input, spec = {}) {
  options(spec, ['historyLimit'], 'project history');
  const limit = number(spec.historyLimit ?? 100, 'history limit', 1, 1000);
  assert(Number.isInteger(limit), 'PROJECT_HISTORY', 'History limit must be a whole number.');
  let document = buildProject(input).document,
    past = [],
    future = [],
    editing = false;
  const live = () => assert(!editing, 'PROJECT_EDIT_ACTIVE', 'Project history cannot be reentered during an edit.');
  return Object.freeze({
    get snapshot() {
      return document;
    },
    get canUndo() {
      return past.length > 0;
    },
    get canRedo() {
      return future.length > 0;
    },
    edit(mutator) {
      live();
      assert(typeof mutator === 'function', 'PROJECT_EDIT', 'Supply a synchronous draft editor.');
      const draft = JSON.parse(JSON.stringify(document));
      editing = true;
      try {
        const result = mutator(draft);
        assert(!result || typeof result.then !== 'function', 'PROJECT_EDIT', 'Async project edits are unsupported.');
        const next = buildProject(draft).document;
        past = [...past, document].slice(-limit);
        document = next;
        future = [];
        return document;
      } finally {
        editing = false;
      }
    },
    undo() {
      live();
      if (!past.length) return false;
      future.push(document);
      document = past.pop();
      return true;
    },
    redo() {
      live();
      if (!future.length) return false;
      past.push(document);
      document = future.pop();
      return true;
    },
    build() {
      live();
      return buildProject(document);
    },
    serialize() {
      return serializeProject(document);
    },
  });
}
