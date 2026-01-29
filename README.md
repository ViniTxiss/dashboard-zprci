# Dashboard Web - Substituição Total do Power BI

Dashboard Web Corporativo desenvolvido em Python (FastAPI) + HTML/CSS/JavaScript, com animações sequenciais controladas por scroll, substituindo completamente um dashboard Power BI original.

## 🎯 Características Principais

- **Substituição Total do Power BI**: Layout idêntico, ordem dos slides, hierarquia visual
- **Animações Sequenciais**: Elementos aparecem um de cada vez conforme o scroll
- **Arquitetura Profissional**: Backend FastAPI + Frontend moderno
- **Gráficos Interativos**: Chart.js para visualizações
- **Mapas Interativos**: Leaflet.js com dados do Brasil
- **Lazy Loading**: Dados carregados apenas quando necessário
- **Design Corporativo**: Visual executivo profissional

## 📁 Estrutura do Projeto

```
dashboard/
│
├── backend/
│   ├── app.py                 # Aplicação FastAPI principal
│   ├── services/
│   │   ├── data_loader.py     # Carregamento de dados do Excel
│   │   ├── transformations.py # Transformações de dados
│   │   └── aggregations.py    # Agregações complexas
│   ├── routes/
│   │   ├── entradas.py        # Rotas de entradas
│   │   ├── encerramentos.py   # Rotas de encerramentos
│   │   ├── saldo.py           # Rotas de saldo
│   │   ├── mapas.py           # Rotas de mapas
│   │   └── indicadores.py     # Rotas de indicadores
│   └── data/
│       └── .gitkeep            # Dados: use DADOS_NOVOS_CASOS.xlsx em backend/data/
│
├── frontend/
│   ├── index.html             # Página principal
│   ├── css/
│   │   └── style.css          # Estilos corporativos
│   ├── js/
│   │   ├── api.js             # Cliente API
│   │   ├── charts.js          # Gerenciamento de gráficos
│   │   ├── maps.js            # Gerenciamento de mapas
│   │   ├── animations.js      # Sistema de animações
│   │   ├── scroll.js          # Controle de scroll e lazy loading
│   │   └── sequence.js        # Controle de sequência
│   └── assets/
│       └── logos/             # Logos institucionais
│
└── requirements.txt           # Dependências Python
```

## 🚀 Como Rodar o Backend

### 1. Instalar Dependências

```bash
pip install -r requirements.txt
```

### 2. Executar o Servidor

```bash
cd backend
python app.py
```

Ou usando uvicorn diretamente:

```bash
uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000
```

O backend estará disponível em: `http://localhost:8000`

### 3. Verificar API

Acesse `http://localhost:8000/docs` para ver a documentação interativa da API (Swagger).

## 🌐 Como Rodar o Frontend

### Opção 1: Servidor HTTP Simples (Python)

```bash
cd frontend
python -m http.server 8080
```

### Opção 2: Servidor HTTP Simples (Node.js)

```bash
cd frontend
npx http-server -p 8080
```

### Opção 3: Live Server (VS Code)

Use a extensão "Live Server" do VS Code e abra `index.html`.

O frontend estará disponível em: `http://localhost:8080`

## 📊 Como Trocar a Base de Dados

### Arquivo principal: DADOS_NOVOS_CASOS.xlsx

O sistema utiliza **`DADOS_NOVOS_CASOS.xlsx`** gerado a partir dos PDFs oficiais em `backend/data/`.  
Se o arquivo não existir, o sistema usa DataFrame vazio e as APIs retornam listas vazias.

### Método 1: Usar o arquivo Excel

1. Coloque o arquivo **`DADOS_NOVOS_CASOS.xlsx`** em `backend/data/`.
2. Formato CSV: `sep=';'`, `decimal=','`, encoding UTF-8.
3. Colunas usadas (entre outras): `Data de Entrada`, `Data do Encerramento`, `Descricao do Tipo de Ação`, `OBJETO DA AÇÃO`, `Estado`, `Status`, `Valor da Causa Atual`, `Pólo Ativo`, `Número do Processo`, `Situação`, `Quantidade de Reiterações`, `Area Responsável`, `Sentença Favorável/Desfavorável`, `Valor - Impacto Negativo`, `DATA ENTRADA`, `DATA ENCERRAMENTO`, `Motivo encerramento`.

