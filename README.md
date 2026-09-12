# ValiStruct 3.0 RC6

**Autor y desarrollador académico:**  
Dr. Roberto Joel Tirado Reyes  
Profesor-investigador, Universidad Autónoma de Sinaloa

## Objetivo
RC6 convierte la validación pendiente en una batería automatizada y reproducible.

### Incluye
- comparación numérica contra R/lavaan para CFA continuo MLR;
- comparación numérica para CFA ordinal WLSMV;
- validación de cargas estandarizadas;
- pytest del backend;
- Playwright;
- smoke del backend;
- workflow de GitHub Actions;
- `beta_gate.py`;
- manifiesto de integridad SHA-256.

## Validación local
```bash
python tests/validate_release.py
python tests/beta_gate.py
```

## Validación completa
En un entorno con R/lavaan y dependencias instaladas:

```bash
deployment/run_full_validation.sh
```

## Estado
**3.0.0-rc.6 — Release Candidate.**

No debe promoverse a Beta 1 mientras `beta_gate.py` reporte pruebas obligatorias omitidas o fallidas.
