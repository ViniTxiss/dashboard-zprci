#!/bin/bash
# Script de inicialização para produção

echo "🚀 Iniciando Dashboard Backend em modo produção..."

# Ativar ambiente virtual se existir
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Verificar se o arquivo de dados existe
if [ ! -f "backend/data/BASE_TRATADA_FINAL.xlsx" ]; then
    echo "⚠️  AVISO: Arquivo BASE_TRATADA_FINAL.xlsx não encontrado em backend/data/"
    echo "   O sistema funcionará, mas sem dados."
fi

# Verificar se gunicorn está instalado
if ! command -v gunicorn &> /dev/null; then
    echo "📦 Instalando gunicorn..."
    pip install gunicorn
fi

# Iniciar backend com gunicorn
cd backend
echo "✅ Iniciando servidor na porta 8001..."
gunicorn app:app \
    -w 4 \
    -k uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8001 \
    --access-logfile - \
    --error-logfile - \
    --log-level info
