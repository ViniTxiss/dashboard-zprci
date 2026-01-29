"""
Rotas para dados de Encerramentos
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
try:
    from services.data_loader import get_loader
    from services.aggregations import get_encerrados_by_object
except ImportError:
    from backend.services.data_loader import get_loader
    from backend.services.aggregations import get_encerrados_by_object

router = APIRouter()


def _filter_by_state(df, estado: Optional[str] = None):
    """Filtra DataFrame por estado se fornecido"""
    if estado and estado.strip():
        return df[df['estado'] == estado.strip().upper()].copy()
    return df


@router.get("/por-objeto")
async def encerrados_por_objeto(estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")):
    """Retorna encerramentos agregados por objeto da ação"""
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        result = get_encerrados_by_object(df)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
