import { css } from './_kit.js';

export function shotControls() {
  css(
    'vfx-controls',
    `
.vfx-demo { display:grid; gap:12px; }
.vfx-shot { isolation:isolate; position:relative; overflow:hidden; border-radius:16px; aspect-ratio:16 / 9; background:hsl(222 23% 12%); }
.vfx-shot video,.vfx-composite,.vfx-scene { position:absolute; inset:0; width:100%; height:100%; }
.vfx-scene,.vfx-composite { pointer-events:none; }
.vfx-demo button,.vfx-demo select {
  min-height:36px; font:600 13px/1.2 var(--sans); color:var(--ink);
  background:transparent; border:1px solid var(--line); border-radius:999px; padding:7px 12px; cursor:pointer;
}
.vfx-demo button:hover:not(:disabled),.vfx-demo select:hover { background:var(--panel); }
.vfx-demo button:disabled { opacity:.42; cursor:default; }
.vfx-demo :is(button,input,select,summary):focus-visible {
  outline:2px solid hsl(var(--h) var(--accent-s) var(--accent-l)); outline-offset:3px;
}
.vfx-timeline { display:flex; gap:12px; align-items:center; }
.vfx-demo .vfx-play {
  display:grid; place-items:center; flex:0 0 44px; width:44px; height:44px; padding:0; border:0;
  color:var(--ground); background:var(--ink);
}
.vfx-demo .vfx-play:hover:not(:disabled) { color:var(--ground); background:var(--ink); opacity:.82; }
.vfx-play::before {
  content:''; display:block; width:13px; height:15px; margin-left:2px;
  background:currentColor; clip-path:polygon(0 0,100% 50%,0 100%);
}
.vfx-play[data-playing]::before { margin-left:0; width:12px; clip-path:polygon(0 0,34% 0,34% 100%,0 100%,0 0,66% 0,100% 0,100% 100%,66% 100%,66% 0); }
.vfx-demo input[type=checkbox] { accent-color:hsl(var(--h) var(--accent-s) var(--accent-l)); }
.vfx-timeline input { flex:1; min-width:75px; height:32px; accent-color:hsl(var(--h) var(--accent-s) var(--accent-l)); }
.vfx-timeline output { font:12px var(--mono); color:var(--muted); min-width:5ch; text-align:end; }
.vfx-tools { display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; }
.vfx-actions { display:flex; gap:6px; flex-wrap:wrap; }
.vfx-tabs { display:inline-flex; flex-wrap:wrap; gap:2px; padding:3px; background:var(--panel); border-radius:999px; }
.vfx-demo .vfx-tabs button { min-height:32px; border:0; }
.vfx-demo .vfx-tabs button[aria-pressed="true"] { color:var(--ground); background:var(--ink); }
.vfx-demo .vfx-tabs button:hover:not([aria-pressed="true"]) { background:var(--ground); }
.vfx-edge-controls {
  display:flex; align-items:center; flex-wrap:wrap; gap:8px 16px; padding:10px 12px;
  background:var(--panel); border-radius:12px;
}
.vfx-edge-controls label { display:flex; align-items:center; gap:7px; color:var(--muted); font:13px var(--sans); }
.vfx-edge-controls select { background:var(--ground); min-height:32px; padding-inline:9px; }
.vfx-edge-controls input[type=range] { width:70px; height:28px; accent-color:hsl(var(--h) var(--accent-s) var(--accent-l)); }
.vfx-edge-controls output { width:5ch; font:11px var(--mono); }
.vfx-shot .vfx-inspect {
  position:absolute; min-width:36px; min-height:32px; transform:translate(-50%,-50%); padding:4px 8px;
  color:hsl(174 65% 94%); background:hsl(196 38% 15%); border-color:hsl(173 48% 69%);
}
.vfx-shot .vfx-inspect:hover:not(:disabled) { background:hsl(195 40% 23%); }
.vfx-detail,.vfx-status,.vfx-credit,.vfx-explanation { font:13px/1.5 var(--sans); color:var(--muted); }
.vfx-detail { padding:8px 12px; border-radius:9px; background:var(--panel); }
.vfx-credit a { color:var(--ink); text-decoration:none; border-bottom:0; }
.vfx-credit a:hover { color:hsl(var(--h) var(--accent-s) var(--accent-l)); }
.vfx-demo [hidden] { display:none !important; }
@media(max-width:560px) {
  .vfx-shot { border-radius:12px; }
  .vfx-tools { align-items:flex-start; }
  .vfx-edge-controls { gap:5px 10px; padding:7px 10px; }
  .vfx-edge-controls label { min-height:38px; }
}
`,
  );
}

export function playState(button, paused) {
  const name = paused ? 'Play' : 'Pause';
  button.setAttribute('aria-label', name);
  button.title = name;
  button.toggleAttribute('data-playing', !paused);
}
