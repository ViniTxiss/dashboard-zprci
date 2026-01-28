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

// Estado global para filtro de estado
let estadoSelecionado = null;

class APIClient {
    async get(url) {
        try {
            // Adicionar parâmetro estado se houver filtro ativo
            const separator = url.includes('?') ? '&' : '?';
            const estadoParam = estadoSelecionado ? `${separator}estado=${encodeURIComponent(estadoSelecionado)}` : '';
            const fullUrl = `${API_BASE_URL}${url}${estadoParam}`;
            const response = await fetch(fullUrl);
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return data;
        } catch (error) {
            console.error(`Erro ao buscar ${url}:`, error);
            throw error;
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
