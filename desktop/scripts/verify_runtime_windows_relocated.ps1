# ValiStruct v5.4 - Prueba de runtime Windows REUBICADO (puerta previa al .exe)
#
# Reproduce lo que hace desktop/main.js en el equipo del usuario, pero en una
# ruta distinta, larga y con espacios:
#   1. extrae valistruct-runtime.tar.gz con el mismo modulo `tar` de Node;
#   2. ejecuta conda-unpack;
#   3. construye el mismo PATH / R_HOME / CONDA_PREFIX que runtimeExecutables();
#   4. Python --version e imports del backend;
#   5. Rscript --version;
#   6. library(jsonlite, lavaan, psych, naniar) - el mismo comando de main.js;
#   7. calculo minimo con lavaan (CFA Holzinger-Swineford), psych y quadprog;
#   8. puerta estatica de pseudo-relocaciones de 32 bits sobre el arbol extraido.
#
# Importante: el fallo "32 bit pseudo relocation out of range" depende de ASLR
# (direcciones asignadas por Windows en cada arranque), por eso los pasos 6-7
# pueden pasar por azar en el runner. El paso 8 es determinista y es el que
# garantiza que el defecto no viaja al usuario. Cualquier fallo detiene el job.
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$desktopDir = Join-Path $root 'desktop'
$archive = Join-Path $desktopDir 'runtime/valistruct-runtime.tar.gz'
if (!(Test-Path $archive)) { throw "No existe $archive" }

$base = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [IO.Path]::GetTempPath() }
$runtimeDir = Join-Path $base 'ValiStruct Relocation Test\Usuario de Prueba Con Nombre Largo\AppData\Roaming\valistruct-desktop\runtime-v2'
if (Test-Path $runtimeDir) { Remove-Item -Recurse -Force $runtimeDir }
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
Write-Host "Ruta de prueba ($($runtimeDir.Length) caracteres): $runtimeDir"

# 1. Extraccion identica a main.js (tar.x de node-tar instalado por npm ci).
Push-Location $desktopDir
try {
  $env:VS_ARCHIVE = $archive
  $env:VS_DEST = $runtimeDir
  node -e "require('tar').x({ file: process.env.VS_ARCHIVE, cwd: process.env.VS_DEST }).then(() => console.log('Extraccion OK'))"
} finally {
  Pop-Location
}

# 3. Mismo entorno que runtimeExecutables() de main.js.
$pathDirs = @(
  $runtimeDir,
  (Join-Path $runtimeDir 'Scripts'),
  (Join-Path $runtimeDir 'Library\bin'),
  (Join-Path $runtimeDir 'Lib\R\bin\x64')
) | Where-Object { Test-Path $_ }
$env:PATH = (@($pathDirs) + $env:PATH) -join ';'
$env:CONDA_PREFIX = $runtimeDir
$rHome = @((Join-Path $runtimeDir 'Lib\R'), (Join-Path $runtimeDir 'Library\lib\R')) | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($rHome) { $env:R_HOME = $rHome }
Remove-Item Env:R_LIBS_USER -ErrorAction SilentlyContinue
Remove-Item Env:R_LIBS -ErrorAction SilentlyContinue

$python = @((Join-Path $runtimeDir 'python.exe'), (Join-Path $runtimeDir 'Scripts\python.exe')) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (!$python) { throw 'Python no encontrado en el runtime reubicado.' }

# 2. conda-unpack (misma preferencia que main.js).
$unpack = @((Join-Path $runtimeDir 'Scripts\conda-unpack-script.py'), (Join-Path $runtimeDir 'Scripts\conda-unpack.exe')) | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($unpack) {
  Push-Location $runtimeDir
  try {
    if ($unpack.ToLower().EndsWith('.exe')) { & $unpack } else { & $python $unpack }
  } finally { Pop-Location }
  Write-Host "conda-unpack OK ($unpack)"
} else {
  Write-Host 'ADVERTENCIA: no se encontro conda-unpack (main.js tampoco lo ejecutaria).'
}

