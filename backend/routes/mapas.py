"""
Rotas para dados de Mapas
"""

import json
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
try:
    from services.data_loader import get_loader
    from services.aggregations import get_map_data, apply_global_filters
except ImportError:
    from backend.services.data_loader import get_loader
    from backend.services.aggregations import get_map_data, apply_global_filters

router = APIRouter()


@router.get("/nacional")
async def mapa_nacional(
    uf: Optional[str] = Query(None, description="Filtrar por estado (UF) - ex: SP, PA"),
    objeto: Optional[str] = Query(None, description="Filtrar por objeto da ação (cross-filter)")
):
    """Retorna dados para o mapa nacional"""
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = apply_global_filters(df, uf=uf, objeto=objeto)
        result = get_map_data(df)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/capitais")
async def mapa_capitais(
    uf: Optional[str] = Query(None, description="Filtrar por estado (UF) - ex: SP, PA")
):
    """Retorna dados de capitais para o mapa de análise de impacto"""
    try:
        # Carregar dados de capitais
        capitais_path = Path(__file__).parent.parent / "data" / "capitais_brasil.json"
        with open(capitais_path, 'r', encoding='utf-8') as f:
            capitais_data = json.load(f)
        
        # Se houver filtro UF, retornar apenas essa capital
        if uf and uf.strip():
            uf_upper = uf.strip().upper()
            if uf_upper in capitais_data:
                return {
                    'capitais': [{
                        'uf': uf_upper,
                        'capital': capitais_data[uf_upper]['capital'],
                        'lat': capitais_data[uf_upper]['lat'],
                        'lon': capitais_data[uf_upper]['lon']
                    }]
                }
            else:
                return {'capitais': []}
        
        # Retornar todas as capitais
        capitais = []
        for uf_code, data in capitais_data.items():
            capitais.append({
                'uf': uf_code,
                'capital': data['capital'],
                'lat': data['lat'],
                'lon': data['lon']
            })
        
        return {'capitais': capitais}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cidades-por-uf")
async def cidades_por_uf(
    uf: str = Query(..., description="Sigla do estado (UF) - ex: SP, PA")
):
    """Retorna cidades de um estado específico para expansão no mapa"""
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        
        uf_upper = uf.strip().upper()
        df_uf = df[df['estado'] == uf_upper].copy()
        
        # Agrupar por cidade (usando comarca como aproximação se não houver cidade)
        if 'comarca' in df_uf.columns:
            # Criar coluna auxiliar para contagem
            if 'data_entrada' not in df_uf.columns:
                df_uf['data_entrada'] = 1
            
            cidades = df_uf.groupby('comarca').agg({
                'data_entrada': 'count',
                'impacto_financeiro': 'sum'
            }).reset_index()
            cidades.columns = ['cidade', 'quantidade', 'impacto_total']
            cidades = cidades.sort_values('quantidade', ascending=False)
            
            # Retornar coordenadas aproximadas (usar capital como referência)
            capitais_path = Path(__file__).parent.parent / "data" / "capitais_brasil.json"
            with open(capitais_path, 'r', encoding='utf-8') as f:
                capitais_data = json.load(f)
            
            capital_lat = capitais_data.get(uf_upper, {}).get('lat', 0)
            capital_lon = capitais_data.get(uf_upper, {}).get('lon', 0)
            
            # Adicionar coordenadas aproximadas para cada cidade (distribuir ao redor da capital)
            result = []
            for idx, row in cidades.iterrows():
                # Distribuir cidades em um raio ao redor da capital
                offset_lat = (idx % 5 - 2) * 0.5
                offset_lon = (idx // 5 - 2) * 0.5
                result.append({
                    'cidade': row['cidade'],
                    'quantidade': int(row['quantidade']),
                    'impacto_total': float(row['impacto_total']),
                    'lat': capital_lat + offset_lat,
                    'lon': capital_lon + offset_lon
                })
            
            return {'cidades': result}
        else:
            return {'cidades': []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
