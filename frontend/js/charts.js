/**
 * Gerenciamento de Gráficos Chart.js
 */

const chartInstances = {};
const resizeObservers = {};
const chartCreationLocks = {}; // Evitar criação simultânea do mesmo gráfico
const DEBUG_MODE = false; // Desabilitar logs em produção

/**
 * Sistema Global de Cores - Color Registry
 * Garante consistência visual entre todos os gráficos e mapas
 */
const CONST_COLORS = {
    // Cores por UF (27 estados + DF) - Paleta azul harmoniosa
    uf: {
        'AC': '#2563eb', 'AL': '#3b82f6', 'AP': '#60a5fa',
        'AM': '#93c5fd', 'BA': '#1e40af', 'CE': '#1e3a8a',
        'DF': '#1d4ed8', 'ES': '#2563eb', 'GO': '#3b82f6',
        'MA': '#60a5fa', 'MT': '#93c5fd', 'MS': '#1e40af',
        'MG': '#1e3a8a', 'PA': '#1d4ed8', 'PB': '#2563eb',
        'PR': '#3b82f6', 'PE': '#60a5fa', 'PI': '#93c5fd',
        'RJ': '#1e40af', 'RN': '#1e3a8a', 'RS': '#1d4ed8',
        'RO': '#2563eb', 'RR': '#3b82f6', 'SC': '#60a5fa',
        'SP': '#1e40af', 'SE': '#1e3a8a', 'TO': '#1d4ed8'
    },
    // Cores por Área
    area: {
        'Operações': '#3182ce',
        'Cobranças': '#667eea',
        'Jurídico Interno': '#8b5cf6',
        'Não Informado': '#9ca3af'
    },
    // Cores semânticas
    semantic: {
        positivo: '#48bb78',    // Verde
        negativo: '#f56565',    // Vermelho
        neutro: '#4299e1',      // Azul
        atencao: '#ed8936',     // Laranja
        acima_meta: '#dc2626',  // Vermelho escuro
        abaixo_meta: '#22c55e'  // Verde escuro
    }
};

/**
 * Converte cor hexadecimal para rgba
 * @param {string} hex - Cor em formato hexadecimal (#RRGGBB)
 * @param {number} opacity - Opacidade (0-1), padrão 1
 * @returns {string} Cor em formato rgba(r, g, b, opacity)
 */
function hexToRgba(hex, opacity = 1) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Retorna cor consistente para um label (UF ou Área)
 * Garante que a mesma UF/Área sempre use a mesma cor em todos os gráficos
 * @param {string} label - UF (ex: 'SP') ou Área (ex: 'Operações')
 * @param {string} type - 'uf' ou 'area', padrão 'uf'
 * @param {number} opacity - Opacidade (0-1), padrão 0.8
 * @returns {string} Cor em formato rgba
 */
function getColor(label, type = 'uf', opacity = 0.8) {
    if (!label) {
        // Fallback para label vazio
        return hexToRgba(CONST_COLORS.uf['SP'], opacity);
    }
    
    const colorMap = CONST_COLORS[type] || CONST_COLORS.uf;
    const hex = colorMap[label] || colorMap[label.toUpperCase()] || colorMap['SP']; // Fallback para SP
    return hexToRgba(hex, opacity);
}

/**
 * Retorna cor de borda (opacidade 1.0) para um label
 * @param {string} label - UF ou Área
 * @param {string} type - 'uf' ou 'area'
 * @returns {string} Cor em formato rgba com opacidade 1.0
 */
function getBorderColor(label, type = 'uf') {
    return getColor(label, type, 1.0);
}

/**
 * Valida dados numéricos para gráficos
 */
function validateChartData(data, minLength = 1) {
    if (!data || !Array.isArray(data) || data.length < minLength) {
        return { valid: false, error: 'Dados vazios ou inválidos' };
    }
    
    // Verificar se há valores NaN ou Infinity
    const hasInvalidValues = data.some(v => {
        const num = Number(v);
        return isNaN(num) || !isFinite(num);
    });
    
    if (hasInvalidValues) {
        return { valid: false, error: 'Dados contêm valores inválidos (NaN ou Infinity)' };
    }
    
    return { valid: true };
}

/**
 * Sanitiza valores numéricos para gráficos
 */
function sanitizeNumber(value, defaultValue = 0) {
    const num = Number(value);
    if (isNaN(num) || !isFinite(num)) {
        return defaultValue;
    }
    return num;
}

/**
 * Verifica se um elemento está visível na viewport
 */
function isElementVisible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && 
           rect.top < window.innerHeight && 
           rect.bottom > 0 &&
           rect.left < window.innerWidth &&
           rect.right > 0;
}

/**
 * Mostra mensagem de erro amigável no canvas quando um gráfico falha
 * @param {string} canvasId - ID do elemento canvas
 * @param {string} message - Mensagem de erro a exibir
 */
function showChartError(canvasId, message = 'Sem dados para esta seleção') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.warn(`showChartError: Canvas ${canvasId} não encontrado`);
        return;
    }
    
    try {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Limpar canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Configurar estilo
        ctx.fillStyle = '#666';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Desenhar mensagem centralizada
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        ctx.fillText(message, centerX, centerY);
        
        // Adicionar ícone ou símbolo visual (opcional)
        ctx.font = '48px Arial';
        ctx.fillText('📊', centerX, centerY - 40);
    } catch (error) {
        console.error(`showChartError: Erro ao exibir mensagem no canvas ${canvasId}:`, error);
    }
}

/**
 * Aguarda até que um elemento esteja visível
 */
function waitForElementVisible(element, maxWait = 5000) {
    return new Promise((resolve, reject) => {
        if (isElementVisible(element)) {
            resolve(element);
            return;
        }

        const startTime = Date.now();
        const checkVisibility = () => {
            if (isElementVisible(element)) {
                resolve(element);
            } else if (Date.now() - startTime > maxWait) {
                reject(new Error(`Elemento não ficou visível em ${maxWait}ms`));
            } else {
                requestAnimationFrame(checkVisibility);
            }
        };
        requestAnimationFrame(checkVisibility);
    });
}

function createChart(canvasId, config) {
    // Verificar se já está sendo criado (evitar criação simultânea)
    const lockInfo = chartCreationLocks[canvasId];
    if (lockInfo) {
        // Verificar se é um objeto com timestamp ou apenas boolean
        const isLocked = typeof lockInfo === 'object' ? lockInfo.locked : lockInfo;
        if (isLocked) {
            // Verificar se o lock está travado há muito tempo (mais de 10 segundos)
            if (typeof lockInfo === 'object' && lockInfo.timestamp) {
                const lockAge = Date.now() - lockInfo.timestamp;
                if (lockAge > 10000) {
                    if (DEBUG_MODE) console.warn(`createChart: Lock travado há ${lockAge}ms, liberando...`);
                    delete chartCreationLocks[canvasId];
                } else {
                    if (DEBUG_MODE) console.warn(`createChart: Gráfico ${canvasId} já está sendo criado, ignorando...`);
                    return chartInstances[canvasId] || null;
                }
            } else {
                if (DEBUG_MODE) console.warn(`createChart: Gráfico ${canvasId} já está sendo criado, ignorando...`);
                return chartInstances[canvasId] || null;
            }
        }
    }

    // Verificar se Chart.js está disponível
    if (typeof Chart === 'undefined') {
        console.error(`createChart: Chart.js não está carregado para ${canvasId}`);
        return null;
    }

    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.warn(`createChart: Canvas ${canvasId} não encontrado no DOM`);
        return null;
    }

    // Marcar como em criação
    chartCreationLocks[canvasId] = true;

    // Destruir gráfico existente se houver
    if (chartInstances[canvasId]) {
        try {
        chartInstances[canvasId].destroy();
        } catch (e) {
            if (DEBUG_MODE) console.warn(`createChart: Erro ao destruir gráfico existente ${canvasId}:`, e);
        }
        delete chartInstances[canvasId];
    }

    // Remover ResizeObserver existente se houver
    if (resizeObservers[canvasId]) {
        resizeObservers[canvasId].disconnect();
        delete resizeObservers[canvasId];
    }

    // Verificar se o elemento está visível
    const container = canvas.parentElement;
    let containerWidth = 0;
    let containerHeight = 0;

    if (container) {
        containerWidth = container.clientWidth;
        containerHeight = container.clientHeight || 400;
    }
        
    // Se o container não tem dimensões válidas, tentar usar dimensões do canvas ou padrão
    if (containerWidth === 0 || containerHeight === 0) {
        const rect = canvas.getBoundingClientRect();
        containerWidth = rect.width || 800;
        containerHeight = rect.height || 400;
        }

    // Não definir width/height diretamente no canvas - deixar Chart.js gerenciar via CSS
    // Isso evita problemas quando o elemento está oculto

    // Garantir que as opções tenham responsive e maintainAspectRatio
    if (!config.options) {
        config.options = {};
    }
    if (config.options.responsive === undefined) {
        config.options.responsive = true;
    }
    if (config.options.maintainAspectRatio === undefined) {
        config.options.maintainAspectRatio = true;
    }

    try {
        // Verificar novamente se Chart está disponível (pode ter sido carregado depois)
        if (typeof Chart === 'undefined') {
            console.error(`createChart: Chart.js não está disponível ao criar gráfico ${canvasId}`);
            return null;
        }
        
    const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error(`createChart: Não foi possível obter contexto 2D para ${canvasId}`);
            return null;
        }

    const chart = new Chart(ctx, config);
    chartInstances[canvasId] = chart;
        chartCreationLocks[canvasId] = false; // Marcar como concluído
        delete chartCreationLocks[canvasId]; // Remover completamente
    
        // Adicionar ResizeObserver com debounce para evitar travamentos
        if (container && ResizeObserver) {
            let resizeTimeout;
            const resizeObserver = new ResizeObserver((entries) => {
                // Debounce: aguardar 150ms antes de redimensionar
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    for (const entry of entries) {
                        if (chartInstances[canvasId] && !chartInstances[canvasId].destroyed) {
                            try {
                                chartInstances[canvasId].resize();
                            } catch (e) {
                                if (DEBUG_MODE) console.warn(`createChart: Erro ao redimensionar gráfico ${canvasId}:`, e);
                            }
                        }
                    }
                }, 150);
            });
            resizeObserver.observe(container);
            resizeObservers[canvasId] = resizeObserver;
        }
        
    console.log(`createChart: Gráfico ${canvasId} criado com sucesso`, {
                canvasWidth: canvas.width || containerWidth,
                canvasHeight: canvas.height || containerHeight,
                containerWidth: containerWidth,
                containerHeight: containerHeight,
                isVisible: isElementVisible(canvas)
    });
    
    return chart;
    } catch (error) {
        chartCreationLocks[canvasId] = false; // Liberar lock em caso de erro
        delete chartCreationLocks[canvasId]; // Remover completamente
        console.error(`createChart: Erro ao criar gráfico ${canvasId}:`, error);
        return null;
    }
}

/**
 * Cria gráfico com retry - aguarda elemento estar visível antes de criar
 */
async function createChartWithRetry(canvasId, config, maxRetries = 3, retryDelay = 100) {
    // Evitar múltiplas tentativas simultâneas
    const lockInfo = chartCreationLocks[canvasId];
    if (lockInfo && lockInfo.locked) {
        // Verificar se o lock está travado há muito tempo (mais de 10 segundos)
        const lockAge = Date.now() - (lockInfo.timestamp || 0);
        if (lockAge > 10000) {
            if (DEBUG_MODE) console.warn(`createChartWithRetry: Lock travado há ${lockAge}ms, liberando...`);
            delete chartCreationLocks[canvasId];
        } else {
            if (DEBUG_MODE) console.warn(`createChartWithRetry: Gráfico ${canvasId} já está sendo criado`);
            // Aguardar conclusão
            let waitCount = 0;
            while (chartCreationLocks[canvasId] && waitCount < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                waitCount++;
            }
            return chartInstances[canvasId] || null;
        }
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                continue;
            }
            if (DEBUG_MODE) console.warn(`createChartWithRetry: Canvas ${canvasId} não encontrado após ${maxRetries} tentativas`);
            return null;
        }

        // Aguardar elemento estar visível
        try {
            await waitForElementVisible(canvas, 2000);
        } catch (e) {
            if (attempt < maxRetries) {
                if (DEBUG_MODE) console.log(`createChartWithRetry: Tentativa ${attempt}/${maxRetries} - elemento ainda não visível, aguardando...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
                continue;
            }
            if (DEBUG_MODE) console.warn(`createChartWithRetry: Elemento ${canvasId} não ficou visível após ${maxRetries} tentativas`);
        }

        // Tentar criar o gráfico
        const chart = createChart(canvasId, config);
        if (chart) {
            return chart;
        }

        // Se falhou e ainda há tentativas, aguardar antes de tentar novamente
        if (attempt < maxRetries) {
            if (DEBUG_MODE) console.log(`createChartWithRetry: Tentativa ${attempt}/${maxRetries} falhou, tentando novamente...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
    }
    if (DEBUG_MODE) console.error(`createChartWithRetry: Falha ao criar gráfico ${canvasId} após ${maxRetries} tentativas`);
    return null;
}

/**
 * Limpa todos os gráficos existentes
 */
function clearAllCharts() {
    Object.keys(chartInstances).forEach(canvasId => {
        if (chartInstances[canvasId]) {
            try {
            chartInstances[canvasId].destroy();
            } catch (e) {
                console.warn(`clearAllCharts: Erro ao destruir gráfico ${canvasId}:`, e);
            }
            delete chartInstances[canvasId];
        }
    });

    // Limpar ResizeObservers
    Object.keys(resizeObservers).forEach(canvasId => {
        if (resizeObservers[canvasId]) {
            resizeObservers[canvasId].disconnect();
            delete resizeObservers[canvasId];
        }
    });
}

// Configuração padrão
const defaultOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
        legend: {
            position: 'top',
        },
        tooltip: {
            mode: 'index',
            intersect: false,
        }
    },
    scales: {
        y: {
            beginAtZero: true
        }
    }
};

// Gráfico de Saldo
async function renderSaldoChart() {
    try {
    const data = await api.getSaldo();
        
        if (!data) {
            showChartError('chart-saldo', 'Sem dados para esta seleção');
            return;
        }
    
    createChart('chart-saldo', {
        type: 'bar',
        data: {
            labels: ['Entradas', 'Encerrados', 'Saldo'],
            datasets: [{
                label: 'Quantidade',
                    data: [data.entradas || 0, data.encerrados || 0, data.saldo || 0],
                backgroundColor: [
                    'rgba(49, 130, 206, 0.8)',
                    'rgba(72, 187, 120, 0.8)',
                    'rgba(237, 137, 54, 0.8)'
                ],
                borderColor: [
                    'rgb(49, 130, 206)',
                    'rgb(72, 187, 120)',
                    'rgb(237, 137, 54)'
                ],
                borderWidth: 2
            }]
        },
        options: defaultOptions
    });
    } catch (error) {
        console.error('renderSaldoChart: Erro ao renderizar:', error);
        showChartError('chart-saldo', 'Erro ao carregar gráfico');
    }
}