**Colunas Obrigatórias:**
- `data_entrada` (datetime)
- `data_encerramento` (datetime, opcional)
- `objeto_acao` (string)
- `estado` (string - sigla UF)
- `area_interna` (string)
- `status` (string: 'Em Tramitação', 'Encerrado', 'Pendente')
- `impacto_financeiro` (float)
- `tempo_tramitacao` (int - dias)
- `reiteracoes` (int)
- `sla_dias` (int)
- `prazo_dias` (int)
- `custo_encerramento` (float)
- `sentenca` (string: 'Favorável', 'Desfavorável', 'Parcial')
- `reincidencia` (boolean)
- `tipo_acao` (string)
- `erro_sistemico` (boolean)
- `critico` (boolean)

### Método 2: Modificar Data Loader

Edite `backend/services/data_loader.py` para carregar dados de outra fonte (banco de dados, API, etc.).

**Exemplo com banco de dados:**

```python
import pandas as pd
import sqlalchemy

def _load_data(self):
    engine = sqlalchemy.create_engine('postgresql://user:pass@host/db')
    self._df = pd.read_sql('SELECT * FROM casos', engine)
```

## ➕ Como Adicionar Novos Slides

### 1. Adicionar Seção no HTML

Em `frontend/index.html`, adicione uma nova `<section>`:

```html
<section class="slide" id="meu-novo-slide">
    <div class="slide-content">
        <h2 class="slide-title" data-animate="step" data-delay="0">Título do Slide</h2>
        <div class="chart-container" data-animate="step" data-delay="150">
            <canvas id="chart-meu-grafico"></canvas>
        </div>
    </div>
</section>
```

### 2. Criar Rota no Backend

Em `backend/routes/indicadores.py` (ou criar novo arquivo):

```python
@router.get("/meu-indicador")
async def meu_indicador():
    loader = get_loader()
    df = loader.get_dataframe()
    # Processar dados
    result = processar_dados(df)
    return result
```

### 3. Criar Função de Agregação

Em `backend/services/aggregations.py`:

```python
def get_meu_indicador(df: pd.DataFrame) -> Dict[str, Any]:
    # Lógica de agregação
    return {'dados': [...]}
```

### 4. Adicionar Função de Gráfico

Em `frontend/js/charts.js`:

```javascript
async function renderMeuGrafico() {
    const data = await api.get('/indicadores/meu-indicador');
    createChart('chart-meu-grafico', {
        type: 'bar',
        data: {
            labels: data.dados.map(d => d.label),
            datasets: [{
                data: data.dados.map(d => d.value),
                // ...
            }]
        },
        options: defaultOptions
    });
}
```

### 5. Adicionar ao Scroll Controller

Em `frontend/js/scroll.js`, adicione no método `loadSectionData`:

```javascript
case 'meu-novo-slide':
    await this.loadMeuSlide();
    break;
```

E crie o método:

```javascript
async loadMeuSlide() {
    if (window.chartFunctions) {
        await window.chartFunctions.renderMeuGrafico();
    }
}
```

## 🎬 Como Controlar a Ordem das Animações

### Atributos de Animação

Cada elemento animável deve ter:

```html
<div data-animate="step" data-delay="150">
    Conteúdo
</div>
```

- `data-animate="step"`: Identifica o elemento como animável
- `data-delay`: Delay em milissegundos antes da animação iniciar

### Ordem de Animação Padrão

1. **Logo** (delay: 0ms)
2. **Título** (delay: 150ms)
3. **Subtítulo** (delay: 300ms)
4. **Gráfico/Tabela** (delay: 450ms)
5. **KPIs/Totais** (delay: 600ms)

### Modificar Delays

Edite os atributos `data-delay` no HTML:

```html
<h2 class="slide-title" data-animate="step" data-delay="0">Título</h2>
<p class="slide-subtitle" data-animate="step" data-delay="200">Subtítulo</p>
<div class="chart-container" data-animate="step" data-delay="400">
    <!-- Gráfico -->
</div>
```

### Personalizar Animação CSS

Em `frontend/css/style.css`, modifique:

```css
[data-animate="step"] {
    opacity: 0;
    transform: translateY(30px);
    transition: opacity 0.6s ease, transform 0.6s ease;
}

[data-animate="step"].animate-in {
    opacity: 1;
    transform: translateY(0);
}
```

