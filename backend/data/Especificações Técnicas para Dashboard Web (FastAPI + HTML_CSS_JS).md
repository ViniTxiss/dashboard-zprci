# Especificações Técnicas para Dashboard Web (FastAPI + HTML/CSS/JS)

Este documento detalha os prompts visuais e técnicos para a replicação dos gráficos presentes no PDF "MaterialCasosCríticos-RCI-2025-V2.pdf", alinhados à estrutura de dados fornecida.

## Seção 1: Evolução da Carteira (Slide 3)

| Especificação | Detalhe Técnico |
| :--- | :--- |
| **Título da Seção** | Evolução da Carteira: Entradas vs. Saídas |
| **Layout** | Full width (100% da área de conteúdo) |
| **Tipo de Gráfico** | Gráfico de Linha (Dual Series) |
| **Eixo X** | Tempo (Agrupamento Mensal: Jan/2022 a Dez/2025) |
| **Eixo Y** | Quantidade de Ações (Contagem) |
| **Série 1: Entradas** | **Cor:** Azul (Pontilhada). **Dados:** Contagem de ações agrupadas por mês de `data_entrada`. |
| **Série 2: Encerramentos** | **Cor:** Vermelho (Contínua). **Dados:** Contagem de ações agrupadas por mês de `data_encerramento`. |
| **Dados Requeridos** | `data_entrada`, `data_encerramento`, `objeto_acao` |
| **Detalhes Visuais** | Pontos de dados marcados com o valor exato. Eixo Y com escala de 0 a 20. |

## Seção 2: Distribuição Geográfica e Impacto (Slide 4)

| Especificação | Detalhe Técnico |
| :--- | :--- |
| **Título da Seção** | Distribuição Geográfica e Impacto |
| **Layout** | Grid de 2x2 (Quatro gráficos de tamanho similar) |
| **Gráfico 2.1: Mapa** | **Tipo:** Mapa de Bolhas (Geográfico). **Título:** Distribuição Nacional de Prejuízo por UF. **Dados:** `estado`, `impacto_financeiro`. **Detalhes:** Tamanho da bolha proporcional ao `impacto_financeiro`. |
| **Gráfico 2.2: Barras Horizontais (Impacto)** | **Tipo:** Gráfico de Barras Horizontais. **Título:** Objeto por Estado - Impacto Negativo. **Eixo X:** `impacto_financeiro` (Soma). **Eixo Y:** `objeto_acao` (Top N). **Dados:** `objeto_acao`, `impacto_financeiro`. **Detalhes:** Valores monetários formatados ao lado das barras. |
| **Gráfico 2.3: Barras Horizontais (Tempo)** | **Tipo:** Gráfico de Barras Horizontais. **Título:** Tempo Médio de Tramitação (Dias). **Eixo X:** `tempo_tramitacao` (Média em dias). **Eixo Y:** `estado` (Top N). **Dados:** `estado`, `tempo_tramitacao`. |
| **Gráfico 2.4: Combinado (Qtd e Média)** | **Tipo:** Gráfico Combinado (Barras + Linha). **Título:** Quantidade de casos e média de Impacto. **Eixo X:** `estado`. **Eixo Y1 (Barras):** Contagem de casos. **Eixo Y2 (Linha):** Média de `impacto_financeiro`. **Dados:** `estado`, `objeto_acao`, `impacto_financeiro`. |
| **Gráfico 2.5: Rosca (Inferior Esquerdo)** | **Tipo:** Gráfico de Rosca/Pizza. **Título:** Objeto por Estado. **Dados:** `estado` (Percentual de casos). **Detalhes:** Valor central (Total de casos) e legendas com percentuais. |

## Seção 3: SLA e Solicitações (Slide 5)

