# ValiStruct v5.2.4 Beta — corrección del Motor Pro y menú contextual nativo

**Autor conceptual y director científico:** Dr. Roberto Joel Tirado Reyes

## Incidencia observada en el DMG previo
Al ejecutar AFC/SEM con Motor Pro, la aplicación mostró: `valor ausente donde TRUE/FALSE es necesario`, en vez de calcular y presentar χ², grados de libertad, p, CFI, TLI, RMSEA y SRMR.

### Hallazgo técnico
El backend `backend/lavaan_engine.R` construía recomendaciones con comparaciones como `if (cfi_for_guidance >= .95)`. Para modelos saturados, estimaciones robustas no disponibles y algunos conjuntos de datos, lavaan puede devolver `NA` para índices de ajuste; comparar `NA >= .95` genera exactamente el error reportado. El resultado quedaba abortado antes de serializar la tabla de parámetros. Además, en la interfaz `Number(null)` se interpretaba como cero en ciertos campos. La falla se corrigió en la rama, no se atribuye a los participantes ni al equipo del usuario.

## Correcciones
- Convertir NA, NaN, Inf y valores de longitud distinta de uno en ausentes serializables (JSON null).
- Blindar los mensajes automáticos de CFI, TLI, RMSEA y SRMR para que no ejecuten condicionales con NA; validar remuestreos bootstrap.
- Presentar siempre los encabezados χ², gl, p, CFI, TLI, RMSEA (IC) y SRMR; marcar `No estimable` donde lavaan legítimamente no puede calcular el índice (en vez de mostrar cero o abortar).
- Conservar índices robustos, advertencias, cargas, convergencia, solución impropia e índices de modificación, sin inventar cifras.
- Menú contextual nativo Electron al pulsar botón derecho sobre cualquier campo editable: Deshacer, Rehacer, Cortar, Copiar, Pegar y Seleccionar todo. Si hay texto seleccionado en informes, permite Copiar y Seleccionar todo.
- Nuevo runtime empaquetado en el instalador beta 5.2.4; no se publicará ni fusionará hasta las pruebas.

## Pruebas obligatorias
1. `tests/test_motorpro_numerical_regression.py`: 350 casos × 28 ítems / 5 factores correlacionados MLR con índices cuantitativos finitos, caso saturado df=0 con indicadores robustos eventualmente no estimables, validación bootstrap inválido.
2. `tests/test_motorpro_recovery.py`: navegador -> Flask -> lavaan -> índices/descargas JSON, ejecución con parche de escritorio, fallos visibles y representaciones `No estimable`.
3. `tests/test_desktop_context_menu.cjs`: menú contextual nativo simulando clic derecho en editor de sintaxis, selección de informe y fondo vacío.
4. No regresión JASP y RC; generación y prueba manual DMG/EXE desde GitHub Actions.

**Claude:** contraste los estimadores y valores con R/lavaan utilizando idéntica base y modelo; investigue causas legítimas de índices NA (df=0, matriz singular, no convergencia y variantes robustas); inspeccione compatibilidad del menú nativo macOS/Windows y garantice que no hay doble envío a `/estimate`. No fusione a `main` sin autorización.
