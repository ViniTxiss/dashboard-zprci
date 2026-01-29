"""
Rotas para todos os indicadores do dashboard
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from services.data_loader import get_loader
from services.aggregations import (
    get_evolution, get_object_by_state, get_average_time,
    get_cases_by_impact, get_sla_by_area, get_requests_by_deadline,
    get_volume_cost, get_reiterations_by_object, get_pareto_impact,
    get_critical_cases, get_sentences, get_reincidence,
    get_action_types_2025, get_systemic_errors, get_top_reiterations,
    get_final_kpis, get_analise_correlacao, get_casos_objetos_por_uf,
    get_prejuizo_por_uf, get_sla_subsidio_por_area, get_areas_responsaveis,
    get_solicitacoes_prazo_por_area, get_sentences_by_area, get_reincidencia_por_cliente,
    get_estatisticas_gerais, get_dashboard_acoes_ganhas_perdidas, get_sentences_by_object,
    get_totais_por_coluna
)

router = APIRouter()


def _filter_by_state(df, estado: Optional[str] = None):
    """Filtra DataFrame por estado se fornecido"""
    if estado and estado.strip():
        return df[df['estado'] == estado.strip().upper()].copy()
    return df


@router.get("/evolucao")
async def evolucao_carteira(estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")):
    """Evolução da Carteira"""
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        return get_evolution(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/objeto-por-estado")
async def objeto_por_estado(estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")):
    """Objeto por Estado"""
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        return get_object_by_state(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tempo-medio")
async def tempo_medio_tramitacao(estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")):
    """Tempo Médio de Tramitação"""
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        return get_average_time(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/casos-impacto")
async def casos_por_impacto(estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")):
    """Quantidade de Casos x Impacto Médio"""
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        return get_cases_by_impact(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sla-area")
async def sla_por_area(estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")):
    """SLA por Área Interna"""
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        return get_sla_by_area(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/solicitacoes-prazo")
async def solicitacoes_prazo(estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")):
    """Solicitações x Prazo (> 5 dias)"""
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        return get_requests_by_deadline(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/solicitacoes-prazo-por-area")
async def solicitacoes_prazo_por_area(
    estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")
):
    """
    Solicitações e Prazo por Área Responsável.
    Retorna dados agrupados por área com contagem de casos <= 5 dias e > 5 dias.
    """
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        return get_solicitacoes_prazo_por_area(df)
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"ERRO em solicitacoes_prazo_por_area: {error_detail}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/volume-custo")
async def volume_custo(estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")):
    """Volume e Custo por Encerramento"""
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        return get_volume_cost(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reiteracoes")
async def reiteracoes_objeto(estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")):
    """Reiterações por Objeto"""
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        return get_reiterations_by_object(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pareto")
async def pareto_impacto(estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")):
    """Curva de Impacto Financeiro (Pareto)"""
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        return get_pareto_impact(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/casos-criticos")
async def casos_criticos(estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")):
    """Casos Críticos"""
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        result = get_critical_cases(df)
        # Garantir que o resultado está sanitizado (já feito em get_critical_cases, mas dupla verificação)
        from services.aggregations import _sanitize_for_json
        result = _sanitize_for_json(result)
        return result
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"ERRO em casos_criticos: {error_detail}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sentencas")
async def sentencas(estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")):
    """Sentença Favorável x Desfavorável"""
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        return get_sentences(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sentencas-por-area")
async def sentencas_por_area(
    estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")
):
    """
    Sentença Favorável/Desfavorável por Área Responsável.
    Retorna quantidade de sentenças favoráveis, desfavoráveis e parciais agrupadas por área.
    """
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        return get_sentences_by_area(df)
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"ERRO em sentencas_por_area: {error_detail}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sentencas-por-objeto")
async def sentencas_por_objeto(
    estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")
):
    """
    Sentenças agrupadas por objeto_acao.
    Retorna quantidade de cada tipo de sentença (Favorável, Desfavorável, Parcial, etc.) por objeto.
    """
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        return get_sentences_by_object(df)
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"ERRO em sentencas_por_objeto: {error_detail}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reincidencia")
async def reincidencia(estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")):
    """Reincidência"""
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        return get_reincidence(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reincidencia-por-cliente")
async def reincidencia_por_cliente(
    estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)"),
    top_n: Optional[int] = Query(100, description="Número de clientes a retornar (TOP N)")
):
    """Reincidência por Cliente - Tabela com Nome Cliente, Qtd de Processos e Resultado"""
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        return get_reincidencia_por_cliente(df, top_n=top_n or 100)
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"ERRO em reincidencia_por_cliente: {error_detail}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tipos-acoes-2025")
async def tipos_acoes_2025(estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")):
    """Tipos de Ações – 2025"""
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        return get_action_types_2025(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/erro-sistemico")
async def erro_sistemico(estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")):
    """Erro Sistêmico (TI)"""
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        return get_systemic_errors(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/maior-reiteracao")
async def maior_reiteracao(estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")):
    """Autos com Maior Reiteração"""
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        return get_top_reiterations(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/kpis-finais")
async def kpis_finais(estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")):
    """KPIs Finais"""
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        return get_final_kpis(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analise-correlacao")
async def analise_correlacao(
    estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP) - compatibilidade"),
    uf: Optional[str] = Query(None, description="Filtrar por UF (ex: PA, SP) - preferido"),
    filtro_objeto: Optional[str] = Query(None, description="Filtrar por objeto da ação (cross-filter)")
):
    """Dados para o slide Análise de Impacto: mapa, objeto, tempo médio e base (bar+line)."""
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        
        # Usar uf se fornecido, senão usar estado (compatibilidade)
        filtro_uf = uf or estado
        if filtro_uf:
            df = apply_global_filters(df, uf=filtro_uf)
        
        return get_analise_correlacao(df, filtro_objeto)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/casos-objetos-por-uf")
async def casos_objetos_por_uf(
    estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")
):
    """
    Contagem de casos/objetos de ações por UF.
    Conta TODAS as ocorrências de cada sigla de estado (UF) na base de dados BASE_TRATADA_FINAL.xlsx.
    Retorna:
    - por_uf: Lista de UFs com quantidade de casos
    - por_objeto_uf: Lista de combinações UF + Objeto com quantidade
    - total_casos: Total de casos na base
    - total_ufs: Total de UFs diferentes
    """
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        return get_casos_objetos_por_uf(df)
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"ERRO em casos_objetos_por_uf: {error_detail}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/prejuizo-por-uf")
async def prejuizo_por_uf(
    estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")
):
    """
    Prejuízo total (soma de impacto financeiro) por UF.
    Retorna dados agregados para gráficos de prejuízo.
    Inclui:
    - prejuizo_total: Soma de impacto financeiro por UF
    - prejuizo_medio: Média de impacto financeiro por UF
    - quantidade: Quantidade de casos por UF
    - percentual: Percentual do prejuízo total que cada UF representa
    - prejuizo_total_mil: Prejuízo total em R$ Mil
    """
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        return get_prejuizo_por_uf(df)
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"ERRO em prejuizo_por_uf: {error_detail}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/areas-responsaveis")
async def areas_responsaveis():
    """
    Retorna lista de todas as Áreas Responsáveis únicas.
    Usa area_interna que é mapeado de 'Area Responsável' ou 'Área Jurídica'.
    """
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        return get_areas_responsaveis(df)
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"ERRO em areas_responsaveis: {error_detail}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sla-subsidio-por-area")
async def sla_subsidio_por_area(
    estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")
):
    """
    Calcula SLA do subsídio por Área Responsável.
    Refatorado para calcular SLA_Dias usando 'Data de entrada' e 'DATA ENCERRAMENTO'.
    Retorna:
    - dados: Lista com métricas por área (tempo_medio_tramitacao, quantidade, percentual_dentro_sla)
    - media_nacional_sla: Percentual médio nacional dentro do SLA
    - media_nacional_tempo: Tempo médio nacional de tramitação (SLA_Dias)
    """
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        return get_sla_subsidio_por_area(df)
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"ERRO em sla_subsidio_por_area: {error_detail}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/estatisticas-gerais")
async def estatisticas_gerais(estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")):
    """
    Estatísticas Gerais: Número de ações, encerramentos e médias globais.
    Retorna:
    - total_acoes: Número geral de ações (entradas)
    - total_encerramentos: Número geral de encerramentos
    - media_valor_causa: Média global de valor da causa (valor pretendido)
    - media_pagamento: Média global de pagamento
    """
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        return get_estatisticas_gerais(df)
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"ERRO em estatisticas_gerais: {error_detail}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/totais-por-coluna")
async def totais_por_coluna(
    coluna: str = Query(..., description="Nome da coluna para agregar (ex: 'sentenca', 'objeto_acao')"),
    agrupar_por: Optional[str] = Query(None, description="Nome da coluna para agrupar (ex: 'objeto_acao', 'estado')"),
    estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")
):
    """
    API genérica para retornar totais agregados por coluna.
    Permite agregar qualquer coluna e opcionalmente agrupar por outra coluna.
    """
    try:
        loader = get_loader()
        df = loader.get_dataframe()
        df = _filter_by_state(df, estado)
        return get_totais_por_coluna(df, coluna, agrupar_por)
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"ERRO em totais_por_coluna: {error_detail}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/acoes-ganhas-perdidas")
async def acoes_ganhas_perdidas(estado: Optional[str] = Query(None, description="Filtrar por estado (ex: PA, SP)")):
    """
    Dashboard de Ações Ganhas/Perdidas.
    Retorna estatísticas de ações ganhas (Extinção, Improcedência) e perdidas
    (Pagamento Condenação, Acordo Pós Sentença, Condenação Sem Ônus),
    além de acordo antes da sentença com economia.
    """
    try:
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"acoes_ganhas_perdidas: Requisição recebida (estado={estado})")
        
        loader = get_loader()
        df = loader.get_dataframe()
        logger.info(f"acoes_ganhas_perdidas: DataFrame carregado com {len(df)} registros")
        
        df = _filter_by_state(df, estado)
        if estado:
            logger.info(f"acoes_ganhas_perdidas: Filtrado por estado {estado}, {len(df)} registros restantes")
        
        result = get_dashboard_acoes_ganhas_perdidas(df)
        
        # Validar estrutura de resposta
        required_keys = ['ganhas', 'perdidas', 'acordo_antes_sentenca', 'total']
        for key in required_keys:
            if key not in result:
                logger.error(f"acoes_ganhas_perdidas: Chave '{key}' ausente no resultado")
                raise ValueError(f"Estrutura de resposta inválida: chave '{key}' ausente")
        
        # Validar estrutura de objetos aninhados
        for key in ['ganhas', 'perdidas']:
            if not isinstance(result[key], dict):
                logger.error(f"acoes_ganhas_perdidas: '{key}' não é um dicionário")
                raise ValueError(f"Estrutura inválida: '{key}' deve ser um dicionário")
            required_subkeys = ['quantidade', 'percentual', 'valor_pretendido_total']
            for subkey in required_subkeys:
                if subkey not in result[key]:
                    logger.error(f"acoes_ganhas_perdidas: Chave '{key}.{subkey}' ausente")
                    raise ValueError(f"Estrutura inválida: '{key}.{subkey}' ausente")
        
        if not isinstance(result['acordo_antes_sentenca'], dict):
            logger.error("acoes_ganhas_perdidas: 'acordo_antes_sentenca' não é um dicionário")
            raise ValueError("Estrutura inválida: 'acordo_antes_sentenca' deve ser um dicionário")
        
        required_acordo_keys = ['quantidade', 'percentual', 'valor_pretendido_total', 'valor_acordo_total', 'economia_total', 'detalhes']
        for key in required_acordo_keys:
            if key not in result['acordo_antes_sentenca']:
                logger.error(f"acoes_ganhas_perdidas: Chave 'acordo_antes_sentenca.{key}' ausente")
                raise ValueError(f"Estrutura inválida: 'acordo_antes_sentenca.{key}' ausente")
        
        logger.info(f"acoes_ganhas_perdidas: Resposta validada e retornada com sucesso")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        logger = logging.getLogger(__name__)
        logger.error(f"ERRO em acoes_ganhas_perdidas: {error_detail}")
        print(f"ERRO em acoes_ganhas_perdidas: {error_detail}")
        raise HTTPException(status_code=500, detail=str(e))
