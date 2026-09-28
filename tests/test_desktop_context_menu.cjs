/* Simulate native Electron right-click menu without launching a desktop app. */
const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../desktop/main.js'),'utf8');
const start=source.indexOf('function installTextContextMenu(win) {');
const end=source.indexOf('\nasync function createWindow()',start);
assert.ok(start>=0 && end>start,'native context-menu installer must exist');

function context(){
  let listener,template,popped=false;
  const win={webContents:{on(name,fn){assert.equal(name,'context-menu');listener=fn;}}};
  const sandbox={
    Menu:{buildFromTemplate(items){template=items;return {popup({window}){assert.equal(window,win);popped=true;}}}},
    clipboard:{readText(){return 'texto copiado';}},
  };
  vm.runInNewContext(source.slice(start,end)+'\ninstallTextContextMenu(win);',
    {...sandbox,win});
  return {
    fire(params){template=undefined;popped=false;listener(null,params);return {template,popped};}
  };
}

test('right-click in syntax editor offers native clipboard and undo actions',()=>{
  const c=context();
  const out=c.fire({isEditable:true,selectionText:'F1 =~ i01',editFlags:{
    canUndo:true,canRedo:false,canCut:true,canCopy:true,canPaste:true
  }});
  assert.equal(out.popped,true);
  const roles=out.template.filter(x=>x.role).map(x=>x.role);
  assert.deepEqual(Array.from(roles),['undo','redo','cut','copy','paste','selectAll']);
  assert.equal(out.template.find(x=>x.role==='redo').enabled,false);
});

test('right-click selected result text allows copying without editing',()=>{
  const c=context();
  const out=c.fire({isEditable:false,selectionText:'CFI = .96',editFlags:{}});
  assert.equal(out.popped,true);
  assert.deepEqual(Array.from(out.template.map(x=>x.role)),['copy','selectAll']);
});

test('right-click ordinary noneditable area does not show text menu',()=>{
  const c=context();
  const out=c.fire({isEditable:false,selectionText:'',editFlags:{}});
  assert.equal(out.popped,false);
});
