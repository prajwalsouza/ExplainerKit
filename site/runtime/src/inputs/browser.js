import { assert, number, options, text, safeCopy, KitError } from '../core/validate.js';
import { managedSource } from './source.js';
const sourceKeys = ['id', 'kind', 'unit', 'space', 'maxSamples', 'maxAge', 'clock'];
function config(spec, extra = [], defaults = {}) {
  options(spec, [...sourceKeys, 'environment', ...extra], 'browser input');
  const injected = spec.environment;
  return {
    source: {
      ...defaults,
      ...Object.fromEntries(sourceKeys.filter((k) => spec[k] !== undefined).map((k) => [k, spec[k]])),
    },
    environment: () => injected ?? globalThis,
  };
}
const unsupported = (message) => {
  throw new KitError('INPUT_UNSUPPORTED', message);
};
function listen(target, name, callback, cleanups) {
  assert(
    target && typeof target.addEventListener === 'function' && typeof target.removeEventListener === 'function',
    'INPUT_UNSUPPORTED',
    'Use an event-capable browser target.',
  );
  target.addEventListener(name, callback);
  cleanups.push(() => target.removeEventListener(name, callback));
}
const cleanupAll = (cleanups) => () => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
};
const nullable = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
export function pointerInput(element, spec = {}) {
  const c = config(spec, [], { kind: 'state', unit: 'px', space: 'element', maxAge: 86400 });
  return managedSource(c.source, (ctx) => {
    const cleanups = [],
      environment = c.environment();
    let last = { x: 0, y: 0, nx: 0, ny: 0, buttons: 0, pressure: 0, pointerType: 'unknown', active: false };
    assert(
      typeof element?.getBoundingClientRect === 'function',
      'INPUT_UNSUPPORTED',
      'Pointer input needs an element with bounds.',
    );
    const update = (event) => {
      if (!ctx.isCurrent()) return;
      if (['pointercancel', 'pointerleave'].includes(event.type)) {
        last = { ...last, active: false, buttons: 0, pressure: 0 };
        ctx.emit(last);
        return;
      }
      const box = element.getBoundingClientRect(),
        x = nullable(event.clientX),
        y = nullable(event.clientY);
      if (x === null || y === null) return;
      const width = nullable(box.width),
        height = nullable(box.height);
      if (width === null || height === null || width <= 0 || height <= 0) return;
      const px = x - box.left,
        py = y - box.top;
      last = {
        x: px,
        y: py,
        nx: px / width,
        ny: py / height,
        buttons: nullable(event.buttons) ?? 0,
        pressure: nullable(event.pressure) ?? 0,
        pointerType: typeof event.pointerType === 'string' ? event.pointerType.slice(0, 32) : 'unknown',
        active: event.type !== 'pointerup' && event.type !== 'pointercancel' && event.type !== 'pointerleave',
      };
      ctx.emit(last);
    };
    try {
      for (const name of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerleave'])
        listen(element, name, update, cleanups);
      listen(
        environment,
        'blur',
        () => {
          if (ctx.isCurrent()) {
            last = { ...last, active: false, buttons: 0, pressure: 0 };
            ctx.emit(last);
          }
        },
        cleanups,
      );
    } catch (error) {
      cleanupAll(cleanups)();
      throw error;
    }
    return cleanupAll(cleanups);
  });
}
export function resizeInput(element, spec = {}) {
  const c = config(spec, [], { kind: 'state', unit: 'px', space: 'element', maxAge: 86400 });
  return managedSource(c.source, (ctx) => {
    const ResizeObserver = c.environment().ResizeObserver;
    if (typeof ResizeObserver !== 'function') unsupported('ResizeObserver is unavailable.');
    assert(
      element && typeof element.getBoundingClientRect === 'function',
      'INPUT_UNSUPPORTED',
      'Resize input needs an element.',
    );
    const observer = new ResizeObserver((entries) => {
      if (!ctx.isCurrent()) return;
      for (const entry of entries) {
        if (entry.target !== element) continue;
        const rect = entry.contentRect,
          w = nullable(rect?.width),
          h = nullable(rect?.height);
        if (w !== null && h !== null) ctx.emit({ width: w, height: h });
      }
    });
    try {
      observer.observe(element);
    } catch (error) {
      observer.disconnect();
      throw error;
    }
    return () => observer.disconnect();
  });
}
function sensor(spec, orientation) {
  const c = config(spec, [], { kind: 'state', unit: orientation ? 'rad' : 'm/s²', space: 'device' });
  return managedSource(c.source, async (ctx) => {
    const environment = c.environment(),
      Constructor = environment[orientation ? 'DeviceOrientationEvent' : 'DeviceMotionEvent'];
    if (!Constructor) unsupported('This device sensor is unavailable.');
    if (typeof Constructor.requestPermission === 'function') {
      const permission = await Constructor.requestPermission();
      if (permission !== 'granted') {
        const error = new Error('Sensor permission was denied.');
        error.name = 'NotAllowedError';
        throw error;
      }
    }
    if (!ctx.isCurrent()) return () => {};
    const cleanups = [];
    listen(
      environment,
      orientation ? 'deviceorientation' : 'devicemotion',
      (event) => {
        if (!ctx.isCurrent()) return;
        if (orientation) {
          const scale = Math.PI / 180,
            value = {
              alpha: nullable(event.alpha),
              beta: nullable(event.beta),
              gamma: nullable(event.gamma),
              absolute: typeof event.absolute === 'boolean' ? event.absolute : null,
            };
          for (const key of ['alpha', 'beta', 'gamma']) if (value[key] !== null) value[key] *= scale;
          ctx.emit(value, { valid: [value.alpha, value.beta, value.gamma].some((v) => v !== null) });
        } else {
          const vector = (input) => ({ x: nullable(input?.x), y: nullable(input?.y), z: nullable(input?.z) }),
            value = {
              acceleration: vector(event.acceleration),
              accelerationIncludingGravity: vector(event.accelerationIncludingGravity),
              rotationRate: {
                alpha: nullable(event.rotationRate?.alpha),
                beta: nullable(event.rotationRate?.beta),
                gamma: nullable(event.rotationRate?.gamma),
              },
              interval: nullable(event.interval),
            };
          for (const key of ['alpha', 'beta', 'gamma'])
            if (value.rotationRate[key] !== null) value.rotationRate[key] *= Math.PI / 180;
          if (value.interval !== null) value.interval /= 1000;
          ctx.emit(value, {
            valid:
              Object.values(value.acceleration).some((v) => v !== null) ||
              Object.values(value.accelerationIncludingGravity).some((v) => v !== null),
          });
        }
      },
      cleanups,
    );
    return cleanupAll(cleanups);
  });
}
export const deviceMotionInput = (spec = {}) => sensor(spec, false);
export const deviceOrientationInput = (spec = {}) => sensor(spec, true);
function csvRows(source, delimiter, maxRows, maxColumns) {
  let rows = [],
    row = [],
    cell = '',
    quoted = false,
    closed = false;
  const addCell = () => {
      assert(row.length < maxColumns, 'RESOURCE_LIMIT', 'CSV column limit exceeded.');
      row.push(cell);
      cell = '';
      closed = false;
    },
    addRow = () => {
      addCell();
      assert(rows.length <= maxRows, 'RESOURCE_LIMIT', 'CSV row limit exceeded.');
      rows.push(row);
      row = [];
    };
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += ch;
    } else if (ch === delimiter) addCell();
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      addRow();
    } else if (ch === '"') {
      assert(cell === '' && !closed, 'INPUT_FILE_FORMAT', 'Malformed CSV quote.');
      quoted = true;
    } else {
      assert(!closed, 'INPUT_FILE_FORMAT', 'Unexpected text after CSV quote.');
      cell += ch;
    }
    assert(cell.length <= 10000, 'RESOURCE_LIMIT', 'CSV cell exceeds10000 characters.');
  }
  assert(!quoted, 'INPUT_FILE_FORMAT', 'Unterminated CSV quote.');
  if (cell !== '' || row.length || closed) addRow();
  assert(rows.length, 'INPUT_FILE_FORMAT', 'CSV needs a header row.');
  const headers = rows.shift();
  assert(
    headers.every((h) => h.length > 0 && !['__proto__', 'prototype', 'constructor'].includes(h)) &&
      new Set(headers).size === headers.length,
    'INPUT_FILE_FORMAT',
    'CSV headers must be nonempty unique safe names.',
  );
  return rows.map((values) => {
    assert(values.length === headers.length, 'INPUT_FILE_FORMAT', 'CSV rows must match the header width.');
    return Object.fromEntries(headers.map((key, i) => [key, values[i]]));
  });
}
/**
 * A drag over an element before anything is dropped: whether something hovers, where, how many items
 * and whether they are files. Reading a dropped file is `fileInput`'s job; this source observes the
 * hover, so a scene can react while a file is still in the air. It prevents the default of
 * dragenter/dragover (which lets a drop land on the element) and never reads file contents; drop
 * handling and its default stay with `fileInput` or the application.
 */
