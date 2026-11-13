import { assert } from './validate.js';
import { textOutline } from '../import/font.js';
import { pathCommands } from '../graphics/index.js';
/** Validate an imported outline font without accepting arbitrary font-like executables. */
export function validateRegisteredFont(name, face) {
  assert(
    typeof name === 'string' && name.length > 0 && name.length <= 200 && /^[\w -]+$/.test(name),
    'INVALID_FONT',
    'Use a plain font family name.',
  );
  textOutline(face, '', { missing: 'notdef' });
  return face;
}
/** Retain text semantics while supplying deterministic, self-contained glyph outlines. */
export function resolveRegisteredText(node, registry) {
  if (node.type === 'text' && node.props.textOutline == null) {
    if (!registry.size) {
      assert(
        node.props.wrap == null,
        'TEXT_METRICS_REQUIRED',
        'Wrapped live text requires a registered outline font for deterministic measurement.',
      );
      return node;
    }
    const p = node.props,
      families = p.fontFamily.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')),
      name = families.find((n) => registry.has(n));
    assert(
      p.wrap == null || name,
      'TEXT_METRICS_REQUIRED',
      'Wrapped live text requires a registered outline font for deterministic measurement.',
    );
    if (name) {
      const face = registry.get(name),
        outline = (s) => textOutline(face, s, { size: p.fontSize, letterSpacing: p.letterSpacing, missing: 'notdef' }),
        lines = [];
      for (const block of p.text.split(/\r?\n/)) {
        if (p.wrap == null) {
          lines.push(block);
          continue;
        }
        let line = '';
        for (const word of block.split(/\s+/).filter(Boolean)) {
          assert(outline(word).advance <= p.wrap, 'TEXT_OVERFLOW', 'A word exceeds the text wrap width.');
          const next = line ? `${line} ${word}` : word;
          if (line && outline(next).advance > p.wrap) {
            lines.push(line);
            line = word;
          } else line = next;
        }
        lines.push(line);
      }
      assert(lines.length <= 256, 'RESOURCE_LIMIT', 'Text supports at most 256 lines.');
      const shapes = lines.map(outline),
        advance = Math.max(0, ...shapes.map((o) => o.advance)),
        commands = [];
      for (const [i, o] of shapes.entries()) {
        const dx = p.align === 'middle' ? -o.advance / 2 : p.align === 'end' ? -o.advance : 0,
          dy =
            (p.baseline === 'middle' ? p.fontSize * 0.3 : p.baseline === 'hanging' ? p.fontSize * 0.8 : 0) +
            i * p.fontSize * (p.lineHeight ?? 1.3);
        for (const c of o.commands) commands.push(c.map((v, j) => (j === 0 ? v : v + (j % 2 ? dx : dy))));
      }
      node.props = { ...p, textOutline: pathCommands(commands), textAdvance: advance };
    }
  }
  for (const child of node.children ?? []) resolveRegisteredText(child, registry);
  return node;
}
