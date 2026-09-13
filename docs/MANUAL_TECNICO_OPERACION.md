# Manual técnico de operación — ValiStruct 2.9

## 1. Componentes
- Frontend web/PWA.
- Backend Flask.
- R/lavaan para AFC/SEM.
- Almacenamiento institucional basado en archivos JSON en la versión beta.
- Docker/Compose para despliegue.

## 2. Inicio
1. Configure variables de entorno.
2. Ejecute `docker compose up -d --build`.
3. Verifique `/health`.
4. Ejecute `/self-test`.
5. Revise `/monitor`.

## 3. Respaldos
Use `deployment/backup.sh`.
Programe cron según la política institucional.
Pruebe restauración periódicamente.

## 4. Actualizaciones
- genere respaldo;
- conserve `version.json`;
- pruebe migración de proyectos;
- ejecute E2E;
- revise incidencias abiertas;
- despliegue primero en entorno de prueba.

## 5. Seguridad
- HTTPS obligatorio en despliegue remoto;
- preferir OIDC/SSO;
- limitar CORS;
- no almacenar datos crudos si no es necesario;
- restringir administración;
- revisar logs e incidencias.

## 6. Monitoreo
Supervise:
- uptime;
- disponibilidad de R;
- incidencias críticas;
- errores de backend;
- almacenamiento disponible;
- éxito de respaldos.

## 7. Criterio de liberación beta
No ampliar la beta si existen:
- incidencias críticas abiertas;
- fallas E2E;
- ausencia de respaldo reciente;
- fallas de autenticación;
- problemas de privacidad sin resolver.
