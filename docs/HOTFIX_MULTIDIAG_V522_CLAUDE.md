# ValiStruct v5.2.2 Beta — Hotfix Mahalanobis / Mardia
Director científico: Dr. Roberto Joel Tirado Reyes.

## Defecto reportado
En Diagnóstico multivariado, el botón "Ejecutar diagnóstico multivariado" no producía resultados aunque se habían importado 350 participantes y 28 variables. La auditoría del código detectó que `runMultiDiagnostics` invocaba `mean` y `covariance`, funciones ausentes de `app.js`. El error no era capturado ni mostrado en pantalla.

## Corrección de alcance limitado
- Restaurar auxiliares estadísticos `mean`, `variance` y `covariance` con divisor muestral n−1 en la covarianza.
- Hacer que el botón `Calcular Mahalanobis y Mardia` comunique el estado del análisis y errores de manera accesible, sin bloquearse permanentemente.
- Calcular D² por caso completo; conservar correspondencia con el número de fila original y cantidad de casos excluidos. La salida CSV incluye todas las D² y una columna que marca si superan el umbral configurado.
- Optimizar Mardia de O(n²p²) a O(np²+n²p), utilizando la matriz de covarianza ML (divisor n); no confundir su estimación con la distancia D² basada en covarianza muestral.
- Mostrar los casos señalados por Mahalanobis sin eliminarlos automáticamente.
- Actualizar el cache PWA y compilar Electron como versión 5.2.2-beta.1 cuando se hayan validado los archivos.
- No modificar Aiken ni el importador de JASP, ni añadir métodos no comprobados a AFE.

## Pruebas
`tests/test_multidiag_recovery.py` comprueba la interacción real del botón, datos de ejemplo, 350×28 con un faltante, matriz singular y exportaciones CSV/HTML. Se compara la media de distancias D² con la identidad muestral p(n−1)/n. GitHub Actions: `.github/workflows/multidiag-recovery.yml`.

## Solicitud para Claude
Auditar diferencias con `fix/v5-2-afe-estadistica-exportaciones`: comprobar ausencia de referencias no definidas, significado muestral de D², contraste con `stats::mahalanobis` de R, pruebas de Mardia, p y aproximación χ², rechazo de singularidad, tiempo de ejecución para n≥350/p≥28, privacidad y exportación de filas originales. No fusionar a main sin revisión y pruebas del instalador.
