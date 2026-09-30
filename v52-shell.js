/* ValiStruct v5.3 · Fase 1
 * Navegación científica reversible: todos los botones heredados permanecen
 * dentro de .nav antes de que app.js registre listeners. Solo cambia su
 * visibilidad y la forma de acceso.
 */
(function () {
  'use strict';
  const nav=document.querySelector('nav.nav');
  const main=document.getElementById('mainContent');
  if(!nav || !main || nav.dataset.v53Ready==='yes')return;

  document.body.classList.add('vs-v52','vs-v53');
  nav.dataset.v52Ready='yes';
  nav.dataset.v53Ready='yes';
  nav.dataset.valistructNav='v5';

  const externalModules=[
    {id:'stability',title:'Estabilidad y concordancia',
      subtitle:'Test–retest, concordancia entre evaluadores e instrumentos',
      procedures:[
        {value:'test-retest',label:'Estabilidad test–retest (CCI / correlación)'},
        {value:'kappa',label:'Concordancia categórica (kappa de Cohen)'},
        {value:'kappa-weighted',label:'Concordancia ordinal (kappa ponderado)'},
        {value:'icc',label:'Concordancia cuantitativa (CCI configurable)'}],
      description:'La correlación mide asociación; el CCI y kappa permiten evaluar concordancia según el tipo de dato.'},
    {id:'criterion',title:'Validez de criterio',
      subtitle:'Evidencia concurrente y predictiva frente a un criterio externo',
      procedures:[
        {value:'concurrent',label:'Criterio concurrente · correlación'},
        {value:'predictive',label:'Criterio predictivo · correlación'},
        {value:'linear',label:'Regresión lineal'},
        {value:'logistic',label:'Regresión logística'}],
      description:'Seleccione un criterio externo y documente si se mide simultáneamente o en un momento posterior.'},
    {id:'performance',title:'Rendimiento y baremación',
      subtitle:'Curvas ROC, umbrales de decisión y normas descriptivas',
      procedures:[
        {value:'roc',label:'ROC / AUC · criterio binario'},
        {value:'youden',label:'Umbral mediante índice de Youden'},
        {value:'norms',label:'Percentiles y puntuaciones normalizadas'},
        {value:'bands',label:'Bandas descriptivas / semáforo configurable'}],
      description:'Un punto de corte necesita criterio externo. Los percentiles y las bandas descriptivas no equivalen a umbrales clínicos.'}
  ];

  const original=[...nav.querySelectorAll('button[data-section]')];
  const byId=new Map(original.map(button=>[button.dataset.section,button]));

  // Los tres espacios externos son navegación real, aunque sus motores aún
  // no calculan. Se crean antes de app.js para recibir el listener estándar.
  externalModules.forEach(module=>{
    if(!document.getElementById(module.id)){
      const section=document.createElement('section');
      section.id=module.id;
      section.className='panel vs-v52-module';
      section.innerHTML=`
        <div class="vs-v52-breadcrumb">Inicio <span>›</span> Validación externa <span>›</span> ${module.title}</div>
        <div class="vs-v52-module-header">
          <div><span class="vs-v52-eyebrow">ETAPA II · VALIDACIÓN EXTERNA</span>
          <h2>${module.title}</h2><p>${module.subtitle}</p></div>
          <span class="vs-v52-status vs-v53-preparing">En preparación</span>
        </div>
        <div class="vs-v52-context">${module.description}</div>
        <div class="vs-v52-form-card">
          <div class="vs-v52-card-heading"><span class="vs-v52-step">01</span>
            <div><h3>Prepare el análisis</h3><p>Seleccione las variables y documente la configuración metodológica.</p></div>
          </div>
          <div class="vs-v52-form-grid">
            <label>Procedimiento<select class="vs-v52-procedure">${module.procedures.map(p=>`<option value="${p.value}">${p.label}</option>`).join('')}</select></label>
            <label>Variable o puntuación principal<input class="vs-v52-variable" type="text" placeholder="Ej.: Total_instrumento"></label>
            <label>Variable de comparación o criterio<input class="vs-v52-reference" type="text" placeholder="Ej.: Retest_total / Diagnóstico"></label>
            <label>Variable identificadora<input class="vs-v52-join" type="text" placeholder="Ej.: ID (para unir bases)"></label>
          </div>
          <div class="vs-v52-linked-data" role="status">No se ha seleccionado una base de participantes.</div>
          <div class="vs-v52-actions">
            <button type="button" class="vs-v52-outline vs-v52-open-data">Abrir Centro de datos</button>
            <button type="button" class="vs-v52-primary vs-v52-save">Guardar configuración en esta sesión</button>
          </div>
          <p class="vs-v52-method-note"><strong>Este módulo aún no realiza cálculos.</strong> Los procedimientos estadísticos y las exportaciones se habilitarán después de su implementación y contraste con R. No se muestran estimaciones simuladas.</p>
          <div class="vs-v52-config-status" role="status" aria-live="polite"></div>
        </div>
        <details class="vs-v52-help"><summary>Ayuda metodológica y criterios de interpretación</summary>
          <p>${module.description} Los resultados deberán incluir tamaños de muestra, manejo de faltantes, parámetros del procedimiento e intervalos de confianza cuando correspondan.</p>
        </details>`;
      main.appendChild(section);
    }
    if(!byId.has(module.id)){
      const button=document.createElement('button');
      button.type='button';
      button.dataset.section=module.id;
      button.textContent=module.title;
      byId.set(module.id,button);
    }
  });

  // Fuente única de clasificación para Fase 1.
  const NAV_MODULES=Object.freeze([
    {id:'inicio',label:'Inicio',visibility:'visible',order:1},

    {id:'dataimport',label:'Base de participantes',visibility:'visible',group:'data',order:10},
    {id:'diagnostics',label:'Diagnóstico de datos',visibility:'visible',group:'data',order:20},
    {id:'multidiag',label:'Diagnóstico multivariado',visibility:'visible',group:'data',order:30},
    {id:'missingpro',label:'Datos faltantes',visibility:'visible',group:'data',order:40},

    {id:'aiken',label:'Validez de contenido · V de Aiken',visibility:'visible',group:'internal',order:10},
    {id:'efa',label:'Análisis factorial exploratorio',visibility:'visible',group:'internal',order:20},
    {id:'cfa',label:'Análisis factorial confirmatorio',visibility:'visible',group:'internal',order:30},
    {id:'reliability',label:'Fiabilidad',visibility:'visible',group:'internal',order:40},

    {id:'stability',label:'Estabilidad y concordancia',visibility:'visible',group:'external',status:'preparing',order:10},
    {id:'criterion',label:'Validez de criterio',visibility:'visible',group:'external',status:'preparing',order:20},
    {id:'performance',label:'Rendimiento y baremación',visibility:'visible',group:'external',status:'preparing',order:30},

    {id:'motorpro',label:'Motor Pro · R/lavaan',visibility:'visible',order:50},
    {id:'resultcenter',label:'Resultados',visibility:'visible',order:60},
    {id:'projects',label:'Proyectos',visibility:'visible',order:70},
    {id:'methodguide',label:'Ayuda metodológica',visibility:'visible',order:80},
    {id:'privacy',label:'Configuración',visibility:'visible',order:90},
    {id:'acerca',label:'Acerca de ValiStruct',visibility:'visible',order:100},

    {id:'legacyimport',label:'Importar SAV / DTA',visibility:'integrated',parent:'dataimport',order:10},

    {id:'advanced',label:'Calidad de medición',visibility:'integrated',parent:'motorpro',order:10},
    {id:'latencia',label:'Constructor visual · Latencia',visibility:'integrated',parent:'motorpro',order:20},
    {id:'syntaxpro',label:'Sintaxis avanzada',visibility:'integrated',parent:'motorpro',order:30},
    {id:'templates',label:'Plantillas',visibility:'integrated',parent:'motorpro',order:40},
    {id:'modelcheck',label:'Diagnóstico del modelo',visibility:'integrated',parent:'motorpro',order:50},
    {id:'modelcompare',label:'Comparar modelos',visibility:'integrated',parent:'motorpro',order:60},
    {id:'estimadorguide',label:'Asistente de estimador',visibility:'integrated',parent:'motorpro',order:70},
    {id:'samplesize',label:'Tamaño muestral',visibility:'integrated',parent:'motorpro',order:80},
    {id:'semmontecarlo',label:'Monte Carlo SEM',visibility:'integrated',parent:'motorpro',order:90},

    {id:'qualitydashboard',label:'Resumen de validación',visibility:'integrated',parent:'resultcenter',order:10},
    {id:'articletables',label:'Tablas para artículo',visibility:'integrated',parent:'resultcenter',order:20},
    {id:'conclusionassistant',label:'Interpretación',visibility:'integrated',parent:'resultcenter',order:30},
    {id:'reportapa',label:'Reporte APA 7',visibility:'integrated',parent:'resultcenter',order:40},
    {id:'finalcheck',label:'Checklist final',visibility:'integrated',parent:'resultcenter',order:50},
    {id:'journalready',label:'Preparación para revista',visibility:'integrated',parent:'resultcenter',order:60},

    {id:'guidedproject',label:'Ruta guiada',visibility:'integrated',parent:'inicio',order:10},
    {id:'validacion',label:'Ruta integral de validación',visibility:'integrated',parent:'inicio',order:20},
    {id:'assistantflow',label:'Asistente paso a paso',visibility:'integrated',parent:'inicio',order:30},

    {id:'guia',label:'Guía de validación',visibility:'integrated',parent:'methodguide',order:10},
    {id:'helpcenter',label:'Centro de ayuda',visibility:'integrated',parent:'methodguide',order:20},
    {id:'referencias',label:'Referencias',visibility:'integrated',parent:'methodguide',order:30},
    {id:'userdocs',label:'Documentación',visibility:'integrated',parent:'methodguide',order:40},

    {id:'history',label:'Historial',visibility:'integrated',parent:'projects',order:10},
    {id:'migration',label:'Migración',visibility:'integrated',parent:'projects',order:20},
    {id:'encryption',label:'Cifrado',visibility:'integrated',parent:'projects',order:30},

    {id:'profiles',label:'Perfil y preferencias',visibility:'integrated',parent:'privacy',order:10},
    {id:'appsettings',label:'Preferencias de aplicación',visibility:'integrated',parent:'privacy',order:20},
    {id:'accessibility',label:'Accesibilidad',visibility:'integrated',parent:'privacy',order:30},
    {id:'advancedsettings',label:'Dispositivo / PWA',visibility:'integrated',parent:'privacy',order:40},
    {id:'systemcheck',label:'Estado del sistema',visibility:'integrated',parent:'privacy',order:50},
    {id:'updates',label:'Actualizaciones y versión',visibility:'integrated',parent:'privacy',order:60},

    {id:'auth',visibility:'admin'},{id:'oidc',visibility:'admin'},
    {id:'teams',visibility:'admin'},{id:'institutionlib',visibility:'admin'},
    {id:'sync',visibility:'admin'},{id:'versions',visibility:'admin'},
    {id:'peerreview',visibility:'admin'},{id:'activitylog',visibility:'admin'},
    {id:'notifications',visibility:'admin'},{id:'conflicts',visibility:'admin'},
    {id:'tasks',visibility:'admin'},{id:'collabexport',visibility:'admin'},
    {id:'approvals',visibility:'admin'},{id:'auditpackage',visibility:'admin'},
    {id:'adminpanel',visibility:'admin'},{id:'servermonitor',visibility:'admin'},
    {id:'backuprestore',visibility:'admin'},{id:'scheduledbackup',visibility:'admin'},
    {id:'serverwizard',visibility:'admin'},{id:'incidents',visibility:'admin'},
    {id:'telemetry',visibility:'admin'},{id:'installer',visibility:'admin'},

    {id:'regression',visibility:'qa'},{id:'e2e',visibility:'qa'},
    {id:'backendtests',visibility:'qa'},{id:'loadtesting',visibility:'qa'},
    {id:'a11yaudit',visibility:'qa'},{id:'betaready',visibility:'qa'},
    {id:'betametrics',visibility:'qa'},{id:'releasecandidate',visibility:'qa'},
    {id:'securityreview',visibility:'qa'},{id:'releases',visibility:'qa'},
    {id:'kanban',visibility:'qa',deprecated:true}
  ]);
  window.ValiStructNavModules=NAV_MODULES;
  const moduleById=new Map(NAV_MODULES.map(module=>[module.id,module]));

  // Un módulo nuevo nunca se expone accidentalmente al investigador: CI debe
  // detectarlo y clasificarlo antes de publicar.
  for(const id of byId.keys()){
    if(!moduleById.has(id)){
      console.warn('[ValiStruct] módulo sin clasificación, ocultado como QA:',id);
      moduleById.set(id,{id,visibility:'qa',deprecated:true});
    }
  }

  const icon=name=>({
    home:'⌂',database:'▤',internal:'◇',external:'◎',motor:'⌘',
    report:'▧',project:'▣',help:'?',settings:'⚙',about:'ⓘ',admin:'◆'
  })[name]||'◦';
  const groups={
    data:{name:'Centro de datos',glyph:icon('database'),open:false},
    internal:{name:'Validación interna',glyph:icon('internal'),open:true},
    external:{name:'Validación externa',glyph:icon('external'),open:false}
  };

  const decorateButton=(button,module)=>{
    button.dataset.vsVisibility=module.visibility;
    if(module.parent)button.dataset.vsParent=module.parent;
    if(module.status)button.dataset.vsStatus=module.status;
    if(module.label){
      if(module.status==='preparing'){
        button.innerHTML='<span>'+module.label+'</span><small class="vs-v53-nav-status">En preparación</small>';
      }else button.textContent=module.label;
    }
    button.classList.add('vs-v52-item');
  };
  byId.forEach((button,id)=>decorateButton(button,moduleById.get(id)));

  nav.replaceChildren();
  nav.classList.add('nav-v52','nav-v53');
  nav.setAttribute('aria-label','Navegación científica');

  const brand=document.createElement('div');
  brand.className='vs-v52-brand';
  brand.innerHTML='<span class="vs-v52-brand-symbol" aria-hidden="true">V</span><div><strong>ValiStruct</strong><small>Plataforma científica</small></div>';
  nav.appendChild(brand);

  const groupElements=[];
  const appendDirect=(id,glyph,className='vs-v53-direct')=>{
    const button=byId.get(id);if(!button)return;
    String(className||'').split(/\s+/).filter(Boolean).forEach(token=>button.classList.add(token));
    if(glyph)button.insertAdjacentHTML('afterbegin','<span class="vs-v53-direct-icon" aria-hidden="true">'+glyph+'</span>');
    nav.appendChild(button);
  };

  appendDirect('inicio',icon('home'),'vs-v52-nav-home vs-v53-direct');

  Object.entries(groups).forEach(([groupId,meta])=>{
    const modules=NAV_MODULES.filter(m=>m.visibility==='visible'&&m.group===groupId)
      .sort((a,b)=>(a.order||0)-(b.order||0));
    const wrap=document.createElement('details');
    wrap.className='vs-v52-group vs-v53-group';
    wrap.dataset.vsGroup=groupId;
    wrap.open=meta.open;
    const summary=document.createElement('summary');
    summary.innerHTML='<span class="vs-v52-group-icon" aria-hidden="true">'+meta.glyph+'</span><span>'+meta.name+'</span><span class="vs-v52-chevron" aria-hidden="true">⌄</span>';
    wrap.appendChild(summary);
    const items=document.createElement('div');items.className='vs-v52-group-items';
    modules.forEach(module=>{const button=byId.get(module.id);if(button)items.appendChild(button);});
    wrap.appendChild(items);nav.appendChild(wrap);groupElements.push(wrap);
    wrap.addEventListener('toggle',()=>{if(wrap.open)groupElements.forEach(other=>{if(other!==wrap)other.open=false;});});
  });

  appendDirect('motorpro',icon('motor'),'vs-v52-motor vs-v53-direct');
  appendDirect('resultcenter',icon('report'));
  appendDirect('projects',icon('project'));
  appendDirect('methodguide',icon('help'));
  appendDirect('privacy',icon('settings'));
  appendDirect('acerca',icon('about'));

  // Administrador: presente en el DOM, fuera de la experiencia científica.
  const admin=document.createElement('details');
  admin.className='vs-v52-group vs-v53-admin-group';
  admin.hidden=true;
  admin.innerHTML='<summary><span class="vs-v52-group-icon" aria-hidden="true">'+icon('admin')+'</span><span>Herramientas institucionales</span><span class="vs-v52-chevron">⌄</span></summary>';
  const adminItems=document.createElement('div');adminItems.className='vs-v52-group-items';
  NAV_MODULES.filter(m=>m.visibility==='admin').forEach(module=>{
    const button=byId.get(module.id);if(button)adminItems.appendChild(button);
  });
  admin.appendChild(adminItems);nav.appendChild(admin);groupElements.push(admin);

  // Los integrados y QA permanecen dentro de .nav para que app.js registre sus
  // listeners. Solo las franjas del módulo padre disparan los integrados.
  const integratedStore=document.createElement('div');
  integratedStore.className='vs-v53-integrated-store';integratedStore.hidden=true;
  NAV_MODULES.filter(m=>m.visibility==='integrated').forEach(module=>{
    const button=byId.get(module.id);if(button)integratedStore.appendChild(button);
  });
  nav.appendChild(integratedStore);

  const qaStore=document.createElement('div');
  qaStore.className='vs-v53-qa-store';qaStore.hidden=true;
  NAV_MODULES.filter(m=>m.visibility==='qa').forEach(module=>{
    const button=byId.get(module.id);if(button)qaStore.appendChild(button);
  });
  nav.appendChild(qaStore);

  const footer=document.createElement('div');
  footer.className='vs-v52-sidebar-credit';
  footer.innerHTML='<strong>Dr. Roberto Joel Tirado Reyes</strong><span>Autor conceptual y director científico</span>';
  nav.appendChild(footer);

  // Portada breve.
  const initial=document.getElementById('inicio');
  if(initial){
    const dashboard=document.createElement('div');
    dashboard.className='vs-v52-dashboard';
    dashboard.innerHTML=`
      <div class="vs-v52-welcome">
        <div><span class="vs-v52-eyebrow">VALISTRUCT · ESPACIO DE INVESTIGACIÓN</span>
          <h2>Su investigación, paso a paso.</h2>
          <p>Organice sus datos, construya evidencia de validación y recupere sus resultados desde un mismo espacio de trabajo.</p>
          <div class="vs-v52-hero-actions">
            <button type="button" data-vs-target="guidedproject" class="vs-v52-primary">Nuevo proyecto <span aria-hidden="true">↗</span></button>
            <button type="button" data-vs-target="projects" class="vs-v52-outline">Abrir proyecto</button>
          </div>
        </div><div class="vs-v52-hero-mark" aria-hidden="true"><span>V</span><span>✧</span></div>
      </div>
      <div class="vs-v52-overview">
        <div class="vs-v52-overview-title"><h3>¿En qué desea trabajar?</h3><p>Seleccione una actividad para abrir únicamente ese módulo.</p></div>
        <div class="vs-v52-quick-grid">
          <button type="button" data-vs-target="dataimport"><span class="vs-v52-quick-icon">▤</span><strong>Importar datos</strong><small>Participantes, ítems y dimensiones</small><span class="vs-v52-link-arrow">↗</span></button>
          <button type="button" data-vs-target="aiken"><span class="vs-v52-quick-icon">◇</span><strong>Validación interna</strong><small>Contenido, AFE, AFC y fiabilidad</small><span class="vs-v52-link-arrow">↗</span></button>
          <button type="button" data-vs-target="stability"><span class="vs-v52-quick-icon">◎</span><strong>Validación externa</strong><small><b class="vs-v53-home-status">En preparación</b> · estabilidad, criterio y rendimiento</small><span class="vs-v52-link-arrow">↗</span></button>
          <button type="button" data-vs-target="resultcenter"><span class="vs-v52-quick-icon">▧</span><strong>Resultados</strong><small>Tablas, informes y exportación</small><span class="vs-v52-link-arrow">↗</span></button>
        </div>
      </div>
      <div class="vs-v52-home-bottom"><span class="vs-v52-live-dot"></span><span>Motor Pro disponible desde el menú lateral. V de Aiken utiliza una base independiente de jueces expertos.</span></div>`;
    initial.insertBefore(dashboard,initial.firstChild);
    initial.classList.add('vs-v52-home');
  }

  const openTarget=id=>nav.querySelector('button[data-section="'+id+'"]')?.click();
  document.querySelectorAll('[data-vs-target]').forEach(button=>{
    button.addEventListener('click',()=>openTarget(button.dataset.vsTarget));
  });

  // Franjas compactas: los módulos integrados siguen disponibles sin ocupar
  // espacio en el menú principal.
  const integratedByParent=new Map();
  NAV_MODULES.filter(m=>m.visibility==='integrated').forEach(module=>{
    if(!integratedByParent.has(module.parent))integratedByParent.set(module.parent,[]);
    integratedByParent.get(module.parent).push(module);
  });
  integratedByParent.forEach((modules,parentId)=>{
    const panel=document.getElementById(parentId);if(!panel)return;
    const strip=document.createElement('div');
    strip.className='vs-v53-tools';
    strip.setAttribute('aria-label','Herramientas de este módulo');
    strip.innerHTML='<div class="vs-v53-tools-title"><strong>Herramientas de este módulo</strong><small>Funciones relacionadas, disponibles sin saturar la navegación.</small></div><div class="vs-v53-tools-actions"></div>';
    const actions=strip.querySelector('.vs-v53-tools-actions');
    modules.sort((a,b)=>(a.order||0)-(b.order||0)).forEach(module=>{
      const button=document.createElement('button');
      button.type='button';button.dataset.vsTarget=module.id;
      button.textContent=module.label||byId.get(module.id)?.textContent||module.id;
      button.addEventListener('click',()=>openTarget(module.id));
      actions.appendChild(button);
    });
    if(parentId==='inicio'){
      panel.querySelector('.vs-v52-dashboard')?.appendChild(strip);
    }else{
      const heading=panel.querySelector('.section-heading,.vs-v52-module-header');
      if(heading)heading.insertAdjacentElement('afterend',strip);
      else panel.insertBefore(strip,panel.firstChild);
    }
  });

  // Interruptor visual del modo institucional. El backend permanece cerrado
  // salvo VALISTRUCT_INSTITUTIONAL_MODE=true; ocultar no se usa como seguridad.
  const privacy=document.getElementById('privacy');
  if(privacy){
    const control=document.createElement('div');
    control.className='vs-v53-institutional-control';
    control.innerHTML='<label><input id="institutionalUiToggle" type="checkbox"> Mostrar herramientas institucionales</label><p>Este interruptor solo muestra accesos administrativos. Las rutas del backend permanecen bloqueadas salvo que el administrador habilite explícitamente el modo institucional.</p>';
    const tools=privacy.querySelector('.vs-v53-tools');
    if(tools)tools.insertAdjacentElement('afterend',control);else privacy.insertBefore(control,privacy.firstChild);
    const toggle=control.querySelector('#institutionalUiToggle');
    const setAdminVisible=value=>{
      admin.hidden=!value;
      toggle.checked=value;
      try{localStorage.setItem('valistruct_institutional_ui',value?'yes':'no');}catch(_){}
    };
    let initialAdmin=false;
    try{initialAdmin=localStorage.getItem('valistruct_institutional_ui')==='yes';}catch(_){}
    setAdminVisible(initialAdmin);
    toggle.addEventListener('change',()=>setAdminVisible(toggle.checked));
  }

  const activateGroup=()=>{
    nav.querySelectorAll('.vs-v53-parent-active').forEach(button=>button.classList.remove('vs-v53-parent-active'));
    const active=nav.querySelector('button[data-section].active');
    if(!active)return;
    const module=moduleById.get(active.dataset.section);
    let visual=active;
    if(module?.visibility==='integrated' && module.parent){
      visual=nav.querySelector('button[data-section="'+module.parent+'"]')||active;
      visual.classList.add('vs-v53-parent-active');
    }
    const parent=visual.closest('details');
    if(parent && !parent.open)parent.open=true;
    const bar=document.querySelector('.vs-v52-current-module');
    if(bar)bar.textContent=module?.label||active.textContent.trim()||'Inicio';
  };
  nav.addEventListener('click',event=>{if(event.target.closest('button[data-section]'))setTimeout(activateGroup,0);});
  const observer=new MutationObserver(activateGroup);
  nav.querySelectorAll('button[data-section]').forEach(button=>observer.observe(button,{attributes:true,attributeFilter:['class']}));

  const current=document.createElement('div');
  current.className='vs-v52-current';
  current.innerHTML='<span class="vs-v52-current-dot"></span><span class="vs-v52-current-module">Inicio</span>';
  document.querySelector('.topbar')?.appendChild(current);
  activateGroup();

  externalModules.forEach(module=>{
    const panel=document.getElementById(module.id);
    const status=panel.querySelector('.vs-v52-linked-data');
    const refresh=()=>{
      const summary=window.ValiStructParticipantData?.summary;
      status.textContent=summary
        ?'Base disponible: '+summary.source+' · '+summary.n+' participantes · '+summary.variables.length+' variables. Verifique la correspondencia por ID antes de combinar mediciones.'
        :'Sin base compartida. Importe participantes desde el Centro de datos.';
    };
    panel.querySelector('.vs-v52-open-data').addEventListener('click',()=>openTarget('dataimport'));
    panel.querySelector('.vs-v52-save').addEventListener('click',()=>{
      const procedure=panel.querySelector('.vs-v52-procedure');
      const variable=panel.querySelector('.vs-v52-variable').value.trim();
      const reference=panel.querySelector('.vs-v52-reference').value.trim();
      const join=panel.querySelector('.vs-v52-join').value.trim();
      const feedback=panel.querySelector('.vs-v52-config-status');
      if(!variable||!reference){feedback.textContent='Especifique la variable principal y la variable de comparación.';return;}
      const summary=window.ValiStructParticipantData?.summary;
      if(summary && (!summary.variables.includes(variable)||!summary.variables.includes(reference))){
        feedback.textContent='Revise los nombres: las variables deben existir en la base activa. Bases externas se integrarán en la siguiente fase.';
        return;
      }
      panel.dataset.configured='yes';
      feedback.textContent='Configuración de '+procedure.selectedOptions[0].textContent+
        ' preparada para esta sesión'+(join?' · clave de unión: '+join:'')+
        '. Cálculo pendiente de implementación estadística validada.';
    });
    refresh();
    document.addEventListener('valistruct:participants-changed',refresh);
  });
})();
