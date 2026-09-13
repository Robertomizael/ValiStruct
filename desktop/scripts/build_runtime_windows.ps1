$ErrorActionPreference = 'Stop'
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
& $rscript -e "library(jsonlite); library(lavaan); library(psych); library(naniar); cat('R runtime OK\n')"

conda-pack -p $envDir -o $archive
if (!(Test-Path $archive)) { throw 'The autonomous runtime archive was not created.' }
if ((Get-Item $archive).Length -le 0) { throw 'The autonomous runtime archive is empty.' }
Write-Host "Runtime autonomous archive created: $archive"
