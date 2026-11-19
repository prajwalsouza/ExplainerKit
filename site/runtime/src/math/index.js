import { assert, number, options, text } from '../core/validate.js';
import { multiplyMatrices, transformPoint } from '../camera/math.js';
import { parseSVGPath, parseSVGTransform } from '../import/svg.js';
import { parseInertSVG } from '../import/xml.js';
import { roundedRectPath } from '../geometry/index.js';
import { prepareObjectMorph } from '../morph/object.js';

const SVG = 'http://www.w3.org/2000/svg';
const MAX_MARKUP = 512_000;
const MAX_COMMANDS = 20_000;
const MAX_PARTS = 128;
const equations = new WeakSet();
const equationInstances = new WeakSet();
const mathPlacements = {
  mfrac: ['numerator', 'denominator', 'bar'],
  msup: ['base', 'exponent'],
  msub: ['base', 'subscript'],
  msubsup: ['base', 'subscript', 'exponent'],
};

function smallText(value, limit, label) {
  text(value, label, limit);
  assert(new TextEncoder().encode(value).length <= limit, 'RESOURCE_LIMIT', `${label} exceeds its byte limit.`);
  return value;
}

function viewBox(value) {
  const box = (value ?? '').trim().split(/[ ,]+/).map(Number);
  assert(box.length === 4, 'MATH_SVG_INVALID', 'Math SVG needs a viewBox with four numbers.');
  box.forEach((entry, i) => number(entry, 'Math SVG viewBox', i < 2 ? -1e7 : 1e-6, 1e7));
  return box;
}

function coordinates(commands, matrix) {
  return Object.freeze(
    commands.map(([op, ...values]) => {
      const command = [op];
      for (let i = 0; i < values.length; i += 2) {
        const p = transformPoint(matrix, { x: values[i], y: values[i + 1] });
        command.push(number(p.x, 'Math path x', -1e6, 1e6), number(p.y, 'Math path y', -1e6, 1e6));
      }
      return Object.freeze(command);
    }),
  );
}

/** Prepare a path-only MathJax SVG and give each glyph an editable scene part. */
export function equationFromSVG(source, spec = {}) {
  options(spec, ['height'], 'equation SVG');
  smallText(source, MAX_MARKUP, 'Equation SVG');
  const root = parseInertSVG(source).documentElement;
  assert(
    root?.localName === 'svg' && root.namespaceURI === SVG,
    'MATH_SVG_INVALID',
    'Give one standalone MathJax SVG.',
  );
  const attrs = Object.fromEntries(root.attributes.map(({ name, value }) => [name, value]));
  const [vx, vy, vw, vh] = viewBox(attrs.viewBox);
  const height = number(spec.height ?? 72, 'equation height', 1e-3, 8192);
  const scale = height / vh;
  const width = number(vw * scale, 'equation width', 1e-3, 8192);
  const viewport = [scale, 0, 0, scale, -vx * scale, -vy * scale];
  const parts = [];
  let visits = 0;
  let commandsUsed = 0;
  let tokenIndex = 0;

  function walk(node, parent, token = null, placement = '') {
    if (node.nodeType !== 1) {
      assert((node.textContent ?? '').trim() === '', 'MATH_SVG_UNSUPPORTED', 'Math SVG must contain outlined text.');
      return;
    }
    assert(
      ++visits <= 1024 && node.namespaceURI === SVG,
      'RESOURCE_LIMIT',
      'Math SVG exceeds its node budget or uses a foreign namespace.',
    );
    const tag = node.localName;
    assert(
      node === root || ['g', 'path', 'rect', 'title', 'desc'].includes(tag),
      'MATH_SVG_UNSUPPORTED',
      'Use MathJax SVG with fontCache none and outlined glyphs.',
    );
    const fields = Object.create(null);
    for (const a of node.attributes) {
      if (a.namespaceURI === 'http://www.w3.org/2000/xmlns/') continue;
      assert(
        !a.namespaceURI && !/^on/i.test(a.name) && !['href', 'clip-path', 'mask', 'filter'].includes(a.name),
        'MATH_SVG_UNSUPPORTED',
        'Math SVG cannot contain handlers, references, masks, filters or clips.',
      );
      fields[a.name] = a.value;
    }
    if (tag === 'title' || tag === 'desc') {
      assert(
        node.childNodes.every((child) => child.nodeType !== 1),
        'MATH_SVG_UNSUPPORTED',
        'Math SVG descriptions can contain only text.',
      );
      return;
    }
    assert(fields['data-mml-node'] !== 'merror', 'MATH_TYPESET_FAILED', 'MathJax returned an error expression.');
    const matrix = fields.transform ? multiplyMatrices(parent, parseSVGTransform(fields.transform)) : parent;
    if (['mi', 'mn', 'mo', 'mtext'].includes(fields['data-mml-node'])) {
      token = { id: ++tokenIndex, role: fields['data-mml-node'] };
    }
    if (tag === 'path' || tag === 'rect') {
      assert(
        parts.length < MAX_PARTS && commandsUsed < MAX_COMMANDS,
        'RESOURCE_LIMIT',
        'Equation has too many glyphs or outline commands.',
      );
      assert(
        node.childNodes.every((child) => child.nodeType !== 1 && !(child.textContent ?? '').trim()),
        'MATH_SVG_UNSUPPORTED',
        'A Math SVG outline cannot have children.',
      );
      const x = number(Number(fields.x ?? 0), 'math rectangle x', -1e6, 1e6);
      const y = number(Number(fields.y ?? 0), 'math rectangle y', -1e6, 1e6);
      const shape =
        tag === 'path'
          ? parseSVGPath(fields.d ?? '', { maxCommands: Math.min(10000, MAX_COMMANDS - commandsUsed) })
          : roundedRectPath({
              width: number(Number(fields.width), 'math rectangle width', 0, 1e6),
              height: number(Number(fields.height), 'math rectangle height', 0, 1e6),
              radius: 0,
            });
      if (!shape.length) return;
      commandsUsed += shape.length;
      assert(commandsUsed <= MAX_COMMANDS, 'RESOURCE_LIMIT', 'Equation outline commands exceed their aggregate limit.');
      const glyph = /^[0-9a-f]{1,6}$/i.test(fields['data-c'] ?? '') ? fields['data-c'].toUpperCase() : null;
      const local = tag === 'rect' ? multiplyMatrices(matrix, [1, 0, 0, 1, x, y]) : matrix;
      parts.push(
        Object.freeze({
          id: `glyph${parts.length + 1}`,
          glyph,
          term: token?.id ?? null,
          role: token?.role ?? null,
          placement,
          commands: coordinates(shape, local),
        }),
      );
      return;
    }
    const placements = mathPlacements[fields['data-mml-node']];
    let index = 0;
    for (const child of node.childNodes) {
      const slot = child.nodeType === 1 && placements?.[index++];
      const nested = slot ? (placement ? `${placement}/${slot}` : slot) : placement;
      walk(child, matrix, token, nested);
    }
  }

  walk(root, viewport);
  assert(parts.length > 0, 'MATH_SVG_INVALID', 'Math SVG has no outlined glyphs.');
  const asset = Object.freeze({ width, height, parts: Object.freeze(parts) });
  equations.add(asset);
  return asset;
}

