"""
Dashboard Web - Backend FastAPI
Substituição Total do Power BI
"""

import json
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Imports relativos para funcionar quando executado da raiz
try:
    # Tentar import absoluto primeiro (desenvolvimento local)
    from routes import (
        entradas, encerramentos, saldo, mapas, indicadores
    )
    from middleware.auth import APIKeyMiddleware
except ImportError:
    # Se falhar, tentar import relativo (produção/deploy)
    from backend.routes import (
        entradas, encerramentos, saldo, mapas, indicadores
    )
    from backend.middleware.auth import APIKeyMiddleware

# Debug log (apenas em desenvolvimento)
_DEBUG_LOG = None
if os.getenv("ENVIRONMENT", "development") == "development":
    try:
        # Tentar criar log apenas se estiver em desenvolvimento e o diretório existir
        debug_dir = Path(__file__).parent.parent / ".cursor"
        if debug_dir.exists():
            _DEBUG_LOG = debug_dir / "debug.log"
    except:
        _DEBUG_LOG = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    # #region agent log
    if _DEBUG_LOG:
        try:
            _DEBUG_LOG.parent.mkdir(parents=True, exist_ok=True)
            with open(_DEBUG_LOG, "a", encoding="utf-8") as f:
                f.write(json.dumps({"timestamp":int(time.time()*1000),"location":"app.startup","message":"backend_started","data":{"port_note":"bind_ok_if_this_log_exists"},"sessionId":"debug-session","hypothesisId":"H4"}) + "\n")
        except Exception: pass
    # #endregion
    
    # Tentar baixar arquivos de dados de storage externo (S3) se configurado
    # Isso permite manter arquivos Excel sensíveis fora do repositório Git
    try:
        from backend.services.storage_loader import download_data_files_from_storage
        backend_dir = Path(__file__).parent
        data_dir = backend_dir / "data"
        download_results = download_data_files_from_storage(data_dir)
        if download_results.get('principal') or download_results.get('novos_casos'):
            print("✓ Arquivos de dados baixados do storage externo")
        elif download_results.get('errors'):
            print(f"⚠ Avisos ao baixar arquivos: {download_results['errors']}")
    except ImportError:
        # boto3 não instalado ou storage não configurado - usar arquivos locais
        pass
    except Exception as e:
        print(f"⚠ Erro ao baixar arquivos do storage externo (usando arquivos locais): {e}")

    # Shutdown (se necessário adicionar código aqui)
    yield


app = FastAPI(
    title="Dashboard Executivo",
    description="Dashboard Web - Substituição do Power BI",
    version="1.0.0",
    lifespan=lifespan
)

# CORS para permitir requisições do frontend
# Para produção, configure allow_origins com URLs específicas
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
if ALLOWED_ORIGINS == ["*"]:
    # Desenvolvimento: permitir todas as origens
    allow_origins = ["*"]
else:
    # Produção: apenas origens específicas
    # Também permite localhost para desenvolvimento local
    allow_origins = [origin.strip() for origin in ALLOWED_ORIGINS]
    # Adicionar localhost para desenvolvimento local (se não estiver em produção)
    if os.getenv("ENVIRONMENT", "development") == "development":
        allow_origins.extend(["http://localhost:8080", "http://127.0.0.1:8080", "http://localhost:5500"])

# Middleware de CORS (deve vir antes do middleware de autenticação)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],  # Permite X-API-Key header
)

# Middleware de Autenticação (API Key)
# Apenas ativa se API_KEY estiver configurada nas variáveis de ambiente
app.add_middleware(APIKeyMiddleware)

# Registrar rotas
app.include_router(entradas.router, prefix="/api/entradas", tags=["Entradas"])
app.include_router(encerramentos.router, prefix="/api/encerramentos", tags=["Encerramentos"])
app.include_router(saldo.router, prefix="/api/saldo", tags=["Saldo"])
app.include_router(mapas.router, prefix="/api/mapas", tags=["Mapas"])
app.include_router(indicadores.router, prefix="/api/indicadores", tags=["Indicadores"])


@app.get("/")
async def root():
    return {"message": "Dashboard API - Backend funcionando"}


@app.get("/health")
async def health():
    return {"message": "Dashboard API - Backend funcionando"}


# Via CLI: python -m uvicorn app:app --host 127.0.0.1 --port 8001
# (api.js usa 8001; se 10048, libere a porta ou use --port 8002 e altere API_BASE_URL no frontend)
# Em produção (Render/Vercel), use Gunicorn. Não execute uvicorn diretamente.
if __name__ == "__main__":
    # Apenas executar uvicorn em desenvolvimento local
    # Em produção, o Render/Vercel deve usar Gunicorn
    if os.getenv("ENVIRONMENT", "development") == "development":
        import uvicorn
        port = 8001
        while port <= 8010:
            try:
                uvicorn.run(app, host="0.0.0.0", port=port)
                break
            except OSError as e:
                err = getattr(e, "errno", None) or getattr(e, "winerror", None)
                if err == 10048 and port < 8010:
                    print(f"Porta {port} em uso. Tentando {port + 1}... Atualize API_BASE_URL em frontend/js/api.js para http://localhost:{port + 1}/api se for usar outra porta.")
                    port += 1
                    continue
                raise
    else:
        # Em produção, não executar uvicorn diretamente
        print("⚠️  Este script não deve ser executado diretamente em produção.")
        print("   Use Gunicorn: gunicorn backend.app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --pythonpath .")
        import sys
        sys.exit(1)
