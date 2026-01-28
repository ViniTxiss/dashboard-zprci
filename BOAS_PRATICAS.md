# Boas Práticas — Dashboard Executivo

> **Consultar este documento antes de alterar o código.** Ele descreve convenções, padrões e regras do projeto para manter consistência e evitar regressões.

---

## 1. Visão geral do projeto

- **Backend:** FastAPI, Python 3.x, Pandas. Servido via uvicorn na porta **8001** (ou 8002–8010 em fallback).
- **Frontend:** HTML, CSS e JavaScript vanilla. Sem framework; `api.js` centraliza chamadas à API.
- **Dados:** única fonte — `backend/data/BASEGERAL_ATUALIZADA.xlsx` (prioridade) ou `BASEGERAL_ATUALIZADA.csv` (sep=`;`, decimal=`,`). Sem fallbacks para outros Excels ou mock.

---

## 2. Estrutura de pastas

```
backend/
  app.py           # Ponto de entrada; registra rotas e CORS
  data/            # Apenas CSVs/XLSXs; não commitar dados sensíveis
  routes/          # Um arquivo por domínio (entradas, encerramentos, saldo, mapas, indicadores)
  services/        # Lógica de negócio: data_loader, aggregations, transformations

frontend/
  index.html       # Seções .slide com id único; lazy load por IntersectionObserver
  css/style.css    # Estilos globais e por seção
  js/
    api.js         # APIClient e API_BASE_URL; formatação (formatNumber, formatCurrency)
    scroll.js      # ScrollController: lazy load, tabelas Entradas/Encerrados/Saldo, espelhamento
    charts.js      # Gráficos (Chart.js)
    maps.js        # Mapas (Leaflet)
    sequence.js    # Ordem de carregamento
    animations.js  # Animações por data-animate
```

- **Regra:** Rotas apenas delegam; agregações e transformações ficam em `services/`. `data_loader` é a única fonte de DataFrame mapeado.

---

## 3. Backend (FastAPI e Python)

### 3.1 Porta e início do servidor

- **Porta padrão:** 8001 (alinhada a `API_BASE_URL` em `api.js`).
- **`python app.py`:** tenta 8001; em caso de *Errno 10048* (porta em uso), tenta 8002–8010 e imprime instrução para atualizar `api.js`.
- **CLI:** `python -m uvicorn app:app --host 127.0.0.1 --port 8001`. Se mudar a porta, alterar `API_BASE_URL` no frontend.

### 3.2 Rotas (`backend/routes/`)

- Um **APIRouter** por arquivo; prefixo `/api/<recurso>` em `app.py`.
- **Query params:** usar `Query(None, description="...")` para parâmetros opcionais (ex.: `estado`).
- **Respostas:** dicionário com chaves estáveis, ex.: `{ "dados": [...], "total": N }`. Evitar chaves numéricas como string (`"2025"`) ou float (`2025.0`); preferir `int` (ex.: `2025`).
- **Erros:** `raise HTTPException(status_code=500, detail=str(e))` após log; não expor stack trace ao cliente.
- **Filtro por estado:** aplicar em cada rota que precisar, usando `_filter_by_state(df, estado)` antes de agregar.

### 3.3 Serviços (`backend/services/`)

#### `data_loader.py`

- **Ordem de carga:** 1) `BASEGERAL_ATUALIZADA.xlsx` em `backend/data/`; 2) `BASEGERAL_ATUALIZADA.csv`. Se nenhum existir ou ocorrer erro na leitura, usa-se DataFrame vazio (colunas mínimas); o app continua e as APIs retornam listas vazias.
- **CSV:** `sep=';'`, `decimal=','`, `encoding='utf-8'`.
- **`_map_columns`:** mapear colunas do arquivo para nomes internos (`objeto_acao`, `data_entrada`, `data_encerramento`, `status`, `estado`, etc.). Manter `column_mapping` centralizado; se a planilha mudar, ajustar só aqui.
- **Status:** normalizar para `Em Tramitação` e `Encerrado`; `ENTRADA`/`EM ANDAMENTO` → `Em Tramitação`.
- **`objeto_acao`:** preencher `NaN` com `'Não Informado'`.
- **Datas:** `pd.to_datetime(..., errors='coerce')`; de `data_entrada`/`data_encerramento` extrair `.dt.year` para agregações por ano.

