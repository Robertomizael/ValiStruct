$ErrorActionPreference = 'Stop'
# Hotfix v5.4: sin esto, un comando nativo con codigo != 0 (p. ej. Rscript que no
# logra cargar lavaan) NO detenia el script y el CI seguia empaquetando.
$PSNativeCommandUseErrorActionPreference = $true
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$envDir = Join-Path $root 'runtime-env'
$outDir = Join-Path $root 'desktop/runtime'
$archive = Join-Path $outDir 'valistruct-runtime.tar.gz'

if (Test-Path $envDir) { Remove-Item -Recurse -Force $envDir }
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
if (Test-Path $archive) { Remove-Item -Force $archive }

conda install -y -n base -c conda-forge conda-pack
conda create -y -p $envDir -c conda-forge python=3.12 pip r-base r-jsonlite r-lavaan r-psych r-naniar

$python = Join-Path $envDir 'python.exe'
& $python -m pip install --upgrade pip
& $python -m pip install -r (Join-Path $root 'backend/requirements.txt')
& $python -c "import flask, flask_cors, pandas, openpyxl, pyreadstat, docx, bs4, xlsxwriter, portalocker; print('Python runtime OK')"

$rscript = Join-Path $envDir 'Scripts/Rscript.exe'
if (!(Test-Path $rscript)) { $rscript = Join-Path $envDir 'Library/bin/Rscript.exe' }
if (!(Test-Path $rscript)) { throw 'Rscript.exe was not found in the integrated runtime.' }

# IMPORTANTE: desde este punto las pruebas de R deben ejecutarse con el mismo
# entorno que usa desktop/main.js y la puerta de runtime reubicado. En Windows,
# Rscript.exe puede existir pero abortar con 0xC0000135 si Library\bin y las DLL
# de R no estan en PATH. Preparar el entorno ANTES de la primera invocacion evita
# que el build dependa accidentalmente del PATH del runner de GitHub.
$rHomeCandidates = @(
  (Join-Path $envDir 'Lib\R'),
  (Join-Path $envDir 'Library\lib\R')
) | Where-Object { Test-Path $_ }
$rHome = $rHomeCandidates | Select-Object -First 1
if (!$rHome) { throw 'R_HOME no fue encontrado en el runtime integrado.' }
$runtimePathDirs = @(
  $envDir,
  (Join-Path $envDir 'Scripts'),
  (Join-Path $envDir 'Library\bin'),
  (Join-Path $rHome 'bin\x64')
) | Where-Object { Test-Path $_ }
$env:PATH = (@($runtimePathDirs) + $env:PATH) -join ';'
$env:CONDA_PREFIX = $envDir
$env:R_HOME = $rHome
Remove-Item Env:R_LIBS_USER -ErrorAction SilentlyContinue
Remove-Item Env:R_LIBS -ErrorAction SilentlyContinue
Write-Host "Rscript integrado: $rscript"
Write-Host "R_HOME integrado : $env:R_HOME"

& $rscript -e "library(jsonlite); library(lavaan); library(psych); library(naniar); cat('R runtime OK\n')"

$condaRoot = $env:CONDA
if ([string]::IsNullOrWhiteSpace($condaRoot)) {
  $condaRoot = (& conda info --base).Trim()
}

# ---------------------------------------------------------------------------
# Hotfix v5.4 (Windows): "Mingw-w64 runtime failure: 32 bit pseudo relocation
# ... out of range".
# Causa: conda-forge r-base 4.5.x usa Rblas.dll/Rlapack.dll como DLL forwarder;
# r-quadprog 1.5_8 (r45ha84b8e4_7, 2025-09-09, unica compilacion R 4.5 win-64)
# se enlazo contra la DLL y quedo con 4 pseudo-relocaciones de 32 bits hacia
# Rblas.dll (dscal_, daxpy_, ddot_). lavaan importa quadprog, asi que
# library(lavaan) aborta cuando ASLR coloca la BLAS a mas de 2 GB.
# Ref.: conda-forge/r-base-feedstock#428 y #432 (r-base 4.5.3 *_4 ya instala
# Rblas.lib/Rlapack.lib).
# Correccion: recompilar EL MISMO codigo fuente quadprog 1.5-8 (SHA256 del
# feedstock oficial) con el mismo compilador del entorno, ahora contra
# Rblas.lib, y sustituir solo quadprog.dll. No cambia versiones ni codigo R.
# Se desactiva sola cuando conda-forge publique un quadprog ya corregido.
# ---------------------------------------------------------------------------
$basePython = Join-Path $condaRoot 'python.exe'
& $basePython -m pip install --disable-pip-version-check pefile==2024.8.26
$peGate = Join-Path $PSScriptRoot 'check_pe_pseudo_relocs.py'
$rHome = Join-Path $envDir 'Lib/R'
$quadprogDll = Join-Path $rHome 'library/quadprog/libs/x64/quadprog.dll'
if (!(Test-Path $quadprogDll)) { throw "quadprog.dll no encontrado en $quadprogDll" }

$PSNativeCommandUseErrorActionPreference = $false
& $basePython $peGate $quadprogDll | Out-Host
$quadprogNeedsRebuild = ($LASTEXITCODE -ne 0)
$PSNativeCommandUseErrorActionPreference = $true