| Especificação | Detalhe Técnico |
| :--- | :--- |
| **Título da Seção** | SLA e Solicitações |
| **Layout** | Dois gráficos lado a lado (50% de largura cada) |
| **Gráfico 3.1: SLA** | **Tipo:** Gráfico de Barras Verticais. **Título:** SLA de Atendimento por Área Interna. **Eixo X:** `area_interna`. **Eixo Y:** Média de `sla_dias` (ou métrica de subsídio). **Dados:** `area_interna`, `sla_dias`. **Detalhes:** Linha de referência horizontal (tracejada vermelha) para a "Média Nacional". |
| **Gráfico 3.2: Solicitações e Prazo** | **Tipo:** Gráfico Combinado (Barras + Linha). **Título:** Solicitações e Prazo por Área Responsável. **Eixo X:** `area_interna`. **Eixo Y1 (Barras):** Total de Solicitações (Contagem de ações). **Eixo Y2 (Linha):** Percentual de Respostas > 5 dias. **Dados:** `area_interna`, `prazo_dias` (para calcular o percentual). **Detalhes:** Linha de tendência vermelha com pontos de dados marcados com o percentual. Eixo Y2 (Direito) em percentual. |

## Seção 4: Custos e Reiterações (Slide 6)

| Especificação | Detalhe Técnico |
| :--- | :--- |
| **Título da Seção** | Custos e Reiterações |
| **Layout** | Três gráficos na parte superior (aprox. 1/3 de largura cada) e um gráfico de Pareto na parte inferior (full width). |
| **Gráfico 4.1: Barras Horizontais (Subsídio)** | **Tipo:** Gráfico de Barras Horizontais. **Título:** Subsídio - Solicitações por Área Responsável. **Eixo X:** Contagem de Solicitações. **Eixo Y:** `area_interna`. **Dados:** `area_interna`, `objeto_acao`. |
| **Gráfico 4.2: Combinado (Volume e Custo)** | **Tipo:** Gráfico Combinado (Barras + Linha). **Título:** Volume (Qtd) e Custo Médio (R$) por Encerramento. **Eixo X:** Tipo de Encerramento (e.g., Acordo, Sentença). **Eixo Y1 (Barras):** Volume (Contagem). **Eixo Y2 (Linha):** Custo Médio (`custo_encerramento` / Volume). **Dados:** `custo_encerramento`, `status` (filtrado por 'Encerrado'). |
| **Gráfico 4.3: Barras Horizontais (Reiterações)** | **Tipo:** Gráfico de Barras Horizontais. **Título:** Reiterações por Objeto. **Eixo X:** Total de `reiteracoes`. **Eixo Y:** `objeto_acao` (Top N). **Dados:** `objeto_acao`, `reiteracoes`. **Detalhes:** KPI de "Total de Reiterações" (1009) no canto inferior direito. |
| **Gráfico 4.4: Pareto (Impacto Acumulado)** | **Tipo:** Gráfico de Pareto (Barras + Linha Acumulada). **Título:** Curva de Impacto Financeiro Acumulado por Tipo de Ação. **Eixo X:** `tipo_acao` (Ordenado por `impacto_financeiro` decrescente). **Eixo Y1 (Barras):** `impacto_financeiro` (Soma). **Eixo Y2 (Linha):** Percentual Acumulado. **Dados:** `tipo_acao`, `impacto_financeiro`. |

## Seção 5: Casos Críticos e Sentenças (Slide 7)

| Especificação | Detalhe Técnico |
| :--- | :--- |
| **Título da Seção** | Casos Críticos e Sentenças |
| **Layout** | Tabela à esquerda (aprox. 60% de largura) e Gráfico à direita (aprox. 40% de largura). |
| **Tabela 5.1: Casos Críticos** | **Tipo:** Tabela de Dados. **Colunas:** Nome Cliente, Tipo Ocorrência, Motivo Detalhado, Situação, Prejuízo. **Dados:** Filtrar ações onde `critico` é `True`. |
| **Gráfico 5.2: Sentença por Área** | **Tipo:** Gráfico de Barras Empilhadas (100%) e Linha. **Título:** Sentença Favorável/Desfavorável por Área Responsável (Qnt). **Eixo X:** `area_interna`. **Eixo Y1 (Barras):** Contagem de ações, empilhadas por `sentenca` ('Favorável', 'Desfavorável', 'Parcial'). **Eixo Y2 (Linha):** Impacto Financeiro (Soma de `impacto_financeiro`). **Dados:** `area_interna`, `sentenca`, `impacto_financeiro`. **Detalhes:** Barras mostram o percentual de cada sentença. A linha de impacto financeiro usa o eixo Y2 (Direito). |

