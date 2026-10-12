'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');

function loadSlice(file,startNeedle,endNeedle,sandbox={}){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  const start=source.indexOf(startNeedle);
  const end=source.indexOf(endNeedle,start);
  assert.ok(start>=0,`${startNeedle} must exist in ${file}`);
  assert.ok(end>start,`${endNeedle} must follow ${startNeedle} in ${file}`);
  const context=vm.createContext({...sandbox});
  vm.runInContext(source.slice(start,end),context,{filename:file});
  return {context,source};
}

test('new content-validity templates stop before IDENTIFICACIÓN DE EXPERTOS',()=>{
  const {context}=loadSlice(
    'desktop/content-validity-xlsx-hardening.js',
    'const norm=',
    'async function validateUpload',
    {document:{querySelector(){return null;},querySelectorAll(){return[];},getElementById(){return null;}}}
  );
  const rows=[
    ['VALISTRUCT_PROFILE','cvi'],
    ['Número de ítems','3'],
    [],
    ['Dimensión','No. ítem','Ítem','Juez 1','Juez 2','Observaciones'],
    ['',1,'Ítem 1',4,4,''],
    ['',2,'Ítem 2',4,3,''],
    ['',3,'Ítem 3',3,4,''],
    [],
    ['IDENTIFICACIÓN DE EXPERTOS'],
    ['Columna','Nombre o código del experto','Correo/identificador opcional'],
    ['Juez 1','Experto A','a@example.test']
  ];
  const m=vm.runInContext('matrixInfo',context)(rows);
  assert.equal(m.items,3);
  assert.equal(m.dataRows.length,3);
});

test('renderer imports only scientific item rows and ignores expert footer',()=>{
  const {context}=loadSlice(
    'desktop/content-validity-xlsx-renderer.js',
    'const norm=',
    'function setNum',
    {document:{querySelector(){return null;},querySelectorAll(){return[];},getElementById(){return null;}}}
  );
  const rows=[
    ['Dimensión','No. ítem','Ítem','Experto 1','Experto 2','Experto 3','Ronda','Observaciones'],
    ['',1,'Ítem 1',5,4,5,1,''],
    ['',2,'Ítem 2',4,4,5,1,''],
    [],
    ['IDENTIFICACIÓN DE EXPERTOS'],
    ['Columna','Nombre o código del experto','Correo/identificador opcional'],
    ['Experto 1','A','a@example.test']
  ];
  const m=vm.runInContext('matrix',context)(rows,'experto');
  assert.equal(m.data.length,2);
  assert.deepEqual(Array.from(m.data.map(x=>x.item)),['Ítem 1','Ítem 2']);
});

test('Aiken structure is identified and cannot silently enter I-CVI',()=>{
  const {context}=loadSlice(
    'desktop/content-validity-xlsx-hardening.js',
    'const norm=',
    'async function validateUpload',
    {document:{querySelector(){return null;},querySelectorAll(){return[];},getElementById(){return null;}}}
  );
  const matrix={headers:['dimension','no item','item','criterio','juez 1','juez 2'],dataRows:[]};
  const profile=vm.runInContext('inferProfile',context)({},matrix);
  assert.equal(profile,'aiken');
});

test('right-click relation selection uses click, not mousedown',()=>{
  const source=fs.readFileSync(path.join(root,'desktop/v54-context-menu.js'),'utf8');
  const start=source.indexOf('function semHitAt');
  const end=source.indexOf("document.addEventListener('contextmenu'",start);
  assert.ok(start>=0&&end>start);
  const events=[];
  class FakeMouseEvent{constructor(type,init={}){this.type=type;Object.assign(this,init);}}
  const edge={dispatchEvent(evt){events.push(evt.type);},closest(){return this;}};
  const document={
    elementsFromPoint(){return[{closest(sel){return sel.includes('.sem-edge')?edge:null;}}];},
    getElementById(){return null;}
  };
  const window={dispatchEvent(){events.push('window-mouseup');}};
  const context=vm.createContext({document,window,MouseEvent:FakeMouseEvent,Event:class{constructor(type){this.type=type;}}});
  vm.runInContext(source.slice(start,end)+'\nthis.semHitAt=semHitAt;this.selectSemHit=selectSemHit;',context);
  const hit=context.semHitAt(10,10);
  assert.equal(hit.edge,edge);
  context.selectSemHit(null,edge);
  assert.ok(events.includes('click'));
  assert.ok(!events.includes('mousedown'));
});

test('Latencia editing contains pointer-based double activation fallback',()=>{
  const source=fs.readFileSync(path.join(root,'desktop/v54-latencia-editing.js'),'utf8');
  assert.match(source,/addEventListener\('pointerdown'/);
  assert.match(source,/lastDown\.id===id/);
  assert.match(source,/now-lastDown\.time<=450/);
  assert.match(source,/pointercancel/);
});