// Gráfico de Evolução: Entradas vs. Encerramentos por Mês
async function renderEvolucaoChart() {
    console.log('renderEvolucaoChart: Iniciando renderização');
    
    // Verificar Chart.js
    if (typeof Chart === 'undefined') {
        console.error('renderEvolucaoChart: Chart.js não está disponível');
        showChartError('chart-evolucao', 'Biblioteca de gráficos não carregada');
        return;
    }
    
    // Verificar canvas
    const canvas = document.getElementById('chart-evolucao');
    if (!canvas) {
        console.error('renderEvolucaoChart: Canvas chart-evolucao não encontrado');
        return;
    }
    
    try {
    const data = await api.getEvolucao();
    
    if (!data || !data.dados || data.dados.length === 0) {
        console.warn('renderEvolucaoChart: dados vazios ou inválidos');
        return;
    }
    
    // Ordenar por período (mês/ano) para manter ordem cronológica
    const sortedData = [...data.dados].sort((a, b) => {
        const periodoA = a.periodo || '';
        const periodoB = b.periodo || '';
        return periodoA.localeCompare(periodoB);
    });
    
    // Debug: verificar dados de encerramentos
    const encerramentosData = sortedData.map(d => d.encerramentos || 0);
    const totalEncerramentos = encerramentosData.reduce((sum, val) => sum + val, 0);
    console.log('renderEvolucaoChart - Total de encerramentos:', totalEncerramentos);
    console.log('renderEvolucaoChart - Primeiros 5 valores de encerramentos:', encerramentosData.slice(0, 5));
    
    createChart('chart-evolucao', {
        type: 'line',
        data: {
            labels: sortedData.map(d => d.periodo || 'N/A'),
            datasets: [{
                label: 'Entradas',
                data: sortedData.map(d => d.entradas || 0),
                borderColor: 'rgb(49, 130, 206)', // Azul
                backgroundColor: 'rgba(49, 130, 206, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: 'rgb(49, 130, 206)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                borderWidth: 2
            }, {
                label: 'Encerramentos',
                data: encerramentosData,
                borderColor: 'rgb(237, 137, 54)', // Laranja
                backgroundColor: 'rgba(237, 137, 54, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: 'rgb(237, 137, 54)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                borderWidth: 2,
                spanGaps: false // Garantir que a linha seja contínua mesmo com zeros
            }]
        },
        options: {
            ...defaultOptions,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Quantidade'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Período (Mês/Ano)'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += formatNumber(context.parsed.y);
                            return label;
                        }
                    }
                }
            }
        }
    });
    } catch (error) {
        console.error('renderEvolucaoChart: Erro ao renderizar:', error);
        showChartError('chart-evolucao', 'Erro ao carregar gráfico');
    }
}

// Gráfico de Tempo Médio
async function renderTempoMedioChart() {
    const data = await api.getTempoMedio();
    
    createChart('chart-tempo-medio', {
        type: 'bar',
        data: {
            labels: data.por_objeto.map(d => d.objeto),
            datasets: [{
                label: 'Tempo Médio (dias)',
                data: data.por_objeto.map(d => d.tempo_medio),
                backgroundColor: 'rgba(49, 130, 206, 0.8)',
                borderColor: 'rgb(49, 130, 206)',
                borderWidth: 2
            }]
        },
        options: defaultOptions
    });
}

// Gráfico Casos x Impacto
async function renderCasosImpactoChart() {
    const data = await api.getCasosPorImpacto();
    
    createChart('chart-casos-impacto', {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Casos x Impacto',
                data: data.dados.map(d => ({
                    x: d.quantidade,
                    y: d.impacto_medio
                })),
                backgroundColor: 'rgba(49, 130, 206, 0.6)',
                borderColor: 'rgb(49, 130, 206)',
                borderWidth: 1
            }]
        },
        options: {
            ...defaultOptions,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Quantidade de Casos'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Impacto Médio (R$)'
                    }
                }
            }
        }
    });
}

// Gráfico SLA por Área
async function renderSLAAreaChart() {
    if (DEBUG_MODE) console.log('renderSLAAreaChart: ===== INICIANDO RENDERIZAÇÃO =====');
    
    try {
        // Verificar se Chart.js está disponível
        if (typeof Chart === 'undefined') {
            console.error('renderSLAAreaChart: Chart.js não está carregado!');
            return;
        }
        
        // Buscar dados da API
        console.log('renderSLAAreaChart: Buscando dados de SLA por área...');
        let slaData;
        try {
            slaData = await api.getSLAPorArea();
            console.log('renderSLAAreaChart: Dados recebidos:', slaData);
        } catch (error) {
            console.error('renderSLAAreaChart: Erro ao buscar dados:', error);
            return;
        }
        
        // Verificar elementos DOM
        const canvasEl = document.getElementById('chart-sla-area');
        if (!canvasEl) {
            console.error('renderSLAAreaChart: Canvas chart-sla-area não encontrado no DOM!');
            return;
        }
        
        console.log('renderSLAAreaChart: Renderizando gráfico de SLA...');
        if (slaData && slaData.dados && slaData.dados.length > 0) {
            const areas = slaData.dados.map(d => d.area);
            const diasTramitacao = slaData.dados.map(d => d.media_dias || 0);
            const benchmarkDias = slaData.benchmark_nacional || 23; // Usar benchmark da API ou 23 como fallback
            
            console.log('renderSLAAreaChart: Dados do gráfico:', {
                areasCount: areas.length,
                areas: areas,
                diasCount: diasTramitacao.length,
                dias: diasTramitacao,
                benchmarkDias: benchmarkDias
            });
            
            // Validar que arrays têm o mesmo tamanho
            if (areas.length !== diasTramitacao.length) {
                console.error('renderSLAAreaChart: Arrays têm tamanhos diferentes!', {
                    areas: areas.length,
                    dias: diasTramitacao.length
                });
                return;
            }
            
            // Cores dinâmicas: vermelho/laranja para acima da meta, verde/azul para abaixo/igual
            // IMPORTANTE: Se media_dias <= 5, sempre verde (dentro do SLA, sem atraso)
            // Usar acima_da_meta do backend se disponível, senão comparar com benchmarkDias
            const cores = slaData.dados.map((item, index) => {
                const dias = diasTramitacao[index];
                // Se dias <= 5, sempre verde (dentro do SLA, sem atraso)
                if (dias <= 5) {
                    return 'rgba(34, 197, 94, 0.8)'; // Verde - dentro do SLA
                }
                const acimaDaMeta = item.acima_da_meta !== undefined ? item.acima_da_meta : (dias > benchmarkDias);
                return acimaDaMeta 
                    ? 'rgba(220, 38, 38, 0.8)' // Vermelho para acima do benchmark
                    : 'rgba(34, 197, 94, 0.8)';  // Verde para abaixo/igual ao benchmark
            });
            const coresBorda = slaData.dados.map((item, index) => {
                const dias = diasTramitacao[index];
                // Se dias <= 5, sempre verde (dentro do SLA, sem atraso)
                if (dias <= 5) {
                    return 'rgb(34, 197, 94)'; // Verde - dentro do SLA
                }
                const acimaDaMeta = item.acima_da_meta !== undefined ? item.acima_da_meta : (dias > benchmarkDias);
                return acimaDaMeta 
                    ? 'rgb(220, 38, 38)' 
                    : 'rgb(34, 197, 94)';
            });
            
            // Plugin para rótulos nas barras
            const slaBarLabelsPlugin = {
                id: 'slaBarLabels',
                afterDraw: function(chart) {
                    const ctx = chart.ctx;
                    const meta = chart.getDatasetMeta(0); // Dataset das barras
                    
                    ctx.save();
                    ctx.font = 'bold 12px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillStyle = '#333';
                    
                    meta.data.forEach((bar, index) => {
                        const value = diasTramitacao[index];
                        const x = bar.x;
                        const y = bar.y;
                        
                        // Posicionar rótulo no topo da barra
                        ctx.fillText(
                            value.toFixed(1) + ' dias',
                            x,
                            y - 5
                        );
                    });
                    
                    ctx.restore();
                }
            };
            
            // Registrar plugin antes de criar o gráfico
            Chart.register(slaBarLabelsPlugin);
            
            const chartBase = createChart('chart-sla-area', {
        type: 'bar',
        data: {
                    labels: areas,
                    datasets: [
                        {
                            label: 'Tempo Médio de Tramitação',
                            data: diasTramitacao,
                            backgroundColor: cores,
                            borderColor: coresBorda,
                borderWidth: 2
                        },
                        {
                            label: 'Média Nacional (23 dias)',
                            type: 'line',
                            data: Array(areas.length).fill(benchmarkDias),
                            borderColor: 'rgb(220, 38, 38)',
                            borderDash: [5, 5],
                            borderWidth: 2,
                            pointRadius: 0,
                            fill: false,
                            order: 0 // Linha na frente
                        }
                    ]
                },
                options: {
                    ...defaultOptions,
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'SLA de Atendimento por Área Interna',
                            font: {
                                size: 16,
                                weight: 'bold'
                            },
                            padding: {
                                top: 10,
                                bottom: 20
                            }
                        },
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                padding: 15
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const index = context.dataIndex;
                                    const item = slaData.dados[index];
                                    if (context.datasetIndex === 0) {
                                        // Barra de tempo médio
                                        return [
                                            `Tempo médio: ${diasTramitacao[index].toFixed(1)} dias`,
                                            `Quantidade: ${item.quantidade || 0} casos`,
                                            `Acima da meta: ${item.acima_da_meta ? 'Sim' : 'Não'}`
                                        ];
                                    } else {
                                        // Linha de benchmark
                                        return `Média Nacional: ${benchmarkDias} dias`;
                                    }
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Tempo Médio de Tramitação (dias)',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            ticks: {
                                callback: function(value) {
                                    return value + ' dias';
                                }
                            },
                            grid: {
                                display: true,
                                drawBorder: false,
                                color: 'rgba(0, 0, 0, 0.1)'
                            },
                            border: {
                                display: false
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Área Responsável',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            grid: {
                                display: false
                            },
                            border: {
                                display: false
                            },
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45
                            }
                        }
                    }
                }
            });
            
            if (chartBase) {
                console.log('renderSLAAreaChart: Gráfico criado com sucesso');
                // Forçar update após um pequeno delay
                setTimeout(() => {
                    try {
                        chartBase.update('none');
                        console.log('renderSLAAreaChart: Gráfico atualizado');
                    } catch (e) {
                        console.error('renderSLAAreaChart: Erro ao atualizar gráfico:', e);
                    }
                }, 100);
            } else {
                console.error('renderSLAAreaChart: Falha ao criar gráfico');
            }
        } else {
            console.warn('renderSLAAreaChart: Nenhum dado de SLA disponível');
            if (canvasEl) {
                try {
                    const ctx = canvasEl.getContext('2d');
                    const width = canvasEl.width || canvasEl.clientWidth || 300;
                    const height = canvasEl.height || canvasEl.clientHeight || 300;
                    ctx.clearRect(0, 0, width, height);
                    ctx.fillStyle = '#ed8936';
                    ctx.font = 'bold 16px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('Nenhum dado de SLA disponível', width / 2, height / 2 - 10);
                    ctx.fillStyle = '#fff';
                    ctx.font = '12px Arial';
                    ctx.fillText('Verifique se o backend está retornando dados', width / 2, height / 2 + 10);
                } catch (e) {
                    console.error('renderSLAAreaChart: Erro ao desenhar mensagem:', e);
                }
            }
        }
        
        if (DEBUG_MODE) console.log('renderSLAAreaChart: ===== RENDERIZAÇÃO CONCLUÍDA =====');
    } catch (error) {
        console.error('renderSLAAreaChart: ===== ERRO AO RENDERIZAR =====');
        console.error('renderSLAAreaChart: Erro completo:', error);
        console.error('renderSLAAreaChart: Stack:', error.stack);
        
        // Mostrar erro visual
        const canvasEl = document.getElementById('chart-sla-area');
        if (canvasEl) {
            try {
                const ctx = canvasEl.getContext('2d');
                ctx.fillStyle = '#f56565';
                ctx.font = 'bold 16px Arial';
                ctx.fillText('Erro ao renderizar gráfico', 10, 50);
                ctx.fillStyle = '#fff';
                ctx.font = '12px Arial';
                ctx.fillText(error.message || 'Erro desconhecido', 10, 70);
            } catch (e) {
                console.error('renderSLAAreaChart: Erro ao mostrar mensagem de erro:', e);
            }
        }
    }
}

// Gráfico Solicitações x Prazo
async function renderSolicitacoesPrazoChart() {
    const data = await api.getSolicitacoesPrazo();
    
    createChart('chart-solicitacoes-prazo', {
        type: 'doughnut',
        data: {
            labels: ['≤ 5 dias', '> 5 dias'],
            datasets: [{
                data: [
                    data.dados.find(d => !d.prazo_maior_5)?.data_entrada || 0,
                    data.dados.find(d => d.prazo_maior_5)?.data_entrada || 0
                ],
                backgroundColor: [
                    'rgba(72, 187, 120, 0.8)',
                    'rgba(245, 101, 101, 0.8)'
                ],
                borderColor: [
                    'rgb(72, 187, 120)',
                    'rgb(245, 101, 101)'
                ],
                borderWidth: 2
            }]
        },
        options: defaultOptions
    });
}

