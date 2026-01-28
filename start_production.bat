@echo off
REM Script de inicialização para produção (Windows)

echo Iniciando Dashboard Backend em modo producao...

REM Ativar ambiente virtual se existir
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
)

REM Verificar se o arquivo de dados existe
if not exist "backend\data\BASE_TRATADA_FINAL.xlsx" (
    echo AVISO: Arquivo BASE_TRATADA_FINAL.xlsx nao encontrado em backend\data\
    echo O sistema funcionara, mas sem dados.
)

REM Verificar se gunicorn está instalado
python -c "import gunicorn" 2>nul
if errorlevel 1 (
    echo Instalando gunicorn...
    pip install gunicorn
)

REM Iniciar backend com gunicorn
cd backend
echo Iniciando servidor na porta 8001...
gunicorn app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8001 --access-logfile - --error-logfile - --log-level info

pause
