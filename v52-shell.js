/* ValiStruct v5.3 · navegación científica declarativa.
 * Fase 1: simplificación reversible. Ningún módulo se elimina del DOM.
 * Debe cargar después de navigation-v51.js y antes de app.js, porque app.js
 * registra los botones que existen dentro de .nav una sola vez.
 */
(function () {
  'use strict';

  const nav=document.querySelector('nav.nav');
  const main=document.getElementById('mainContent');
  if(!nav || !main || nav.dataset.v53Ready==='yes') return;

  document.body.classList.add('vs-v52','vs-v53');
  nav.dataset.v52Ready='yes';
  nav.dataset.v53Ready='yes';
  nav.dataset.valistructNav='v5';

  const icon=name=>({
    home:'⌂',database:'▤',internal:'◇',external:'◎',
    motor:'⌘',report:'▧',project:'▣',help:'?',settings:'⚙',about:'ⓘ'
  })[name]||'◦';

  const NAV_MODULES=[
    // Núcleo visible
    {id:'inicio',label:'Inicio',group:'home',order:1,visibility:'visible',status:'ready'},
    {id:'dataimport',label:'Base de participantes',group:'data',order:10,visibility:'visible',status:'ready'},
    {id:'diagnostics',label:'Diagnóstico de datos',group:'data',order:20,visibility:'visible',status:'ready'},
    {id:'multidiag',label:'Diagnóstico multivariado',group:'data',order:30,visibility:'visible',status:'ready'},
    {id:'missingpro',label:'Datos faltantes',group:'data',order:40,visibility:'visible',status:'ready'},
    {id:'aiken',label:'Validez de contenido · V de Aiken',group:'internal',order:10,visibility:'visible',status:'ready'},
    {id:'efa',label:'Análisis factorial exploratorio',group:'internal',order:20,visibility:'visible',status:'ready'},
    {id:'cfa',label:'Análisis factorial confirmatorio',group:'internal',order:30,visibility:'visible',status:'ready'},
    {id:'reliability',label:'Fiabilidad',group:'internal',order:40,visibility:'visible',status:'ready'},
    {id:'stability',label:'Estabilidad y concordancia',group:'external',order:10,visibility:'visible',status:'preparing'},
    {id:'criterion',label:'Validez de criterio',group:'external',order:20,visibility:'visible',status:'preparing'},
    {id:'performance',label:'Rendimiento y baremación',group:'external',order:30,visibility:'visible',status:'preparing'},
    {id:'motorpro',label:'Motor Pro · R/lavaan',group:'motor',order:1,visibility:'visible',status:'ready'},
    {id:'resultcenter',label:'Resultados',group:'results',order:1,visibility:'visible',status:'ready'},
    {id:'projects',label:'Proyectos',group:'projects',order:1,visibility:'visible',status:'ready'},
    {id:'methodguide',label:'Ayuda metodológica',group:'help',order:1,visibility:'visible',status:'ready'},
    {id:'privacy',label:'Configuración',group:'settings',order:1,visibility:'visible',status:'ready'},
    {id:'acerca',label:'Acerca de ValiStruct',group:'about',order:1,visibility:'visible',status:'ready'},

    // Herramientas integradas: siguen vivas y se alcanzan desde su pantalla padre.
    {id:'legacyimport',label:'Importar SAV / DTA',visibility:'integrated',parent:'dataimport',order:10,status:'ready'},
    {id:'advanced',label:'Calidad de medición e invariancia',visibility:'integrated',parent:'motorpro',order:10,status:'ready'},
    {id:'latencia',label:'Constructor visual · Latencia',visibility:'integrated',parent:'motorpro',order:20,status:'ready'},
    {id:'syntaxpro',label:'Sintaxis avanzada',visibility:'integrated',parent:'motorpro',order:30,status:'ready'},
    {id:'templates',label:'Plantillas',visibility:'integrated',parent:'motorpro',order:40,status:'ready'},
    {id:'modelcheck',label:'Diagnóstico del modelo',visibility:'integrated',parent:'motorpro',order:50,status:'ready'},
    {id:'modelcompare',label:'Comparar modelos',visibility:'integrated',parent:'motorpro',order:60,status:'ready'},
    {id:'estimadorguide',label:'Asistente de estimador',visibility:'integrated',parent:'motorpro',order:70,status:'ready'},
    {id:'samplesize',label:'Tamaño muestral',visibility:'integrated',parent:'motorpro',order:80,status:'ready'},
    {id:'semmontecarlo',label:'Monte Carlo SEM',visibility:'integrated',parent:'motorpro',order:90,status:'ready'},
    {id:'qualitydashboard',label:'Resumen de calidad',visibility:'integrated',parent:'resultcenter',order:10,status:'ready'},
    {id:'articletables',label:'Tablas para artículo',visibility:'integrated',parent:'resultcenter',order:20,status:'ready'},
    {id:'conclusionassistant',label:'Interpretación y conclusiones',visibility:'integrated',parent:'resultcenter',order:30,status:'ready'},
    {id:'reportapa',label:'Reporte APA 7',visibility:'integrated',parent:'resultcenter',order:40,status:'ready'},
    {id:'finalcheck',label:'Checklist final',visibility:'integrated',parent:'resultcenter',order:50,status:'ready'},
    {id:'journalready',label:'Preparación para publicación',visibility:'integrated',parent:'resultcenter',order:60,status:'ready'},
    {id:'guia',label:'Guía Tirado-Reyes',visibility:'integrated',parent:'methodguide',order:10,status:'ready'},
    {id:'helpcenter',label:'Centro de ayuda',visibility:'integrated',parent:'methodguide',order:20,status:'ready'},
    {id:'referencias',label:'Referencias metodológicas',visibility:'integrated',parent:'methodguide',order:30,status:'ready'},
    {id:'userdocs',label:'Documentación',visibility:'integrated',parent:'methodguide',order:40,status:'ready'},
    {id:'history',label:'Historial',visibility:'integrated',parent:'projects',order:10,status:'ready'},
    {id:'migration',label:'Migración de proyectos',visibility:'integrated',parent:'projects',order:20,status:'ready'},
    {id:'encryption',label:'Cifrado',visibility:'integrated',parent:'projects',order:30,status:'ready'},
    {id:'profiles',label:'Perfil del investigador',visibility:'integrated',parent:'projects',order:40,status:'ready'},
    {id:'advancedsettings',label:'Preferencias avanzadas',visibility:'integrated',parent:'privacy',order:10,status:'ready'},
    {id:'accessibility',label:'Accesibilidad',visibility:'integrated',parent:'privacy',order:20,status:'ready'},
    {id:'appsettings',label:'Preferencias de la aplicación',visibility:'integrated',parent:'privacy',order:30,status:'ready'},
    {id:'systemcheck',label:'Estado del sistema',visibility:'integrated',parent:'privacy',order:40,status:'ready'},
    {id:'updates',label:'Dispositivo / PWA / versión',visibility:'integrated',parent:'privacy',order:50,status:'ready'},
    {id:'guidedproject',label:'Ruta guiada de validación',visibility:'integrated',parent:'inicio',order:10,status:'ready'},
    {id:'validacion',label:'Ruta integral de validación',visibility:'integrated',parent:'inicio',order:20,status:'ready'},
    {id:'assistantflow',label:'Asistente paso a paso',visibility:'integrated',parent:'inicio',order:30,status:'ready'},

    // Modo institucional: fuera de la navegación científica normal.
    {id:'auth',label:'Acceso institucional',visibility:'admin',order:10,status:'ready'},
    {id:'oidc',label:'OIDC',visibility:'admin',order:20,status:'ready'},
    {id:'teams',label:'Equipos',visibility:'admin',order:30,status:'ready'},
    {id:'institutionlib',label:'Biblioteca institucional',visibility:'admin',order:40,status:'ready'},
    {id:'sync',label:'Sincronización',visibility:'admin',order:50,status:'ready'},
    {id:'versions',label:'Versiones',visibility:'admin',order:60,status:'ready'},
    {id:'peerreview',label:'Revisión por pares',visibility:'admin',order:70,status:'ready'},
    {id:'activitylog',label:'Registro de actividad',visibility:'admin',order:80,status:'ready'},
    {id:'notifications',label:'Notificaciones',visibility:'admin',order:90,status:'ready'},
    {id:'conflicts',label:'Conflictos',visibility:'admin',order:100,status:'ready'},
    {id:'tasks',label:'Tareas',visibility:'admin',order:110,status:'ready'},
    {id:'kanban',label:'Kanban',visibility:'admin',order:120,status:'ready',deprecated:true},
    {id:'collabexport',label:'Exportación colaborativa',visibility:'admin',order:130,status:'ready'},
    {id:'approvals',label:'Aprobaciones',visibility:'admin',order:140,status:'ready'},
    {id:'releases',label:'Gestión de versiones',visibility:'admin',order:150,status:'ready'},
    {id:'auditpackage',label:'Paquete de auditoría',visibility:'admin',order:160,status:'ready'},
    {id:'adminpanel',label:'Panel administrativo',visibility:'admin',order:170,status:'ready'},
    {id:'servermonitor',label:'Monitor del servidor',visibility:'admin',order:180,status:'ready'},
    {id:'backuprestore',label:'Respaldo y restauración',visibility:'admin',order:190,status:'ready'},
    {id:'scheduledbackup',label:'Respaldo programado',visibility:'admin',order:200,status:'ready'},
    {id:'serverwizard',label:'Asistente de servidor',visibility:'admin',order:210,status:'ready'},
    {id:'incidents',label:'Incidencias',visibility:'admin',order:220,status:'ready'},
    {id:'telemetry',label:'Telemetría',visibility:'admin',order:230,status:'ready'},
    {id:'installer',label:'Instalador',visibility:'admin',order:240,status:'ready'},

    // QA / desarrollo: siempre disponibles en DOM, nunca en la UI normal.
    {id:'backendtests',label:'Pruebas del backend',visibility:'qa',order:10,status:'ready'},
    {id:'e2e',label:'Pruebas E2E',visibility:'qa',order:20,status:'ready'},
    {id:'loadtesting',label:'Pruebas de carga',visibility:'qa',order:30,status:'ready'},
    {id:'a11yaudit',label:'Auditoría de accesibilidad',visibility:'qa',order:40,status:'ready'},
    {id:'betaready',label:'Beta readiness',visibility:'qa',order:50,status:'ready'},
    {id:'betametrics',label:'Métricas beta',visibility:'qa',order:60,status:'ready'},
    {id:'releasecandidate',label:'Release candidate',visibility:'qa',order:70,status:'ready'},
    {id:'regression',label:'Regresión',visibility:'qa',order:80,status:'ready'},
    {id:'securityreview',label:'Revisión de seguridad',visibility:'qa',order:90,status:'ready'}
  ];

  window.VALISTRUCT_NAV_MODULES=Object.freeze(NAV_MODULES.map(item=>Object.freeze({...item})));

  const moduleById=new Map(NAV_MODULES.map(item=>[item.id,item]));
  const original=[...nav.querySelectorAll('button[data-section]')];
  const byId=new Map(original.map(button=>[button.dataset.section,button]));

  const externalModules=[
    {id:'stability',title:'Estabilidad y concordancia',subtitle:'Test–retest, concordancia entre evaluadores e instrumentos',
      procedures:[
        {value:'test-retest',label:'Estabilidad test–retest (CCI / correlación)'},
        {value:'kappa',label:'Concordancia categórica (kappa de Cohen)'},
        {value:'kappa-weighted',label:'Concordancia ordinal (kappa ponderado)'},
        {value:'icc',label:'Concordancia cuantitativa (CCI configurable)'}],
      description:'La correlación mide asociación; el CCI y kappa permiten evaluar concordancia según el tipo de dato.'},
    {id:'criterion',title:'Validez de criterio',subtitle:'Evidencia concurrente y predictiva frente a un criterio externo',
      procedures:[
        {value:'concurrent',label:'Criterio concurrente · correlación'},
        {value:'predictive',label:'Criterio predictivo · correlación'},
        {value:'linear',label:'Regresión lineal'},
        {value:'logistic',label:'Regresión logística'}],
      description:'Seleccione un criterio externo y documente si se mide simultáneamente o en un momento posterior.'},
    {id:'performance',title:'Rendimiento y baremación',subtitle:'Curvas ROC, umbrales de decisión y normas descriptivas',
      procedures:[
        {value:'roc',label:'ROC / AUC · criterio binario'},
        {value:'youden',label:'Umbral mediante índice de Youden'},
        {value:'norms',label:'Percentiles y puntuaciones normalizadas'},
        {value:'bands',label:'Bandas descriptivas / semáforo configurable'}],
      description:'Un punto de corte necesita criterio externo. Los percentiles y las bandas descriptivas no equivalen a umbrales clínicos.'}
  ];

  // Estos nodos deben existir antes de que app.js registre la navegación.
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
          <span class="vs-v53-preparing">En preparación</span>
        </div>
        <div class="vs-v53-preparing-note"><strong>Este módulo aún no realiza cálculos.</strong> Puede preparar la configuración metodológica; la estimación se habilitará cuando el motor estadístico sea contrastado.</div>
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
          <p class="vs-v52-method-note">Los cálculos estadísticos y las exportaciones de este módulo se habilitarán tras su implementación y contraste con R. Esta pantalla no presenta estimaciones simuladas.</p>
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

  // Garantía: cualquier botón heredado no inventariado se conserva como QA oculto.
  byId.forEach((button,id)=>{
    if(!moduleById.has(id)){
      const fallback={id,label:button.textContent.trim()||id,visibility:'qa',order:999,status:'ready'};
      NAV_MODULES.push(fallback);
      moduleById.set(id,fallback);
    }
  });

  nav.replaceChildren();
  nav.classList.add('nav-v52','nav-v53');
  nav.setAttribute('aria-label','Navegación científica de ValiStruct');

  const brand=document.createElement('div');
  brand.className='vs-v52-brand';
  brand.innerHTML='<span class="vs-v52-brand-symbol" aria-hidden="true">V</span><div><strong>ValiStruct</strong><small>Validación de instrumentos</small></div>';
  nav.appendChild(brand);

  const buttonFor=id=>{
    const button=byId.get(id);
    const config=moduleById.get(id);
    if(!button||!config)return null;
    button.type='button';
    button.textContent=config.label;
    button.dataset.visibility=config.visibility;
    if(config.parent)button.dataset.parent=config.parent;
    if(config.status)button.dataset.status=config.status;
    if(config.deprecated)button.dataset.deprecated='true';
    return button;
  };

  const visibleGroups=[
    {key:'data',name:'Centro de datos',glyph:icon('database'),open:false},
    {key:'internal',name:'Validación interna',glyph:icon('internal'),open:true},
    {key:'external',name:'Validación externa',glyph:icon('external'),open:false}
  ];
  const groupElements=[];
  const home=buttonFor('inicio');
  if(home){
    home.classList.add('vs-v52-nav-home');
    home.innerHTML='<span aria-hidden="true">'+icon('home')+'</span><span>Inicio</span>';
    nav.appendChild(home);
  }

  visibleGroups.forEach(group=>{
    const items=NAV_MODULES.filter(x=>x.visibility==='visible'&&x.group===group.key).sort((a,b)=>a.order-b.order);
    const wrap=document.createElement('details');
    wrap.className='vs-v52-group';
    wrap.open=group.open;
    const head=document.createElement('summary');
    head.innerHTML='<span class="vs-v52-group-icon" aria-hidden="true">'+group.glyph+'</span><span>'+group.name+'</span><span class="vs-v52-chevron" aria-hidden="true">⌄</span>';
    wrap.appendChild(head);
    const list=document.createElement('div');
    list.className='vs-v52-group-items';
    items.forEach(config=>{
      const button=buttonFor(config.id);if(!button)return;
      button.classList.add('vs-v52-item');
      if(config.status==='preparing'){
        button.innerHTML='<span>'+config.label+'</span><small class="vs-v53-nav-status">En preparación</small>';
      }
      list.appendChild(button);
    });
    wrap.appendChild(list);nav.appendChild(wrap);groupElements.push(wrap);
    wrap.addEventListener('toggle',()=>{if(wrap.open)groupElements.forEach(other=>{if(other!==wrap)other.open=false;});});
  });

  const directVisible=[
    ['motorpro','motor'],['resultcenter','report'],['projects','project'],
    ['methodguide','help'],['privacy','settings'],['acerca','about']
  ];
  directVisible.forEach(([id,glyph])=>{
    const button=buttonFor(id);if(!button)return;
    button.classList.add('vs-v53-direct');
    button.innerHTML='<span aria-hidden="true">'+icon(glyph)+'</span><span>'+moduleById.get(id).label+'</span>';
    if(id==='motorpro')button.classList.add('vs-v52-motor');
    nav.appendChild(button);
  });

  // Todos los botones integrados siguen en .nav antes de app.js, pero sin ruido visual.
  const integratedBox=document.createElement('div');
  integratedBox.className='vs-v53-hidden-nav';
  integratedBox.hidden=true;
  integratedBox.setAttribute('aria-hidden','true');
  NAV_MODULES.filter(x=>x.visibility==='integrated').sort((a,b)=>a.order-b.order).forEach(config=>{
    const button=buttonFor(config.id);if(button)integratedBox.appendChild(button);
  });
  nav.appendChild(integratedBox);

  const adminGroup=document.createElement('details');
  adminGroup.className='vs-v52-group vs-v53-admin';
  adminGroup.hidden=true;
  adminGroup.innerHTML='<summary><span class="vs-v52-group-icon" aria-hidden="true">⌂</span><span>Herramientas institucionales</span><span class="vs-v52-chevron">⌄</span></summary>';
  const adminItems=document.createElement('div');adminItems.className='vs-v52-group-items';
  NAV_MODULES.filter(x=>x.visibility==='admin').sort((a,b)=>a.order-b.order).forEach(config=>{
    const button=buttonFor(config.id);if(button){button.classList.add('vs-v52-item');adminItems.appendChild(button);}
  });
  adminGroup.appendChild(adminItems);nav.appendChild(adminGroup);groupElements.push(adminGroup);

  // QA sigue dentro de .nav para conservar listeners/IDs, pero nunca se muestra al usuario.
  const qaBox=document.createElement('div');
  qaBox.className='vs-v53-qa-nav';qaBox.hidden=true;qaBox.setAttribute('aria-hidden','true');
  NAV_MODULES.filter(x=>x.visibility==='qa').sort((a,b)=>a.order-b.order).forEach(config=>{
    const button=buttonFor(config.id);if(button)qaBox.appendChild(button);
  });
  nav.appendChild(qaBox);

  const footer=document.createElement('div');
  footer.className='vs-v52-sidebar-credit';
  footer.innerHTML='<strong>Dr. Roberto Joel Tirado Reyes</strong><span>Autor conceptual y director científico</span>';
  nav.appendChild(footer);

  function openTarget(id){
    nav.querySelector('button[data-section="'+id+'"]')?.click();
  }

  function addToolStrip(parentId){
    const children=NAV_MODULES.filter(x=>x.visibility==='integrated'&&x.parent===parentId).sort((a,b)=>a.order-b.order);
    if(!children.length)return;
    const section=document.getElementById(parentId);if(!section||section.querySelector('.vs-v53-tools'))return;
    const box=document.createElement('section');
    box.className='vs-v53-tools';
    box.setAttribute('aria-label','Herramientas de este módulo');
    box.innerHTML='<div class="vs-v53-tools-title"><div><strong>Herramientas de este módulo</strong><span>Funciones especializadas disponibles sin saturar la navegación principal.</span></div></div><div class="vs-v53-tools-grid"></div>';
    const grid=box.querySelector('.vs-v53-tools-grid');
    children.forEach(config=>{
      const button=document.createElement('button');
      button.type='button';button.dataset.vsTarget=config.id;
      button.innerHTML='<strong>'+config.label+'</strong><span>Abrir herramienta</span><b aria-hidden="true">↗</b>';
      button.addEventListener('click',()=>openTarget(config.id));
      grid.appendChild(button);
    });
    const heading=section.querySelector('.section-heading,.vs-v52-module-header');
    if(heading)heading.insertAdjacentElement('afterend',box);
    else section.insertBefore(box,section.firstChild);
  }
  ['dataimport','motorpro','resultcenter','methodguide','projects','privacy'].forEach(addToolStrip);

  // Inicio: portada de baja densidad + ruta guiada alcanzable.
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
            <button type="button" data-vs-target="guidedproject" class="vs-v52-primary">Ruta guiada <span aria-hidden="true">↗</span></button>
            <button type="button" data-vs-target="projects" class="vs-v52-outline">Abrir proyecto</button>
          </div>
        </div><div class="vs-v52-hero-mark" aria-hidden="true"><span>V</span><span>✧</span></div>
      </div>
      <div class="vs-v52-overview">
        <div class="vs-v52-overview-title"><h3>¿En qué desea trabajar?</h3><p>Seleccione una actividad para abrir únicamente ese módulo.</p></div>
        <div class="vs-v52-quick-grid">
          <button type="button" data-vs-target="dataimport"><span class="vs-v52-quick-icon">▤</span><strong>Importar datos</strong><small>Participantes, ítems y dimensiones</small><span class="vs-v52-link-arrow">↗</span></button>
          <button type="button" data-vs-target="aiken"><span class="vs-v52-quick-icon">◇</span><strong>Validación interna</strong><small>Contenido, AFE, AFC y fiabilidad</small><span class="vs-v52-link-arrow">↗</span></button>
          <button type="button" data-vs-target="stability"><span class="vs-v52-quick-icon">◎</span><strong>Validación externa</strong><small><b>En preparación</b> · estabilidad, criterio y rendimiento</small><span class="vs-v52-link-arrow">↗</span></button>
          <button type="button" data-vs-target="resultcenter"><span class="vs-v52-quick-icon">▧</span><strong>Resultados</strong><small>Tablas, informes y exportación</small><span class="vs-v52-link-arrow">↗</span></button>
        </div>
      </div>
      <div class="vs-v52-home-bottom"><span class="vs-v52-live-dot"></span><span>Motor Pro disponible desde el menú lateral. V de Aiken utiliza una base independiente de jueces expertos.</span></div>`;
    initial.insertBefore(dashboard,initial.firstChild);
    initial.classList.add('vs-v52-home');
    dashboard.querySelectorAll('[data-vs-target]').forEach(button=>button.addEventListener('click',()=>openTarget(button.dataset.vsTarget)));
    addToolStrip('inicio');
  }

  // Modo institucional de interfaz. El backend sigue gobernado por VALISTRUCT_INSTITUTIONAL_MODE.
  const privacy=document.getElementById('privacy');
  if(privacy && !privacy.querySelector('#vsInstitutionalUiToggle')){
    const card=document.createElement('div');
    card.className='vs-v53-institutional-card';
    card.innerHTML='<div><strong>Herramientas institucionales</strong><p>Oculta por defecto administración, servidor, colaboración y operaciones. Mostrar estas opciones no habilita permisos del backend.</p></div><label><input id="vsInstitutionalUiToggle" type="checkbox"> Mostrar herramientas institucionales en este dispositivo</label><small>El backend debe iniciarse explícitamente con modo institucional para que sus rutas estén disponibles.</small>';
    privacy.insertBefore(card,privacy.children[1]||null);
    const toggle=card.querySelector('#vsInstitutionalUiToggle');
    const stored=localStorage.getItem('valistruct_institutional_ui')==='1';
    toggle.checked=stored;adminGroup.hidden=!stored;
    toggle.addEventListener('change',()=>{
      localStorage.setItem('valistruct_institutional_ui',toggle.checked?'1':'0');
      adminGroup.hidden=!toggle.checked;
      if(!toggle.checked && adminGroup.open)adminGroup.open=false;
    });
  }

  function updateParentHighlight(){
    nav.querySelectorAll('.vs-parent-active').forEach(x=>x.classList.remove('vs-parent-active'));
    const active=nav.querySelector('button[data-section].active');
    const config=active?moduleById.get(active.dataset.section):null;
    if(config?.parent){
      nav.querySelector('button[data-section="'+config.parent+'"]')?.classList.add('vs-parent-active');
    }
    const group=active?.closest('details');
    if(group && !group.hidden && !group.open)group.open=true;
    const current=document.querySelector('.vs-v52-current-module');
    if(current)current.textContent=config?.label||active?.textContent.trim()||'Inicio';
  }

  nav.addEventListener('click',event=>{
    if(event.target.closest('button[data-section]'))setTimeout(updateParentHighlight,0);
  });
  const observer=new MutationObserver(updateParentHighlight);
  nav.querySelectorAll('button[data-section]').forEach(button=>observer.observe(button,{attributes:true,attributeFilter:['class']}));

  const current=document.createElement('div');
  current.className='vs-v52-current';
  current.innerHTML='<span class="vs-v52-current-dot"></span><span class="vs-v52-current-module">Inicio</span>';
  document.querySelector('.topbar')?.appendChild(current);

  externalModules.forEach(module=>{
    const panel=document.getElementById(module.id);
    const status=panel.querySelector('.vs-v52-linked-data');
    const refresh=()=>{
      const summary=window.ValiStructParticipantData?.summary;
      status.textContent=summary?
        'Base disponible: '+summary.source+' · '+summary.n+' participantes · '+summary.variables.length+' variables. Verifique la correspondencia por ID antes de combinar mediciones.':
        'Sin base compartida. Importe participantes desde el Centro de datos.';
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
      if(summary&&(!summary.variables.includes(variable)||!summary.variables.includes(reference))){
        feedback.textContent='Revise los nombres: las variables deben existir en la base activa. Bases externas se integrarán en la siguiente fase.';return;
      }
      panel.dataset.configured='yes';
      feedback.textContent='Configuración de '+procedure.selectedOptions[0].textContent+
        ' preparada para esta sesión'+(join?' · clave de unión: '+join:'')+
        '. Cálculo pendiente de implementación estadística validada.';
    });
    refresh();
    document.addEventListener('valistruct:participants-changed',refresh);
  });

  updateParentHighlight();
})();
