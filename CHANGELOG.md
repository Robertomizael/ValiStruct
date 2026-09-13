# Changelog

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
