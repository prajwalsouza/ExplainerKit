// @recipe scroll-story
// @title Drive a scene by scrolling the page
// @task Pin the scene in a sticky stage and map scroll position to scene time through acts with held moments.
// @uses explainerkit/core, explainerkit/story
// @keywords scroll, scrollytelling, sticky, story, acts, holds, scroll-driven, chapters
// @guide docs/modules/story-delivery.md
import {scene} from 'explainerkit/core';
import {attachStory} from 'explainerkit/story';

// Page structure: a tall story element containing a sticky stage.
const story = document.createElement('section');
story.className = 'story';
const stage = document.createElement('div');
stage.className = 'story-stage';
stage.style.cssText = 'position:sticky;top:0;height:100vh';
story.append(stage);
document.querySelector('#stage').append(story);

const drawing = scene({width: 640, height: 360, duration: 4, label: 'A bar grows as the reader scrolls'});
drawing.rect({x: 60, y: 160, width: 0, height: 40, fill: '#34766b'}).to(0, {width: 520}, {duration: 4, ease: 'linear'});

export const player = await drawing.mount(stage);
export const scroll = attachStory(player, {
  element: story,
  sticky: stage,
  acts: [
    {id: 'start', from: 0, to: 2, length: '150vh', holds: [{at: 1, length: '40vh'}]},
    {id: 'finish', from: 2, to: 4, length: '150vh'},
  ],
});

// The story owns the player's clock, so previews and tests move it by scrolling.
export async function seek(time) {
  const travel = story.getBoundingClientRect().height - innerHeight;
  window.scrollTo(0, travel * Math.min(1, time / 4));
  await new Promise((done) => setTimeout(done, 400));
}