#### `aggregations.py`

- **Anos:** Entradas: 2022–2025; Encerrados: 2023–2025.
- **Chaves de ano em JSON:** usar `int` (ex.: `2025`), não `float` nem string, para compatibilidade com o frontend (ex.: `item[2025]`).
- Incluir **todos os objetos** da base nas tabelas; objetos sem registros devem aparecer com 0.
- Ao converter `pivot` para `dict`/lista, forçar `int` nas colunas de ano: `pivot[a] = pivot[a].astype(int)` se necessário.

#### `transformations.py`

- Funções puras quando possível: recebem DataFrame e parâmetros, retornam DataFrame ou dict. Evitar efeitos colaterais.

### 3.4 Dependências

- Manter `requirements.txt` com versões fixas. Ao adicionar libs, rodar testes e checar imports em `app`, `routes` e `services`.

---

## 4. Frontend (HTML, CSS, JavaScript)

### 4.1 HTML (`index.html`)

- **Seções:** `<section class="slide" id="...">` com `id` único e estável. O `scroll.js` e o `loadSectionData` usam esses ids (ex.: `entradas-encerrados`, `evolucao`).
- **Tabelas:** `thead` com `th`; `tbody` vazio — preenchido via JS. Para ordenação: `th` com `class="sortable"` e `data-col="objeto"|"2022"|...|"total"`.
- **Espelhamento Encerrados:** `#encerrados-espelho-info`, `#encerrados-espelho-texto`, `#btn-encerrados-ver-todos` devem existir quando a seção `entradas-encerrados` for usada.
- **data-animate:** usar `data-animate="step"` e `data-delay` para animações controladas por `animations.js`.

### 4.2 CSS (`css/style.css`)

- **Tabelas roláveis:** `.table-container-scroll` com `overflow-y: auto`; `thead th` com `position: sticky` para cabeçalho fixo.
- **Altura das tabelas:** `.tabelas-topo .table-container-scroll` com `max-height` para ~16 linhas visíveis; não fixar altura em px de forma rígida, preferir `min(720px, 68vh)` ou equivalente.
- **Responsivo:** para `< 768px`, empilhar `.tabelas-topo` em coluna e ajustar `max-height`/padding.
- **Células clicáveis:** `.celula-clicavel` nas linhas da tabela Entradas que disparam o espelhamento em Encerrados.

### 4.3 JavaScript

#### `api.js`

- **`API_BASE_URL`:** `http://localhost:8001/api`. Ao trocar a porta do backend, alterar aqui.
- **`estadoSelecionado`:** usado em `get()` para montar `?estado=XX`; `setEstadoFiltro`/`getEstadoFiltro`/`limparFiltro` centralizam o filtro.
- **Métodos do APIClient:** seguir o padrão `get('/recurso/endpoint')`; não hardcodar URLs fora do `get()`.
- **Formatação:** `formatNumber`, `formatCurrency`, `formatPercent` em pt-BR; usar em tabelas e gráficos.

#### `scroll.js` (ScrollController)

- **Lazy load:** `IntersectionObserver` em `.slide`; `loadSectionData(section)` só quando `entry.isIntersecting` e `!loadedSections.has(id)`.
- **`loadSectionData`:** usar `section.id` em `switch`/`if` para chamar `loadEntradas`, `loadEncerrados`, `loadSaldo`, etc. Manter um único ponto de entrada por seção.
- **Tabela Entradas:** `data-objeto` em cada `<tr>` para espelhamento; `renderEntradasBodyHtml` deve gerar `data-objeto` com o valor escapado.
- **Anos na resposta:** tratar `item[2025]`, `item['2025']` e `item['2025.0']` por compatibilidade; preferir `item[ano] ?? item[String(ano)] ?? 0`.
- **Espelhamento Encerrados:** ao clicar em célula de Entradas, definir `selectedObjetoEncerrados` e chamar `renderEncerradosTable(objeto)`. "Ver todos" chama `renderEncerradosTable(null)` e esconde `#encerrados-espelho-info`.
- **Saldo:** `loadSaldo` deve chamar `renderTabelaSaldo` (em `chartFunctions` ou equivalente) e, se existirem, resumo/gráfico de saldo.

