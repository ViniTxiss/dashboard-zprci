# Changelog - Atualização do Sistema de Dados

## Data: 2025-01-21

### ✅ Alterações Realizadas

#### 1. **DataLoader Atualizado**
- ✅ Refatorado para usar apenas `DADOS_NOVOS_CASOS.xlsx`
- ✅ Arquivo padrão contém estritamente os dados dos PDFs recentes
- ✅ Removida dependência de arquivos legados
- ✅ Mapeamento automático de colunas do arquivo real para formato interno
- ✅ Cálculo de campos derivados (tempo_tramitacao, area_interna, etc.)
- ✅ Tratamento de valores nulos e dados ausentes

#### 2. **Mapeamento de Colunas**
Mapeamento implementado:
- `Data de Entrada` → `data_entrada`
- `Data do Encerramento` → `data_encerramento`
- `Descricao do Tipo de Ação` → `objeto_acao`
- `Estado` → `estado`
- `Status` → `status` (normalizado: 'EM ANDAMENTO' → 'Em Tramitação', 'ENCERRADO' → 'Encerrado')
- `Valor da Causa Atual` → `impacto_financeiro`
- `Pólo Ativo` → `nome_cliente`
- E mais 10+ campos mapeados

#### 3. **Agregações por Ano**
- ✅ `get_entradas_by_object()` agora retorna dados por ano (2022-2025)
- ✅ `get_encerrados_by_object()` retorna dados por ano (2023-2025)
- ✅ Formato compatível com tabelas do PDF original

#### 4. **Frontend Atualizado**
- ✅ Tabelas de Entradas e Encerrados agora exibem dados por ano
- ✅ Tratamento de dados com anos ou formato simples
- ✅ Melhor tratamento de casos críticos com campos detalhados

#### 5. **Campos Derivados Calculados**
- ✅ `tempo_tramitacao`: Calculado a partir de data_entrada
- ✅ `area_interna`: Baseado em Área Jurídica
- ✅ `reiteracoes`: Estimado baseado em tempo de tramitação
- ✅ `sla_dias` e `prazo_dias`: Configurados
- ✅ `custo_encerramento`: 10% do impacto financeiro
- ✅ `sentenca`: Mapeado de Prognóstico
- ✅ `reincidencia`: Detectado por múltiplos processos do mesmo cliente
- ✅ `erro_sistemico`: Detectado em motivo de encerramento
- ✅ `critico`: Baseado em impacto e tempo

### 📊 Dados Carregados
- **Total de registros**: 944 casos
- **Status**: 827 Em Tramitação, 117 Encerrados
- **Objetos únicos**: 19 tipos de ações
- **Estados únicos**: 33 estados
- **Impacto total**: R$ 46.754.598,78

### 🔧 Próximos Passos Recomendados
1. Enriquecer dados de reiterações com arquivo de casos críticos
2. Melhorar detecção de erros sistêmicos
3. Garantir que DADOS_NOVOS_CASOS.xlsx contenha todos os campos necessários
4. Ajustar cálculos de SLA baseado em regras de negócio reais

### 📝 Notas
- O sistema funciona com dados mock se os arquivos não forem encontrados
- Todos os campos são tratados com valores padrão quando ausentes
- Datas são convertidas automaticamente para formato datetime
