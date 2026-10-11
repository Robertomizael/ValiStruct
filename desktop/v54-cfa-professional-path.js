(() => {
  'use strict';

  const q=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const fmt=value=>Number.isFinite(Number(value))?Number(value).toFixed(2):'—';

  function modelGroups(result){
    const params=Array.isArray(result?.parameters)?result.parameters:[];
    const loadings=params.filter(p=>p.op==='=~'&&Number.isFinite(Number(p.std_all)));
    const factors=[...new Set(loadings.map(p=>String(p.lhs)))];
    return factors.map(name=>({name,items:loadings.filter(p=>String(p.lhs)===name).map(p=>({name:String(p.rhs),loading:Number(p.std_all)}))})).filter(f=>f.items.length);
  }

  function professionalPathSvg(result){
    const groups=modelGroups(result);
    if(!groups.length)return'';
    const factorGap=300,itemGap=78,margin=70;
    const maxItems=Math.max(...groups.map(g=>g.items.length));
    const width=Math.max(960,margin*2+groups.length*factorGap);
    const height=Math.max(500,margin*2+maxItems*itemGap);
    const factorY=height/2;
    let svg=`<svg id="vsCfaProfessionalPathSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="Diagrama PATH del AFC profesional"><defs><marker id="vsCfaArrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#334155"/></marker></defs><rect width="100%" height="100%" fill="white"/><text x="${margin}" y="34" font-size="20" font-weight="700">Diagrama PATH · AFC profesional</text>`;
    groups.forEach((group,fi)=>{
      const fx=margin+130+fi*factorGap;
      svg+=`<ellipse cx="${fx}" cy="${factorY}" rx="82" ry="36" fill="#f8eef0" stroke="#7c1f2a" stroke-width="2"/><text x="${fx}" y="${factorY+5}" text-anchor="middle" font-size="14" font-weight="700">${esc(group.name)}</text>`;
      const total=(group.items.length-1)*itemGap;
      group.items.forEach((item,ii)=>{
        const iy=factorY-total/2+ii*itemGap;
        const ix=fx+150;
        const lineStart=fx+82,lineEnd=ix;
        const midX=(lineStart+lineEnd)/2,midY=(factorY+iy)/2;
        svg+=`<line x1="${lineStart}" y1="${factorY}" x2="${lineEnd}" y2="${iy}" stroke="#334155" stroke-width="1.7" marker-end="url(#vsCfaArrow)"/><text x="${midX}" y="${midY-7}" text-anchor="middle" font-size="12">${fmt(item.loading)}</text><rect x="${ix}" y="${iy-22}" width="112" height="44" rx="6" fill="#fff" stroke="#64748b"/><text x="${ix+56}" y="${iy+5}" text-anchor="middle" font-size="13">${esc(item.name)}</text>`;
      });
    });
    svg+='</svg>';
    return svg;
  }

  function downloadSvg(){
    const svg=q('vsCfaProfessionalPathSvg');if(!svg)return alert('Primero estime el AFC profesional.');
    const text=new XMLSerializer().serializeToString(svg),blob=new Blob([text],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='ValiStruct_AFC_profesional_PATH.svg';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
  }

  function downloadPng(){
    const svg=q('vsCfaProfessionalPathSvg');if(!svg)return alert('Primero estime el AFC profesional.');
    const text=new XMLSerializer().serializeToString(svg),blob=new Blob([text],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),img=new Image();
    img.onload=()=>{const vb=svg.viewBox.baseVal,canvas=document.createElement('canvas');canvas.width=Math.max(960,Math.round(vb.width));canvas.height=Math.max(500,Math.round(vb.height));const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);canvas.toBlob(png=>{const dl=URL.createObjectURL(png),a=document.createElement('a');a.href=dl;a.download='ValiStruct_AFC_profesional_PATH.png';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(dl),500);},'image/png');};
    img.src=url;
  }

  function renderProfessionalPath(){
    const host=q('cfaProfessionalResults');
    const result=window.__valistructCfaProfessionalLast;
    if(!host||!result)return;
    const existing=q('vsCfaProfessionalPathPanel');if(existing)existing.remove();
    const svg=professionalPathSvg(result);if(!svg)return;
    const panel=document.createElement('section');panel.id='vsCfaProfessionalPathPanel';panel.className='workspace';
    panel.innerHTML=`<h3>Representación gráfica del modelo</h3><p class="ci-note">Las flechas muestran las cargas factoriales estandarizadas estimadas por R/lavaan. La figura es descriptiva del modelo estimado y no sustituye la evaluación de ajuste global.</p><div class="button-row"><button id="vsDownloadCfaPathSvg" type="button">Descargar PATH SVG</button><button id="vsDownloadCfaPathPng" type="button">Descargar PATH PNG</button></div>${svg}`;
    host.appendChild(panel);
    q('vsDownloadCfaPathSvg')?.addEventListener('click',downloadSvg);
    q('vsDownloadCfaPathPng')?.addEventListener('click',downloadPng);
    setTimeout(()=>window.ValiStructResultsHubCapture?.(),0);
  }

  const host=q('cfaProfessionalResults');
  if(host){
    const observer=new MutationObserver(()=>{if(window.__valistructCfaProfessionalLast&&!q('vsCfaProfessionalPathPanel'))renderProfessionalPath();});
    observer.observe(host,{childList:true,subtree:true});
  }
  if(window.__valistructCfaProfessionalLast)renderProfessionalPath();
  window.ValiStructRenderProfessionalCfaPath=renderProfessionalPath;
})();
