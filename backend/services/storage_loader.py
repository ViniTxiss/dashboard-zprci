"""
Serviço para carregar arquivos Excel de storage externo (S3, Google Cloud Storage, etc.)
Permite manter arquivos sensíveis fora do repositório Git
"""

import os
import boto3
from pathlib import Path
from typing import Optional
import logging
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class StorageLoader:
    """
    Classe para carregar arquivos de storage externo.
    Suporta AWS S3 e pode ser estendido para outros providers.
    """
    
    def __init__(self):
        self.s3_client = None
        self.bucket_name = os.getenv("S3_BUCKET_NAME")
        self.aws_access_key = os.getenv("AWS_ACCESS_KEY_ID")
        self.aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
        self.aws_region = os.getenv("AWS_REGION", "us-east-1")
        
        # Inicializar cliente S3 se credenciais estiverem disponíveis
        if self.bucket_name and self.aws_access_key and self.aws_secret_key:
            try:
                self.s3_client = boto3.client(
                    's3',
                    aws_access_key_id=self.aws_access_key,
                    aws_secret_access_key=self.aws_secret_key,
                    region_name=self.aws_region
                )
                logger.info("Cliente S3 inicializado com sucesso")
            except Exception as e:
                logger.error(f"Erro ao inicializar cliente S3: {e}")
                self.s3_client = None
        else:
            logger.info("Credenciais S3 não configuradas. Storage externo desabilitado.")
    
    def download_file_from_s3(self, s3_key: str, local_path: Path) -> bool:
        """
        Baixa um arquivo do S3 para o sistema de arquivos local.
        
        Args:
            s3_key: Chave do arquivo no S3 (caminho relativo no bucket)
            local_path: Caminho local onde salvar o arquivo
            
        Returns:
            True se o download foi bem-sucedido, False caso contrário
        """
        if not self.s3_client or not self.bucket_name:
            logger.warning("S3 não configurado. Não é possível baixar arquivo.")
            return False
        
        try:
            # Criar diretório pai se não existir
            local_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Baixar arquivo
            logger.info(f"Baixando {s3_key} do S3 para {local_path}")
            self.s3_client.download_file(self.bucket_name, s3_key, str(local_path))
            
            logger.info(f"Arquivo baixado com sucesso: {local_path}")
            return True
            
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            if error_code == 'NoSuchKey':
                logger.warning(f"Arquivo não encontrado no S3: {s3_key}")
            else:
                logger.error(f"Erro ao baixar arquivo do S3: {e}")
            return False
        except Exception as e:
            logger.error(f"Erro inesperado ao baixar arquivo do S3: {e}")
            return False
    
    def download_data_files(self, data_dir: Path) -> dict:
        """
        Baixa os arquivos Excel necessários do S3 para o diretório de dados.
        
        Args:
            data_dir: Diretório local onde salvar os arquivos
            
        Returns:
            Dicionário com status de cada arquivo baixado
        """
        results = {
            'principal': False,
            'novos_casos': False,
            'errors': []
        }
        
        if not self.s3_client or not self.bucket_name:
            logger.info("S3 não configurado. Pulando download de arquivos.")
            return results
        
        # Arquivos esperados
        files_to_download = {
            'principal': {
                's3_key': os.getenv('S3_DATA_FILE_PRINCIPAL', 'data/Material Casos Críticos - RCI - 2025 - Base completa.xlsx'),
                'local_name': 'Material Casos Críticos - RCI - 2025 - Base completa.xlsx'
            },
            'novos_casos': {
                's3_key': os.getenv('S3_DATA_FILE_NOVOS_CASOS', 'data/novos casos .xlsx'),
                'local_name': 'novos casos .xlsx'
            }
        }
        
        # Baixar cada arquivo
        for file_type, file_info in files_to_download.items():
            local_path = data_dir / file_info['local_name']
            
            # Verificar se arquivo já existe localmente (evitar download desnecessário)
            if local_path.exists():
                logger.info(f"Arquivo já existe localmente: {local_path}")
                results[file_type] = True
                continue
            
            # Tentar baixar do S3
            success = self.download_file_from_s3(file_info['s3_key'], local_path)
            results[file_type] = success
            
            if not success:
                results['errors'].append(f"Falha ao baixar {file_type}: {file_info['s3_key']}")
        
        return results
    
    def file_exists_in_s3(self, s3_key: str) -> bool:
        """
        Verifica se um arquivo existe no S3.
        
        Args:
            s3_key: Chave do arquivo no S3
            
        Returns:
            True se o arquivo existe, False caso contrário
        """
        if not self.s3_client or not self.bucket_name:
            return False
        
        try:
            self.s3_client.head_object(Bucket=self.bucket_name, Key=s3_key)
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                return False
            logger.error(f"Erro ao verificar arquivo no S3: {e}")
            return False


def download_data_files_from_storage(data_dir: Path) -> dict:
    """
    Função auxiliar para baixar arquivos de dados do storage externo.
    Usada no startup do aplicativo.
    
    Args:
        data_dir: Diretório onde salvar os arquivos
        
    Returns:
        Dicionário com resultados do download
    """
    loader = StorageLoader()
    return loader.download_data_files(data_dir)