export function dragInput(element, spec = {}) {
  const c = config(spec, [], { kind: 'state', unit: 'px', space: 'element', maxAge: 86400 });
  return managedSource(c.source, (ctx) => {
    const cleanups = [],
      environment = c.environment();
    assert(
      typeof element?.getBoundingClientRect === 'function',
      'INPUT_UNSUPPORTED',
      'Drag input needs an element with bounds.',
    );
    let depth = 0,
      last = { active: false, x: 0, y: 0, nx: 0, ny: 0, items: 0, files: false, dropped: false };
    const reset = () => {
      depth = 0;
      last = { ...last, active: false, dropped: false };
      ctx.emit(last);
    };
    const update = (event) => {
      if (!ctx.isCurrent()) return;
      const type = event.type;
      if (type === 'dragenter') depth++;
      else if (type === 'dragleave') depth = Math.max(0, depth - 1);
      else if (type === 'drop') depth = 0;
      if ((type === 'dragenter' || type === 'dragover') && typeof event.preventDefault === 'function')
        event.preventDefault();
      const transfer = event.dataTransfer,
        kinds = transfer?.types ? Array.from(transfer.types).slice(0, 16) : [],
        items = Math.min(1e4, Math.max(0, nullable(transfer?.items?.length) ?? nullable(transfer?.files?.length) ?? 0));
      let { x, y, nx, ny } = last;
      const box = element.getBoundingClientRect(),
        cx = nullable(event.clientX),
        cy = nullable(event.clientY),
        width = nullable(box.width),
        height = nullable(box.height);
      if (cx !== null && cy !== null && width > 0 && height > 0) {
        x = cx - box.left;
        y = cy - box.top;
        nx = x / width;
        ny = y / height;
      }
      last = {
        active: type === 'drop' ? false : type === 'dragleave' ? depth > 0 : true,
        x,
        y,
        nx,
        ny,
        items,
        files: kinds.includes('Files'),
        dropped: type === 'drop',
      };
      ctx.emit(last);
    };
    try {
      for (const name of ['dragenter', 'dragover', 'dragleave', 'drop']) listen(element, name, update, cleanups);
      listen(environment, 'blur', () => ctx.isCurrent() && reset(), cleanups);
    } catch (error) {
      cleanupAll(cleanups)();
      throw error;
    }
    return cleanupAll(cleanups);
  });
}
export async function readInputFile(file, spec = {}) {
  options(spec, ['format', 'maxBytes', 'maxRows', 'maxColumns', 'delimiter'], 'input file');
  const maxBytes = number(spec.maxBytes ?? 1048576, 'file byte limit', 1, 16777216),
    maxRows = number(spec.maxRows ?? 10000, 'file row limit', 1, 100000),
    maxColumns = number(spec.maxColumns ?? 128, 'file column limit', 1, 1024),
    delimiter = spec.delimiter ?? ',';
  assert(
    [maxBytes, maxRows, maxColumns].every(Number.isInteger),
    'INVALID_INPUT_FILE',
    'File limits must be integers.',
  );
  assert(
    typeof delimiter === 'string' && delimiter.length === 1 && !['"', '\r', '\n'].includes(delimiter),
    'INVALID_INPUT_FILE',
    'Use a single non-quote CSV delimiter.',
  );
  assert(file && typeof file.text === 'function', 'INVALID_INPUT_FILE', 'Use a local File or Blob.');
  const size = number(file.size, 'file size', 0, maxBytes),
    name = text(file.name ?? 'unnamed', 'file name', 1024),
    type = text(file.type ?? '', 'file MIME type', 256);
  let format = spec.format ?? 'auto';
  assert(['auto', 'json', 'csv'].includes(format), 'INVALID_INPUT_FILE', 'Use auto, json or csv format.');
  if (format === 'auto')
    format =
      /\.json$/i.test(name) || type === 'application/json'
        ? 'json'
        : /\.csv$/i.test(name) || ['text/csv', 'application/csv'].includes(type)
          ? 'csv'
          : null;
  assert(format, 'INPUT_FILE_FORMAT', 'Select a JSON or CSV file.');
  assert(
    !type ||
      [
        'application/json',
        'text/json',
        'text/csv',
        'application/csv',
        'text/plain',
        'application/octet-stream',
      ].includes(type),
    'INPUT_FILE_FORMAT',
    'Unsupported file MIME type.',
  );
  const source = await file.text();
  assert(
    typeof source === 'string' && source.length <= maxBytes && new TextEncoder().encode(source).length <= maxBytes,
    'RESOURCE_LIMIT',
    'Decoded file exceeds byte limit.',
  );
  void size;
  let rows;
  if (format === 'json') {
    try {
      rows = JSON.parse(source);
    } catch {
      throw new KitError('INPUT_FILE_FORMAT', 'Malformed JSON file.');
    }
    assert(
      Array.isArray(rows) && rows.length <= maxRows,
      'INPUT_FILE_FORMAT',
      'JSON input needs a bounded array of rows.',
    );
    for (const row of rows)
      assert(
        row &&
          typeof row === 'object' &&
          (Array.isArray(row) || Object.getPrototypeOf(row) === Object.prototype) &&
          Object.keys(row).length <= maxColumns,
        'INPUT_FILE_FORMAT',
        'JSON rows need bounded records or arrays.',
      );
  } else rows = csvRows(source.replace(/^\uFEFF/, ''), delimiter, maxRows, maxColumns);
  return Object.freeze({ name, format, rows: safeCopy(rows) });
}
export function fileInput(element, spec = {}) {
  const c = config(spec, ['format', 'maxBytes', 'maxRows', 'maxColumns', 'delimiter'], {
      kind: 'event',
      unit: 'rows',
      space: 'data',
    }),
    readOptions = Object.fromEntries(
      ['format', 'maxBytes', 'maxRows', 'maxColumns', 'delimiter']
        .filter((k) => spec[k] !== undefined)
        .map((k) => [k, spec[k]]),
    );
  return managedSource(c.source, (ctx) => {
    let generation = 0;
    const cleanups = [],
      select = (event) => {
        if (event.type === 'drop' && typeof event.preventDefault === 'function') event.preventDefault();
        const version = ++generation,
          files = event.type === 'drop' ? event.dataTransfer?.files : event.target?.files,
          file = files?.[0];
        if (!file) return;
        readInputFile(file, readOptions)
          .then((value) => {
            if (version === generation && ctx.isCurrent()) ctx.emit(value);
          })
          .catch((error) => {
            if (version === generation && ctx.isCurrent())
              ctx.emit(
                {
                  name: typeof file.name === 'string' ? file.name.slice(0, 1024) : 'unnamed',
                  format: null,
                  rows: null,
                  error: {
                    code: typeof error.code === 'string' ? error.code : 'INPUT_FILE_FORMAT',
                    message: String(error.message ?? 'File read failed').slice(0, 1000),
                  },
                },
                { valid: false },
              );
          });
      };
    try {
      listen(element, 'change', select, cleanups);
      listen(
        element,
        'dragover',
        (event) => {
          if (typeof event.preventDefault === 'function') event.preventDefault();
        },
        cleanups,
      );
      listen(element, 'drop', select, cleanups);
    } catch (error) {
      cleanupAll(cleanups)();
      throw error;
    }
    return () => {
      generation++;
      cleanupAll(cleanups)();
    };
  });
}
