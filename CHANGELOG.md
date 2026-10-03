# Changelog

## 5.4.0-beta.1 — Fase 6 auditoría independiente
- Corrige el token de sesión desktop en AFE/R (`/efa`).
- Cubre toda la lista blanca científica con el gate de token.
- Unifica metadatos activos de versión en frontend/backend.
- Evita rotación de token y doble backend al recrear ventanas en macOS.
- Mueve el directorio local de proyectos a `userData`.
- Bloquea navegación externa dentro de Electron y abre HTTP/HTTPS en el navegador del sistema.
- Aísla resultados históricos incompatibles de Aiken/Latencia y exige reestimación antes de reportarlos.
- Aplica el bloqueo Delphi también al evaluar.
- Normaliza claves de etiquetas de valor SAV/DTA y añade cobertura DTA.
- Fija versiones del runtime Python/R y dependencias Python.
- Corrige el artefacto de validación RC para conservar `BETA_VALIDATION_REPORT.json`.
- Rota el caché PWA tras las correcciones de auditoría.
- Reconstrucción de instaladores y regeneración de manifiesto: pendiente hasta cierre de Fase 6.

## 3.0.0-rc.6
- Harness estadístico ampliado: MLR continuo + WLSMV ordinal.
- Comparación de cargas estandarizadas contra lavaan directo.
- Orquestador `tests/validate_release.py`.
- Beta gate formal.
- GitHub Actions para R/Python/Playwright.
- Docker Compose específico de validación.
- Manifiesto SHA-256 de archivos críticos.

## 3.0.0-rc.5
- Harness de validación estadística contra lavaan directo.
- Dataset sintético de referencia.
- Docker smoke test.
- Monte Carlo: sesgo basado únicamente en etiquetas compartidas.
- Model Check documenta limitación de df aproximados.
- Reglas de tareas unificadas.
- CORS fail-closed en producción/institucional/beta.
- Test de path traversal de restauración.
- Limpieza de dependencias R.

## 3.0.0-rc.4
- Correcciones derivadas de auditoría externa de RC3.
- Convergencia y advertencias reales de lavaan.
- Índices robustos/escalados para MLR/WLSMV cuando están disponibles.
- Detección explícita de soluciones impropias / Heywood.
- HTMT policórico para indicadores ordinales.
- Retiro de Omega web incorrecto.
- Aviso visible: extracción exploratoria web = ACP prototipo.
- Gunicorn en Docker y ejecución Unix.
- Protección condicional de endpoints de cómputo bajo AUTH_ENABLED.
- Límites de Monte Carlo en servidor.
- PBKDF2-SHA256, TTL de sesión y rate limit básico.
- Escrituras atómicas y locking parcial con portalocker.
- Service Worker limitado al app shell.

## 3.0.0-rc.3
- Corrige `send_file` no definido en paquete de auditoría y respaldo institucional.
- Añade `/runtime-audit`.
- Añade auditoría estática de globals del backend.
- Añade auditoría estática de navegación/DOM frontend.
- Integra estas auditorías en el release checker.

## 3.0.0-rc.2
- Corrige imports críticos del backend.
- Aplica realmente `VALISTRUCT_ALLOWED_ORIGINS` a CORS.
- Endurece encabezados de seguridad.
- Fortalece `release_check.py`.
- Añade `requirements-dev.txt`, preflight y documentación de defectos conocidos.

## 3.0.0-rc.1
- Congelamiento funcional.
- Capa estable de schema de proyecto 3.0.
- Centro Release Candidate.
- Suite de regresión en navegador.
- Revisión de seguridad y privacidad.
- Endpoints `/version`, `/rc-check`, `/security-status`.
- Documentación RC, seguridad y migración.
- Preparación para beta institucional real.

## 2.9
- Instalador asistido.
- Respaldos programados.
- Pruebas de carga.
- Auditoría de accesibilidad.
- Métricas beta.
