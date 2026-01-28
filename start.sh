#!/bin/bash
# Script de inicialização para Render
# Configura PYTHONPATH e inicia o servidor

export PYTHONPATH="${PYTHONPATH}:."
exec gunicorn backend.app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --pythonpath .
