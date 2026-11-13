import { assert, number } from '../core/validate.js';

const COMMAND_SIZES = Object.freeze({ M: 3, L: 3, Q: 5, C: 7, Z: 1 });

/** Bound and validate the narrow numeric schema before the general-purpose data copier. */
export function preflightNetwork(input) {
  let values = 0,
    bytes = 0;
  function charge(size = 8) {
    values++;
    bytes += size;
    assert(
      values <= 400000 && bytes <= 2 * 1024 * 1024,
      'RESOURCE_LIMIT',
      'Network input exceeds its aggregate value or two-megabyte payload budget.',
    );
  }
  function keys(value, maximum) {
    const names = Reflect.ownKeys(value);
    assert(names.length <= maximum, 'RESOURCE_LIMIT', 'Network input has too many properties.');
    for (const key of names) {
      assert(typeof key === 'string' && key.length <= 64, 'RESOURCE_LIMIT', 'Network keys must be short strings.');
      charge(key.length * 2);
    }
    return names;
  }
  function array(value, maximum) {
    assert(Array.isArray(value), 'PROCEDURAL_REGION', 'Use dense arrays for network paths, coordinates and edges.');
    assert(value.length <= maximum, 'RESOURCE_LIMIT', 'Network array exceeds its structural limit.');
    charge(16);
    assert(
      keys(value, value.length + 1).length === value.length + 1,
      'INVALID_DATA',
      'Network arrays must be dense without extra properties.',
    );
    return Array.from({ length: value.length }, (_, i) => {
      const d = Object.getOwnPropertyDescriptor(value, i);
      assert(d && 'value' in d, 'INVALID_DATA', 'Network arrays must contain owned data values, not accessors.');
      charge();
      return d.value;
    });
  }
  function record(value, allowed) {
    assert(
      value && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null),
      'INVALID_DATA',
      'Network nodes and graphs must be plain data records.',
    );
    charge(16);
    const result = Object.create(null);
    for (const key of keys(value, allowed.length)) {
      assert(allowed.includes(key), 'UNKNOWN_OPTION', `Unknown network field ${key}.`);
      const d = Object.getOwnPropertyDescriptor(value, key);
      assert(d && d.enumerable && 'value' in d, 'INVALID_DATA', 'Network fields must be enumerable data values.');
      result[key] = d.value;
    }
    return result;
  }
  function coordinate(value) {
    charge();
    number(value, 'network coordinate');
  }
  function commandPath(value) {
    const commands = array(value, 8192);
    for (const command of commands) {
      const parts = array(command, 7),
        op = parts[0];
      assert(
        typeof op === 'string' && op.length === 1 && Object.hasOwn(COMMAND_SIZES, op),
        'PROCEDURAL_REGION',
        'Network paths use single-character M/L/Q/C/Z commands.',
      );
      charge(2);
      assert(
        parts.length === COMMAND_SIZES[op],
        'PROCEDURAL_REGION',
        'Network path command has the wrong coordinate count.',
      );
      for (const component of parts.slice(1)) coordinate(component);
    }
  }
  if (Array.isArray(input)) {
    const outer = array(input, 8192);
    assert(outer.length > 0 && Array.isArray(outer[0]), 'PROCEDURAL_REGION', 'Supply paths or path commands.');
    const marker = Object.getOwnPropertyDescriptor(outer[0], '0');
    assert(marker && 'value' in marker, 'INVALID_DATA', 'Network paths do not accept accessor commands.');
    if (typeof marker.value === 'string') commandPath(input);
    else {
      assert(outer.length <= 2048, 'RESOURCE_LIMIT', 'Use at most 2048 network paths.');
      for (const path of outer) commandPath(path);
    }
  } else {
    const graph = record(input, ['nodes', 'edges']);
    const nodes = array(graph.nodes, 10000),
      edges = array(graph.edges, 10000);
    for (const node of nodes) {
      const pair = Array.isArray(node) ? array(node, 2) : Object.values(record(node, ['x', 'y']));
      assert(pair.length === 2, 'PROCEDURAL_REGION', 'Network nodes need exactly x and y.');
      for (const value of pair) coordinate(value);
    }
    for (const edge of edges) {
      const pair = array(edge, 2);
      assert(pair.length === 2, 'PROCEDURAL_REGION', 'Network edges need two node indices.');
      for (const index of pair) {
        charge();
        assert(
          Number.isInteger(index) && index >= 0 && index < nodes.length,
          'PROCEDURAL_REGION',
          'Network edge indices must identify nodes.',
        );
      }
    }
  }
}