// Gráfico Solicitações e Prazo por Área Responsável
async function renderSolicitacoesPrazoAreaChart() {
    if (DEBUG_MODE) console.log('renderSolicitacoesPrazoAreaChart: ===== INICIANDO RENDERIZAÇÃO =====');
    
    try {
        // Verificar se Chart.js está disponível
        if (typeof Chart === 'undefined') {
            console.error('renderSolicitacoesPrazoAreaChart: Chart.js não está carregado!');
            return;
        }
        
        // Verificar elementos DOM
        const canvasEl = document.getElementById('chart-solicitacoes-prazo-area');
        if (!canvasEl) {
            console.error('renderSolicitacoesPrazoAreaChart: Canvas chart-solicitacoes-prazo-area não encontrado no DOM!');
            return;
        }
        
        // Buscar dados da API
        console.log('renderSolicitacoesPrazoAreaChart: Buscando dados...');
        let data;
        try {
            data = await api.getSolicitacoesPrazoPorArea();
            console.log('renderSolicitacoesPrazoAreaChart: Dados recebidos:', data);
        } catch (error) {
            console.error('renderSolicitacoesPrazoAreaChart: Erro ao buscar dados:', error);
            return;
        }
        
        console.log('renderSolicitacoesPrazoAreaChart: Renderizando gráfico...');
        if (data && data.dados && data.dados.length > 0) {
            const areas = data.dados.map(d => d.area);
            const menores_igual_5 = data.dados.map(d => d.menor_igual_5 || 0);
            const maiores_5 = data.dados.map(d => d.maior_5 || 0);
            
            console.log('renderSolicitacoesPrazoAreaChart: Dados do gráfico:', {
                areasCount: areas.length,
                areas: areas,
                menoresCount: menores_igual_5.length,
                maioresCount: maiores_5.length
            });
            
            // Validar que arrays têm o mesmo tamanho
            if (areas.length !== menores_igual_5.length || areas.length !== maiores_5.length) {
                console.error('renderSolicitacoesPrazoAreaChart: Arrays têm tamanhos diferentes!', {
                    areas: areas.length,
                    menores: menores_igual_5.length,
                    maiores: maiores_5.length
                });
                return;
            }
            
            const chartBase = createChart('chart-solicitacoes-prazo-area', {
                type: 'bar',
                data: {
                    labels: areas,
                    datasets: [
                        {
                            label: '≤ 5 dias',
                            data: menores_igual_5,
                            backgroundColor: 'rgba(72, 187, 120, 0.8)', // Verde
                            borderColor: 'rgb(72, 187, 120)',
                            borderWidth: 2
                        },
                        {
                            label: '> 5 dias',
                            data: maiores_5,
                            backgroundColor: 'rgba(245, 101, 101, 0.8)', // Vermelho
                            borderColor: 'rgb(245, 101, 101)',
                            borderWidth: 2
                        }
                    ]
                },
                options: {
                    ...defaultOptions,
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Solicitações e Prazo por Área Responsável',
                            font: {
                                size: 16,
                                weight: 'bold'
                            },
                            padding: {
                                top: 10,
                                bottom: 20
                            }
                        },
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                padding: 15
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const index = context.dataIndex;
                                    const item = data.dados[index];
                                    if (context.datasetIndex === 0) {
                                        return `≤ 5 dias: ${menores_igual_5[index]} casos`;
                                    } else {
                                        return `> 5 dias: ${maiores_5[index]} casos`;
                                    }
                                },
                                footer: function(tooltipItems) {
                                    if (tooltipItems.length > 0) {
                                        const index = tooltipItems[0].dataIndex;
                                        const item = data.dados[index];
                                        return `Total: ${item.total || 0} casos`;
                                    }
                                    return '';
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Quantidade de Casos',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            ticks: {
                                stepSize: 1
                            },
                            grid: {
                                display: true,
                                drawBorder: false,
                                color: 'rgba(0, 0, 0, 0.1)'
                            },
                            border: {
                                display: false
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Área Responsável',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            grid: {
                                display: false
                            },
                            border: {
                                display: false
                            },
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45
                            }
                        }
                    }
                }
            });
            
            if (chartBase) {
                console.log('renderSolicitacoesPrazoAreaChart: Gráfico criado com sucesso');
                // Forçar update após um pequeno delay
                setTimeout(() => {
                    try {
                        chartBase.update('none');
                        console.log('renderSolicitacoesPrazoAreaChart: Gráfico atualizado');
                    } catch (e) {
                        console.error('renderSolicitacoesPrazoAreaChart: Erro ao atualizar gráfico:', e);
                    }
                }, 100);
            } else {
                console.error('renderSolicitacoesPrazoAreaChart: Falha ao criar gráfico');
            }
        } else {
            console.warn('renderSolicitacoesPrazoAreaChart: Nenhum dado disponível');
            showChartError('chart-solicitacoes-prazo-area', 'Sem dados para esta seleção');
        }
        
        if (DEBUG_MODE) console.log('renderSolicitacoesPrazoAreaChart: ===== RENDERIZAÇÃO CONCLUÍDA =====');
    } catch (error) {
        console.error('renderSolicitacoesPrazoAreaChart: ===== ERRO AO RENDERIZAR =====');
        console.error('renderSolicitacoesPrazoAreaChart: Erro completo:', error);
        console.error('renderSolicitacoesPrazoAreaChart: Stack:', error.stack);
        
        // Mostrar erro visual usando função utilitária
        showChartError('chart-solicitacoes-prazo-area', 'Erro ao carregar gráfico');
    }
}

// Gráfico Volume e Custo
async function renderVolumeCustoChart() {
    if (DEBUG_MODE) console.log('renderVolumeCustoChart: ===== INICIANDO RENDERIZAÇÃO =====');
    
    try {
        // Verificar se Chart.js está disponível
        if (typeof Chart === 'undefined') {
            console.error('renderVolumeCustoChart: Chart.js não está carregado!');
            return;
        }
        
        // Verificar elementos DOM
        const canvasEl = document.getElementById('chart-volume-custo');
        if (!canvasEl) {
            if (DEBUG_MODE) console.error('renderVolumeCustoChart: Canvas chart-volume-custo não encontrado no DOM!');
            return;
        }
        
        // Buscar dados da API
        let data;
        try {
            data = await api.getVolumeCusto();
        } catch (error) {
            console.error('renderVolumeCustoChart: Erro ao buscar dados:', error);
            return;
        }
        
        // Validar dados antes de renderizar
        if (!data || !data.dados || !Array.isArray(data.dados) || data.dados.length === 0) {
            if (DEBUG_MODE) console.warn('renderVolumeCustoChart: Nenhum dado disponível');
            return;
        }
        
        // Extrair e validar dados
        const tiposEncerramento = [];
        const volumes = [];
        const custosMedios = [];
        
        // Processar e validar cada item
        for (const item of data.dados) {
            const tipo = String(item.tipo_encerramento || 'N/A').trim();
            const volume = Number(item.volume) || 0;
            const custoMedio = Number(item.custo_medio) || 0;
            
            // Validar valores
            if (isNaN(volume) || !isFinite(volume) || volume < 0) {
                console.warn(`renderVolumeCustoChart: Volume inválido para ${tipo}: ${item.volume}`);
                continue;
            }
            if (isNaN(custoMedio) || !isFinite(custoMedio) || custoMedio < 0) {
                console.warn(`renderVolumeCustoChart: Custo médio inválido para ${tipo}: ${item.custo_medio}`);
                continue;
            }
            
            // Adicionar apenas se volume > 0 (dados válidos)
            if (volume > 0) {
                tiposEncerramento.push(tipo);
                volumes.push(volume);
                custosMedios.push(custoMedio);
            }
        }
        
        // Validar que temos dados para exibir
        if (tiposEncerramento.length === 0) {
            console.warn('renderVolumeCustoChart: Nenhum dado válido para exibir');
            return;
        }
        
        // Validar que arrays têm o mesmo tamanho
        if (tiposEncerramento.length !== volumes.length || tiposEncerramento.length !== custosMedios.length) {
            console.error('renderVolumeCustoChart: Arrays têm tamanhos diferentes após validação!', {
                tipos: tiposEncerramento.length,
                volumes: volumes.length,
                custosMedios: custosMedios.length
            });
            return;
        }
            
            const chartBase = await createChartWithRetry('chart-volume-custo', {
        type: 'bar',
        data: {
                    labels: tiposEncerramento,
                    datasets: [
                        {
                            label: 'Volume (Qtd)',
                            data: volumes,
                backgroundColor: 'rgba(49, 130, 206, 0.8)',
                borderColor: 'rgb(49, 130, 206)',
                borderWidth: 2,
                yAxisID: 'y'
                        },
                        {
                            label: 'Custo Médio (R$)',
                            type: 'line',
                            data: custosMedios,
                            borderColor: 'rgba(237, 137, 54, 1)',
                            backgroundColor: 'rgba(237, 137, 54, 0.1)',
                            borderWidth: 3,
                            fill: false,
                            tension: 0.4,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            pointBackgroundColor: 'rgba(237, 137, 54, 1)',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            yAxisID: 'y1',
                            order: 0  // Linha renderiza na frente das barras
                        }
                    ]
        },
        options: {
            ...defaultOptions,
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Volume (Qtd) e Custo Médio (R$) por Encerramento',
                            font: {
                                size: 16,
                                weight: 'bold'
                            },
                            padding: {
                                top: 10,
                                bottom: 20
                            }
                        },
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                padding: 15
                            }
                        },
                        tooltip: {
                            callbacks: {
                                title: function(tooltipItems) {
                                    if (tooltipItems.length > 0) {
                                        const index = tooltipItems[0].dataIndex;
                                        return tiposEncerramento[index] || 'N/A';
                                    }
                                    return '';
                                },
                                label: function(context) {
                                    const index = context.dataIndex;
                                    if (context.datasetIndex === 0) {
                                        return `Volume: ${volumes[index].toLocaleString('pt-BR')} casos`;
                                    } else {
                                        return `Custo Médio: R$ ${custosMedios[index].toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                    }
                                },
                                footer: function(tooltipItems) {
                                    if (tooltipItems.length > 0) {
                                        const index = tooltipItems[0].dataIndex;
                                        // Encontrar o item original nos dados
                                        const tipo = tiposEncerramento[index];
                                        const item = data.dados.find(d => String(d.tipo_encerramento || '').trim() === tipo);
                                        if (item) {
                                            return [
                                                `Custo Total: R$ ${(item.custo_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                                                `Volume: ${(item.volume || 0).toLocaleString('pt-BR')} casos`
                                            ];
                                        }
                                    }
                                    return '';
                                }
                            }
                        }
                    },
            scales: {
                y: {
                    beginAtZero: true,
                            position: 'left',
                            title: {
                                display: true,
                                text: 'Volume (Quantidade)',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            ticks: {
                                stepSize: 1
                            },
                            grid: {
                                display: true,
                                drawBorder: false,
                                color: 'rgba(0, 0, 0, 0.1)'
                            },
                            border: {
                                display: false
                            }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                            title: {
                                display: true,
                                text: 'Custo Médio (R$)',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            ticks: {
                                callback: function(value) {
                                    return 'R$ ' + value.toFixed(2);
                                }
                            },
                    grid: {
                                drawOnChartArea: false,
                                display: false
                            },
                            border: {
                                display: false
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Tipo de Encerramento',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            grid: {
                                display: false
                            },
                            border: {
                                display: false
                            },
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45
                    }
                }
            }
        }
    });
            
            if (chartBase) {
                if (DEBUG_MODE) console.log('renderVolumeCustoChart: Gráfico criado com sucesso');
                // Forçar update após um pequeno delay
                setTimeout(() => {
                    try {
                        if (chartBase && !chartBase.destroyed) {
                            chartBase.update('none');
                        }
                    } catch (e) {
                        if (DEBUG_MODE) console.error('renderVolumeCustoChart: Erro ao atualizar gráfico:', e);
                    }
                }, 100);
            } else {
                console.error('renderVolumeCustoChart: Falha ao criar gráfico');
            }
        
        if (DEBUG_MODE) console.log('renderVolumeCustoChart: ===== RENDERIZAÇÃO CONCLUÍDA =====');
    } catch (error) {
        console.error('renderVolumeCustoChart: Erro ao renderizar:', error.message || error);
        if (DEBUG_MODE) {
            console.error('renderVolumeCustoChart: Stack:', error.stack);
        }
        
        // Mostrar erro visual
        const canvasEl = document.getElementById('chart-volume-custo');
        if (canvasEl) {
            try {
                const ctx = canvasEl.getContext('2d');
                ctx.fillStyle = '#f56565';
                ctx.font = 'bold 16px Arial';
                ctx.fillText('Erro ao renderizar gráfico', 10, 50);
                ctx.fillStyle = '#fff';
                ctx.font = '12px Arial';
                ctx.fillText(error.message || 'Erro desconhecido', 10, 70);
            } catch (e) {
                console.error('renderVolumeCustoChart: Erro ao mostrar mensagem de erro:', e);
            }
        }
    }
}

// Gráfico Reiterações
async function renderReiteracoesChart() {
    try {
        // Verificar se o canvas existe
        const canvas = document.getElementById('chart-reiteracoes');
        if (!canvas) {
            console.warn('renderReiteracoesChart: Canvas chart-reiteracoes não encontrado');
            return null;
        }
        
        // Liberar lock se estiver travado (timeout de segurança)
        const lockInfo = chartCreationLocks['chart-reiteracoes'];
        if (lockInfo) {
            const isLocked = typeof lockInfo === 'object' ? lockInfo.locked : lockInfo;
            if (isLocked) {
                if (typeof lockInfo === 'object' && lockInfo.timestamp) {
                    const lockAge = Date.now() - lockInfo.timestamp;
                    if (lockAge > 10000) { // 10 segundos
                        console.warn('renderReiteracoesChart: Lock travado há mais de 10s, liberando...');
                        delete chartCreationLocks['chart-reiteracoes'];
                    }
                } else {
                    // Lock antigo (boolean), liberar
                    delete chartCreationLocks['chart-reiteracoes'];
                }
            }
        }
        
        // Destruir gráfico existente antes de criar novo
        if (chartInstances['chart-reiteracoes']) {
            try {
                chartInstances['chart-reiteracoes'].destroy();
            } catch (e) {
                // Ignorar erros ao destruir
            }
            delete chartInstances['chart-reiteracoes'];
        }
        
        // Buscar dados
    const data = await api.getReiteracoes();
    
        // Validar dados
        if (!data || !data.dados || !Array.isArray(data.dados) || data.dados.length === 0) {
            console.warn('renderReiteracoesChart: Dados vazios ou inválidos');
            return null;
        }
        
        // Aguardar elemento estar visível
        await waitForElementVisible(canvas, 3000);
        
        // Criar gráfico com retry aumentado
        const chart = await createChartWithRetry('chart-reiteracoes', {
        type: 'bar',
        data: {
                labels: data.dados.map(d => d.objeto || 'N/A'),
            datasets: [{
                label: 'Total de Reiterações',
                    data: data.dados.map(d => sanitizeNumber(d.total_reiteracoes, 0)),
                backgroundColor: 'rgba(245, 101, 101, 0.8)',
                borderColor: 'rgb(245, 101, 101)',
                borderWidth: 2
            }]
        },
        options: defaultOptions
        }, 5, 200); // 5 tentativas com delay de 200ms
        
        return chart;
    } catch (error) {
        console.error('renderReiteracoesChart: Erro ao renderizar:', error);
        // Liberar lock em caso de erro
        delete chartCreationLocks['chart-reiteracoes'];
        return null;
    }
}

