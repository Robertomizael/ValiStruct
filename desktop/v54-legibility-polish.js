'use strict';

(() => {
  const STYLE_ID = 'vs-v54-legibility-polish';
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* ValiStruct 5.4 · Ajuste tipográfico de cierre.
       Solo modifica presentación/legibilidad; no altera cálculos ni lógica científica. */
    body.vs-v52 {
      font-size: 15px;
      line-height: 1.52;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }

    body.vs-v52 .topbar h1 { font-size: 26px !important; }
    body.vs-v52 .topbar p { font-size: 13.5px !important; line-height: 1.55 !important; }
    body.vs-v52 .topbar .author { font-size: 13.5px !important; line-height: 1.48 !important; }
    body.vs-v52 .topbar .author small { font-size: 11.5px !important; }
    body.vs-v52 .vs-v52-current { font-size: 12.5px !important; }

    body.vs-v52 .nav-v52 button,
    body.vs-v52 .nav-v52 summary {
      font-size: 13.5px !important;
      line-height: 1.42 !important;
    }
    body.vs-v52 .nav-v52 .vs-v52-group summary { font-size: 13.5px !important; }
    body.vs-v52 .nav-v52 .vs-v52-item {
      font-size: 12.8px !important;
      line-height: 1.42 !important;
      padding-top: 10px !important;
      padding-bottom: 10px !important;
    }
    .nav-v52 .vs-v52-brand small { font-size: 12px !important; }
    .nav-v52 .vs-v52-sidebar-credit { font-size: 12px !important; line-height: 1.55 !important; }
    .nav-v52 .vs-v52-sidebar-credit span { font-size: 11.5px !important; }

    .vs-v52-eyebrow { font-size: 11.5px !important; }
    .vs-v52-welcome p { font-size: 15px !important; line-height: 1.7 !important; }
    .vs-v52-primary,
    body.vs-v52 .vs-v52-primary,
    .vs-v52-outline,
    body.vs-v52 .vs-v52-outline { font-size: 14px !important; }
    .vs-v52-overview-title p { font-size: 14px !important; }
    .vs-v52-quick-grid strong { font-size: 15px !important; }
    .vs-v52-quick-grid small { font-size: 12.5px !important; line-height: 1.55 !important; }
    .vs-v52-home-bottom { font-size: 13px !important; }

    .vs-v52-breadcrumb { font-size: 13px !important; }
    .vs-v52-module-header p { font-size: 15px !important; line-height: 1.6 !important; }
    .vs-v52-status { font-size: 12.5px !important; }
    .vs-v52-context { font-size: 14px !important; line-height: 1.62 !important; }
    .vs-v52-card-heading p { font-size: 13.5px !important; line-height: 1.55 !important; }
    .vs-v52-form-grid label { font-size: 13.5px !important; }
    .vs-v52-form-grid input,
    .vs-v52-form-grid select,
    body.vs-v52 input,
    body.vs-v52 select,
    body.vs-v52 textarea {
      font-size: 14px !important;
      line-height: 1.45 !important;
    }
    body.vs-v52 input::placeholder,
    body.vs-v52 textarea::placeholder { font-size: 13.5px !important; }
    .vs-v52-linked-data { font-size: 13.5px !important; }
    .vs-v52-method-note { font-size: 13.5px !important; line-height: 1.68 !important; }
    .vs-v52-config-status { font-size: 14px !important; }
    .vs-v52-help summary,
    .vs-v52-help p { font-size: 14px !important; line-height: 1.65 !important; }

    body.vs-v52 #mainContent .notice,
    body.vs-v52 #mainContent .hint,
    body.vs-v52 #mainContent .helper-text,
    body.vs-v52 #mainContent .description,
    body.vs-v52 #mainContent .method-note,
    body.vs-v52 #mainContent .efa-note,
    body.vs-v52 #mainContent .efa-error,
    body.vs-v52 #mainContent .status-chip {
      font-size: 13px !important;
      line-height: 1.55 !important;
    }

    body.vs-v52 #mainContent .card p,
    body.vs-v52 #mainContent .result-card p,
    body.vs-v52 #mainContent .result-grid p,
    body.vs-v52 #mainContent li {
      font-size: 14px;
      line-height: 1.6;
    }

    body.vs-v52 #mainContent button {
      font-size: 13.5px;
      line-height: 1.35;
      min-height: 38px;
    }

    body.vs-v52 #mainContent table {
      font-size: 13px;
    }
    body.vs-v52 #mainContent table th {
      font-size: 13.2px;
      line-height: 1.4;
    }
    body.vs-v52 #mainContent table td {
      font-size: 13px;
      line-height: 1.45;
    }

    body.vs-v52 #multiRunStatus { font-size: 14px !important; }

    /* Mantiene los gráficos PATH/ROC/AFE sin escalado global para evitar solapamientos. */
    body.vs-v52 svg text { text-rendering: geometricPrecision; }

    @media (max-width: 1100px) {
      body.vs-v52 .nav-v52 button,
      body.vs-v52 .nav-v52 summary { font-size: 13px !important; }
      body.vs-v52 .nav-v52 .vs-v52-item { font-size: 12.5px !important; }
      body.vs-v52 #mainContent table { font-size: 12.5px; }
      body.vs-v52 #mainContent table td,
      body.vs-v52 #mainContent table th { font-size: 12.5px; }
    }
  `;

  document.head.appendChild(style);
  document.documentElement.dataset.vsLegibilityPolish = 'v54';
})();
