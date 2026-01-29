# -*- coding: utf-8 -*-
"""
ETL Final V2 - Extração de Dados Reais do Excel
Lê as sheets "atualizacao" e "Base Geral" e unifica os dados conforme mapeamento.
"""
import pandas as pd
import numpy as np
from datetime import datetime
import glob
import re
import sys
import io
import os
from pathlib import Path

# Configurar encoding para UTF-8 no Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# Obter diretório do script
SCRIPT_DIR = Path(__file__).parent.absolute()
DATA_DIR = SCRIPT_DIR / 'data'

def extrair_uf(descricao):
    """Extrai UF de JUI.Descrição (ex: "Resende/RJ" -> "RJ")"""
    if pd.isna(descricao):
        return None
    desc_str = str(descricao).upper()
    # Buscar padrão de 2 letras maiúsculas no final (UF)
    match = re.search(r'/([A-Z]{2})$', desc_str)
    if match:
        return match.group(1)
    # Se já for só 2 letras, retornar
    if len(desc_str) == 2 and desc_str.isalpha():
        return desc_str
    return None

def normalizar_valor(valor):
    """Normaliza valores financeiros removendo caracteres especiais"""
    if pd.isna(valor):
        return 0.0
    if isinstance(valor, (int, float)):
        return float(valor)
    # Remover caracteres não numéricos exceto ponto e vírgula
    valor_str = str(valor).replace('R$', '').replace(' ', '').replace('.', '').replace(',', '.')
    try:
        return float(valor_str)
    except:
        return 0.0

