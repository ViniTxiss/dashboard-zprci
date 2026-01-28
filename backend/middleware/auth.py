"""
Middleware de Autenticação - API Key
Protege todas as rotas da API com autenticação básica via API Key
"""

import os
from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import logging

logger = logging.getLogger(__name__)

# Nome do header para API Key
API_KEY_HEADER = "X-API-Key"

# Rotas públicas que não precisam de autenticação
PUBLIC_ROUTES = [
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/"
]

# Obter API Key das variáveis de ambiente
API_KEY = os.getenv("API_KEY", None)

# Se não houver API_KEY configurada, gerar um aviso mas permitir acesso (desenvolvimento)
if not API_KEY:
    logger.warning(
        "API_KEY não configurada. Sistema rodando SEM autenticação. "
        "Configure a variável de ambiente API_KEY para produção."
    )


class APIKeyMiddleware(BaseHTTPMiddleware):
    """
    Middleware para autenticação via API Key.
    Verifica o header X-API-Key em todas as requisições, exceto rotas públicas.
    """
    
    async def dispatch(self, request: Request, call_next):
        # Verificar se é uma rota pública
        if any(request.url.path.startswith(route) for route in PUBLIC_ROUTES):
            return await call_next(request)
        
        # Se não há API_KEY configurada, permitir acesso (modo desenvolvimento)
        if not API_KEY:
            return await call_next(request)
        
        # Obter API Key do header
        api_key = request.headers.get(API_KEY_HEADER)
        
        if not api_key:
            logger.warning(f"Requisição sem API Key: {request.url.path} de {request.client.host}")
            raise HTTPException(
                status_code=401,
                detail="API Key não fornecida. Adicione o header X-API-Key."
            )
        
        # Verificar se a API Key está correta
        if api_key != API_KEY:
            logger.warning(f"API Key inválida: {request.url.path} de {request.client.host}")
            raise HTTPException(
                status_code=403,
                detail="API Key inválida."
            )
        
        # API Key válida, continuar com a requisição
        logger.debug(f"Requisição autenticada: {request.url.path}")
        return await call_next(request)


def get_api_key_header():
    """
    Função auxiliar para usar em dependências do FastAPI.
    Útil para documentação automática no Swagger.
    """
    return APIKeyHeader(name=API_KEY_HEADER, auto_error=False)


def verify_api_key(api_key: str = Security(get_api_key_header)) -> bool:
    """
    Dependency para verificar API Key em rotas específicas.
    Uso: @router.get("/rota", dependencies=[Depends(verify_api_key)])
    """
    if not API_KEY:
        # Modo desenvolvimento: permitir acesso
        return True
    
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="API Key não fornecida"
        )
    
    if api_key != API_KEY:
        raise HTTPException(
            status_code=403,
            detail="API Key inválida"
        )
    
    return True
