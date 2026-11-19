import {parseOverpass} from '../../runtime/src/maps/osm.js';
import {buildCity, WEATHER, weatherSchedule} from '../../runtime/src/procedural/city/index.js';
import {cinematicPost} from '../../runtime/src/renderers/three-cinematic.js';
import {cityScene, dioramaLens} from '../../runtime/src/renderers/three-city.js';
import {css} from './_kit.js';
import {cityMapURL, featuredPlaces} from './design-city-places.js';

const CSS = `
.ek-city-map { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; }
.ek-city-map-controls { display: flex; flex-wrap: wrap; gap: .75rem 1.15rem; padding: .8rem 1rem; }
.ek-city-map-controls label { display: grid; gap: .2rem; flex: 1 1 9rem; font-size: .875rem; font-weight: 650; }
.ek-city-map-controls select { min-height: 2.4rem; padding: .25rem .5rem; border: 1px solid var(--line); border-radius: 8px; color: var(--ink); background: var(--ground); font: inherit; font-weight: 450; }
.ek-city-map-controls input { width: 100%; min-height: 2.4rem; margin: 0; }
.ek-city-map-controls [role=group] { display: flex; flex-wrap: wrap; align-items: end; gap: .4rem; }
.ek-city-map-controls button { min-height: 2.4rem; padding: .25rem .65rem; border: 1px solid var(--line); border-radius: 8px; color: var(--ink); background: var(--ground); font: inherit; cursor: pointer; }
.ek-city-map-controls button[aria-pressed=true] { background: var(--ink); color: var(--ground); }
.ek-city-map-viewport { display: grid; aspect-ratio: 16 / 10; min-height: 220px; background: #cfdae0; }
.ek-city-map-viewport canvas { grid-area: 1 / 1; width: 100%; height: 100%; display: block; }
.ek-city-map-viewport canvas[hidden] { display: none; }
.ek-city-map-footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .25rem .9rem; padding: .45rem 1rem; font-size: .85rem; }
.ek-city-map-footer [role=status] { margin: 0; }
.ek-city-map-footer a { color: inherit; }
`;

function loadThree() {
  return new URL(import.meta.url).pathname.includes('/.local/docs-site/')
    ? import('../../three/three.module.js')
    : import('../../vendor/three/three.module.js');
}

const DEFAULT_VIEW = {position: [183, 236, 202], target: [0, 12, 0]};
const schedule = weatherSchedule([
  {at: 0, weather: 'clear'},
  {at: 5, weather: {...WEATHER.rain, fog: {...WEATHER.rain.fog, density: .035}}, change: 4},
  {at: 10, weather: {
    ...WEATHER.nightRain,
    ambient: {...WEATHER.nightRain.ambient, intensity: 1.8},
    fog: {...WEATHER.nightRain.fog, density: .035},
  }, change: 3.5},
]);
const activities = {
  compare: {
    controls: `<label>Neighborhood <select name="neighborhood"></select></label>
      <label>Time of day <select name="time"><option value="clear">Daylight</option><option value="golden">Golden hour</option><option value="night">Night</option></select></label>`,
  },
  weather: {
    place: 'london',
    controls: `<label>Weather timeline <input name="weather-time" type="range" min="0" max="10" step="0.1" value="0"></label>
      <div role="group" aria-label="Weather stops">
        <button type="button" data-time="0">Daylight</button>
        <button type="button" data-time="5">Rain</button>
        <button type="button" data-time="10">Night rain</button>
      </div>`,
  },
  drawing: {
    place: 'new-york',
    controls: '<label>Model detail <select name="detail" disabled><option value="full">Full street</option><option value="massing">Building masses</option></select></label>',
  },
  diorama: {
    place: 'paris',
    controls: '<label>Lens <select name="lens"><option value="0">Sharp throughout</option><option value="0.8">Diorama</option></select></label>',
  },
};

export default function cityMaps(stage) {
  return mountCityActivity(stage, 'compare');
}