def gerar_base_limpa():
    """Lê Excel e gera base unificada"""
    
    # 1. ENCONTRAR ARQUIVO EXCEL
    excel_files = list(DATA_DIR.glob('*.xlsx'))
    excel_file = None
    for f in excel_files:
        f_str = str(f)
        if 'Material' in f_str or 'Base' in f_str:
            excel_file = f
            break
    
    if not excel_file:
        raise FileNotFoundError(f"Arquivo Excel 'Material Casos Críticos' não encontrado em {DATA_DIR}")
    
    print(f"Lendo arquivo: {excel_file}")
    xls = pd.ExcelFile(excel_file)
    
    # 2. LER SHEET "atualizacao" (Casos Novos)
    print("\n=== Processando Sheet 'atualizacao' (Casos Novos) ===")
    df_atualizacao = pd.read_excel(xls, sheet_name='atualizacao')
    print(f"Linhas encontradas: {len(df_atualizacao)}")
    
    # Mapear colunas da Sheet Atualização
    dados_atualizacao = []
    for idx, row in df_atualizacao.iterrows():
        # Pular linhas vazias ou cabeçalhos
        if pd.isna(row.get('AUT.Nome')) or str(row.get('AUT.Nome')).strip() == '':
            continue
        
        # Extrair dados conforme dicionário
        nome_cliente = str(row.get('AUT.Nome', '')).strip() if pd.notna(row.get('AUT.Nome')) else 'Não Informado'
        numero_processo = str(row.get('Número do processo', '')).strip() if pd.notna(row.get('Número do processo')) else ''
        data_entrada = row.get('Data de entrada') or row.get('DATA ENTRADA')
        objeto_acao = str(row.get('ACO.Descrição', '')).strip() if pd.notna(row.get('ACO.Descrição')) else 'Não Informado'
        
        # Extrair UF de JUI.Descrição ou usar coluna UF
        estado = None
        if pd.notna(row.get('UF')):
            estado = str(row.get('UF')).strip().upper()
        elif pd.notna(row.get('JUI.Descrição')):
            estado = extrair_uf(row.get('JUI.Descrição'))
        if not estado or len(estado) != 2:
            estado = 'SP'  # Default
        
        # Valor de impacto
        impacto = normalizar_valor(row.get('Valor - Impacto Negativo') or row.get('Valor - Impac'))
        
        # Área responsável
        area_interna = str(row.get('Area Responsável', '')).strip() if pd.notna(row.get('Area Responsável')) else 'Jurídico'
        
        # Sentença
        sentenca = str(row.get('Sentença Favorável/Desfavorável', '')).strip() if pd.notna(row.get('Sentença Favorável/Desfavorável')) else 'Pendente'
        
        # Reiterações
        reiteracoes = 0
        if pd.notna(row.get('Quantidade de Reiterações')):
            try:
                reiteracoes = int(float(str(row.get('Quantidade de Reiterações')).replace(',', '.')))
            except:
                reiteracoes = 0
        
        # Data de encerramento
        data_encerramento = row.get('DATA ENCERRAMENTO')
        
        # Motivo de encerramento
        motivo_encerramento = str(row.get('Motivo encerramento', '')).strip() if pd.notna(row.get('Motivo encerramento')) else ''
        
        # Status (se tem DATA ENCERRAMENTO, está encerrado)
        status = 'Em Tramitação'
        if pd.notna(data_encerramento):
            status = 'Encerrado'
        
        # Detectar erro sistêmico baseado em motivo_encerramento
        erro_sistemico = False
        if motivo_encerramento:
            motivo_lower = motivo_encerramento.lower()
            erro_sistemico = any(palavra in motivo_lower for palavra in ['erro', 'sistêmico', 'sistemico', 'ti', 'tecnologia', 'sistema'])
        
        dados_atualizacao.append({
            'nome_cliente': nome_cliente,
            'numero_processo': numero_processo,
            'data_entrada': data_entrada,
            'data_encerramento': data_encerramento,
            'objeto_acao': objeto_acao,
            'estado': estado,
            'impacto_financeiro': impacto,
            'area_interna': area_interna,
            'sentenca': sentenca,
            'reiteracoes': reiteracoes,
            'status': status,
            'motivo_encerramento': motivo_encerramento,
            'erro_sistemico': erro_sistemico,
            'fonte': 'atualizacao'
        })
    
    print(f"Registros processados da atualização: {len(dados_atualizacao)}")
    
    # 3. LER SHEET "Base Geral" (Casos Históricos)
    print("\n=== Processando Sheet 'Base Geral' (Casos Históricos) ===")
    df_base = pd.read_excel(xls, sheet_name='Base Geral')
    print(f"Linhas encontradas: {len(df_base)}")
    
    # Mapear colunas da Base Geral
    dados_base = []
    linhas_puladas = 0
    for idx, row in df_base.iterrows():
        # Pular linhas vazias ou cabeçalhos (mas apenas se AUT.Nome estiver realmente vazio)
        nome_cliente_raw = row.get('AUT.Nome')
        if pd.isna(nome_cliente_raw) or (isinstance(nome_cliente_raw, str) and nome_cliente_raw.strip() == ''):
            # Verificar se há outros dados na linha que indiquem que é um registro válido
            tem_outros_dados = (
                pd.notna(row.get('OBJETO DA AÇÃO')) or 
                pd.notna(row.get('DATA ENTRADA')) or 
                pd.notna(row.get('VALOR DA CAUSA'))
            )
            if not tem_outros_dados:
                linhas_puladas += 1
                continue
        
        # Extrair dados conforme dicionário
        nome_cliente = str(row.get('AUT.Nome', '')).strip() if pd.notna(row.get('AUT.Nome')) else 'Não Informado'
        numero_processo = str(row.get('Número de integração', '')).strip() if pd.notna(row.get('Número de integração')) else ''
        data_entrada = row.get('Data de entrada') or row.get('DATA ENTRADA')
        objeto_acao = str(row.get('OBJETO DA AÇÃO', '')).strip() if pd.notna(row.get('OBJETO DA AÇÃO')) else 'Não Informado'
        
        # UF direto da coluna
        estado = str(row.get('UF', 'SP')).strip().upper() if pd.notna(row.get('UF')) else 'SP'
        if len(estado) != 2:
            estado = 'SP'
        
        # Valor da causa
        impacto = normalizar_valor(row.get('VALOR DA CAUSA') or row.get('Valor - Impacto Negativo'))
        
        # Área responsável
        area_interna = str(row.get('Area Responsável', '')).strip() if pd.notna(row.get('Area Responsável')) else 'Jurídico'
        
        # Sentença
        sentenca = str(row.get('Sentença Favorável/Desfavorável', '')).strip() if pd.notna(row.get('Sentença Favorável/Desfavorável')) else 'Pendente'
        
        # Reiterações
        reiteracoes = 0
        if pd.notna(row.get('Quantidade de Reiterações')):
            try:
                reiteracoes = int(float(str(row.get('Quantidade de Reiterações')).replace(',', '.')))
            except:
                reiteracoes = 0
        
        # Data de encerramento
        data_encerramento = row.get('DATA ENCERRAMENTO')
        
        # Motivo de encerramento
        motivo_encerramento = str(row.get('Motivo encerramento', '')).strip() if pd.notna(row.get('Motivo encerramento')) else ''
        
        # Status
        status = 'Em Tramitação'
        if pd.notna(data_encerramento):
            status = 'Encerrado'
        
        # Detectar erro sistêmico baseado em motivo_encerramento
        erro_sistemico = False
        if motivo_encerramento:
            motivo_lower = motivo_encerramento.lower()
            erro_sistemico = any(palavra in motivo_lower for palavra in ['erro', 'sistêmico', 'sistemico', 'ti', 'tecnologia', 'sistema'])
        
        dados_base.append({
            'nome_cliente': nome_cliente,
            'numero_processo': numero_processo,
            'data_entrada': data_entrada,
            'data_encerramento': data_encerramento,
            'objeto_acao': objeto_acao,
            'estado': estado,
            'impacto_financeiro': impacto,
            'area_interna': area_interna,
            'sentenca': sentenca,
            'reiteracoes': reiteracoes,
            'status': status,
            'motivo_encerramento': motivo_encerramento,
            'erro_sistemico': erro_sistemico,
            'fonte': 'base_geral'
        })
    
    print(f"Registros processados da base geral: {len(dados_base)}")
    print(f"Linhas puladas (vazias/cabeçalhos): {linhas_puladas}")
    print(f"Taxa de processamento: {(len(dados_base) / len(df_base) * 100):.1f}%")
    
    # 4. UNIFICAR DADOS
    print("\n=== Unificando dados ===")
    dados_unificados = dados_atualizacao + dados_base
    df = pd.DataFrame(dados_unificados)
    print(f"Total de registros unificados: {len(df)}")
    
    # 5. TRATAMENTO DE TIPOS E VALIDAÇÃO
    print("\n=== Tratando tipos e validando dados ===")
    
    # Converter datas
    df['data_entrada'] = pd.to_datetime(df['data_entrada'], errors='coerce')
    df['data_encerramento'] = pd.to_datetime(df['data_encerramento'], errors='coerce')
    
    # Contar registros antes e depois da validação
    total_antes = len(df)
    registros_sem_data = df[df['data_entrada'].isna()].copy()
    
    # Se houver registros sem data_entrada, preencher com data padrão (primeira data disponível ou data atual)
    if len(registros_sem_data) > 0:
        print(f"AVISO: {len(registros_sem_data)} registros sem data_entrada válida. Preenchendo com data padrão...")
        # Usar a primeira data válida como padrão, ou data atual se não houver
        data_padrao = df['data_entrada'].min() if df['data_entrada'].notna().any() else pd.Timestamp.now()
        df.loc[df['data_entrada'].isna(), 'data_entrada'] = data_padrao
    
    print(f"Registros após tratamento de datas: {len(df)} (antes: {total_antes})")
    
    # Garantir tipos numéricos
    df['impacto_financeiro'] = pd.to_numeric(df['impacto_financeiro'], errors='coerce').fillna(0.0).astype(float)
    df['reiteracoes'] = pd.to_numeric(df['reiteracoes'], errors='coerce').fillna(0).astype(int)
    
    # Campos booleanos
    df['critico'] = False  # Será calculado pelo backend se necessário
    # erro_sistemico já foi detectado durante a leitura, garantir que existe
    if 'erro_sistemico' not in df.columns:
        df['erro_sistemico'] = False
    else:
        df['erro_sistemico'] = df['erro_sistemico'].fillna(False).astype(bool)
    df['reincidencia'] = False
    
    # Garantir que motivo_encerramento existe
    if 'motivo_encerramento' not in df.columns:
        df['motivo_encerramento'] = ''
    else:
        df['motivo_encerramento'] = df['motivo_encerramento'].fillna('')
    
    # Preencher campos vazios
    df['status'] = df['status'].fillna('Em Tramitação')
    df['estado'] = df['estado'].fillna('SP')
    df['objeto_acao'] = df['objeto_acao'].fillna('Não Informado')
    df['nome_cliente'] = df['nome_cliente'].fillna('Não Informado')
    df['numero_processo'] = df['numero_processo'].fillna('')
    df['area_interna'] = df['area_interna'].fillna('Jurídico')
    df['sentenca'] = df['sentenca'].fillna('Pendente')
    
    # Remover coluna 'fonte' (apenas para debug)
    if 'fonte' in df.columns:
        df = df.drop(columns=['fonte'])
    
    # 6. SALVAR
    output = DATA_DIR / 'DADOS_NOVOS_CASOS.xlsx'
    df.to_excel(output, index=False, engine='openpyxl')
    
    print(f"\n✅ SUCESSO: Arquivo {output} gerado com {len(df)} registros REAIS")
    print(f"\nEstatísticas:")
    print(f"  - Total de registros: {len(df)}")
    print(f"  - Impacto total: R$ {df['impacto_financeiro'].sum():,.2f}")
    print(f"  - Em tramitação: {(df['status'] == 'Em Tramitação').sum()}")
    print(f"  - Encerrados: {(df['status'] == 'Encerrado').sum()}")
    print(f"  - Estados únicos: {df['estado'].nunique()}")
    print(f"  - Objetos de ação únicos: {df['objeto_acao'].nunique()}")
    print(f"  - Áreas internas: {df['area_interna'].unique().tolist()}")
    print(f"  - Reiterações máximas: {df['reiteracoes'].max()}")
    
    return df

if __name__ == "__main__":
    gerar_base_limpa()
