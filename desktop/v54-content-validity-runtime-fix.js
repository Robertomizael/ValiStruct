(() => {
  'use strict';

  const q = id => document.getElementById(id);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  const IMPORTS = {
    cviUploadXlsx: {
      resultsId: 'cviResults',
      ready: text => text.includes('XLSX importado correctamente'),
      calculateId: 'calculateCvi',
      label: 'I-CVI / S-CVI/Ave'
    },
    lawsheUploadXlsx: {
      resultsId: 'lawsheResults',
      ready: text => text.includes('XLSX importado correctamente'),
      calculateId: 'calculateLawshe',
      label: 'CVR de Lawshe'
    },
    delphiUploadXlsx: {
      resultsId: 'delphiResults',
      ready: text => /Ronda\s+\d+\s+importada/i.test(text),
      calculateId: 'calculateDelphi',
      label: 'Delphi / Delphi modificado'
    }
  };

  async function calculateAfterImport(config) {
    // content-validity-xlsx-renderer.js imports asynchronously. Wait for its
    // explicit success message instead of relying on an arbitrary fixed delay.
    for (let attempt = 0; attempt < 60; attempt++) {
      const out = q(config.resultsId);
      const text = out?.innerText || out?.textContent || '';
      if (config.ready(text)) {
        const calculate = q(config.calculateId);
        if (!calculate) {
          console.error(`[ValiStruct] No se encontró el botón de cálculo para ${config.label}.`);
          return;
        }
        calculate.click();
        return;
      }
      await sleep(50);
    }
    console.warn(`[ValiStruct] La importación XLSX de ${config.label} no alcanzó el estado listo para calcular.`);
  }

  document.addEventListener('change', event => {
    const config = IMPORTS[event.target?.id];
    if (!config || !event.target?.files?.length) return;
    calculateAfterImport(config).catch(err => {
      console.error(`[ValiStruct] Error al procesar XLSX de ${config.label}:`, err);
    });
  });

  function makeGroup(title, ids, open) {
    const nav = document.querySelector('nav.nav');
    if (!nav) return null;
    const buttons = ids.map(id => nav.querySelector(`button[data-section="${id}"]`)).filter(Boolean);
    if (!buttons.length) return null;

    const wrap = document.createElement('details');
    wrap.className = 'vs-v52-group vs-v54-scientific-stage';
    wrap.open = Boolean(open);
    const summary = document.createElement('summary');
    summary.innerHTML = `<span class="vs-v52-group-icon" aria-hidden="true">◇</span><span>${title}</span><span class="vs-v52-chevron" aria-hidden="true">⌄</span>`;
    const list = document.createElement('div');
    list.className = 'vs-v52-group-items';
    buttons.forEach(button => list.appendChild(button));
    wrap.append(summary, list);
    return wrap;
  }

  function reorderScientificFlow() {
    const nav = document.querySelector('nav.nav');
    if (!nav || nav.dataset.v54ScientificFlow === 'yes') return;

    const required = ['aiken', 'dataimport', 'efa', 'cfa'];
    if (required.some(id => !nav.querySelector(`button[data-section="${id}"]`))) return;

    const legacyGroups = [...nav.querySelectorAll(':scope > .vs-v52-group:not(.vs-v53-admin)')];
    const home = nav.querySelector(':scope > button[data-section="inicio"]');
    if (!home) return;

    const stages = [
      makeGroup('Etapa I · Validez de contenido', ['aiken'], true),
      makeGroup('Etapa II · Base de datos y preparación', ['dataimport', 'diagnostics', 'multidiag', 'missingpro'], false),
      makeGroup('Etapa III · Validez de constructo y fiabilidad', ['efa', 'cfa', 'reliability'], false),
      makeGroup('Etapa IV · Validación externa', ['stability', 'criterion', 'performance'], false)
    ].filter(Boolean);

    legacyGroups.forEach(group => group.remove());
    let anchor = home;
    stages.forEach(stage => {
      anchor.insertAdjacentElement('afterend', stage);
      anchor = stage;
    });

    stages.forEach(stage => stage.addEventListener('toggle', () => {
      if (!stage.open) return;
      stages.forEach(other => { if (other !== stage) other.open = false; });
    }));

    // Keep the home shortcut aligned with the actual methodological route.
    const homeContent = q('inicio');
    const internalCard = homeContent?.querySelector('[data-vs-target="aiken"]');
    if (internalCard) {
      const title = internalCard.querySelector('strong');
      const subtitle = internalCard.querySelector('small');
      if (title) title.textContent = 'Validez de contenido';
      if (subtitle) subtitle.textContent = 'Aiken, I-CVI/S-CVI, Lawshe y Delphi';
    }

    nav.dataset.v54ScientificFlow = 'yes';
  }

  // main-patched.js injects this file after the declarative v5.4 shell has
  // already been built, so moving existing buttons preserves app.js listeners.
  reorderScientificFlow();
})();
