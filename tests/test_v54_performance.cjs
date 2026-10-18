const assert=require('assert');
const p=require('../performance-v54.js');

function near(actual,expected,tol=1e-9){
  assert.ok(Number.isFinite(actual),`Expected finite value, got ${actual}`);
  assert.ok(Math.abs(actual-expected)<=tol,`${actual} != ${expected} (tol ${tol})`);
}

// Perfect discrimination: higher scores identify criterion-positive cases.
const scores=[1,2,3,4,5,6];
const labels=[0,0,0,1,1,1];
const roc=p.rocCurve(scores,labels);
near(roc.auc,1,1e-12);
near(roc.optimal.threshold,4,1e-12);
near(roc.optimal.sensitivity,1,1e-12);
near(roc.optimal.specificity,1,1e-12);
near(roc.optimal.youden,1,1e-12);
assert.strictEqual(roc.n,6);
assert.strictEqual(roc.positives,3);
assert.strictEqual(roc.negatives,3);

// Blank and invalid pairs are excluded rather than coerced to zero.
const clean=p.cleanRocPairs([1,2,'',4,5],[0,0,1,1,'x']);
assert.deepStrictEqual(clean,[[1,0],[2,0],[4,1]]);

// Bootstrap interval must contain the perfect AUC in a perfectly separated sample.
const aucCI=p.bootstrapAuc(scores,labels,300,54001);
assert.ok(aucCI[0]<=1&&aucCI[1]>=1);

// Wilson intervals remain inside the probability scale.
const ci=p.wilson(8,10);
assert.ok(ci[0]>=0&&ci[1]<=1&&ci[0]<0.8&&ci[1]>0.8);

// Percentiles/descriptives use linear interpolation and sample SD.
near(p.percentile([0,10,20,30,40],0.5),20,1e-12);
const d=p.describe([10,20,30,40,50]);
assert.strictEqual(d.n,5);
near(d.mean,30,1e-12);
near(d.percentiles[50],30,1e-12);
near(d.min,10,1e-12);
near(d.max,50,1e-12);

// Descriptive bands count all valid observations once.
const b=p.bandSummary([10,20,30,40,50,60],25,45);
assert.deepStrictEqual(b.counts,{Bajo:2,Medio:2,Alto:2});
near(b.percentages.Bajo,1/3,1e-12);
near(b.percentages.Medio,1/3,1e-12);
near(b.percentages.Alto,1/3,1e-12);

console.log('ValiStruct performance and norming numerical checks: OK');
