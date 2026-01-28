"""
Transformações de Dados
Funções para transformar e preparar dados para visualização
"""

import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any


def format_currency(value: float) -> str:
    """Formata valor como moeda brasileira"""
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def format_number(value: float) -> str:
    """Formata número com separadores"""
    return f"{value:,.0f}".replace(",", ".")


def calculate_percentage(part: float, total: float) -> float:
    """Calcula percentual"""
    if total == 0:
        return 0
    return (part / total) * 100


def aggregate_by_object(df: pd.DataFrame, group_col: str = 'objeto_acao') -> List[Dict]:
    """Agrega dados por objeto da ação"""
    grouped = df.groupby(group_col).agg({
        'impacto_financeiro': 'sum',
        'data_entrada': 'count'
    }).reset_index()
    
    grouped.columns = [group_col, 'total_impacto', 'quantidade']
    grouped = grouped.sort_values('quantidade', ascending=False)
    
    total_geral = grouped['quantidade'].sum()
    grouped['percentual'] = grouped['quantidade'].apply(lambda x: calculate_percentage(x, total_geral))
    
    return grouped.to_dict('records')


def calculate_evolution(df: pd.DataFrame, date_col: str = 'data_entrada') -> List[Dict]:
    """Calcula evolução temporal separando Entradas e Encerramentos"""
    df_copy = df.copy()
    
    # Processar Entradas: TODOS os registros com data_entrada preenchida
    # Um registro pode ser entrada em um mês e encerrado em outro mês
    # Portanto, contamos como entrada no mês da data_entrada, independente do status
    if 'data_entrada' in df_copy.columns:
        entradas_df = df_copy[df_copy['data_entrada'].notna()].copy()
        entradas_df['data_entrada'] = pd.to_datetime(entradas_df['data_entrada'], errors='coerce')
        entradas_df = entradas_df[entradas_df['data_entrada'].notna()]
        if len(entradas_df) > 0:
            entradas_df['mes_ano'] = entradas_df['data_entrada'].dt.to_period('M')
            entradas_df['count'] = 1
            entradas_evolution = entradas_df.groupby('mes_ano').agg({
                'count': 'sum'
            }).reset_index()
            entradas_evolution['mes_ano'] = entradas_evolution['mes_ano'].astype(str)
            entradas_evolution.columns = ['periodo', 'entradas']
        else:
            entradas_evolution = pd.DataFrame(columns=['periodo', 'entradas'])
    else:
        entradas_evolution = pd.DataFrame(columns=['periodo', 'entradas'])
    
    # Processar Encerramentos: usar lógica correta que exclui "Ativo", "Sem sentença", "Fase recurso"
    # A função _is_encerrado está em aggregations.py, mas para evitar importação circular,
    # vamos replicar a lógica aqui (ou importar no topo do arquivo se necessário)
    # Valores que NÃO são encerramentos (coluna U)
    nao_encerrados_valores = [
        'ativo', 'ativos', 'atividade', 'atividades',
        'sem sentença', 'sem sentenca', 'sem sentenç', 'sem senten',
        'fase de recurso', 'fase recurso', 'recurso', 'recursos',
        'em recurso', 'em fase de recurso'
    ]
    
    if 'motivo_encerramento' in df_copy.columns:
        motivo = df_copy['motivo_encerramento'].astype(str).str.lower().str.strip()
        encerrados_mask = (
            motivo.notna() & 
            (motivo != '') & 
            (motivo != 'nan') &
            ~motivo.str.contains('|'.join(nao_encerrados_valores), case=False, na=False, regex=True)
        )
    else:
        # Fallback: se não há motivo_encerramento, considerar como NÃO encerrado (caso ativo)
        encerrados_mask = pd.Series([False] * len(df_copy), index=df_copy.index)
    encerrados_df = df_copy[encerrados_mask].copy()
    
    # Processar Encerramentos
    if 'data_encerramento' in encerrados_df.columns:
        encerrados_df['data_encerramento'] = pd.to_datetime(encerrados_df['data_encerramento'], errors='coerce')
        encerrados_df = encerrados_df[encerrados_df['data_encerramento'].notna()]
        if len(encerrados_df) > 0:
            encerrados_df['mes_ano'] = encerrados_df['data_encerramento'].dt.to_period('M')
            encerrados_df['count'] = 1
            encerrados_evolution = encerrados_df.groupby('mes_ano').agg({
                'count': 'sum'
            }).reset_index()
            encerrados_evolution['mes_ano'] = encerrados_evolution['mes_ano'].astype(str)
            encerrados_evolution.columns = ['periodo', 'encerramentos']
        else:
            encerrados_evolution = pd.DataFrame(columns=['periodo', 'encerramentos'])
    else:
        # Se não tem data_encerramento, usar data_entrada como fallback
        if 'data_entrada' in encerrados_df.columns:
            encerrados_df['data_entrada'] = pd.to_datetime(encerrados_df['data_entrada'], errors='coerce')
            encerrados_df = encerrados_df[encerrados_df['data_entrada'].notna()]
            if len(encerrados_df) > 0:
                encerrados_df['mes_ano'] = encerrados_df['data_entrada'].dt.to_period('M')
                encerrados_df['count'] = 1
                encerrados_evolution = encerrados_df.groupby('mes_ano').agg({
                    'count': 'sum'
                }).reset_index()
                encerrados_evolution['mes_ano'] = encerrados_evolution['mes_ano'].astype(str)
                encerrados_evolution.columns = ['periodo', 'encerramentos']
            else:
                encerrados_evolution = pd.DataFrame(columns=['periodo', 'encerramentos'])
        else:
            encerrados_evolution = pd.DataFrame(columns=['periodo', 'encerramentos'])
    
    # Fazer merge dos períodos
    if len(entradas_evolution) > 0 or len(encerrados_evolution) > 0:
        # Obter todos os períodos únicos
        todos_periodos = set()
        if len(entradas_evolution) > 0:
            todos_periodos.update(entradas_evolution['periodo'].tolist())
        if len(encerrados_evolution) > 0:
            todos_periodos.update(encerrados_evolution['periodo'].tolist())
        
        # Criar DataFrame com todos os períodos
        evolution = pd.DataFrame({'periodo': sorted(todos_periodos)})
        
        # Fazer merge com entradas e encerramentos
        if len(entradas_evolution) > 0:
            evolution = evolution.merge(entradas_evolution, on='periodo', how='left')
        else:
            evolution['entradas'] = 0
        
        if len(encerrados_evolution) > 0:
            evolution = evolution.merge(encerrados_evolution, on='periodo', how='left')
        else:
            evolution['encerramentos'] = 0
        
        # Preencher NaN com 0
        evolution = evolution.fillna(0)
        evolution['entradas'] = evolution['entradas'].astype(int)
        evolution['encerramentos'] = evolution['encerramentos'].astype(int)
    else:
        evolution = pd.DataFrame(columns=['periodo', 'entradas', 'encerramentos'])
    
    return evolution.to_dict('records')


