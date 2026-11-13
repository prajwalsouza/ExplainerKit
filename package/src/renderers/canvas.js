import { localMatrix, localBounds } from '../core/transform.js';
import {
  assertContainer,
  prepareFrame,
  rendererError,
  textContent,
  MAX_RASTER_PIXELS,
  MAX_SCRATCH_PIXELS,
  prepare2D,
} from './shared.js';
import { effectPlan, effectLayers, blurRadius } from '../graphics/look.js';
import { colorInterpolator } from '../color/interpolate.js';
import { filmPlan, motionFrames } from './film.js';
import { textureTile } from '../graphics/texture.js';
import { rgbaOf } from '../graphics/cloud.js';
import { createPointRasterizer } from './gpu-points.js';

/** Canvas projection of the same frame. Opacity applies after compositing. */
export function createCanvasRenderer(
  container,
  { label = 'ExplainerKit scene', pixelRatio = 1, points = 'auto', gpuThreshold = 1500 } = {},
) {
  assertContainer(container);
  if (!['auto', 'gpu', 'cpu'].includes(points)) throw rendererError('points must be auto, gpu or cpu.');
  if (!Number.isInteger(gpuThreshold) || gpuThreshold < 0)
    throw rendererError('gpuThreshold must be a nonnegative integer.');
  if (!Number.isFinite(pixelRatio) || pixelRatio < 0.25 || pixelRatio > 4)
    throw rendererError('Pixel ratio must be between 0.25 and 4.');
  const doc = container.ownerDocument;
  const element = doc.createElement('canvas');
  let context = element.getContext('2d');
  const visibleContext = context;
  const staging = doc.createElement('canvas');
  let surface = element;
  if (!context) throw rendererError('Canvas 2D is unavailable.');
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', label);
  element.style.width = '100%';
  element.style.height = 'auto';
  element.style.display = 'block';
  const semantics = doc.createElement('div');
  semantics.setAttribute('data-explainerkit-semantics', '');
  // Text is available to assistive technology without becoming a visible second scene.
  Object.assign(semantics.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'pre',
  });
  container.appendChild(element);
  container.appendChild(semantics);
  const scratch = [];
  let disposed = false;
  let layerWidth = 0,
    layerHeight = 0,
    layerPadding = 0;
  let trims = new Map();
  let films = new Map(),
    effects = new Map();
  const clipScopes = new WeakMap();
  const tileCache = new Map(),
    layerCache = new Map(),
    cacheRendering = new Set(),
    stats = { layerRenders: 0, cacheHits: 0, isolatedLayers: 0, clampedFilters: 0 };
  let cachePixels = 0,
    activeLight = null;
  const rasterizer = points === 'cpu' ? null : createPointRasterizer(doc);

  function relativeGradient(value, node, box = null) {
    const b =
      box ??
      localBounds(node?.props.textOutline ? { type: 'path', props: { commands: node.props.textOutline } } : node);
    if (b.width === 0 || b.height === 0) return null;
    const dx = value.x2 - value.x1,
      dy = value.y2 - value.y1,
      q = Math.max(Math.abs(dx), Math.abs(dy)),
      ux = dx / q,
      uy = dy / q,
      nx = ux / b.width,
      ny = uy / b.height,
      factor = (q * (ux * ux + uy * uy)) / (nx * nx + ny * ny),
      x1 = b.x + b.width * value.x1,
      y1 = b.y + b.height * value.y1;
    const result = { x1, y1, x2: x1 + nx * factor, y2: y1 + ny * factor };
    if (
      b.width < 1e-12 ||
      b.height < 1e-12 ||
      !Object.values(result).every(Number.isFinite) ||
      (result.x1 === result.x2 && result.y1 === result.y2)
    ) {
      const e = rendererError(
        'The bounds gradient cannot be represented at supported Canvas precision.',
        'RENDER_UNSUPPORTED',
      );
      e.capability = 'paint.bounds.precision';
      throw e;
    }
    return result;
  }
  function paint(value, ctx, nodeId, node = null, box = null) {
    if (value?.type === 'texture') {
      const key = JSON.stringify(value);
      let tile = tileCache.get(key);
      if (!tile) {
        tile = doc.createElement('canvas');
        tile.width = tile.height = 32;
        const t = tile.getContext('2d');
        for (const cell of textureTile(value).cells) {
          t.globalAlpha = cell.alpha;
          t.fillStyle = cell.color ?? value.color;
          t.fillRect(cell.x, cell.y, 1, 1);
        }
        if (tileCache.size >= 64) tileCache.delete(tileCache.keys().next().value);
        tileCache.set(key, tile);
      }
      const pattern = ctx.createPattern(tile, 'repeat'),
        m = value.space === 'screen' ? films.get(nodeId).inverse : [1, 0, 0, 1, 0, 0];
      pattern.setTransform({
        a: m[0] * value.scale,
        b: m[1] * value.scale,
        c: m[2] * value.scale,
        d: m[3] * value.scale,
        e: m[4],
        f: m[5],
      });
      return pattern;
    }
    if (typeof value === 'string') return value.toLowerCase() === 'none' ? 'transparent' : value;
    let coordinates = value;
    if (value.units === 'bounds') {
      coordinates = relativeGradient(value, node, box);
      if (!coordinates) return 'transparent';
    }
    const gradient =
      value.type === 'linear'
        ? ctx.createLinearGradient(coordinates.x1, coordinates.y1, coordinates.x2, coordinates.y2)
        : ctx.createRadialGradient(value.x, value.y, 0, value.x, value.y, value.r);
    for (const stop of value.stops) gradient.addColorStop(stop.offset, stop.color);
    return gradient;
  }
  function commands(path, ctx) {
    for (const command of path) {
      if (command[0] === 'M') ctx.moveTo(command[1], command[2]);
      else if (command[0] === 'L') ctx.lineTo(command[1], command[2]);
      else if (command[0] === 'C')
        ctx.bezierCurveTo(command[1], command[2], command[3], command[4], command[5], command[6]);
      else if (command[0] === 'Q') ctx.quadraticCurveTo(command[1], command[2], command[3], command[4]);
      else ctx.closePath();
    }
  }
  function rectangle(ctx, x, y, w, h, r = 0) {
    r = Math.min(r, w / 2, h / 2);
    if (r === 0) {
      ctx.rect(x, y, w, h);
      return;
    }
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  function clip(value, ctx, node) {
    if (!value) return;
    ctx.beginPath();
    if (value.type === 'rect') rectangle(ctx, value.x, value.y, value.width, value.height, value.rx);
    else if (value.type === 'circle') ctx.arc(value.x, value.y, value.r, 0, Math.PI * 2);
    else if (value.units === 'bounds') {
      const bounds = localBounds(node);
      if (bounds.width > 0 && bounds.height > 0) {
        ctx.save();
        ctx.transform(bounds.width, 0, 0, bounds.height, bounds.x, bounds.y);
        commands(value.commands, ctx);
        ctx.restore();
      }
    } else commands(value.commands, ctx);
    ctx.clip(value.fillRule ?? 'nonzero');
  }

  // Small clouds draw as 2D paths; large ones go through the WebGL rasterizer when the platform has it.
  function cloud(p, ctx) {
    const data = p.points,
      radius = p.pointSize ?? 2,
      shape = p.pointShape ?? 'circle',
      blend = p.pointBlend ?? 'normal',
      fill = rgbaOf(p.fill ?? '#18181b');
    if (!data.count) return;
    const m = ctx.getTransform(),
      scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
    if (rasterizer && (points === 'gpu' || data.count >= gpuThreshold) && rasterizer.accepts(data, radius, scale)) {
      rasterizer.draw(ctx, data, { radius, shape, color: fill, blend });
      return;
    }
    if (points === 'gpu')
      throw rendererError('GPU points are unavailable for this cloud on this platform.', 'RENDER_UNSUPPORTED');
    ctx.save();
    if (blend === 'add') ctx.globalCompositeOperation = 'lighter';
    const rgba = (i) =>
      data.colors ? [data.colors[i * 4], data.colors[i * 4 + 1], data.colors[i * 4 + 2], data.colors[i * 4 + 3]] : fill;
    const css = ([r, g, b, a]) => `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;
    for (let i = 0; i < data.count; i++) {
      const x = data.positions[i * 2],
        y = data.positions[i * 2 + 1],
        r = data.radii ? data.radii[i] : radius,
        c = rgba(i);
      if (r <= 0 || c[3] <= 0) continue;
      if (shape === 'glow') {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        for (const t of [0, 0.25, 0.5, 0.75, 1]) g.addColorStop(t, css([c[0], c[1], c[2], c[3] * (1 - t * t) ** 2]));
        ctx.fillStyle = g;
      } else ctx.fillStyle = css(c);
      ctx.beginPath();
      if (shape === 'square') ctx.rect(x - r, y - r, 2 * r, 2 * r);
      else ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  function contents(node, ctx, depth) {
    const p = node.props;
    if (node.type === 'group') {
      for (const child of node.children ?? []) draw(child, ctx, depth);
      return;
    }
    if (node.type === 'cloud') {
      ctx.save();
      ctx.globalAlpha *= p.fillOpacity ?? 1;
      cloud(p, ctx);
      ctx.restore();
      return;
    }
    ctx.fillStyle = paint(p.fill ?? (node.type === 'line' ? 'none' : '#18181b'), ctx, node.id, node);
    ctx.strokeStyle = paint(p.stroke ?? (node.type === 'line' ? '#18181b' : 'none'), ctx, node.id, node);
    ctx.lineWidth = p.strokeWidth ?? 1;
    if (typeof ctx.setLineDash === 'function') ctx.setLineDash(p.strokeDasharray ?? []);
    ctx.lineDashOffset = p.strokeDashoffset ?? 0;
    ctx.lineCap = p.strokeLinecap ?? 'butt';
    ctx.lineJoin = p.strokeLinejoin ?? 'miter';
    ctx.miterLimit = p.strokeMiterlimit ?? 4;
    const isPaint = (value) => typeof value !== 'string' || value.toLowerCase() !== 'none';
    const alpha = ctx.globalAlpha,
      fillInk = (fn) => {
        ctx.globalAlpha = alpha * (p.fillOpacity ?? 1);
        try {
          fn();
        } finally {
          ctx.globalAlpha = alpha;
        }
      },
      strokeInk = (fn) => {
        ctx.globalAlpha = alpha * (p.strokeOpacity ?? 1);
        try {
          fn();
        } finally {
          ctx.globalAlpha = alpha;
        }
      };
    const halo = (fn) => {
      if (!p.halo) return;
      ctx.save();
      ctx.strokeStyle = p.halo.color;
      ctx.lineWidth = 2 * p.halo.width;
      ctx.lineJoin = 'round';
      strokeInk(fn);
      ctx.restore();
    };
    const fill = isPaint(p.fill ?? (node.type === 'line' ? 'none' : '#18181b'));
    const stroke = isPaint(p.stroke ?? (node.type === 'line' ? '#18181b' : 'none')) && (p.strokeWidth ?? 1) > 0;
    if (node.type === 'text' && p.textOutline) {
      ctx.beginPath();
      commands(p.textOutline, ctx);
      halo(() => ctx.stroke());
      if (fill) fillInk(() => ctx.fill(p.fillRule ?? 'nonzero'));
      if (stroke) strokeInk(() => ctx.stroke());
      return;
    }
    if (node.type === 'text') {
      ctx.font = `${p.fontWeight ?? 400} ${p.fontSize ?? 16}px ${p.fontFamily ?? 'sans-serif'}`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${p.letterSpacing ?? 0}px`;
      ctx.textAlign = { start: 'left', middle: 'center', end: 'right' }[p.align ?? 'start'];
      ctx.textBaseline = p.baseline ?? 'alphabetic';
      for (const [i, line] of p.text.split(/\r?\n/).entries()) {
        const y = i * (p.fontSize ?? 16) * (p.lineHeight ?? 1.3);
        halo(() => ctx.strokeText(line, 0, y));
        if (fill) fillInk(() => ctx.fillText(line, 0, y));
        if (stroke) strokeInk(() => ctx.strokeText(line, 0, y));
      }
      return;
    }
    ctx.beginPath();
    if (node.type === 'circle') ctx.arc(0, 0, p.r ?? 0, 0, Math.PI * 2);
    if (node.type === 'rect') {
      rectangle(ctx, 0, 0, p.width ?? 0, p.height ?? 0, p.rx ?? 0);
    }
    if (node.type === 'line') {
      ctx.moveTo(p.x1 ?? 0, p.y1 ?? 0);
      ctx.lineTo(p.x2 ?? 0, p.y2 ?? 0);
    }
    if (node.type === 'path') commands(p.commands, ctx);
    if (fill && node.type !== 'line') fillInk(() => ctx.fill(p.fillRule ?? 'nonzero'));
    if (stroke) {
      const trim = trims.get(node.id);
      if (!trim?.empty) {
        if (trim?.commands) {
          ctx.beginPath();
          commands(trim.commands, ctx);
          ctx.setLineDash([]);
        } else if (trim) {
          ctx.setLineDash([trim.visible, Math.max(0, trim.length - trim.visible)]);
          ctx.lineDashOffset = trim.offset;
        }
        strokeInk(() => ctx.stroke());
      }
    }
  }
  // Only bypass isolation when the clip cannot affect any painted pixel. Native
  // clip/fill antialiasing can differ when their edges meet, so an overlap or an
  // uncertain Bezier bound always keeps the original isolated composition.
  function clipContainsPaint(node, ctx) {
    const p = node.props,
      value = p.clip;
    if (
      !ctx ||
      node.type !== 'path' ||
      value?.units === 'bounds' ||
      (p.opacity ?? 1) === 1 ||
      p.stroke !== 'none' ||
      p.halo ||
      !value ||
      typeof ctx.isPointInPath !== 'function'
    )
      return false;
    const b = localBounds(node),
      m = ctx.getTransform(),
      determinant = m.a * m.d - m.b * m.c;
    if (!Number.isFinite(determinant) || determinant === 0) return false;
    const mx = (2 * (Math.abs(m.d) + Math.abs(m.c))) / Math.abs(determinant);
    const my = (2 * (Math.abs(m.b) + Math.abs(m.a))) / Math.abs(determinant);
    const box = { left: b.x - mx, top: b.y - my, right: b.x + b.width + mx, bottom: b.y + b.height + my };
    if (!Object.values(box).every(Number.isFinite)) return false;
    const cx = b.x + b.width / 2,
      cy = b.y + b.height / 2;
    const px = m.a * cx + m.c * cy + m.e,
      py = m.b * cx + m.d * cy + m.f;
    if (!Number.isFinite(px) || !Number.isFinite(py)) return false;
    // clip() just constructed the current path in the destination coordinate system.
    if (!ctx.isPointInPath(px, py, value.fillRule ?? 'nonzero')) return false;
    if (value.type === 'rect') {
      const inset = value.rx ?? 0;
      return (
        box.left > value.x + inset &&
        box.top > value.y + inset &&
        box.right < value.x + value.width - inset &&
        box.bottom < value.y + value.height - inset
      );
    }
    if (value.type === 'circle')
      return [
        [box.left, box.top],
        [box.right, box.top],
        [box.left, box.bottom],
        [box.right, box.bottom],
      ].every(([x, y]) => Math.hypot(x - value.x, y - value.y) < value.r);
    let remaining = 256;
    const away = (controlPoints, depth = 0) => {
      if (--remaining < 0) return false;
      const xs = controlPoints.map((v) => v[0]),
        ys = controlPoints.map((v) => v[1]);
      if (
        Math.max(...xs) < box.left ||
        Math.min(...xs) > box.right ||
        Math.max(...ys) < box.top ||
        Math.min(...ys) > box.bottom
      )
        return true;
      if (controlPoints.length === 2 || depth === 8) return false;
      const left = [controlPoints[0]],
        right = [controlPoints.at(-1)];
      let row = controlPoints;
      while (row.length > 1) {
        row = row.slice(1).map((v, i) => [(row[i][0] + v[0]) / 2, (row[i][1] + v[1]) / 2]);
        left.push(row[0]);
        right.unshift(row.at(-1));
      }
      return away(left, depth + 1) && away(right, depth + 1);
    };
    let previous = null,
      start = null;
    for (const command of value.commands) {
      if (command[0] === 'M') {
        if (previous && start && !away([previous, start])) return false;
        previous = start = [command[1], command[2]];
      } else if (command[0] === 'Z') {
        if (previous && start && !away([previous, start])) return false;
        previous = start;
      } else {
        if (!previous) return false;
        const controlPoints = [previous];
        for (let i = 1; i < command.length; i += 2) controlPoints.push([command[i], command[i + 1]]);
        if (!away(controlPoints)) return false;
        previous = controlPoints.at(-1);
      }
    }
    return !previous || !start || away([previous, start]);
  }
  function directOpacity(node, ctx = null, inheritedClip = false) {
    const p = node.props;
    if (
      ctx &&
      !inheritedClip &&
      node.type === 'group' &&
      (p.opacity ?? 1) !== 1 &&
      node.children?.length === 1 &&
      !p.clip &&
      !p.blur &&
      !p.glow &&
      !p.mask &&
      !p.shade &&
      !p.texture &&
      (p.blend ?? 'normal') === 'normal'
    ) {
      const child = node.children[0];
      // A one-paint child has nothing to overlap. Never push opacity into a child
      // that isolates, caches, carries effects, or paints text/halo/cloud content.
      if (
        ['path', 'rect', 'circle', 'line'].includes(child.type) &&
        !child.layerCache &&
        (child.props.opacity ?? 1) === 1 &&
        !child.props.halo &&
        directOpacity(child)
      )
        return true;
    }
    if (
      node.type === 'group' ||
      node.type === 'cloud' ||
      node.children?.length ||
      (p.blur && blurRadius(p.blur) > 0) ||
      p.glow ||
      p.mask ||
      p.shade ||
      p.texture ||
      p.fill?.type === 'texture' ||
      p.stroke?.type === 'texture' ||
      (p.clip && (inheritedClip || !clipContainsPaint(node, ctx))) ||
      (p.blend ?? 'normal') !== 'normal'
    )
      return false;
    const fill = node.type !== 'line' && (p.fill ?? '#18181b') !== 'none',
      stroke = (p.stroke ?? (node.type === 'line' ? '#18181b' : 'none')) !== 'none' && (p.strokeWidth ?? 1) > 0;
    return fill !== stroke;
  }
  function draw(node, ctx, depth) {
    if (node.layerCache && !cacheRendering.has(node.id)) {
      const b = node.layerCache.bounds,
        m = ctx.getTransform(),
        hasScreen = (n) =>
          [n.props.texture, n.props.fill, n.props.stroke].some((t) => t?.type === 'texture' && t.space === 'screen') ||
          (n.children ?? []).some(hasScreen),
        signature = JSON.stringify([
          node.props,
          node.children,
          b,
          activeLight,
          [m.a, m.b, m.c, m.d, ...(hasScreen(node) ? [m.e, m.f] : [])],
          pixelRatio,
          layerPadding,
        ]);
      let entry = layerCache.get(node.id);
      if (entry?.signature === signature) {
        stats.cacheHits++;
        layerCache.delete(node.id);
        layerCache.set(node.id, entry);
      } else {
        const w = Math.ceil(b.width * pixelRatio) + 2 * layerPadding,
          h = Math.ceil(b.height * pixelRatio) + 2 * layerPadding;
        const canvas = doc.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const target = canvas.getContext('2d');
        target.setTransform(
          pixelRatio,
          0,
          0,
          pixelRatio,
          layerPadding - b.x * pixelRatio,
          layerPadding - b.y * pixelRatio,
        );
        cacheRendering.add(node.id);
        try {
          draw(node, target, depth);
        } finally {
          cacheRendering.delete(node.id);
        }
        stats.layerRenders++;
        if (entry) cachePixels -= entry.pixels;
        entry = { signature, canvas, pixels: w * h, bounds: b };
        layerCache.set(node.id, entry);
        cachePixels += entry.pixels;
        while (cachePixels > MAX_SCRATCH_PIXELS && layerCache.size) {
          const id = layerCache.keys().next().value,
            v = layerCache.get(id);
          layerCache.delete(id);
          cachePixels -= v.pixels;
          v.canvas.width = v.canvas.height = 0;
        }
      }
      ctx.drawImage(
        entry.canvas,
        b.x - layerPadding / pixelRatio,
        b.y - layerPadding / pixelRatio,
        entry.canvas.width / pixelRatio,
        entry.canvas.height / pixelRatio,
      );
      return;
    }
    const p = node.props,
      opacity = p.opacity ?? 1;
    if (opacity === 0) return;
    const inheritedClip = clipScopes.get(ctx) ?? false;
    ctx.save();
    if (p.pivot || p.skewX || p.skewY) ctx.transform(...localMatrix(p, node));
    else {
      ctx.translate(p.x ?? 0, p.y ?? 0);
      ctx.rotate(p.rotation ?? 0);
      ctx.scale(p.scaleX ?? 1, p.scaleY ?? 1);
    }
    // Apply once at the destination, after any isolated layer is composited.
    if (p.clip) ctx.save();
    clip(p.clip, ctx, node);
    const direct = directOpacity(node, ctx, inheritedClip);
    let appliedClip = !!p.clip;
    if (direct && appliedClip) {
      // A proven inactive clip must also leave the native paint rasterizer alone.
      // Complex clipping can select a different AA path even at fully covered pixels.
      ctx.restore();
      appliedClip = false;
    }
    clipScopes.set(ctx, inheritedClip || appliedClip);
    const layers = direct ? 0 : effectLayers(p);
    if (layers) {
      stats.isolatedLayers++;
      const layer = scratch[depth];
      const off = layer.context;
      off.setTransform(1, 0, 0, 1, 0, 0);
      off.clearRect(0, 0, layerWidth, layerHeight);
      off.setTransform(ctx.getTransform());
      if (ctx === context) {
        const m = ctx.getTransform();
        off.setTransform(
          m.a ?? m[0],
          m.b ?? m[1],
          m.c ?? m[2],
          m.d ?? m[3],
          (m.e ?? m[4]) + layerPadding,
          (m.f ?? m[5]) + layerPadding,
        );
      }
      off.globalAlpha = 1;
      off.globalCompositeOperation = 'source-over';
      if ('filter' in off) off.filter = 'none';
      contents(node, off, depth + layers);
      let output = layer,
        index = depth + 1;
      if (p.shade || p.texture) {
        const plan = films.get(node.id),
          base = scratch[index],
          mask = scratch[index + (p.shade ? 1 : 0)],
          shifted = p.shade ? scratch[index + 2] : null;
        const clear = (target) => {
          target.setTransform(1, 0, 0, 1, 0, 0);
          target.globalAlpha = 1;
          target.globalCompositeOperation = 'source-over';
          target.filter = 'none';
          target.clearRect(0, 0, layerWidth, layerHeight);
        };
        if (p.shade) {
          clear(base.context);
          base.context.drawImage(layer.canvas, 0, 0);
        }
        const original = p.shade ? base : layer,
          m = off.getTransform();
        for (const pass of plan.passes) {
          const a = mask.context,
            b = shifted.context;
          clear(b);
          const scale = Math.hypot(off.getTransform().a, off.getTransform().b);
          b.filter = `blur(${pass.blur * scale}px)`;
          b.drawImage(original.canvas, m.a * pass.dx + m.c * pass.dy, m.b * pass.dx + m.d * pass.dy);
          b.filter = 'none';
          clear(a);
          a.drawImage(original.canvas, 0, 0);
          a.globalCompositeOperation = 'destination-out';
          a.drawImage(shifted.canvas, 0, 0);
          a.globalCompositeOperation = 'source-in';
          a.fillStyle = pass.color;
          a.fillRect(0, 0, layerWidth, layerHeight);
          off.save();
          off.setTransform(1, 0, 0, 1, 0, 0);
          off.globalAlpha = pass.amount;
          off.drawImage(mask.canvas, 0, 0);
          off.restore();
        }
        const overlay = (fill) => {
          const a = mask.context;
          clear(a);
          a.setTransform(m);
          a.fillStyle = fill(a);
          const inv = m.inverse(),
            corners = [
              [0, 0],
              [layerWidth, 0],
              [0, layerHeight],
              [layerWidth, layerHeight],
            ].map(([x, y]) => ({ x: inv.a * x + inv.c * y + inv.e, y: inv.b * x + inv.d * y + inv.f }));
          const x = Math.min(...corners.map((corner) => corner.x)),
            y = Math.min(...corners.map((corner) => corner.y));
          a.fillRect(
            x,
            y,
            Math.max(...corners.map((corner) => corner.x)) - x,
            Math.max(...corners.map((corner) => corner.y)) - y,
          );
          a.setTransform(1, 0, 0, 1, 0, 0);
          a.globalCompositeOperation = 'destination-in';
          a.drawImage(original.canvas, 0, 0);
          off.save();
          off.setTransform(1, 0, 0, 1, 0, 0);
          off.globalAlpha = 1;
          off.drawImage(mask.canvas, 0, 0);
          off.restore();
        };
        if (p.shade?.highlight) {
          const h = p.shade.highlight;
          overlay((a) => {
            const g = a.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r);
            g.addColorStop(0, colorInterpolator(h.color ?? plan.light.color, 'transparent')(1 - h.amount));
            g.addColorStop(1, 'transparent');
            return g;
          });
        }
        if (p.texture) {
          overlay((a) => paint(p.texture, a, node.id));
        }
        index += p.shade ? 3 : 1;
      }
      if (blurRadius(p.blur) > 0 || p.glow) {
        const filtered = scratch[index++],
          target = filtered.context,
          scale = Math.hypot(off.getTransform().a, off.getTransform().b);
        target.setTransform(1, 0, 0, 1, 0, 0);
        target.globalAlpha = 1;
        target.globalCompositeOperation = 'source-over';
        target.filter = 'none';
        target.clearRect(0, 0, layerWidth, layerHeight);
        const filters = [];
        if (blurRadius(p.blur) > 0) filters.push(`blur(${effects.get(node.id).blur * scale}px)`);
        if (p.glow) {
          const glowColor = colorInterpolator(p.glow.color, 'transparent')(1 - p.glow.opacity);
          filters.push(`drop-shadow(0px 0px ${effects.get(node.id).glow.blur * scale}px ${glowColor})`);
        }
        target.filter = filters.join(' ');
        target.drawImage(output.canvas, 0, 0);
        target.filter = 'none';
        output = filtered;
      }
      if (p.mask) {
        const mask = scratch[index],
          target = mask.context,
          bounds = p.mask.bounds;
        target.setTransform(1, 0, 0, 1, 0, 0);
        target.globalAlpha = 1;
        target.globalCompositeOperation = 'source-over';
        if ('filter' in target) target.filter = 'none';
        target.clearRect(0, 0, layerWidth, layerHeight);
        target.setTransform(ctx.getTransform());
        if (ctx === context) {
          const m = ctx.getTransform();
          target.setTransform(
            m.a ?? m[0],
            m.b ?? m[1],
            m.c ?? m[2],
            m.d ?? m[3],
            (m.e ?? m[4]) + layerPadding,
            (m.f ?? m[5]) + layerPadding,
          );
        }
        target.fillStyle = paint(p.mask.gradient, target, node.id, node, bounds);
        target.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
        const composite = output.context;
        composite.save();
        composite.setTransform(1, 0, 0, 1, 0, 0);
        composite.globalAlpha = 1;
        composite.globalCompositeOperation = 'destination-in';
        composite.drawImage(mask.canvas, 0, 0);
        composite.restore();
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = opacity;
      ctx.globalCompositeOperation = { normal: 'source-over', add: 'lighter', multiply: 'multiply', screen: 'screen' }[
        p.blend ?? 'normal'
      ];
      ctx.drawImage(output.canvas, ctx === context ? -layerPadding : 0, ctx === context ? -layerPadding : 0);
    } else {
      ctx.globalAlpha *= opacity;
      contents(node, ctx, depth);
    }
    if (appliedClip) ctx.restore();
    ctx.restore();
    clipScopes.set(ctx, inheritedClip);
  }
  function isolationDepth(nodes, current = 0) {
    let result = current;
    for (const node of nodes) {
      if ((node.props.opacity ?? 1) === 0) continue;
      const next = current + (directOpacity(node) ? 0 : effectLayers(node.props));
      result = Math.max(result, next, isolationDepth(node.children ?? [], next));
    }
    return result;
  }
  function checkTextCapabilities(nodes) {
    for (const node of nodes) {
      if ((node.props.opacity ?? 1) === 0) continue;
      if (
        node.props.clip?.units === 'bounds' &&
        (node.type === 'group' || node.type === 'cloud' || (node.type === 'text' && !node.props.textOutline))
      ) {
        const error = rendererError(
          'Bounds clips require explicit shape geometry or outlined text.',
          'RENDER_UNSUPPORTED',
        );
        error.capability = 'clip.bounds.geometry';
        throw error;
      }
      if (node.props.strokeDasharray?.some((v) => v > 0) && typeof context.setLineDash !== 'function') {
        const e = rendererError('Canvas dash patterns are unavailable.', 'RENDER_UNSUPPORTED');
        e.capability = 'stroke.dashes';
        throw e;
      }
      if (node.type === 'text' && (node.props.letterSpacing ?? 0) !== 0 && !('letterSpacing' in context)) {
        const error = rendererError(
          'This Canvas 2D context does not support nonzero letterSpacing; use SVG or set tracking to zero.',
          'RENDER_UNSUPPORTED',
        );
        error.capability = 'text.letterSpacing';
        throw error;
      }
      if (
        node.type === 'text' &&
        !node.props.textOutline &&
        ['fill', 'stroke'].some((key) => node.props[key]?.units === 'bounds')
      ) {
        const e = rendererError(
          'Bounds gradients on native text require an imported outline for deterministic ink bounds.',
          'RENDER_UNSUPPORTED',
        );
        e.capability = 'paint.bounds.text';
        throw e;
      }
      for (const key of ['fill', 'stroke'])
        if (node.props[key] && typeof node.props[key] === 'object') {
          if (node.props[key].units === 'bounds') relativeGradient(node.props[key], node);
          const method =
            node.props[key].type === 'texture'
              ? 'createPattern'
              : node.props[key].type === 'linear'
                ? 'createLinearGradient'
                : 'createRadialGradient';
          if (typeof context[method] !== 'function')
            throw rendererError(`This Canvas 2D context does not support ${method}.`, 'RENDER_UNSUPPORTED');
        }
      if (
        (node.props.texture || node.props.fill?.type === 'texture' || node.props.stroke?.type === 'texture') &&
        (typeof context.createPattern !== 'function' ||
          typeof doc.defaultView?.CanvasPattern?.prototype?.setTransform !== 'function')
      ) {
        const e = rendererError('Canvas texture pattern transforms are unavailable.', 'RENDER_UNSUPPORTED');
        e.capability = 'texture';
        throw e;
      }
      if (node.props.clip && typeof context.clip !== 'function')
        throw rendererError('This Canvas 2D context does not support clipping.', 'RENDER_UNSUPPORTED');
      if (
        (blurRadius(node.props.blur) > 0 || node.props.glow || node.props.shade) &&
        typeof context.filter !== 'string'
      ) {
        const e = rendererError('This Canvas 2D context does not support filters.', 'RENDER_UNSUPPORTED');
        e.capability = node.props.shade ? 'shade' : node.props.glow ? 'filter.glow' : 'filter.blur';
        throw e;
      }
      if (node.props.mask?.gradient.units === 'bounds')
        relativeGradient(node.props.mask.gradient, node, node.props.mask.bounds);
      if (node.props.mask) {
        const method = node.props.mask.gradient.type === 'linear' ? 'createLinearGradient' : 'createRadialGradient';
        if (typeof context[method] !== 'function' || typeof context.fillRect !== 'function')
          throw rendererError('This Canvas context does not support gradient alpha masks.', 'RENDER_UNSUPPORTED');
      }
      const modes = [];
      if ((node.props.blend ?? 'normal') !== 'normal')
        modes.push({ add: 'lighter', multiply: 'multiply', screen: 'screen' }[node.props.blend]);
      if (node.props.mask || node.props.texture) modes.push('destination-in');
      if (node.props.shade) modes.push('destination-out', 'source-in', 'destination-in');
      for (const mode of modes) {
        const prior = context.globalCompositeOperation;
        let accepted = false;
        try {
          context.globalCompositeOperation = mode;
          accepted = context.globalCompositeOperation === mode;
        } finally {
          context.globalCompositeOperation = prior;
        }
        if (!accepted)
          throw rendererError(`This Canvas platform does not support ${mode} compositing.`, 'RENDER_UNSUPPORTED');
      }
      if (node.props.shade?.highlight && typeof context.createRadialGradient !== 'function')
        throw rendererError('Canvas highlight gradients are unavailable.', 'RENDER_UNSUPPORTED');
      checkTextCapabilities(node.children ?? []);
    }
  }
  function renderSingle(prepared) {
    effects = prepared.effects;
    stats.clampedFilters = effects.clampedFilters;
    stats.isolatedLayers = 0;
    const { frame, trims: nextTrims, films: nextFilms, width, height, padding, offWidth, offHeight, depth } = prepared;
    films = nextFilms;
    activeLight = frame.light ?? null;
    trims = nextTrims;
    // Validate and allocate before clearing the previous frame.
    for (let i = 0; i < depth; i++) {
      if (!scratch[i]) {
        const canvas = doc.createElement('canvas');
        const scratchContext = canvas.getContext('2d');
        if (!scratchContext) throw rendererError('Canvas opacity isolation is unavailable.');
        scratch[i] = { canvas, context: scratchContext };
      }
      if (scratch[i].canvas.width !== offWidth) scratch[i].canvas.width = offWidth;
      if (scratch[i].canvas.height !== offHeight) scratch[i].canvas.height = offHeight;
    }
    for (const old of scratch.splice(depth)) {
      old.canvas.width = 0;
      old.canvas.height = 0;
    }
    layerWidth = offWidth;
    layerHeight = offHeight;
    layerPadding = padding;
    if (surface.width !== width) surface.width = width;
    if (surface.height !== height) surface.height = height;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    if ('filter' in context) context.filter = 'none';
    for (const node of frame.children) draw(node, context, 0);
    return frame;
  }
  function preflight(frame) {
    const captured = prepareFrame(frame).frame,
      nextTrims = prepare2D(captured);
    if ([...nextTrims.values()].some((t) => t && !t.empty) && typeof context.setLineDash !== 'function')
      throw rendererError('This Canvas context does not support stroke trimming.', 'RENDER_UNSUPPORTED');
    checkTextCapabilities(captured.children);
    const plan = effectPlan(captured),
      nextFilms = filmPlan(captured);
    const width = Math.ceil(captured.width * pixelRatio),
      height = Math.ceil(captured.height * pixelRatio),
      padding = Math.ceil(plan.padding * pixelRatio),
      w = width + 2 * padding,
      h = height + 2 * padding,
      depth = isolationDepth(captured.children);
    if (
      width > 8192 ||
      height > 8192 ||
      w > 8192 ||
      h > 8192 ||
      width * height > MAX_RASTER_PIXELS ||
      w * h * depth > MAX_SCRATCH_PIXELS
    )
      throw rendererError('Canvas raster or effect-isolation budget exceeded.');
    const caches = (nodes) => {
      for (const n of nodes) {
        if (n.layerCache) {
          const b = n.layerCache.bounds,
            cw = Math.ceil(b.width * pixelRatio) + 2 * padding,
            ch = Math.ceil(b.height * pixelRatio) + 2 * padding;
          if (cw > 8192 || ch > 8192 || cw * ch > MAX_SCRATCH_PIXELS)
            throw rendererError('Layer cache raster budget exceeded.');
        }
        caches(n.children ?? []);
      }
    };
    caches(captured.children);
    return {
      frame: captured,
      trims: nextTrims,
      effects: plan,
      films: nextFilms,
      width,
      height,
      padding,
      offWidth: w,
      offHeight: h,
      depth,
    };
  }
  const accumulation = doc.createElement('canvas');
  return {
    element,
    stats,
    render(frame) {
      if (disposed) throw rendererError('Renderer has been disposed.');
      const samples = motionFrames(frame).map((sample) => ({ ...sample, prepared: preflight(sample.frame) }));
      const width = Math.ceil(frame.width * pixelRatio),
        height = Math.ceil(frame.height * pixelRatio);
      if (
        samples.length > 1 &&
        samples.reduce((total, s) => total + width * height + s.prepared.effects.workPixels, 0) > 64000000
      ) {
        const e = rendererError('Motion blur exceeds 64 million sample pixels.', 'RESOURCE_LIMIT');
        e.capability = 'motionBlur';
        throw e;
      }
      if (samples.length === 1) {
        renderSingle(samples[0].prepared);
        element.setAttribute('aria-description', frame.description ?? '');
        semantics.textContent = [frame.description, textContent(samples[0].frame)].filter(Boolean).join('\n');
        return;
      }
      accumulation.width = width;
      accumulation.height = height;
      const average = accumulation.getContext('2d');
      average.globalCompositeOperation = 'lighter';
      context = staging.getContext('2d');
      surface = staging;
      try {
        for (const sample of samples) {
          renderSingle(sample.prepared);
          average.globalAlpha = sample.weight;
          average.drawImage(staging, 0, 0);
        }
      } finally {
        context = visibleContext;
        surface = element;
      }
      if (element.width !== width) element.width = width;
      if (element.height !== height) element.height = height;
      visibleContext.setTransform(1, 0, 0, 1, 0, 0);
      visibleContext.globalAlpha = 1;
      visibleContext.globalCompositeOperation = 'copy';
      visibleContext.drawImage(accumulation, 0, 0);
      visibleContext.globalCompositeOperation = 'source-over';
      element.setAttribute('aria-description', frame.description ?? '');
      semantics.textContent = [frame.description, textContent(samples[0].frame)].filter(Boolean).join('\n');
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const layer of scratch) {
        layer.canvas.width = 0;
        layer.canvas.height = 0;
      }
      scratch.length = 0;
      rasterizer?.dispose();
      for (const entry of layerCache.values()) {
        entry.canvas.width = entry.canvas.height = 0;
      }
      layerCache.clear();
      tileCache.clear();
      element.width = 0;
      element.height = 0;
      staging.width = staging.height = accumulation.width = accumulation.height = 0;
      element.remove();
      semantics.remove();
    },
  };
}
