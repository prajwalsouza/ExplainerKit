// Run synchronously in the head, before first paint. Keep this key/default aligned with theme.js.
let firstTheme = 'day';
try {
  if (localStorage.getItem('explainerkit-landing-theme') === 'night') firstTheme = 'night';
} catch {
  // Storage may be unavailable in private or embedded contexts; the page defaults to day.
}
document.documentElement.classList.add(firstTheme);
