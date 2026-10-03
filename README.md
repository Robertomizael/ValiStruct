# ValiStruct

**Plataforma inteligente para validación de instrumentos y modelamiento estructural**

ValiStruct es una plataforma científica de acceso abierto orientada a estudiantes, docentes e investigadores. Integra herramientas para validación de instrumentos, análisis psicométrico, análisis factorial y modelamiento de ecuaciones estructurales.

## Versión actual

**ValiStruct v5.4 Beta** (`5.4.0-beta.1`)

Esta versión se encuentra en fase Beta para evaluación y pruebas antes de una promoción estable. La Fase 4 se dedica exclusivamente a preparación de release, reproducibilidad y validación final; no incorpora nuevas funciones científicas.

## Descargar para Windows y macOS

Los instaladores Beta no deben seleccionarse por ser «el último build». Cada candidato válido se identifica mediante `release/candidate-v5.4-beta1.json`, que registra commit de origen, ejecución de GitHub Actions, IDs de artefacto, tamaños y SHA-256. Hasta que exista un GitHub Release formal, los artefactos de Actions se consideran únicamente candidatos internos de validación; no se recomienda distribuir un binario cuyo hash no coincida con el manifiesto.

Los paquetes de escritorio son Beta y se generan por separado para cada sistema. El ZIP de código fuente de GitHub no es un instalador.

## Capacidades principales

- Validez de contenido mediante V de Aiken.
- Análisis de confiabilidad.
- Análisis factorial exploratorio.
- Análisis factorial confirmatorio (CFA).
- Modelamiento de ecuaciones estructurales (SEM) con R/lavaan.
- Estimadores MLR y WLSMV.
- Índices de ajuste estándar, robustos y escalados.
- Cargas factoriales estandarizadas.
- CR, AVE y HTMT.
- Diagnóstico de convergencia y soluciones impropias.
- Apoyo metodológico e interpretativo.

## Módulos

- **ValiStruct Content** — validez de contenido.
- **ValiStruct Factor** — análisis factorial exploratorio.
- **ValiStruct Confirm** — análisis factorial confirmatorio.
- **ValiStruct Latencia** — modelamiento de variables latentes.
- **ValiStruct Metrics** — confiabilidad y validez de constructo.
- **ValiStruct Guide** — orientación metodológica.
- **ValiStruct Report** — apoyo para reportes científicos.
- **Motor Pro** — procesamiento avanzado con R/lavaan.

## Validación técnica

La Beta 5.4 cuenta con validación automatizada mediante GitHub Actions. El flujo incluye chequeos estáticos, pruebas de backend, regresiones científicas, equivalencia estadística frente a lavaan directo, smoke tests, pruebas end-to-end en navegador y compilaciones autónomas para Windows y macOS.

## Estructura principal

```text
.github/workflows/   Validación automatizada
backend/             API y motores estadísticos
deployment/          Recursos de despliegue
docs/                Documentación
icons/               Recursos gráficos
tests/               Pruebas y validación estadística
app.js               Frontend
index.html           Interfaz principal
service-worker.js    Soporte PWA
```

## Uso local

Backend:

```bash
cd backend
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

Frontend:

```bash
python -m http.server 8000
```

## Consideraciones de uso

ValiStruct es una herramienta de apoyo. No sustituye el juicio metodológico, estadístico y teórico del investigador ni la supervisión especializada. Las decisiones sobre eliminación de ítems o modificación de modelos no deben basarse en un único indicador estadístico.

## Autor

**Dr. Roberto Joel Tirado Reyes**  
Profesor-investigador  
Universidad Autónoma de Sinaloa

ValiStruct se desarrolla como una contribución de acceso abierto al fortalecimiento de la formación y la investigación científica.
