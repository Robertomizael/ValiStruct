# ValiStruct 5.4 Beta 1 · Gates manuales posteriores a Fase 6

Estos controles no pueden completarse desde la integración actual de GitHub y **no deben darse por aprobados automáticamente**.

## 1. Protección de `main`

La integración de GitHub usada durante la auditoría no dispone de permisos administrativos para leer o modificar branch protection/rulesets.

Antes de cualquier merge se debe configurar en GitHub, como mínimo:

- requerir Pull Request antes de merge;
- requerir que `ValiStruct unified CI` esté verde;
- requerir que las validaciones de release aplicables estén verdes;
- bloquear force-push;
- bloquear borrado de `main`;
- mantener `main` como rama protegida.

El merge no debe realizarse hasta verificar visualmente esta configuración.

## 2. Firma y notarización para distribución pública

Los candidatos de Fase 6 siguen siendo de validación interna.

### macOS
Para una distribución pública se requiere:
- certificado Apple Developer ID Application;
- hardened runtime;
- firma con identidad Developer ID;
- notarización Apple;
- validación posterior con Gatekeeper.

La firma ad-hoc de CI sirve únicamente para pruebas internas.

### Windows
Para una distribución pública se requiere:
- certificado Authenticode válido;
- firma del instalador y binarios relevantes;
- verificación de la firma en un equipo limpio.

## 3. Historial de commits

Los commits creados mediante la integración actual son no firmados. No se reescribirá el historial de Fases cerradas para firmarlo retroactivamente porque eso invalidaría SHAs, backups, manifests y trazabilidad.

Si se requiere firma criptográfica para la promoción, el commit/tag de promoción debe crearse y firmarse mediante una identidad Git/GPG/SSH autorizada fuera de esta integración.

## 4. Release público

Solo después de cumplir los gates anteriores:

1. validar el manifiesto final del candidato;
2. publicar exactamente los artefactos cuyos hashes fueron validados;
3. adjuntar SHA-256;
4. no reconstruir binarios entre validación y publicación;
5. crear el Release/tag firmado cuando proceda.

Hasta entonces, los artefactos de GitHub Actions son candidatos internos y no un release público.
