import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalize, initialRow, appendTile, outputRow, rowLogSumExp, recoverTile, tileA, tileB} from '../assets/flash-attention-math.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-11, `${a} differs from ${b}`);
function same(actual, expected) {
  assert.equal(actual.length, expected.length);
  actual.forEach((x, i) => near(x, expected[i]));
}

test('a common rescaling leaves the normalized weights unchanged', () => {
  for (const c of [1, 1 / 8, 10000]) same(normalize([1, 2, 4, 8].map(x => c * x)), [1 / 15, 2 / 15, 4 / 15, 8 / 15]);
  const p = normalize([1, 3]);
  near(p[0] * 10 + p[1] * 20, 17.5);
});
test('a new maximum rescales the old numerator and denominator together', () => {
  near(tileA.row.m, Math.log(2)); near(tileA.row.l, 1.5); same(tileA.row.u, [25]);
  near(tileB.row.m, Math.log(8)); near(tileB.alpha, 0.25);
  near(tileB.old.l, 0.375); same(tileB.old.u, [6.25]);
  near(tileB.tile.l, 1.5); same(tileB.tile.u, [55]);
  near(tileB.row.l, 1.875); same(tileB.row.u, [61.25]); same(outputRow(tileB.row), [490 / 15]);
});
test('a lower or tied tile maximum preserves the old scale', () => {
  for (const s of [-1, Math.log(2)]) {
    const next = appendTile(tileA.row, [s], [[7]]);
    near(next.row.m, tileA.row.m); near(next.alpha, 1); same(next.old.u, tileA.row.u); near(next.old.l, tileA.row.l);
  }
});
test('streamed vector outputs and reconstructed P match independent dense rows', () => {
  const keys = [[1,2],[-3,1],[0,4],[2,-2],[3,1]], values = [[2,5,-1],[0,-2,1],[4,6,2],[-5,3,8],[7,-2,9]];
  for (const q of [[1,0],[-2,3],[0,0]]) for (const shift of [-1000,0,1000]) {
    const base = keys.map(k => (k[0]*q[0]+k[1]*q[1])/Math.sqrt(2));
    const scores = base.map(s => s + shift);
    const denom = base.reduce((s,x) => s+Math.exp(x), 0);
    const probabilities = base.map(z => Math.exp(z)/denom);
    const output = values[0].map((_,d) => values.reduce((s,v,i) => s+v[d]*probabilities[i], 0));
    for (const size of [1,2,3,5]) {
      let row = initialRow(3);
      for (let i=0; i<scores.length; i+=size) row=appendTile(row, scores.slice(i,i+size), values.slice(i,i+size)).row;
      same(outputRow(row), output); near(rowLogSumExp(row), Math.log(denom)+shift);
      same(recoverTile(scores.slice(1,4),rowLogSumExp(row)), probabilities.slice(1,4));
    }
  }
});