$rscript = @(
  (Join-Path $runtimeDir 'Scripts\Rscript.exe'),
  (Join-Path $runtimeDir 'Library\bin\Rscript.exe'),
  (Join-Path $runtimeDir 'Lib\R\bin\x64\Rscript.exe'),
  (Join-Path $runtimeDir 'Lib\R\bin\Rscript.exe')
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (!$rscript) { throw 'Rscript no encontrado en el runtime reubicado.' }
Write-Host "Python : $python"
Write-Host "Rscript: $rscript"
Write-Host "R_HOME : $env:R_HOME"

# 4. Python.
& $python --version
& $python -c "import flask, flask_cors, pandas, openpyxl, pyreadstat, docx, bs4, xlsxwriter, portalocker; print('Python backend imports OK')"

# 5. Rscript --version.
& $rscript --version

# 6. Comando exacto de main.js.
& $rscript -e 'library(jsonlite); library(lavaan); library(psych); library(naniar); cat("OK\n")'

# 7. Calculo minimo. Valores de referencia: modelo HS de 3 factores del tutorial
#    de lavaan (chisq = 85.306, df = 24); solve.QP con solucion exacta 10/21, 22/21, 44/21.
$smoke = @'
suppressPackageStartupMessages({
  library(jsonlite); library(lavaan); library(psych); library(naniar); library(quadprog)
})
stopifnot(normalizePath(R.home(), winslash = "/") == normalizePath(Sys.getenv("R_HOME"), winslash = "/"))
ext <- .libPaths()[!startsWith(normalizePath(.libPaths(), winslash = "/"), normalizePath(R.home(), winslash = "/"))]
if (length(ext)) message("ADVERTENCIA: bibliotecas R externas al runtime en .libPaths(): ", paste(ext, collapse = "; "))
for (p in c("jsonlite", "lavaan", "psych", "naniar", "quadprog")) {
  stopifnot(startsWith(normalizePath(find.package(p), winslash = "/"), normalizePath(R.home(), winslash = "/")))
}
hs <- lavaan::HolzingerSwineford1939
fit <- lavaan::cfa("visual =~ x1 + x2 + x3\ntextual =~ x4 + x5 + x6\nspeed =~ x7 + x8 + x9", data = hs)
stopifnot(lavaan::lavInspect(fit, "converged"))
fm <- lavaan::fitMeasures(fit, c("chisq", "df", "cfi", "rmsea"))
stopifnot(abs(fm[["chisq"]] - 85.306) < 0.001, fm[["df"]] == 24)
a <- psych::alpha(hs[, c("x1", "x2", "x3")], warnings = FALSE)
f <- psych::fa(hs[, paste0("x", 1:9)], nfactors = 3, rotate = "varimax", fm = "ml")
qp <- quadprog::solve.QP(diag(3), c(0, 5, 0), matrix(c(-4, -3, 0, 2, 1, 0, 0, -2, 1), 3, 3), c(-8, 2, 0))
stopifnot(max(abs(qp$solution - c(10, 22, 44) / 21)) < 1e-10)
miss <- naniar::n_miss(airquality)
cat(jsonlite::toJSON(list(
  r = R.version.string, lavaan = as.character(packageVersion("lavaan")),
  psych = as.character(packageVersion("psych")), quadprog = as.character(packageVersion("quadprog")),
  chisq = unname(fm[["chisq"]]), df = unname(fm[["df"]]), cfi = unname(fm[["cfi"]]), rmsea = unname(fm[["rmsea"]]),
  alpha_visual = a$total$raw_alpha, fa_converged = !is.null(f$loadings), qp = qp$solution, airquality_nmiss = miss
), auto_unbox = TRUE, digits = 10), "\n")
'@
$smokeFile = Join-Path $base 'valistruct-relocated-smoke.R'
Set-Content -Path $smokeFile -Value $smoke -Encoding UTF8
& $rscript $smokeFile

# 8. Puerta estatica determinista sobre el arbol ya extraido y desempaquetado.
$condaRoot = $env:CONDA
if ([string]::IsNullOrWhiteSpace($condaRoot)) { $condaRoot = (& conda info --base).Trim() }
$basePython = Join-Path $condaRoot 'python.exe'
& $basePython -m pip install --disable-pip-version-check pefile==2024.8.26
& $basePython (Join-Path $PSScriptRoot 'check_pe_pseudo_relocs.py') $runtimeDir --min-dlls 40 --report (Join-Path $desktopDir 'runtime/pe-pseudo-reloc-relocated.json')

Write-Host 'RUNTIME REUBICADO: OK (todas las comprobaciones pasaron).'
