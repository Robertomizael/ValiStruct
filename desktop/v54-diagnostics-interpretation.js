(() => {
  'use strict';

  const q=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const getGlobal=name=>{try{return window.eval(name);}catch(_){return null;}};
  const fmt=(v,d=2)=>Number.isFinite(Number(v))?Number(v).toFixed(d):'—';

  function diagnosticThresholds(){
    return {
      skew:Number(q('diagSkewThreshold')?.value)||2,
      kurt:Number(q('diagKurtThreshold')?.value)||7,
      z:Number(q('diagOutlierZ')?.value)||3.29
    };
  }

  function variableDistribution(row,index){
    const data=getGlobal('diagData');
    if(!data?.matrix?.length)return null;
    const values=data.matrix.map(r=>r[index]).filter(Number.isFinite);
    if(!values.length)return null;
    const mean=values.reduce((a,b)=>a+b,0)/values.length;
    const variance=values.length>1?values.reduce((s,v)=>s+(v-mean)**2,0)/(values.length-1):0;
    const sd=Math.sqrt(variance);
    let maxZ=NaN,maxZValue=NaN;
    if(sd>0){
      values.forEach(v=>{const z=(v-mean)/sd;if(!Number.isFinite(maxZ)||Math.abs(z)>Math.abs(maxZ)){maxZ=z;maxZValue=v;}});
    }
    const min=Math.min(...values),max=Math.max(...values);
    const integerOrdinal=values.every(v=>Math.abs(v-Math.round(v))<1e-10)&&new Set(values).size<=7;
    const floorPct=100*values.filter(v=>v===min).length/values.length;
    const ceilingPct=100*values.filter(v=>v===max).length/values.length;
    return {maxZ,maxZValue,min,max,floorPct,ceilingPct,integerOrdinal};
  }

  function interpretation(row,index){
    const t=diagnosticThresholds();
    const dist=variableDistribution(row,index);
    const alerts=[];
    if(Number(row.skew)<=-t.skew)alerts.push(`Asimetría ${fmt(row.skew)}: concentración hacia puntuaciones altas; revisar posible efecto techo.`);
    else if(Number(row.skew)>=t.skew)alerts.push(`Asimetría +${fmt(row.skew)}: concentración hacia puntuaciones bajas; revisar posible efecto suelo.`);
    if(Math.abs(Number(row.kurt))>t.kurt){
      if(Number(row.kurt)>0)alerts.push(`Curtosis ${fmt(row.kurt)}: distribución altamente concentrada; revisar junto con frecuencias por categorías.`);
      else alerts.push(`Curtosis ${fmt(row.kurt)}: distribución más aplanada de lo esperado; revisar junto con frecuencias por categorías.`);
    }
    if(dist&&Number.isFinite(dist.maxZ)&&Math.abs(dist.maxZ)>=t.z)alerts.push(`z extremo ${dist.maxZ>=0?'+':''}${fmt(dist.maxZ)}: posible valor atípico univariado. Verifique el registro antes de decidir su exclusión.`);
    if(dist?.integerOrdinal){
      if(dist.ceilingPct>=15)alerts.push(`Posible efecto techo: ${fmt(dist.ceilingPct,1)}% de respuestas en la categoría máxima observada.`);
      if(dist.floorPct>=15)alerts.push(`Posible efecto suelo: ${fmt(dist.floorPct,1)}% de respuestas en la categoría mínima observada.`);
    }
    if(Number(row.missing)>5)alerts.push(`Datos faltantes ${fmt(row.missing,1)}%: revisar patrón de ausencia antes del modelamiento.`);
    if(!alerts.length)return{level:'green',label:'Sin alerta relevante',text:'Sin alertas con los umbrales configurados. Mantenga la revisión conjunta con teoría y desempeño factorial.',dist};
    return{level:alerts.length>=2?'red':'yellow',label:alerts.length>=2?'Múltiples alertas':'Revisar',text:alerts.join(' '),dist};
  }

  function enhanceTable(result){
    const table=q('diagResults')?.querySelector('table');
    if(!table||table.dataset.v54Interpretive==='yes')return;
    const rows=Array.isArray(result?.rows)?result.rows:[];
    const head=table.querySelector('thead tr');
    if(head)head.insertAdjacentHTML('beforeend','<th>Semáforo</th><th>Interpretación automática</th>');
    [...table.querySelectorAll('tbody tr')].forEach((tr,index)=>{
      const info=interpretation(rows[index]||{},index);
      const cls=info.level==='green'?'good-bg':(info.level==='yellow'?'warn-bg':'bad-bg');
      const icon=info.level==='green'?'🟢':(info.level==='yellow'?'🟠':'🔴');
      tr.insertAdjacentHTML('beforeend',`<td><span class="status-chip ${cls}">${icon} ${esc(info.label)}</span></td><td class="interpretation">${esc(info.text)}</td>`);
    });
    table.dataset.v54Interpretive='yes';
  }

  function chartScale(values,limit){
    const finite=values.filter(Number.isFinite).map(Math.abs);
    return Math.max(limit,finite.length?Math.max(...finite):limit,1);
  }

  function profileSvg(result){
    const rows=Array.isArray(result?.rows)?result.rows:[];
    if(!rows.length)return'';
    const t=diagnosticThresholds();
    const labels=rows.map(r=>String(r.name));
    const skew=rows.map(r=>Number(r.skew));
    const kurt=rows.map(r=>Number(r.kurt));
    const maxz=rows.map((r,i)=>Number(variableDistribution(r,i)?.maxZ));
    const width=Math.max(980,100+rows.length*42),panelH=210,left=75,right=30,plotW=width-left-right;
    const totalH=panelH*3+120;
    const x=i=>left+(rows.length===1?plotW/2:i*plotW/(rows.length-1));

    function panel(series,title,y0,threshold){
      const scale=chartScale(series,threshold*1.35);
      const center=y0+panelH/2;
      const y=v=>center-(Number(v)||0)*(panelH*.40/scale);
      let out=`<text x="${left}" y="${y0+22}" font-size="15" font-weight="700">${esc(title)}</text><line x1="${left}" y1="${center}" x2="${width-right}" y2="${center}" stroke="#778"/>`;
      [threshold,-threshold].forEach(ref=>{const yy=y(ref);out+=`<line x1="${left}" y1="${yy}" x2="${width-right}" y2="${yy}" stroke="#9a6b00" stroke-dasharray="5 5"/><text x="8" y="${yy+4}" font-size="11">${ref>0?'+':''}${ref}</text>`;});
      series.forEach((value,i)=>{
        if(!Number.isFinite(value))return;
        const xx=x(i),yy=y(value),alert=Math.abs(value)>=threshold;
        out+=`<line x1="${xx}" y1="${center}" x2="${xx}" y2="${yy}" stroke="${alert?'#a22':'#286b55'}" stroke-width="8"/><circle cx="${xx}" cy="${yy}" r="4" fill="${alert?'#a22':'#286b55'}"/>`;
      });
      return out;
    }

    let svg=`<svg id="vsDistributionProfileSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${totalH}" width="100%" role="img" aria-label="Perfil de distribución de ítems"><rect width="100%" height="100%" fill="white"/><text x="${left}" y="30" font-size="20" font-weight="700">Perfil de distribución de ítems</text>`;
    svg+=panel(skew,'Asimetría por ítem',55,t.skew);
    svg+=panel(kurt,'Curtosis por ítem',55+panelH,t.kurt);
    svg+=panel(maxz,'Valor z extremo por ítem',55+panelH*2,t.z);
    labels.forEach((label,i)=>svg+=`<text x="${x(i)}" y="${totalH-28}" font-size="10" text-anchor="end" transform="rotate(-45 ${x(i)} ${totalH-28})">${esc(label)}</text>`);
    svg+='</svg>';
    return svg;
  }

  function downloadSvg(){
    const svg=q('vsDistributionProfileSvg');if(!svg)return alert('Primero ejecute el diagnóstico.');
    const blob=new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ValiStruct_perfil_distribucion_items.svg';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
  }

  function downloadPng(){
    const svg=q('vsDistributionProfileSvg');if(!svg)return alert('Primero ejecute el diagnóstico.');
    const text=new XMLSerializer().serializeToString(svg),blob=new Blob([text],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),img=new Image();
    img.onload=()=>{const vb=svg.viewBox.baseVal,canvas=document.createElement('canvas');canvas.width=Math.round(vb.width);canvas.height=Math.round(vb.height);const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0);URL.revokeObjectURL(url);canvas.toBlob(png=>{const dl=URL.createObjectURL(png),a=document.createElement('a');a.href=dl;a.download='ValiStruct_perfil_distribucion_items.png';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(dl),500);},'image/png');};
    img.src=url;
  }

  function renderInterpretiveAdditions(result){
    enhanceTable(result);
    const host=q('diagResults');if(!host)return;
    let panel=q('vsDiagInterpretivePanel');
    if(!panel){panel=document.createElement('section');panel.id='vsDiagInterpretivePanel';panel.className='workspace';host.appendChild(panel);}
    const summaries=(result.rows||[]).map((row,i)=>({row,info:interpretation(row,i)}));
    const flagged=summaries.filter(x=>x.info.level!=='green');
    panel.innerHTML=`<h3>Interpretación clínica/metodológica de la distribución</h3>
      <div class="notice"><strong>Ítems ordinales / Likert:</strong> la presencia de asimetría o curtosis elevada no constituye por sí sola un criterio de eliminación. Para AFC con ítems ordinales se recomienda considerar WLSMV/DWLS y examinar conjuntamente frecuencias de respuesta, efecto techo/suelo y funcionamiento factorial.</div>
      <p><strong>Resumen:</strong> ${flagged.length} de ${summaries.length} variable(s) presentan al menos una alerta con los umbrales configurados. Verifique primero la captura y la distribución de respuestas antes de modificar o excluir un ítem.</p>
      <div class="button-row"><button id="vsDownloadDiagSvg" type="button">Descargar figura SVG</button><button id="vsDownloadDiagPng" type="button">Descargar figura PNG</button></div>
      <div class="workspace">${profileSvg(result)}</div>`;
    q('vsDownloadDiagSvg')?.addEventListener('click',downloadSvg);
    q('vsDownloadDiagPng')?.addEventListener('click',downloadPng);
    setTimeout(()=>window.ValiStructCaptureAllResults?.(),0);
  }

  const original=getGlobal('renderDiagnostics');
  if(typeof original==='function'){
    window.eval('window.__v54OriginalRenderDiagnostics = renderDiagnostics');
    window.eval(`renderDiagnostics = function(r){ window.__v54OriginalRenderDiagnostics(r); window.__v54RenderInterpretiveDiagnostics(r); }`);
  }
  window.__v54RenderInterpretiveDiagnostics=renderInterpretiveAdditions;

  const current=getGlobal('diagLast');
  if(current)renderInterpretiveAdditions(current);
})();
