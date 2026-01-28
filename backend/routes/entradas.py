"""
Rotas para dados de Entradas
"""

import json
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from services.data_loader import get_loader
from services.aggregations import get_entradas_by_object

router = APIRouter()
_DEBUG_LOG = Path(r"c:\Users\vini\Desktop\zappa + html v2\.cursor\debug.log")


def _filter_by_state(df, estado: Optional[str] = None):
    """Filtra DataFrame por estado se fornecido"""
    if estado and estado.strip():
        return df[df['estado'] == estado.strip().upper()].copy()
    return df


@router.get("/por-objeto")
async def entradas_por_objeto(estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")):
    """Retorna entradas agregadas por objeto da ação"""
    # #region agent log
    try:
        with open(_DEBUG_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps({"timestamp":int(time.time()*1000),"location":"entradas.entradas_por_objeto","message":"entry","data":{"estado":estado},"sessionId":"debug-session","hypothesisId":"H3"}) + "\n")
    except Exception: pass
    # #endregion
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        result = get_entradas_by_object(df)
        # #region agent log
        try:
            dados = result.get("dados") or []
            sample = (dados[0] if dados else {})
            with open(_DEBUG_LOG, "a", encoding="utf-8") as f:
                f.write(json.dumps({"timestamp":int(time.time()*1000),"location":"entradas.entradas_por_objeto","message":"result","data":{"len_dados":len(dados),"keys_sample":list(sample.keys())[:10],"has_2022":2022 in sample or "2022" in sample},"sessionId":"debug-session","hypothesisId":"H3"}) + "\n")
        except Exception: pass
        # #endregion
        return result
    except Exception as e:
        # #region agent log
        try:
            with open(_DEBUG_LOG, "a", encoding="utf-8") as f:
                f.write(json.dumps({"timestamp":int(time.time()*1000),"location":"entradas.entradas_por_objeto","message":"exception","data":{"err":str(e)},"sessionId":"debug-session","hypothesisId":"H1"}) + "\n")
        except Exception: pass
        # #endregion
        raise HTTPException(status_code=500, detail=str(e))
