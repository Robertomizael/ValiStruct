(() => {
  'use strict';
  const q=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const snapshots=new Map();
  let renderTimer=null;

  function closestModule(el){
    const panel=el.closest?.('.panel');
    const heading=panel?.querySelector(':scope > .section-heading h2, :scope > h2, .vs-v52-module-header h2');
    return heading?.textContent?.trim()||panel?.id||'Resultados ValiStruct';
  }
  function closestTitle(el,index,type){
    let node=el.previousElementSibling;
    while(node&&node!==el.parentElement){
      if(node.matches?.('h2,h3,h4'))return node.textContent.trim();
      node=node.previousElementSibling;
    }
    return `${type==='table'?'Tabla':'Figura'} ${index+1}`;
  }
  function resultHost(el){
    let node=el.parentElement;
    while(node&&node!==document.body){
      const id=String(node.id||'').toLowerCase();
      if(id.includes('result')||id.includes('output')||id.includes('dashboard')||id.includes('report'))return true;
      node=node.parentElement;
    }
    return false;
  }
  function addSnapshot(el,index,type){
    if(!resultHost(el))return;
    if(el.closest('#vsAllResultsHub'))return;
    const module=closestModule(el),title=closestTitle(el,index,type);
    const html=type==='table'?el.outerHTML:new XMLSerializer().serializeToString(el);
    const key=`${module}|${title}|${type}|${html.length}|${html.slice(0,180)}`;
    if(!snapshots.has(key))snapshots.set(key,{key,module,title,type,html,createdAt:new Date().toISOString()});
  }
  function capture(){
    document.querySelectorAll('.panel table').forEach((el,i)=>addSnapshot(el,i,'table'));
    document.querySelectorAll('.panel svg').forEach((el,i)=>{
      if(el.id==='latenciaCanvas')return;
      addSnapshot(el,i,'figure');
    });
    scheduleRender();
  }
  function scheduleRender(){clearTimeout(renderTimer);renderTimer=setTimeout(render,60);}

  function download(entry){
    if(entry.type==='figure'){
      const blob=new Blob([entry.html],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=`ValiStruct_${entry.title.replace(/[^a-z0-9]+/gi,'_')}.svg`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);return;
    }
    const doc=`<!doctype html><meta charset="utf-8"><title>${esc(entry.title)}</title><style>body{font-family:Arial,sans-serif;margin:36px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:7px}th{background:#f3f3f3}</style><h1>${esc(entry.title)}</h1><p>${esc(entry.module)}</p>${entry.html}`;
    const blob=new Blob([doc],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ValiStruct_${entry.title.replace(/[^a-z0-9]+/gi,'_')}.html`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
  }
  function downloadSelected(){
    const chosen=[...document.querySelectorAll('#vsAllResultsList .vs-all-pick:checked')].map(x=>snapshots.get(x.dataset.key)).filter(Boolean);
    if(!chosen.length)return alert('Seleccione al menos una tabla o figura.');
    const body=chosen.map((e,i)=>`<section><h2>${i+1}. ${esc(e.title)}</h2><p>${esc(e.module)}</p>${e.type==='table'?e.html:`<div>${e.html}</div>`}</section>`).join('<hr>');
    const blob=new Blob([`<!doctype html><meta charset="utf-8"><title>ValiStruct · Selección de resultados</title><style>body{font-family:Arial,sans-serif;margin:36px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:7px}th{background:#f3f3f3}svg{max-width:100%;height:auto}</style><h1>ValiStruct · Selección de resultados</h1>${body}`],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ValiStruct_seleccion_resultados.html';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
  }
  function render(){
    const list=q('vsAllResultsList');if(!list)return;
    const filter=q('vsAllResultsFilter')?.value||'all';
    const entries=[...snapshots.values()].filter(e=>filter==='all'||e.type===filter);
    q('vsAllResultsCount').textContent=`${entries.length} resultado(s) disponible(s) en esta sesión`;
    if(!entries.length){list.innerHTML='<p class="ci-note">Todavía no hay tablas o figuras calculadas.</p>';return;}
    list.innerHTML=entries.map((e,i)=>`<article class="card"><label><input class="vs-all-pick" type="checkbox" data-key="${esc(e.key)}"> <strong>${esc(e.title)}</strong></label><p>${esc(e.module)} · ${e.type==='table'?'Tabla':'Figura'}</p><div class="button-row compact"><button class="vs-all-view" type="button" data-key="${esc(e.key)}" data-i="${i}">Vista previa</button><button class="vs-all-download" type="button" data-key="${esc(e.key)}">Descargar</button></div><div id="vsAllPreview${i}" hidden></div></article>`).join('');
    list.querySelectorAll('.vs-all-view').forEach(btn=>btn.addEventListener('click',()=>{const e=snapshots.get(btn.dataset.key),p=q(`vsAllPreview${btn.dataset.i}`);if(!e||!p)return;p.hidden=!p.hidden;p.innerHTML=e.html;}));
    list.querySelectorAll('.vs-all-download').forEach(btn=>btn.addEventListener('click',()=>{const e=snapshots.get(btn.dataset.key);if(e)download(e);}));
  }
  function install(){
    const section=q('resultcenter');if(!section)return;
    q('vsResultCatalog')?.remove();
    if(q('vsAllResultsHub'))return;
    const box=document.createElement('section');box.id='vsAllResultsHub';box.className='workspace';
    box.innerHTML=`<h3>Centro integral de tablas y figuras</h3><p>ValiStruct conserva durante esta sesión las salidas generadas para que pueda revisar y decidir cuáles descargar.</p><div class="config-grid"><label>Mostrar<select id="vsAllResultsFilter"><option value="all">Todo</option><option value="table">Solo tablas</option><option value="figure">Solo figuras</option></select></label></div><div class="button-row"><button id="vsAllResultsRefresh" type="button" class="primary">Actualizar resultados</button><button id="vsAllResultsDownload" type="button">Descargar selección</button></div><p id="vsAllResultsCount" class="ci-note"></p><div id="vsAllResultsList"></div>`;
    const heading=section.querySelector('.section-heading');if(heading)heading.insertAdjacentElement('afterend',box);else section.insertBefore(box,section.firstChild);
    q('vsAllResultsRefresh')?.addEventListener('click',capture);q('vsAllResultsDownload')?.addEventListener('click',downloadSelected);q('vsAllResultsFilter')?.addEventListener('change',render);
    capture();
  }
  install();
  const main=q('mainContent')||document.body;
  const observer=new MutationObserver(mutations=>{
    if(mutations.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('table,svg')||n.querySelector?.('table,svg')))))capture();
  });
  observer.observe(main,{childList:true,subtree:true});
  window.ValiStructResultsHubCapture=capture;
})();
