# ValiStruct

**Plataforma inteligente para validación de instrumentos y modelamiento estructural**

ValiStruct es una plataforma científica de acceso abierto orientada a estudiantes, docentes e investigadores. Integra herramientas para validación de instrumentos, análisis psicométrico, análisis factorial y modelamiento de ecuaciones estructurales.

## Versión actual

**ValiStruct v3.0.1 Beta** (cambios de análisis ordinal, ESEM e invariancia)

Esta versión se encuentra en fase Beta para evaluación y pruebas antes de la versión estable 3.0.

## Descargar para Windows y macOS

Tras cada cambio de `main` que afecte a la aplicación, el flujo [ValiStruct Desktop Autonomous Build](https://github.com/Robertomizael/ValiStruct/actions/workflows/desktop-build.yml) genera un instalador Windows (`.exe`) y una imagen macOS (`.dmg`). Abra la ejecución más reciente que haya finalizado correctamente y descargue el archivo correspondiente en **Artifacts**, al final de la página. GitHub puede solicitar iniciar sesión para descargar artefactos de Actions. La compilación puede tardar varios minutos después de integrar los cambios.

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

La Beta 1 deriva del ciclo RC6 y cuenta con validación automatizada mediante GitHub Actions. El flujo incluye chequeos estáticos, pruebas de backend, equivalencia estadística frente a lavaan directo, smoke tests y pruebas end-to-end en navegador.

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
