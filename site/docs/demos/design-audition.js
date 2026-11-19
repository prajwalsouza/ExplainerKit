import {encodeWav} from '../../runtime/src/sound/mix.js';
import {css} from './_kit.js';

const CSS = `
.ek-audition { display: flex; align-items: center; flex-wrap: wrap; gap: .75rem; padding: 0 1rem .9rem; }
.ek-audition button { border: 1px solid var(--line); border-radius: 999px; background: var(--ground); color: var(--ink); font: inherit; padding: .35rem .85rem; cursor: pointer; }
.ek-audition span { font-size: .8rem; color: var(--muted); }
`;

export function audition(stage, label, render) {
  css('design-audition', CSS);
  const controls = document.createElement('div');
  controls.className = 'ek-audition';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  controls.append(button, status);
  stage.querySelector('.ek-study').append(controls);
  const audio = new Audio();
  let url = null;
  const events = new AbortController();
  const on = {signal: events.signal};

  function stop() {
    audio.pause();
    audio.removeAttribute('src');
    if (url !== null) {
      audio.load();
      URL.revokeObjectURL(url);
      url = null;
    }
    button.textContent = label;
  }

  button.addEventListener('click', async () => {
    if (url !== null) {
      stop();
      status.textContent = 'Stopped.';
      return;
    }
    const bytes = encodeWav(render());
    url = URL.createObjectURL(new Blob([bytes], {type: 'audio/wav'}));
    const starting = url;
    audio.src = url;
    audio.volume = .6;
    button.textContent = 'Stop audio';
    status.textContent = 'Playing.';
    try {
      await audio.play();
    } catch {
      if (starting !== url) return;
      stop();
      status.textContent = 'Playback did not start. Press the button to try again.';
    }
  }, on);
  audio.addEventListener('ended', () => {
    stop();
    status.textContent = 'Finished.';
  }, on);
  return () => { events.abort(); stop(); };
}
