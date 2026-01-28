/**
 * API Client - Comunicação com Backend
 */

// Detectar URL da API dinamicamente
const API_BASE_URL = (() => {
    // 1. Verificar se está definido globalmente (via script no HTML)
    if (window.API_BASE_URL) {
        return window.API_BASE_URL;
    }
    // 2. Verificar variável de ambiente (Vercel)
    if (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) {
        return process.env.REACT_APP_API_URL;
    }
    // 3. Fallback para desenvolvimento local
    return 'http://localhost:8001/api';
})();

// Obter API Key para autenticação
const API_KEY = (() => {
    // 1. Verificar se está definido globalmente (via script no HTML)
    if (window.API_KEY) {
        return window.API_KEY;
    }
    // 2. Verificar variável de ambiente (Vercel)
    if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_KEY) {
        return process.env.NEXT_PUBLIC_API_KEY;
    }
    // 3. Fallback: tentar obter de variável de ambiente do Vercel
    // No Vercel, variáveis de ambiente são injetadas no build
    // Para produção, configure NEXT_PUBLIC_API_KEY no Vercel
    return null; // Sem API Key em desenvolvimento local
})();

// Estado global para filtro de estado
let estadoSelecionado = null;

class APIClient {
    async get(url) {
        try {
            // Adicionar parâmetro estado se houver filtro ativo
            const separator = url.includes('?') ? '&' : '?';
            const estadoParam = estadoSelecionado ? `${separator}estado=${encodeURIComponent(estadoSelecionado)}` : '';
            const fullUrl = `${API_BASE_URL}${url}${estadoParam}`;
            
            console.log(`APIClient.get: Buscando ${fullUrl}`);
            
            // Preparar headers
            const headers = {
                'Content-Type': 'application/json',
            };
            
            // Adicionar API Key se disponível
            if (API_KEY) {
                headers['X-API-Key'] = API_KEY;
            }
            
            const response = await fetch(fullUrl, {
                method: 'GET',
                headers: headers,
            });
            
            // Verificar status HTTP
            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Erro desconhecido');
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                
                // Tentar parsear como JSON para obter mensagem de erro mais detalhada
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.detail) {
                        errorMessage = errorJson.detail;
                    }
                } catch (e) {
                    // Se não for JSON, usar o texto como está
                    if (errorText && errorText.length < 200) {
                        errorMessage = errorText;
                    }
                }
                
