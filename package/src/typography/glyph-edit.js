import { assert, text } from '../core/validate.js';

// Match explicit identity anchors before planning any allocations or edit events.
export function glyphEditSegments(sequence, chars, pivots) {
  const anchors = [];
  if (pivots !== undefined) {
    assert(
      Array.isArray(pivots) && pivots.length <= 256,
      'INVALID_GLYPH_PIVOTS',
      'Use at most 256 ordered pivot glyphs.',
    );
    let oldStart = 0,
      newStart = 0;
    for (let i = 0; i < pivots.length; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(pivots, String(i));
      assert(descriptor && 'value' in descriptor, 'INVALID_GLYPH_PIVOTS', 'Pivot entries must be dense data values.');
      const pivot = descriptor.value;
      text(pivot, 'pivot glyph', 2);
      assert(Array.from(pivot).length === 1, 'INVALID_GLYPH_PIVOTS', 'Each pivot must be one Unicode code point.');
      const before = sequence.findIndex((row, j) => j >= oldStart && row.char === pivot),
        after = chars.indexOf(pivot, newStart);
      assert(before >= 0 && after >= 0, 'INVALID_GLYPH_PIVOTS', 'Every pivot must occur in order in both texts.');
      anchors.push({ before, after });
      oldStart = before + 1;
      newStart = after + 1;
    }
  }
  const segments = [];
  let before = 0,
    after = 0;
  for (const anchor of [...anchors, { before: sequence.length, after: chars.length }]) {
    const old = sequence.slice(before, anchor.before),
      target = chars.slice(after, anchor.after);
    let prefix = 0,
      suffix = 0;
    while (prefix < old.length && prefix < target.length && old[prefix].char === target[prefix]) prefix++;
    while (
      suffix < old.length - prefix &&
      suffix < target.length - prefix &&
      old[old.length - 1 - suffix].char === target[target.length - 1 - suffix]
    )
      suffix++;
    segments.push({ old, target, prefix, suffix, pivot: sequence[anchor.before] });
    before = anchor.before + 1;
    after = anchor.after + 1;
  }
  return segments;
}
