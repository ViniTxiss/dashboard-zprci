# -*- coding: utf-8 -*-
"""
Script de validação para comparar Excel original com dados processados
"""
import pandas as pd
import sys
import io
from pathlib import Path

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SCRIPT_DIR = Path(__file__).parent.absolute()
DATA_DIR = SCRIPT_DIR / 'data'

print("=" * 80)
print("VALIDAÇÃO DE DADOS: Excel Original vs Dados Processados")
print("=" * 80)

# 1. LER EXCEL ORIGINAL
print("\n1. LENDO EXCEL ORIGINAL...")
excel_file = None
for f in DATA_DIR.glob('*.xlsx'):
    if 'Material' in str(f) or 'Base completa' in str(f):
        excel_file = f
        break

if not excel_file:
    print("ERRO: Arquivo Excel não encontrado!")
    sys.exit(1)

xls = pd.ExcelFile(excel_file)
df_base_original = pd.read_excel(xls, sheet_name='Base Geral')
print(f"✓ Excel original carregado: {len(df_base_original)} registros")

# 2. LER DADOS PROCESSADOS
print("\n2. LENDO DADOS PROCESSADOS...")
arquivo_processado = DATA_DIR / 'DADOS_NOVOS_CASOS.xlsx'
if not arquivo_processado.exists():
    print("ERRO: Arquivo DADOS_NOVOS_CASOS.xlsx não encontrado!")
    print("Execute primeiro: python backend/etl_final_v2.py")
    sys.exit(1)

df_processado = pd.read_excel(arquivo_processado)
print(f"✓ Dados processados carregados: {len(df_processado)} registros")

# 3. COMPARAR TOTAIS
print("\n3. COMPARAÇÃO DE TOTAIS")
print("-" * 80)
print(f"Excel Original (Base Geral):     {len(df_base_original):4d} registros")
print(f"Dados Processados:               {len(df_processado):4d} registros")
diferenca = len(df_base_original) - len(df_processado)
if diferenca == 0:
    print("✓ Total de registros: CORRETO")
else:
    print(f"⚠ DIFERENÇA: {diferenca} registros")

# 4. COMPARAR SENTENÇAS
print("\n4. COMPARAÇÃO DE SENTENÇAS")
print("-" * 80)

# Excel original
if 'Sentença Favorável/Desfavorável' in df_base_original.columns:
    sentencas_original = df_base_original['Sentença Favorável/Desfavorável'].value_counts()
    print("\nExcel Original:")
    for tipo, qtd in sentencas_original.items():
        print(f"  {tipo:30s}: {qtd:4d}")
    total_original = sentencas_original.sum()
    print(f"  {'TOTAL':30s}: {total_original:4d}")
else:
    print("ERRO: Coluna 'Sentença Favorável/Desfavorável' não encontrada no Excel!")
    sentencas_original = pd.Series()

# Dados processados
if 'sentenca' in df_processado.columns:
    sentencas_processado = df_processado['sentenca'].value_counts()
    print("\nDados Processados:")
    for tipo, qtd in sentencas_processado.items():
        print(f"  {tipo:30s}: {qtd:4d}")
    total_processado = sentencas_processado.sum()
    print(f"  {'TOTAL':30s}: {total_processado:4d}")
else:
    print("ERRO: Coluna 'sentenca' não encontrada nos dados processados!")
    sentencas_processado = pd.Series()

# Comparar
if not sentencas_original.empty and not sentencas_processado.empty:
    print("\nComparação:")
    # Mapear valores do Excel para valores processados
    mapeamento = {
        'Favorável': 'Favorável',
        'Desfavorável': 'Desfavorável',
        'Procon': 'Parcial',
        'procon': 'Parcial',
        'Em andamento': 'Parcial',
        'Acordo - erro interno': 'Parcial',
        'Ag. Julgamento': 'Parcial',
        'Pendente julgamento': 'Pendente'
    }
    
    for tipo_original, qtd_original in sentencas_original.items():
        tipo_processado = mapeamento.get(tipo_original, 'Parcial')
        qtd_processado = sentencas_processado.get(tipo_processado, 0)
        if qtd_original == qtd_processado:
            status = "✓"
        else:
            status = "⚠"
        print(f"  {status} {tipo_original:30s}: Original={qtd_original:4d}, Processado={qtd_processado:4d}")

# 5. COMPARAR OBJETOS DA AÇÃO
print("\n5. COMPARAÇÃO DE OBJETOS DA AÇÃO")
print("-" * 80)

if 'OBJETO DA AÇÃO' in df_base_original.columns:
    objetos_original = df_base_original['OBJETO DA AÇÃO'].value_counts()
    print(f"\nExcel Original: {len(objetos_original)} objetos únicos")
    print("Top 10 objetos:")
    for obj, qtd in objetos_original.head(10).items():
        print(f"  {obj:40s}: {qtd:4d}")
else:
    objetos_original = pd.Series()

if 'objeto_acao' in df_processado.columns:
    objetos_processado = df_processado['objeto_acao'].value_counts()
    print(f"\nDados Processados: {len(objetos_processado)} objetos únicos")
    print("Top 10 objetos:")
    for obj, qtd in objetos_processado.head(10).items():
        print(f"  {obj:40s}: {qtd:4d}")
else:
    objetos_processado = pd.Series()

# 6. COMPARAR SENTENÇAS POR OBJETO
print("\n6. COMPARAÇÃO DE SENTENÇAS POR OBJETO")
print("-" * 80)

if 'OBJETO DA AÇÃO' in df_base_original.columns and 'Sentença Favorável/Desfavorável' in df_base_original.columns:
    sentencas_por_objeto_original = df_base_original.groupby(['OBJETO DA AÇÃO', 'Sentença Favorável/Desfavorável']).size()
    print(f"Excel Original: {len(sentencas_por_objeto_original)} combinações objeto+sentença")
    print("Primeiras 10 combinações:")
    for (obj, sent), qtd in sentencas_por_objeto_original.head(10).items():
        print(f"  {obj:30s} | {sent:25s}: {qtd:4d}")

if 'objeto_acao' in df_processado.columns and 'sentenca' in df_processado.columns:
    sentencas_por_objeto_processado = df_processado.groupby(['objeto_acao', 'sentenca']).size()
    print(f"\nDados Processados: {len(sentencas_por_objeto_processado)} combinações objeto+sentença")
    print("Primeiras 10 combinações:")
    for (obj, sent), qtd in sentencas_por_objeto_processado.head(10).items():
        print(f"  {obj:30s} | {sent:25s}: {qtd:4d}")

# 7. RESUMO FINAL
print("\n" + "=" * 80)
print("RESUMO FINAL")
print("=" * 80)
print(f"Total de registros no Excel:        {len(df_base_original):4d}")
print(f"Total de registros processados:     {len(df_processado):4d}")
print(f"Diferença:                          {diferenca:4d}")

if diferenca == 0:
    print("\n✓ VALIDAÇÃO: Todos os registros foram processados corretamente!")
else:
    print(f"\n⚠ VALIDAÇÃO: Há {diferenca} registros não processados. Verifique o ETL.")

print("=" * 80)
