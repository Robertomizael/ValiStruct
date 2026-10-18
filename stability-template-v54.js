/* ValiStruct v5.4 · Etapa IV · carga directa, ayuda y plantillas.
 * Mejora aislada de UX para Estabilidad y Validez de criterio.
 * No modifica cálculos estadísticos.
 */
(function(root){
  'use strict';
  if(!root||!root.document)return;
  const d=root.document;
  const escCsv=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const toCsv=rows=>rows.map(r=>r.map(escCsv).join(',')).join('\n');

  const stabilityScenarios={
    'test-retest':{label:'Test–retest / CCI cuantitativo',file:'ValiStruct_plantilla_estabilidad_cuantitativa',sheet:'Estabilidad_cuantitativa',rows:[['ID','Medicion_T1','Medicion_T2'],['P001',42,44],['P002',35,36],['P003',51,50],['P004',28,31],['P005',47,46]],guide:'<strong>Formato requerido · cuantitativo.</strong> Use una sola base: una fila por participante y dos columnas numéricas, por ejemplo <code>Medicion_T1</code> y <code>Medicion_T2</code>. Después seleccione ambas columnas como Primera y Segunda medición.'},
    'icc':{label:'CCI configurable · cuantitativo',file:'ValiStruct_plantilla_estabilidad_CCI',sheet:'CCI_cuantitativo',rows:[['ID','Medicion_1','Medicion_2'],['P001',42,44],['P002',35,36],['P003',51,50],['P004',28,31],['P005',47,46]],guide:'<strong>Formato requerido · cuantitativo.</strong> Use una sola base con una fila por unidad de análisis y una columna numérica por medición/evaluador. Seleccione dos columnas y configure CCI(2) o CCI(3) según el diseño.'},
    'kappa':{label:'Kappa de Cohen · nominal',file:'ValiStruct_plantilla_concordancia_nominal',sheet:'Kappa_nominal',rows:[['ID','Evaluador_1','Evaluador_2'],['P001','Positivo','Positivo'],['P002','Negativo','Positivo'],['P003','Positivo','Positivo'],['P004','Negativo','Negativo'],['P005','Positivo','Positivo']],guide:'<strong>Formato requerido · nominal.</strong> Use una sola base: una fila por caso y dos columnas con categorías nominales. Mantenga exactamente las mismas etiquetas de categoría en ambas columnas.'},
    'kappa-weighted':{label:'Kappa ponderado · ordinal',file:'ValiStruct_plantilla_concordancia_ordinal',sheet:'Kappa_ordinal',rows:[['ID','Medicion_Ordinal_1','Medicion_Ordinal_2'],['P001',1,1],['P002',2,3],['P003',3,3],['P004',1,2],['P005',2,2]],guide:'<strong>Formato requerido · ordinal.</strong> Use una sola base con dos columnas ordinales y la misma codificación/orden en ambas, por ejemplo <code>1 = Leve</code>, <code>2 = Moderado</code>, <code>3 = Severo</code>.'}
  };
  const criterionScenarios={
    concurrent:{label:'Criterio concurrente',file:'ValiStruct_plantilla_criterio_concurrente',sheet:'Criterio_concurrente',rows:[['ID','Puntaje_Instrumento','Criterio_Externo'],['P001',42,44],['P002',55,57],['P003',61,63],['P004',33,35],['P005',70,71]],guide:'<strong>Formato requerido · criterio concurrente.</strong> Use una sola base con la puntuación del instrumento y un criterio externo cuantitativo medidos en un periodo comparable.'},
    predictive:{label:'Criterio predictivo',file:'ValiStruct_plantilla_criterio_predictivo',sheet:'Criterio_predictivo',rows:[['ID','Puntaje_Instrumento','Criterio_Externo_Futuro'],['P001',42,45],['P002',55,59],['P003',61,64],['P004',33,36],['P005',70,74]],guide:'<strong>Formato requerido · criterio predictivo.</strong> La puntuación principal debe anteceder temporalmente al criterio externo posterior. Ambas variables deben estar en columnas distintas de la misma base.'},
    linear:{label:'Regresión lineal simple',file:'ValiStruct_plantilla_criterio_regresion_lineal',sheet:'Criterio_lineal',rows:[['ID','Puntaje_Instrumento','Criterio_Cuantitativo'],['P001',42,45],['P002',55,58],['P003',61,64],['P004',33,35],['P005',70,72]],guide:'<strong>Formato requerido · regresión lineal.</strong> Use una puntuación predictora cuantitativa y un criterio cuantitativo en columnas diferentes.'},
    logistic:{label:'Regresión logística binaria',file:'ValiStruct_plantilla_criterio_logistico',sheet:'Criterio_logistico',rows:[['ID','Puntaje_Instrumento','Criterio_Binario_0_1'],['P001',42,0],['P002',55,1],['P003',61,1],['P004',33,0],['P005',70,1]],guide:'<strong>Formato requerido · regresión logística.</strong> Use una puntuación predictora cuantitativa y un criterio binario codificado exactamente como <code>0</code> y <code>1</code>.'}
  };

  async function fileToCsv(file){
    if(/\.csv$/i.test(file.name))return (await file.text()).replace(/^\uFEFF/,'');
    if(/\.(xlsx|xls)$/i.test(file.name)){
      if(!root.valistructDesktop?.parseSpreadsheet)throw new Error('La importación XLS/XLSX requiere ValiStruct Desktop; también puede usar CSV.');
      const bytes=new Uint8Array(await file.arrayBuffer());
      const parsed=await root.valistructDesktop.parseSpreadsheet(file.name,bytes);
      if(!parsed?.ok||!parsed.csv)throw new Error(parsed?.error||'No fue posible convertir el archivo de Excel.');
      return String(parsed.csv).replace(/^\uFEFF/,'');
    }
    throw new Error('Formato no compatible. Use CSV, XLSX o XLS.');
  }

  async function importParticipants(file,status){
    try{
      if(!file)throw new Error('Seleccione un archivo.');
      if(!root.ValiStructParticipantData?.setCsv)throw new Error('El almacén de participantes no está disponible.');
      if(status)status.textContent='Cargando '+file.name+'…';
      const csv=await fileToCsv(file),format=(file.name.split('.').pop()||'csv').toLowerCase();
      const s=root.ValiStructParticipantData.setCsv(csv,{source:file.name,format});
      root.dispatchEvent(new CustomEvent('valistruct:participant-data',{detail:{revision:s.revision,n:s.n,source:s.source}}));
      if(status)status.textContent='Base cargada: '+s.source+' · '+s.n+' participantes · '+s.variables.length+' variables.';
    }catch(err){if(status)status.textContent='No fue posible cargar la base: '+(err?.message||err);}
  }

  function downloadBlob(text,name){
    const a=d.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+text],{type:'text/csv;charset=utf-8'}));a.download=name;a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  async function downloadTemplate(sc,status){
    const csv=toCsv(sc.rows);
    try{
      if(root.valistructDesktop?.createSpreadsheet){
        const r=await root.valistructDesktop.createSpreadsheet('\ufeff'+csv,'xlsx',{sheetName:sc.sheet});
        if(!r?.ok||!r?.bytes)throw new Error(r?.error||'No fue posible crear XLSX.');
        const bytes=r.bytes instanceof Uint8Array?r.bytes:new Uint8Array(r.bytes);
        const a=d.createElement('a');a.href=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));a.download=sc.file+'.xlsx';a.click();
        setTimeout(()=>URL.revokeObjectURL(a.href),1000);if(status)status.textContent='Plantilla XLSX descargada para '+sc.label+'.';return;
      }
    }catch(_){ }
    downloadBlob(csv,sc.file+'.csv');if(status)status.textContent='Plantilla CSV descargada para '+sc.label+'.';
  }

  function addFileLoader(actions,anchor,statusId,id){
    if(d.getElementById(id))return;
    const label=d.createElement('label');label.id=id;label.className='file-button';label.style.display='inline-flex';label.style.alignItems='center';label.style.cursor='pointer';label.textContent='Cargar base CSV/XLSX';
    const input=d.createElement('input');input.type='file';input.accept='.csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';input.hidden=true;label.appendChild(input);
    input.addEventListener('change',()=>importParticipants(input.files?.[0],d.getElementById(statusId)));
    if(anchor)anchor.insertAdjacentElement('afterend',label);else actions.appendChild(label);
    return label;
  }

  function enhanceStability(){
    const panel=d.getElementById('stability');if(!panel||panel.dataset.v54TemplateHelp==='ready')return false;
    const form=panel.querySelector('.vs-v52-form-card'),actions=form?.querySelector('.button-row'),proc=d.getElementById('stabilityProcedure');if(!form||!actions||!proc)return false;
    panel.dataset.v54TemplateHelp='ready';
    const guide=d.createElement('div');guide.id='stabilityAdaptiveGuide';guide.className='vs-v52-context';guide.style.marginTop='12px';
    const dataStatus=d.getElementById('stabilityDataStatus');if(dataStatus)dataStatus.insertAdjacentElement('beforebegin',guide);else actions.insertAdjacentElement('beforebegin',guide);
    const openData=d.getElementById('stabilityOpenData');const loader=addFileLoader(actions,openData,'stabilityStatus','stabilityDirectLoader');
    const btn=d.createElement('button');btn.id='downloadStabilityTemplate';btn.type='button';loader?.insertAdjacentElement('afterend',btn);
    const refresh=()=>{const sc=stabilityScenarios[proc.value]||stabilityScenarios['test-retest'];guide.innerHTML=sc.guide;btn.textContent='Descargar plantilla · '+sc.label+' (XLSX)';};
    btn.addEventListener('click',()=>downloadTemplate(stabilityScenarios[proc.value]||stabilityScenarios['test-retest'],d.getElementById('stabilityStatus')));proc.addEventListener('change',refresh);refresh();return true;
  }

  function enhanceCriterion(){
    const panel=d.getElementById('criterion');if(!panel||panel.dataset.v54CriterionDataHelp==='ready')return false;
    const form=panel.querySelector('.vs-v52-form-card'),actions=form?.querySelector('.button-row'),proc=d.getElementById('criterionProcedure');if(!form||!actions||!proc)return false;
    panel.dataset.v54CriterionDataHelp='ready';
    const guide=d.createElement('div');guide.id='criterionAdaptiveGuide';guide.className='vs-v52-context';guide.style.marginTop='12px';
    const dataStatus=d.getElementById('criterionDataStatus');if(dataStatus)dataStatus.insertAdjacentElement('beforebegin',guide);else actions.insertAdjacentElement('beforebegin',guide);
    const openData=d.getElementById('criterionOpenData');const loader=addFileLoader(actions,openData,'criterionStatus','criterionDirectLoader');
    const btn=d.createElement('button');btn.id='downloadCriterionTemplate';btn.type='button';loader?.insertAdjacentElement('afterend',btn);
    const refresh=()=>{const sc=criterionScenarios[proc.value]||criterionScenarios.concurrent;guide.innerHTML=sc.guide;btn.textContent='Descargar plantilla · '+sc.label+' (XLSX)';};
    btn.addEventListener('click',()=>downloadTemplate(criterionScenarios[proc.value]||criterionScenarios.concurrent,d.getElementById('criterionStatus')));proc.addEventListener('change',refresh);refresh();return true;
  }

  function start(){enhanceStability();enhanceCriterion();let tries=0;const timer=setInterval(()=>{tries++;enhanceStability();enhanceCriterion();if(tries>80)clearInterval(timer);},150);}
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(typeof window!=='undefined'?window:null);

/* Load the isolated Stage IV performance module without changing index.html. */
(function(root){
  if(!root||!root.document||root.ValiStructPerformance)return;
  const load=()=>{
    if(root.ValiStructPerformance||document.querySelector('script[data-valistruct-performance]'))return;
    const s=document.createElement('script');s.src='performance-v54.js';s.dataset.valistructPerformance='v54';document.head.appendChild(s);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})(typeof window!=='undefined'?window:null);
