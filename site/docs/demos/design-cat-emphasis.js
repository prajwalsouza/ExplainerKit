import {emphasis, emphasizeDOM, topics} from '../../runtime/src/emphasis/index.js';
import {colour, css, ground, ink} from './_kit.js';

const WORDS = ['I', 'never', 'said', 'the', 'cat', 'ate', 'it'];
const CHOICES = [
  {word: 'I', reply: 'Someone else may have said it.'},
  {word: 'said', reply: 'Perhaps you merely implied it.'},
  {word: 'cat', reply: 'The cat’s lawyer invites you to consider the dog.'},
  {word: 'ate', reply: 'The cat only licked it. Allegedly.'},
  {word: 'it', reply: 'The cat ate something else. The whereabouts of the tuna remain unknown.'},
];

const CSS = `
.ek-cat-stage { padding: clamp(1rem, 5vw, 2.25rem); border: 1px solid var(--line); border-radius: 16px; text-align: center; }
.ek-cat-icon { display: block; width: 72px; height: 54px; margin: 0 auto .6rem; }
.ek-cat-line { display: flex; justify-content: center; align-items: baseline; flex-wrap: wrap; gap: 0 .2em; font: 650 clamp(1.15rem, 3.4vw, 2rem)/1.5 var(--display); margin: 0; }
.ek-cat-line button { color: inherit; padding: 0 .08em; font: inherit; background: none; border: 0; cursor: pointer; text-decoration: underline dotted; text-decoration-thickness: 1px; text-underline-offset: .18em; }
.ek-cat-line button[aria-pressed="true"] { text-decoration-style: solid; }
.ek-cat-reply { min-height: 3em; margin: .8rem 0 0; color: var(--ink); font-size: .9rem; }
`;

export default function catEmphasis(stage, ctx) {
  css('design-cat-emphasis', CSS);
  stage.innerHTML = `<div class="ek-cat-stage">
    <canvas class="ek-cat-icon" width="144" height="108" aria-hidden="true"></canvas>
    <p class="ek-cat-line"></p>
    <p class="ek-cat-reply" role="status"></p>
  </div>`;
  const card = stage.querySelector('.ek-cat-stage');
  const cat = stage.querySelector('.ek-cat-icon').getContext('2d');
  const profile = new Path2D('M15 29 16 8 28 17q8-3 16 0L56 8l1 21c0 12-9 18-21 18s-21-6-21-18Z M22 30q3-3 6 0m16 0q3-3 6 0m-17 4 3 3 3-3M7 32l12 3m-11 4 12-1m45-6-12 3m11 4-12-1');
  cat.scale(2, 2);
  cat.lineCap = 'round';
  cat.lineJoin = 'round';
  cat.lineWidth = 2.5;
  const line = stage.querySelector('.ek-cat-line');
  const reply = stage.querySelector('.ek-cat-reply');
  const events = new AbortController();
  const tokens = WORDS.map(word => {
    const index = CHOICES.findIndex(choice => choice.word === word);
    const token = document.createElement(index < 0 ? 'span' : 'button');
    token.textContent = word;
    if (index >= 0) {
      token.type = 'button';
      token.addEventListener('click', () => choose(index), {signal: events.signal});
    }
    line.append(token);
    return token;
  });
  const targets = Object.fromEntries(CHOICES.map(({word}) => [word, tokens[WORDS.indexOf(word)]]));
  let current = 2;
  let binding;

  function choose(index) {
    current = index;
    binding.update(index + .5);
    for (const [word, button] of Object.entries(targets)) {
      button.setAttribute('aria-pressed', String(word === CHOICES[index].word));
    }
    reply.textContent = CHOICES[index].reply;
  }

  function paintTheme() {
    binding?.dispose();
    const accent = colour(ctx, 35, 64, ctx.dark() ? 52 : 32);
    const base = ink(ctx);
    const background = ground(ctx);
    card.style.background = background;
    card.style.color = base;
    cat.clearRect(0, 0, 72, 54);
    cat.strokeStyle = accent;
    cat.stroke(profile);
    const track = emphasis({
      palette: topics({witness: accent}),
      recede: {opacity: .72},
      scale: 1.08,
      contrast: {text: base, background, floor: 4.5},
    });
    CHOICES.forEach(({word}, at) => track.on(word, {topic: 'witness', at}));
    binding = emphasizeDOM(track, {targets, context: tokens, ink: base});
    choose(current);
  }

  paintTheme();
  const offTheme = ctx.onTheme(paintTheme);
  return () => {
    events.abort();
    offTheme();
    binding.dispose();
  };
}
