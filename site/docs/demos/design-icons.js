// Small line icons for the design demos, drawn in one stroke weight on a 16-unit grid like the landing page's view
// icons: one per topic in the samples, per form, and per kind of thing a design run makes along the way.
const PATHS = {
  // Topics.
  'signal processing': ['M1 8h2l1.5-4 2 8 2-10 2 12 1.5-6H15'],
  'colour science': ['M8 1.5L14.5 13H1.5Z', 'M5 9.5h6'],
  'the biology of ageing': ['M4 1.5h8M4 14.5h8', 'M5 1.5c0 4 6 4 6 6.5s-6 2.5-6 6.5', 'M11 1.5c0 4-6 4-6 6.5s6 2.5 6 6.5'],
  'how sound becomes signal': ['M3 6v4h2.5L9 13V3L5.5 6Z', 'M11.5 5.5a3.5 3.5 0 0 1 0 5', 'M13.2 3.8a6 6 0 0 1 0 8.4'],
  // Forms.
  explainer: ['M2 3.5h12v9H2Z', 'M6.5 6v4l3.5-2Z'],
  fable: ['M8 3.5c-2-1.4-4.5-1.6-6.5-.8v10.6c2-.8 4.5-.6 6.5.8 2-1.4 4.5-1.6 6.5-.8V2.7c-2-.8-4.5-.6-6.5.8Zm0 0v10.6'],
  series: ['M2.5 5h11v8.5h-11Z', 'M4 3h8', 'M5.5 1.2h5'],
  // Kinds of thing.
  brief: ['M4 1.5h6l3 3v10H4Z', 'M6 7h5M6 9.5h5M6 12h3'],
  search: ['M7 2.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9', 'M10.3 10.3L14 14'],
  link: ['M6.5 9.5l3-3', 'M7.5 4.5l1.3-1.3a2.6 2.6 0 0 1 3.7 3.7L11.2 8.2', 'M8.5 11.5l-1.3 1.3a2.6 2.6 0 0 1-3.7-3.7L4.8 7.8'],
  spark: ['M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M3.4 3.4l2 2M10.6 10.6l2 2M3.4 12.6l2-2M10.6 5.4l2-2'],
  seed: ['M8 14.5V8', 'M8 8C8 4.5 5.5 3 2.5 3c0 3.5 2.5 5 5.5 5Z', 'M8 9.5c0-3 2-4.5 5.5-4.5 0 3-2 4.5-5.5 4.5Z'],
  claim: ['M3 2.5h10v8H7l-3 3v-3H3Z', 'M5.5 6.5l1.5 1.5 3-3'],
  question: ['M5.5 5.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5', 'M8 13v.01'],
  beats: ['M2 12c2-6 4-6 6 0s4 6 6 0', 'M2 12h.01M8 12h.01M14 12h.01'],
  pen: ['M10.5 2.5l3 3L6 13H3v-3Z', 'M9 4l3 3'],
  review: ['M2 8.5l3.5 3.5L14 3.5'],
  title: ['M3 3.5h10M8 3.5v10', 'M5.5 13.5h5'],
  star: ['M8 1.5l1.9 4.1 4.5.5-3.3 3.1.9 4.4L8 11.4l-4 2.2.9-4.4L1.6 6.1l4.5-.5Z'],
  kingdom: ['M2 13.5h12', 'M3 13.5V7l2.5 2V5L8 7.5 10.5 5v4L13 7v6.5'],
  scissors: ['M4.5 2.5a2 2 0 1 1 0 4a2 2 0 1 1 0-4M4.5 9.5a2 2 0 1 1 0 4a2 2 0 1 1 0-4', 'M6.2 5.5L14 12M6.2 10.5L14 4'],
  thread: ['M2 4c4 0 4 8 8 8h4', 'M2 12c4 0 4-8 8-8h4'],
};

/** An icon as inline SVG, stroked in `currentColor` unless a colour is given. Unknown names draw nothing. */
export function icon(name, { size = 16, colour = 'currentColor', label = '' } = {}) {
  const paths = PATHS[String(name).toLowerCase()];
  if (!paths) return '';
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="dx-icon" viewBox="0 0 16 16" width="${size}" height="${size}" ${a11y} fill="none" stroke="${colour}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths.map((d) => `<path d="${d}"/>`).join('')}</svg>`;
}
