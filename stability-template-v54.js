/* ValiStruct v5.4 · Etapa IV · ayuda de formato y plantilla para Estabilidad y concordancia.
 * Mejora aislada de UX: no modifica cálculos estadísticos.
 */
(function(root){
  'use strict';
  if(!root||!root.document)return;

  const escCsv=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const templateRows=[
    ['ID','Puntaje_T1','Puntaje_T2'],
    ['P001',42,44],
    ['P002',35,36],
    ['P003',51,50],
    ['P004',28,31],
    ['P005',47,46]
  ];
  const templateCsv=templateRows.map(row=>row.map(escCsv).join(',')).join('\n');

  function downloadBlob(text,type,name){
    const blob=new Blob([text],{type});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download=name;a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  async function downloadTemplate(status){
    const name='ValiStruct_plantilla_estabilidad_test_retest.xlsx';
    try{
      if(root.valistructDesktop?.createSpreadsheet){
        const result=await root.valistructDesktop.createSpreadsheet('\ufeff'+templateCsv,'xlsx',{sheetName:'Estabilidad_test_retest'});
        if(!result?.ok||!result?.bytes)throw new Error(result?.error||'No fue posible crear el archivo XLSX.');
        const bytes=result.bytes instanceof Uint8Array?result.bytes:new Uint8Array(result.bytes);
        const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
        const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();
        setTimeout(()=>URL.revokeObjectURL(a.href),1000);
        if(status)status.textContent='Plantilla XLSX descargada. Cada fila representa al mismo participante y las mediciones T1/T2 van en columnas distintas.';
        return;
      }
      downloadBlob('\ufeff'+templateCsv,'text/csv;charset=utf-8','ValiStruct_plantilla_estabilidad_test_retest.csv');
      if(status)status.textContent='Plantilla CSV descargada. En escritorio se genera XLSX automáticamente.';
    }catch(err){
      downloadBlob('\ufeff'+templateCsv,'text/csv;charset=utf-8','ValiStruct_plantilla_estabilidad_test_retest.csv');
      if(status)status.textContent='No fue posible generar XLSX; se descargó una plantilla CSV compatible. '+(err?.message||'');
    }
  }

  function enhance(){
    const panel=document.getElementById('stability');
    if(!panel||panel.dataset.v54TemplateHelp==='ready')return false;
    const form=panel.querySelector('.vs-v52-form-card');
    const actions=form?.querySelector('.button-row');
    if(!form||!actions)return false;

    panel.dataset.v54TemplateHelp='ready';
    const guide=document.createElement('div');
    guide.className='vs-v52-context';
    guide.style.marginTop='12px';
    guide.innerHTML='<strong>Formato requerido.</strong> Use una sola base de datos: cada fila debe corresponder al mismo participante y las dos mediciones deben estar en columnas diferentes, por ejemplo <code>Puntaje_T1</code> y <code>Puntaje_T2</code>. Para test–retest, cargue esa base en el Centro de datos y después seleccione ambas columnas como Primera y Segunda medición. Si hubo una intervención destinada a cambiar el resultado entre T1 y T2, el análisis corresponde a cambio/efecto y no a estabilidad test–retest.';
    const dataStatus=document.getElementById('stabilityDataStatus');
    if(dataStatus)dataStatus.insertAdjacentElement('beforebegin',guide);else actions.insertAdjacentElement('beforebegin',guide);

    const btn=document.createElement('button');
    btn.id='downloadStabilityTemplate';btn.type='button';btn.textContent='Descargar plantilla de ejemplo (XLSX)';
    btn.addEventListener('click',()=>downloadTemplate(document.getElementById('stabilityStatus')));
    const openData=document.getElementById('stabilityOpenData');
    if(openData)openData.insertAdjacentElement('afterend',btn);else actions.appendChild(btn);
    return true;
  }

  function start(){
    if(enhance())return;
    let tries=0;
    const timer=setInterval(()=>{tries++;if(enhance()||tries>40)clearInterval(timer);},100);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(typeof window!=='undefined'?window:null);
