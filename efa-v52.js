/* ValiStruct v5.2 AFE: independent diagnostics + real R/psych extraction.
 * Capture listeners prevent the original ACP handler running for common factors,
 * without altering existing JASP, Aiken or local ACP algorithms.
 */
(() => {
'use strict';
const el=id=>document.getElementById(id);
const fmt=(v,d=3)=>Number.isFinite(Number(v))?Number(v).toFixed(d):'—';
const esc=s=>typeof escapeHtml==='function'?escapeHtml(String(s)):String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let remote=null,diagnostics=null,sourceRevision=null,busy=false;
const methodName={pca:'Componentes principales (ACP; reducción de datos)',uls:'Mínimos cuadrados no ponderados (ULS / MINRES)',gls:'Mínimos cuadrados generalizados (GLS)',ml:'Máxima verosimilitud (ML)',pa:'Ejes principales (PAF)',alpha:'Factorización alfa'};
function status(message,isError=false){
  const target=el('efaEngineStatus');if(target){target.textContent=message;target.classList.toggle('efa-error',isError);}
}
function clearRemote(){
  remote=null;diagnostics=null;sourceRevision=null;
  if(typeof efaLastResults!=='undefined')efaLastResults=null;
  const t=el('efaDiagnosticResults');if(t)t.replaceChildren();
}
function csvSource(){
  if(!efaData || !Array.isArray(efaData.matrix)||efaData.n<3)throw new Error('Primero cargue una base de al menos tres participantes.');
  const header=efaData.itemNames.map(csvEscape).join(',');
  return [header,...efaData.matrix.map(row=>row.map(csvEscape).join(','))].join('\n');
}
function sourceToken(){
  return JSON.stringify({items:efaData?.itemNames,n:efaData?.n,
    matrix:efaData?.matrix,revision:window.ValiStructParticipantData?.revision||0,
    method:el('efaExtraction').value,rotation:el('efaRotation').value,
    factors:el('efaFactors').value,parallel:el('efaParallelRuns').value});
}
async function callR(method){
  const payload={method,csv_text:csvSource(),item_names:efaData.itemNames,
    factors:Number(el('efaFactors').value),rotation:el('efaRotation').value,
    parallel_runs:Number(el('efaParallelRuns').value)};
  const response=await fetch(getProApiBase()+'/efa',{method:'POST',
    headers:typeof authHeaders==='function'?authHeaders({'Content-Type':'application/json'}):{'Content-Type':'application/json'},
    body:JSON.stringify(payload)});
  let data;
  try{data=await response.json();}catch(_){throw new Error('Motor R respondió en formato no válido.');}
  if(!response.ok||data.ok!==true)throw new Error(data.error||'El motor R no pudo finalizar el análisis.');
  return data;
}
function diagnosticMarkup(d){
  let m=d.mardia||{},sk=m.skewness||{},ku=m.kurtosis||{};
  return '<div class="efa-diagnostic-panel"><h3>Diagnóstico de factorizabilidad y normalidad</h3>'+
    '<div class="efa-diag-cards">'+
    '<div><small>KMO global</small><strong>'+fmt(d.kmo?.overall)+'</strong></div>'+
    '<div><small>Bartlett · χ²</small><strong>'+fmt(d.bartlett?.chi2,2)+'</strong><small>gl = '+fmt(d.bartlett?.df,0)+' · p = '+fmt(d.bartlett?.p,4)+'</small></div>'+
    '<div><small>Mardia · asimetría</small><strong>'+(m.ok?fmt(sk.statistic,2):'No estimable')+'</strong>'+(m.ok?'<small>χ²; p = '+fmt(sk.pvalue,4)+'</small>':'')+'</div>'+
    '<div><small>Mardia · curtosis</small><strong>'+(m.ok?fmt(ku.z,2):'No estimable')+'</strong>'+(m.ok?'<small>z; p = '+fmt(ku.pvalue,4)+'</small>':'')+'</div>'+
    '</div><p>Casos completos: <strong>'+d.n_complete+'</strong>. Excluidos: <strong>'+d.n_excluded+'</strong>. '+(m.ok?'Mardia se calcula para variables continuas; en ítems ordinales su interpretación es limitada.':esc(m.reason||''))+'</p></div>';
}
function renderDiagnostics(d){
  diagnostics=d;
  el('efaDiagnosticResults').innerHTML=diagnosticMarkup(d);
}
function renderR(d){
  remote=d;
  sourceRevision=sourceToken();
  const p=d.loadings||[],k=d.factors,phi=d.phi||[];
  let html='<div class="efa-r-results"><div class="efa-r-head"><div><span class="vs-v52-eyebrow">RESULTADO DEL MOTOR R / PSYCH</span><h3>'+esc(methodName[d.method]||d.method)+'</h3><p>Rotación: '+esc(d.rotation)+' · '+d.n_complete+' casos completos · '+d.n_excluded+' excluidos · psicometría: psych '+esc(d.package_version)+'</p></div><span class="vs-v52-status">Cálculo ejecutado</span></div>'+
    diagnosticMarkup(d)+
    '<div class="efa-result-grid"><div><small>Factores extraídos</small><strong>'+k+'</strong></div><div><small>Análisis paralelo: factores sugeridos</small><strong>'+fmt(d.parallel_recommended,0)+'</strong></div><div><small>RMS residual</small><strong>'+fmt(d.fit?.rms)+'</strong></div><div><small>χ² del ajuste</small><strong>'+fmt(d.fit?.chisq,2)+'</strong></div></div>'+
    '<h3>Patrón de cargas factoriales</h3><div class="workspace"><table class="results-table"><thead><tr><th>Ítem</th>';
  for(let j=0;j<k;j++)html+='<th>Factor '+(j+1)+'</th>';
  html+='<th>Comunalidad</th></tr></thead><tbody>';
  p.forEach((row,i)=>{
    html+='<tr><th>'+esc(d.item_names[i])+'</th>'+row.map(v=>'<td class="'+(Math.abs(v)>=Number(el('efaLoadingThreshold').value)?'loading-strong':'')+'">'+fmt(v)+'</td>').join('')+'<td>'+fmt(d.communalities[i])+'</td></tr>';
  });
  html+='</tbody></table></div><details><summary>Correlaciones entre factores, estructura y análisis paralelo</summary>';
  function table(mat,first){let result='<div class="workspace"><table class="results-table"><tbody>';mat.forEach((row,i)=>{result+='<tr><th>'+first+' '+(i+1)+'</th>'+row.map(v=>'<td>'+fmt(v)+'</td>').join('')+'</tr>'});return result+'</tbody></table></div>'}
  html+='<h4>Correlaciones entre factores</h4>'+table(phi,'Factor')+
    '<h4>Matriz de estructura</h4>'+table(d.structure||[],'Ítem')+
    '<h4>Autovalores observados y de simulación</h4><div class="workspace"><table class="results-table"><thead><tr><th>Componente / factor</th><th>Observado (R)</th><th>Simulado (factores comunes)</th></tr></thead><tbody>';
  d.eigenvalues.forEach((v,i)=>html+='<tr><td>'+(i+1)+'</td><td>'+fmt(v)+'</td><td>'+fmt(d.parallel_eigenvalues?.[i])+'</td></tr>');
  html+='</tbody></table></div></details><p class="efa-method-warning">La elección del método, el número de factores y la rotación debe justificarse teóricamente. ACP no equivale a análisis factorial común. La factorabilidad y los resultados no prueban por sí solos validez de constructo.</p></div>';
  el('efaResults').innerHTML=html;
}
function busyState(value){
  busy=value;
  ['calculateEfa','efaDiagnostics'].forEach(id=>{if(el(id))el(id).disabled=value});
}
async function run(method){
  if(busy)return;
  let snapshot;
  try{
    snapshot=sourceToken();busyState(true);status('Ejecutando '+(method==='diagnostics'?'diagnósticos':'AFE de factores comunes')+' con R…');
    const data=await callR(method);
    if(snapshot!==sourceToken())throw new Error('La base cambió durante el cálculo. Ejecute de nuevo el análisis.');
    if(method==='diagnostics'){
      renderDiagnostics(data);status('KMO, Bartlett y Mardia calculados con R. Revise los supuestos e interpretaciones.');
    }else{
      renderDiagnostics(data);renderR(data);status('Extracción '+(methodName[method]||method)+' terminada; puede descargar resultados e informe.');
    }
  }catch(e){
    if(method==='diagnostics' && efaData?.matrix?.length){
      try{
        const R=efaCorrelationMatrix(efaData.matrix),kmo=kmoOverall(R),bart=bartlettTest(R,efaData.n);
        const fallback={ok:true,engine:'Navegador',n_complete:efaData.n,n_excluded:0,
          item_names:efaData.itemNames,kmo:{overall:kmo.overall,per_item:kmo.perItem},
          bartlett:{chi2:bart.chi2,df:bart.df,p:bart.p},
          mardia:{ok:false,reason:'Mardia requiere R conectado; KMO y Bartlett se calcularon localmente (p de Bartlett aproximado).'}};
        renderDiagnostics(fallback);
        status('KMO y Bartlett disponibles localmente. Mardia requiere R; '+e.message,true);
      }catch(_){status(e.message,true)}
    }else{status(e.message,true);el('efaDiagnosticResults').innerHTML='<div class="efa-method-warning">'+esc(e.message)+'</div>';}
  }
  finally{busyState(false);}
}
const calc=el('calculateEfa');
calc.addEventListener('click',e=>{
  const method=el('efaExtraction').value;
  if(method==='pca'){clearRemote();status('ACP local: se calcularán KMO y Bartlett. Mardia requiere el botón de diagnósticos con R.');return;}
  e.preventDefault();e.stopImmediatePropagation();run(method);
},true);
el('efaDiagnostics').addEventListener('click',()=>run('diagnostics'));
function quote(v){return '"'+String(v??'').replace(/"/g,'""')+'"'}
function downloadCSV(d){
  const rows=[['Campo','Valor'],['Metodo',methodName[d.method]||d.method],['Motor','R psych '+d.package_version],
    ['N_total',d.n_original],['N_completos',d.n_complete],['N_excluidos',d.n_excluded],
    ['KMO_global',d.kmo.overall],['Bartlett_chi2',d.bartlett.chi2],['Bartlett_gl',d.bartlett.df],['Bartlett_p',d.bartlett.p],
    ['Mardia_asimetria_b1p',d.mardia?.skewness?.b1p],['Mardia_asimetria_p',d.mardia?.skewness?.pvalue],
    ['Mardia_curtosis_b2p',d.mardia?.kurtosis?.b2p],['Mardia_curtosis_z',d.mardia?.kurtosis?.z],['Mardia_curtosis_p',d.mardia?.kurtosis?.pvalue]];
  if(d.loadings){rows.push([],['CARGAS'],['Ítem',...Array.from({length:d.factors},(_,i)=>'F'+(i+1)),'Comunalidad']);d.loadings.forEach((row,i)=>rows.push([d.item_names[i],...row,d.communalities[i]]));}
  if(d.kmo?.per_item?.length){rows.push([],['KMO_POR_ITEM'],['Item','MSA']);d.kmo.per_item.forEach((v,i)=>rows.push([d.item_names[i],v]));}
  const csv='\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\n');
  saveBlob(csv,'text/csv;charset=utf-8;','ValiStruct_AFE_'+d.method+'_resultados.csv');
}
function reportHTML(d){
  let html='<!doctype html><html lang="es"><meta charset="utf-8"><title>ValiStruct AFE · '+esc(d.method)+'</title><style>body{font:14px Arial;max-width:1000px;margin:3rem auto;color:#173451}table{border-collapse:collapse;width:100%}td,th{border:1px solid #cdd7e2;padding:8px;text-align:left}h1{color:#143960}small{color:#61768d}</style><body>'+
    '<h1>ValiStruct · Análisis factorial exploratorio</h1><p>Plataforma: Dr. Roberto Joel Tirado Reyes · Autor conceptual y director científico</p>'+
    '<p>Método: '+esc(methodName[d.method]||d.method)+' · Rotación: '+esc(d.rotation)+
    ' · Motor: R psych '+esc(d.package_version)+'</p>'+
    '<p>N = '+d.n_complete+' (excluidos: '+d.n_excluded+'). KMO = '+fmt(d.kmo.overall)+
    '; Bartlett χ²('+fmt(d.bartlett.df,0)+') = '+fmt(d.bartlett.chi2,2)+', p = '+fmt(d.bartlett.p,4)+'.</p>';
  if(d.mardia?.ok)html+='<p>Mardia: asimetría χ² = '+fmt(d.mardia.skewness.statistic,2)+', p = '+fmt(d.mardia.skewness.pvalue,4)+
    '; curtosis z = '+fmt(d.mardia.kurtosis.z,2)+', p = '+fmt(d.mardia.kurtosis.pvalue,4)+'.</p>';
  if(d.loadings){html+='<h2>Matriz de cargas factoriales</h2><table><tr><th>Ítem</th>'+Array.from({length:d.factors},(_,i)=>'<th>F'+(i+1)+'</th>').join('')+'<th>h²</th></tr>';
    d.loadings.forEach((r,i)=>html+='<tr><td>'+esc(d.item_names[i])+'</td>'+r.map(v=>'<td>'+fmt(v)+'</td>').join('')+'<td>'+fmt(d.communalities[i])+'</td></tr>');html+='</table>';}
  html+='<p>El análisis paralelo usa simulaciones con semilla fija 20260927. Informe el método, la muestra y las limitaciones de la interpretación.</p></body></html>';
  return html;
}
[['downloadEfaResults',d=>downloadCSV(d)],['downloadEfaReport',d=>saveBlob(reportHTML(d),'text/html;charset=utf-8;','ValiStruct_AFE_'+d.method+'_informe.html')],
 ['printEfaReport',d=>{const w=window.open('','_blank');if(!w){status('Habilite las ventanas emergentes para imprimir el informe.',true);return;}w.document.write(reportHTML(d));w.document.close();w.focus();w.print()}]].forEach(([id,fn])=>{
  el(id).addEventListener('click',e=>{if(remote && sourceRevision===sourceToken()){e.preventDefault();e.stopImmediatePropagation();fn(remote)}},true);
});
el('efaExtraction').addEventListener('change',()=>{
  clearRemote();el('efaResults').replaceChildren();
  status(el('efaExtraction').value==='pca'?'ACP local seleccionada. Puede calcular KMO y Bartlett; Mardia requiere R.':
    'Método de factores comunes: requiere R/psych activo. KMO, Bartlett y Mardia disponibles por separado.');
});
['efaRotation','efaFactors','efaParallelRuns'].forEach(id=>el(id)?.addEventListener('change',()=>{
  clearRemote();el('efaResults').replaceChildren();
  status('La configuración ha cambiado. Ejecute de nuevo el análisis antes de exportar.');
}));
el('efaExportSyntax').addEventListener('click',()=>{
  const m=el('efaExtraction').value;
  if(m==='pca'){status('La sintaxis R de ACP se incorporará después; utilice las exportaciones del prototipo local.',true);return;}
  const fm={uls:'minres',gls:'gls',ml:'ml',pa:'pa',alpha:'alpha'}[m];
  if(!fm){status('Esta extracción todavía no está validada.',true);return;}
  if(!efaData){status('Cargue primero una base de participantes para generar sintaxis.',true);return;}
  const rotation=el('efaRotation').value,factors=Number(el('efaFactors').value);
  const script='# ValiStruct v5.2 · sintaxis reproducible (base de participantes exportada como CSV)\n'+
    'library(psych)\nd <- read.csv("participantes.csv",check.names=FALSE)\n'+
    'items <- '+('c('+efaData.itemNames.map(x=>JSON.stringify(x)).join(', ')+')')+'\n'+
    'x <- na.omit(d[,items,drop=FALSE])\n'+
    'psych::KMO(cor(x))\npsych::cortest.bartlett(cor(x),n=nrow(x))\n'+
    'set.seed(20260927)\npsych::fa.parallel(x,fm="minres",fa="fa",n.iter='+Number(el('efaParallelRuns').value)+',plot=FALSE)\n'+
    'psych::fa(x,nfactors='+factors+',fm="'+fm+'",rotate="'+rotation+'")\n';
  saveBlob(script,'text/plain;charset=utf-8;','ValiStruct_AFE_'+m+'_sintaxis.R');
});
document.addEventListener('valistruct:participants-changed',clearRemote);
status('Seleccione ACP local o un método R. Diagnósticos KMO / Bartlett / Mardia disponibles independientemente.');
})();
