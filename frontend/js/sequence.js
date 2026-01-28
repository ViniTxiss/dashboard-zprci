/**
 * Controle de Sequência de Apresentação
 * Garante que elementos apareçam na ordem correta
 */

class SequenceController {
    constructor() {
        this.init();
    }

    init() {
        // Verificar se AnimationController foi inicializado
        this.checkAnimationController();
        
        // Garantir que a capa seja carregada primeiro
        this.loadCapa();
        
        // Verificar se há elementos que precisam ser animados após um delay
        setTimeout(() => {
            this.ensureContentVisible();
        }, 1000);
    }

    checkAnimationController() {
        if (!window.animationController) {
            console.warn('SequenceController: AnimationController não encontrado, criando fallback...');
            // Criar fallback básico
            setTimeout(() => {
                const elements = document.querySelectorAll('[data-animate="step"]');
                elements.forEach(element => {
                    if (!element.classList.contains('animate-in')) {
                        element.classList.add('animate-in');
                    }
                });
            }, 2000);
        } else {
            console.log('SequenceController: AnimationController encontrado');
        }
    }

    ensureContentVisible() {
        // Garantir que elementos visíveis sejam animados
        const elements = document.querySelectorAll('[data-animate="step"]');
        let needsAnimation = 0;
        
        elements.forEach(element => {
            const rect = element.getBoundingClientRect();
            const isVisible = rect.top < window.innerHeight && rect.bottom > 0 && 
                            rect.width > 0 && rect.height > 0;
            
            if (isVisible && !element.classList.contains('animate-in')) {
                needsAnimation++;
                // Se AnimationController existe, usar ele
                if (window.animationController && window.animationController.animateElement) {
                    window.animationController.animateElement(element);
                } else {
                    // Fallback: animar diretamente
                    const delay = parseInt(element.getAttribute('data-delay')) || 0;
                    setTimeout(() => {
                        element.classList.add('animate-in');
                    }, delay);
                }
            }
        });
        
        if (needsAnimation > 0) {
            console.log(`SequenceController: Garantindo visibilidade de ${needsAnimation} elementos`);
        }
    }

    async loadCapa() {
        try {
            const kpis = await api.getKPIsFinais();
            const totalCasosEl = document.getElementById('kpi-total-casos');
            if (totalCasosEl) {
                totalCasosEl.textContent = formatNumber(kpis.total_casos);
            }
        } catch (error) {
            console.error('Erro ao carregar capa:', error);
        }
    }
}

// Inicializar controlador de sequência
const sequenceController = new SequenceController();

// Exportar
window.sequenceController = sequenceController;