def calculate_average_time(df: pd.DataFrame) -> Dict[str, Any]:
    """Calcula tempo médio de tramitação"""
    df_with_time = df[df['tempo_tramitacao'].notna()].copy()
    
    if df_with_time.empty:
        return {
            'media_geral': 0,
            'por_objeto': [],
            'por_area': []
        }
    
    media_geral = df_with_time['tempo_tramitacao'].mean()
    
    por_objeto = df_with_time.groupby('objeto_acao')['tempo_tramitacao'].mean().reset_index()
    por_objeto.columns = ['objeto', 'tempo_medio']
    por_objeto = por_objeto.sort_values('tempo_medio', ascending=False)
    
    por_area = df_with_time.groupby('area_interna')['tempo_tramitacao'].mean().reset_index()
    por_area.columns = ['area', 'tempo_medio']
    por_area = por_area.sort_values('tempo_medio', ascending=False)
    
    return {
        'media_geral': float(media_geral),
        'por_objeto': por_objeto.to_dict('records'),
        'por_area': por_area.to_dict('records')
    }


def calculate_pareto(df: pd.DataFrame, value_col: str = 'impacto_financeiro', 
                     category_col: str = 'objeto_acao') -> List[Dict]:
    """Calcula curva de Pareto"""
    grouped = df.groupby(category_col)[value_col].sum().reset_index()
    grouped = grouped.sort_values(value_col, ascending=False)
    
    total = grouped[value_col].sum()
    grouped['acumulado'] = grouped[value_col].cumsum()
    grouped['percentual_acumulado'] = (grouped['acumulado'] / total) * 100
    grouped['percentual'] = (grouped[value_col] / total) * 100
    
    return grouped.to_dict('records')


