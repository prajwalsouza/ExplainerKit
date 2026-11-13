import { assert, number, options } from '../core/validate.js';
import { bindDOM } from '../adapters/dom.js';
import { segmentText, textStagger } from './segment.js';
export { segmentText, textStagger } from './segment.js';

const owners = new WeakMap(),
  allowed = new Set(['SPAN', 'STRONG', 'EM', 'B', 'I', 'U', 'SMALL', 'SUB', 'SUP', 'MARK', 'S', 'CODE', 'BR']);
const roots = new Set([
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'P',
  'SPAN',
  'DIV',
  'BLOCKQUOTE',
  'FIGCAPTION',
  'LABEL',
  'BUTTON',
  'A',
  'STRONG',
  'EM',
  'B',
  'I',
  'SMALL',
  'MARK',
]);
const hiddenStyle =
  'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:pre;border:0';
function content(node) {
  if (node.nodeType === 3) return node.nodeValue ?? '';
  if (node.nodeType === 1 && node.tagName === 'BR') return '\n';
  return [...node.childNodes].map(content).join('');
}
function inspect(node) {
  if (node.nodeType === 3) return;
  assert(
    node.nodeType === 1 && allowed.has(node.tagName),
    'UNSUPPORTED_TEXT_CONTENT',
    'Kinetic text supports text and simple noninteractive phrasing elements.',
  );
  assert(
    !node.hasAttribute('tabindex') && !node.hasAttribute('contenteditable') && !node.hasAttribute('id'),
    'UNSUPPORTED_TEXT_CONTENT',
    'Split plain phrasing text without focusable/editable or identified descendants.',
  );
  for (const child of node.childNodes) inspect(child);
}
function restore(element, nodes) {
  element.replaceChildren(...nodes);
}