// Gráfico de Distribuição de Casos por UF (Donut Chart)
async function renderDistribuicaoUFChart() {
    if (DEBUG_MODE) console.log('renderDistribuicaoUFChart: ===== INICIANDO RENDERIZAÇÃO =====');
    
    try {
        // Verificar se Chart.js está disponível
        if (typeof Chart === 'undefined') {
            console.error('renderDistribuicaoUFChart: Chart.js não está carregado!');
            return;
        }
        
        // Verificar elementos DOM
        const canvasEl = document.getElementById('chart-distribuicao-uf');
        if (!canvasEl) {
            console.error('renderDistribuicaoUFChart: Canvas chart-distribuicao-uf não encontrado no DOM!');
            return;
        }
        
        // Buscar dados da API
        if (DEBUG_MODE) console.log('renderDistribuicaoUFChart: Buscando dados...');
        let data;
        try {
            data = await api.getCasosObjetosPorUf();
            if (DEBUG_MODE) console.log('renderDistribuicaoUFChart: Dados recebidos:', data);
        } catch (error) {
            console.error('renderDistribuicaoUFChart: Erro ao buscar dados:', error);
            return;
        }
        
        if (DEBUG_MODE) console.log('renderDistribuicaoUFChart: Renderizando gráfico...');
        if (data && data.por_uf && data.por_uf.length > 0) {
            const ufs = data.por_uf.map(d => d.uf || 'N/A');
            const quantidades = data.por_uf.map(d => d.quantidade || 0);
            const totalCasos = data.total_casos || quantidades.reduce((a, b) => a + b, 0);
            
            // Calcular porcentagens
            const percentuais = quantidades.map(q => totalCasos > 0 ? (q / totalCasos * 100) : 0);
            
            if (DEBUG_MODE) console.log('renderDistribuicaoUFChart: Dados do gráfico:', {
                ufsCount: ufs.length,
                ufs: ufs,
                quantidadesCount: quantidades.length,
                totalCasos: totalCasos
            });
            
            // Validar que arrays têm o mesmo tamanho
            if (ufs.length !== quantidades.length || ufs.length !== percentuais.length) {
                console.error('renderDistribuicaoUFChart: Arrays têm tamanhos diferentes!', {
                    ufs: ufs.length,
                    quantidades: quantidades.length,
                    percentuais: percentuais.length
                });
                return;
            }
            
            // Usar sistema global de cores para garantir consistência
            const colors = ufs.map(uf => getColor(uf, 'uf', 0.8));
            const borderColors = ufs.map(uf => getBorderColor(uf, 'uf'));
            
            // Plugin customizado para mostrar total no centro
            const totalPlugin = {
                id: 'totalPlugin',
                beforeDraw: function(chart) {
                    const ctx = chart.ctx;
                    const centerX = chart.chartArea.left + (chart.chartArea.right - chart.chartArea.left) / 2;
                    const centerY = chart.chartArea.top + (chart.chartArea.bottom - chart.chartArea.top) / 2;
                    
                    ctx.save();
                    ctx.font = 'bold 24px Arial';
                    ctx.fillStyle = '#333';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('Total', centerX, centerY - 15);
                    
                    ctx.font = 'bold 32px Arial';
                    ctx.fillText(totalCasos.toString(), centerX, centerY + 15);
                    
                    ctx.font = '14px Arial';
                    ctx.fillStyle = '#666';
                    ctx.fillText('casos', centerX, centerY + 35);
                    ctx.restore();
                }
            };
            
            const chartBase = await createChartWithRetry('chart-distribuicao-uf', {
                type: 'doughnut',
                data: {
                    labels: ufs,
                    datasets: [{
                        data: quantidades,
                        backgroundColor: colors,
                        borderColor: colors.map(c => c.replace('0.8', '1')),
                        borderWidth: 2
                    }]
                },
                options: {
                    ...defaultOptions,
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Distribuição de Casos por UF',
                            font: {
                                size: 16,
                                weight: 'bold'
                            },
                            padding: {
                                top: 10,
                                bottom: 20
                            }
                        },
                        legend: {
                            display: true,
                            position: 'right',
                            labels: {
                                usePointStyle: true,
                                padding: 15,
                                generateLabels: function(chart) {
                                    const data = chart.data;
                                    if (data.labels.length && data.datasets.length) {
                                        return data.labels.map((label, i) => {
                                            const value = data.datasets[0].data[i];
                                            const percentage = percentuais[i];
                                            return {
                                                text: `${label}: ${value} (${percentage.toFixed(1)}%)`,
                                                fillStyle: data.datasets[0].backgroundColor[i],
                                                strokeStyle: data.datasets[0].borderColor[i],
                                                lineWidth: 2,
                                                hidden: false,
                                                index: i
                                            };
                                        });
                                    }
                                    return [];
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.parsed || 0;
                                    const index = context.dataIndex;
                                    const percentage = percentuais[index];
                                    return [
                                        `UF: ${label}`,
                                        `Quantidade: ${value} casos`,
                                        `Porcentagem: ${percentage.toFixed(2)}%`
                                    ];
                                }
                            }
                        }
                    }
                },
                plugins: [totalPlugin]
            });
            
            if (chartBase) {
                if (DEBUG_MODE) console.log('renderDistribuicaoUFChart: Gráfico criado com sucesso');
                // Forçar update após um pequeno delay
                setTimeout(() => {
                    try {
                        chartBase.update('none');
                        if (DEBUG_MODE) console.log('renderDistribuicaoUFChart: Gráfico atualizado');
                    } catch (e) {
                        console.error('renderDistribuicaoUFChart: Erro ao atualizar gráfico:', e);
                    }
                }, 100);
            } else {
                console.error('renderDistribuicaoUFChart: Falha ao criar gráfico');
            }
        } else {
            console.warn('renderDistribuicaoUFChart: Nenhum dado disponível');
            if (canvasEl) {
                try {
                    const ctx = canvasEl.getContext('2d');
                    const width = canvasEl.width || canvasEl.clientWidth || 300;
                    const height = canvasEl.height || canvasEl.clientHeight || 300;
                    ctx.clearRect(0, 0, width, height);
                    ctx.fillStyle = '#ed8936';
                    ctx.font = 'bold 16px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('Nenhum dado disponível', width / 2, height / 2 - 10);
                    ctx.fillStyle = '#fff';
                    ctx.font = '12px Arial';
                    ctx.fillText('Verifique se o backend está retornando dados', width / 2, height / 2 + 10);
                } catch (e) {
                    console.error('renderDistribuicaoUFChart: Erro ao desenhar mensagem:', e);
                }
            }
        }
        
        if (DEBUG_MODE) console.log('renderDistribuicaoUFChart: ===== RENDERIZAÇÃO CONCLUÍDA =====');
    } catch (error) {
        console.error('renderDistribuicaoUFChart: ===== ERRO AO RENDERIZAR =====');
        console.error('renderDistribuicaoUFChart: Erro completo:', error);
        console.error('renderDistribuicaoUFChart: Stack:', error.stack);
        
        // Mostrar erro visual
        const canvasEl = document.getElementById('chart-distribuicao-uf');
        if (canvasEl) {
            try {
                const ctx = canvasEl.getContext('2d');
                ctx.fillStyle = '#f56565';
                ctx.font = 'bold 16px Arial';
                ctx.fillText('Erro ao renderizar gráfico', 10, 50);
                ctx.fillStyle = '#fff';
                ctx.font = '12px Arial';
                ctx.fillText(error.message || 'Erro desconhecido', 10, 70);
            } catch (e) {
                console.error('renderDistribuicaoUFChart: Erro ao mostrar mensagem de erro:', e);
            }
        }
    }
}

