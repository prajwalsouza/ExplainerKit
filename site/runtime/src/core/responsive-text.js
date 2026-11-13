import { localMatrix, multiplyAffine } from './transform.js';
import { assert, number } from './validate.js';
/** Increase only opted-in labels after camera projection, keeping their authored origin. */
export function responsiveText(frame, displayWidth) {
  const ratio = number(displayWidth, 'display width', 1, 16384) / frame.width;
  const needs = (nodes) =>
    nodes.some((node) => (node.type === 'text' && node.props.minScreenSize > 0) || needs(node.children ?? []));
  if (!needs(frame.children)) return frame;
  function visit(node, parent) {
    let matrix = multiplyAffine(parent, localMatrix(node.props, node));
    if (node.type === 'text' && node.props.minScreenSize > 0) {
      const p = node.props,
        size = p.fontSize * Math.hypot(matrix[2], matrix[3]) * ratio;
      if (size > 1e-8) {
        const factor = Math.max(1, p.minScreenSize / size);
        assert(
          factor <= 64,
          'TEXT_SIZE_LIMIT',
          'Responsive text enlargement exceeds 64×. Reframe the scene or use an HTML caption.',
        );
        if (factor > 1) {
          node.props = { ...p, scaleX: p.scaleX * factor, scaleY: p.scaleY * factor };
          matrix = multiplyAffine(parent, localMatrix(node.props, node));
        }
      }
    }
    for (const child of node.children ?? []) visit(child, matrix);
  }
  for (const node of frame.children) visit(node, [1, 0, 0, 1, 0, 0]);
  return frame;
}
