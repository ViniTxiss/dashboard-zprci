#!/bin/bash
# Script de inicialização para Render
# Garante que o PYTHONPATH está configurado corretamente

export PYTHONPATH="${PYTHONPATH}:."
cd /opt/render/project/src || cd "$(dirname "$0")/.." || exit 1

# Verificar se estamos no diretório correto
if [ ! -d "backend" ]; then
    echo "ERRO: Diretório 'backend' não encontrado!"
    echo "Diretório atual: $(pwd)"
    echo "Conteúdo: $(ls -la)"
    exit 1
fi

# Executar Gunicorn
exec gunicorn backend.app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --pythonpath .
