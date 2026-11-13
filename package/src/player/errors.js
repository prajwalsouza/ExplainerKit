/** Visible, text-only diagnostics. Never interpret an author's error as HTML. */
const overlays = new WeakMap();
export function clearPlayerError(container) {
  overlays.get(container)?.remove();
  overlays.delete(container);
}
export function showPlayerError(container, error) {
  if (!container?.ownerDocument) return;
  clearPlayerError(container);
  const node = container.ownerDocument.createElement('div');
  node.className = 'explainerkit-error';
  node.setAttribute('role', 'alert');
  let message = 'The scene could not be displayed.';
  try {
    if (typeof error?.message === 'string') message = error.message;
  } catch {
    /* Keep failure reporting safe. */
  }
  node.textContent = `ExplainerKit: ${message}`;
  container.append(node);
  overlays.set(container, node);
}