def filter_critical_cases(df: pd.DataFrame, top_n: int = 20) -> List[Dict]:
    """Filtra casos críticos"""
    import math
    
    def _safe_float(value, default=0.0):
        """Converte valor para float de forma segura, tratando NaN e Infinity"""
        if value is None or (isinstance(value, float) and (math.isnan(value) or math.isinf(value))):
            return default
        try:
            result = float(value)
            if math.isnan(result) or math.isinf(result):
                return default
            return result
        except (ValueError, TypeError):
            return default
    
    def _safe_int(value, default=0):
        """Converte valor para int de forma segura"""
        if value is None or (isinstance(value, float) and (math.isnan(value) or math.isinf(value))):
            return default
        try:
            result = int(float(value))
            return result
        except (ValueError, TypeError):
            return default
    
    critical = df[df['critico'] == True].copy()
    
    if critical.empty:
        critical = df.nlargest(top_n, 'impacto_financeiro')
    
    critical = critical.sort_values('impacto_financeiro', ascending=False).head(top_n)
    
    # Selecionar campos relevantes
    result = []
    for _, row in critical.iterrows():
        # Sanitizar valores numéricos
        impacto_financeiro = _safe_float(row.get('impacto_financeiro', row.get('Valor da Causa Atual', 0)))
        prejuizo = _safe_float(row.get('impacto_financeiro', row.get('Valor da Causa Atual', 0)))
        # Valor pretendido (valor da causa)
        valor_pretendido = _safe_float(row.get('valor_causa', row.get('Valor da Causa', impacto_financeiro)))
        reiteracoes = _safe_int(row.get('reiteracoes', 0))
        
        # Extrair ano da data de entrada
        ano = None
        if 'data_entrada' in row and pd.notna(row.get('data_entrada')):
            try:
                data_entrada = pd.to_datetime(row.get('data_entrada'), errors='coerce')
                if pd.notna(data_entrada):
                    ano = int(data_entrada.year)
            except:
                pass
        
        case = {
            'nome_cliente': row.get('nome_cliente', row.get('Pólo Ativo', 'N/A')),
            'tipo_ocorrencia': row.get('objeto_acao', row.get('Descricao do Tipo de Ação', 'N/A')),
            'motivo_detalhado': row.get('motivo_encerramento', row.get('Motivo Encerramento', 'N/A')),
            'situacao': row.get('status', row.get('Situação', 'N/A')),
            'prejuizo': prejuizo,
            'valor_pretendido': valor_pretendido,
            'ano': ano,
            'objeto_acao': row.get('objeto_acao', 'N/A'),
            'estado': row.get('estado', 'N/A'),
            'impacto_financeiro': impacto_financeiro,
            'reiteracoes': reiteracoes
        }
        result.append(case)
    
    return result


def aggregate_by_state(df: pd.DataFrame) -> List[Dict]:
    """Agrega dados por estado"""
    df_copy = df.copy()
    # Criar coluna auxiliar para contagem se data_entrada não existir
    if 'data_entrada' not in df_copy.columns:
        df_copy['data_entrada'] = 1
    
    grouped = df_copy.groupby('estado').agg({
        'data_entrada': 'count',
        'impacto_financeiro': 'sum',
        'tempo_tramitacao': 'mean'
    }).reset_index()
    
    grouped.columns = ['estado', 'quantidade', 'impacto_total', 'tempo_medio']
    grouped = grouped.sort_values('quantidade', ascending=False)
    
    return grouped.to_dict('records')


def calculate_sla_by_area(df: pd.DataFrame) -> List[Dict]:
    """
    Calcula SLA por área interna usando sla_real (diferença entre data_encerramento e data_entrada).
    Retorna área, média de dias, acima_da_meta e quantidade de casos.
    Ordenado do maior para o menor SLA.
    """
    from services.data_loader import BENCHMARK_NACIONAL
    
    df_copy = df.copy()
    
    # Verificar se temos sla_real calculado
    if 'sla_real' not in df_copy.columns:
        return []
    
    # Verificar se temos area_interna
    if 'area_interna' not in df_copy.columns:
        return []
    
    # Filtrar áreas válidas
    df_copy = df_copy[df_copy['area_interna'].notna()].copy()
    df_copy = df_copy[df_copy['area_interna'] != 'Não Informado'].copy()
    
    if df_copy.empty:
        return []
    
    # Agrupar por área e calcular média de sla_real
    sla_data = df_copy.groupby('area_interna').agg({
        'sla_real': 'mean'  # Média de sla_real por área
    }).reset_index()
    sla_data.columns = ['area', 'media_dias']
    
    # Contar quantidade de casos por área
    quantidade_por_area = df_copy.groupby('area_interna').size().reset_index(name='quantidade')
    quantidade_por_area.columns = ['area', 'quantidade']  # Renomear para fazer merge correto
    sla_data = sla_data.merge(quantidade_por_area, on='area', how='left')
    
    # Adicionar campo acima_da_meta (True se media_dias > BENCHMARK_NACIONAL)
    sla_data['acima_da_meta'] = sla_data['media_dias'] > BENCHMARK_NACIONAL
    
    # Ordenar do maior para o menor SLA
    sla_data = sla_data.sort_values('media_dias', ascending=False)
    
    # Converter para tipos nativos
    sla_data['media_dias'] = sla_data['media_dias'].round(2).astype(float)
    sla_data['quantidade'] = sla_data['quantidade'].astype(int)
    sla_data['acima_da_meta'] = sla_data['acima_da_meta'].astype(bool)
    
    return sla_data.to_dict('records')