                const error = new Error(errorMessage);
                error.status = response.status;
                error.statusText = response.statusText;
                throw error;
            }
            
            // Verificar se a resposta tem conteúdo
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.warn(`APIClient.get: Resposta não é JSON para ${url}, content-type: ${contentType}`);
            }
            
            // Parsear JSON
            let data;
            try {
                const text = await response.text();
                if (!text || text.trim().length === 0) {
                    console.warn(`APIClient.get: Resposta vazia para ${url}`);
                    return {};
                }
                data = JSON.parse(text);
            } catch (parseError) {
                console.error(`APIClient.get: Erro ao parsear JSON de ${url}:`, parseError);
                throw new Error(`Resposta inválida da API: não é JSON válido`);
            }
            
            console.log(`APIClient.get: Dados recebidos de ${url}:`, data);
            return data;
            
        } catch (error) {
            // Melhorar mensagens de erro baseadas no tipo
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                // Erro de rede ou CORS
                const networkError = new Error(`Erro de rede: Não foi possível conectar ao servidor. Verifique se o backend está rodando em ${API_BASE_URL}`);
                networkError.isNetworkError = true;
                networkError.originalError = error;
                console.error(`APIClient.get: Erro de rede ao buscar ${url}:`, networkError);
                throw networkError;
            } else if (error.status) {
                // Erro HTTP
                console.error(`APIClient.get: Erro HTTP ${error.status} ao buscar ${url}:`, error.message);
                throw error;
            } else {
                // Outros erros
                console.error(`APIClient.get: Erro ao buscar ${url}:`, error);
                throw error;
            }
        }
    }
    
    // Métodos para gerenciar filtro de estado
    setEstadoFiltro(estado) {
        estadoSelecionado = estado ? estado.toUpperCase() : null;
    }
    
    getEstadoFiltro() {
        return estadoSelecionado;
    }
    
    limparFiltro() {
        estadoSelecionado = null;
    }

    // Entradas
    async getEntradasPorObjeto() {
        return await this.get('/entradas/por-objeto');
    }

    // Encerramentos
    async getEncerradosPorObjeto() {
        return await this.get('/encerramentos/por-objeto');
    }

    // Saldo
    async getSaldo() {
        return await this.get('/saldo/');
    }

    async getSaldoPorObjeto() {
        return await this.get('/saldo/por-objeto');
    }

    // Mapas
    async getMapaNacional() {
        return await this.get('/mapas/nacional');
    }

    async getCapitais(uf = null) {
        const url = uf ? `/mapas/capitais?uf=${uf}` : '/mapas/capitais';
        return await this.get(url);
    }

    async getCidadesPorUF(uf) {
        return await this.get(`/mapas/cidades-por-uf?uf=${uf}`);
    }

    // Indicadores
    async getEvolucao() {
        return await this.get('/indicadores/evolucao');
    }

    async getObjetoPorEstado() {
        return await this.get('/indicadores/objeto-por-estado');
    }

    async getTempoMedio() {
        return await this.get('/indicadores/tempo-medio');
    }

    async getCasosPorImpacto() {
        return await this.get('/indicadores/casos-impacto');
    }

    async getSLAPorArea() {
        return await this.get('/indicadores/sla-area');
    }

    async getSolicitacoesPrazo() {
        return await this.get('/indicadores/solicitacoes-prazo');
    }

    async getSolicitacoesPrazoPorArea() {
        return await this.get('/indicadores/solicitacoes-prazo-por-area');
    }

    async getAreasResponsaveis() {
        return await this.get('/indicadores/areas-responsaveis');
    }

    async getSLASubsidioPorArea() {
        return await this.get('/indicadores/sla-subsidio-por-area');
    }

    async getCasosObjetosPorUf() {
        return await this.get('/indicadores/casos-objetos-por-uf');
    }

    async getVolumeCusto() {
        return await this.get('/indicadores/volume-custo');
    }

    async getReiteracoes() {
        return await this.get('/indicadores/reiteracoes');
    }

    async getPareto() {
        return await this.get('/indicadores/pareto');
    }

    async getCasosCriticos() {
        return await this.get('/indicadores/casos-criticos');
    }

    async getSentencas() {
        return await this.get('/indicadores/sentencas');
    }

    async getSentencasPorArea() {
        return await this.get('/indicadores/sentencas-por-area');
    }

    async getReincidencia() {
        return await this.get('/indicadores/reincidencia');
    }
    
    async getReincidenciaPorCliente() {
        return await this.get('/indicadores/reincidencia-por-cliente');
    }

    async getTiposAcoes2025() {
        return await this.get('/indicadores/tipos-acoes-2025');
    }

    async getErroSistemico() {
        return await this.get('/indicadores/erro-sistemico');
    }

    async getMaiorReiteracao() {
        return await this.get('/indicadores/maior-reiteracao');
    }

    async getKPIsFinais() {
        return await this.get('/indicadores/kpis-finais');
    }

    async getEstatisticasGerais() {
        return await this.get('/indicadores/estatisticas-gerais');
    }

    async getAcoesGanhasPerdidas() {
        return await this.get('/indicadores/acoes-ganhas-perdidas');
    }

    async getAnaliseCorrelacao(filtroObjeto = null) {
        // Os filtros globais (uf e objeto) já são incluídos automaticamente pelo método get()
        // Mas ainda aceitamos filtroObjeto para compatibilidade
        const params = new URLSearchParams();
        if (filtroObjeto) {
            params.append('filtro_objeto', filtroObjeto);
        }
        const q = params.toString() ? `?${params.toString()}` : '';
        return await this.get(`/indicadores/analise-correlacao${q}`);
    }
}

// Instância global
const api = new APIClient();

// Funções auxiliares de formatação
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function formatNumber(value) {
    return new Intl.NumberFormat('pt-BR').format(value);
}

function formatPercent(value) {
    return `${value.toFixed(1)}%`;
}

function formatCurrencyMil(value) {
    const mil = value / 1000;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 0,
        maximumFractionDigits: 1
    }).format(mil) + ' Mil';
}

// Expor funções globalmente
window.api = api;
window.formatNumber = formatNumber;
window.formatCurrency = formatCurrency;
window.formatPercent = formatPercent;
window.formatCurrencyMil = formatCurrencyMil;
