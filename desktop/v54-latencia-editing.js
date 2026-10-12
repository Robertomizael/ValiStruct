(() => {
  'use strict';

  const renameButton = document.getElementById('renameNode');
  const canvas = document.getElementById('latenciaCanvas');
  if (!renameButton || !canvas || typeof window.renameSelected !== 'function') return;

  function selectedLabel() {
    const node = canvas.querySelector('.sem-node.selected');
    if (node) return (node.querySelector('text')?.textContent || '').trim();
    const edge = canvas.querySelector('.sem-edge.selected, .selected.sem-edge');
    return (edge?.parentElement?.querySelector('.edge-label')?.textContent || '').trim();
  }

  function ensureDialog() {
    let overlay = document.getElementById('v54LatenciaEditor');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'v54LatenciaEditor';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.35);display:none;align-items:center;justify-content:center;z-index:2147483000;padding:20px;';
    overlay.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="v54LatenciaEditorTitle" style="width:min(520px,92vw);background:#fff;border-radius:14px;box-shadow:0 18px 60px rgba(15,23,42,.28);padding:22px;">
        <h3 id="v54LatenciaEditorTitle" style="margin:0 0 8px">Editar elemento del modelo</h3>
        <p style="margin:0 0 14px;color:#475569">Cambie el nombre de la variable latente, indicador, error o etiqueta de relación seleccionada.</p>
        <label style="display:block;font-weight:600">Nombre / etiqueta
          <input id="v54LatenciaEditorInput" type="text" autocomplete="off" style="box-sizing:border-box;width:100%;margin-top:7px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font:inherit">
        </label>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
          <button type="button" id="v54LatenciaEditorCancel">Cancelar</button>
          <button type="button" id="v54LatenciaEditorSave" class="primary">Guardar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  function closeEditor() {
    const overlay = document.getElementById('v54LatenciaEditor');
    if (overlay) overlay.style.display = 'none';
  }

  function applyRename(value) {
    const clean = String(value ?? '').trim();
    const selectedEdge = canvas.querySelector('.sem-edge.selected, .selected.sem-edge');
    if (!clean && !selectedEdge) return;
    const nativePrompt = window.prompt;
    try {
      window.prompt = () => clean;
      window.renameSelected();
    } finally {
      window.prompt = nativePrompt;
    }
  }

  function openEditor() {
    const selected = canvas.querySelector('.sem-node.selected, .sem-edge.selected, .selected.sem-edge');
    if (!selected) {
      alert('Seleccione primero una variable, indicador, error o relación del diagrama.');
      return;
    }
    const overlay = ensureDialog();
    const input = overlay.querySelector('#v54LatenciaEditorInput');
    input.value = selectedLabel();
    overlay.style.display = 'flex';
    requestAnimationFrame(() => { input.focus(); input.select(); });
  }

  function cancelDragState(){
    try{ canvas.dispatchEvent(new Event('pointercancel',{bubbles:true,cancelable:true})); }catch(_){ }
    try{ window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true})); }catch(_){ }
  }

  renameButton.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    openEditor();
  }, true);

  document.addEventListener('click', event => {
    if (event.target?.id === 'v54LatenciaEditorCancel') closeEditor();
    if (event.target?.id === 'v54LatenciaEditorSave') {
      const input = document.getElementById('v54LatenciaEditorInput');
      applyRename(input?.value);
      closeEditor();
    }
  });

  document.addEventListener('keydown', event => {
    const overlay = document.getElementById('v54LatenciaEditor');
    if (!overlay || overlay.style.display === 'none') return;
    if (event.key === 'Escape') { event.preventDefault(); closeEditor(); }
    if (event.key === 'Enter' && event.target?.id === 'v54LatenciaEditorInput') {
      event.preventDefault();
      applyRename(event.target.value);
      closeEditor();
    }
  });

  // app.js prevents the browser dblclick event while dragging with Pointer
  // Events. Detect two pointerdown events on the same node instead.
  let lastDown={id:null,time:0};
  canvas.addEventListener('pointerdown', event => {
    const node=event.target.closest?.('.sem-node');
    if(!node) return;
    const id=node.dataset.id||'';
    const now=performance.now();
    if(id && lastDown.id===id && now-lastDown.time<=450){
      lastDown={id:null,time:0};
      cancelDragState();
      setTimeout(openEditor,0);
      return;
    }
    lastDown={id,time:now};
  }, true);

  // Keep the native dblclick path as a fallback in environments where it is
  // emitted normally.
  canvas.addEventListener('dblclick', event => {
    if (!event.target.closest?.('.sem-node')) return;
    event.preventDefault();
    cancelDragState();
    setTimeout(openEditor, 0);
  });
})();