// Gráfico Pareto
async function renderParetoChart() {
    try {
    const data = await api.getPareto();
    
        await createChartWithRetry('chart-pareto', {
        type: 'bar',
        data: {
            labels: data.dados.map(d => d.objeto_acao),
            datasets: [{
                label: 'Impacto Financeiro',
                data: data.dados.map(d => d.impacto_financeiro),
                backgroundColor: 'rgba(49, 130, 206, 0.8)',
                borderColor: 'rgb(49, 130, 206)',
                borderWidth: 2
            }, {
                label: '% Acumulado',
                data: data.dados.map(d => d.percentual_acumulado),
                type: 'line',
                borderColor: 'rgb(237, 137, 54)',
                backgroundColor: 'rgba(237, 137, 54, 0.1)',
                yAxisID: 'y1',
                tension: 0.4
            }]
        },
        options: {
            ...defaultOptions,
            scales: {
                y: {
                    beginAtZero: true,
                    position: 'left'
                },
                y1: {
                    beginAtZero: true,
                    max: 100,
                    position: 'right',
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
    } catch (error) {
        console.error('renderParetoChart: Erro ao renderizar:', error);
    }
}

// Gráfico de Pareto - Impacto Financeiro Acumulado
async function renderParetoImpactoChart() {
    if (DEBUG_MODE) console.log('renderParetoImpactoChart: ===== INICIANDO RENDERIZAÇÃO =====');
    
    try {
        // Verificar se Chart.js está disponível
        if (typeof Chart === 'undefined') {
            console.error('renderParetoImpactoChart: Chart.js não está carregado!');
            return;
        }
        
        // Verificar elementos DOM
        const canvasEl = document.getElementById('chart-pareto-impacto');
        if (!canvasEl) {
            console.error('renderParetoImpactoChart: Canvas chart-pareto-impacto não encontrado no DOM!');
            return;
        }
        
        // Buscar dados da API
        console.log('renderParetoImpactoChart: Buscando dados...');
        let data;
        try {
            data = await api.getPareto();
            console.log('renderParetoImpactoChart: Dados recebidos:', data);
        } catch (error) {
            console.error('renderParetoImpactoChart: Erro ao buscar dados:', error);
            return;
        }
        
        console.log('renderParetoImpactoChart: Renderizando gráfico...');
        if (data && data.dados && data.dados.length > 0) {
            // Os dados já vêm ordenados decrescentemente do backend
            const objetos = data.dados.map(d => d.objeto_acao || 'N/A');
            const impactos = data.dados.map(d => d.impacto_financeiro || 0);
            const percentuaisAcumulados = data.dados.map(d => d.percentual_acumulado || 0);
            const percentuais = data.dados.map(d => d.percentual || 0);
            
            console.log('renderParetoImpactoChart: Dados do gráfico:', {
                objetosCount: objetos.length,
                objetos: objetos,
                impactosCount: impactos.length,
                percentuaisAcumuladosCount: percentuaisAcumulados.length
            });
            
            // Validar que arrays têm o mesmo tamanho
            if (objetos.length !== impactos.length || objetos.length !== percentuaisAcumulados.length) {
                console.error('renderParetoImpactoChart: Arrays têm tamanhos diferentes!', {
                    objetos: objetos.length,
                    impactos: impactos.length,
                    percentuaisAcumulados: percentuaisAcumulados.length
                });
                return;
            }
            
            const chartBase = await createChartWithRetry('chart-pareto-impacto', {
                type: 'bar',
                data: {
                    labels: objetos,
                    datasets: [
                        {
                            label: 'Impacto Financeiro (R$)',
                            data: impactos,
                            backgroundColor: 'rgba(49, 130, 206, 0.8)',
                            borderColor: 'rgb(49, 130, 206)',
                            borderWidth: 2,
                            yAxisID: 'y'
                        },
                        {
                            label: '% Acumulado',
                            type: 'line',
                            data: percentuaisAcumulados,
                            borderColor: 'rgba(237, 137, 54, 1)',
                            backgroundColor: 'rgba(237, 137, 54, 0.1)',
                            borderWidth: 3,
                            fill: false,
                            tension: 0.4,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            pointBackgroundColor: 'rgba(237, 137, 54, 1)',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            yAxisID: 'y1',
                            order: 0  // Linha renderiza na frente das barras
                        }
                    ]
                },
                options: {
                    ...defaultOptions,
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Curva de Impacto Financeiro Acumulado (Pareto)',
                            font: {
                                size: 16,
                                weight: 'bold'
                            },
                            padding: {
                                top: 10,
                                bottom: 20
                            }
                        },
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                padding: 15
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const index = context.dataIndex;
                                    const item = data.dados[index];
                                    if (context.datasetIndex === 0) {
                                        // Barra: mostrar impacto financeiro e percentual individual
                                        const valor = impactos[index];
                                        const percentual = percentuais[index];
                                        return [
                                            `Impacto Financeiro: R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                                            `Percentual Individual: ${percentual.toFixed(2)}%`
                                        ];
                                    } else {
                                        // Linha: mostrar percentual acumulado
                                        const percentualAcumulado = percentuaisAcumulados[index];
                                        return `Percentual Acumulado: ${percentualAcumulado.toFixed(2)}%`;
                                    }
                                },
                                footer: function(tooltipItems) {
                                    if (tooltipItems.length > 0) {
                                        const index = tooltipItems[0].dataIndex;
                                        const item = data.dados[index];
                                        const acumulado = item.acumulado || 0;
                                        return `Valor Acumulado: R$ ${acumulado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                    }
                                    return '';
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            position: 'left',
                            title: {
                                display: true,
                                text: 'Impacto Financeiro (R$)',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            ticks: {
                                callback: function(value) {
                                    return 'R$ ' + value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
                                }
                            },
                            grid: {
                                display: true,
                                drawBorder: false,
                                color: 'rgba(0, 0, 0, 0.1)'
                            },
                            border: {
                                display: false
                            }
                        },
                        y1: {
                            beginAtZero: true,
                            max: 100,
                            position: 'right',
                            title: {
                                display: true,
                                text: 'Percentual Acumulado (%)',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            ticks: {
                                callback: function(value) {
                                    return value.toFixed(0) + '%';
                                }
                            },
                            grid: {
                                drawOnChartArea: false,
                                display: false
                            },
                            border: {
                                display: false
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Objeto da Ação',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            grid: {
                                display: false
                            },
                            border: {
                                display: false
                            },
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45
                            }
                        }
                    }
                }
            });
            
            if (chartBase) {
                console.log('renderParetoImpactoChart: Gráfico criado com sucesso');
                // Forçar update após um pequeno delay
                setTimeout(() => {
                    try {
                        chartBase.update('none');
                        console.log('renderParetoImpactoChart: Gráfico atualizado');
                    } catch (e) {
                        console.error('renderParetoImpactoChart: Erro ao atualizar gráfico:', e);
                    }
                }, 100);
            } else {
                console.error('renderParetoImpactoChart: Falha ao criar gráfico');
            }
        } else {
            console.warn('renderParetoImpactoChart: Nenhum dado disponível');
            if (canvasEl) {
                try {
                    const ctx = canvasEl.getContext('2d');
                    const width = canvasEl.width || canvasEl.clientWidth || 300;
                    const height = canvasEl.height || canvasEl.clientHeight || 300;
                    ctx.clearRect(0, 0, width, height);
                    ctx.fillStyle = '#ed8936';
                    ctx.font = 'bold 16px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('Nenhum dado disponível', width / 2, height / 2 - 10);
                    ctx.fillStyle = '#fff';
                    ctx.font = '12px Arial';
                    ctx.fillText('Verifique se o backend está retornando dados', width / 2, height / 2 + 10);
                } catch (e) {
                    console.error('renderParetoImpactoChart: Erro ao desenhar mensagem:', e);
                }
            }
        }
        
        if (DEBUG_MODE) console.log('renderParetoImpactoChart: ===== RENDERIZAÇÃO CONCLUÍDA =====');
    } catch (error) {
        console.error('renderParetoImpactoChart: ===== ERRO AO RENDERIZAR =====');
        console.error('renderParetoImpactoChart: Erro completo:', error);
        console.error('renderParetoImpactoChart: Stack:', error.stack);
        
        // Mostrar erro visual
        const canvasEl = document.getElementById('chart-pareto-impacto');
        if (canvasEl) {
            try {
                const ctx = canvasEl.getContext('2d');
                ctx.fillStyle = '#f56565';
                ctx.font = 'bold 16px Arial';
                ctx.fillText('Erro ao renderizar gráfico', 10, 50);
                ctx.fillStyle = '#fff';
                ctx.font = '12px Arial';
                ctx.fillText(error.message || 'Erro desconhecido', 10, 70);
            } catch (e) {
                console.error('renderParetoImpactoChart: Erro ao mostrar mensagem de erro:', e);
            }
        }
    }
}

// Gráfico Sentenças
async function renderSentencasChart() {
    try {
    const data = await api.getSentencas();
    
        await createChartWithRetry('chart-sentencas', {
        type: 'pie',
        data: {
            labels: ['Favorável', 'Desfavorável', 'Parcial'],
            datasets: [{
                data: [data.favoravel, data.desfavoravel, data.parcial],
                backgroundColor: [
                    'rgba(72, 187, 120, 0.8)',
                    'rgba(245, 101, 101, 0.8)',
                    'rgba(237, 137, 54, 0.8)'
                ],
                borderColor: [
                    'rgb(72, 187, 120)',
                    'rgb(245, 101, 101)',
                    'rgb(237, 137, 54)'
                ],
                borderWidth: 2
            }]
        },
        options: defaultOptions
    });
    } catch (error) {
        console.error('renderSentencasChart: Erro ao renderizar:', error);
    }
}

// Gráfico Sentenças por Área (Barras Empilhadas)
async function renderSentencasPorAreaChart() {
    if (DEBUG_MODE) console.log('renderSentencasPorAreaChart: ===== INICIANDO RENDERIZAÇÃO =====');
    
    try {
        // Verificar se Chart.js está disponível
        if (typeof Chart === 'undefined') {
            console.error('renderSentencasPorAreaChart: Chart.js não está carregado!');
            return;
        }
        
        // Verificar elementos DOM
        const canvasEl = document.getElementById('chart-sentencas-por-area');
        if (!canvasEl) {
            console.error('renderSentencasPorAreaChart: Canvas chart-sentencas-por-area não encontrado no DOM!');
            return;
        }
        
        // Buscar dados da API
        console.log('renderSentencasPorAreaChart: Buscando dados...');
        let data;
        try {
            data = await api.getSentencasPorArea();
            console.log('renderSentencasPorAreaChart: Dados recebidos:', data);
        } catch (error) {
            console.error('renderSentencasPorAreaChart: Erro ao buscar dados:', error);
            return;
        }
        
        console.log('renderSentencasPorAreaChart: Renderizando gráfico...');
        if (data && data.dados && data.dados.length > 0) {
            const areas = data.dados.map(d => d.area || 'N/A');
            const favoraveis = data.dados.map(d => d.favoravel || 0);
            const desfavoraveis = data.dados.map(d => d.desfavoravel || 0);
            const parciais = data.dados.map(d => d.parcial || 0);
            const totais = data.dados.map(d => d.total || 0);
            
            console.log('renderSentencasPorAreaChart: Dados do gráfico:', {
                areasCount: areas.length,
                areas: areas,
                favoraveisCount: favoraveis.length,
                desfavoraveisCount: desfavoraveis.length
            });
            
            // Validar que arrays têm o mesmo tamanho
            if (areas.length !== favoraveis.length || areas.length !== desfavoraveis.length || areas.length !== parciais.length) {
                console.error('renderSentencasPorAreaChart: Arrays têm tamanhos diferentes!', {
                    areas: areas.length,
                    favoraveis: favoraveis.length,
                    desfavoraveis: desfavoraveis.length,
                    parciais: parciais.length
                });
                return;
            }
            
            // Plugin customizado para data labels nas barras
            const dataLabelsPlugin = {
                id: 'sentencasDataLabels',
                afterDatasetsDraw: function(chart) {
                    const ctx = chart.ctx;
                    const meta = chart.getDatasetMeta(0);
                    ctx.save();
                    ctx.font = 'bold 11px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#333';
                    
                    // Para cada barra empilhada
                    meta.data.forEach((bar, index) => {
                        const areaData = data.dados[index];
                        const total = areaData.total;
                        if (total > 0) {
                            const x = bar.x;
                            const y = bar.y - bar.height / 2;
                            ctx.fillText(total.toString(), x, y - 5);
                        }
                    });
                    ctx.restore();
                }
            };
            
            const chartBase = await createChartWithRetry('chart-sentencas-por-area', {
                type: 'bar',
                data: {
                    labels: areas,
                    datasets: [
                        {
                            label: 'Favorável',
                            data: favoraveis,
                            backgroundColor: 'rgba(72, 187, 120, 0.8)',
                            borderColor: 'rgb(72, 187, 120)',
                            borderWidth: 2
                        },
                        {
                            label: 'Desfavorável',
                            data: desfavoraveis,
                            backgroundColor: 'rgba(245, 101, 101, 0.8)',
                            borderColor: 'rgb(245, 101, 101)',
                            borderWidth: 2
                        },
                        {
                            label: 'Parcial',
                            data: parciais,
                            backgroundColor: 'rgba(237, 137, 54, 0.8)',
                            borderColor: 'rgb(237, 137, 54)',
                            borderWidth: 2
                        }
                    ]
                },
                options: {
                    ...defaultOptions,
                    indexAxis: 'y', // Barras horizontais (áreas no eixo Y)
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Sentença Favorável/Desfavorável por Área Responsável',
                            font: {
                                size: 16,
                                weight: 'bold'
                            },
                            padding: {
                                top: 10,
                                bottom: 20
                            }
                        },
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                padding: 15
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const index = context.dataIndex;
                                    const item = data.dados[index];
                                    const datasetLabel = context.dataset.label;
                                    const value = context.parsed.x || 0;
                                    const total = item.total;
                                    const percentual = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                    return [
                                        `${datasetLabel}: ${value} casos`,
                                        `Percentual: ${percentual}%`,
                                        `Total da área: ${total} casos`
                                    ];
                                },
                                footer: function(tooltipItems) {
                                    if (tooltipItems.length > 0) {
                                        const index = tooltipItems[0].dataIndex;
                                        const item = data.dados[index];
                                        return [
                                            `Total: ${item.total} casos`,
                                            `Favorável: ${item.favoravel} (${item.total > 0 ? ((item.favoravel / item.total) * 100).toFixed(1) : 0}%)`,
                                            `Desfavorável: ${item.desfavoravel} (${item.total > 0 ? ((item.desfavoravel / item.total) * 100).toFixed(1) : 0}%)`,
                                            `Parcial: ${item.parcial} (${item.total > 0 ? ((item.parcial / item.total) * 100).toFixed(1) : 0}%)`
                                        ];
                                    }
                                    return '';
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Quantidade de Casos',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            ticks: {
                                stepSize: 1
                            },
                            grid: {
                                display: true,
                                drawBorder: false,
                                color: 'rgba(0, 0, 0, 0.1)'
                            },
                            border: {
                                display: false
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Área Responsável',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            grid: {
                                display: false
                            },
                            border: {
                                display: false
                            }
                        }
                    }
                },
                plugins: [dataLabelsPlugin]
            });
            
            if (chartBase) {
                console.log('renderSentencasPorAreaChart: Gráfico criado com sucesso');
                // Forçar update após um pequeno delay
                setTimeout(() => {
                    try {
                        chartBase.update('none');
                        console.log('renderSentencasPorAreaChart: Gráfico atualizado');
                    } catch (e) {
                        console.error('renderSentencasPorAreaChart: Erro ao atualizar gráfico:', e);
                    }
                }, 100);
            } else {
                console.error('renderSentencasPorAreaChart: Falha ao criar gráfico');
            }
        } else {
            console.warn('renderSentencasPorAreaChart: Nenhum dado disponível');
            if (canvasEl) {
                try {
                    const ctx = canvasEl.getContext('2d');
                    const width = canvasEl.width || canvasEl.clientWidth || 300;
                    const height = canvasEl.height || canvasEl.clientHeight || 300;
                    ctx.clearRect(0, 0, width, height);
                    ctx.fillStyle = '#ed8936';
                    ctx.font = 'bold 16px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('Nenhum dado disponível', width / 2, height / 2 - 10);
                    ctx.fillStyle = '#fff';
                    ctx.font = '12px Arial';
                    ctx.fillText('Verifique se o backend está retornando dados', width / 2, height / 2 + 10);
                } catch (e) {
                    console.error('renderSentencasPorAreaChart: Erro ao desenhar mensagem:', e);
                }
            }
        }
        
        if (DEBUG_MODE) console.log('renderSentencasPorAreaChart: ===== RENDERIZAÇÃO CONCLUÍDA =====');
    } catch (error) {
        console.error('renderSentencasPorAreaChart: ===== ERRO AO RENDERIZAR =====');
        console.error('renderSentencasPorAreaChart: Erro completo:', error);
        console.error('renderSentencasPorAreaChart: Stack:', error.stack);
        
        // Mostrar erro visual
        const canvasEl = document.getElementById('chart-sentencas-por-area');
        if (canvasEl) {
            try {
                const ctx = canvasEl.getContext('2d');
                ctx.fillStyle = '#f56565';
                ctx.font = 'bold 16px Arial';
                ctx.fillText('Erro ao renderizar gráfico', 10, 50);
                ctx.fillStyle = '#fff';
                ctx.font = '12px Arial';
                ctx.fillText(error.message || 'Erro desconhecido', 10, 70);
            } catch (e) {
                console.error('renderSentencasPorAreaChart: Erro ao mostrar mensagem de erro:', e);
            }
        }
    }
}

// Gráfico Reincidência
async function renderReincidenciaChart() {
    try {
    const data = await api.getReincidencia();
    
        await createChartWithRetry('chart-reincidencia', {
        type: 'doughnut',
        data: {
            labels: ['Reincidentes', 'Não Reincidentes'],
            datasets: [{
                data: [data.reincidentes, data.nao_reincidentes],
                backgroundColor: [
                    'rgba(245, 101, 101, 0.8)',
                    'rgba(72, 187, 120, 0.8)'
                ],
                borderColor: [
                    'rgb(245, 101, 101)',
                    'rgb(72, 187, 120)'
                ],
                borderWidth: 2
            }]
        },
        options: defaultOptions
    });
    } catch (error) {
        console.error('renderReincidenciaChart: Erro ao renderizar:', error);
    }
}

// Gráfico Tipos de Ações 2025
async function renderTiposAcoesChart() {
    try {
    const data = await api.getTiposAcoes2025();
    
        await createChartWithRetry('chart-tipos-acoes', {
        type: 'bar',
        data: {
            labels: data.dados.map(d => d.tipo),
            datasets: [{
                label: 'Quantidade',
                data: data.dados.map(d => d.quantidade),
                backgroundColor: 'rgba(49, 130, 206, 0.8)',
                borderColor: 'rgb(49, 130, 206)',
                borderWidth: 2
            }]
        },
        options: defaultOptions
    });
    } catch (error) {
        console.error('renderTiposAcoesChart: Erro ao renderizar:', error);
    }
}

// Gráfico Erro Sistêmico
async function renderErroSistemicoChart() {
    try {
    const data = await api.getErroSistemico();
        
        if (!data || !data.dados || data.dados.length === 0) {
            console.warn('renderErroSistemicoChart: dados vazios');
            return;
        }
    
        await createChartWithRetry('chart-erro-sistemico', {
        type: 'bar',
        data: {
            labels: data.dados.map(d => d.objeto),
            datasets: [{
                label: 'Quantidade de Erros',
                data: data.dados.map(d => d.quantidade),
                backgroundColor: 'rgba(245, 101, 101, 0.8)',
                borderColor: 'rgb(245, 101, 101)',
                borderWidth: 2
            }]
        },
        options: defaultOptions
    });
    } catch (error) {
        console.error('renderErroSistemicoChart: Erro ao renderizar:', error);
    }
}

// Gráfico Erro Sistêmico por Tipo - Inclui Valor Pretendido
async function renderPrejuizoErroCriticoChart() {
    try {
        const data = await api.getErroSistemico();
        
        if (!data || !data.dados || data.dados.length === 0) {
            console.warn('renderPrejuizoErroCriticoChart: dados vazios');
            return;
        }
        
        // Usar valor pretendido se disponível, senão usar impacto
        const valores = data.dados.map(d => {
            const valor = d.valor_pretendido || d.impacto || 0;
            return valor / 1000; // Converter para milhares
        });
        
        const total = valores.reduce((a, b) => a + b, 0);
        const percentuais = valores.map(v => total > 0 ? ((v / total) * 100).toFixed(1) : 0);
        
        const labels = data.dados.map((d, i) => 
            `${d.objeto}\n${valores[i].toFixed(2)} Mil (${percentuais[i]}%)`
        );
    
        await createChartWithRetry('chart-prejuizo-erro-critico', {
        type: 'doughnut',
        data: {
                labels: labels,
            datasets: [{
                data: valores,
                backgroundColor: [
                    'rgba(245, 101, 101, 0.8)',
                    'rgba(237, 137, 54, 0.8)',
                    'rgba(251, 191, 36, 0.8)',
                    'rgba(49, 130, 206, 0.8)',
                        'rgba(72, 187, 120, 0.8)',
                        'rgba(139, 92, 246, 0.8)',
                        'rgba(236, 72, 153, 0.8)'
                ],
                borderColor: [
                    'rgb(245, 101, 101)',
                    'rgb(237, 137, 54)',
                    'rgb(251, 191, 36)',
                    'rgb(49, 130, 206)',
                        'rgb(72, 187, 120)',
                        'rgb(139, 92, 246)',
                        'rgb(236, 72, 153)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            ...defaultOptions,
            plugins: {
                ...defaultOptions.plugins,
                    title: {
                        display: true,
                        text: `Erro Sistêmico - Valor Pretendido Total: ${formatCurrency(data.total_valor_pretendido || data.total_impacto || 0)}`,
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                legend: {
                    position: 'right'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                return `${label}: ${formatCurrency(value * 1000)}`;
                            }
                        }
                }
            }
        }
    });
    } catch (error) {
        console.error('renderPrejuizoErroCriticoChart: Erro ao renderizar:', error);
    }
}

// Gráfico Objeto por Estado
async function renderObjetoEstadoChart() {
    try {
    const data = await api.getObjetoPorEstado();
    
    // Transformar dados pivot em formato adequado para gráfico
    if (!data.dados || data.dados.length === 0) return;
    
    const estados = data.dados.map(d => d.estado);
    const objetos = Object.keys(data.dados[0]).filter(k => k !== 'estado');
    
    const datasets = objetos.map((objeto, idx) => {
        const colors = [
            'rgba(49, 130, 206, 0.8)',
            'rgba(237, 137, 54, 0.8)',
            'rgba(72, 187, 120, 0.8)',
            'rgba(245, 101, 101, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(236, 72, 153, 0.8)',
            'rgba(34, 197, 94, 0.8)',
            'rgba(251, 191, 36, 0.8)'
        ];
        return {
            label: objeto,
            data: data.dados.map(d => d[objeto] || 0),
            backgroundColor: colors[idx % colors.length],
            borderColor: colors[idx % colors.length].replace('0.8', '1'),
            borderWidth: 1
        };
    });
    
        await createChartWithRetry('chart-objeto-estado', {
        type: 'bar',
        data: {
            labels: estados,
            datasets: datasets
        },
        options: {
            ...defaultOptions,
            scales: {
                x: {
                    stacked: true
                },
                y: {
                    stacked: true,
                    beginAtZero: true
                }
            }
        }
    });
    } catch (error) {
        console.error('renderObjetoEstadoChart: Erro ao renderizar:', error);
    }
}

// Tabela de Saldo por Objeto
// Nota: A renderização agora é feita em scroll.js para suportar ordenação
// Este método é mantido para compatibilidade, mas delega para scrollController
async function renderTabelaSaldo() {
    // Se scrollController existe e tem o método, usar ele
    if (window.scrollController && window.scrollController.loadSaldo) {
        await window.scrollController.loadSaldo();
        return;
    }
    
    // Fallback: renderização direta (sem ordenação)
    const tbody = document.querySelector('#table-saldo tbody');
    if (!tbody) return;

    let data;
    try {
        data = await api.getSaldoPorObjeto();
    } catch (e) {
        console.error('renderTabelaSaldo:', e);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#c00;">Erro: backend não respondeu (porta 8001).<br><small>Dê dois cliques em <strong>iniciar_backend.bat</strong> na pasta do projeto.</small></td></tr>';
        return;
    }

    if (!data.dados || data.dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhum dado disponível</td></tr>';
        return;
    }
    
    // Renderizar linhas de dados
    let html = data.dados.map(item => {
        const objeto = item.objeto_acao || 'Não Informado';
        const entradas = item.qtd_entradas || 0;
        const encerramentos = item.qtd_encerramentos || 0;
        const saldo = item.saldo || 0;
        
        // Classe CSS para destacar saldo negativo
        const saldoClass = saldo < 0 ? 'saldo-negativo' : saldo > 0 ? 'saldo-positivo' : '';
        
        return `
            <tr>
                <td>${objeto}</td>
                <td>${formatNumber(entradas)}</td>
                <td>${formatNumber(encerramentos)}</td>
                <td class="${saldoClass}">${formatNumber(saldo)}</td>
            </tr>
        `;
    }).join('');
    
    // Adicionar linha de total no rodapé
    html += `
        <tr class="total-row">
            <td><strong>TOTAL</strong></td>
            <td><strong>${formatNumber(data.total_entradas || 0)}</strong></td>
            <td><strong>${formatNumber(data.total_encerramentos || 0)}</strong></td>
            <td class="${data.total_saldo < 0 ? 'saldo-negativo' : data.total_saldo > 0 ? 'saldo-positivo' : ''}">
                <strong>${formatNumber(data.total_saldo || 0)}</strong>
            </td>
        </tr>
    `;
    
    tbody.innerHTML = html;
}

// --- Slide Análise de Impacto (Cross-Filtering) ---
let slideImpactoFiltro = null;
let chartImpactoRoscInstance = null; // Instância do gráfico de rosca de distribuição por UF
let dadosDistribuicaoUFOriginais = null; // Dados originais sem filtro

function updateSlideImpactoFiltro(objeto) {
    const next = (objeto && slideImpactoFiltro === objeto) ? null : objeto || null;
    slideImpactoFiltro = next;
    const btn = document.getElementById('btn-impacto-ver-todos');
    if (btn) btn.style.display = next ? 'inline-block' : 'none';
    if (window.chartFunctions && window.chartFunctions.renderSlideImpacto) {
        window.chartFunctions.renderSlideImpacto(next);
    }
}

/**
 * Atualiza o dashboard inteiro baseado em filtro de UF
 * Usa Chart.js .update() para evitar destruir e recriar gráficos
 * @param {string|null} uf - Sigla da UF ou null para remover filtro
 */
async function updateDashboardByUF(uf) {
    try {
        // Atualizar estado global
        if (typeof DashboardState !== 'undefined') {
            DashboardState.setFilter('uf', uf);
        }
        
        // Atualizar gráfico de distribuição por UF
        await updateDistribuicaoUFPorEstado(uf);
        
        // Outros gráficos serão atualizados via listeners do DashboardState
        
    } catch (error) {
        console.error('Erro ao atualizar dashboard por UF:', error);
    }
}

// Tornar disponível globalmente
window.updateDashboardByUF = updateDashboardByUF;

// Função para atualizar gráfico de distribuição por UF com filtro de estado
async function updateDistribuicaoUFPorEstado(uf) {
    console.log('updateDistribuicaoUFPorEstado: Atualizando gráfico para UF:', uf);
    
    try {
        // Se não há instância do gráfico, renderizar tudo novamente
        if (!chartImpactoRoscInstance) {
            console.log('updateDistribuicaoUFPorEstado: Gráfico não existe, renderizando tudo...');
            await renderSlideImpacto(null, uf);
            return;
        }
        
        // Buscar dados filtrados por estado usando API com parâmetro uf
        let data;
        if (uf) {
            // Buscar dados filtrados por estado diretamente da API
            data = await api.getAnaliseCorrelacao(null, uf);
        } else {
            // Sem filtro, usar dados originais
            if (dadosDistribuicaoUFOriginais) {
                data = { distribuicao_uf: dadosDistribuicaoUFOriginais };
            } else {
                data = await api.getAnaliseCorrelacao(null, null);
                dadosDistribuicaoUFOriginais = data.distribuicao_uf;
            }
        }
        
        const distribuicao = data.distribuicao_uf || [];
        
        if (distribuicao.length > 0) {
            const estados = distribuicao.map(d => d.uf);
            const quantidades = distribuicao.map(d => d.quantidade);
            const prejuizosTotalMil = distribuicao.map(d => d.prejuizo_total_mil || d.impacto_mil);
            
            // Calcular percentuais baseados em quantidade de casos
            const totalCasos = distribuicao.reduce((sum, d) => sum + (d.quantidade || 0), 0);
            const percentuais = distribuicao.map(d => {
                const qtd = d.quantidade || 0;
                return totalCasos > 0 ? (qtd / totalCasos * 100) : 0;
            });
            
            // Usar sistema global de cores para garantir consistência
            const colors = estados.map((estado) => {
                // Se há filtro e este é o estado selecionado, destacar
                if (uf && estado === uf) {
                    return getColor(estado, 'uf', 1.0); // Mais opaco para destacar
                }
                return getColor(estado, 'uf', 0.85);
            });
            
            const borderColors = estados.map((estado) => {
                // Se há filtro e este é o estado selecionado, destacar com borda mais grossa
                if (uf && estado === uf) {
                    return getBorderColor(estado, 'uf');
                }
                return getBorderColor(estado, 'uf');
            });
            
            const borderWidths = estados.map((estado) => {
                // Se há filtro e este é o estado selecionado, borda mais grossa
                if (uf && estado === uf) {
                    return 4;
                }
                return 2;
            });
            
            // Atualizar dados do gráfico
            chartImpactoRoscInstance.data.labels = estados;
            chartImpactoRoscInstance.data.datasets[0].data = percentuais;
            chartImpactoRoscInstance.data.datasets[0].backgroundColor = colors;
            chartImpactoRoscInstance.data.datasets[0].borderColor = borderColors;
            chartImpactoRoscInstance.data.datasets[0].borderWidth = borderWidths;
            
            // Atualizar referências para tooltips
            const estadosRef = estados;
            const percentuaisRef = percentuais;
            const quantidadesRef = quantidades;
            const prejuizosTotalMilRef = prejuizosTotalMil;
            
            // Atualizar tooltip
            chartImpactoRoscInstance.options.plugins.tooltip.callbacks = {
                title: function(context) {
                    return `Estado: ${context[0].label}`;
                },
                label: function(context) {
                const index = context.dataIndex;
                const ufLabel = estadosRef[index];
                const percentual = percentuaisRef[index];
                const quantidade = quantidadesRef[index];
                const prejuizoTotalMil = prejuizosTotalMilRef[index];
                return [
                        `Quantidade: ${formatNumber(quantidade)} casos`,
                        `Percentual: ${percentual.toFixed(2)}%`,
                        `Erro Sistêmico: ${formatCurrencyMil(prejuizoTotalMil * 1000)}`
                    ];
                },
                footer: function(tooltipItems) {
                    const totalCasos = quantidadesRef.reduce((a, b) => a + b, 0);
                    return `Total: ${formatNumber(totalCasos)} casos`;
                }
            };
            
            // Atualizar legenda
            chartImpactoRoscInstance.options.plugins.legend.labels.generateLabels = function(chart) {
                const data = chart.data;
                if (data.labels.length && data.datasets.length) {
                    return data.labels.map((label, i) => {
                        const dataset = data.datasets[0];
                        const percentual = dataset.data[i];
                        const quantidade = quantidadesRef[i];
                        return {
                            text: `${label}: ${formatNumber(quantidade)} casos (${percentual.toFixed(1)}%)`,
                            fillStyle: dataset.backgroundColor[i],
                            strokeStyle: dataset.borderColor[i],
                            lineWidth: Array.isArray(dataset.borderWidth) ? dataset.borderWidth[i] : dataset.borderWidth,
                            hidden: false,
                            index: i,
                            fontColor: '#333',
                            fontSize: 12
                        };
                    });
                }
                return [];
            };
            
            chartImpactoRoscInstance.options.plugins.legend.labels.usePointStyle = true;
            chartImpactoRoscInstance.options.plugins.legend.labels.pointStyle = 'rect';
            chartImpactoRoscInstance.options.plugins.legend.labels.padding = 15;
            chartImpactoRoscInstance.options.plugins.legend.labels.font = {
                size: 12,
                family: 'Arial'
            };
            
            // Atualizar texto central (beforeDraw)
            chartImpactoRoscInstance.options.plugins.beforeDraw = function(chart) {
                const ctx = chart.ctx;
                const centerX = chart.chartArea.left + (chart.chartArea.right - chart.chartArea.left) / 2;
                const centerY = chart.chartArea.top + (chart.chartArea.bottom - chart.chartArea.top) / 2;
                
                ctx.save();
                
                // Se há estado selecionado, mostrar informações dele
                if (uf) {
                    const index = estadosRef.indexOf(uf);
                    if (index !== -1) {
                        const quantidade = quantidadesRef[index];
                        const percentual = percentuaisRef[index];
                        
                        ctx.font = 'bold 18px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                        ctx.fillStyle = '#1e40af';
                        ctx.fillText(uf, centerX, centerY - 30);
                
                    ctx.font = '14px Arial';
                        ctx.fillStyle = '#333';
                        ctx.fillText(`${formatNumber(quantidade)} casos`, centerX, centerY - 10);
                        ctx.fillText(`${percentual.toFixed(1)}%`, centerX, centerY + 10);
                    }
                } else {
                    // Mostrar total geral
                    const totalCasos = quantidadesRef.reduce((a, b) => a + b, 0);
                    ctx.font = 'bold 16px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#333';
                    ctx.fillText('Total de Casos', centerX, centerY - 10);
                    ctx.font = '14px Arial';
                    ctx.fillText(formatNumber(totalCasos), centerX, centerY + 10);
                }
                
                ctx.restore();
            };
            
            // Atualizar gráfico
            chartImpactoRoscInstance.update('active');
            
            // Chamar função de destaque se há estado selecionado
            if (uf) {
                setTimeout(() => {
                    highlightSliceInRoscChart(uf);
                }, 100);
            } else {
                // Resetar cores originais se não há filtro
                const dataset = chartImpactoRoscInstance.data.datasets[0];
                if (dataset.originalColors) {
                    dataset.backgroundColor = [...dataset.originalColors];
                    dataset.borderColor = [...dataset.originalBorderColors];
                    dataset.borderWidth = [...dataset.originalBorderWidths];
                    chartImpactoRoscInstance.update('active');
                }
            }
            
            // Atualizar gráfico com animação suave
            chartImpactoRoscInstance.update('active');
            console.log('updateDistribuicaoUFPorEstado: Gráfico atualizado com sucesso');
        } else {
            console.warn('updateDistribuicaoUFPorEstado: Nenhum dado disponível');
        }
    } catch (error) {
        console.error('updateDistribuicaoUFPorEstado: Erro ao atualizar gráfico:', error);
    }
}

/**
 * Destaca a fatia do gráfico de rosca correspondente ao UF selecionado
 * @param {string} uf - Sigla do estado (ex: 'SP', 'PA')
 */
function highlightSliceInRoscChart(uf) {
    if (!chartImpactoRoscInstance || !uf) {
        console.warn('highlightSliceInRoscChart: Gráfico ou UF não disponível');
        return;
    }
    
    try {
        const dataset = chartImpactoRoscInstance.data.datasets[0];
        const labels = chartImpactoRoscInstance.data.labels || [];
        
        // Encontrar índice do UF no gráfico
        const ufIndex = labels.findIndex(label => label === uf);
        
        if (ufIndex === -1) {
            console.warn(`highlightSliceInRoscChart: UF ${uf} não encontrado no gráfico`);
            return;
        }
        
        // Salvar cores originais se ainda não foram salvas
        if (!dataset.originalColors) {
            dataset.originalColors = [...dataset.backgroundColor];
            dataset.originalBorderColors = [...dataset.borderColor];
            dataset.originalBorderWidths = Array.isArray(dataset.borderWidth) 
                ? [...dataset.borderWidth] 
                : Array(labels.length).fill(dataset.borderWidth || 1);
        }
        
        // Criar novas cores: destacar o UF selecionado, escurecer os outros
        const newColors = dataset.originalColors.map((color, index) => {
            if (index === ufIndex) {
                // Destacar: aumentar opacidade e usar cor mais vibrante
                return getColor(uf, 'uf', 1.0);
            } else {
                // Escurecer outros: reduzir opacidade
                return getColor(labels[index], 'uf', 0.3);
            }
        });
        
        const newBorderColors = dataset.originalBorderColors.map((color, index) => {
            if (index === ufIndex) {
                return getBorderColor(uf, 'uf');
            } else {
                return getColor(labels[index], 'uf', 0.3);
            }
        });
        
        const newBorderWidths = dataset.originalBorderWidths.map((width, index) => {
            if (index === ufIndex) {
                return 4; // Borda mais grossa para destacar
            } else {
                return 1;
            }
        });
        
        // Aplicar novas cores
        dataset.backgroundColor = newColors;
        dataset.borderColor = newBorderColors;
        dataset.borderWidth = newBorderWidths;
        
        // Atualizar gráfico
        chartImpactoRoscInstance.update('active');
        
        console.log(`highlightSliceInRoscChart: Fatia do UF ${uf} destacada com sucesso`);
    } catch (error) {
        console.error('highlightSliceInRoscChart: Erro ao destacar fatia:', error);
    }
}

async function renderSlideImpacto(filtro = null, estadoFiltro = null) {
    console.log('renderSlideImpacto: Iniciando renderização', { filtro, estadoFiltro });
    
    // Verificar Chart.js
    if (typeof Chart === 'undefined') {
        console.error('renderSlideImpacto: Chart.js não está disponível');
        showChartError('chart-impacto-rosca', 'Biblioteca de gráficos não carregada');
        showChartError('chart-impacto-base', 'Biblioteca de gráficos não carregada');
        return;
    }
    
    // Verificar elementos canvas
    const canvasRosc = document.getElementById('chart-impacto-rosca');
    const canvasBase = document.getElementById('chart-impacto-base');
    
    if (!canvasRosc) {
        console.error('renderSlideImpacto: Canvas chart-impacto-rosca não encontrado');
    }
    if (!canvasBase) {
        console.error('renderSlideImpacto: Canvas chart-impacto-base não encontrado');
    }
    
    if (!canvasRosc && !canvasBase) {
        console.error('renderSlideImpacto: Nenhum canvas encontrado');
        return;
    }
    
    try {
        console.log('renderSlideImpacto: api disponível?', typeof api !== 'undefined');
        console.log('renderSlideImpacto: getAnaliseCorrelacao disponível?', typeof api?.getAnaliseCorrelacao === 'function');
        
        // Buscar dados com filtro de objeto e estado
        let data;
        if (estadoFiltro) {
            // Buscar todos os dados primeiro
            data = await api.getAnaliseCorrelacao(filtro);
            // Filtrar distribuição por UF para mostrar apenas o estado selecionado
            if (data && data.distribuicao_uf) {
                const distribuicaoFiltrada = data.distribuicao_uf.filter(d => d.uf === estadoFiltro);
                if (distribuicaoFiltrada.length > 0) {
                    data.distribuicao_uf = distribuicaoFiltrada;
                }
            }
        } else {
            data = await api.getAnaliseCorrelacao(filtro);
        }
        console.log('renderSlideImpacto: Dados recebidos:', data);
        console.log('renderSlideImpacto: Keys dos dados:', Object.keys(data || {}));
        console.log('renderSlideImpacto: mapa:', data?.mapa);
        console.log('renderSlideImpacto: mapa.estados:', data?.mapa?.estados);
        console.log('renderSlideImpacto: distribuicao_uf:', data?.distribuicao_uf);
        console.log('renderSlideImpacto: base:', data?.base);
        
        slideImpactoFiltro = filtro;

        // Gráfico de Rosca: Distribuição percentual por UF
        const distribuicao = data.distribuicao_uf || [];
        console.log('renderSlideImpacto: Distribuição UF:', distribuicao.length, 'itens');
        console.log('renderSlideImpacto: Primeiro item distribuição:', distribuicao[0]);
        
        // Armazenar dados originais se não houver filtro de estado
        if (!estadoFiltro && !dadosDistribuicaoUFOriginais) {
            dadosDistribuicaoUFOriginais = [...distribuicao];
        }
        
        if (distribuicao.length > 0) {
            const estados = distribuicao.map(d => d.uf);
            const quantidades = distribuicao.map(d => d.quantidade);
            const prejuizosTotalMil = distribuicao.map(d => d.prejuizo_total_mil || d.impacto_mil);
            
            // Calcular percentuais baseados em quantidade de casos (não prejuízo)
            const totalCasos = distribuicao.reduce((sum, d) => sum + (d.quantidade || 0), 0);
            const percentuais = distribuicao.map(d => {
                const qtd = d.quantidade || 0;
                return totalCasos > 0 ? (qtd / totalCasos * 100) : 0;
            });
            
            console.log('renderSlideImpacto: Estados:', estados);
            console.log('renderSlideImpacto: Percentuais (baseados em quantidade de casos):', percentuais);
            console.log('renderSlideImpacto: Prejuízos totais (R$ Mil):', prejuizosTotalMil);
            
            // Função para gerar paleta de cores harmoniosa (azul/laranja)
            const generateColorPalette = (numEstados) => {
                const colors = [];
                // Cores azuis principais (casos sempre azuis)
                const blueBase = [
                    'rgba(37, 99, 235, 0.85)',   // Azul principal (blue-600)
                    'rgba(59, 130, 246, 0.85)',  // Azul médio (blue-500)
                    'rgba(96, 165, 250, 0.85)',  // Azul claro (blue-400)
                    'rgba(29, 78, 216, 0.85)',   // Azul escuro (blue-700)
                    'rgba(30, 64, 175, 0.85)',   // Azul mais escuro (blue-800)
                    'rgba(147, 197, 253, 0.85)', // Azul muito claro (blue-300)
                ];
                
                // Tons complementares (laranja/amarelo para contraste)
                const accentColors = [
                    'rgba(249, 115, 22, 0.85)',  // Laranja (orange-500)
                    'rgba(251, 146, 60, 0.85)', // Laranja claro (orange-400)
                    'rgba(234, 88, 12, 0.85)',  // Laranja escuro (orange-600)
                    'rgba(253, 186, 116, 0.85)', // Laranja muito claro (orange-300)
                ];
                
                // Gerar gradiente suave
                for (let i = 0; i < numEstados; i++) {
                    if (i < blueBase.length) {
                        colors.push(blueBase[i]);
                    } else {
                        // Alternar entre azuis e acentos para estados adicionais
                        const accentIndex = (i - blueBase.length) % accentColors.length;
                        colors.push(accentColors[accentIndex]);
                    }
                }
                
                return colors;
            };
            
            // Usar sistema global de cores para garantir consistência visual
            const colors = estados.map((estado) => {
                // Se há filtro de estado e este é o estado selecionado, destacar
                if (estadoFiltro && estado === estadoFiltro) {
                    return getColor(estado, 'uf', 1.0); // Mais opaco para destacar
                }
                return getColor(estado, 'uf', 0.85);
            });
            
            const borderColors = estados.map((estado) => {
                // Se há filtro de estado e este é o estado selecionado, destacar com borda mais grossa
                if (estadoFiltro && estado === estadoFiltro) {
                    return getBorderColor(estado, 'uf');
                }
                return getBorderColor(estado, 'uf');
            });
            
            const borderWidths = estados.map((estado) => {
                // Se há filtro de estado e este é o estado selecionado, borda mais grossa
                if (estadoFiltro && estado === estadoFiltro) {
                    return 4;
                }
                return 2;
            });
            
            console.log('renderSlideImpacto: Criando gráfico de rosca com', estados.length, 'estados');
            
            // Verificar se o canvas existe antes de criar o gráfico
            const canvasRosc = document.getElementById('chart-impacto-rosca');
            if (!canvasRosc) {
                console.error('renderSlideImpacto: Canvas chart-impacto-rosca não encontrado!');
                return;
            }
            console.log('renderSlideImpacto: Canvas rosca encontrado, dimensões:', {
                width: canvasRosc.width,
                height: canvasRosc.height,
                clientWidth: canvasRosc.clientWidth,
                clientHeight: canvasRosc.clientHeight,
                offsetWidth: canvasRosc.offsetWidth,
                offsetHeight: canvasRosc.offsetHeight
            });
            
            // Armazenar referências para uso nos plugins
            const prejuizosTotalMilRef = prejuizosTotalMil;
            const estadosRef = estados;
            const percentuaisRef = percentuais;
            const quantidadesRef = quantidades;
            
            chartImpactoRoscInstance = createChart('chart-impacto-rosca', {
                type: 'doughnut',
                data: {
                    labels: estados,
                    datasets: [{
                        data: percentuais,
                        backgroundColor: colors,
                        borderColor: borderColors,
                        borderWidth: borderWidths
                    }]
                },
                options: {
                    ...defaultOptions,
                    responsive: true,
                    maintainAspectRatio: true,
                    cutout: '60%', // Aumentar espaço central para melhor visualização
                    spacing: 2, // Espaçamento entre fatias para melhor separação
                    rotation: -90, // Começar do topo
                    animation: {
                        animateRotate: true,
                        animateScale: true,
                        duration: 800
                    },
                    elements: {
                        arc: {
                            borderAlign: 'center', // Bordas mais nítidas
                            borderJoinStyle: 'round'
                        }
                    },
                    plugins: {
                        tooltip: {
                            enabled: true,
                            callbacks: {
                                title: function(context) {
                                    return `Estado: ${context[0].label}`;
                                },
                                label: function(context) {
                                    const index = context.dataIndex;
                                    const uf = estadosRef[index];
                                    const percentual = percentuaisRef[index];
                                    const quantidade = quantidadesRef[index];
                                    const prejuizoTotalMil = prejuizosTotalMilRef[index];
                                    return [
                                        `Quantidade: ${formatNumber(quantidade)} casos`,
                                        `Percentual: ${percentual.toFixed(2)}%`,
                                        `Erro Sistêmico: ${formatCurrencyMil(prejuizoTotalMil * 1000)}`
                                    ];
                                },
                                footer: function(tooltipItems) {
                                    const totalCasos = quantidadesRef.reduce((a, b) => a + b, 0);
                                    return `Total: ${formatNumber(totalCasos)} casos`;
                                }
                            },
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: 'rgba(37, 99, 235, 0.8)',
                            borderWidth: 2,
                            padding: 12,
                            cornerRadius: 8
                        },
                        legend: {
                            display: true,
                            position: 'right',
                            labels: {
                                generateLabels: function(chart) {
                                    const data = chart.data;
                                    if (data.labels.length && data.datasets.length) {
                                        return data.labels.map((label, i) => {
                                            const dataset = data.datasets[0];
                                            const percentual = dataset.data[i];
                                            const quantidade = quantidadesRef[i];
                                            return {
                                                text: `${label}: ${formatNumber(quantidade)} casos (${percentual.toFixed(1)}%)`,
                                                fillStyle: dataset.backgroundColor[i],
                                                strokeStyle: dataset.borderColor[i],
                                                lineWidth: dataset.borderWidth[i] || 2,
                                                hidden: false,
                                                index: i,
                                                fontColor: '#333',
                                                fontSize: 12
                                            };
                                        });
                                    }
                                    return [];
                                },
                                usePointStyle: true,
                                pointStyle: 'rect',
                                padding: 15,
                                font: {
                                    size: 12,
                                    family: 'Arial'
                                }
                            }
                        },
                        beforeDraw: function(chart) {
                            const ctx = chart.ctx;
                            const centerX = chart.chartArea.left + (chart.chartArea.right - chart.chartArea.left) / 2;
                            const centerY = chart.chartArea.top + (chart.chartArea.bottom - chart.chartArea.top) / 2;
                            
                            ctx.save();
                            
                            // Se há estado selecionado, mostrar informações dele
                            if (estadoFiltro) {
                                const index = estadosRef.indexOf(estadoFiltro);
                                if (index !== -1) {
                                    const quantidade = quantidadesRef[index];
                                    const percentual = percentuaisRef[index];
                                    
                                    ctx.font = 'bold 18px Arial';
                                    ctx.textAlign = 'center';
                                    ctx.textBaseline = 'middle';
                                    ctx.fillStyle = '#1e40af';
                                    ctx.fillText(estadoFiltro, centerX, centerY - 30);
                                    
                                    ctx.font = '14px Arial';
                                    ctx.fillStyle = '#333';
                                    ctx.fillText(`${formatNumber(quantidade)} casos`, centerX, centerY - 10);
                                    ctx.fillText(`${percentual.toFixed(1)}%`, centerX, centerY + 10);
                                }
                            } else {
                                // Mostrar total geral
                                const totalCasos = quantidadesRef.reduce((a, b) => a + b, 0);
                            ctx.font = 'bold 16px Arial';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillStyle = '#333';
                                ctx.fillText('Total de Casos', centerX, centerY - 10);
                                ctx.font = '14px Arial';
                                ctx.fillText(formatNumber(totalCasos), centerX, centerY + 10);
                            }
                            
                            ctx.restore();
                        }
                    }
                }
            });
            console.log('renderSlideImpacto: Gráfico de rosca criado:', chartImpactoRoscInstance ? 'OK' : 'FALHOU');
            
            // Forçar update do gráfico após um pequeno delay para garantir que o DOM está pronto
            if (chartImpactoRoscInstance) {
                setTimeout(() => {
                    try {
                        chartImpactoRoscInstance.update('none');
                        console.log('renderSlideImpacto: Gráfico de rosca atualizado');
                        
                        // Garantir que o container esteja visível (remover opacity: 0 se houver)
                        const container = canvasRosc.closest('.card-impacto');
                        if (container) {
                            container.style.opacity = '1';
                            container.style.visibility = 'visible';
                            container.classList.add('animate-in');
                        }
                    } catch (e) {
                        console.error('renderSlideImpacto: Erro ao atualizar gráfico de rosca:', e);
                    }
                }, 100);
            }
        } else {
            console.warn('renderSlideImpacto: Nenhum dado de distribuição UF encontrado');
        }

        // Gráfico Combo (Base): Quantidade de Casos (barras) + Média de Prejuízo (linha) POR UF
        const b = data.base || {};
        const lbls = b.labels || []; // UFs
        const quantidades = b.quantidade || [];
        const mediasImpactoMil = b.media_impacto_mil || [];
        console.log('renderSlideImpacto: Base - labels:', lbls.length, 'quantidade:', quantidades.length, 'media_impacto_mil:', mediasImpactoMil.length);
        
        if (lbls.length === 0) {
            console.warn('renderSlideImpacto: Nenhum dado de base encontrado, criando gráfico vazio');
            // Criar gráfico vazio com mensagem
            const chartBase = createChart('chart-impacto-base', {
                type: 'bar',
                data: {
                    labels: ['Sem dados'],
                    datasets: [{
                        label: 'Quantidade de Casos',
                        data: [0],
                        backgroundColor: 'rgba(200, 200, 200, 0.5)',
                        borderColor: 'rgb(200, 200, 200)',
                        borderWidth: 1
                    }]
                },
                options: {
                    ...defaultOptions,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Nenhum dado disponível'
                        }
                    }
                }
            });
            console.log('renderSlideImpacto: Gráfico base vazio criado:', chartBase ? 'OK' : 'FALHOU');
        } else {
            // Validar que os arrays têm o mesmo tamanho
            const minLength = Math.min(lbls.length, quantidades.length, mediasImpactoMil.length);
            const labelsValid = lbls.slice(0, minLength);
            const quantidadesValid = quantidades.slice(0, minLength);
            const mediasValid = mediasImpactoMil.slice(0, minLength);
            
            console.log('renderSlideImpacto: Gráfico Base - Dados validados:', {
                labelsCount: labelsValid.length,
                quantidadesCount: quantidadesValid.length,
                mediasCount: mediasValid.length,
                sampleLabels: labelsValid.slice(0, 5),
                sampleQuantidades: quantidadesValid.slice(0, 5),
                sampleMedias: mediasValid.slice(0, 5)
            });
            
            // Usar sistema global de cores para barras (cores por UF)
            const barColors = labelsValid.map(uf => getColor(uf, 'uf', 0.8));
            const barBorderColors = labelsValid.map(uf => getBorderColor(uf, 'uf'));
            
            const chartBase = createChart('chart-impacto-base', {
                type: 'bar',
                data: {
                    labels: labelsValid, // UFs no eixo X (barras verticais)
                    datasets: [
                        {
                            label: 'Quantidade de Casos',
                            data: quantidadesValid, // Quantidade de casos por UF
                            backgroundColor: barColors, // Cores consistentes por UF
                            borderColor: barBorderColors,
                            borderWidth: 2,
                            yAxisID: 'y',
                            order: 2 // Atrás da linha
                        },
                        {
                            label: 'Média de Prejuízo (R$ Mil)',
                            data: mediasValid, // Média de prejuízo por UF
                            type: 'line',
                            borderColor: CONST_COLORS.semantic.negativo, // Vermelho para prejuízo
                            backgroundColor: hexToRgba(CONST_COLORS.semantic.negativo, 0.1),
                            tension: 0.4,
                            fill: false,
                            yAxisID: 'y1',
                            pointRadius: 5,
                            pointHoverRadius: 7,
                            pointBackgroundColor: CONST_COLORS.semantic.negativo,
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            order: 1 // À frente das barras
                        }
                    ]
                },
                options: {
                    ...defaultOptions,
                    responsive: true,
                    maintainAspectRatio: true,
                    // Barras verticais: UF no eixo X, quantidade no eixo Y
                    scales: {
                        x: {
                            position: 'bottom',
                            title: {
                                display: true,
                                text: 'UF (Estados)'
                            }
                        },
                        y: { 
                            beginAtZero: true, 
                            position: 'left',
                            title: {
                                display: true,
                                text: 'Quantidade de Casos'
                            },
                            ticks: {
                                callback: function(value) {
                                    return formatNumber(value);
                                }
                            }
                        },
                        y1: {
                            beginAtZero: true,
                            position: 'right',
                            grid: { drawOnChartArea: false },
                            title: {
                                display: true,
                                text: 'Média de Prejuízo (R$ Mil)'
                            },
                            ticks: {
                                callback: function(value) {
                                    return formatCurrencyMil(value * 1000);
                                }
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const datasetLabel = context.dataset.label || '';
                                    const index = context.dataIndex;
                                    const uf = labelsValid[index];
                                    
                                    if (context.dataset.type === 'line') {
                                        // Linha: Média de Prejuízo (usa y para barras verticais)
                                        const value = formatCurrencyMil(context.parsed.y * 1000);
                                        return `${datasetLabel}: ${value}`;
                                    } else {
                                        // Barra vertical: Quantidade de Casos (usa y)
                                        const value = formatNumber(context.parsed.y);
                                        return `${datasetLabel}: ${value} casos`;
                                    }
                                },
                                title: function(context) {
                                    const index = context[0].dataIndex;
                                    return `UF: ${labelsValid[index]}`;
                                },
                                afterLabel: function(context) {
                                    const index = context.dataIndex;
                                    const uf = labelsValid[index];
                                    const quantidade = quantidadesValid[index];
                                    const mediaMil = mediasValid[index];
                                    return [
                                        `UF: ${uf}`,
                                        `Quantidade: ${formatNumber(quantidade)} casos`,
                                        `Média Prejuízo: ${formatCurrencyMil(mediaMil * 1000)}`
                                    ];
                                }
                            }
                        },
                        legend: {
                            display: true,
                            position: 'top'
                        }
                    }
                }
            });
            console.log('renderSlideImpacto: Gráfico base criado:', chartBase ? 'OK' : 'FALHOU');
            
            // Forçar update do gráfico após um pequeno delay para garantir que o DOM está pronto
            if (chartBase) {
                setTimeout(() => {
                    try {
                        chartBase.update('none');
                        console.log('renderSlideImpacto: Gráfico base atualizado');
                        
                        // Garantir que o container esteja visível
                        const canvasBaseEl = document.getElementById('chart-impacto-base');
                        if (canvasBaseEl) {
                            const container = canvasBaseEl.closest('.card-impacto.card-base');
                        if (container) {
                            container.style.opacity = '1';
                            container.style.visibility = 'visible';
                            container.classList.add('animate-in');
                                console.log('renderSlideImpacto: Container card-impacto card-base animate-in aplicado');
                            }
                        }
                    } catch (e) {
                        console.error('renderSlideImpacto: Erro ao atualizar gráfico base:', e);
                    }
                }, 100);
            }
        }

    // Mapa de Calor/Bolhas: círculos coloridos cujo tamanho indica a magnitude do prejuízo
        if (window.renderMapaAnaliseImpacto) {
            console.log('renderSlideImpacto: Renderizando mapa com', data.mapa?.estados?.length || 0, 'estados');
            window.renderMapaAnaliseImpacto(data.mapa?.estados || []);
        } else {
            console.warn('renderSlideImpacto: renderMapaAnaliseImpacto não está disponível');
        }
        
        console.log('renderSlideImpacto: Renderização concluída');
    } catch (error) {
        console.error('renderSlideImpacto: Erro ao renderizar:', error);
        console.error('renderSlideImpacto: Stack:', error.stack);
        showChartError('chart-impacto-rosca', 'Erro ao carregar gráfico');
        showChartError('chart-impacto-base', 'Erro ao carregar gráfico');
    }
}

