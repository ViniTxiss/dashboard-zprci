"""
Rotas para dados de Saldo
"""

from fastapi import APIRouter, HTTPException
try:
    from services.data_loader import get_loader
    from services.aggregations import get_saldo, get_resumo_saldo
except ImportError:
    from backend.services.data_loader import get_loader
    from backend.services.aggregations import get_saldo, get_resumo_saldo

router = APIRouter()


@router.get("/")
async def saldo_entradas_encerramentos():
    """Retorna saldo entre entradas e encerramentos"""
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        result = get_saldo(df)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/por-objeto")
async def saldo_por_objeto():
    """Retorna saldo entre entradas e encerramentos agrupado por objeto da ação"""
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        result = get_resumo_saldo(df)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
