/* ValiStruct v5.4 · Etapa IV · Estabilidad y concordancia
 * Módulo aislado: no modifica AFE/AFC, validez de contenido, JASP, PATH ni Motor Pro.
 * Expone funciones puras para pruebas Node y una capa de UI para navegador.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root){ root.ValiStructStability=api; if(root.document) api.mount(root); }
})(typeof window!=='undefined'?window:null,function(){
  'use strict';

  const finite=v=>Number.isFinite(Number(v));
  const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  function pairedNumeric(x,y){
    const out=[];
    const n=Math.min(x.length,y.length);
    for(let i=0;i<n;i++) if(finite(x[i])&&finite(y[i])) out.push([Number(x[i]),Number(y[i])]);
    return out;
  }

  function pearson(x,y){
    const p=pairedNumeric(x,y); if(p.length<3) return NaN;
    const ax=p.map(r=>r[0]), ay=p.map(r=>r[1]), mx=mean(ax), my=mean(ay);
    let sxy=0,sxx=0,syy=0;
    for(let i=0;i<p.length;i++){ const dx=ax[i]-mx,dy=ay[i]-my; sxy+=dx*dy;sxx+=dx*dx;syy+=dy*dy; }
    return sxx>0&&syy>0?sxy/Math.sqrt(sxx*syy):NaN;
  }

  function ranks(values){
    const indexed=values.map((v,i)=>({v:Number(v),i})).sort((a,b)=>a.v-b.v);
    const out=Array(values.length); let i=0;
    while(i<indexed.length){ let j=i+1; while(j<indexed.length&&indexed[j].v===indexed[i].v)j++;
      const rank=(i+1+j)/2; for(let k=i;k<j;k++)out[indexed[k].i]=rank; i=j;
    }
    return out;
  }

  function spearman(x,y){
    const p=pairedNumeric(x,y); if(p.length<3)return NaN;
    return pearson(ranks(p.map(r=>r[0])),ranks(p.map(r=>r[1])));
  }

  function fisherCI(r,n,level=.95){
    if(!Number.isFinite(r)||n<4)return [NaN,NaN];
    const zCrit=level>=.99?2.5758293035:level>=.95?1.9599639845:1.644853627;
    const rr=clamp(r,-.999999,.999999), z=.5*Math.log((1+rr)/(1-rr)), se=1/Math.sqrt(n-3);
    return [Math.tanh(z-zCrit*se),Math.tanh(z+zCrit*se)];
  }

  function cleanCategorical(x,y){
    const out=[]; const n=Math.min(x.length,y.length);
    for(let i=0;i<n;i++){
      const a=x[i],b=y[i];
      if(a!==null&&a!==undefined&&String(a).trim()!==''&&b!==null&&b!==undefined&&String(b).trim()!=='') out.push([String(a).trim(),String(b).trim()]);
    }
    return out;
  }

  function categoryOrder(pairs){
    const cats=[...new Set(pairs.flat())];
    const allNum=cats.every(finite);
    return cats.sort(allNum?(a,b)=>Number(a)-Number(b):(a,b)=>String(a).localeCompare(String(b),'es',{numeric:true}));
  }

  function kappa(x,y,weight='none'){
    const p=cleanCategorical(x,y); if(p.length<2)return NaN;
    const cats=categoryOrder(p), idx=new Map(cats.map((c,i)=>[c,i])), k=cats.length;
    const table=Array.from({length:k},()=>Array(k).fill(0));
    p.forEach(([a,b])=>table[idx.get(a)][idx.get(b)]++);
    const row=table.map(r=>r.reduce((s,v)=>s+v,0));
    const col=Array.from({length:k},(_,j)=>table.reduce((s,r)=>s+r[j],0));
    const n=p.length;
    let obs=0,exp=0;
    const w=(i,j)=>{
      if(weight==='none')return i===j?1:0;
      if(k===1)return 1;
      const d=Math.abs(i-j)/(k-1);
      return weight==='quadratic'?1-d*d:1-d;
    };
    for(let i=0;i<k;i++)for(let j=0;j<k;j++){
      obs+=w(i,j)*table[i][j]/n;
      exp+=w(i,j)*(row[i]/n)*(col[j]/n);
    }
    return (1-exp)!==0?(obs-exp)/(1-exp):NaN;
  }

  function icc(matrix,type='ICC2',measure='single'){
    const rows=matrix.filter(r=>Array.isArray(r)&&r.length>=2&&r.every(finite)).map(r=>r.map(Number));
    if(rows.length<3)return NaN;
    const n=rows.length,k=rows[0].length; if(rows.some(r=>r.length!==k)||k<2)return NaN;
    const gm=mean(rows.flat()), rowMeans=rows.map(mean), colMeans=Array.from({length:k},(_,j)=>mean(rows.map(r=>r[j])));
    const msr=k*rowMeans.reduce((s,v)=>s+(v-gm)**2,0)/(n-1);
    const msc=n*colMeans.reduce((s,v)=>s+(v-gm)**2,0)/(k-1);
    let sse=0;
    for(let i=0;i<n;i++)for(let j=0;j<k;j++)sse+=(rows[i][j]-rowMeans[i]-colMeans[j]+gm)**2;
    const mse=sse/((n-1)*(k-1));
    let value;
    if(type==='ICC3') value=measure==='average'?(msr-mse)/msr:(msr-mse)/(msr+(k-1)*mse);
    else value=measure==='average'?(msr-mse)/(msr+(msc-mse)/n):(msr-mse)/(msr+(k-1)*mse+k*(msc-mse)/n);
    return value;
  }

  function rng(seed){ let x=seed>>>0||2463534242; return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;}; }
  function percentile(sorted,p){ if(!sorted.length)return NaN; const h=(sorted.length-1)*p,i=Math.floor(h),f=h-i; return sorted[i]+(sorted[Math.min(i+1,sorted.length-1)]-sorted[i])*f; }
  function bootstrapPairs(pairs,stat,reps=1000,seed=5404){
    if(pairs.length<3)return [NaN,NaN]; const random=rng(seed), vals=[];
    for(let b=0;b<reps;b++){
      const sample=[]; for(let i=0;i<pairs.length;i++)sample.push(pairs[Math.floor(random()*pairs.length)]);
      const v=stat(sample); if(Number.isFinite(v))vals.push(v);
    }
    vals.sort((a,b)=>a-b); return [percentile(vals,.025),percentile(vals,.975)];
  }

  function interpret(value,kind){
    if(!Number.isFinite(value))return 'No estimable con los datos disponibles.';
    const a=Math.abs(value);
    if(kind==='correlation'){
      if(a>=.90)return 'Asociación muy alta.'; if(a>=.70)return 'Asociación alta.'; if(a>=.50)return 'Asociación moderada.'; if(a>=.30)return 'Asociación baja.'; return 'Asociación muy baja.';
    }
    if(value<0)return 'Concordancia inferior a la esperada por azar; revise codificación y mediciones.';
    if(value<.50)return 'Concordancia pobre.'; if(value<.75)return 'Concordancia moderada.'; if(value<.90)return 'Concordancia buena.'; return 'Concordancia excelente.';
  }

  function parseCsv(text){
    const rows=[]; let row=[],cell='',q=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i],next=text[i+1];
      if(q){ if(ch==='"'&&next==='"'){cell+='"';i++;} else if(ch==='"')q=false; else cell+=ch; }
      else if(ch==='"')q=true; else if(ch===','){row.push(cell);cell='';} else if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell='';} else if(ch!=='\r')cell+=ch;
    }
    row.push(cell); if(row.some(v=>String(v).trim()!==''))rows.push(row); return rows;
  }

  function dataset(win){
    const mgr=win.ValiStructParticipantData; if(!mgr?.summary)throw new Error('Importe primero la base de participantes en el Centro de datos.');
    const parsed=parseCsv(mgr.toCsv().replace(/^\uFEFF/,'')), columns=parsed[0], rows=parsed.slice(1);
    return {columns,rows,summary:mgr.summary};
  }

  function esc(s){return String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));}
  function save(win,text,type,name){const blob=new Blob([text],{type});const a=win.document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

  function mount(win){
    const d=win.document;
    const panel=d.getElementById('stability'); if(!panel||panel.dataset.v54Stability==='ready')return;
    panel.dataset.v54Stability='ready';
    const nav=d.querySelector('button[data-section="stability"]');
    if(nav){nav.dataset.status='ready';nav.innerHTML='<span>Estabilidad y concordancia</span><small class="vs-v53-nav-status">Disponible</small>';}
    panel.innerHTML=`
      <div class="vs-v52-breadcrumb">Inicio <span>›</span> Validación externa <span>›</span> Estabilidad y concordancia</div>
      <div class="vs-v52-module-header"><div><span class="vs-v52-eyebrow">ETAPA IV · VALIDACIÓN EXTERNA</span><h2>Estabilidad y concordancia</h2><p>Test–retest y acuerdo entre dos mediciones o evaluadores.</p></div><span class="status-chip good-bg">Disponible</span></div>
      <div class="vs-v52-context"><strong>Principio metodológico.</strong> La correlación evalúa asociación; CCI y kappa evalúan concordancia. ValiStruct informa el método utilizado, casos completos y un intervalo de confianza cuando corresponde.</div>
      <div class="vs-v52-form-card">
        <div class="vs-v52-card-heading"><span class="vs-v52-step">01</span><div><h3>Configure el análisis</h3><p>Seleccione dos mediciones de la misma unidad de análisis.</p></div></div>
        <div class="vs-v52-form-grid">
          <label>Procedimiento<select id="stabilityProcedure"><option value="test-retest">Test–retest · Pearson/Spearman + CCI</option><option value="kappa">Kappa de Cohen · nominal</option><option value="kappa-weighted">Kappa ponderado · ordinal</option><option value="icc">CCI configurable · cuantitativo</option></select></label>
          <label>Primera medición<select id="stabilityVarA"></select></label>
          <label>Segunda medición<select id="stabilityVarB"></select></label>
          <label id="stabilityWeightWrap">Ponderación<select id="stabilityWeight"><option value="linear">Lineal</option><option value="quadratic" selected>Cuadrática</option></select></label>
          <label id="stabilityIccTypeWrap">Modelo CCI<select id="stabilityIccType"><option value="ICC2" selected>CCI(2) · acuerdo absoluto, efectos aleatorios</option><option value="ICC3">CCI(3) · consistencia, efectos mixtos</option></select></label>
          <label id="stabilityIccMeasureWrap">Unidad CCI<select id="stabilityIccMeasure"><option value="single" selected>Medición individual</option><option value="average">Promedio de mediciones</option></select></label>
          <label>Bootstrap para IC 95%<select id="stabilityBootstrap"><option value="500">500 réplicas</option><option value="1000" selected>1000 réplicas</option><option value="2000">2000 réplicas</option></select></label>
        </div>
        <div id="stabilityDataStatus" class="vs-v52-linked-data" role="status"></div>
        <div class="button-row"><button id="runStability" class="primary">Calcular estabilidad / concordancia</button><button id="stabilityOpenData">Abrir Centro de datos</button><button id="downloadStability" disabled>Descargar resultados CSV</button><button id="copyStability" disabled>Copiar resumen</button></div>
        <div id="stabilityStatus" role="status" aria-live="polite"></div>
      </div>
      <div id="stabilityResults"></div>
      <details class="vs-v52-help"><summary>Ayuda metodológica</summary><p><strong>Pearson/Spearman:</strong> asociación entre mediciones. <strong>Kappa:</strong> acuerdo categórico corregido por azar. <strong>Kappa ponderado:</strong> acuerdo ordinal con penalización por distancia. <strong>CCI(2):</strong> acuerdo absoluto cuando evaluadores/ocasiones se consideran intercambiables. <strong>CCI(3):</strong> consistencia para evaluadores/ocasiones fijos. Los puntos de corte son orientativos y deben interpretarse junto con el diseño y el IC 95%.</p></details>`;

    const $=id=>d.getElementById(id), varA=$('stabilityVarA'),varB=$('stabilityVarB'),proc=$('stabilityProcedure');
    let last=null;
    function refresh(){
      const s=win.ValiStructParticipantData?.summary, status=$('stabilityDataStatus');
      if(!s){status.textContent='Sin base compartida. Importe participantes desde el Centro de datos.';varA.innerHTML=varB.innerHTML='<option value="">Sin variables</option>';return;}
      status.textContent='Base disponible: '+s.source+' · '+s.n+' participantes · '+s.variables.length+' variables.';
      const keepA=varA.value,keepB=varB.value,opts='<option value="">Seleccione…</option>'+s.variables.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('');
      varA.innerHTML=opts;varB.innerHTML=opts;if(s.variables.includes(keepA))varA.value=keepA;if(s.variables.includes(keepB))varB.value=keepB;
    }
    function controls(){ const p=proc.value; $('stabilityWeightWrap').hidden=p!=='kappa-weighted'; $('stabilityIccTypeWrap').hidden=!(p==='icc'||p==='test-retest'); $('stabilityIccMeasureWrap').hidden=!(p==='icc'||p==='test-retest'); }
    function columns(){
      const data=dataset(win),ia=data.columns.indexOf(varA.value),ib=data.columns.indexOf(varB.value); if(ia<0||ib<0)throw new Error('Seleccione dos variables existentes.'); if(ia===ib)throw new Error('Seleccione dos mediciones diferentes.');
      return {data,a:data.rows.map(r=>r[ia]),b:data.rows.map(r=>r[ib])};
    }
    function metricRow(label,value,ci,kind,n){return {label,value,ci,kind,n,interpretation:interpret(value,kind)};}
    function run(){
      try{
        const {data,a,b}=columns(),p=proc.value,reps=Number($('stabilityBootstrap').value)||1000,rows=[];
        if(p==='test-retest'){
          const pairs=pairedNumeric(a,b); if(pairs.length<3)throw new Error('Se requieren al menos 3 pares numéricos completos.');
          const x=pairs.map(r=>r[0]),y=pairs.map(r=>r[1]),r=pearson(x,y),rho=spearman(x,y),matrix=pairs.map(r=>[r[0],r[1]]),type=$('stabilityIccType').value,measure=$('stabilityIccMeasure').value,iv=icc(matrix,type,measure);
          rows.push(metricRow('Pearson r',r,fisherCI(r,pairs.length),'correlation',pairs.length));
          rows.push(metricRow('Spearman ρ',rho,bootstrapPairs(pairs,s=>spearman(s.map(r=>r[0]),s.map(r=>r[1])),reps,54041),'correlation',pairs.length));
          rows.push(metricRow(type+(measure==='average'?', promedio':', individual'),iv,bootstrapPairs(pairs,s=>icc(s,type,measure),reps,54042),'agreement',pairs.length));
        }else if(p==='kappa'||p==='kappa-weighted'){
          const pairs=cleanCategorical(a,b); if(pairs.length<3)throw new Error('Se requieren al menos 3 pares categóricos completos.');
          const weight=p==='kappa'?'none':$('stabilityWeight').value,kv=kappa(pairs.map(r=>r[0]),pairs.map(r=>r[1]),weight);
          rows.push(metricRow(p==='kappa'?'Kappa de Cohen':'Kappa ponderado ('+(weight==='quadratic'?'cuadrático':'lineal')+')',kv,bootstrapPairs(pairs,s=>kappa(s.map(r=>r[0]),s.map(r=>r[1]),weight),reps,54043),'agreement',pairs.length));
        }else{
          const pairs=pairedNumeric(a,b); if(pairs.length<3)throw new Error('Se requieren al menos 3 pares numéricos completos.');
          const type=$('stabilityIccType').value,measure=$('stabilityIccMeasure').value,iv=icc(pairs,type,measure);
          rows.push(metricRow(type+(measure==='average'?' · promedio':' · individual'),iv,bootstrapPairs(pairs,s=>icc(s,type,measure),reps,54044),'agreement',pairs.length));
        }
        last={procedure:p,variableA:varA.value,variableB:varB.value,source:data.summary.source,nOriginal:data.summary.n,rows,reps}; render(last); $('downloadStability').disabled=false;$('copyStability').disabled=false;$('stabilityStatus').textContent='Análisis completado con casos completos por pares. Revise método, IC 95% e interpretación.';
      }catch(err){last=null;$('downloadStability').disabled=true;$('copyStability').disabled=true;$('stabilityResults').innerHTML='';$('stabilityStatus').textContent=err.message||String(err);}
    }
    function fmt(v){return Number.isFinite(v)?v.toFixed(3):'—';}
    function render(res){
      const excluded=res.nOriginal-Math.max(...res.rows.map(r=>r.n));
      $('stabilityResults').innerHTML='<div class="results-summary"><div class="report-header"><h3>ValiStruct · Estabilidad y concordancia</h3><p><strong>'+esc(res.variableA)+'</strong> vs <strong>'+esc(res.variableB)+'</strong> · '+esc(res.source)+'</p></div><div class="result-cards"><div class="result-card"><span>N original</span><strong>'+res.nOriginal+'</strong></div><div class="result-card"><span>Casos completos</span><strong>'+Math.max(...res.rows.map(r=>r.n))+'</strong></div><div class="result-card"><span>Excluidos</span><strong>'+excluded+'</strong></div><div class="result-card"><span>IC</span><strong>95%</strong></div></div><p>Los IC de Pearson usan transformación z de Fisher. Los demás IC se estiman mediante bootstrap percentil ('+res.reps+' réplicas, semilla reproducible).</p></div><div class="workspace"><table class="results-table"><thead><tr><th>Estadístico</th><th>Estimación</th><th>IC 95%</th><th>N</th><th>Interpretación orientativa</th></tr></thead><tbody>'+res.rows.map(r=>'<tr><td><strong>'+esc(r.label)+'</strong></td><td>'+fmt(r.value)+'</td><td>'+fmt(r.ci[0])+'–'+fmt(r.ci[1])+'</td><td>'+r.n+'</td><td>'+esc(r.interpretation)+'</td></tr>').join('')+'</tbody></table></div>';
    }
    function summary(){if(!last)return'';return ['ValiStruct · Estabilidad y concordancia','Variables: '+last.variableA+' vs '+last.variableB,'Base: '+last.source+' · N original='+last.nOriginal,...last.rows.map(r=>r.label+': '+fmt(r.value)+'; IC95% '+fmt(r.ci[0])+'–'+fmt(r.ci[1])+'; N='+r.n+'; '+r.interpretation)].join('\n');}
    $('runStability').addEventListener('click',run); proc.addEventListener('change',controls); $('stabilityOpenData').addEventListener('click',()=>d.querySelector('button[data-section="dataimport"]')?.click());
    $('copyStability').addEventListener('click',()=>navigator.clipboard.writeText(summary()).then(()=>$('stabilityStatus').textContent='Resumen copiado al portapapeles.').catch(()=>$('stabilityStatus').textContent='No fue posible copiar automáticamente.'));
    $('downloadStability').addEventListener('click',()=>{if(!last)return;const rows=[['Variable_A','Variable_B','Estadistico','Estimacion','IC95_inferior','IC95_superior','N','Interpretacion'],...last.rows.map(r=>[last.variableA,last.variableB,r.label,fmt(r.value),fmt(r.ci[0]),fmt(r.ci[1]),r.n,r.interpretation])];const csv=rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');save(win,'\ufeff'+csv,'text/csv;charset=utf-8','ValiStruct_estabilidad_concordancia.csv');});
    d.addEventListener('valistruct:participants-changed',refresh); refresh();controls();
  }

  return {pairedNumeric,pearson,spearman,fisherCI,kappa,icc,bootstrapPairs,interpret,mount};
});
