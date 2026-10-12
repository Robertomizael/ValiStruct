/* ValiStruct v5.4 · contextual right-click menu for desktop renderer. */
(function(){
  'use strict';
  if (window.__VALISTRUCT_CONTEXT_MENU_V54__) return;
  window.__VALISTRUCT_CONTEXT_MENU_V54__ = true;

  const style=document.createElement('style');
  style.textContent=`
    .vs-context-menu{position:fixed;z-index:2147483647;min-width:210px;background:#fff;border:1px solid #cfd7e3;border-radius:10px;box-shadow:0 12px 32px rgba(15,35,60,.20);padding:6px;font:14px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17324f}
    .vs-context-menu button{display:block;width:100%;border:0;background:transparent;text-align:left;padding:9px 12px;border-radius:7px;color:inherit;cursor:pointer}
    .vs-context-menu button:hover:not(:disabled){background:#eef5fb}
    .vs-context-menu button:disabled{opacity:.42;cursor:default}
    .vs-context-menu .sep{height:1px;background:#e5eaf0;margin:5px 3px}
  `;
  document.head.appendChild(style);

  let menu=null;
  function closeMenu(){ if(menu){ menu.remove(); menu=null; } }
  function isTextControl(el){ return !!el && (el.matches?.('input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), textarea') || el.isContentEditable); }
  function selectedText(){ return String(window.getSelection?.()?.toString?.() || ''); }
  async function copyText(text){
    try{ await navigator.clipboard.writeText(String(text||'')); return true; }catch(_){
      try{ document.execCommand('copy'); return true; }catch(__){ return false; }
    }
  }
  async function pasteInto(el){
    let text='';
    try{ text=await navigator.clipboard.readText(); }catch(_){ return; }
    if(!text) return;
    if(el.isContentEditable){ document.execCommand('insertText',false,text); el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text})); return; }
    const start=Number.isFinite(el.selectionStart)?el.selectionStart:el.value.length;
    const end=Number.isFinite(el.selectionEnd)?el.selectionEnd:start;
    el.setRangeText(text,start,end,'end');
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function selectAll(el){
    if(el?.select) return el.select();
    if(el?.isContentEditable){ const r=document.createRange(); r.selectNodeContents(el); const s=window.getSelection(); s.removeAllRanges(); s.addRange(r); return; }
    const r=document.createRange(); r.selectNodeContents(document.body); const s=window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function item(label,action,enabled=true){ return {label,action,enabled}; }
  function divider(){ return {divider:true}; }
  function show(items,x,y){
    closeMenu();
    menu=document.createElement('div'); menu.className='vs-context-menu'; menu.setAttribute('role','menu');
    items.forEach(it=>{
      if(it.divider){ const d=document.createElement('div'); d.className='sep'; menu.appendChild(d); return; }
      const b=document.createElement('button'); b.type='button'; b.textContent=it.label; b.disabled=it.enabled===false;
      b.addEventListener('click',async()=>{ closeMenu(); try{ await it.action?.(); }catch(err){ console.error('[ValiStruct] context action failed',err); } });
      menu.appendChild(b);
    });
    document.body.appendChild(menu);
    const rect=menu.getBoundingClientRect();
    menu.style.left=Math.max(6,Math.min(x,window.innerWidth-rect.width-8))+'px';
    menu.style.top=Math.max(6,Math.min(y,window.innerHeight-rect.height-8))+'px';
  }

  function semHitAt(x,y){
    const stack=document.elementsFromPoint?.(x,y)||[];
    const node=stack.map(el=>el.closest?.('#latenciaCanvas .sem-node')).find(Boolean)||null;
    const edge=stack.map(el=>el.closest?.('#latenciaCanvas .sem-edge')).find(Boolean)||null;
    return {node,edge};
  }

  function stopSemDrag(){
    const canvas=document.getElementById('latenciaCanvas');
    try{ canvas?.dispatchEvent(new Event('pointercancel',{bubbles:true,cancelable:true})); }catch(_){ }
    try{ window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true,button:2})); }catch(_){ }
  }

  function selectSemHit(node,edge){
    stopSemDrag();
    if(edge){
      try{ edge.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0})); }catch(_){ }
      return;
    }
    // Nodes are selected by the real pointerdown/mousedown that precedes the
    // contextmenu event. Do not synthesize another down event: it would arm
    // both the legacy and pointer draggers and can move a node on Windows.
    if(node && !node.classList.contains('selected')){
      try{
        node.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,clientX:0,clientY:0,button:0}));
        window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true,button:0}));
      }catch(_){ }
    }
  }

  document.addEventListener('contextmenu',evt=>{
    const target=evt.target;
    const hit=semHitAt(evt.clientX,evt.clientY);
    const node=hit.node;
    const edge=hit.edge;
    const editable=target?.closest?.('input,textarea,[contenteditable="true"]');
    const selection=selectedText();

    if(node || edge){
      evt.preventDefault(); evt.stopPropagation();
      selectSemHit(node,edge);
      const label=node ? (node.querySelector('text')?.textContent||'') : '';
      const items=[];
      if(node){
        items.push(item('Renombrar',()=>document.getElementById('renameNode')?.click()));
        items.push(item('Copiar nombre',()=>copyText(label),Boolean(label)));
        items.push(divider());
        items.push(item('Eliminar',()=>document.getElementById('deleteSelected')?.click()));
      }else{
        items.push(item('Editar etiqueta de relación',()=>document.getElementById('renameNode')?.click()));
        items.push(divider());
        items.push(item('Eliminar relación',()=>document.getElementById('deleteSelected')?.click()));
      }
      show(items,evt.clientX,evt.clientY); return;
    }

    if(isTextControl(editable)){
      evt.preventDefault(); evt.stopPropagation();
      const hasSelection = editable.isContentEditable ? Boolean(selection) : Number.isFinite(editable.selectionStart) && editable.selectionEnd>editable.selectionStart;
      show([
        item('Deshacer',()=>document.execCommand('undo')),
        item('Rehacer',()=>document.execCommand('redo')),
        divider(),
        item('Cortar',()=>document.execCommand('cut'),hasSelection),
        item('Copiar',()=>document.execCommand('copy'),hasSelection || Boolean(selection)),
        item('Pegar',()=>pasteInto(editable)),
        divider(),
        item('Seleccionar todo',()=>selectAll(editable))
      ],evt.clientX,evt.clientY); return;
    }

    evt.preventDefault(); evt.stopPropagation();
    show([
      item('Copiar',()=>copyText(selection),Boolean(selection)),
      item('Seleccionar todo',()=>selectAll(document.body))
    ],evt.clientX,evt.clientY);
  },true);

  document.addEventListener('pointerdown',evt=>{ if(menu && !evt.target.closest?.('.vs-context-menu')) closeMenu(); },true);
  document.addEventListener('keydown',evt=>{ if(evt.key==='Escape') closeMenu(); },true);
  window.addEventListener('blur',closeMenu);
})();