// All scores are pre-scaled logits for one query row. Each value is a vector.
export const sum = xs => xs.reduce((a, b) => a + b, 0);
export const normalize = weights => {
  const total = sum(weights);
  return weights.map(w => w / total);
};
export const initialRow = width => ({m: -Infinity, l: 0, u: Array(width).fill(0)});

// Expose the two contributions separately so the drawing can pause between them.
export function appendTile(row, scores, values) {
  const m = Math.max(row.m, ...scores);
  const alpha = Math.exp(row.m - m);
  const old = {l: alpha * row.l, u: row.u.map(x => alpha * x)};
  const weights = scores.map(s => Math.exp(s - m));
  const tile = {l: sum(weights), u: row.u.map((_, d) => sum(weights.map((w, j) => w * values[j][d])))};
  return {alpha, old, weights, tile, row: {m, l: old.l + tile.l, u: old.u.map((x, d) => x + tile.u[d])}};
}

export const outputRow = ({l, u}) => u.map(x => x / l);
export const rowLogSumExp = ({m, l}) => m + Math.log(l);
export const recoverTile = (scores, L) => scores.map(s => Math.exp(s - L));

export const demoScores = [1, 2, 4, 8].map(Math.log);
export const demoValues = [[10], [20], [30], [40]];
export const tileA = appendTile(initialRow(1), demoScores.slice(0, 2), demoValues.slice(0, 2));
export const tileB = appendTile(tileA.row, demoScores.slice(2), demoValues.slice(2));