def calculate_sentences(df: pd.DataFrame) -> Dict[str, Any]:
    """Calcula distribuição de sentenças"""
    sentences = df[df['sentenca'].notna()].copy()
    
    if sentences.empty:
        return {
            'favoravel': 0,
            'desfavoravel': 0,
            'parcial': 0,
            'total': 0,
            'percentuais': {}
        }
    
    counts = sentences['sentenca'].value_counts().to_dict()
    
    total = sentences.shape[0]
    
    return {
        'favoravel': counts.get('Favorável', 0),
        'desfavoravel': counts.get('Desfavorável', 0),
        'parcial': counts.get('Parcial', 0),
        'total': total,
        'percentuais': {
            'favoravel': calculate_percentage(counts.get('Favorável', 0), total),
            'desfavoravel': calculate_percentage(counts.get('Desfavorável', 0), total),
            'parcial': calculate_percentage(counts.get('Parcial', 0), total)
        }
    }


def calculate_sentences_by_area(df: pd.DataFrame) -> List[Dict]:
    """
    Calcula distribuição de sentenças (Favorável/Desfavorável/Parcial) por área responsável.
    Retorna lista de áreas com contagem de cada tipo de sentença.
    """
    df_copy = df.copy()
    
    # Verificar se temos as colunas necessárias
    if 'area_interna' not in df_copy.columns or 'sentenca' not in df_copy.columns:
        return []
    
    # Filtrar áreas válidas
    df_copy = df_copy[df_copy['area_interna'].notna()].copy()
    df_copy = df_copy[df_copy['area_interna'] != 'Não Informado'].copy()
    
    # Filtrar apenas registros com sentença preenchida
    df_copy = df_copy[df_copy['sentenca'].notna()].copy()
    
    if df_copy.empty:
        return []
    
    # Agrupar por área e sentença, contando quantidade
    grouped = df_copy.groupby(['area_interna', 'sentenca']).size().reset_index(name='quantidade')
    
    # Criar estrutura pivotada
    result = []
    areas = df_copy['area_interna'].unique()
    
    for area in areas:
        area_data = grouped[grouped['area_interna'] == area]
        
        favoravel = int(area_data[area_data['sentenca'] == 'Favorável']['quantidade'].sum()) if len(area_data[area_data['sentenca'] == 'Favorável']) > 0 else 0
        desfavoravel = int(area_data[area_data['sentenca'] == 'Desfavorável']['quantidade'].sum()) if len(area_data[area_data['sentenca'] == 'Desfavorável']) > 0 else 0
        parcial = int(area_data[area_data['sentenca'] == 'Parcial']['quantidade'].sum()) if len(area_data[area_data['sentenca'] == 'Parcial']) > 0 else 0
        total = favoravel + desfavoravel + parcial
        
        if total > 0:
            result.append({
                'area': str(area),
                'favoravel': favoravel,
                'desfavoravel': desfavoravel,
                'parcial': parcial,
                'total': total
            })
    
    # Ordenar por total (decrescente)
    result = sorted(result, key=lambda x: x['total'], reverse=True)
    
    return result


def calculate_reincidence(df: pd.DataFrame) -> Dict[str, Any]:
    """Calcula taxa de reincidência"""
    total = df.shape[0]
    reincidentes = df[df['reincidencia'] == True].shape[0]
    
    return {
        'total': total,
        'reincidentes': reincidentes,
        'nao_reincidentes': total - reincidentes,
        'taxa_reincidencia': calculate_percentage(reincidentes, total)
    }
