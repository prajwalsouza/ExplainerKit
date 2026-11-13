const angleDistance = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

/** Hue categories describe an engineering convention, not aesthetic correctness. */
export function paletteHarmony(clusters, policy) {
  const families = clusters
    .filter(
      (cluster) =>
        cluster.hue !== null && cluster.chroma >= policy.chromaThreshold && cluster.coverage >= policy.minimumShare,
    )
    .map((cluster) => ({ hue: cluster.hue, weight: cluster.coverage }))
    .sort((a, b) => a.hue - b.hue);
  for (let iteration = 0; iteration < 16 && families.length > 1; iteration++) {
    let pair = null,
      distance = policy.hueTolerance / 2;
    for (let a = 0; a < families.length; a++)
      for (let b = a + 1; b < families.length; b++) {
        const value = angleDistance(families[a].hue, families[b].hue);
        if (value < distance) {
          distance = value;
          pair = [a, b];
        }
      }
    if (!pair) break;
    const [a, b] = pair,
      first = families[a],
      second = families[b];
    const x =
      Math.cos((first.hue * Math.PI) / 180) * first.weight + Math.cos((second.hue * Math.PI) / 180) * second.weight;
    const y =
      Math.sin((first.hue * Math.PI) / 180) * first.weight + Math.sin((second.hue * Math.PI) / 180) * second.weight;
    families[a] = { hue: ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360, weight: first.weight + second.weight };
    families.splice(b, 1);
  }
  const hues = families.map((family) => family.hue).sort((a, b) => a - b);
  const gaps = hues.map((value, index) => (hues[(index + 1) % hues.length] - value + 360) % 360);
  const arc = hues.length < 2 ? 0 : 360 - Math.max(...gaps);
  let classification = 'mixed',
    error = null;
  if (!hues.length) classification = 'achromatic';
  else if (hues.length === 1 || arc <= policy.hueTolerance) {
    classification = 'monochrome';
    error = arc;
  } else if (arc <= 60 + policy.hueTolerance) {
    classification = 'analogous';
    error = Math.max(0, arc - 60);
  } else if (hues.length === 2 && Math.abs(angleDistance(...hues) - 180) <= policy.hueTolerance) {
    classification = 'complementary';
    error = Math.abs(angleDistance(...hues) - 180);
  } else if (hues.length === 3) {
    const triadic = Math.max(...gaps.map((value) => Math.abs(value - 120)));
    const split = Math.max(
      ...gaps
        .slice()
        .sort((a, b) => a - b)
        .map((value, index) => Math.abs(value - [60, 150, 150][index])),
    );
    if (triadic <= policy.hueTolerance) {
      classification = 'triadic';
      error = triadic;
    } else if (split <= policy.hueTolerance) {
      classification = 'split-complementary';
      error = split;
    }
  }
  return { class: classification, hues, angularError: error, tolerance: policy.hueTolerance, space: 'hsl' };
}

export function coverageBalance(clusters, target) {
  const shares = [
    clusters[0]?.coverage ?? 0,
    clusters[1]?.coverage ?? 0,
    clusters.slice(2).reduce((sum, cluster) => sum + cluster.coverage, 0),
  ];
  const deviation =
    target === null ? null : shares.reduce((sum, share, index) => sum + Math.abs(share - target[index]), 0) / 2;
  return {
    target,
    shares,
    accentShare: shares[2],
    score: deviation === null ? null : Math.max(0, 1 - deviation),
    interpretation: 'coverage-outside-two-largest-clusters',
  };
}
