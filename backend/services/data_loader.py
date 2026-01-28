"""
Serviço de Carregamento de Dados
Única fonte: BASE_UNIFICADA (XLSX ou CSV em backend/data).
"""

import pandas as pd
import json
import time
from pathlib import Path
from datetime import datetime, timedelta

_DEBUG_LOG = Path(r"c:\Users\vini\Desktop\zappa + html v2\.cursor\debug.log")

# Constante de benchmark nacional para SLA
BENCHMARK_NACIONAL = 23

# Colunas mínimas para DataFrame vazio quando a Base Unificada não existir
_COLUNAS_VAZIAS = [
    'objeto_acao', 'data_entrada', 'data_encerramento', 'status', 'estado', 'impacto_financeiro'
]


class DataLoader:
    def __init__(self, data_file: str = None):
        backend_dir = Path(__file__).parent.parent
        base_dir = backend_dir.parent

        # Novas fontes de dados atualizadas
        # Prioridade: 1) Material Casos Críticos, 2) novos casos (mais recente)
        # Buscar arquivos por padrão para evitar problemas de encoding
        data_dir = backend_dir / "data"
        self.xlsx_principal = None
        self.xlsx_novos_casos = None
        self.xlsx_secundario = None  # Mantido para compatibilidade
        
        # Buscar arquivo principal (Material Casos Críticos)
        for file in data_dir.glob("*.xlsx"):
            if "Material Casos" in file.name or "Base completa" in file.name:
                if "Material" in file.name:
                    self.xlsx_principal = file
                    break
        
        # Buscar arquivo de novos casos (mais recente, tem prioridade nas colunas duplicadas)
        for file in data_dir.glob("*.xlsx"):
            if "novos casos" in file.name.lower():
                self.xlsx_novos_casos = file
                break
        
        # Buscar arquivo secundário (banco de dados para atualizar) - compatibilidade
        for file in data_dir.glob("*.xlsx"):
            if "banco de dados" in file.name.lower() or "atualizar" in file.name.lower():
                self.xlsx_secundario = file
                break
        
        self.csv_principal = None  # Não usar mais CSV antigo

        self._df = None
        self._load_data()

    def _load_data(self):
        """Carrega dados das novas bases atualizadas: Material Casos Críticos e novos casos.
        Mescla ambos arquivos quando disponíveis, priorizando 'novos casos' para colunas duplicadas."""
        # #region agent log
        try:
            with open(_DEBUG_LOG, "a", encoding="utf-8") as f:
                f.write(json.dumps({"timestamp":int(time.time()*1000),"location":"data_loader._load_data","message":"entry","data":{"xlsx_principal_exists":self.xlsx_principal.exists() if self.xlsx_principal else False,"xlsx_novos_casos_exists":self.xlsx_novos_casos.exists() if self.xlsx_novos_casos else False},"sessionId":"debug-session","hypothesisId":"H1"}) + "\n")
        except Exception: pass
        # #endregion
        
        df_principal = pd.DataFrame()
        df_novos = pd.DataFrame()
        
        try:
            # Carregar arquivo principal (Material Casos Críticos)
            if self.xlsx_principal and self.xlsx_principal.exists():
                try:
                    print(f"Carregando dados de: {self.xlsx_principal.name}")
                except UnicodeEncodeError:
                    print("Carregando dados de: arquivo principal")
                try:
                    xl = pd.ExcelFile(self.xlsx_principal)
                    sheet = self._find_sheet(xl, ['in', 'dados', 'base'])
                    if sheet:
                        df_raw = pd.read_excel(self.xlsx_principal, sheet_name=sheet, engine='openpyxl')
                        df_principal = self._map_columns(df_raw)
                        print(f"Dados carregados do principal: {len(df_principal)} registros da sheet '{sheet}'")
                        # #region agent log
                        try:
                            with open(_DEBUG_LOG, "a", encoding="utf-8") as f:
                                f.write(json.dumps({"timestamp":int(time.time()*1000),"location":"data_loader._load_data","message":"loaded","data":{"source":"xlsx_principal","sheet":sheet,"nrows":len(df_principal)},"sessionId":"debug-session","hypothesisId":"H1"}) + "\n")
                        except Exception: pass
                        # #endregion
                except Exception as e:
                    print(f"Erro ao carregar arquivo principal: {e}")
                    import traceback
                    traceback.print_exc()
            
            # Carregar arquivo de novos casos
            if self.xlsx_novos_casos and self.xlsx_novos_casos.exists():
                try:
                    print(f"Carregando dados de: {self.xlsx_novos_casos.name}")
                except UnicodeEncodeError:
                    print("Carregando dados de: novos casos")
                try:
                    xl = pd.ExcelFile(self.xlsx_novos_casos)
                    sheet = self._find_sheet(xl, ['in', 'dados', 'base', 'CPJ'])
                    if sheet:
                        df_raw = pd.read_excel(self.xlsx_novos_casos, sheet_name=sheet, engine='openpyxl')
                        df_novos = self._map_columns(df_raw)
                        print(f"Dados carregados dos novos casos: {len(df_novos)} registros da sheet '{sheet}'")
                        # #region agent log
                        try:
                            with open(_DEBUG_LOG, "a", encoding="utf-8") as f:
                                f.write(json.dumps({"timestamp":int(time.time()*1000),"location":"data_loader._load_data","message":"loaded","data":{"source":"xlsx_novos_casos","sheet":sheet,"nrows":len(df_novos)},"sessionId":"debug-session","hypothesisId":"H1"}) + "\n")
                        except Exception: pass
                        # #endregion
                except Exception as e:
                    print(f"Erro ao carregar arquivo de novos casos: {e}")
                    import traceback
                    traceback.print_exc()
            
            # Mesclar DataFrames se ambos foram carregados, ou usar o disponível
            if not df_principal.empty and not df_novos.empty:
                print("Mesclando arquivos: Material Casos Críticos + novos casos")
                self._df = self._merge_dataframes(df_principal, df_novos)
            elif not df_principal.empty:
                print("Usando apenas arquivo principal (Material Casos Críticos)")
                self._df = df_principal.copy()
            elif not df_novos.empty:
                print("Usando apenas arquivo de novos casos")
                self._df = df_novos.copy()
            else:
                # Fallback: tentar arquivo secundário (compatibilidade)
                if self.xlsx_secundario and self.xlsx_secundario.exists():
                    try:
                        print(f"Carregando dados de: {self.xlsx_secundario.name}")
                    except UnicodeEncodeError:
                        print("Carregando dados de: arquivo secundario")
                    try:
                        xl = pd.ExcelFile(self.xlsx_secundario)
                        sheet = self._find_sheet(xl, ['CPJ', 'dados', 'base'])
                        if sheet:
                            df_raw = pd.read_excel(self.xlsx_secundario, sheet_name=sheet, engine='openpyxl')
                            self._df = self._map_columns(df_raw)
                            print(f"Dados carregados: {len(self._df)} registros da sheet '{sheet}'")
                    except Exception as e:
                        print(f"Erro ao carregar arquivo secundário: {e}")
                        self._df = pd.DataFrame(columns=_COLUNAS_VAZIAS)
                else:
                    print("AVISO: Nenhuma base de dados encontrada. Esperado:")
                    print("  - backend/data/Material Casos Críticos - RCI - 2025 - Base completa.xlsx")
                    print("  - backend/data/novos casos .xlsx")
                    print("Usando DataFrame vazio.")
                    self._df = pd.DataFrame(columns=_COLUNAS_VAZIAS)
            
        except Exception as e:
            # #region agent log
            try:
                with open(_DEBUG_LOG, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"timestamp":int(time.time()*1000),"location":"data_loader._load_data","message":"exception","data":{"err":str(e),"errtype":type(e).__name__},"sessionId":"debug-session","hypothesisId":"H1"}) + "\n")
            except Exception: pass
            # #endregion
            print(f"Erro ao carregar Base Unificada: {e}")
            import traceback
            traceback.print_exc()
            self._df = pd.DataFrame(columns=_COLUNAS_VAZIAS)
    
    def _find_sheet(self, xl: pd.ExcelFile, prefer_keywords: list = None) -> str:
        """Encontra a sheet apropriada no arquivo Excel"""
        if prefer_keywords is None:
            prefer_keywords = ['in', 'dados', 'base', 'CPJ']
        
        for keyword in prefer_keywords:
            for sheet_name in xl.sheet_names:
                if keyword.lower() in sheet_name.lower():
                    return sheet_name
        
        # Se não encontrou, retorna primeira sheet
        return xl.sheet_names[0] if xl.sheet_names else None
    
    def _merge_dataframes(self, df_principal: pd.DataFrame, df_novos: pd.DataFrame) -> pd.DataFrame:
        """
        Mescla dois DataFrames, resolvendo colunas duplicadas.
        Prioridade: df_novos (mais recente) sobrepõe df_principal.
        Mescla por numero_processo quando disponível, senão concatena.
        """
        if df_principal.empty and df_novos.empty:
            return pd.DataFrame(columns=_COLUNAS_VAZIAS)
        
        if df_principal.empty:
            return df_novos.copy()
        
        if df_novos.empty:
            return df_principal.copy()
        
        # Identificar colunas comuns e únicas
        colunas_principais = set(df_principal.columns)
        colunas_novos = set(df_novos.columns)
        colunas_comuns = colunas_principais & colunas_novos
        colunas_unicas_principal = colunas_principais - colunas_novos
        colunas_unicas_novos = colunas_novos - colunas_principais
        
        # Verificar se temos numero_processo para usar como chave de merge
        tem_chave = 'numero_processo' in colunas_comuns
        
        if tem_chave:
            # Mesclar por numero_processo
            # Usar suffixes para identificar origem das colunas duplicadas
            merged = pd.merge(
                df_principal,
                df_novos,
                on='numero_processo',
                how='outer',
                suffixes=('_old', '_new'),
                indicator=True
            )
            
            # Resolver colunas duplicadas: priorizar _new, preencher com _old quando _new for NaN
            df_final = pd.DataFrame()
            
            # Adicionar chave de merge
            df_final['numero_processo'] = merged['numero_processo']
            
            # Processar colunas comuns (exceto numero_processo)
            for col in colunas_comuns:
                if col == 'numero_processo':
                    continue
                
                col_old = f'{col}_old'
                col_new = f'{col}_new'
                
                if col_old in merged.columns and col_new in merged.columns:
                    # Priorizar _new, preencher com _old quando _new for NaN
                    df_final[col] = merged[col_new].fillna(merged[col_old])
                elif col_old in merged.columns:
                    df_final[col] = merged[col_old]
                elif col_new in merged.columns:
                    df_final[col] = merged[col_new]
            
            # Adicionar colunas únicas do principal
            for col in colunas_unicas_principal:
                col_old = f'{col}_old'
                if col_old in merged.columns:
                    df_final[col] = merged[col_old]
                elif col in merged.columns:
                    df_final[col] = merged[col]
            
            # Adicionar colunas únicas dos novos casos
            for col in colunas_unicas_novos:
                col_new = f'{col}_new'
                if col_new in merged.columns:
                    df_final[col] = merged[col_new]
                elif col in merged.columns:
                    df_final[col] = merged[col]
            
            # Logging
            registros_apenas_principal = (merged['_merge'] == 'left_only').sum()
            registros_apenas_novos = (merged['_merge'] == 'right_only').sum()
            registros_ambos = (merged['_merge'] == 'both').sum()
            
            print(f"Mesclagem concluída:")
            print(f"  - Registros apenas no principal: {registros_apenas_principal}")
            print(f"  - Registros apenas nos novos casos: {registros_apenas_novos}")
            print(f"  - Registros em ambos (mesclados): {registros_ambos}")
            print(f"  - Total final: {len(df_final)} registros")
            print(f"  - Colunas comuns resolvidas: {len(colunas_comuns) - 1}")  # -1 para numero_processo
            print(f"  - Colunas únicas do principal: {len(colunas_unicas_principal)}")
            print(f"  - Colunas únicas dos novos casos: {len(colunas_unicas_novos)}")
            
            # Remover coluna _merge se existir
            if '_merge' in df_final.columns:
                df_final = df_final.drop(columns=['_merge'])
            
            return df_final
        else:
            # Se não há chave, concatenar e resolver colunas duplicadas manualmente
            # Priorizar valores de df_novos para colunas comuns
            print("AVISO: numero_processo não encontrado. Concatenando DataFrames e resolvendo colunas duplicadas.")
            
            # Preparar df_novos com todas as colunas (comuns + únicas)
            df_novos_final = df_novos.copy()
            for col in colunas_unicas_principal:
                if col not in df_novos_final.columns:
                    df_novos_final[col] = None
            
            # Preparar df_principal com todas as colunas (comuns + únicas)
            df_principal_final = df_principal.copy()
            for col in colunas_unicas_novos:
                if col not in df_principal_final.columns:
                    df_principal_final[col] = None
            
            # Para colunas comuns, priorizar df_novos: manter valores de df_novos
            # Os valores do principal serão usados apenas onde df_novos não tem dados
            # Mas como estamos concatenando, vamos manter ambos e depois resolver
            # Na prática, vamos manter df_novos como está e preencher df_principal onde necessário
            
            # Garantir mesma ordem de colunas
            todas_colunas = sorted(set(df_novos_final.columns) | set(df_principal_final.columns))
            df_novos_final = df_novos_final.reindex(columns=todas_colunas)
            df_principal_final = df_principal_final.reindex(columns=todas_colunas)
            
            # Preencher colunas vazias com dtype apropriado para evitar warning
            for col in todas_colunas:
                if col not in df_novos_final.columns or df_novos_final[col].isna().all():
                    if col in df_principal_final.columns and not df_principal_final[col].isna().all():
                        # Usar dtype do principal
                        df_novos_final[col] = df_novos_final[col].astype(df_principal_final[col].dtype)
                if col not in df_principal_final.columns or df_principal_final[col].isna().all():
                    if col in df_novos_final.columns and not df_novos_final[col].isna().all():
                        # Usar dtype dos novos
                        df_principal_final[col] = df_principal_final[col].astype(df_novos_final[col].dtype)
            
            # Concatenar
            df_final = pd.concat([df_novos_final, df_principal_final], ignore_index=True)
            
            # Para colunas comuns, se houver duplicatas de registros (mesmo índice ou mesma combinação de chaves),
            # priorizar valores de df_novos. Como não temos chave única, vamos apenas concatenar.
            # A priorização será feita pela ordem: df_novos primeiro, então df_principal
            
            # Remover duplicatas baseado em todas as colunas comuns (exceto as que podem variar)
            # Mas isso pode remover registros legítimos, então vamos apenas logar
            print(f"Concatenação concluída: {len(df_final)} registros totais")
            print(f"  - Registros do principal: {len(df_principal_final)}")
            print(f"  - Registros dos novos casos: {len(df_novos_final)}")
            print(f"  - Colunas comuns (prioridade para novos casos): {len(colunas_comuns)}")
            print(f"  - Colunas únicas do principal: {len(colunas_unicas_principal)}")
            print(f"  - Colunas únicas dos novos casos: {len(colunas_unicas_novos)}")
            
            return df_final
    
    def _map_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Mapeia colunas do CSV/Excel para o formato esperado pelo dashboard"""
        mapped_df = pd.DataFrame()

        # Mapeamento principal (nome_interno: coluna_origem)
        # Suporta tanto colunas antigas quanto novas dos arquivos atualizados
        column_mapping = {
            'data_entrada': ['DATA ENTRADA', 'Data de entrada', 'Data Entrada'],
            'data_encerramento': ['DATA ENCERRAMENTO', 'Data do Encerramento', 'Data Encerramento'],
            'objeto_acao': ['Descricao do Tipo de Ação', 'ACO.Descrição', 'OBJETO DA AÇÃO', 'Objeto da Ação'],
            'estado': ['Estado', 'UF'],
            'status': ['Status', 'Situação'],
            'impacto_financeiro': ['Valor da Causa Atual', 'Valor da Causa', 'Valor Causa'],
            'nome_cliente': ['Pólo Ativo', 'REU.Nome', 'Nome Cliente', 'Cliente'],
            'numero_processo': ['Número do Processo', 'Número do processo', 'Número Processo', 
                               'Numero do Processo', 'Numero do processo', 'Numero Processo',
                               'Nº do Processo', 'Nº Processo', 'N. do Processo', 'N. Processo',
                               'Processo', 'Número Processo', 'Numero Processo'],
            'situacao': ['Situação', 'Status'],
            'prognostico': ['Descrição do Prognóstico', 'Prognóstico'],
            'area_juridica': ['Área Jurídica', 'Area Jurídica'],
            'comarca': ['Descricao Da Comarca', 'Comarca'],
            'foro': ['Foro/Tribunal', 'Foro'],
            'vara': ['Vara/Câmara', 'Vara'],
            'valor_causa': ['Valor da Causa', 'Valor da Causa Atual'],
            'motivo_encerramento': ['Motivo Encerramento', 'Motivo encerramento'],
            'data_distribuicao': ['Data de distribuição', 'Data Distribuição'],
            'reiteracoes_orig': ['Quantidade de Reiterações', 'Quantidade de Reiteraes', 'Reiterações'],
            'area_responsavel_orig': ['Area Responsável', 'Área Responsável', 'Area Responsavel'],
            'sentenca_orig': ['Sentença Favorável/Desfavorável', 'Sentença Favoravel/Desfavoravel'],
            'impacto_negativo_orig': ['Valor - Impacto Negativo', 'Impacto Negativo'],
            'descumprimento_obrigacao': ['Obrigações', 'Obrigaes', 'Descumprimento de Obrigação']
        }
        
        # Mapear colunas (agora suporta múltiplas opções por campo)
        for new_col, old_cols in column_mapping.items():
            if not isinstance(old_cols, list):
                old_cols = [old_cols]
            for old_col in old_cols:
                if old_col in df.columns:
                    if new_col not in mapped_df.columns:
                        mapped_df[new_col] = df[old_col]
                    else:
                        # Preencher valores faltantes
                        mapped_df[new_col] = mapped_df[new_col].fillna(df[old_col])
                    break  # Usar primeira coluna encontrada

        # Status: preencher com Situação quando Status estiver vazio
        if 'status' in mapped_df.columns and 'situacao' in mapped_df.columns:
            mapped_df['status'] = mapped_df['status'].fillna(mapped_df['situacao'])

        # Objeto da ação: fallback se ausente ou só nulos (robusto a encoding/variantes no Excel)
        if 'objeto_acao' not in mapped_df.columns or mapped_df['objeto_acao'].isna().all():
            for c in df.columns:
                s = str(c).lower()
                if ('descricao' in s and 'tipo' in s) or ('objeto' in s and ('ac' in s or 'ao' in s or 'aç' in s)):
                    col = df[c]
                    if 'objeto_acao' in mapped_df.columns:
                        mapped_df['objeto_acao'] = mapped_df['objeto_acao'].fillna(col)
                    else:
                        mapped_df['objeto_acao'] = col
                    break

        # Garantir colunas essenciais quando mapeamento não encontrou
        if len(mapped_df) == 0:
            mapped_df = df.copy()
            for k, v in [('objeto_acao', 'Descricao do Tipo de Ação'), ('objeto_acao', 'OBJETO DA AÇÃO'), ('estado', 'Estado'), ('data_entrada', 'Data de Entrada'), ('data_entrada', 'DATA ENTRADA'), ('impacto_financeiro', 'Valor da Causa Atual'), ('status', 'Status')]:
                if v in df.columns and k not in mapped_df.columns:
                    mapped_df[k] = df[v]
        
        # Buscar numero_processo por padrões alternativos se não foi mapeado
        if 'numero_processo' not in mapped_df.columns or mapped_df['numero_processo'].isna().all():
            for col in df.columns:
                col_lower = str(col).lower()
                if any(termo in col_lower for termo in ['processo', 'autos', 'nº', 'numero', 'num']) and 'objeto' not in col_lower:
                    if 'numero_processo' not in mapped_df.columns:
                        mapped_df['numero_processo'] = df[col]
                    else:
                        mapped_df['numero_processo'] = mapped_df['numero_processo'].fillna(df[col])
                    break

        # Processar datas
        if 'data_entrada' in mapped_df.columns:
            mapped_df['data_entrada'] = pd.to_datetime(mapped_df['data_entrada'], errors='coerce')
        elif 'data_distribuicao' in mapped_df.columns:
            mapped_df['data_entrada'] = pd.to_datetime(mapped_df['data_distribuicao'], errors='coerce')
        if 'data_encerramento' in mapped_df.columns:
            mapped_df['data_encerramento'] = pd.to_datetime(mapped_df['data_encerramento'], errors='coerce')

        # Normalizar status (inclui ENTRADA -> Em Tramitação)
        if 'status' in mapped_df.columns:
            mapped_df['status'] = mapped_df['status'].astype(str).map({
                'EM ANDAMENTO': 'Em Tramitação',
                'ENCERRADO': 'Encerrado',
                'ENTRADA': 'Em Tramitação',
                'Em andamento': 'Em Tramitação',
                'Encerrado': 'Encerrado',
                'Em Tramitação': 'Em Tramitação'
            }).fillna('Em Tramitação')
        elif 'situacao' in mapped_df.columns:
            mapped_df['status'] = mapped_df['situacao'].astype(str).map({
                'Em andamento': 'Em Tramitação',
                'Encerrado': 'Encerrado'
            }).fillna('Em Tramitação')
        else:
            mapped_df['status'] = 'Em Tramitação'

        if 'objeto_acao' in mapped_df.columns:
            mapped_df['objeto_acao'] = mapped_df['objeto_acao'].fillna('Não Informado')
        else:
            mapped_df['objeto_acao'] = 'Não Informado'
        if 'estado' in mapped_df.columns:
            mapped_df['estado'] = mapped_df['estado'].fillna('Não Informado')
        else:
            mapped_df['estado'] = 'Não Informado'

        mapped_df = self._calculate_derived_fields(mapped_df)
        return mapped_df
    
    def _calculate_derived_fields(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calcula campos derivados necessários para o dashboard"""
        # Tempo de tramitação (em dias)
        if 'data_entrada' in df.columns:
            hoje = datetime.now()
            df['tempo_tramitacao'] = (hoje - df['data_entrada']).dt.days
            df['tempo_tramitacao'] = df['tempo_tramitacao'].fillna(0).astype(int)
        else:
            df['tempo_tramitacao'] = 0

        # Área interna: preferir Area Responsável (CSV), senão Área Jurídica
        if 'area_responsavel_orig' in df.columns:
            df['area_interna'] = df['area_responsavel_orig'].fillna('Não Informado').astype(str).replace('nan', 'Não Informado')
        elif 'area_juridica' in df.columns:
            df['area_interna'] = df['area_juridica'].fillna('Não Informado')
        else:
            df['area_interna'] = 'Não Informado'
        
        # Normalizar áreas: Unificar Operações II, Operações, Customer do Banco, Operações Customer → Operações
        # Padronizar em 3 áreas: Operações, Cobranças, Jurídico Interno
        if 'area_interna' in df.columns:
            df['area_interna'] = df['area_interna'].astype(str)
            # Normalizar variações de Operações
            operacoes_variations = [
                'Operações II', 'Operações', 'Customer do Banco', 'Operações Customer',
                'Operações Customer do Banco', 'Customer', 'Operações I'
            ]
            for var in operacoes_variations:
                df.loc[df['area_interna'].str.contains(var, case=False, na=False), 'area_interna'] = 'Operações'
            
            # Normalizar variações de Cobranças
            cobrancas_variations = ['Cobranças', 'Cobrança', 'Cobranca']
            for var in cobrancas_variations:
                df.loc[df['area_interna'].str.contains(var, case=False, na=False), 'area_interna'] = 'Cobranças'
            
            # Normalizar variações de Jurídico Interno
            juridico_variations = ['Jurídico Interno', 'Juridico Interno', 'Jurídico', 'Juridico']
            for var in juridico_variations:
                df.loc[df['area_interna'].str.contains(var, case=False, na=False), 'area_interna'] = 'Jurídico Interno'
            
            # Manter outras áreas como estão (caso haja outras áreas não mencionadas)
            # Garantir que valores vazios ou inválidos sejam "Não Informado"
            df.loc[df['area_interna'].isin(['nan', 'None', '', 'NaN']), 'area_interna'] = 'Não Informado'

        # Reiterações: preferir Quantidade de Reiterações (CSV), senão estimar
        if 'reiteracoes_orig' in df.columns:
            df['reiteracoes'] = df['reiteracoes_orig'].fillna(0).astype(int)
        elif 'tempo_tramitacao' in df.columns:
            df['reiteracoes'] = (df['tempo_tramitacao'] / 30).astype(int).clip(upper=20)
        else:
            df['reiteracoes'] = 0

        df['sla_dias'] = 30
        df['prazo_dias'] = df['tempo_tramitacao'].clip(upper=30) if 'tempo_tramitacao' in df.columns else 30

        # Calcular SLA real: diferença entre data_encerramento e data_entrada
        if 'data_entrada' in df.columns and 'data_encerramento' in df.columns:
            # Garantir que as datas estejam em formato datetime
            df['data_entrada'] = pd.to_datetime(df['data_entrada'], errors='coerce')
            df['data_encerramento'] = pd.to_datetime(df['data_encerramento'], errors='coerce')
            # Calcular diferença em dias
            df['sla_real'] = (df['data_encerramento'] - df['data_entrada']).dt.days
            df['sla_real'] = df['sla_real'].clip(lower=0)  # Garantir valores não negativos
            df['sla_real'] = df['sla_real'].fillna(0).astype(float)
        else:
            df['sla_real'] = 0.0

        # Impacto financeiro: Valor da Causa Atual; se 0, tentar Valor - Impacto Negativo (CSV)
        if 'impacto_financeiro' not in df.columns:
            df['impacto_financeiro'] = 0.0
        df['impacto_financeiro'] = pd.to_numeric(df['impacto_financeiro'], errors='coerce').fillna(0)
        if 'impacto_negativo_orig' in df.columns:
            neg = pd.to_numeric(df['impacto_negativo_orig'], errors='coerce').fillna(0)
            df['impacto_financeiro'] = df['impacto_financeiro'].where(df['impacto_financeiro'] > 0, neg)
        if 'valor_causa' in df.columns and (df['impacto_financeiro'] == 0).any():
            df.loc[df['impacto_financeiro'] == 0, 'impacto_financeiro'] = pd.to_numeric(df['valor_causa'], errors='coerce').fillna(0)

        df['custo_encerramento'] = df['impacto_financeiro'] * 0.1

        # Sentença: preferir Sentença Favorável/Desfavorável (CSV), senão prognóstico
        if 'sentenca_orig' in df.columns:
            s = df['sentenca_orig'].astype(str).str.strip()
            df['sentenca'] = s.map({
                'Favorável': 'Favorável', 'Favoravel': 'Favorável',
                'Desfavorável': 'Desfavorável', 'Desfavoravel': 'Desfavorável',
                'Parcial': 'Parcial', 'Sem Sentença': 'Parcial', 'Sem Sentenç': 'Parcial'
            }).fillna('Parcial')
        elif 'prognostico' in df.columns:
            df['sentenca'] = df['prognostico'].map({
                'Incontroverso': 'Favorável', 'Possível': 'Parcial', 'Improvável': 'Desfavorável', 'Provável': 'Parcial', 'Remoto': 'Desfavorável'
            }).fillna('Parcial')
        else:
            df['sentenca'] = 'Parcial'

        if 'nome_cliente' in df.columns:
            client_counts = df['nome_cliente'].value_counts()
            df['reincidencia'] = df['nome_cliente'].map(client_counts) > 1
        else:
            df['reincidencia'] = False

        df['tipo_acao'] = df['objeto_acao'] if 'objeto_acao' in df.columns else 'Não Informado'

        if 'motivo_encerramento' in df.columns:
            df['erro_sistemico'] = df['motivo_encerramento'].astype(str).str.contains(
                'erro|sistêmico|sistemico|TI', case=False, na=False
            )
        else:
            df['erro_sistemico'] = False

        if 'impacto_financeiro' in df.columns:
            impacto_medio = df['impacto_financeiro'].median()
            tempo_medio = df['tempo_tramitacao'].median()
            df['critico'] = (
                (df['impacto_financeiro'] > impacto_medio * 2) |
                (df['tempo_tramitacao'] > tempo_medio * 2)
            )
        else:
            df['critico'] = False

        # Manter descumprimento_obrigacao para uso em alertas
        # Remover apenas colunas auxiliares temporárias (mantendo originais para referência se necessário)
        # Não remover descumprimento_obrigacao pois será usado na tarefa de alertas

        return df

    def get_dataframe(self):
        """Retorna o DataFrame completo"""
        return self._df.copy()
    
    def reload(self):
        """Recarrega os dados"""
        self._load_data()


# Instância global do loader
_loader = None

def get_loader():
    """Singleton do DataLoader"""
    global _loader
    if _loader is None:
        _loader = DataLoader()
    return _loader