export async function mountCityActivity(stage, kind) {
  const activity = activities[kind];
  let THREE, renderer;
  try {
    THREE = await loadThree();
    renderer = new THREE.WebGLRenderer({antialias: true});
  } catch {
    stage.textContent = 'The city preview needs a browser with WebGL2 and the local Three.js runtime.';
    return;
  }

  css('design-city-maps', CSS);
  stage.innerHTML = `<div class="ek-city-map">
    <div class="ek-city-map-controls">${activity.controls}</div>
    <div class="ek-city-map-viewport"></div>
    <div class="ek-city-map-footer">
      <p role="status"></p>
      <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>
    </div>
  </div>`;
  const viewport = stage.querySelector('.ek-city-map-viewport');
  const placeSelect = stage.querySelector('[name="neighborhood"]');
  const weather = stage.querySelector('[name="time"]');
  const timeline = stage.querySelector('[name="weather-time"]');
  const weatherStops = stage.querySelectorAll('[data-time]');
  const detail = stage.querySelector('[name="detail"]');
  const lens = stage.querySelector('[name="lens"]');
  const status = stage.querySelector('[role="status"]');
  if (placeSelect) for (const place of featuredPlaces) placeSelect.add(new Option(`${place.city} · ${place.name}`, place.id));

  const events = new AbortController();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, .5, 1800);
  const targetPoint = new THREE.Vector3();
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.hidden = true;
  viewport.append(canvas);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  if (lens) renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const observer = new ResizeObserver(requestFrame);
  let street, currentPlace, currentMap, request, post, lensAmount;
  let frame = 0;

  function condition() {
    return timeline ? schedule.at(Number(timeline.value)) : weather?.value ?? 'clear';
  }

  function renderDiorama(width, height) {
    const amount = Number(lens.value);
    if (amount !== lensAmount) {
      post?.dispose();
      post = cinematicPost(THREE, renderer, {
        mode: 'interactive', width, height, taps: 13, stillSamples: 1,
        lens: dioramaLens({amount, center: .53, width: .28, bloom: 0}),
        grade: {splitTone: {shadows: 'hsla(0, 0%, 0%, 1)', highlights: 'hsla(0, 0%, 100%, 1)'}},
        rig: {exposure: 1.16},
      });
      lensAmount = amount;
    } else if (post.size.width !== width || post.size.height !== height) post.setSize(width, height);
    post.render(scene, camera);
  }

  function draw() {
    frame = 0;
    if (!street || !canvas.isConnected) return;
    const width = Math.min(1050, Math.max(16, viewport.clientWidth));
    const height = Math.max(16, Math.round(viewport.clientHeight * width / Math.max(16, viewport.clientWidth)));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const back = camera.aspect < 1.35 ? 1.2 : 1;
    const {position, target} = currentPlace.preview ?? DEFAULT_VIEW;
    camera.position.set(...position).lerp(targetPoint.set(...target), 1 - back);
    camera.lookAt(...target);
    camera.updateProjectionMatrix();
    const time = timeline ? Number(timeline.value) : 4;
    const nextWeather = condition();
    street.setWeather(nextWeather);
    street.update({time, camera, height});
    if (lens) renderDiorama(width, height);
    else renderer.render(scene, camera);
    if (timeline) {
      const text = `${time.toFixed(1)} s · Pavement wetness ${Math.round(nextWeather.wet * 100)}% · Street lighting ${Math.round(nextWeather.lamps * 100)}%`;
      if (status.textContent !== text) status.textContent = text;
      for (const button of weatherStops) button.setAttribute('aria-pressed', String(time === Number(button.dataset.time)));
    }
  }

  function requestFrame() {
    if (street && !frame && !events.signal.aborted) frame = requestAnimationFrame(draw);
  }

  function showMap(osm, place) {
    const city = buildCity(osm, {seed: 7, density: .5, detail: detail?.value ?? 'full'});
    const next = cityScene(THREE, city, {
      weather: condition(), quality: 'draft', shadowMapSize: 1024, shadowRange: 220,
    });
    if (street) {
      scene.remove(street.object);
      street.dispose();
    }
    street = next;
    scene.add(street.object);
    scene.fog = street.fog;
    currentMap = osm;
    currentPlace = place;
    canvas.hidden = false;
    canvas.setAttribute('aria-label', `A 3D view of ${place.name}, ${place.city}`);
    status.textContent = `${place.name}, ${place.city}`;
    if (detail) detail.disabled = false;
    requestFrame();
  }

  async function selectPlace() {
    request?.abort();
    const pending = new AbortController();
    request = pending;
    const place = featuredPlaces.find(({id}) => id === (placeSelect?.value || activity.place));
    if (place === currentPlace) {
      status.textContent = `${place.name}, ${place.city}`;
      return;
    }
    status.textContent = `Loading ${place.city}…`;
    try {
      const signal = AbortSignal.any([pending.signal, AbortSignal.timeout(10_000)]);
      const response = await fetch(cityMapURL(place), {signal});
      if (!response.ok) throw Error('Map extract unavailable.');
      const source = await response.text();
      if (pending.signal.aborted || events.signal.aborted) return;
      showMap(parseOverpass(source, {bbox: place.bbox}), place);
    } catch {
      if (pending.signal.aborted || events.signal.aborted) return;
      status.textContent = `Could not load ${place.city}.`;
      if (placeSelect) placeSelect.value = currentPlace?.id ?? '';
    }
  }

  const settings = {signal: events.signal};
  placeSelect?.addEventListener('change', selectPlace, settings);
  weather?.addEventListener('change', requestFrame, settings);
  timeline?.addEventListener('input', requestFrame, settings);
  lens?.addEventListener('change', requestFrame, settings);
  detail?.addEventListener('change', () => showMap(currentMap, currentPlace), settings);
  for (const button of weatherStops) button.addEventListener('click', () => {
    timeline.value = button.dataset.time;
    requestFrame();
  }, settings);
  canvas.addEventListener('webglcontextlost', () => {
    dispose();
    status.textContent = 'The city preview lost its WebGL context. Reload the page to try again.';
  }, settings);
  observer.observe(viewport);
  void selectPlace();

  function dispose() {
    if (events.signal.aborted) return;
    events.abort();
    request?.abort();
    observer.disconnect();
    cancelAnimationFrame(frame);
    post?.dispose();
    street?.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }

  return dispose;
}