if ($quadprogNeedsRebuild) {
  $quadprogVersion = '1.5-8'
  $quadprogSha256 = '22128dd6b08d3516c44ff89276719ad4fe46b36b23fdd585274fa3a93e7a49cd'

  $installedVersion = (& $rscript -e "cat(as.character(packageVersion('quadprog')))").Trim()
  if ($installedVersion -ne $quadprogVersion) {
    throw "quadprog instalado es $installedVersion; el hotfix solo esta validado para $quadprogVersion."
  }
  $rblasLib = Join-Path $rHome 'bin/x64/Rblas.lib'
  if (!(Test-Path $rblasLib)) {
    throw 'r-base no incluye Rblas.lib; se requiere r-base 4.5.3 build *_4 o posterior (conda-forge/r-base-feedstock#432).'
  }

  $work = Join-Path $root 'runtime-quadprog-rebuild'
  $toolsDir = Join-Path $work 'tools-env'
  $tmpLib = Join-Path $work 'lib'
  if (Test-Path $work) { Remove-Item -Recurse -Force $work }
  New-Item -ItemType Directory -Force -Path $tmpLib | Out-Null

  conda create -y -p $toolsDir -c conda-forge m2-make m2-sed m2-coreutils m2-bash m2-filesystem

  $tarball = Join-Path $work "quadprog_$quadprogVersion.tar.gz"
  $urls = @(
    "https://cloud.r-project.org/src/contrib/quadprog_$quadprogVersion.tar.gz",
    "https://cloud.r-project.org/src/contrib/Archive/quadprog/quadprog_$quadprogVersion.tar.gz"
  )
  foreach ($u in $urls) {
    try { Invoke-WebRequest -Uri $u -OutFile $tarball -UseBasicParsing; break } catch { Write-Host "No disponible: $u" }
  }
  if (!(Test-Path $tarball)) { throw 'No se pudo descargar el codigo fuente de quadprog.' }
  $hash = (Get-FileHash -Algorithm SHA256 $tarball).Hash.ToLowerInvariant()
  if ($hash -ne $quadprogSha256) { throw "SHA256 de quadprog no coincide: $hash" }

  $refScript = "library(quadprog); r <- solve.QP(diag(3), c(0,5,0), matrix(c(-4,-3,0,2,1,0,0,-2,1),3,3), c(-8,2,0)); cat(sprintf('%.17g', c(r`$solution, r`$value)), sep=';')"
  $PSNativeCommandUseErrorActionPreference = $false
  $refOriginal = (& $rscript -e $refScript 2>$null)
  $refOriginalOk = ($LASTEXITCODE -eq 0)
  $PSNativeCommandUseErrorActionPreference = $true

  $savedPath = $env:PATH
  try {
    $env:PATH = @(
      (Join-Path $envDir 'Library/bin'),
      (Join-Path $rHome 'bin/x64'),
      (Join-Path $toolsDir 'Library/usr/bin'),
      $savedPath
    ) -join ';'
    $tarR = $tarball -replace '\\', '/'
    $libR = $tmpLib -replace '\\', '/'
    & $rscript -e "install.packages('$tarR', repos = NULL, type = 'source', lib = '$libR', INSTALL_opts = c('--no-docs', '--no-html', '--no-multiarch')); if (!file.exists(file.path('$libR', 'quadprog', 'libs', 'x64', 'quadprog.dll'))) quit(status = 1)"
  } finally {
    $env:PATH = $savedPath
  }

  $newDll = Join-Path $tmpLib 'quadprog/libs/x64/quadprog.dll'
  & $basePython $peGate $newDll
  $refRebuilt = (& $rscript -e ($refScript -replace 'library\(quadprog\)', "library(quadprog, lib.loc = '$libR')")).Trim()
  $expected = @((10 / 21), (22 / 21), (44 / 21), (-50 / 21))
  $got = $refRebuilt.Split(';') | ForEach-Object { [double]::Parse($_, [Globalization.CultureInfo]::InvariantCulture) }
  for ($i = 0; $i -lt 4; $i++) {
    if ([math]::Abs($got[$i] - $expected[$i]) -gt 1e-10) { throw "quadprog recompilado da un resultado inesperado: $refRebuilt" }
  }
  if ($refOriginalOk -and ($refOriginal.Trim() -ne $refRebuilt)) {
    throw "quadprog recompilado no reproduce exactamente al original: '$($refOriginal.Trim())' vs '$refRebuilt'"
  }
  Write-Host "quadprog solve.QP original : $(if ($refOriginalOk) { $refOriginal.Trim() } else { 'no cargo (fallo esperado por pseudo-relocacion)' })"
  Write-Host "quadprog solve.QP recompil.: $refRebuilt"

  Remove-Item -Force $quadprogDll
  Copy-Item $newDll $quadprogDll
  Remove-Item -Recurse -Force $work
  Write-Host 'quadprog.dll sustituido por la version enlazada contra Rblas.lib.'
}

& $basePython $peGate $envDir --min-dlls 40 --report (Join-Path $outDir 'pe-pseudo-reloc-report.json')
& $rscript -e "library(jsonlite); library(lavaan); library(psych); library(naniar); cat('R runtime OK tras hotfix\n')"
$condaPack = Join-Path $condaRoot 'Scripts/conda-pack.exe'
if (!(Test-Path $condaPack)) {
  $found = Get-ChildItem -Path $condaRoot -Filter 'conda-pack.exe' -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found) { $condaPack = $found.FullName }
}
if (!(Test-Path $condaPack)) { throw 'conda-pack.exe was not found in the base environment.' }

& $condaPack -p $envDir -o $archive
if (!(Test-Path $archive)) { throw 'The autonomous runtime archive was not created.' }
if ((Get-Item $archive).Length -le 0) { throw 'The autonomous runtime archive is empty.' }
Write-Host "Runtime autonomous archive created: $archive"