/** Convert authored LaTeX or MathML with the caller's ready MathJax SVG instance. */
export async function typesetEquation(source, spec = {}) {
  options(spec, ['mathjax', 'serializeSVG', 'format', 'height', 'display'], 'equation typesetting');
  smallText(source, 16_384, 'Equation source');
  const format = spec.format ?? 'latex';
  assert(format === 'latex' || format === 'mathml', 'MATH_FORMAT', 'Use latex or mathml.');
  const prefix = format === 'latex' ? 'tex2svg' : 'mathml2svg';
  const typeset = spec.mathjax?.[`${prefix}Promise`] ?? spec.mathjax?.[prefix];
  assert(
    typeof typeset === 'function',
    'MATH_TYPESETTER_REQUIRED',
    `Supply MathJax with ${prefix} or ${prefix}Promise.`,
  );
  assert(spec.display === undefined || typeof spec.display === 'boolean', 'MATH_FORMAT', 'display must be boolean.');
  assert(
    spec.serializeSVG === undefined || typeof spec.serializeSVG === 'function',
    'MATH_FORMAT',
    'serializeSVG must be callable.',
  );
  const output = await typeset.call(spec.mathjax, source, { display: spec.display ?? true });
  const markup = spec.serializeSVG
    ? await spec.serializeSVG(output)
    : (output?.localName === 'svg' ? output : output?.querySelector?.('svg'))?.outerHTML;
  assert(
    typeof markup === 'string',
    'MATH_SVG_INVALID',
    'MathJax needs an SVG DOM result or an explicit serializeSVG adaptor.',
  );
  return equationFromSVG(markup, { height: spec.height });
}

/** Instantiate captured equation geometry as ordinary scene handles and expose match keys. */
export function addEquation(scene, asset, spec = {}) {
  options(spec, ['x', 'y', 'scale', 'fill'], 'equation instance');
  assert(equations.has(asset), 'MATH_SVG_INVALID', 'Prepare the equation before adding it to a scene.');
  const scale = number(spec.scale ?? 1, 'equation scale', 1e-5, 1e4);
  const definition = scene.component({
    type: 'group',
    props: { x: spec.x ?? 0, y: spec.y ?? 0, scaleX: scale, scaleY: scale },
    children: Object.fromEntries(
      asset.parts.map((part) => [
        part.id,
        {
          type: 'path',
          props: { commands: part.commands, fill: spec.fill ?? '#29262a', stroke: 'none', fillRule: 'nonzero' },
        },
      ]),
    ),
  });
  const handle = scene.instance(definition);
  const parts = Object.freeze(
    asset.parts.map(({ commands: _, ...part }) => Object.freeze({ ...part, handle: handle.part(part.id) })),
  );
  const keys = Object.freeze(
    Object.fromEntries(parts.filter((part) => part.glyph).map((part) => [part.handle.id, part.glyph])),
  );
  const instance = Object.freeze({ handle, parts, keys, width: asset.width * scale, height: asset.height * scale });
  equationInstances.add(instance);
  return instance;
}

/** Match captured equations by glyph, MathML type, and position within a term. */
export function createEquationMorph(from, to, spec = {}) {
  const capture = (entry) => {
    options(entry, ['frame', 'equation'], 'equation morph endpoint');
    const { equation, frame } = entry;
    assert(equationInstances.has(equation), 'MATH_SVG_INVALID', 'Add the equation to its scene before morphing it.');
    return {
      endpoint: { frame, object: equation.handle },
      math: new Map(equation.parts.map((part) => [part.handle.id, part])),
    };
  };
  const source = capture(from);
  const target = capture(to);
  return prepareObjectMorph(source.endpoint, target.endpoint, spec, { from: source.math, to: target.math });
}
