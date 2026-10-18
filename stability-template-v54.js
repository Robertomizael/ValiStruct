/* ValiStruct v5.4 · Etapa IV · ayuda y plantillas adaptativas para Estabilidad y concordancia.
 * Mejora aislada de UX: no modifica cálculos estadísticos.
 */
(function(root){
  'use strict';
  if(!root||!root.document)return;

  const escCsv=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const scenarios={
    'test-retest':{
      label:'Test–retest / CCI cuantitativo',
      file:'ValiStruct_plantilla_estabilidad_cuantitativa',
      sheet:'Estabilidad_cuantitativa',
      rows:[['ID','Medicion_T1','Medicion_T2'],['P001',42,44],['P002',35,36],['P003',51,50],['P004',28,31],['P005',47,46]],
      guide:'<strong>Formato requerido · cuantitativo.</strong> Use una sola base de datos: cada fila representa al mismo participante y las dos mediciones numéricas van en columnas diferentes, por ejemplo <code>Medicion_T1</code> y <code>Medicion_T2</code>. Después seleccione ambas columnas como Primera y Segunda medición. Si hubo una intervención destinada a cambiar el resultado entre T1 y T2, este análisis ya no representa estabilidad test–retest.'
    },
    'icc':{
      label:'CCI configurable · cuantitativo',
      file:'ValiStruct_plantilla_estabilidad_CCI',
      sheet:'CCI_cuantitativo',
      rows:[['ID','Medicion_1','Medicion_2'],['P001',42,44],['P002',35,36],['P003',51,50],['P004',28,31],['P005',47,46]],
      guide:'<strong>Formato requerido · cuantitativo.</strong> Use una sola base: una fila por participante/unidad de análisis y una columna numérica por medición o evaluador. Para este módulo seleccione dos columnas, por ejemplo <code>Medicion_1</code> y <code>Medicion_2</code>, y configure CCI(2) o CCI(3) según el diseño.'
    },
    'kappa':{
      label:'Kappa de Cohen · nominal',
      file:'ValiStruct_plantilla_concordancia_nominal',
      sheet:'Kappa_nominal',
      rows:[['ID','Evaluador_1','Evaluador_2'],['P001','Positivo','Positivo'],['P002','Negativo','Positivo'],['P003','Positivo','Positivo'],['P004','Negativo','Negativo'],['P005','Positivo','Positivo']],
      guide:'<strong>Formato requerido · nominal.</strong> Use una sola base donde cada fila sea el mismo participante/caso y las dos columnas contengan categorías nominales de las dos mediciones o evaluadores, por ejemplo <code>Evaluador_1</code> y <code>Evaluador_2</code>. Use exactamente las mismas etiquetas de categoría en ambas columnas (p. ej., Positivo/Negativo).'
    },
    'kappa-weighted':{
      label:'Kappa ponderado · ordinal',
      file:'ValiStruct_plantilla_concordancia_ordinal',
      sheet:'Kappa_ordinal',
      rows:[['ID','Medicion_Ordinal_1','Medicion_Ordinal_2'],['P001',1,1],['P002',2,3],['P003',3,3],['P004',1,2],['P005',2,2]],
      guide:'<strong>Formato requerido · ordinal.</strong> Use una sola base donde cada fila sea el mismo participante/caso y las dos columnas contengan categorías ordinales con el mismo orden. Se recomienda codificar, por ejemplo, <code>1 = Leve</code>, <code>2 = Moderado</code>, <code>3 = Severo</code>, y conservar exactamente esa codificación en ambas mediciones.'
    }
  };

  function currentScenario(){
    const value=document.getElementById('stabilityProcedure')?.value||'test-retest';
    return scenarios[value]||scenarios['test-retest'];
  }

  function toCsv(rows){return rows.map(row=>row.map(escCsv).join(',')).join('\n');}

  function downloadBlob(text,type,name){
    const blob=new Blob([text],{type});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download=name;a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  async function downloadTemplate(status){
    const sc=currentScenario(),csv=toCsv(sc.rows),xlsxName=sc.file+'.xlsx',csvName=sc.file+'.csv';
    try{
      if(root.valistructDesktop?.createSpreadsheet){
        const result=await root.valistructDesktop.createSpreadsheet('\ufeff'+csv,'xlsx',{sheetName:sc.sheet});
        if(!result?.ok||!result?.bytes)throw new Error(result?.error||'No fue posible crear el archivo XLSX.');
        const bytes=result.bytes instanceof Uint8Array?result.bytes:new Uint8Array(result.bytes);
        const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
        const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=xlsxName;a.click();
        setTimeout(()=>URL.revokeObjectURL(a.href),1000);
        if(status)status.textContent='Plantilla XLSX descargada para '+sc.label+'.';
        return;
      }
      downloadBlob('\ufeff'+csv,'text/csv;charset=utf-8',csvName);
      if(status)status.textContent='Plantilla CSV descargada para '+sc.label+'. En escritorio se genera XLSX automáticamente.';
    }catch(err){
      downloadBlob('\ufeff'+csv,'text/csv;charset=utf-8',csvName);
      if(status)status.textContent='No fue posible generar XLSX; se descargó CSV compatible. '+(err?.message||'');
    }
  }

  function enhance(){
    const panel=document.getElementById('stability');
    if(!panel||panel.dataset.v54TemplateHelp==='ready')return false;
    const form=panel.querySelector('.vs-v52-form-card');
    const actions=form?.querySelector('.button-row');
    const proc=document.getElementById('stabilityProcedure');
    if(!form||!actions||!proc)return false;

    panel.dataset.v54TemplateHelp='ready';
    const guide=document.createElement('div');
    guide.id='stabilityAdaptiveGuide';guide.className='vs-v52-context';guide.style.marginTop='12px';
    const dataStatus=document.getElementById('stabilityDataStatus');
    if(dataStatus)dataStatus.insertAdjacentElement('beforebegin',guide);else actions.insertAdjacentElement('beforebegin',guide);

    const btn=document.createElement('button');
    btn.id='downloadStabilityTemplate';btn.type='button';
    btn.addEventListener('click',()=>downloadTemplate(document.getElementById('stabilityStatus')));
    const openData=document.getElementById('stabilityOpenData');
    if(openData)openData.insertAdjacentElement('afterend',btn);else actions.appendChild(btn);

    const refreshGuide=()=>{
      const sc=currentScenario();
      guide.innerHTML=sc.guide;
      btn.textContent='Descargar plantilla · '+sc.label+' (XLSX)';
      btn.setAttribute('aria-label','Descargar plantilla para '+sc.label);
    };
    proc.addEventListener('change',refreshGuide);
    refreshGuide();
    return true;
  }

  function start(){
    if(enhance())return;
    let tries=0;
    const timer=setInterval(()=>{tries++;if(enhance()||tries>40)clearInterval(timer);},100);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(typeof window!=='undefined'?window:null);
