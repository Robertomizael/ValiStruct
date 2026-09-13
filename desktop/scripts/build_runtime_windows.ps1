$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$envDir = Join-Path $root 'runtime-env'
$outDir = Join-Path $root 'desktop/runtime'
conda install -y -n base -c conda-forge conda-pack
conda create -y -p $envDir -c conda-forge python=3.12 pip r-base r-jsonlite r-lavaan r-psych r-naniar
& (Join-Path $envDir 'python.exe') -m pip install --upgrade pip
& (Join-Path $envDir 'python.exe') -m pip install -r (Join-Path $root 'backend/requirements.txt')
& (Join-Path $envDir 'python.exe') -c "import flask, flask_cors, pandas, openpyxl, pyreadstat; print('Python runtime OK')"
$rscript = Join-Path $envDir 'Scripts/Rscript.exe'
if (!(Test-Path $rscript)) { $rscript = Join-Path $envDir 'Library/bin/Rscript.exe' }
& $rscript -e "library(jsonlite); library(lavaan); library(psych); library(naniar); cat('R runtime OK\n')"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
conda pack -p $envDir -o (Join-Path $outDir 'valistruct-runtime.tar.gz')
