export const featuredPlaces = Object.freeze([
  {
    id: 'paris',
    city: 'Paris',
    name: 'Île de la Cité',
    bbox: {south: 48.8505, west: 2.3457, north: 48.8554, east: 2.3534},
  },
  {
    id: 'london',
    city: 'London',
    name: 'Westminster',
    bbox: {south: 51.4968, west: -0.1290, north: 51.5023, east: -0.1209},
  },
  {
    id: 'new-york',
    city: 'New York',
    name: 'Flatiron District',
    bbox: {south: 40.7374, west: -73.9933, north: 40.743, east: -73.9852},
    preview: {position: [-170, 306, 113], target: [-29, 10, -86]},
  },
]);

export function cityMapURL(place) {
  return new URL(`./city-map-${place.id}.json`, import.meta.url);
}
