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

  function spreadsheetName(file){
    const original=String(file?.name||'').trim();
    if(/\.(xlsx|xls)$/i.test(original))return original;
    const base=original.replace(/\.[^.]*$/,'').trim()||'archivo';
    return `${base}.xlsx`;
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
    rows.push([],['INSTRUCCIONES','Complete únicamente las celdas de respuesta y observaciones. No cambie los encabezados de la matriz. Guarde este mismo archivo .xlsx y súbalo directamente a ValiStruct.'],[]);
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
    if(idx<0)throw new Error('No se encontró la matriz de respuestas. Conserve los encabezados Ítem y Juez/Experto 1…n.');
    const h=rows[idx].map(norm);const cols=[];
    h.forEach((x,i)=>{const m=x.match(/^(?:juez|experto)\s*(\d+)$/);if(m)cols.push({i,n:Number(m[1])});});cols.sort((a,b)=>a.n-b.n);
    if(cols.length<2)throw new Error('La matriz debe conservar al menos dos columnas de jueces/expertos.');
    cols.forEach((c,i)=>{if(c.n!==i+1)throw new Error('Las columnas de jueces/expertos deben conservar numeración consecutiva desde 1.');});
    const itemIdx=h.indexOf('item');
    const numberIdx=h.findIndex(x=>['no item','numero item','numero de item'].includes(x));
    const dataRows=[];
    for(const r of rows.slice(idx+1)){
      const row=(r||[]).map(v=>String(v??'').trim());
      const firstNonEmpty=row.find(v=>v!=='')||'';
      if(!row.some(Boolean))break;
      if(norm(firstNonEmpty)==='identificacion de expertos'||norm(row[itemIdx])==='correo/identificador opcional')break;
      if(numberIdx>=0 && !/^\d+$/.test(row[numberIdx]||''))break;
      if(!row[itemIdx])break;
      dataRows.push(r);
    }
    return{judges:cols.length,items:dataRows.length,headerIndex:idx,headers:h,dataRows};
  }

  function inferProfile(meta,matrix){
    const explicit=norm(meta['valistruct profile']);
    if(explicit)return explicit;
    const method=norm(meta['metodo']||meta['modalidad']);
    if(method.includes('lawshe')||method.includes('cvr'))return'lawshe';
    if(method.includes('delphi'))return'delphi';
    if(method.includes('aiken'))return'aiken';
    if(method.includes('cvi'))return'cvi';
    if(matrix.headers.includes('criterio')&&matrix.headers.some(x=>/^juez\s*\d+$/.test(x)))return'aiken';
    if(matrix.headers.includes('ronda')&&matrix.headers.some(x=>/^experto\s*\d+$/.test(x)))return'delphi';
    if(matrix.headers.some(x=>/^juez\s*\d+$/.test(x))){
      const values=matrix.dataRows.flatMap(r=>r.slice(0)).map(norm);
      if(values.some(v=>['esencial','util pero no esencial','no necesario'].includes(v)))return'lawshe';
      return'cvi';
    }
    return'';
  }

  async function validateUpload(file,expected){
    if(!file||typeof file.arrayBuffer!=='function')throw new Error('No se recibió un archivo de Excel válido.');
    const bytes=new Uint8Array(await file.arrayBuffer());
    if(!bytes.length)throw new Error('El archivo está vacío.');
    const r=await window.valistructDesktop.parseSpreadsheet(spreadsheetName(file),bytes);
    if(!r?.ok||typeof r.csv!=='string')throw new Error(r?.error||'No fue posible leer el archivo de Excel.');
    const rows=parseCsv(r.csv.replace(/^\uFEFF/,''));
    const meta=metadata(rows);
    const m=matrixInfo(rows);
    const profile=inferProfile(meta,m);
    if(profile&&profile!==expected)throw new Error(`La plantilla corresponde a ${profile}, no a ${expected}.`);

    const schema=String(meta['valistruct schema']||'').trim();
    if(schema&&schema!==SCHEMA)console.warn(`[ValiStruct] Esquema XLSX legado detectado (${schema}); se validará por estructura.`);

    const expectedJudges=Number(meta['numero de jueces']||meta['numero de expertos']);
    const expectedItems=Number(meta['numero de items']);
    if(Number.isFinite(expectedJudges)&&expectedJudges>0&&expectedJudges!==m.judges)throw new Error('El número de columnas de jueces/expertos no coincide con los metadatos del archivo.');
    if(Number.isFinite(expectedItems)&&expectedItems>0&&expectedItems!==m.items)throw new Error('El número de ítems no coincide con los metadatos del archivo.');
    return{profile:profile||expected,legacy:!schema,matrix:m};
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
    validateUpload(file,expected).then(result=>{
      input.dataset.valistructValidated='1';
      input.dataset.valistructLegacy=result.legacy?'1':'0';
      input.dispatchEvent(new Event('change',{bubbles:true}));
    }).catch(err=>{alert(`No fue posible importar ${expected}: ${err.message}`);input.value='';});
  },true);
})();