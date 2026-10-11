(() => {
  'use strict';

  const SCHEMA='content-validity-xlsx-v1';
  const MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const q=id=>document.getElementById(id);
  const norm=v=>String(v??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[._-]+/g,' ').replace(/\s+/g,' ');
  const csvEsc=v=>`"${String(v??'').replaceAll('"','""')}"`;
  const toCsv=rows=>rows.map(r=>r.map(csvEsc).join(',')).join('\n');

  function parseCsv(text){
    const rows=[];let row=[],cell='',quoted=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i],next=text[i+1];
      if(quoted){if(ch==='"'&&next==='"'){cell+='"';i++;}else if(ch==='"')quoted=false;else cell+=ch;}
      else if(ch==='"')quoted=true;else if(ch===','){row.push(cell);cell='';}else if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell='';}else if(ch!=='\r')cell+=ch;
    }
    row.push(cell);if(row.some(x=>String(x).trim()!==''))rows.push(row);return rows;
  }

  async function save(rows,filename){
    if(!window.valistructDesktop?.createSpreadsheet)throw new Error('El generador XLSX de ValiStruct no está disponible.');
    const r=await window.valistructDesktop.createSpreadsheet(toCsv(rows),'xlsx',{});
    if(!r?.ok||!r.data)throw new Error(r?.error||'No fue posible crear el archivo XLSX.');
    const blob=new Blob([new Uint8Array(r.data)],{type:MIME});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
  }

  function head(profile,method,purpose,meta){
    const rows=[
      ['VALISTRUCT · VALIDACIÓN DE CONTENIDO POR EXPERTOS'],
      ['VALISTRUCT_PROFILE',profile],['VALISTRUCT_SCHEMA',SCHEMA],
      ['Responsable','Dr. Roberto Joel Tirado Reyes'],['Institución','Universidad Autónoma de Sinaloa'],['Facultad','Facultad de Enfermería Culiacán'],
      ['Método',method],['Propósito',purpose]
    ];
    Object.entries(meta).forEach(([k,v])=>rows.push([k,v]));
    rows.push([],['INSTRUCCIONES','Complete únicamente las celdas de respuesta y observaciones. No cambie VALISTRUCT_PROFILE, VALISTRUCT_SCHEMA ni los encabezados de la matriz. Guarde este mismo archivo .xlsx y súbalo directamente a ValiStruct.'],[]);
    return rows;
  }

  function appendExperts(rows,count,prefix){
    rows.push([],['IDENTIFICACIÓN DE EXPERTOS'],['Columna','Nombre o código del experto','Correo/identificador opcional']);
    for(let i=1;i<=count;i++)rows.push([`${prefix} ${i}`,'','']);
  }

  function names(selector,items){return Array.from({length:items},(_,i)=>document.querySelector(`${selector}[data-item="${i+1}"]`)?.value?.trim()||`Ítem ${i+1}`);}

  async function download(profile){
    if(profile==='cvi'){
      const judges=Math.max(2,Number(q('cviJudgeCount')?.value||6)),items=Math.max(1,Number(q('cviItemCount')?.value||5)),min=Number(q('cviScaleMin')?.value||1),max=Number(q('cviScaleMax')?.value||4),rel=Number(q('cviRelevantFrom')?.value||3);
      const rows=head('cvi','I-CVI / S-CVI/Ave','Valorar la relevancia de cada ítem para calcular I-CVI por ítem y S-CVI/Ave para la escala.',{'Número de jueces':judges,'Número de ítems':items,'Escala mínima':min,'Escala máxima':max,'Relevante desde':rel,'Opciones válidas':`${min} a ${max}`});
      rows.push(['Dimensión','No. ítem','Ítem',...Array.from({length:judges},(_,i)=>`Juez ${i+1}`),'Observaciones']);
      names('.cvi-item-name',items).forEach((name,i)=>rows.push(['',i+1,name,...Array(judges).fill(''),'']));appendExperts(rows,judges,'Juez');
      return save(rows,'ValiStruct_plantilla_I-CVI_S-CVI.xlsx');
    }
    if(profile==='lawshe'){
      const judges=Math.max(2,Number(q('lawsheJudgeCount')?.value||10)),items=Math.max(1,Number(q('lawsheItemCount')?.value||5));
      const rows=head('lawshe','CVR de Lawshe','Clasificar cada ítem según su esencialidad para calcular CVR.',{'Número de jueces':judges,'Número de ítems':items,'Opciones válidas':'Esencial | Útil pero no esencial | No necesario'});
      rows.push(['Dimensión','No. ítem','Ítem',...Array.from({length:judges},(_,i)=>`Juez ${i+1}`),'Observaciones']);
      names('.lawshe-item-name',items).forEach((name,i)=>rows.push(['',i+1,name,...Array(judges).fill(''),'']));appendExperts(rows,judges,'Juez');
      return save(rows,'ValiStruct_plantilla_CVR_Lawshe.xlsx');
    }
    const judges=Math.max(3,Number(q('delphiJudgeCount')?.value||8)),items=Math.max(1,Number(q('delphiItemCount')?.value||5)),min=Number(q('delphiScaleMin')?.value||1),max=Number(q('delphiScaleMax')?.value||5),round=Math.max(1,document.querySelectorAll('.delphi-round').length||1),mode=q('delphiMode')?.value==='modified'?'Delphi modificado':'Delphi';
    const rows=head('delphi',mode,'Recoger una ronda de consenso de expertos y conservar la trazabilidad entre rondas.',{'Modalidad':mode,'Ronda':round,'Número de expertos':judges,'Número de ítems':items,'Escala mínima':min,'Escala máxima':max,'Opciones válidas':`${min} a ${max}`});
    rows.push(['Dimensión','No. ítem','Ítem','Ronda',...Array.from({length:judges},(_,i)=>`Experto ${i+1}`),'Observaciones']);
    const itemNames=Array.from({length:items},(_,i)=>document.querySelector(`.delphi-item-name[data-round="${round}"][data-item="${i+1}"]`)?.value?.trim()||`Ítem ${i+1}`);
    itemNames.forEach((name,i)=>rows.push(['',i+1,name,round,...Array(judges).fill(''),'']));appendExperts(rows,judges,'Experto');
    return save(rows,`ValiStruct_plantilla_${mode.replaceAll(' ','_')}_Ronda_${round}.xlsx`);
  }

  function metadata(rows){const out={};for(const r of rows.slice(0,30)){if(r?.length>=2&&String(r[0]).trim())out[norm(r[0])]=String(r[1]??'').trim();}return out;}
  function matrixInfo(rows){
    const idx=rows.findIndex(r=>{const h=(r||[]).map(norm);return h.includes('item')&&h.some(x=>/^(?:juez|experto)\s*\d+$/.test(x));});
    if(idx<0)throw new Error('No se encontró la matriz de respuestas. Los encabezados pudieron ser modificados.');
    const h=rows[idx].map(norm);const cols=[];
    h.forEach((x,i)=>{const m=x.match(/^(?:juez|experto)\s*(\d+)$/);if(m)cols.push({i,n:Number(m[1])});});cols.sort((a,b)=>a.n-b.n);
    if(cols.length<2)throw new Error('La matriz debe conservar al menos dos columnas de jueces/expertos.');
    cols.forEach((c,i)=>{if(c.n!==i+1)throw new Error('Las columnas de jueces/expertos deben conservar numeración consecutiva desde 1.');});
    const itemIdx=h.indexOf('item');const items=rows.slice(idx+1).filter(r=>String(r?.[itemIdx]??'').trim()).length;
    return{judges:cols.length,items};
  }

  async function validateUpload(file,expected){
    if(!/\.xlsx$/i.test(file.name))throw new Error('Use una plantilla .xlsx generada por ValiStruct.');
    const r=await window.valistructDesktop.parseSpreadsheet(file.name,new Uint8Array(await file.arrayBuffer()));
    if(!r?.ok||typeof r.csv!=='string')throw new Error(r?.error||'No fue posible leer el XLSX.');
    const rows=parseCsv(r.csv.replace(/^\uFEFF/,''));const meta=metadata(rows);const profile=norm(meta['valistruct profile']);const schema=String(meta['valistruct schema']||'').trim();
    if(profile!==expected)throw new Error(`La plantilla corresponde a ${profile||'un perfil no identificado'}, no a ${expected}.`);
    if(schema!==SCHEMA)throw new Error('La plantilla no corresponde al esquema XLSX vigente de ValiStruct. Descargue una plantilla nueva.');
    const m=matrixInfo(rows);const expectedJudges=Number(meta['numero de jueces']||meta['numero de expertos']);const expectedItems=Number(meta['numero de items']);
    if(Number.isFinite(expectedJudges)&&expectedJudges!==m.judges)throw new Error('El número de columnas de jueces/expertos fue modificado respecto de la plantilla original.');
    if(Number.isFinite(expectedItems)&&expectedItems!==m.items)throw new Error('El número de ítems fue modificado respecto de la plantilla original.');
  }

  const downloads={cviDownloadXlsx:'cvi',lawsheDownloadXlsx:'lawshe',delphiDownloadXlsx:'delphi'};
  document.addEventListener('click',e=>{
    const profile=downloads[e.target?.id];if(!profile)return;
    e.preventDefault();e.stopImmediatePropagation();download(profile).catch(err=>alert(err.message));
  },true);

  const uploads={cviUploadXlsx:'cvi',lawsheUploadXlsx:'lawshe',delphiUploadXlsx:'delphi'};
  document.addEventListener('change',e=>{
    const input=e.target,expected=uploads[input?.id];if(!expected)return;
    if(input.dataset.valistructValidated==='1'){delete input.dataset.valistructValidated;return;}
    e.stopImmediatePropagation();const file=input.files?.[0];if(!file)return;
    validateUpload(file,expected).then(()=>{input.dataset.valistructValidated='1';input.dispatchEvent(new Event('change',{bubbles:true}));}).catch(err=>{alert(`No fue posible importar ${expected}: ${err.message}`);input.value='';});
  },true);
})();