const assert=require('assert');
const c=require('../criterion-v54.js');

function near(actual,expected,tol=1e-9){
  assert.ok(Number.isFinite(actual),`Expected finite value, got ${actual}`);
  assert.ok(Math.abs(actual-expected)<=tol,`${actual} != ${expected} (tol ${tol})`);
}

// Perfect monotonic and linear association.
const x=[1,2,3,4,5,6];
const y=[3,5,7,9,11,13];
near(c.pearson(x,y),1,1e-12);
near(c.spearman(x,y),1,1e-12);
const lin=c.linearRegression(x,y);
assert.ok(lin);
near(lin.slope,2,1e-12);
near(lin.intercept,1,1e-12);
near(lin.r2,1,1e-12);
assert.strictEqual(lin.n,6);

// Missing/non-numeric pairs are excluded, not coerced to zero.
const pairs=c.pairedNumeric([1,2,'',4,5],[2,4,6,8,'x']);
assert.deepStrictEqual(pairs,[[1,2],[2,4],[4,8]]);

// Fisher interval contains the observed correlation when estimable.
const noisy=[2,4,5,8,9,11,13,16];
const r=c.pearson([1,2,3,4,5,6,7,8],noisy);
const ci=c.fisherCI(r,8);
assert.ok(ci[0]<=r&&r<=ci[1]);

// Logistic regression: increasing score must increase odds for a simple binary criterion.
const logit=c.logisticRegression(
  [0,1,2,3,4,5,6,7,8,9],
  [0,0,0,0,0,1,1,1,1,1]
);
assert.ok(logit);
assert.ok(logit.beta>0);
assert.ok(logit.oddsRatio>1);
assert.strictEqual(logit.n,10);

// Reject invalid binary criterion.
assert.strictEqual(c.logisticRegression([1,2,3,4,5,6],[0,1,2,0,1,2]),null);

console.log('ValiStruct criterion validity numerical checks: OK');