#### `charts.js` e `maps.js`

- Garantir que elementos (`canvas`, divs de mapa) existam antes de inicializar. Preferir inicialização no `loadSectionData` da seção correspondente.

### 4.4 IDs e `data-*` estáveis

- Não alterar `id` de tabelas, `canvas` ou seções sem atualizar `scroll.js`, `api.js` e `charts.js`.
- `data-col` em `th.sortable` deve bater com as chaves do objeto em `dados` (ex.: `objeto`, `2022`, `total`).

---

## 5. Dados (CSV/Excel)

- **Encoding:** UTF-8 para CSV.
- **Separador CSV:** `;`.
- **Decimal:** `,` em números.
- **Colunas críticas (após mapeamento):** `objeto_acao`, `data_entrada`, `data_encerramento`, `status`, `estado`. Sem elas, agregações e filtros quebram.
- **Novas colunas na base:** adicionar em `_map_columns` e, se for o caso, em `aggregations`/`transformations`; não acessar nomes originais da planilha fora do `data_loader`.

---

## 6. Segurança e ambiente

- **CORS:** em desenvolvimento `allow_origins=["*"]` é aceitável; em produção restringir origens.
- **Secrets:** não commitar chaves, tokens ou caminhos absolutos com dados sensíveis. Preferir variáveis de ambiente para URLs e portas em produção.
- **Dados em `backend/data/`:** avaliar `.gitignore` para arquivos grandes ou com PII.

---

## 7. Performance

- **Lazy load:** não carregar dados de seções que não estão no viewport; `loadedSections` evita recarregar.
- **Tabelas grandes:** manter scroll no `tbody`/container, não na página inteira; `sticky` no `thead`.
- **Backend:** `get_loader()` (singleton) evita recarregar o CSV/Excel a cada request; o DataFrame é carregado uma vez na inicialização.

---

## 8. Testes manuais antes de commitar

1. **Backend:** `cd backend && python app.py` (ou uvicorn na 8001). Deve subir sem 10048; `/health` e `/api/entradas/por-objeto` devem responder.
2. **Frontend:** abrir `index.html` (ou servidor estático) e rolar até "Entradas, Encerrados e Saldo". Conferir se as três tabelas são preenchidas.
3. **Espelhamento:** clicar em uma célula de "Objeto da Ação" em Entradas; Encerrados deve filtrar pelo mesmo objeto; "Ver todos" deve restaurar a lista completa.
4. **Ordenação:** clicar nos `th.sortable` da tabela Entradas e verificar se a ordem e o triângulo de direção fazem sentido.
5. **Filtro por estado:** se houver seletor de estado, escolher um e recarregar as seções; os totais devem refletir o filtro.

---

## 9. Checklist rápido antes de alterações

- [ ] Li `BOAS_PRATICAS.md` e a seção relevante (backend/frontend/dados).
- [ ] Se mudei a porta do backend, atualizei `api.js` (`API_BASE_URL`).
- [ ] Se mudei colunas ou fontes de dados, atualizei `_map_columns` e as agregações que as usam.
- [ ] Se mudei `id` de seção, tabela ou `canvas`, atualizei os scripts que os referenciam.
- [ ] Se mudei o contrato da API (`dados`, anos, `total`), verifiquei `scroll.js`, `charts.js` e `api.js`.
- [ ] Rodei os testes manuais da seção 8.

---

## 10. Resumo de referência

| Item | Valor ou regra |
|------|----------------|
| Porta backend | 8001 (fallback 8002–8010) |
| `API_BASE_URL` | `http://localhost:8001/api` |
| CSV | `;` sep, `,` decimal, UTF-8 |
| Objeto da ação | `objeto_acao` (mapeado); padrão `'Não Informado'` |
| Status | `Em Tramitação` \| `Encerrado` |
| Anos Entradas | 2022–2025 |
| Anos Encerrados | 2023–2025 |
| Chaves de ano em JSON | `int` (ex.: 2025) |
| Seção 3 tabelas | `id="entradas-encerrados"` |
| Tabelas | `#table-entradas`, `#table-encerrados`, `#table-saldo` |

---

*Documento mantido junto ao código. Atualizar quando novas convenções ou módulos forem adotados.*
