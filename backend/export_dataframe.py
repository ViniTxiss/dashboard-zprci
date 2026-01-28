"""
Script para exportar todos os dados do DataFrame para Excel
"""

import sys
import pandas as pd
from pathlib import Path
from datetime import datetime

# Adicionar o diretório backend ao path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir.parent))

from backend.services.data_loader import get_loader

def export_dataframe_to_excel():
    """Exporta todos os dados do DataFrame para um arquivo Excel"""
    
    print("Carregando dados...")
    loader = get_loader()
    df = loader.get_dataframe()
    
    if df is None or df.empty:
        print("ERRO: DataFrame está vazio ou não foi carregado.")
        return False
    
    print(f"DataFrame carregado: {len(df)} registros, {len(df.columns)} colunas")
    print(f"Colunas: {', '.join(df.columns.tolist()[:10])}...")
    
    # Criar nome do arquivo com timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = backend_dir / "data" / f"dataframe_export_{timestamp}.xlsx"
    
    # Garantir que o diretório existe
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    print(f"\nExportando para: {output_file}")
    
    try:
        # Exportar para Excel
        # Usar engine='openpyxl' e configurar opções para melhor compatibilidade
        with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
            # Exportar DataFrame principal
            df.to_excel(
                writer,
                sheet_name='Dados Completos',
                index=False,
                engine='openpyxl'
            )
            
            # Criar sheet com informações sobre o DataFrame
            info_data = {
                'Informação': [
                    'Total de Registros',
                    'Total de Colunas',
                    'Data de Exportação',
                    'Colunas Disponíveis'
                ],
                'Valor': [
                    len(df),
                    len(df.columns),
                    datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    ', '.join(df.columns.tolist())
                ]
            }
            info_df = pd.DataFrame(info_data)
            info_df.to_excel(
                writer,
                sheet_name='Informações',
                index=False,
                engine='openpyxl'
            )
            
            # Criar sheet com estatísticas básicas
            stats_data = {
                'Coluna': [],
                'Tipo': [],
                'Valores Não Nulos': [],
                'Valores Nulos': [],
                'Valores Únicos': []
            }
            
            for col in df.columns:
                stats_data['Coluna'].append(col)
                stats_data['Tipo'].append(str(df[col].dtype))
                stats_data['Valores Não Nulos'].append(df[col].notna().sum())
                stats_data['Valores Nulos'].append(df[col].isna().sum())
                stats_data['Valores Únicos'].append(df[col].nunique())
            
            stats_df = pd.DataFrame(stats_data)
            stats_df.to_excel(
                writer,
                sheet_name='Estatísticas',
                index=False,
                engine='openpyxl'
            )
        
        print(f"\n[OK] Arquivo exportado com sucesso!")
        print(f"  Localizacao: {output_file}")
        print(f"  Tamanho: {output_file.stat().st_size / 1024 / 1024:.2f} MB")
        print(f"  Registros: {len(df)}")
        print(f"  Colunas: {len(df.columns)}")
        
        return True
        
    except Exception as e:
        print(f"\n[ERRO] Erro ao exportar: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = export_dataframe_to_excel()
    sys.exit(0 if success else 1)
