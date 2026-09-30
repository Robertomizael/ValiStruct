# ValiStruct v5.3 · Fase 1 — Simplificación reversible de navegación

**Autor conceptual y director científico:** Dr. Roberto Joel Tirado Reyes  
**Base protegida:** `backup/v5-3-fase0-cierre` en `c2cd15eeabf375b7f01bd366dfd602dc8879f175`  
**Rama:** `feature/v5-3-simplificacion`  
**Estado:** implementación y validación. No fusionar ni publicar hasta CI, DMG/EXE y revisión.

## Objetivo
Reducir el ruido visual sin eliminar módulos ni cambiar cálculos. Los botones y secciones heredados permanecen dentro de `.nav`/DOM antes de cargar `app.js` para conservar sus listeners y enlaces cruzados.

## Navegación científica visible
- Inicio.
- Centro de datos: Base de participantes, Diagnóstico de datos, Diagnóstico multivariado, Datos faltantes.
- Validación interna: V de Aiken, AFE, AFC, Fiabilidad.
- Validación externa: Estabilidad y concordancia, Validez de criterio, Rendimiento y baremación.
- Motor Pro · R/lavaan.
- Resultados.
- Proyectos.
- Ayuda metodológica.
- Configuración.
- Acerca de ValiStruct.

## Fuente declarativa única
`v52-shell.js` contiene `NAV_MODULES` con:
- `visibility: visible | integrated | admin | qa`
- `parent` para módulos integrados
- `status: ready | preparing`
- `deprecated: true` solo como marcador de futura Fase 3.

Durante esta fase no se crea un archivo adicional para evitar desalineación entre HTML, PWA y Electron.

## Módulos integrados
Siguen en el DOM y en `.nav`, pero su botón se oculta del menú principal. Cada pantalla padre recibe una franja **Herramientas de este módulo** y permite llegar a cada herramienta en dos clics como máximo.

Padres:
- Centro de datos → SAV/DTA.
- Motor Pro → advanced, Latencia, sintaxis, plantillas, model check, comparación, estimador, tamaño muestral y Monte Carlo.
- Resultados → dashboard, tablas, conclusiones, APA 7, checklist y Journal Ready.
- Ayuda → Guía Tirado-Reyes, Centro de ayuda, referencias y documentación.
- Proyectos → historial, migración, cifrado y perfil.
- Configuración → preferencias, accesibilidad, dispositivo/PWA y estado del sistema.
- Inicio → ruta guiada, ruta integral y asistente.

## Administración y QA
- Administración queda oculta por defecto; puede mostrarse desde Configuración solo como cambio de interfaz.
- El backend sigue protegido por la lista blanca científica implementada en Fase 0. Mostrar botones no habilita rutas institucionales.
- QA/desarrollo permanece en `.nav` para compatibilidad, pero nunca se muestra al usuario normal ni en modo institucional.

## Validación externa
Las tres entradas permanecen visibles por coherencia metodológica pero muestran:
- distintivo **En preparación** en menú;
- aviso en Inicio;
- distintivo y texto **Este módulo aún no realiza cálculos** dentro de cada pantalla.

No se simulan estadísticas.

## Versionado
- Aplicación / build: `5.3.0-beta.1`.
- Formato persistente de proyecto: `3.0` (sin cambios).
- Se retiraron badges históricos por módulo; no se modificaron IDs.
- Cache PWA: `valistruct-v5-3-0-fase1-20260930`.

## Deliberadamente no modificado
V de Aiken y su IC, base de jueces, DataManager, AFE/psych, AFC, fiabilidad, Mahalanobis/Mardia, Motor Pro/lavaan, JASP, scripts R, cálculo OLS de Latencia, esquema de proyectos y listeners científicos heredados.

## Pruebas nuevas
`tests/test_fase1_navigation.py`:
1. ≤25 accesos científicos visibles y ≥82 módulos conservados en `.nav`.
2. Cada módulo `integrated` accesible desde su padre en ≤2 clics.
3. Validación externa marcada En preparación.
4. Administración y QA fuera de navegación normal; QA permanece oculto aun en modo institucional.
5. Ningún badge de versión heredado visible.

El CI unificado sigue ejecutando Fase 0, JASP, privacidad, R/psych, lavaan, diagnósticos multivariados y navegador.

## Criterio de cierre
No declarar Fase 1 cerrada hasta:
- CI unificado verde en HEAD;
- RC verde;
- compilaciones DMG/EXE verdes;
- revisión visual/manual de ambos instaladores;
- revisión técnica final de Claude;
- `main` intacta hasta autorización explícita.
