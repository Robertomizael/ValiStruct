const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','jasp-import.js'),'utf8');
const sandbox={window:{},document:{getElementById(){return null;}},console};
vm.runInNewContext(source,sandbox,{filename:'jasp-import.js'});
const parse=sandbox.window.ValiStructJaspImporter.parse;

test('imports raw lavaan measurement model',()=>{
 const r=parse('F1 =~ i01 + i02 + i03\nF2 =~ i04 + i05 + i06');
 assert.deepEqual(Array.from(r.factors),['F1','F2']);
 assert.deepEqual(Array.from(r.required),['i01','i02','i03','i04','i05','i06']);
});
test('imports JASP-style R wrapper without executing the R code',()=>{
 const r=parse("library(lavaan)\nmodel <- 'F1 =~ i01 + i02 + i03'\nfit <- cfa(model, data = d, estimator = 'WLSMV', ordered=c('i01','i02'))");
 assert.equal(r.model,'F1 =~ i01 + i02 + i03');
 assert.equal(r.estimator,'WLSMV');
 assert.deepEqual(Array.from(r.ordinal),['i01','i02']);
});
test('warns on options that cannot be reproduced automatically',()=>{
 const r=parse("model <- 'F =~ i1 + i2 + i3'\nfit <- cfa(model, data = datos, group='sexo', std.lv=TRUE)");
 assert.ok(r.warnings.some(x=>x.includes('group')));
 assert.ok(r.warnings.some(x=>x.includes('std.lv')));
});
test('does not guess an unsupported estimator',()=>{
 const r=parse("model <- 'F =~ i1 + i2 + i3'\nfit <- cfa(model, estimator='DWLS')");
 assert.equal(r.estimator,undefined);
 assert.ok(r.warnings.some(x=>x.includes('DWLS')));
});
test('rejects generic R scripts and code with no literal model',()=>{
 assert.throws(()=>parse('fit <- jaspSem::runAnalysis(data)'),/modelo lavaan literal/);
});
test('rejects non-model text and malformed model lines',()=>{
 assert.throws(()=>parse('data.frame(x=1)'),/modelo lavaan literal/);
 assert.throws(()=>parse('F =~ i01 + i02\nthis is not lavaan'),/fuera del importador seguro/);
});
