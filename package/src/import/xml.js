import { assert } from '../core/validate.js';
const XMLNS = 'http://www.w3.org/2000/xmlns/',
  XML = 'http://www.w3.org/XML/1998/namespace';
const valid = (test, message, code = 'SVG_INVALID') => assert(test, code, message);
const name = /^[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?$/;
function decode(value) {
  valid(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(value), 'Invalid XML character.');
  return value.replace(/&([^&;]{1,32});|&/g, (whole, entity) => {
    const known = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (Object.hasOwn(known, entity)) return known[entity];
    valid(
      typeof entity === 'string' && /^#(?:x[\da-fA-F]+|\d+)$/.test(entity),
      'Only predefined and numeric XML entities are supported.',
      'SVG_UNSAFE',
    );
    const n = entity[1] === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    valid(
      n === 9 ||
        n === 10 ||
        n === 13 ||
        (n >= 32 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) && n !== 0xfffe && n !== 0xffff),
      'Invalid numeric XML character.',
    );
    return String.fromCodePoint(n);
  });
}
/** Inert XML subset for SVG import: no DOM, execution, resource loading or DTD. */
export function parseInertSVG(source) {
  valid(
    typeof source === 'string' && source.length <= 4_000_000,
    'XML source exceeds the size budget.',
    'RESOURCE_LIMIT',
  );
  valid(
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff\ud800-\udfff]/u.test(source),
    'Invalid XML source character.',
  );
  let i = source.charCodeAt(0) === 0xfeff ? 1 : 0,
    root = null,
    count = 0,
    attributeCount = 0;
  const stack = [];
  const addText = (value, nodeType = 3) => {
    const textContent = nodeType === 4 ? value : decode(value);
    if (stack.length) stack.at(-1).node.childNodes.push({ nodeType, textContent });
    else valid(!textContent.trim(), 'Text outside the SVG root.');
  };
  while (i < source.length) {
    if (source[i] !== '<') {
      const end = source.indexOf('<', i);
      const value = source.slice(i, end < 0 ? source.length : end);
      valid(!value.includes(']]>'), 'CDATA terminator in XML text.');
      addText(value);
      i = end < 0 ? source.length : end;
      continue;
    }
    if (source.startsWith('<!--', i)) {
      const end = source.indexOf('-->', i + 4);
      valid(end >= 0 && !source.slice(i + 4, end).includes('--'), 'Malformed XML comment.');
      i = end + 3;
      continue;
    }
    if (source.startsWith('<![CDATA[', i)) {
      valid(stack.length > 0, 'CDATA outside the root.');
      const end = source.indexOf(']]>', i + 9);
      valid(end >= 0, 'Unclosed CDATA.');
      addText(source.slice(i + 9, end), 4);
      i = end + 3;
      continue;
    }
    if (source.startsWith('<?xml', i)) {
      valid(
        (i === 0 || i === 1) &&
          /^<\?xml\s+version\s*=\s*(['"])1\.0\1(?:\s+encoding\s*=\s*(['"])[\w.-]+\2)?(?:\s+standalone\s*=\s*(['"])(?:yes|no)\3)?\s*\?>/.test(
            source.slice(i),
          ),
        'Unsupported XML declaration.',
      );
      i = source.indexOf('?>', i) + 2;
      continue;
    }
    valid(
      !source.startsWith('<!', i) && !source.startsWith('<?', i),
      'XML declarations and processing instructions are forbidden.',
      'SVG_UNSAFE',
    );
    let end = i + 1,
      quote = null;
    for (; end < source.length; end++) {
      const c = source[end];
      if (quote) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'") quote = c;
      else if (c === '>') break;
    }
    valid(end < source.length && !quote, 'Unclosed XML tag.');
    const body = source.slice(i + 1, end);
    i = end + 1;
    if (body.startsWith('/')) {
      const close = body.slice(1).trim();
      valid(name.test(close) && stack.length && stack.at(-1).qname === close, 'Mismatched XML closing tag.');
      stack.pop();
      continue;
    }
    const match = body.match(/^([^\s/>]+)([\s\S]*)$/);
    valid(match && name.test(match[1]), 'Malformed XML name.');
    const qname = match[1],
      self = /\/$/.test(match[2]),
      rest = self ? match[2].slice(0, -1) : match[2];
    const attrs = [],
      seen = new Set();
    let at = 0;
    while (at < rest.length) {
      const a = rest.slice(at).match(/^\s+([^\s=]+)\s*=\s*(['"])([^]*?)\2/);
      if (!a) {
        valid(!rest.slice(at).trim(), 'Malformed XML attributes.');
        break;
      }
      valid(name.test(a[1]) && !seen.has(a[1]) && !a[3].includes('<'), 'Invalid or duplicate XML attribute.');
      seen.add(a[1]);
      valid(++attributeCount <= 100000 && attrs.length < 1024, 'XML attribute budget exceeded.', 'RESOURCE_LIMIT');
      attrs.push({ name: a[1], value: decode(a[3].replace(/[\t\r\n]/g, ' ')) });
      at += a[0].length;
    }
    valid(++count <= 10000 && stack.length <= 24, 'XML node or hierarchy budget exceeded.', 'RESOURCE_LIMIT');
    const ns = Object.create(stack.at(-1)?.ns ?? null);
    if (!stack.length) ns.xml = XML;
    for (const a of attrs)
      if (a.name === 'xmlns') ns[''] = a.value;
      else if (a.name.startsWith('xmlns:')) {
        const p = a.name.slice(6);
        valid(
          p !== 'xmlns' && a.value && !(p === 'xml' && a.value !== XML) && a.value !== XMLNS,
          'Invalid XML namespace declaration.',
        );
        ns[p] = a.value;
      }
    const parts = qname.split(':'),
      prefix = parts.length === 2 ? parts[0] : '',
      localName = parts.at(-1);
    valid(!prefix || ns[prefix], 'Undeclared element namespace.');
    const expanded = new Set();
    const attributes = attrs.map((a) => {
      const p = a.name.split(':'),
        attributePrefix = p.length === 2 ? p[0] : '',
        attributeLocal = p.at(-1),
        namespaceURI =
          a.name === 'xmlns' || attributePrefix === 'xmlns' ? XMLNS : attributePrefix ? ns[attributePrefix] : null;
      valid(!attributePrefix || namespaceURI, 'Undeclared attribute namespace.');
      const key = `${namespaceURI}:${attributeLocal}`;
      valid(!expanded.has(key), 'Duplicate expanded XML attribute.');
      expanded.add(key);
      return { ...a, localName: attributeLocal, namespaceURI };
    });
    const node = { nodeType: 1, localName, namespaceURI: ns[prefix] ?? null, attributes, childNodes: [] };
    if (stack.length) stack.at(-1).node.childNodes.push(node);
    else {
      valid(root === null, 'Multiple XML roots.');
      root = node;
    }
    if (!self) stack.push({ node, qname, ns });
  }
  valid(root && stack.length === 0, 'Missing or unclosed SVG root.');
  return {
    documentElement: root,
    querySelector() {
      return null;
    },
  };
}