/** Split visual text without recreating original child nodes or hiding its semantic copy. */
export function kineticText(element, spec = {}) {
  options(spec, ['split', 'locale', 'fallback'], 'kinetic text');
  assert(
    element?.nodeType === 1 && element.ownerDocument && typeof element.replaceChildren === 'function',
    'INVALID_DOM',
    'Split a DOM text element.',
  );
  assert(
    roots.has(element.tagName) && !element.isContentEditable,
    'UNSUPPORTED_TEXT_CONTENT',
    'Split a plain HTML text container, not an editor or media/form control.',
  );
  assert(!owners.has(element), 'TEXT_OWNED', 'This element already has an active kinetic text owner.');
  const original = [...element.childNodes];
  for (const node of original) inspect(node);
  const source = content(element),
    segmented = segmentText(source, spec),
    count = segmented.segments.filter((s) => !s.whitespace).length;
  assert(count <= 2048, 'RESOURCE_LIMIT', 'Kinetic text accepts at most 2048 animated tokens.');
  const media = element.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
  const doc = element.ownerDocument,
    semantic = doc.createElement('span'),
    visual = doc.createElement('span'),
    tokens = [];
  semantic.setAttribute('data-explainerkit-original-text', '');
  semantic.setAttribute('style', hiddenStyle);
  visual.setAttribute('data-explainerkit-kinetic', '');
  visual.setAttribute('aria-hidden', 'true');
  visual.style.whiteSpace = 'pre-wrap';
  // Build all new visual nodes before touching existing children.
  for (const part of segmented.segments) {
    if (part.whitespace) {
      visual.appendChild(doc.createTextNode(part.text));
      continue;
    }
    const span = doc.createElement('span');
    span.textContent = part.text;
    span.style.display = 'inline-block';
    span.setAttribute('data-explainerkit-token', String(tokens.length));
    visual.appendChild(span);
    tokens.push(span);
  }
  try {
    semantic.append(...original);
    element.replaceChildren(semantic, visual);
  } catch (error) {
    restore(element, original);
    throw error;
  }
  const token = Object.freeze({});
  owners.set(element, token);
  let disposed = false,
    adapter = null,
    unsubscribePlayer = () => {};
  function animation(localSpec1 = {}) {
    options(localSpec1, ['at', 'duration', 'stagger', 'order', 'from', 'reducedMotion'], 'text animation');
    const from = localSpec1.from ?? {};
    options(from, ['x', 'y', 'rotation', 'scale', 'opacity'], 'text entrance');
    const pose = Object.freeze({
      x: number(from.x ?? 0, 'entrance x'),
      y: number(from.y ?? 18, 'entrance y'),
      rotation: number(from.rotation ?? 0, 'entrance rotation'),
      scale: number(from.scale ?? 1, 'entrance scale', -1e4, 1e4),
      opacity: number(from.opacity ?? 0, 'entrance opacity', 0, 1),
    });
    const schedule = textStagger(
      tokens.length,
      Object.fromEntries(
        ['at', 'duration', 'stagger', 'order']
          .filter((k) => localSpec1[k] !== undefined)
          .map((k) => [k, localSpec1[k]]),
      ),
    );
    const reducedMotion = localSpec1.reducedMotion ?? 'respect';
    assert(
      ['respect', 'allow'].includes(reducedMotion),
      'INVALID_TYPOGRAPHY',
      'reducedMotion must be respect or allow.',
    );
    return { pose, schedule, reducedMotion };
  }
  function poseAt(progress, from) {
    const t = 1 - (1 - progress) ** 3;
    return {
      x: from.x * (1 - t),
      y: from.y * (1 - t),
      rotation: from.rotation * (1 - t),
      scaleX: from.scale + (1 - from.scale) * t,
      scaleY: from.scale + (1 - from.scale) * t,
      opacity: from.opacity + (1 - from.opacity) * t,
    };
  }
  function sample(time, localSpec2 = {}) {
    assert(!disposed, 'DISPOSED', 'This kinetic text has been disposed.');
    assert(!adapter, 'TEXT_OWNED', 'Detach the scene binding before sampling text manually.');
    const a = animation(localSpec2),
      progress = a.schedule.sample(time),
      reduced = a.reducedMotion === 'respect' && media?.matches;
    const prepared = tokens.map((localElement3, i) => {
        const p = poseAt(reduced ? 1 : progress[i], a.pose);
        return {
          transform: `translate(${p.x}px, ${p.y}px) rotate(${p.rotation}rad) scale(${p.scaleX}, ${p.scaleY})`,
          opacity: String(p.opacity),
        };
      }),
      previous = tokens.map((el) => el.getAttribute('style'));
    try {
      tokens.forEach((localElement4, i) => {
        localElement4.style.transform = prepared[i].transform;
        localElement4.style.opacity = prepared[i].opacity;
      });
    } catch (error) {
      tokens.forEach((el, i) => {
        if (previous[i] === null) el.removeAttribute('style');
        else el.setAttribute('style', previous[i]);
      });
      throw error;
    }
    return Object.freeze({
      time,
      progress: reduced ? Object.freeze(tokens.map(() => 1)) : progress,
      end: a.schedule.end,
    });
  }
  function bind(scene, localSpec5 = {}) {
    assert(!disposed, 'DISPOSED', 'This kinetic text has been disposed.');
    assert(!adapter, 'TEXT_OWNED', 'This text already has a scene binding.');
    options(
      localSpec5,
      ['player', 'onError', 'at', 'duration', 'stagger', 'order', 'from', 'reducedMotion'],
      'kinetic text binding',
    );
    const a = animation(
      Object.fromEntries(
        ['at', 'duration', 'stagger', 'order', 'from', 'reducedMotion']
          .filter((k) => localSpec5[k] !== undefined)
          .map((k) => [k, localSpec5[k]]),
      ),
    );
    // Empty text owns no CSS targets, but retains the same terminal lifecycle.
    if (!tokens.length) {
      let ended = false;
      const empty = {
        end: a.schedule.end,
        update: (time) => {
          assert(!ended, 'DISPOSED', 'This text binding has been disposed.');
          number(time ?? 0, 'text time', 0, 86400);
        },
        dispose() {
          if (ended) return;
          ended = true;
          if (adapter === empty) adapter = null;
          unsubscribePlayer();
          unsubscribePlayer = () => {};
        },
        get disposed() {
          return ended;
        },
      };
      adapter = empty;
      if (localSpec5.player) unsubscribePlayer = localSpec5.player.on('dispose', dispose);
      return Object.freeze(empty);
    }
    let seen = null,
      progress = null;
    const bound = bindDOM(
      scene,
      tokens.map((localElement6, i) => ({
        element: localElement6,
        map: (context) => {
          if (context !== seen) {
            seen = context;
            progress = a.schedule.sample(context.time);
          }
          return poseAt(context.reducedMotion ? 1 : progress[i], a.pose);
        },
      })),
      { player: localSpec5.player, onError: localSpec5.onError, reducedMotion: a.reducedMotion },
    );
    adapter = bound;
    if (localSpec5.player) unsubscribePlayer = localSpec5.player.on('dispose', dispose);
    return Object.freeze({
      end: a.schedule.end,
      update: (time) => bound.update(time),
      get disposed() {
        return bound.disposed;
      },
      dispose() {
        if (adapter === bound) adapter = null;
        unsubscribePlayer();
        unsubscribePlayer = () => {};
        bound.dispose();
      },
    });
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    unsubscribePlayer();
    unsubscribePlayer = () => {};
    adapter?.dispose();
    adapter = null;
    if (owners.get(element) === token) {
      owners.delete(element);
      restore(element, original);
    }
    tokens.length = 0;
    original.length = 0;
  }
  return Object.freeze({
    text: source,
    method: segmented.method,
    tokens: Object.freeze([...tokens]),
    sample,
    bind,
    dispose,
    get disposed() {
      return disposed;
    },
  });
}

export { glyphs } from './glyphs.js';