## Seção 6: Tendências e Reincidência (Slide 8)

| Especificação | Detalhe Técnico |
| :--- | :--- |
| **Título da Seção** | Tendências e Reincidência |
| **Layout** | Gráfico de Linhas à esquerda (aprox. 60% de largura) e Tabela à direita (aprox. 40% de largura). |
| **Gráfico 6.1: Incidência** | **Tipo:** Gráfico de Linhas Múltiplas. **Título:** Tipos de Ações com maior incidência - 2025. **Eixo X:** Tempo (Mês/Ano). **Eixo Y:** Contagem de Ações. **Séries:** Linhas separadas para os principais `tipo_acao` (e.g., Acidente Trânsito, Cobrança Indevida, Vício Redibitório). **Dados:** `data_entrada`, `tipo_acao`. |
| **Tabela 6.2: Reincidência** | **Tipo:** Tabela de Dados. **Colunas:** Nome Cliente, Qtd de Processos, Prejuízo. **Dados:** Filtrar ações onde `reincidencia` é `True`. Agrupar por cliente e somar `impacto_financeiro`. |

## Seção 7: Erros Críticos (Slide 9)

| Especificação | Detalhe Técnico |
| :--- | :--- |
| **Título da Seção** | Erros Críticos |
| **Layout** | Gráfico de Rosca na parte superior (aprox. 60% de largura) e Barras Horizontais na parte inferior (full width). |
| **Gráfico 7.1: Prejuízo Total** | **Tipo:** Gráfico de Rosca/Pizza. **Título:** Prejuízo Total (R$) por Tipo Erro Crítico. **Fatias:** Agrupamento por `tipo_acao` (ou outra coluna que defina o erro crítico, como `erro_sistemico` + `tipo_acao`). **Valor:** Soma de `impacto_financeiro`. **Dados:** `impacto_financeiro`, `tipo_acao`, `erro_sistemico`. **Detalhes:** Percentual e valor monetário em cada fatia. |
| **Gráfico 7.2: Custo Erro Sistêmico** | **Tipo:** Gráfico de Barras Horizontais. **Título:** Custo Erro Sistêmico. **Eixo X:** Soma de `impacto_financeiro`. **Eixo Y:** Detalhe do Erro Sistêmico (e.g., Falha Baixa de Protesto). **Dados:** `impacto_financeiro`, `erro_sistemico`. **Detalhes:** Barras em cor escura (marrom/verde oliva). |

## Seção 8: Reiterações por Processo (Slide 10)

| Especificação | Detalhe Técnico |
| :--- | :--- |
| **Título da Seção** | Reiterações por Processo |
| **Layout** | Gráfico de Pizza à esquerda (aprox. 40% de largura) e Tabela à direita (aprox. 60% de largura). |
| **Gráfico 8.1: Reiterações** | **Tipo:** Gráfico de Pizza. **Título:** Quantidade de Reiterações por Processo (Maiores que 10 reiterações). **Fatias:** Agrupamento por `objeto_acao`. **Valor:** Soma de `reiteracoes`. **Dados:** `objeto_acao`, `reiteracoes`. **Detalhes:** Legendas com percentuais. |
| **Tabela 8.2: Detalhes** | **Tipo:** Tabela de Dados. **Colunas:** Autos (ID do Processo), Objeto da Ação, Qnd de Reiterações. **Dados:** Filtrar processos com `reiteracoes` > 10. |
| **KPIs (Inferior)** | **KPI 1:** Número de Tratativas (324). **KPI 2:** Quantidade de Reiterações (1008). **Detalhes:** Valores em destaque, centralizados abaixo dos gráficos. |
