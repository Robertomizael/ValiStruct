# ValiStruct 2.8 — Configuración asistida

Use el módulo **Asistente de servidor** para generar una plantilla `.env` y checklist.

Secuencia recomendada:
1. configurar dominio;
2. habilitar HTTPS;
3. definir modo de autenticación;
4. habilitar biblioteca institucional cuando corresponda;
5. configurar límite de carga;
6. ejecutar `docker compose up --build`;
7. comprobar `/health`, `/self-test` y `/monitor`;
8. ejecutar pruebas E2E;
9. crear un respaldo;
10. iniciar beta limitada.
