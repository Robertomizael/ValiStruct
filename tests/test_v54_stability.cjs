const test = require('node:test');
const assert = require('node:assert/strict');
const stats = require('../stability-v54.js');

function close(actual, expected, tol=1e-9){
  assert.ok(Number.isFinite(actual), `expected finite value, got ${actual}`);
  assert.ok(Math.abs(actual-expected) <= tol, `${actual} != ${expected}`);
}

test('Pearson and Spearman recover perfect monotonic relations', () => {
  close(stats.pearson([1,2,3,4,5],[2,4,6,8,10]), 1);
  close(stats.spearman([1,2,3,4,5],[5,4,3,2,1]), -1);
});

test('Cohen kappa matches hand-computable 2x2 example', () => {
  // Po=.75; Pe=.50; kappa=(.75-.50)/(1-.50)=.50
  close(stats.kappa([0,0,1,1],[0,1,1,1],'none'), .5);
});

test('Weighted kappa is one under perfect ordinal agreement', () => {
  close(stats.kappa([1,2,3,4,5],[1,2,3,4,5],'linear'), 1);
  close(stats.kappa([1,2,3,4,5],[1,2,3,4,5],'quadratic'), 1);
});

test('ICC implementations match fixed regression fixture', () => {
  const matrix=[[1,1],[2,2],[3,4],[4,5],[5,5]];
  close(stats.icc(matrix,'ICC2','single'), 0.9322033898305084, 1e-12);
  close(stats.icc(matrix,'ICC3','single'), 0.9482758620689654, 1e-12);
  close(stats.icc(matrix,'ICC2','average'), 0.9649122807017544, 1e-12);
  close(stats.icc(matrix,'ICC3','average'), 0.9734513274336283, 1e-12);
});

test('Fisher interval contains the estimate and bootstrap is reproducible', () => {
  const ci=stats.fisherCI(.8,30);
  assert.ok(ci[0] < .8 && ci[1] > .8);
  const pairs=[[1,1],[2,2],[3,4],[4,5],[5,5],[6,6]];
  const one=stats.bootstrapPairs(pairs,s=>stats.icc(s,'ICC2','single'),250,99);
  const two=stats.bootstrapPairs(pairs,s=>stats.icc(s,'ICC2','single'),250,99);
  assert.deepEqual(one,two);
  assert.ok(one.every(Number.isFinite));
});