## 🎨 Personalização Visual

### Cores

Edite as variáveis CSS em `frontend/css/style.css`:

```css
:root {
    --primary-blue: #1e3a5f;
    --secondary-blue: #2c5282;
    --accent-blue: #3182ce;
    /* ... */
}
```

### Fontes

Altere a fonte no CSS:

```css
body {
    font-family: 'Sua Fonte', sans-serif;
}
```

### Logos

Coloque seus logos em `frontend/assets/logos/` e atualize o HTML:

```html
<div class="logo-container">
    <img src="assets/logos/logo.png" alt="Logo">
</div>
```

## 📈 Slides Disponíveis

1. **Capa Institucional** - Logos + título + KPIs
2. **Entradas por Objeto da Ação** - Tabela
3. **Encerrados por Objeto da Ação** - Tabela
4. **Saldo** - Entradas x Encerramentos
5. **Evolução da Carteira** - Gráfico de linha
6. **Distribuição Nacional** - Mapa interativo
7. **Objeto por Estado** - Gráfico
8. **Tempo Médio de Tramitação** - Gráfico + KPI
9. **Quantidade de Casos x Impacto Médio** - Scatter plot
10. **SLA por Área Interna** - Gráfico de barras
11. **Solicitações x Prazo (> 5 dias)** - Gráfico de pizza
12. **Volume e Custo por Encerramento** - Gráfico combinado
13. **Reiterações por Objeto** - Gráfico de barras
14. **Curva de Impacto Financeiro (Pareto)** - Gráfico Pareto
15. **Casos Críticos** - Tabela detalhada
16. **Sentença Favorável x Desfavorável** - Gráfico de pizza
17. **Reincidência** - Gráfico + KPI
18. **Tipos de Ações – 2025** - Gráfico de barras
19. **Erro Sistêmico (TI)** - Gráfico + KPI
20. **Autos com Maior Reiteração** - Tabela
21. **KPIs Finais** - KPIs consolidados

## 🔧 Tecnologias Utilizadas

- **Backend**: FastAPI, Pandas, NumPy
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Gráficos**: Chart.js 4.4.0
- **Mapas**: Leaflet.js 1.9.4
- **Animações**: IntersectionObserver API

## 📝 Notas Importantes

1. **Dados**: O sistema utiliza `DADOS_NOVOS_CASOS.xlsx` gerado a partir dos PDFs oficiais. Se o arquivo não existir, o sistema usa DataFrame vazio e as APIs retornam listas vazias
2. **CORS**: O backend está configurado para aceitar requisições de qualquer origem (desenvolvimento)
3. **Performance**: Gráficos são renderizados apenas quando a seção entra em viewport (lazy loading)
4. **Responsividade**: O dashboard é responsivo e funciona em diferentes tamanhos de tela

## 🐛 Troubleshooting

### Backend não inicia
- Verifique se a porta 8000 está livre
- Instale todas as dependências: `pip install -r requirements.txt`

### Frontend não carrega dados
- Verifique se o backend está rodando em `http://localhost:8000`
- Abra o console do navegador (F12) para ver erros
- Verifique a URL da API em `frontend/js/api.js`

### Gráficos não aparecem
- Verifique se Chart.js está carregado (console do navegador)
- Certifique-se de que os dados estão no formato correto
- Verifique se o canvas tem o ID correto

### Animações não funcionam
- Verifique se o IntersectionObserver é suportado pelo navegador
- Certifique-se de que os elementos têm `data-animate="step"`
- Verifique os delays configurados

## 🚀 Deploy em Produção

Para instruções detalhadas de deploy, consulte o arquivo [DEPLOY.md](DEPLOY.md).

### Resumo Rápido

1. **Backend**: Execute `start_production.sh` (Linux/Mac) ou `start_production.bat` (Windows)
2. **Frontend**: Configure Nginx/Apache para servir os arquivos em `frontend/`
3. **Dados**: Coloque `BASE_TRATADA_FINAL.xlsx` em `backend/data/`

## 📄 Licença

Este projeto foi desenvolvido como substituição de dashboard Power BI para uso corporativo interno.

## 👨‍💻 Desenvolvido Por

Arquiteto de Software Sênior - Dashboard Web Corporativo

---

**Versão**: 1.0.0  
**Última Atualização**: 2025
