export const CAMERA = time => [1, 0, 0, 1, 30 + 15 * time, 0];

export function makeObservations({missingHand = false} = {}) {
  const samples = Array.from({length: 5}, (_, index) => {
    const t = index * .25;
    const x = 175 + 111 * t;
    const project = ([px, py]) => [px + CAMERA(t)[4], py];
    const arm = -24 * Math.sin(Math.PI * t);
    const chains = {
      handLeft: [[x - 5, 88], [x - 20, 115], [x - 30, 140]],
      handRight: [[x + 5, 88], [x + 28, 111], [x + 53, 104 + arm]],
      footLeft: [[x - 4, 152], [x - 20, 183], [x - 19, 221]],
      footRight: [[x + 4, 152], [x + 19, 186], [x + 23, 221]],
    };
    if (missingHand && index === 2) delete chains.handRight;
    const limbs = Object.fromEntries(Object.entries(chains).map(([key, chain]) => [key, chain.map(project)]));
    const ends = Object.fromEntries(Object.entries(limbs).map(([key, chain]) => [key, chain.at(-1)]));
    const [cx, cy] = project([x, 64]);
    return {t, pose: {head: {cx, cy, r: 12}, neck: project([x, 88]), hip: project([x, 152]), labelled: {status: 'measured', limbs, ends}}};
  });
  return {protocol: 'explainerkit.pose/2', samples};
}
