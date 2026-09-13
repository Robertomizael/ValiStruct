# ValiStruct 2.5 — Guía de beta institucional

Antes de invitar usuarios piloto:

1. Use HTTPS en frontend y backend.
2. Active autenticación y biblioteca solo en un servidor controlado.
3. Configure usuarios de prueba con roles mínimos necesarios.
4. Pruebe creación, edición, comentarios, versiones y restauración.
5. Ejecute `/self-test`.
6. Verifique copias de seguridad del directorio de proyectos.
7. Confirme que los proyectos sincronizados no contienen datos crudos.
8. Defina responsable institucional de soporte.
9. Documente política de privacidad y retención.
10. Realice una prueba piloto con un grupo pequeño antes de ampliar acceso.

La beta no debe considerarse un despliegue clínico o regulatorio.


## ValiStruct 2.6
- Probar conflictos de edición en dos sesiones simultáneas.
- Validar menciones y notificaciones con cuentas de prueba.
- Revisar tareas y estados de revisión.
- Confirmar que la telemetría esté desactivada por defecto.
- Verificar que la bitácora exportada no contenga datos sensibles.


## ValiStruct 2.7
- Validar el tablero Kanban con varios usuarios.
- Revisar trazabilidad de aprobaciones y huellas SHA-256.
- Probar releases y recuperación de versiones.
- Descargar y revisar el paquete de auditoría.
- Supervisar `/monitor` durante la beta.
- Mantener la rama 2.7 como candidata a beta institucional estable hasta completar pruebas externas.
