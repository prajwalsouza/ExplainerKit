import {hoverIntent, pointerInput} from '../../runtime/src/inputs/index.js';
import {css} from './_kit.js';
import {paintColor} from './design-stage.js';

const CSS = `
.ek-koi-pond { border: 1px solid var(--line); border-radius: 16px; background: var(--panel); }
.ek-koi-fish { display: flex; align-items: center; justify-content: center; min-height: 168px; gap: clamp(.35rem, 4vw, 2.8rem); padding: 0 .5rem; }
.ek-koi-fish button { position: relative; min-width: 3.6rem; min-height: 2.9rem; border-radius: 75% 48% 54% 72%; border: 0; background: var(--fish); color: var(--ink); cursor: pointer; }
.ek-koi-fish button::after { content:''; position:absolute; left:-.6rem; top:.6rem; width:1rem; height:1.6rem; background:var(--fish); clip-path:polygon(0 3%, 100% 48%, 0 97%); pointer-events:none; }
.ek-koi-fish button::before { content:''; position:absolute; right:.8rem; top:.8rem; width:.35rem; height:.35rem; border-radius:50%; background:var(--ink); }
.ek-koi-fish button[aria-pressed="true"] { outline: 2px solid var(--ink); outline-offset: 4px; }
.ek-koi-status { min-height: 3.4em; margin: 0; padding: .3rem .85rem .9rem; }
`;

export default async function waiterFish(stage) {
  css('design-waiter-fish', CSS);
  stage.innerHTML = `<div class="ek-koi-pond"><div class="ek-koi-fish" aria-label="Fish in the lunch queue">
    <button type="button" data-fish="Miso" aria-label="Select Miso" aria-pressed="false" style="--fish:${paintColor(26, 54, 65)}"></button>
    <button type="button" data-fish="Bubbles" aria-label="Select Bubbles" aria-pressed="false" style="--fish:${paintColor(167, 32, 57)}"></button>
    <button type="button" data-fish="Crumb" aria-label="Select Crumb" aria-pressed="false" style="--fish:${paintColor(280, 34, 68)}"></button>
  </div><p class="ek-koi-status" role="status">The fish are waiting for lunch.</p></div>`;
  const pond = stage.querySelector('.ek-koi-fish');
  const status = stage.querySelector('p');
  const pointer = pointerInput(pond, {id: 'pond-pointer'});
  const intent = hoverIntent(pointer, {dwell: .24, fastDwell: .48, leave: .25, speedThreshold: 680, hit(x, y) {
    const bounds = pond.getBoundingClientRect();
    const fish = document.elementFromPoint(bounds.x + x, bounds.y + y)?.closest('button[data-fish]');
    return fish && pond.contains(fish) ? fish.dataset.fish : null;
  }});
  const events = new AbortController();
  function select(name) {
    for (const button of pond.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.fish === name));
    status.textContent = name ? `${name} finally has the waiter’s attention.` : 'The fish are waiting for lunch.';
  }
  const unsubscribe = intent.subscribe(snapshot => {
    if (snapshot.latest?.quality.valid) select(snapshot.latest.value);
  });
  pond.addEventListener('click', event => {
    const name = event.target.closest('button[data-fish]')?.dataset.fish;
    if (name) select(name);
  }, {signal: events.signal});
  await pointer.start();
  await intent.start();
  return () => { events.abort(); unsubscribe(); intent.dispose(); pointer.dispose(); };
}
