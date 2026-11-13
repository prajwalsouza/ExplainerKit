import { assertContainer, prepareFrame, pathData, transformString, rendererError, prepare2D } from './shared.js';
import { effectPlan, blurRadius } from '../graphics/look.js';
import { filmPlan, tileSVG } from './film.js';
import { textureTile } from '../graphics/texture.js';
import { rgbaOf } from '../graphics/cloud.js';
import { localBounds, localMatrix, multiplyAffine } from '../core/transform.js';
const NS = 'http://www.w3.org/2000/svg';
const TAGS = { group: 'g', circle: 'circle', rect: 'rect', line: 'line', path: 'path', text: 'text', cloud: 'g' };
/** SVG draws one element per point, so it accepts smaller clouds than the Canvas GPU path. */
export const MAX_SVG_POINTS = 5000;
let rendererSequence = 0;

/** Retained SVG projection. A stable frame ID retains its DOM element. */
export function createSVGRenderer(container, { label = 'ExplainerKit scene' } = {}) {
  assertContainer(container);
  const doc = container.ownerDocument;
  const element = doc.createElementNS(NS, 'svg');
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', label);
  element.style.width = '100%';
  element.style.height = 'auto';
  element.style.display = 'block';
  element.style.overflow = 'hidden';
  container.appendChild(element);
  const stats = { clampedFilters: 0 };
  const nativeLeases = new Map();
  const nodes = new Map(),
    resources = new Map(),
    prefix = `explainerkit-${++rendererSequence}`;
  let defs = null,
    resourceSequence = 0,
    resourcesLive = new Set();
  let disposed = false;
  let trims = new Map();
  let effects = new Map(),
    films = new Map();

  function attr(el, key, value) {
    const next = String(value);
    if (el.getAttribute(key) !== next) el.setAttribute(key, next);
  }
  function resource(nodeId, role, value) {
    const resourceKey = JSON.stringify([nodeId, role]),
      signature = JSON.stringify(value);
    resourcesLive.add(resourceKey);
    let record = resources.get(resourceKey);
    if (record?.signature === signature) return `url(#${record.id})`;
    if (!defs) {
      defs = doc.createElementNS(NS, 'defs');
      element.appendChild(defs);
    }
    let id = record?.id;
    if (!id)
      do {
        id = `${prefix}-resource-${++resourceSequence}`;
      } while (doc.getElementById?.(id));
    const el = doc.createElementNS(
      NS,
      role === 'clip'
        ? 'clipPath'
        : role === 'filter'
          ? 'filter'
          : role === 'mask'
            ? 'mask'
            : value.type === 'texture'
              ? 'pattern'
              : value.type === 'linear'
                ? 'linearGradient'
                : 'radialGradient',
    );
    attr(el, 'id', id);
    if (role === 'clip') {
      attr(el, 'clipPathUnits', value.units === 'bounds' ? 'objectBoundingBox' : 'userSpaceOnUse');
      const shape = doc.createElementNS(NS, value.type);
      attr(shape, 'clip-rule', value.fillRule ?? 'nonzero');
      if (value.type === 'rect') {
        for (const k of ['x', 'y', 'width', 'height']) attr(shape, k, value[k]);
        attr(shape, 'rx', Math.min(value.rx, value.width / 2, value.height / 2));
      }
      if (value.type === 'circle') {
        attr(shape, 'cx', value.x);
        attr(shape, 'cy', value.y);
        attr(shape, 'r', value.r);
      }
      if (value.type === 'path') attr(shape, 'd', pathData(value.commands));
      el.appendChild(shape);
    } else if (role === 'filter') {
      attr(el, 'filterUnits', 'userSpaceOnUse');
      attr(el, 'primitiveUnits', 'userSpaceOnUse');
      attr(el, 'color-interpolation-filters', 'sRGB');
      for (const [key, v] of Object.entries(value.bounds)) attr(el, key, v);
      let input = 'SourceGraphic';
      const primitive = (tag, attributes) => {
        const p = doc.createElementNS(NS, tag);
        for (const [k, v] of Object.entries(attributes)) attr(p, k, v);
        el.appendChild(p);
        return p;
      };
      for (const [i, p] of (value.film?.passes ?? []).entries()) {
        primitive('feOffset', { in: 'SourceAlpha', dx: p.dx, dy: p.dy, result: `offset${i}` });
        primitive('feGaussianBlur', { in: `offset${i}`, stdDeviation: p.blur, result: `soft${i}` });
        primitive('feComposite', { in: 'SourceAlpha', in2: `soft${i}`, operator: 'out', result: `edge${i}` });
        primitive('feFlood', { 'flood-color': p.color, 'flood-opacity': p.amount, result: `color${i}` });
        primitive('feComposite', { in: `color${i}`, in2: `edge${i}`, operator: 'in', result: `shade${i}` });
        primitive('feComposite', { in: `shade${i}`, in2: input, operator: 'over', result: `lit${i}` });
        input = `lit${i}`;
      }
      const addImage = (body) => {
        const b = value.bounds,
          svg = `<svg xmlns="${NS}" width="${b.width}" height="${b.height}" viewBox="${b.x} ${b.y} ${b.width} ${b.height}">${body}</svg>`;
        primitive('feImage', {
          href: `data:image/svg+xml,${encodeURIComponent(svg)}`,
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          preserveAspectRatio: 'none',
          result: 'filmImage',
        });
        primitive('feComposite', { in: 'filmImage', in2: 'SourceAlpha', operator: 'in', result: 'filmClipped' });
        primitive('feComposite', { in: 'filmClipped', in2: input, operator: 'over', result: 'filmComposite' });
        input = 'filmComposite';
      };
      if (value.highlight) {
        const h = value.highlight;
        addImage(
          `<defs><radialGradient id="h"><stop stop-color="${h.color ?? value.film.light.color}" stop-opacity="${h.amount}"/><stop offset="1" stop-color="${h.color ?? value.film.light.color}" stop-opacity="0"/></radialGradient></defs><circle cx="${h.x}" cy="${h.y}" r="${h.r}" fill="url(#h)"/>`,
        );
      }
      if (value.texture) {
        const t = value.texture,
          b = value.bounds,
          transform = t.space === 'screen' ? `matrix(${value.film.inverse.join(' ')})` : '';
        addImage(
          `<defs><pattern id="t" width="${32 * t.scale}" height="${32 * t.scale}" patternUnits="userSpaceOnUse" patternTransform="${transform}"><g transform="scale(${t.scale})">${tileSVG(t)}</g></pattern></defs><rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" fill="url(#t)"/>`,
        );
      }
      if (value.blur > 0) {
        const blur = doc.createElementNS(NS, 'feGaussianBlur');
        attr(blur, 'in', input);
        attr(blur, 'stdDeviation', value.blur);
        attr(blur, 'result', 'filmBlur');
        input = 'filmBlur';
        el.appendChild(blur);
      }
      if (value.glow) {
        const shadow = doc.createElementNS(NS, 'feDropShadow');
        attr(shadow, 'in', input);
        attr(shadow, 'dx', 0);
        attr(shadow, 'dy', 0);
        attr(shadow, 'stdDeviation', value.glow.blur);
        attr(shadow, 'flood-color', value.glow.color);
        attr(shadow, 'flood-opacity', value.glow.opacity);
        el.appendChild(shadow);
      }
    } else if (role === 'mask') {
      attr(el, 'maskUnits', 'userSpaceOnUse');
      attr(el, 'maskContentUnits', 'userSpaceOnUse');
      attr(el, 'mask-type', 'alpha');
      for (const [key, v] of Object.entries(value.bounds)) attr(el, key, v);
      const rect = doc.createElementNS(NS, 'rect');
      for (const [key, v] of Object.entries(value.bounds)) attr(rect, key, v);
      attr(rect, 'fill', value.paint);
      el.appendChild(rect);
    } else if (value.type === 'texture') {
      attr(el, 'patternUnits', 'userSpaceOnUse');
      attr(el, 'width', 32 * value.scale);
      attr(el, 'height', 32 * value.scale);
      if (value.space === 'screen') attr(el, 'patternTransform', `matrix(${value.inverse.join(' ')})`);
      for (const cell of textureTile(value.descriptor ?? value).cells) {
        const r = doc.createElementNS(NS, 'rect');
        attr(r, 'x', cell.x * value.scale);
        attr(r, 'y', cell.y * value.scale);
        attr(r, 'width', value.scale);
        attr(r, 'height', value.scale);
        attr(r, 'fill', cell.color ?? value.color);
        attr(r, 'fill-opacity', cell.alpha);
        el.appendChild(r);
      }
    } else {
      attr(el, 'gradientUnits', value.units === 'bounds' ? 'objectBoundingBox' : 'userSpaceOnUse');
      attr(el, 'spreadMethod', 'pad');
      attr(el, 'color-interpolation', 'sRGB');
      if (value.boundsTransform) attr(el, 'gradientTransform', `matrix(${value.boundsTransform.join(' ')})`);
      if (value.type === 'linear') for (const k of ['x1', 'y1', 'x2', 'y2']) attr(el, k, value[k]);
      else {
        attr(el, 'cx', value.x);
        attr(el, 'cy', value.y);
        attr(el, 'fx', value.x);
        attr(el, 'fy', value.y);
        attr(el, 'r', value.r);
      }
      for (const stop of value.stops) {
        const child = doc.createElementNS(NS, 'stop');
        attr(child, 'offset', stop.offset);
        attr(child, 'stop-color', stop.color);
        el.appendChild(child);
      }
    }
    record?.el.remove();
    defs.appendChild(el);
    record = { id, el, signature };
    resources.set(resourceKey, record);
    return `url(#${id})`;
  }
  function paint(nodeId, role, value) {
    return typeof value === 'string'
      ? value
      : resource(
          nodeId,
          role,
          value.type === 'texture' ? { ...value, descriptor: value, inverse: films.get(nodeId)?.inverse } : value,
        );
  }
  function clearTrim(record) {
    record.trimEl?.remove();
    record.trimEl = null;
    if (record.trimGroup) {
      const group = record.trimGroup;
      if (group.parentNode) group.parentNode.insertBefore(record.el, group);
      group.remove();
      record.trimGroup = null;
      record.el.setAttribute('data-explainerkit-id', record.id);
    }
  }
  function update(node, parent) {
    let record = nodes.get(node.id);
    if (record && (record.type !== node.type || record.outlined !== !!node.props.textOutline)) {
      clearTrim(record);
      record.el.remove();
      nodes.delete(node.id);
      record = undefined;
    }
    if (!record) {
      const el = doc.createElementNS(NS, node.props.textOutline ? 'path' : TAGS[node.type]);
      record = { id: node.id, type: node.type, outlined: !!node.props.textOutline, el };
      nodes.set(node.id, record);
      el.setAttribute('data-explainerkit-id', node.id);
    }
    const { el } = record;
    const p = node.props;
    if (!nativeLeases.has(node.id)) {
      attr(el, 'transform', transformString(p, node));
      attr(el, 'opacity', p.opacity ?? 1);
    }
    attr(el, 'fill', paint(node.id, 'fill', p.fill ?? (node.type === 'line' ? 'none' : '#18181b')));
    let strokePaint = p.stroke ?? (node.type === 'line' ? '#18181b' : 'none');
    if (trims.get(node.id)?.commands && strokePaint?.units === 'bounds') {
      const b = localBounds(node);
      strokePaint = { ...strokePaint, units: 'user', boundsTransform: [b.width, 0, 0, b.height, b.x, b.y] };
    }
    attr(el, 'stroke', paint(node.id, 'stroke', strokePaint));
    attr(el, 'stroke-width', p.halo ? 2 * p.halo.width : (p.strokeWidth ?? 1));
    if (p.halo) attr(el, 'stroke', p.halo.color);
    attr(el, 'paint-order', p.halo ? 'stroke fill' : 'normal');
    attr(el, 'fill-opacity', p.fillOpacity ?? 1);
    attr(el, 'stroke-opacity', p.strokeOpacity ?? 1);
    attr(el, 'stroke-dasharray', p.strokeDasharray?.length ? p.strokeDasharray.join(' ') : 'none');
    attr(el, 'stroke-dashoffset', p.strokeDashoffset ?? 0);
    attr(el, 'stroke-linecap', p.strokeLinecap ?? 'butt');
    attr(el, 'stroke-linejoin', p.halo ? 'round' : (p.strokeLinejoin ?? 'miter'));
    attr(el, 'stroke-miterlimit', p.strokeMiterlimit ?? 4);
    attr(el, 'fill-rule', p.fillRule ?? 'nonzero');
    attr(el, 'clip-path', p.clip ? resource(node.id, 'clip', p.clip) : 'none');
    const effect = effects.get(node.id);
    attr(
      el,
      'filter',
      effect
        ? resource(node.id, 'filter', {
            bounds: effect.bounds,
            blur: effect.blur ?? 0,
            glow: effect.glow ?? null,
            film: films.get(node.id),
            highlight: p.shade?.highlight,
            texture: p.texture,
          })
        : 'none',
    );
    if (p.mask) {
      const maskPaint = resource(node.id, 'maskPaint', p.mask.gradient);
      attr(el, 'mask', resource(node.id, 'mask', { bounds: p.mask.bounds, paint: maskPaint }));
    } else attr(el, 'mask', 'none');
    el.style.mixBlendMode = { normal: 'normal', add: 'plus-lighter', multiply: 'multiply', screen: 'screen' }[
      p.blend ?? 'normal'
    ];
    if (node.type === 'circle') attr(el, 'r', p.r ?? 0);
    if (node.type === 'rect') {
      attr(el, 'width', p.width ?? 0);
      attr(el, 'height', p.height ?? 0);
      attr(el, 'rx', Math.min(p.rx ?? 0, (p.width ?? 0) / 2, (p.height ?? 0) / 2));
    }
    if (node.type === 'line') for (const key of ['x1', 'y1', 'x2', 'y2']) attr(el, key, p[key] ?? 0);
    if (node.type === 'path') {
      attr(el, 'd', pathData(p.commands));
      const trim = trims.get(node.id);
      if (trim?.commands) {
        // Keep full fill and cut stroke as separate geometry, but composite their
        // opacity, filters, masks and backdrop blend once as one logical shape.
        const filled = (p.fill ?? '#18181b') !== 'none';
        if (!filled) {
          clearTrim(record);
          attr(el, 'd', pathData(trim.commands));
          attr(el, 'stroke-dasharray', 'none');
        } else {
          const t = record.trimEl ?? (record.trimEl = doc.createElementNS(NS, 'path'));
          if (!record.trimGroup) {
            const group = doc.createElementNS(NS, 'g');
            group.setAttribute('data-explainerkit-id', node.id);
            group.style.isolation = 'isolate';
            el.parentNode?.insertBefore(group, el);
            group.appendChild(el);
            group.appendChild(t);
            record.trimGroup = group;
            el.removeAttribute('data-explainerkit-id');
          }
          for (const key of [
            'stroke',
            'stroke-width',
            'stroke-linecap',
            'stroke-linejoin',
            'stroke-miterlimit',
            'stroke-opacity',
          ]) {
            const v = el.getAttribute(key);
            if (v === null) t.removeAttribute(key);
            else attr(t, key, v);
          }
          for (const key of ['transform', 'opacity', 'clip-path', 'mask', 'filter']) {
            const value = el.getAttribute(key);
            if (value === null) record.trimGroup.removeAttribute(key);
            else attr(record.trimGroup, key, value);
            el.removeAttribute(key);
          }
          record.trimGroup.style.mixBlendMode = el.style.mixBlendMode;
          el.style.mixBlendMode = '';
          attr(t, 'fill', 'none');
          attr(t, 'd', pathData(trim.commands));
          t.setAttribute('data-explainerkit-trim', node.id);
          attr(el, 'stroke', 'none');
        }
      } else {
        clearTrim(record);
        if (trim) {
          attr(
            el,
            'stroke-dasharray',
            !trim.empty ? `${trim.visible} ${Math.max(0, trim.length - trim.visible)}` : 'none',
          );
          attr(el, 'stroke-dashoffset', trim.offset ?? 0);
        }
        if (trim?.empty) attr(el, 'stroke', 'none');
      }
    }
    if (node.type === 'text' && p.textOutline) {
      attr(el, 'd', pathData(p.textOutline));
      attr(el, 'aria-label', p.text);
      attr(el, 'role', 'img');
    }
    if (node.type === 'text' && !p.textOutline) {
      const lines = p.text.split(/\r?\n/);
      if (lines.length === 1) {
        if (el.textContent !== p.text || record.multiline) el.textContent = p.text;
        record.multiline = false;
      } else {
        el.textContent = '';
        record.multiline = true;
        for (let i = 0; i < lines.length; i++) {
          const line = doc.createElementNS(NS, 'tspan');
          attr(line, 'x', 0);
          attr(line, 'y', i * (p.fontSize ?? 16) * (p.lineHeight ?? 1.3));
          line.textContent = lines[i];
          el.appendChild(line);
        }
      }
      attr(el, 'font-size', p.fontSize ?? 16);
      attr(el, 'font-family', p.fontFamily ?? 'sans-serif');
      attr(el, 'font-weight', p.fontWeight ?? 400);
      attr(el, 'letter-spacing', p.letterSpacing ?? 0);
      attr(el, 'text-anchor', p.align ?? 'start');
      attr(el, 'dominant-baseline', p.baseline ?? 'alphabetic');
    }
    // WebKit otherwise masks overlapping children independently. Isolate the
    // source in a bounded viewport before the outer mask; an identity filter changes
    // partial-alpha screen blending in WebKit and is not equivalent in practice.
    if (node.type === 'group' && p.mask && !effect) {
      if (!record.maskGroup) {
        const group = doc.createElementNS(NS, 'svg');
        group.style.isolation = 'isolate';
        group.style.overflow = 'hidden';
        group.setAttribute('data-explainerkit-mask-source', '');
        while (el.firstChild) group.appendChild(el.firstChild);
        el.appendChild(group);
        record.maskGroup = group;
      }
      for (const key of ['x', 'y', 'width', 'height']) attr(record.maskGroup, key, p.mask.bounds[key]);
      attr(
        record.maskGroup,
        'viewBox',
        `${p.mask.bounds.x} ${p.mask.bounds.y} ${p.mask.bounds.width} ${p.mask.bounds.height}`,
      );
    } else if (record.maskGroup) {
      const group = record.maskGroup;
      while (group.firstChild) el.insertBefore(group.firstChild, group);
      group.remove();
      record.maskGroup = null;
    }
    if (node.type === 'cloud') points(node, record);
    else if (node.type !== 'text' || p.textOutline) reconcile(node.children ?? [], record.maskGroup ?? el);
    return record.trimGroup ?? el;
  }
  // Glow points share one soft radial gradient per color, defined inside the cloud's own group.
  function points(node, record) {
    const p = node.props,
      data = p.points,
      radius = p.pointSize ?? 2,
      shape = p.pointShape ?? 'circle',
      fill = rgbaOf(p.fill ?? '#18181b');
    attr(record.el, 'fill', 'none');
    attr(record.el, 'stroke', 'none');
    if (!record.pool) {
      record.pool = [];
      record.gradients = new Map();
      record.defs = doc.createElementNS(NS, 'defs');
      record.el.appendChild(record.defs);
    }
    const tag = shape === 'square' ? 'rect' : 'circle',
      used = new Set();
    const hex = (c) =>
      '#' +
      c
        .slice(0, 3)
        .map((v) =>
          Math.round(v * 255)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('');
    function gradient(c) {
      const key = hex(c);
      used.add(key);
      let id = record.gradients.get(key);
      if (!id) {
        do {
          id = `${prefix}-glow-${++resourceSequence}`;
        } while (doc.getElementById?.(id));
        const g = doc.createElementNS(NS, 'radialGradient');
        g.setAttribute('id', id);
        for (const t of [0, 0.25, 0.5, 0.75, 1]) {
          const stop = doc.createElementNS(NS, 'stop');
          stop.setAttribute('offset', t);
          stop.setAttribute('stop-color', key);
          stop.setAttribute('stop-opacity', (1 - t * t) ** 2);
          g.appendChild(stop);
        }
        record.defs.appendChild(g);
        record.gradients.set(key, id);
      }
      return `url(#${id})`;
    }
    for (let i = 0; i < data.count; i++) {
      let el = record.pool[i];
      if (!el || el.tagName.toLowerCase() !== tag) {
        const next = doc.createElementNS(NS, tag);
        if (el) el.replaceWith(next);
        else record.el.appendChild(next);
        el = record.pool[i] = next;
      }
      const x = data.positions[i * 2],
        y = data.positions[i * 2 + 1],
        r = data.radii ? data.radii[i] : radius;
      const c = data.colors
        ? [data.colors[i * 4], data.colors[i * 4 + 1], data.colors[i * 4 + 2], data.colors[i * 4 + 3]]
        : fill;
      if (tag === 'rect') {
        attr(el, 'x', x - r);
        attr(el, 'y', y - r);
        attr(el, 'width', 2 * r);
        attr(el, 'height', 2 * r);
      } else {
        attr(el, 'cx', x);
        attr(el, 'cy', y);
        attr(el, 'r', r);
      }
      attr(el, 'fill', shape === 'glow' ? gradient(c) : hex(c));
      attr(el, 'fill-opacity', c[3] * (p.fillOpacity ?? 1));
      el.style.mixBlendMode = p.pointBlend === 'add' ? 'plus-lighter' : '';
    }
    for (const el of record.pool.splice(data.count)) el.remove();
    for (const [key, id] of record.gradients)
      if (!used.has(key)) {
        doc.getElementById?.(id)?.remove();
        record.gradients.delete(key);
      }
  }
  function reconcile(children, parent) {
    let previous = null;
    for (const child of children) {
      const el = update(child, parent),
        cursor = previous ? previous.nextSibling : parent.firstChild;
      if (el !== cursor) parent.insertBefore(el, cursor);
      previous = el;
    }
  }
  return {
    element,
    stats,
    nativeLayer(id) {
      if (disposed) throw rendererError('Renderer has been disposed.');
      const record = nodes.get(id);
      if (!record || record.type !== 'group')
        throw rendererError('Native layers require a rendered group.', 'INVALID_NATIVE_LAYER');
      for (const lease of nativeLeases.values())
        if (lease.element === record.el || lease.element.contains?.(record.el) || record.el.contains?.(lease.element))
          throw rendererError('Native layer subtrees must not overlap.', 'DOM_OWNED');
      if (nativeLeases.size >= 64) throw rendererError('Use at most 64 native layers.', 'RESOURCE_LIMIT');
      let live = true;
      const lease = Object.freeze({
        element: record.el,
        dispose() {
          if (live) {
            live = false;
            nativeLeases.delete(id);
          }
        },
      });
      nativeLeases.set(id, lease);
      element.style.isolation = 'isolate';
      return lease;
    },
    render(frame) {
      if (disposed) throw rendererError('Renderer has been disposed.');
      if (frame.motionBlur) {
        const e = rendererError('SVG cannot average temporal samples.', 'RENDER_UNSUPPORTED');
        e.capability = 'motionBlur';
        throw e;
      }
      const prepared = prepareFrame(frame),
        live = prepared.ids;
      frame = prepared.frame;
      for (const [id, lease] of nativeLeases) {
        const visit = (list) => list.find((n) => n.id === id) || list.map((n) => visit(n.children ?? [])).find(Boolean),
          next = visit(frame.children);
        if (!next || next.type !== 'group' || nodes.get(id)?.el !== lease.element)
          throw rendererError('Release a native layer before removing or replacing its group.', 'NATIVE_LAYER_CHANGED');
      }
      trims = prepare2D(frame);
      effects = effectPlan(frame);
      // A mask-only group needs an isolated source group to composite its children before
      // WebKit applies the mask. Bound these extra raster surfaces before DOM edits.
      let maskWorkPixels = effects.workPixels;
      function checkMaskSurfaces(list, parent = [1, 0, 0, 1, 0, 0]) {
        for (const node of list) {
          const matrix = multiplyAffine(parent, localMatrix(node.props, node));
          if (node.type === 'group' && node.props.mask && !effects.has(node.id)) {
            const mask = node.props.mask.bounds,
              source = localBounds(node);
            // The viewport clips painted stroke/effect/text expansion to the mask.
            // Also reject excessive source geometry conservatively before rendering.
            const bounds = {
              width: Math.max(mask.x + mask.width, source.x + source.width) - Math.min(mask.x, source.x),
              height: Math.max(mask.y + mask.height, source.y + source.height) - Math.min(mask.y, source.y),
            };
            const width = Math.ceil(Math.abs(matrix[0]) * bounds.width + Math.abs(matrix[2]) * bounds.height);
            const height = Math.ceil(Math.abs(matrix[1]) * bounds.width + Math.abs(matrix[3]) * bounds.height);
            maskWorkPixels += 2 * width * height;
            if (!Number.isFinite(maskWorkPixels) || width > 8192 || height > 8192 || maskWorkPixels > 64000000)
              throw rendererError(
                'SVG mask isolation exceeds 8192 pixels per surface dimension or 64 million raster work pixels.',
                'RESOURCE_LIMIT',
              );
          }
          checkMaskSurfaces(node.children ?? [], matrix);
        }
      }
      checkMaskSurfaces(frame.children);
      stats.clampedFilters = effects.clampedFilters;
      films = filmPlan(frame);
      let needsIsolation = nativeLeases.size > 0;
      function checkBlends(list) {
        for (const node of list) {
          const p = node.props,
            blend = p.blend ?? 'normal',
            win = doc.defaultView,
            css = win?.CSS;
          if (
            p.clip?.units === 'bounds' &&
            (node.type === 'group' || node.type === 'cloud' || (node.type === 'text' && !p.textOutline))
          ) {
            const error = rendererError(
              'Bounds clips require exact shape geometry; use local clip coordinates for groups, clouds and native text.',
              'RENDER_UNSUPPORTED',
            );
            error.capability = 'clip.bounds.geometry';
            throw error;
          }
          if (blend !== 'normal') {
            needsIsolation = true;
            const mode = blend === 'add' ? 'plus-lighter' : blend;
            if (!('mixBlendMode' in element.style) || (css?.supports && !css.supports('mix-blend-mode', mode))) {
              const error = rendererError(
                `This SVG platform does not support ${blend} blending.`,
                'RENDER_UNSUPPORTED',
              );
              error.capability = `blend.${blend}`;
              throw error;
            }
          }
          if (win && (blurRadius(p.blur) > 0 || p.shade) && typeof win.SVGFEGaussianBlurElement !== 'function') {
            const error = rendererError('This SVG platform does not support Gaussian blur.', 'RENDER_UNSUPPORTED');
            error.capability = p.shade ? 'shade' : 'filter.blur';
            throw error;
          }
          if (win && p.glow && typeof win.SVGFEDropShadowElement !== 'function') {
            const error = rendererError('This SVG platform does not support glow filters.', 'RENDER_UNSUPPORTED');
            error.capability = 'filter.glow';
            throw error;
          }
          if (p.mask && css?.supports && !css.supports('mask-type', 'alpha')) {
            const error = rendererError('This SVG platform does not support alpha masks.', 'RENDER_UNSUPPORTED');
            error.capability = 'mask.alpha';
            throw error;
          }
          checkBlends(node.children ?? []);
        }
      }
      checkBlends(frame.children);
      function checkClouds(list) {
        for (const node of list) {
          if (node.type === 'cloud' && (node.props.opacity ?? 1) > 0 && node.props.points.count > MAX_SVG_POINTS) {
            const e = rendererError(
              `SVG draws at most ${MAX_SVG_POINTS} cloud points; use the Canvas renderer for GPU points.`,
              'RENDER_UNSUPPORTED',
            );
            e.capability = 'cloud.svgPoints';
            throw e;
          }
          checkClouds(node.children ?? []);
        }
      }
      checkClouds(frame.children);
      // Explicit isolation protects inline SVG blends from the host backdrop.
      // Avoid its extra WebKit raster pass when the scene has no blending.
      element.style.isolation = needsIsolation ? 'isolate' : '';
      attr(element, 'aria-description', frame.description ?? '');
      resourcesLive = new Set();
      attr(element, 'viewBox', `0 0 ${frame.width} ${frame.height}`);
      attr(element, 'width', frame.width);
      attr(element, 'height', frame.height);
      reconcile(frame.children, element);
      for (const [id, record] of nodes)
        if (!live.has(id)) {
          clearTrim(record);
          record.el.remove();
          nodes.delete(id);
        }
      for (const [key, record] of resources)
        if (!resourcesLive.has(key)) {
          record.el.remove();
          resources.delete(key);
        }
      if (defs && resources.size === 0) {
        defs.remove();
        defs = null;
      } else if (defs && defs.nextSibling !== null) element.appendChild(defs);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const lease of nativeLeases.values()) lease.dispose();
      nodes.clear();
      resources.clear();
      defs = null;
      element.remove();
    },
  };
}
