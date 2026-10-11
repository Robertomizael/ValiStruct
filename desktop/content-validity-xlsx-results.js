(() => {
  'use strict';
  const MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const q=id=>document.getElementById(id);
  const csvEsc=v=>`"${String(v??'').replaceAll('"','""')}"`;
  const toCsv=rows=>rows.map(r=>r.map(csvEsc).join(',')).join('\n');
  const get=name=>{try{return window.eval(name);}catch(_){return null;}};

  async function write(rows,filename){
    if(!window.valistructDesktop?.createSpreadsheet)throw new Error('El generador XLSX no está disponible.');
    const result=await window.valistructDesktop.createSpreadsheet(toCsv(rows),'xlsx',{});
    if(!result?.ok||!result.data)throw new Error(result?.error||'No fue posible crear el XLSX.');
    const blob=new Blob([new Uint8Array(result.data)],{type:MIME});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
  }

  function header(method,summary){return [
    ['VALISTRUCT · RESULTADOS DE VALIDEZ DE CONTENIDO'],
    ['Responsable','Dr. Roberto Joel Tirado Reyes'],
    ['Institución','Universidad Autónoma de Sinaloa'],
    ['Método',method],
    ['Resumen',summary],
    []
  ];}

  async function exportCvi(){
    const r=get('cviLastResults');if(!r?.rows?.length)throw new Error('Primero calcule I-CVI / S-CVI/Ave.');
    const rows=header('I-CVI / S-CVI/Ave',`S-CVI/Ave = ${Number(r.scviAve).toFixed(3)}`);
    rows.push(['Ítem','Expertos de acuerdo','N expertos','I-CVI','Orientación']);
    r.rows.forEach(x=>rows.push([x.item,x.agreement,x.n,Number(x.icvi).toFixed(3),x.status]));
    if(r.kappaRows?.length){rows.push([],['KAPPA MODIFICADO'],['Ítem','Pc','Kappa modificado']);r.kappaRows.forEach(x=>rows.push([x.item,Number(x.pc).toFixed(4),Number(x.kappa).toFixed(3)]));rows.push(['Promedio Kappa','',Number(r.meanKappa).toFixed(3)]);}
    await write(rows,'ValiStruct_resultados_I-CVI_S-CVI.xlsx');
  }

  async function exportLawshe(){
    const r=get('lawsheLastResults');if(!r?.rows?.length)throw new Error('Primero calcule CVR de Lawshe.');
    const rows=header('CVR de Lawshe',`CVR promedio = ${Number(r.meanCvr).toFixed(3)}`);rows.push(['Ítem','Ne esencial','N expertos','CVR','Orientación']);r.rows.forEach(x=>rows.push([x.item,x.essential,x.n,Number(x.cvr).toFixed(3),x.status]));await write(rows,'ValiStruct_resultados_CVR_Lawshe.xlsx');
  }

  async function exportDelphi(){
    const r=get('delphiLastResults');if(!r?.rows?.length)throw new Error('Primero evalúe el consenso Delphi.');
    const rows=header(r.mode==='modified'?'Delphi modificado':'Delphi',`${r.rounds} ronda(s); consenso en última ronda: ${r.consensusN}/${r.latest?.length||0}`);
    rows.push(['Ronda','Ítem','Mediana','Q1','Q3','IQR','Favorables','N expertos','Acuerdo %','Cambio acuerdo','Consenso','Retroalimentación']);
    r.rows.forEach(x=>rows.push([x.round,x.item,Number(x.median).toFixed(3),Number(x.q1).toFixed(3),Number(x.q3).toFixed(3),Number(x.iqr).toFixed(3),x.favorable,x.n,Number(x.agreementPct).toFixed(2),x.deltaAgreement==null?'':Number(x.deltaAgreement).toFixed(2),x.consensus?'Sí':'No',x.comment||'']));
    await write(rows,'ValiStruct_resultados_Delphi.xlsx');
  }

  function add(actionId,id,label,handler){
    const host=q(actionId);if(!host||q(id))return;const b=document.createElement('button');b.id=id;b.type='button';b.textContent=label;host.appendChild(b);b.addEventListener('click',async()=>{try{await handler();}catch(e){alert(e.message);}});
  }
  add('cviActions','downloadCviXlsxResults','Descargar resultados XLSX',exportCvi);
  add('lawsheActions','downloadLawsheXlsxResults','Descargar resultados XLSX',exportLawshe);
  add('delphiActions','downloadDelphiXlsxResults','Descargar resultados XLSX',exportDelphi);
})();
