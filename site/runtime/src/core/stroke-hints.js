const hints = Object.freeze({
  lineCap: 'strokeLinecap',
  lineJoin: 'strokeLinejoin',
  miterLimit: 'strokeMiterlimit',
  dashArray: 'strokeDasharray',
  dashOffset: 'strokeDashoffset',
  strokeDashArray: 'strokeDasharray',
  strokeDashOffset: 'strokeDashoffset',
  lineWidth: 'strokeWidth',
  strokeLineCap: 'strokeLinecap',
  strokeLineJoin: 'strokeLinejoin',
  strokeMiterLimit: 'strokeMiterlimit',
  dasharray: 'strokeDasharray',
  dashoffset: 'strokeDashoffset',
});
export const strokePropertySuggestion = (key) => (Object.hasOwn(hints, key) ? hints[key] : undefined);
