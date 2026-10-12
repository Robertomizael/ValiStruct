(() => {
  'use strict';

  const HUB_ID='vsAllResultsHub';

  function install(){
    const hub=document.getElementById(HUB_ID);
    if(!hub || hub.dataset.previewFix==='yes') return;
    hub.dataset.previewFix='yes';

    // Capture the click before the legacy preview handler inserts a table/SVG
    // directly into the observed result-center DOM. Rendering the preview in
    // an iframe avoids the MutationObserver -> capture() -> render() loop that
    // immediately destroyed the preview.
    hub.addEventListener('click',event=>{
      const btn=event.target.closest?.('.vs-all-view');
      if(!btn) return;
      if(btn.dataset.vsPreviewBypass==='1') return;
      event.preventDefault();
      event.stopImmediatePropagation();

      const card=btn.closest('article.card');
      const preview=card?.querySelector('[id^="vsAllPreview"]');
      if(!preview) return;

      if(!preview.hidden){
        preview.hidden=true;
        preview.replaceChildren();
        btn.textContent='Vista previa';
        return;
      }

      // The legacy handler stores the serialized HTML in its private snapshots
      // Map, so obtain the same preview through the button's existing handler
      // once, but isolate DOM mutations from the observed tree by temporarily
      // replacing innerHTML on the preview host with a detached sink.
      const originalDescriptor=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
      let captured='';
      if(!originalDescriptor?.set || !originalDescriptor?.get) return;

      try{
        Object.defineProperty(preview,'innerHTML',{
          configurable:true,
          get(){ return captured; },
          set(value){ captured=String(value??''); }
        });
        // Re-dispatch a synthetic click after this capture listener has been
        // bypassed. The original element listener writes into the intercepted
        // innerHTML property, giving us the serialized table/figure without
        // mutating the observed DOM.
        btn.dataset.vsPreviewBypass='1';
        btn.click();
      }finally{
        delete btn.dataset.vsPreviewBypass;
        delete preview.innerHTML;
      }

      if(!captured){
        preview.hidden=false;
        preview.textContent='No fue posible generar la vista previa.';
        return;
      }

      const frame=document.createElement('iframe');
      frame.className='vs-results-preview-frame';
      frame.setAttribute('title','Vista previa de resultado');
      frame.style.width='100%';
      frame.style.minHeight='360px';
      frame.style.border='1px solid #d7dde5';
      frame.style.borderRadius='10px';
      frame.style.background='#fff';
      frame.srcdoc=`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;margin:18px;color:#17324d}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccd4dd;padding:7px;text-align:left}th{background:#f3f6f9}svg{max-width:100%;height:auto}</style></head><body>${captured}</body></html>`;
      preview.replaceChildren(frame);
      preview.hidden=false;
      btn.textContent='Ocultar vista previa';
    },true);
  }

  const start=()=>{
    install();
    const root=document.getElementById('resultcenter')||document.body;
    new MutationObserver(()=>install()).observe(root,{childList:true,subtree:true});
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