// Função auxiliar para aguardar Chart.js estar carregado
async function waitForChartJS(maxWait = 5000) {
    if (typeof Chart !== 'undefined') {
        return true;
    }
    
    const startTime = Date.now();
    while (Date.now() - startTime < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (typeof Chart !== 'undefined') {
            return true;
        }
    }
    return false;
}

// Função auxiliar para exibir erro no canvas
function showChartError(canvasId, message) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Garantir dimensões mínimas
    if (canvas.width === 0 || canvas.height === 0) {
        canvas.width = 400;
        canvas.height = 300;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#666';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
    ctx.fillText('Verifique o console para mais detalhes', canvas.width / 2, canvas.height / 2 + 20);
}

// Gráfico de Ações Ganhas/Perdidas
async function renderAcoesGanhasPerdidasChart() {
    const canvasId = 'chart-acoes-ganhas-perdidas';
    
    try {
        console.log('renderAcoesGanhasPerdidasChart: Iniciando...');
        
        // Aguardar Chart.js estar carregado
        const chartJSReady = await waitForChartJS();
        if (!chartJSReady) {
            console.error('renderAcoesGanhasPerdidasChart: Chart.js não está carregado após timeout!');
            showChartError(canvasId, 'Erro: Chart.js não carregado');
            return;
        }
        
        console.log('renderAcoesGanhasPerdidasChart: Chart.js carregado, buscando dados...');
        
        // Buscar dados da API
        let data;
        try {
            data = await api.getAcoesGanhasPerdidas();
            console.log('renderAcoesGanhasPerdidasChart: Dados recebidos:', data);
        } catch (apiError) {
            console.error('renderAcoesGanhasPerdidasChart: Erro ao buscar dados da API:', apiError);
            showChartError(canvasId, `Erro ao buscar dados: ${apiError.message || 'Erro desconhecido'}`);
            return;
        }
        
        // Validação robusta de estrutura de dados
        if (!data || typeof data !== 'object') {
            console.error('renderAcoesGanhasPerdidasChart: Dados inválidos (não é objeto):', data);
            showChartError(canvasId, 'Erro: Dados inválidos da API');
            return;
        }
        
        // Validar estrutura esperada
        if (!data.ganhas || typeof data.ganhas !== 'object') {
            data.ganhas = { quantidade: 0, percentual: 0.0 };
        }
        if (!data.perdidas || typeof data.perdidas !== 'object') {
            data.perdidas = { quantidade: 0, percentual: 0.0 };
        }
        if (!data.acordo_antes_sentenca || typeof data.acordo_antes_sentenca !== 'object') {
            data.acordo_antes_sentenca = { quantidade: 0, percentual: 0.0, economia_total: 0.0 };
        }
        
        // Atualizar KPIs
        const kpiGanhas = document.getElementById('kpi-acoes-ganhas');
        const kpiGanhasPct = document.getElementById('kpi-acoes-ganhas-pct');
        const kpiPerdidas = document.getElementById('kpi-acoes-perdidas');
        const kpiPerdidasPct = document.getElementById('kpi-acoes-perdidas-pct');
        const kpiAcordoAntes = document.getElementById('kpi-acordo-antes');
        const kpiEconomia = document.getElementById('kpi-economia-acordo');
        
        if (kpiGanhas) kpiGanhas.textContent = formatNumber(data.ganhas?.quantidade || 0);
        if (kpiGanhasPct) kpiGanhasPct.textContent = `${(data.ganhas?.percentual || 0).toFixed(1)}%`;
        if (kpiPerdidas) kpiPerdidas.textContent = formatNumber(data.perdidas?.quantidade || 0);
        if (kpiPerdidasPct) kpiPerdidasPct.textContent = `${(data.perdidas?.percentual || 0).toFixed(1)}%`;
        if (kpiAcordoAntes) kpiAcordoAntes.textContent = formatNumber(data.acordo_antes_sentenca?.quantidade || 0);
        if (kpiEconomia) kpiEconomia.textContent = `Economia: ${formatCurrency(data.acordo_antes_sentenca?.economia_total || 0)}`;
        
        // Verificar se há dados para exibir
        const qtdGanhas = Number(data.ganhas?.quantidade) || 0;
        const qtdPerdidas = Number(data.perdidas?.quantidade) || 0;
        
        if (qtdGanhas === 0 && qtdPerdidas === 0) {
            console.warn('renderAcoesGanhasPerdidasChart: Nenhum dado para exibir (ambos valores são zero)');
            showChartError(canvasId, 'Nenhum dado disponível para exibir');
            return;
        }
        
        console.log('renderAcoesGanhasPerdidasChart: Criando gráfico com dados:', { qtdGanhas, qtdPerdidas });
        
        // Gráfico de pizza: Ganhas vs Perdidas
        const chart = await createChartWithRetry(canvasId, {
            type: 'pie',
            data: {
                labels: ['Ações Ganhas', 'Ações Perdidas'],
                datasets: [{
                    data: [
                        data.ganhas?.quantidade || 0,
                        data.perdidas?.quantidade || 0
                    ],
                    backgroundColor: [
                        'rgba(34, 197, 94, 0.8)',  // Verde para ganhas
                        'rgba(239, 68, 68, 0.8)'   // Vermelho para perdidas
                    ],
                    borderColor: [
                        'rgb(34, 197, 94)',
                        'rgb(239, 68, 68)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            font: {
                                size: 14
                            },
                            generateLabels: function(chart) {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    const dataset = data.datasets[0];
                                    const total = dataset.data.reduce((a, b) => a + b, 0);
                                    return data.labels.map((label, i) => {
                                        const value = dataset.data[i];
                                        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                        return {
                                            text: `${label}: ${formatNumber(value)} (${percentage}%)`,
                                            fillStyle: dataset.backgroundColor[i],
                                            strokeStyle: dataset.borderColor[i],
                                            lineWidth: dataset.borderWidth,
                                            hidden: false,
                                            index: i
                                        };
                                    });
                                }
                                return [];
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${label}: ${formatNumber(value)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
        
        if (!chart) {
            console.error('renderAcoesGanhasPerdidasChart: Falha ao criar gráfico após retry');
            showChartError(canvasId, 'Erro ao criar gráfico. Tente recarregar a página.');
        } else {
            console.log('renderAcoesGanhasPerdidasChart: Gráfico criado com sucesso');
        }
    } catch (error) {
        console.error('renderAcoesGanhasPerdidasChart: Erro inesperado:', error);
        showChartError(canvasId, `Erro: ${error.message || 'Erro desconhecido'}`);
    }
}

// Gráfico de Economia do Acordo Antes da Sentença
async function renderAcordoAntesSentencaChart() {
    const canvasId = 'chart-acordo-antes-sentenca';
    
    try {
        console.log('renderAcordoAntesSentencaChart: Iniciando...');
        
        // Aguardar Chart.js estar carregado
        const chartJSReady = await waitForChartJS();
        if (!chartJSReady) {
            console.error('renderAcordoAntesSentencaChart: Chart.js não está carregado após timeout!');
            showChartError(canvasId, 'Erro: Chart.js não carregado');
            return;
        }
        
        console.log('renderAcordoAntesSentencaChart: Chart.js carregado, buscando dados...');
        
        // Buscar dados da API
        let data;
        try {
            data = await api.getAcoesGanhasPerdidas();
            console.log('renderAcordoAntesSentencaChart: Dados recebidos:', data);
        } catch (apiError) {
            console.error('renderAcordoAntesSentencaChart: Erro ao buscar dados da API:', apiError);
            showChartError(canvasId, `Erro ao buscar dados: ${apiError.message || 'Erro desconhecido'}`);
            return;
        }
        
        // Validação robusta de estrutura de dados
        if (!data || typeof data !== 'object') {
            console.error('renderAcordoAntesSentencaChart: Dados inválidos (não é objeto):', data);
            showChartError(canvasId, 'Erro: Dados inválidos da API');
            return;
        }
        
        if (!data.acordo_antes_sentenca || typeof data.acordo_antes_sentenca !== 'object') {
            console.warn('renderAcordoAntesSentencaChart: acordo_antes_sentenca não encontrado ou inválido');
            data.acordo_antes_sentenca = {
                quantidade: 0,
                percentual: 0.0,
                valor_pretendido_total: 0.0,
                valor_acordo_total: 0.0,
                economia_total: 0.0
            };
        }
        
        const acordoData = data.acordo_antes_sentenca;
        
        // Verificar se há dados para exibir
        const valorPretendido = Number(acordoData.valor_pretendido_total) || 0;
        const valorAcordo = Number(acordoData.valor_acordo_total) || 0;
        const economia = Number(acordoData.economia_total) || 0;
        
        if (valorPretendido === 0 && valorAcordo === 0 && economia === 0) {
            console.warn('renderAcordoAntesSentencaChart: Nenhum dado para exibir (todos valores são zero)');
            showChartError(canvasId, 'Nenhum dado disponível para exibir');
            return;
        }
        
        console.log('renderAcordoAntesSentencaChart: Criando gráfico com dados:', { valorPretendido, valorAcordo, economia });
        
        // Gráfico de barras comparando valor pretendido vs valor do acordo
        const chart = await createChartWithRetry(canvasId, {
            type: 'bar',
            data: {
                labels: ['Valor Pretendido', 'Valor do Acordo', 'Economia'],
                datasets: [{
                    label: 'Valor (R$)',
                    data: [
                        acordoData.valor_pretendido_total || 0,
                        acordoData.valor_acordo_total || 0,
                        acordoData.economia_total || 0
                    ],
                    backgroundColor: [
                        'rgba(239, 68, 68, 0.8)',   // Vermelho para valor pretendido
                        'rgba(59, 130, 246, 0.8)',  // Azul para valor do acordo
                        'rgba(34, 197, 94, 0.8)'    // Verde para economia
                    ],
                    borderColor: [
                        'rgb(239, 68, 68)',
                        'rgb(59, 130, 246)',
                        'rgb(34, 197, 94)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Economia com Acordo Antes da Sentença',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value);
                            }
                        }
                    }
                }
            }
        });
        
        if (!chart) {
            console.error('renderAcordoAntesSentencaChart: Falha ao criar gráfico após retry');
            showChartError(canvasId, 'Erro ao criar gráfico. Tente recarregar a página.');
        } else {
            console.log('renderAcordoAntesSentencaChart: Gráfico criado com sucesso');
        }
    } catch (error) {
        console.error('renderAcordoAntesSentencaChart: Erro inesperado:', error);
        showChartError(canvasId, `Erro: ${error.message || 'Erro desconhecido'}`);
    }
}

// Exportar funções
window.chartFunctions = {
    renderSaldoChart,
    renderEvolucaoChart,
    renderTempoMedioChart,
    renderCasosImpactoChart,
    renderSLAAreaChart,
    renderSolicitacoesPrazoChart,
    renderSolicitacoesPrazoAreaChart,
    renderVolumeCustoChart,
    renderReiteracoesChart,
    destroyChart: (canvasId) => {
        if (chartInstances[canvasId]) {
            try {
                chartInstances[canvasId].destroy();
            } catch (e) {
                // Ignorar erros
            }
            delete chartInstances[canvasId];
        }
        if (resizeObservers[canvasId]) {
            resizeObservers[canvasId].disconnect();
            delete resizeObservers[canvasId];
        }
        delete chartCreationLocks[canvasId];
    },
    renderDistribuicaoUFChart,
    renderParetoChart,
    renderParetoImpactoChart,
    renderSentencasChart,
    renderSentencasPorAreaChart,
    renderReincidenciaChart,
    renderTiposAcoesChart,
    renderErroSistemicoChart,
    renderObjetoEstadoChart,
    renderPrejuizoErroCriticoChart,
    renderTabelaSaldo,
    renderSlideImpacto,
    highlightSliceInRoscChart,
    renderAcoesGanhasPerdidasChart,
    renderAcordoAntesSentencaChart,
    updateDistribuicaoUFPorEstado,
    updateDashboardByUF,
    clearAllCharts,
    createChart,
    createChartWithRetry,
    waitForElementVisible,
    isElementVisible,
    showChartError,
    getColor,
    getBorderColor
};
window.updateSlideImpactoFiltro = updateSlideImpactoFiltro;