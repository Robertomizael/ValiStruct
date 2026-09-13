#!/usr/bin/env bash
set -euo pipefail

echo "ValiStruct 2.9 - instalador asistido"
echo "1) Verificando Docker..."
command -v docker >/dev/null || { echo "Docker no está instalado."; exit 1; }

echo "2) Verificando Docker Compose..."
docker compose version >/dev/null || { echo "Docker Compose no está disponible."; exit 1; }

echo "3) Preparando directorios persistentes..."
mkdir -p ./data/projects ./data/backups

echo "4) Construyendo servicios..."
docker compose up -d --build

echo "5) Instalación iniciada."
echo "Revise /health, /self-test y /monitor antes de abrir el acceso."
