// Minimum-cost bipartite assignment with unmatched slots. The potential update
// follows the rectangular Hungarian method used in the RhyformJS math prototype.
export function assignParts(left, right, cost, unmatched = 4) {
  if (!left.length || !right.length) return [];
  const n = left.length;
  const m = right.length + n;
  const costs = left.map((a) => right.map((b) => cost(a, b)));
  const rowPotential = Array(n + 1).fill(0);
  const columnPotential = Array(m + 1).fill(0);
  const occupied = Array(m + 1).fill(0);
  const predecessor = Array(m + 1).fill(0);
  for (let row = 1; row <= n; row++) {
    occupied[0] = row;
    let column = 0;
    const shortest = Array(m + 1).fill(Infinity);
    const used = Array(m + 1).fill(false);
    do {
      used[column] = true;
      const source = occupied[column];
      let delta = Infinity;
      let next = 0;
      for (let target = 1; target <= m; target++) {
        if (used[target]) continue;
        const price = target <= right.length ? costs[source - 1][target - 1] : unmatched;
        const reduced = price - rowPotential[source] - columnPotential[target];
        if (reduced < shortest[target]) {
          shortest[target] = reduced;
          predecessor[target] = column;
        }
        if (shortest[target] < delta) {
          delta = shortest[target];
          next = target;
        }
      }
      for (let target = 0; target <= m; target++) {
        if (used[target]) {
          rowPotential[occupied[target]] += delta;
          columnPotential[target] -= delta;
        } else shortest[target] -= delta;
      }
      column = next;
    } while (occupied[column]);
    do {
      const previous = predecessor[column];
      occupied[column] = occupied[previous];
      column = previous;
    } while (column);
  }
  return occupied
    .slice(1, right.length + 1)
    .flatMap((row, column) => (row && costs[row - 1][column] < unmatched ? [[left[row - 1], right[column]]] : []));
}
