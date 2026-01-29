/**
 * Gerenciador de Estado Global do Dashboard
 * Gerencia filtros e notifica componentes sobre mudanças
 */

const DashboardState = {
    filters: {
        uf: null,
        objeto: null
    },
    listeners: [],
    
    /**
     * Define um filtro e notifica todos os listeners
     * @param {string} type - Tipo de filtro ('uf' ou 'objeto')
     * @param {string|null} value - Valor do filtro ou null para remover
     */
    setFilter(type, value) {
        this.filters[type] = value;
        this.notifyListeners();
    },
    
    /**
     * Retorna uma cópia dos filtros atuais
     * @returns {Object} Objeto com filtros {uf: string|null, objeto: string|null}
     */
    getFilters() {
        return { ...this.filters };
    },
    
    /**
     * Limpa todos os filtros
     */
    clearFilters() {
        this.filters.uf = null;
        this.filters.objeto = null;
        this.notifyListeners();
    },
    
    /**
     * Inscreve um callback para ser notificado quando filtros mudarem
     * @param {Function} callback - Função que será chamada com os novos filtros
     */
    subscribe(callback) {
        if (typeof callback === 'function') {
            this.listeners.push(callback);
        }
    },
    
    /**
     * Remove um listener
     * @param {Function} callback - Função a ser removida
     */
    unsubscribe(callback) {
        this.listeners = this.listeners.filter(cb => cb !== callback);
    },
    
    /**
     * Notifica todos os listeners sobre mudanças nos filtros
     */
    notifyListeners() {
        const filters = this.getFilters();
        this.listeners.forEach(cb => {
            try {
                cb(filters);
            } catch (error) {
                console.error('Erro ao notificar listener:', error);
            }
        });
    }
};

// Tornar disponível globalmente
window.DashboardState = DashboardState;
