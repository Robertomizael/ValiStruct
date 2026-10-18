/* ValiStruct v5.4 · Etapa IV · carga directa y plantillas.
 * Mejora aislada de UX para Estabilidad y Validez de criterio.
 * No modifica cálculos estadísticos.
 */
(function(root){
  'use strict';
  if(!root||!root.document)return;
  const d=root.document;
  const escCsv=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const csvOf=rows=>rows.map(r=>r.map(escCsv).join(',')).join('\n');

  async function fileToCsv(file){
    if(/\.csv$/i.test(file.name))return (await file.text()).replace(/^\uFEFF/,'');
    if(/\.(xlsx|xls)$/i.test(file.name)){
      if(!root.valistructDesktop?.parseSpreadsheet)throw new Error('La importación XLS/XLSX requiere ValiStruct Desktop. También puede usar CSV.');
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
      const csv=await fileToCsv(file);
      const format=(file.name.split('.').pop()||'csv').toLowerCase();
      const summary=root.ValiStructParticipantData.setCsv(csv,{source:file.name,format});
      if(status)status.textContent='Base cargada: '+summary.source+' · '+summary.n+' participantes · '+summary.variables.length+' variables.';
    }catch(err){
      if(status)status.textContent='No fue posible cargar la base: '+(err?.message||err);
    }
  }

  function downloadBlob(text,name){
    const a=d.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+text],{type:'text/csv;charset=utf-8'}));a.download=name;a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  async function downloadRows(rows,baseName,sheetName,status){
    const csv=csvOf(rows);
    try{
      if(root.valistructDesktop?.createSpreadsheet){
        const result=await root.valistructDesktop.createSpreadsheet('\ufeff'+csv,'xlsx',{sheetName});
        if(!result?.ok||!result?.bytes)throw new Error(result?.error||'No fue posible crear XLSX.');
        const bytes=result.bytes instanceof Uint8Array?result.bytes:new Uint8Array(result.bytes);
        const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
        const a=d.createElement('a');a.href=URL.createObjectURL(blob);a.download=baseName+'.xlsx';a.click();
        setTimeout(()=>URL.revokeObjectURL(a.href),1000);
        if(status)status.textContent='Plantilla XLSX descargada.';
        return;
      }
    }catch(_){ }
    downloadBlob(csv,baseName+'.csv');
    if(status)status.textContent='Plantilla CSV descargada. En ValiStruct Desktop se genera XLSX.';
  }

  function stabilityTemplate(){
    const p=d.getElementById('stabilityProcedure')?.value||'test-retest';
    if(p==='kappa')return {name:'ValiStruct_plantilla_kappa_nominal',sheet:'Kappa_nominal',rows:[['ID','Evaluador_1','Evaluador_2'],['P001','Positivo','Positivo'],['P002','Negativo','Positivo'],['P003','Positivo','Positivo'],['P004','Negativo','Negativo'],['P005','Positivo','Positivo']]};
    if(p==='kappa-weighted')return {name:'ValiStruct_plantilla_kappa_ordinal',sheet:'Kappa_ordinal',rows:[['ID','Medicion_Ordinal_1','Medicion_Ordinal_2'],['P001',1,1],['P002',2,2],['P003',3,2],['P004',1,2],['P005',3,3]]};
    if(p==='icc')return {name:'ValiStruct_plantilla_cci_cuantitativo',sheet:'CCI_cuantitativo',rows:[['ID','Medicion_1','Medicion_2'],['P001',42,44],['P002',35,36],['P003',51,50],['P004',28,31],['P005',47,46]]};
    return {name:'ValiStruct_plantilla_test_retest',sheet:'Test_retest',rows:[['ID','Medicion_T1','Medicion_T2'],['P001',42,44],['P002',35,36],['P003',51,50],['P004',28,31],['P005',47,46]]};
  }

  function criterionTemplate(){
    const p=d.getElementById('criterionProcedure')?.value||'concurrent';
    if(p==='logistic')return {name:'ValiStruct_plantilla_criterio_logistico',sheet:'Criterio_logistico',rows:[['ID','Puntaje_Instrumento','Criterio_Binario_0_1'],['P001',42,0],['P002',55,1],['P003',61,1],['P004',33,0],['P005',70,1]]};
    if(p==='linear')return {name:'ValiStruct_plantilla_criterio_regresion_lineal',sheet:'Criterio_lineal',rows:[['ID','Puntaje_Instrumento','Criterio_Cuantitativo'],['P001',42,45],['P002',55,58],['P003',61,64],['P004',33,35],['P005',70,72]]};
    const suffix=p==='predictive'?'predictivo':'concurrente';
    return {name:'ValiStruct_plantilla_criterio_'+suffix,sheet:'Criterio_'+suffix,rows:[['ID','Puntaje_Instrumento','Criterio_Externo'],['P001',42,44],['P002',55,57],['P003',61,63],['P004',33,35],['P005',70,71]]};
  }

  function addControls(panelId,statusId,kind){
    const panel=d.getElementById(panelId);if(!panel||panel.dataset.v54DirectImport==='ready')return false;
    const actions=panel.querySelector('.button-row');if(!actions)return false;
    panel.dataset.v54DirectImport='ready';

    const loadBtn=d.createElement('label');
    loadBtn.className='file-button';
    loadBtn.style.display='inline-flex';
    loadBtn.style.alignItems='center';
    loadBtn.style.cursor='pointer';
    loadBtn.textContent='Cargar base CSV/XLSX';
    const input=d.createElement('input');input.type='file';input.accept='.csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';input.hidden=true;
    loadBtn.appendChild(input);
    input.addEventListener('change',()=>importParticipants(input.files?.[0],d.getElementById(statusId)));

    const templateBtn=d.createElement('button');templateBtn.type='button';templateBtn.id=kind==='stability'?'downloadStabilitySmartTemplate':'downloadCriterionTemplate';
    function updateLabel(){
      if(kind==='stability'){
        const p=d.getElementById('stabilityProcedure')?.value;
        const labels={'test-retest':'Descargar plantilla · Test–retest (XLSX)','kappa':'Descargar plantilla · Kappa nominal (XLSX)','kappa-weighted':'Descargar plantilla · Kappa ordinal (XLSX)','icc':'Descargar plantilla · CCI (XLSX)'};
        templateBtn.textContent=labels[p]||'Descargar plantilla (XLSX)';
      }else{
        const p=d.getElementById('criterionProcedure')?.value;
        const labels={concurrent:'Descargar plantilla · Criterio concurrente (XLSX)',predictive:'Descargar plantilla · Criterio predictivo (XLSX)',linear:'Descargar plantilla · Regresión lineal (XLSX)',logistic:'Descargar plantilla · Regresión logística (XLSX)'};
        templateBtn.textContent=labels[p]||'Descargar plantilla (XLSX)';
      }
    }
    updateLabel();
    const proc=d.getElementById(kind==='stability'?'stabilityProcedure':'criterionProcedure');proc?.addEventListener('change',updateLabel);
    templateBtn.addEventListener('click',()=>{
      const t=kind==='stability'?stabilityTemplate():criterionTemplate();
      downloadRows(t.rows,t.name,t.sheet,d.getElementById(statusId));
    });

    const openData=d.getElementById(kind==='stability'?'stabilityOpenData':'criterionOpenData');
    if(openData){openData.insertAdjacentElement('afterend',loadBtn);loadBtn.insertAdjacentElement('afterend',templateBtn);}else{actions.append(loadBtn,templateBtn);}
    return true;
  }

  function enhance(){
    const a=addControls('stability','stabilityStatus','stability');
    const b=addControls('criterion','criterionStatus','criterion');
    return a&&b;
  }
  function start(){
    enhance();let tries=0;const timer=setInterval(()=>{tries++;enhance();if(tries>80)clearInterval(timer);},150);
  }
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(typeof window!=='undefined'?window:null);
