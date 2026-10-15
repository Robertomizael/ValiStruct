/* ValiStruct v5.4 · Etapa IV · Validez de criterio
 * Módulo aislado: no modifica AFE/AFC, validez de contenido, Estabilidad, JASP, PATH ni Motor Pro.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root){ root.ValiStructCriterion=api; if(root.document) api.mount(root); }
})(typeof window!=='undefined'?window:null,function(){
  'use strict';

  const finite=v=>Number.isFinite(Number(v));
  const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  function pairedNumeric(x,y){
    const out=[]; const n=Math.min(x.length,y.length);
    for(let i=0;i<n;i++) if(finite(x[i])&&finite(y[i])) out.push([Number(x[i]),Number(y[i])]);
    return out;
  }

  function pearson(x,y){
    const p=pairedNumeric(x,y); if(p.length<3)return NaN;
    const ax=p.map(r=>r[0]),ay=p.map(r=>r[1]),mx=mean(ax),my=mean(ay);
    let sxy=0,sxx=0,syy=0;
    for(let i=0;i<p.length;i++){const dx=ax[i]-mx,dy=ay[i]-my;sxy+=dx*dy;sxx+=dx*dx;syy+=dy*dy;}
    return sxx>0&&syy>0?sxy/Math.sqrt(sxx*syy):NaN;
  }

  function ranks(values){
    const indexed=values.map((v,i)=>({v:Number(v),i})).sort((a,b)=>a.v-b.v);
    const out=Array(values.length); let i=0;
    while(i<indexed.length){let j=i+1;while(j<indexed.length&&indexed[j].v===indexed[i].v)j++;const r=(i+1+j)/2;for(let k=i;k<j;k++)out[indexed[k].i]=r;i=j;}
    return out;
  }

  function spearman(x,y){const p=pairedNumeric(x,y);return p.length>=3?pearson(ranks(p.map(r=>r[0])),ranks(p.map(r=>r[1]))):NaN;}

  function fisherCI(r,n,level=.95){
    if(!Number.isFinite(r)||n<4)return [NaN,NaN];
    const zc=level>=.99?2.5758293035:level>=.95?1.9599639845:1.644853627;
    const rr=clamp(r,-.999999,.999999),z=.5*Math.log((1+rr)/(1-rr)),se=1/Math.sqrt(n-3);
    return [Math.tanh(z-zc*se),Math.tanh(z+zc*se)];
  }

  function linearRegression(x,y){
    const p=pairedNumeric(x,y); if(p.length<3)return null;
    const ax=p.map(r=>r[0]),ay=p.map(r=>r[1]),mx=mean(ax),my=mean(ay);
    let sxx=0,sxy=0; for(let i=0;i<p.length;i++){const dx=ax[i]-mx;sxx+=dx*dx;sxy+=dx*(ay[i]-my);}
    if(!(sxx>0))return null;
    const slope=sxy/sxx,intercept=my-slope*mx,pred=ax.map(v=>intercept+slope*v);
    const sst=ay.reduce((s,v)=>s+(v-my)**2,0),sse=ay.reduce((s,v,i)=>s+(v-pred[i])**2,0);
    const r2=sst>0?1-sse/sst:NaN;
    const se2=p.length>2?sse/(p.length-2):NaN,seSlope=Number.isFinite(se2)?Math.sqrt(se2/sxx):NaN;
    const ci=Number.isFinite(seSlope)?[slope-1.96*seSlope,slope+1.96*seSlope]:[NaN,NaN];
    return {n:p.length,slope,intercept,r2,seSlope,ci};
  }

  function logisticRegression(x,y){
    const p=pairedNumeric(x,y).filter(r=>r[1]===0||r[1]===1); if(p.length<6)return null;
    const xs=p.map(r=>r[0]),ys=p.map(r=>r[1]); if(new Set(ys).size<2)return null;
    let b0=0,b1=0;
    for(let it=0;it<50;it++){
      let g0=0,g1=0,h00=0,h01=0,h11=0;
      for(let i=0;i<p.length;i++){
        const eta=clamp(b0+b1*xs[i],-30,30),pr=1/(1+Math.exp(-eta)),w=Math.max(pr*(1-pr),1e-9),e=ys[i]-pr;
        g0+=e;g1+=e*xs[i];h00+=w;h01+=w*xs[i];h11+=w*xs[i]*xs[i];
      }
      const det=h00*h11-h01*h01;if(Math.abs(det)<1e-12)break;
      const d0=(g0*h11-g1*h01)/det,d1=(g1*h00-g0*h01)/det;b0+=d0;b1+=d1;
      if(Math.max(Math.abs(d0),Math.abs(d1))<1e-8)break;
    }
    let h00=0,h01=0,h11=0,ll=0;
    for(let i=0;i<p.length;i++){
      const eta=clamp(b0+b1*xs[i],-30,30),pr=clamp(1/(1+Math.exp(-eta)),1e-12,1-1e-12),w=Math.max(pr*(1-pr),1e-9);
      h00+=w;h01+=w*xs[i];h11+=w*xs[i]*xs[i];ll+=ys[i]*Math.log(pr)+(1-ys[i])*Math.log(1-pr);
    }
    const det=h00*h11-h01*h01,se1=det>0?Math.sqrt(h00/det):NaN,or=Math.exp(b1);
    const ci=Number.isFinite(se1)?[Math.exp(b1-1.96*se1),Math.exp(b1+1.96*se1)]:[NaN,NaN];
    return {n:p.length,intercept:b0,beta:b1,seBeta:se1,oddsRatio:or,ci,logLik:ll};
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
    const mgr=win.ValiStructParticipantData;if(!mgr?.summary)throw new Error('Importe primero la base de participantes en el Centro de datos.');
    const parsed=parseCsv(mgr.toCsv().replace(/^\uFEFF/,''));return {columns:parsed[0],rows:parsed.slice(1),summary:mgr.summary};
  }

  function esc(s){return String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));}
  function fmt(v,d=3){return Number.isFinite(v)?Number(v).toFixed(d):'No estimable';}
  function save(win,text,name){const blob=new Blob([text],{type:'text/csv;charset=utf-8;'}),a=win.document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

  function interpretCorrelation(r){const a=Math.abs(r);if(!Number.isFinite(a))return 'No estimable.';if(a>=.70)return 'Asociación alta.';if(a>=.50)return 'Asociación moderada.';if(a>=.30)return 'Asociación baja.';return 'Asociación muy baja.';}

  function mount(win){
    const d=win.document,panel=d.getElementById('criterion');if(!panel||panel.dataset.v54Criterion==='ready')return;
    panel.dataset.v54Criterion='ready';
    const nav=d.querySelector('button[data-section="criterion"]');if(nav){nav.dataset.status='ready';nav.innerHTML='<span>Validez de criterio</span><small class="vs-v53-nav-status">Disponible</small>';}
    panel.innerHTML=`
      <div class="vs-v52-breadcrumb">Inicio <span>›</span> Validación externa <span>›</span> Validez de criterio</div>
      <div class="vs-v52-module-header"><div><span class="vs-v52-eyebrow">ETAPA IV · VALIDACIÓN EXTERNA</span><h2>Validez de criterio</h2><p>Evidencia concurrente o predictiva frente a un criterio externo.</p></div><span class="status-chip good-bg">Disponible</span></div>
      <div class="vs-v52-context"><strong>Principio metodológico.</strong> La variable de criterio debe representar una referencia externa conceptualmente pertinente. La temporalidad distingue evidencia concurrente de predictiva; la correlación no implica acuerdo ni causalidad.</div>
      <div class="vs-v52-form-card">
        <div class="vs-v52-card-heading"><span class="vs-v52-step">01</span><div><h3>Configure el análisis</h3><p>Seleccione la puntuación principal y el criterio externo en la misma base.</p></div></div>
        <div class="vs-v52-form-grid">
          <label>Procedimiento<select id="criterionProcedure"><option value="concurrent">Criterio concurrente · Pearson/Spearman</option><option value="predictive">Criterio predictivo · Pearson/Spearman</option><option value="linear">Regresión lineal simple</option><option value="logistic">Regresión logística binaria</option></select></label>
          <label>Variable o puntuación principal<select id="criterionMainVar"></select></label>
          <label>Variable de comparación o criterio<select id="criterionRefVar"></select></label>
          <label>Correlación<select id="criterionCorrelation"><option value="both" selected>Pearson y Spearman</option><option value="pearson">Pearson</option><option value="spearman">Spearman</option></select></label>
        </div>
        <div id="criterionDataStatus" class="vs-v52-linked-data" role="status"></div>
        <div class="button-row"><button id="runCriterion" class="primary">Calcular validez de criterio</button><button id="criterionOpenData">Abrir Centro de datos</button><button id="downloadCriterion" disabled>Descargar resultados CSV</button><button id="copyCriterion" disabled>Copiar resumen</button></div>
        <div id="criterionStatus" role="status" aria-live="polite"></div>
      </div>
      <div id="criterionResults"></div>
      <details class="vs-v52-help"><summary>Ayuda metodológica</summary><p><strong>Concurrente:</strong> instrumento y criterio se observan en un periodo comparable. <strong>Predictiva:</strong> la puntuación antecede temporalmente al criterio. <strong>Regresión lineal:</strong> criterio cuantitativo. <strong>Regresión logística:</strong> criterio binario codificado 0/1. Los resultados deben interpretarse junto con la calidad y pertinencia del criterio externo.</p></details>`;

    const $=id=>d.getElementById(id),main=$('criterionMainVar'),ref=$('criterionRefVar'),proc=$('criterionProcedure');let last=null;
    function refresh(){
      const s=win.ValiStructParticipantData?.summary,status=$('criterionDataStatus');
      if(!s){status.textContent='Sin base compartida. Importe participantes desde el Centro de datos.';main.innerHTML=ref.innerHTML='<option value="">Sin variables</option>';return;}
      status.textContent='Base disponible: '+s.source+' · '+s.n+' participantes · '+s.variables.length+' variables.';
      const a=main.value,b=ref.value,opts='<option value="">Seleccione…</option>'+s.variables.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('');main.innerHTML=opts;ref.innerHTML=opts;if(s.variables.includes(a))main.value=a;if(s.variables.includes(b))ref.value=b;
    }
    function columns(){const data=dataset(win),ia=data.columns.indexOf(main.value),ib=data.columns.indexOf(ref.value);if(ia<0||ib<0)throw new Error('Seleccione dos variables existentes.');if(ia===ib)throw new Error('La puntuación principal y el criterio deben ser variables diferentes.');return {data,x:data.rows.map(r=>r[ia]),y:data.rows.map(r=>r[ib])};}
    function run(){
      try{
        const {data,x,y}=columns(),p=proc.value,pairs=pairedNumeric(x,y);if(pairs.length<3)throw new Error('Se requieren al menos 3 pares numéricos completos.');
        const excluded=Math.min(x.length,y.length)-pairs.length;let result={procedure:p,main:main.value,criterion:ref.value,n:pairs.length,excluded};
        if(p==='concurrent'||p==='predictive'){
          const mode=$('criterionCorrelation').value;
          if(mode==='both'||mode==='pearson'){result.pearson=pearson(x,y);result.pearsonCI=fisherCI(result.pearson,pairs.length);}
          if(mode==='both'||mode==='spearman')result.spearman=spearman(x,y);
        }else if(p==='linear'){
          const fit=linearRegression(x,y);if(!fit)throw new Error('No fue posible estimar la regresión lineal. Revise variabilidad y datos completos.');result.linear=fit;
        }else{
          const fit=logisticRegression(x,y);if(!fit)throw new Error('La regresión logística requiere criterio binario codificado 0/1, ambas categorías presentes y al menos 6 casos completos.');result.logistic=fit;
        }
        last=result;render();$('downloadCriterion').disabled=false;$('copyCriterion').disabled=false;$('criterionStatus').innerHTML='<div class="model-ok"><strong>Análisis completado.</strong> Casos completos: '+result.n+'; excluidos: '+result.excluded+'.</div>';
      }catch(err){last=null;$('downloadCriterion').disabled=true;$('copyCriterion').disabled=true;$('criterionResults').innerHTML='';$('criterionStatus').innerHTML='<div class="model-error"><strong>No fue posible calcular.</strong> '+esc(err.message||err)+'</div>';}
    }
    function render(){
      let rows='';
      if(Number.isFinite(last.pearson))rows+=`<tr><td>Pearson r</td><td>${fmt(last.pearson)}</td><td>${fmt(last.pearsonCI[0])}–${fmt(last.pearsonCI[1])}</td><td>${interpretCorrelation(last.pearson)}</td></tr>`;
      if(Number.isFinite(last.spearman))rows+=`<tr><td>Spearman ρ</td><td>${fmt(last.spearman)}</td><td>—</td><td>${interpretCorrelation(last.spearman)}</td></tr>`;
      if(last.linear){rows+=`<tr><td>Pendiente β</td><td>${fmt(last.linear.slope)}</td><td>${fmt(last.linear.ci[0])}–${fmt(last.linear.ci[1])}</td><td>R²=${fmt(last.linear.r2)}</td></tr><tr><td>Intercepto</td><td>${fmt(last.linear.intercept)}</td><td>—</td><td>Regresión lineal simple</td></tr>`;}
      if(last.logistic){rows+=`<tr><td>Odds ratio</td><td>${fmt(last.logistic.oddsRatio)}</td><td>${fmt(last.logistic.ci[0])}–${fmt(last.logistic.ci[1])}</td><td>β=${fmt(last.logistic.beta)}</td></tr><tr><td>Intercepto logit</td><td>${fmt(last.logistic.intercept)}</td><td>—</td><td>Regresión logística binaria</td></tr>`;}
      $('criterionResults').innerHTML=`<div class="workspace"><h3>Resultados · Validez de criterio</h3><p><strong>Puntuación:</strong> ${esc(last.main)} · <strong>Criterio:</strong> ${esc(last.criterion)} · <strong>n:</strong> ${last.n}</p><table class="results-table"><thead><tr><th>Estimador</th><th>Resultado</th><th>IC 95%</th><th>Interpretación</th></tr></thead><tbody>${rows}</tbody></table><p class="small">Los resultados no establecen causalidad y dependen de la calidad del criterio externo, su temporalidad y el diseño del estudio.</p></div>`;
    }
    function summary(){if(!last)return '';const lines=['ValiStruct · Validez de criterio','Procedimiento: '+last.procedure,'Puntuación: '+last.main,'Criterio: '+last.criterion,'Casos completos: '+last.n,'Excluidos: '+last.excluded];if(Number.isFinite(last.pearson))lines.push('Pearson r='+fmt(last.pearson)+'; IC95% '+fmt(last.pearsonCI[0])+'–'+fmt(last.pearsonCI[1]));if(Number.isFinite(last.spearman))lines.push('Spearman rho='+fmt(last.spearman));if(last.linear)lines.push('Regresión lineal: beta='+fmt(last.linear.slope)+'; IC95% '+fmt(last.linear.ci[0])+'–'+fmt(last.linear.ci[1])+'; R2='+fmt(last.linear.r2));if(last.logistic)lines.push('Regresión logística: OR='+fmt(last.logistic.oddsRatio)+'; IC95% '+fmt(last.logistic.ci[0])+'–'+fmt(last.logistic.ci[1])+'; beta='+fmt(last.logistic.beta));return lines.join('\n');}
    proc.addEventListener('change',()=>{$('criterionCorrelation').closest('label').hidden=!(proc.value==='concurrent'||proc.value==='predictive');});
    $('runCriterion').addEventListener('click',run);$('criterionOpenData').addEventListener('click',()=>{d.querySelector('button[data-section="dataimport"]')?.click();});
    $('downloadCriterion').addEventListener('click',()=>{if(!last)return;save(win,'"Campo","Valor"\n'+summary().split('\n').map(line=>'"'+line.replaceAll('"','""')+'",""').join('\n'),'ValiStruct_validez_criterio.csv');});
    $('copyCriterion').addEventListener('click',()=>{if(last)win.navigator.clipboard.writeText(summary());});
    refresh();proc.dispatchEvent(new Event('change'));
    win.addEventListener('valistruct:participant-data',refresh);
  }

  return {pairedNumeric,pearson,spearman,fisherCI,linearRegression,logisticRegression,mount};
});
