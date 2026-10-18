/* ValiStruct v5.4 · Etapa IV · Rendimiento y baremación
 * Módulo aislado: ROC/AUC, Youden, sensibilidad/especificidad, percentiles y bandas descriptivas.
 * No modifica AFE/AFC, validez de contenido, estabilidad, criterio, JASP, PATH ni Motor Pro.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root){ root.ValiStructPerformance=api; if(root.document) api.mount(root); }
})(typeof window!=='undefined'?window:null,function(){
  'use strict';

  const isMissing=v=>v===undefined||v===null||String(v).trim()===''||['NA','N/A','NULL','.'].includes(String(v).trim().toUpperCase());
  const finite=v=>!isMissing(v)&&Number.isFinite(Number(v));
  const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
  const sampleSd=a=>{ if(a.length<2)return NaN; const m=mean(a); return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1)); };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const fmt=v=>Number.isFinite(v)?v.toFixed(3):'—';

  function percentile(values,p){
    const a=values.filter(Number.isFinite).slice().sort((x,y)=>x-y);
    if(!a.length)return NaN;
    if(p<=0)return a[0]; if(p>=1)return a[a.length-1];
    const h=(a.length-1)*p,i=Math.floor(h),f=h-i;
    return a[i]+(a[Math.min(i+1,a.length-1)]-a[i])*f;
  }

  function cleanRocPairs(scores,labels){
    const out=[],n=Math.min(scores.length,labels.length);
    for(let i=0;i<n;i++){
      if(!finite(scores[i])||isMissing(labels[i]))continue;
      const y=Number(labels[i]);
      if(y!==0&&y!==1)continue;
      out.push([Number(scores[i]),y]);
    }
    return out;
  }

  function rocCurve(scores,labels){
    const pairs=cleanRocPairs(scores,labels);
    const positives=pairs.filter(r=>r[1]===1).length,negatives=pairs.length-positives;
    if(positives<1||negatives<1)throw new Error('ROC requiere criterio binario 0/1 con ambas categorías presentes.');
    const values=[...new Set(pairs.map(r=>r[0]))].sort((a,b)=>b-a);
    const thresholds=[Infinity,...values];
    const points=thresholds.map(th=>{
      let tp=0,fp=0,tn=0,fn=0;
      for(const [s,y] of pairs){
        const pred=s>=th?1:0;
        if(pred===1&&y===1)tp++; else if(pred===1&&y===0)fp++; else if(pred===0&&y===0)tn++; else fn++;
      }
      const sensitivity=tp/(tp+fn),specificity=tn/(tn+fp),fpr=1-specificity,youden=sensitivity+specificity-1;
      return {threshold:th,sensitivity,specificity,fpr,youden,tp,fp,tn,fn};
    });
    if(points[points.length-1].sensitivity<1||points[points.length-1].fpr<1){
      points.push({threshold:-Infinity,sensitivity:1,specificity:0,fpr:1,youden:0,tp:positives,fp:negatives,tn:0,fn:0});
    }
    let auc=0;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];
      auc+=(b.fpr-a.fpr)*(a.sensitivity+b.sensitivity)/2;
    }
    const finitePoints=points.filter(p=>Number.isFinite(p.threshold));
    finitePoints.sort((a,b)=>b.youden-a.youden||Math.abs(a.sensitivity-a.specificity)-Math.abs(b.sensitivity-b.specificity)||b.threshold-a.threshold);
    const optimal=finitePoints[0];
    return {pairs,n:pairs.length,positives,negatives,points,auc,optimal};
  }

  function rng(seed){let x=seed>>>0||2463534242;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
  function bootstrapAuc(scores,labels,reps=1000,seed=54100){
    const pairs=cleanRocPairs(scores,labels); if(pairs.length<4)return [NaN,NaN];
    const random=rng(seed),vals=[];
    for(let b=0;b<reps;b++){
      const sample=[];for(let i=0;i<pairs.length;i++)sample.push(pairs[Math.floor(random()*pairs.length)]);
      const y=sample.map(r=>r[1]); if(!y.includes(0)||!y.includes(1))continue;
      try{vals.push(rocCurve(sample.map(r=>r[0]),y).auc);}catch(_){ }
    }
    vals.sort((a,b)=>a-b); if(vals.length<20)return [NaN,NaN];
    return [percentile(vals,.025),percentile(vals,.975)];
  }

  function wilson(success,n,z=1.9599639845){
    if(!(n>0))return [NaN,NaN]; const p=success/n,zz=z*z,den=1+zz/n;
    const center=(p+zz/(2*n))/den,half=z*Math.sqrt((p*(1-p)+zz/(4*n))/n)/den;
    return [clamp(center-half,0,1),clamp(center+half,0,1)];
  }

  function describe(values){
    const a=values.filter(Number.isFinite).slice().sort((x,y)=>x-y); if(!a.length)throw new Error('No hay valores numéricos utilizables.');
    const m=mean(a),sd=sampleSd(a),pcts={};
    [5,10,25,33,50,67,75,90,95].forEach(p=>pcts[p]=percentile(a,p/100));
    return {n:a.length,mean:m,sd,min:a[0],max:a[a.length-1],percentiles:pcts};
  }

  function bandSummary(values,lowCut,highCut){
    const a=values.filter(Number.isFinite); if(!a.length)throw new Error('No hay valores numéricos utilizables.');
    if(!Number.isFinite(lowCut)||!Number.isFinite(highCut)||lowCut>=highCut)throw new Error('Los puntos de corte descriptivos deben ser numéricos y el inferior menor que el superior.');
    const counts={Bajo:0,Medio:0,Alto:0};
    a.forEach(v=>{if(v<lowCut)counts.Bajo++;else if(v<highCut)counts.Medio++;else counts.Alto++;});
    return {n:a.length,lowCut,highCut,counts,percentages:Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,v/a.length]))};
  }

  function parseCsv(text){
    const rows=[];let row=[],cell='',q=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i],next=text[i+1];
      if(q){if(ch==='"'&&next==='"'){cell+='"';i++;}else if(ch==='"')q=false;else cell+=ch;}
      else if(ch==='"')q=true;else if(ch===','){row.push(cell);cell='';}else if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell='';}else if(ch!=='\r')cell+=ch;
    }
    row.push(cell);if(row.some(v=>String(v).trim()!==''))rows.push(row);return rows;
  }

  function dataset(win){
    const mgr=win.ValiStructParticipantData;if(!mgr?.summary)throw new Error('Importe primero una base de participantes.');
    const parsed=parseCsv(mgr.toCsv().replace(/^\uFEFF/,''));
    return {columns:parsed[0],rows:parsed.slice(1),summary:mgr.summary};
  }
  function esc(s){return String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[ch]));}
  function csvEscape(v){return '"'+String(v??'').replace(/"/g,'""')+'"';}
  function save(win,text,type,name){const blob=new Blob([text],{type});const a=win.document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

  async function fileToCsv(win,file){
    if(/\.csv$/i.test(file.name))return (await file.text()).replace(/^\uFEFF/,'');
    if(/\.(xlsx|xls)$/i.test(file.name)){
      if(!win.valistructDesktop?.parseSpreadsheet)throw new Error('La importación XLS/XLSX requiere ValiStruct Desktop.');
      const bytes=new Uint8Array(await file.arrayBuffer());
      const parsed=await win.valistructDesktop.parseSpreadsheet(file.name,bytes);
      if(!parsed?.ok||!parsed.csv)throw new Error(parsed?.error||'No fue posible leer el archivo Excel.');
      return String(parsed.csv).replace(/^\uFEFF/,'');
    }
    throw new Error('Formato no compatible. Use CSV, XLSX o XLS.');
  }

  function templateFor(proc){
    if(proc==='norms'||proc==='bands')return {name:'ValiStruct_plantilla_baremacion',sheet:'Baremacion',rows:[['ID','Puntaje_Instrumento'],['P001',42],['P002',55],['P003',61],['P004',33],['P005',70],['P006',48],['P007',64],['P008',39]]};
    return {name:'ValiStruct_plantilla_ROC_Youden',sheet:'ROC_Youden',rows:[['ID','Puntaje_Instrumento','Criterio_Binario_0_1'],['P001',25,0],['P002',34,0],['P003',41,0],['P004',49,0],['P005',55,1],['P006',61,1],['P007',68,1],['P008',74,1],['P009',82,1],['P010',46,0]]};
  }

  async function downloadTemplate(win,proc,status){
    const t=templateFor(proc),csv=t.rows.map(r=>r.map(csvEscape).join(',')).join('\n');
    try{
      if(win.valistructDesktop?.createSpreadsheet){
        const r=await win.valistructDesktop.createSpreadsheet('\ufeff'+csv,'xlsx',{sheetName:t.sheet});
        if(r?.ok&&r?.bytes){const bytes=r.bytes instanceof Uint8Array?r.bytes:new Uint8Array(r.bytes);const a=win.document.createElement('a');a.href=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));a.download=t.name+'.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);if(status)status.textContent='Plantilla XLSX descargada.';return;}
      }
    }catch(_){ }
    save(win,'\ufeff'+csv,'text/csv;charset=utf-8',t.name+'.csv');if(status)status.textContent='Plantilla CSV descargada.';
  }

  function rocSvg(res){
    const pts=res.points.map(p=>`${30+p.fpr*280},${300-p.sensitivity*260}`).join(' ');
    return `<svg viewBox="0 0 340 330" role="img" aria-label="Curva ROC" style="max-width:520px;width:100%;height:auto">
      <line x1="30" y1="300" x2="310" y2="300" stroke="currentColor" opacity=".35"/><line x1="30" y1="300" x2="30" y2="40" stroke="currentColor" opacity=".35"/>
      <line x1="30" y1="300" x2="310" y2="40" stroke="currentColor" opacity=".25" stroke-dasharray="5 5"/>
      <polyline fill="none" stroke="currentColor" stroke-width="3" points="${pts}"/>
      <text x="145" y="325" font-size="12">1 − especificidad</text><text x="12" y="180" font-size="12" transform="rotate(-90 12 180)">Sensibilidad</text>
    </svg>`;
  }

  function mount(win){
    const d=win.document,panel=d.getElementById('performance');if(!panel||panel.dataset.v54Performance==='ready')return;
    panel.dataset.v54Performance='ready';
    const nav=d.querySelector('button[data-section="performance"]');if(nav){nav.dataset.status='ready';nav.innerHTML='<span>Rendimiento y baremación</span><small class="vs-v53-nav-status">Disponible</small>';}
    panel.innerHTML=`
      <div class="vs-v52-breadcrumb">Inicio <span>›</span> Validación externa <span>›</span> Rendimiento y baremación</div>
      <div class="vs-v52-module-header"><div><span class="vs-v52-eyebrow">ETAPA IV · VALIDACIÓN EXTERNA</span><h2>Rendimiento y baremación</h2><p>Curvas ROC, AUC, punto de corte de Youden, sensibilidad, especificidad y normas descriptivas.</p></div><span class="status-chip good-bg">Disponible</span></div>
      <div class="vs-v52-context"><strong>Principio metodológico.</strong> ROC/Youden requiere un criterio externo binario 0/1. Los percentiles y bandas son normas descriptivas de la muestra y no equivalen automáticamente a puntos de corte clínicos.</div>
      <div class="vs-v52-form-card">
        <div class="vs-v52-card-heading"><span class="vs-v52-step">01</span><div><h3>Configure el análisis</h3><p>Seleccione el procedimiento y las variables de la base compartida.</p></div></div>
        <div class="vs-v52-form-grid">
          <label>Procedimiento<select id="performanceProcedure"><option value="roc">ROC / AUC · criterio binario</option><option value="youden">Umbral mediante índice de Youden</option><option value="norms">Percentiles y puntuaciones normalizadas</option><option value="bands">Bandas descriptivas configurables</option></select></label>
          <label>Variable o puntuación principal<select id="performanceScore"></select></label>
          <label id="performanceCriterionWrap">Variable de comparación o criterio<select id="performanceCriterion"></select></label>
          <label>Bootstrap para IC 95%<select id="performanceBootstrap"><option value="500">500 réplicas</option><option value="1000" selected>1000 réplicas</option><option value="2000">2000 réplicas</option></select></label>
          <label id="performanceLowWrap" hidden>Punto de corte inferior<input id="performanceLow" type="number" step="any"></label>
          <label id="performanceHighWrap" hidden>Punto de corte superior<input id="performanceHigh" type="number" step="any"></label>
        </div>
        <div id="performanceGuide" class="vs-v52-context" style="margin-top:12px"></div>
        <div id="performanceDataStatus" class="vs-v52-linked-data" role="status"></div>
        <div class="button-row"><button id="runPerformance" class="primary">Calcular rendimiento / baremación</button><button id="performanceOpenData">Abrir Centro de datos</button><label id="performanceDirectLoader" class="file-button" style="display:inline-flex;align-items:center;cursor:pointer">Cargar base CSV/XLSX<input id="performanceFile" type="file" accept=".csv,.xlsx,.xls" hidden></label><button id="downloadPerformanceTemplate">Descargar plantilla (XLSX)</button><button id="downloadPerformanceCsv" disabled>Descargar resultados CSV</button><button id="downloadPerformanceXlsx" disabled>Descargar resultados Excel (.xlsx)</button><button id="copyPerformance" disabled>Copiar resumen</button></div>
        <div id="performanceStatus" role="status" aria-live="polite"></div>
      </div>
      <div id="performanceResults"></div>
      <details class="vs-v52-help"><summary>Ayuda metodológica</summary><p><strong>ROC/AUC:</strong> evalúa discriminación de una puntuación frente a un criterio binario. <strong>Youden:</strong> maximiza sensibilidad + especificidad − 1 y propone un umbral estadístico, no necesariamente clínico. <strong>Percentiles:</strong> describen posición relativa dentro de la muestra. <strong>Bandas:</strong> clasifican descriptivamente según puntos de corte definidos por el usuario o percentiles de la muestra.</p></details>`;

    const $=id=>d.getElementById(id),proc=$('performanceProcedure'),score=$('performanceScore'),criterion=$('performanceCriterion');
    let last=null;

    function refresh(){
      const s=win.ValiStructParticipantData?.summary,status=$('performanceDataStatus');
      if(!s){status.textContent='Sin base compartida. Cargue una base CSV/XLSX o utilice el Centro de datos.';score.innerHTML=criterion.innerHTML='<option value="">Sin variables</option>';return;}
      status.textContent='Base disponible: '+s.source+' · '+s.n+' participantes · '+s.variables.length+' variables.';
      const keepS=score.value,keepC=criterion.value,opts='<option value="">Seleccione…</option>'+s.variables.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('');
      score.innerHTML=opts;criterion.innerHTML=opts;if(s.variables.includes(keepS))score.value=keepS;if(s.variables.includes(keepC))criterion.value=keepC;
    }

    function controls(){
      const p=proc.value,isNorm=p==='norms'||p==='bands';$('performanceCriterionWrap').hidden=isNorm;$('performanceLowWrap').hidden=p!=='bands';$('performanceHighWrap').hidden=p!=='bands';
      const guide={roc:'<strong>Formato requerido · ROC/AUC.</strong> Seleccione una puntuación cuantitativa y un criterio binario codificado exactamente 0/1. Valores mayores de la puntuación se interpretan como mayor probabilidad del evento 1.',youden:'<strong>Formato requerido · Youden.</strong> Igual que ROC/AUC. ValiStruct propondrá el umbral que maximiza sensibilidad + especificidad − 1.',norms:'<strong>Formato requerido · baremación descriptiva.</strong> Seleccione una puntuación cuantitativa. Se calcularán media, DE y percentiles P5, P10, P25, P50, P75, P90 y P95.',bands:'<strong>Formato requerido · bandas descriptivas.</strong> Seleccione una puntuación cuantitativa y defina dos cortes. Si quedan vacíos, ValiStruct utilizará P33 y P67 de la muestra.'}[p];$('performanceGuide').innerHTML=guide;
      $('downloadPerformanceTemplate').textContent='Descargar plantilla · '+(isNorm?'Baremación':'ROC / Youden')+' (XLSX)';
    }

    function columns(requireCriterion=true){
      const data=dataset(win),is=data.columns.indexOf(score.value);if(is<0)throw new Error('Seleccione una puntuación principal existente.');
      const x=data.rows.map(r=>r[is]);
      if(!requireCriterion)return {data,x};
      const ic=data.columns.indexOf(criterion.value);if(ic<0)throw new Error('Seleccione un criterio existente.');if(ic===is)throw new Error('La puntuación y el criterio deben ser variables diferentes.');
      return {data,x,y:data.rows.map(r=>r[ic])};
    }

    function run(){
      try{
        const p=proc.value,reps=Number($('performanceBootstrap').value)||1000;
        if(p==='roc'||p==='youden'){
          const {data,x,y}=columns(true),res=rocCurve(x,y),aucCI=bootstrapAuc(x,y,reps,54101),opt=res.optimal,sensCI=wilson(opt.tp,opt.tp+opt.fn),specCI=wilson(opt.tn,opt.tn+opt.fp);
          last={type:'roc',procedure:p,score:score.value,criterion:criterion.value,source:data.summary.source,nOriginal:data.summary.n,n:res.n,excluded:data.summary.n-res.n,reps,res,aucCI,sensCI,specCI};
        }else{
          const {data,x}=columns(false),vals=x.filter(finite).map(Number),desc=describe(vals);
          if(p==='norms')last={type:'norms',procedure:p,score:score.value,source:data.summary.source,nOriginal:data.summary.n,n:vals.length,excluded:data.summary.n-vals.length,desc};
          else{
            let low=Number($('performanceLow').value),high=Number($('performanceHigh').value);if(!Number.isFinite(low))low=desc.percentiles[33];if(!Number.isFinite(high))high=desc.percentiles[67];
            const bands=bandSummary(vals,low,high);last={type:'bands',procedure:p,score:score.value,source:data.summary.source,nOriginal:data.summary.n,n:vals.length,excluded:data.summary.n-vals.length,desc,bands};
            $('performanceLow').value=String(Number(low.toFixed(3)));$('performanceHigh').value=String(Number(high.toFixed(3)));
          }
        }
        render();$('downloadPerformanceCsv').disabled=false;$('downloadPerformanceXlsx').disabled=false;$('copyPerformance').disabled=false;$('performanceStatus').innerHTML='<div class="model-ok"><strong>Análisis completado.</strong> Revise estimaciones, IC 95% e interpretación metodológica.</div>';
      }catch(err){last=null;$('downloadPerformanceCsv').disabled=true;$('downloadPerformanceXlsx').disabled=true;$('copyPerformance').disabled=true;$('performanceResults').innerHTML='';$('performanceStatus').innerHTML='<div class="model-error"><strong>No fue posible calcular.</strong> '+esc(err.message||err)+'</div>';}
    }

    function render(){
      if(last.type==='roc'){
        const o=last.res.optimal,aucNote=last.res.auc>=.9?'Discriminación excelente':last.res.auc>=.8?'Discriminación buena':last.res.auc>=.7?'Discriminación aceptable':last.res.auc>=.6?'Discriminación limitada':'Discriminación pobre';
        const coordRows=last.res.points.filter(p=>Number.isFinite(p.threshold)).map(p=>`<tr><td>${fmt(p.threshold)}</td><td>${fmt(p.sensitivity)}</td><td>${fmt(p.specificity)}</td><td>${fmt(p.youden)}</td></tr>`).join('');
        $('performanceResults').innerHTML=`<div class="results-summary"><div class="report-header"><h3>ValiStruct · ROC / Youden</h3><p><strong>${esc(last.score)}</strong> frente a <strong>${esc(last.criterion)}</strong> · n=${last.n}</p></div><div class="result-cards"><div class="result-card"><span>AUC</span><strong>${fmt(last.res.auc)}</strong><small>IC95% ${fmt(last.aucCI[0])}–${fmt(last.aucCI[1])}</small></div><div class="result-card"><span>Corte Youden</span><strong>${fmt(o.threshold)}</strong><small>J=${fmt(o.youden)}</small></div><div class="result-card"><span>Sensibilidad</span><strong>${fmt(o.sensitivity)}</strong><small>IC95% ${fmt(last.sensCI[0])}–${fmt(last.sensCI[1])}</small></div><div class="result-card"><span>Especificidad</span><strong>${fmt(o.specificity)}</strong><small>IC95% ${fmt(last.specCI[0])}–${fmt(last.specCI[1])}</small></div></div><p><strong>Interpretación orientativa:</strong> ${aucNote}. El punto de corte de Youden es un criterio estadístico y debe contrastarse con consecuencias clínicas, prevalencia y costos de error.</p></div><div class="workspace"><h3>Curva ROC</h3>${rocSvg(last.res)}<h3>Coordenadas ROC</h3><table class="results-table"><thead><tr><th>Umbral</th><th>Sensibilidad</th><th>Especificidad</th><th>Youden J</th></tr></thead><tbody>${coordRows}</tbody></table></div>`;
      }else if(last.type==='norms'){
        const dsc=last.desc,rows=[5,10,25,50,75,90,95].map(p=>`<tr><td>P${p}</td><td>${fmt(dsc.percentiles[p])}</td></tr>`).join('');
        $('performanceResults').innerHTML=`<div class="results-summary"><div class="report-header"><h3>ValiStruct · Baremación descriptiva</h3><p><strong>${esc(last.score)}</strong> · n=${last.n}</p></div><div class="result-cards"><div class="result-card"><span>Media</span><strong>${fmt(dsc.mean)}</strong></div><div class="result-card"><span>DE</span><strong>${fmt(dsc.sd)}</strong></div><div class="result-card"><span>Mínimo</span><strong>${fmt(dsc.min)}</strong></div><div class="result-card"><span>Máximo</span><strong>${fmt(dsc.max)}</strong></div></div><p>Estos percentiles describen esta muestra y no constituyen normas poblacionales sin una muestra normativa adecuada.</p></div><div class="workspace"><h3>Percentiles</h3><table class="results-table"><thead><tr><th>Percentil</th><th>Puntuación</th></tr></thead><tbody>${rows}</tbody></table></div>`;
      }else{
        const b=last.bands,dsc=last.desc,rows=['Bajo','Medio','Alto'].map(k=>`<tr><td>${k}</td><td>${b.counts[k]}</td><td>${(100*b.percentages[k]).toFixed(1)}%</td></tr>`).join('');
        $('performanceResults').innerHTML=`<div class="results-summary"><div class="report-header"><h3>ValiStruct · Bandas descriptivas</h3><p><strong>${esc(last.score)}</strong> · n=${last.n}</p></div><div class="result-cards"><div class="result-card"><span>Corte inferior</span><strong>${fmt(b.lowCut)}</strong></div><div class="result-card"><span>Corte superior</span><strong>${fmt(b.highCut)}</strong></div><div class="result-card"><span>P33</span><strong>${fmt(dsc.percentiles[33])}</strong></div><div class="result-card"><span>P67</span><strong>${fmt(dsc.percentiles[67])}</strong></div></div><p>Las bandas son descriptivas y configurables. No deben presentarse como categorías diagnósticas sin validación externa.</p></div><div class="workspace"><table class="results-table"><thead><tr><th>Banda</th><th>N</th><th>%</th></tr></thead><tbody>${rows}</tbody></table></div>`;
      }
    }

    function summary(){
      if(!last)return '';
      const lines=['ValiStruct · Rendimiento y baremación','Procedimiento: '+last.procedure,'Puntuación: '+last.score,'Base: '+last.source,'N analizado: '+last.n,'Excluidos: '+last.excluded];
      if(last.type==='roc'){const o=last.res.optimal;lines.push('AUC='+fmt(last.res.auc)+'; IC95% '+fmt(last.aucCI[0])+'–'+fmt(last.aucCI[1]),'Corte Youden='+fmt(o.threshold)+'; J='+fmt(o.youden),'Sensibilidad='+fmt(o.sensitivity)+'; IC95% '+fmt(last.sensCI[0])+'–'+fmt(last.sensCI[1]),'Especificidad='+fmt(o.specificity)+'; IC95% '+fmt(last.specCI[0])+'–'+fmt(last.specCI[1]));}
      else if(last.type==='norms'){lines.push('Media='+fmt(last.desc.mean)+'; DE='+fmt(last.desc.sd),...[5,10,25,50,75,90,95].map(p=>'P'+p+'='+fmt(last.desc.percentiles[p])));}
      else lines.push('Corte inferior='+fmt(last.bands.lowCut),'Corte superior='+fmt(last.bands.highCut),...['Bajo','Medio','Alto'].map(k=>k+': '+last.bands.counts[k]+' ('+(100*last.bands.percentages[k]).toFixed(1)+'%)'));
      return lines.join('\n');
    }

    function exportRows(){
      if(last.type==='roc')return [['Tipo','Valor_1','Valor_2','Valor_3'],['AUC',last.res.auc,last.aucCI[0],last.aucCI[1]],['Corte_Youden',last.res.optimal.threshold,last.res.optimal.youden,''],['Sensibilidad',last.res.optimal.sensitivity,last.sensCI[0],last.sensCI[1]],['Especificidad',last.res.optimal.specificity,last.specCI[0],last.specCI[1]],[],['Umbral','Sensibilidad','Especificidad','Youden_J'],...last.res.points.filter(p=>Number.isFinite(p.threshold)).map(p=>[p.threshold,p.sensitivity,p.specificity,p.youden])];
      if(last.type==='norms')return [['Estadistico','Valor'],['N',last.n],['Media',last.desc.mean],['DE',last.desc.sd],['Minimo',last.desc.min],['Maximo',last.desc.max],...[5,10,25,33,50,67,75,90,95].map(p=>['P'+p,last.desc.percentiles[p]])];
      return [['Banda','N','Porcentaje'],...['Bajo','Medio','Alto'].map(k=>[k,last.bands.counts[k],last.bands.percentages[k]]),[],['Corte_inferior',last.bands.lowCut],['Corte_superior',last.bands.highCut]];
    }

    async function exportXlsx(){
      if(!last)return;const csv=exportRows().map(r=>r.map(csvEscape).join(',')).join('\n');
      if(win.valistructDesktop?.createSpreadsheet){
        const r=await win.valistructDesktop.createSpreadsheet('\ufeff'+csv,'xlsx',{sheetName:'Rendimiento_baremacion'});if(r?.ok&&r?.bytes){const bytes=r.bytes instanceof Uint8Array?r.bytes:new Uint8Array(r.bytes);const a=d.createElement('a');a.href=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));a.download='ValiStruct_rendimiento_baremacion.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);return;}
      }
      save(win,'\ufeff'+csv,'text/csv;charset=utf-8','ValiStruct_rendimiento_baremacion.csv');
    }

    proc.addEventListener('change',controls);$('runPerformance').addEventListener('click',run);$('performanceOpenData').addEventListener('click',()=>d.querySelector('button[data-section="dataimport"]')?.click());
    $('performanceFile').addEventListener('change',async()=>{try{const file=$('performanceFile').files?.[0];if(!file)return;const csv=await fileToCsv(win,file);const s=win.ValiStructParticipantData.setCsv(csv,{source:file.name,format:(file.name.split('.').pop()||'csv').toLowerCase()});win.dispatchEvent(new CustomEvent('valistruct:participant-data',{detail:{revision:s.revision,n:s.n,source:s.source}}));$('performanceStatus').textContent='Base cargada correctamente.';refresh();}catch(err){$('performanceStatus').innerHTML='<div class="model-error">'+esc(err.message||err)+'</div>';}});
    $('downloadPerformanceTemplate').addEventListener('click',()=>downloadTemplate(win,proc.value,$('performanceStatus')));
    $('downloadPerformanceCsv').addEventListener('click',()=>{if(!last)return;const csv=exportRows().map(r=>r.map(csvEscape).join(',')).join('\n');save(win,'\ufeff'+csv,'text/csv;charset=utf-8','ValiStruct_rendimiento_baremacion.csv');});
    $('downloadPerformanceXlsx').addEventListener('click',exportXlsx);$('copyPerformance').addEventListener('click',()=>{if(last)win.navigator.clipboard.writeText(summary());});
    d.addEventListener('valistruct:participants-changed',refresh);win.addEventListener('valistruct:participant-data',refresh);refresh();controls();
  }

  return {percentile,cleanRocPairs,rocCurve,bootstrapAuc,wilson,describe,bandSummary,mount};
});
