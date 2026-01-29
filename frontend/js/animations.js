/**
 * Sistema de Animações Sequenciais
 * Usa IntersectionObserver para controlar animações
 */

class AnimationController {
    constructor() {
        this.observer = null;
        this.animatedElements = new Set();
        this.fallbackTimeout = null;
        this.init();
    }

    init() {
        console.log('AnimationController: Inicializando...');
        
        // Configurar IntersectionObserver
        const options = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1
        };

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.animatedElements.has(entry.target)) {
                    this.animateElement(entry.target);
                    this.animatedElements.add(entry.target);
                }
            });
        }, options);

        // Observar todos os elementos com data-animate
        this.observeElements();
        
        // Verificar elementos já visíveis e animá-los imediatamente
        this.checkVisibleElements();
        
        // Timeout de fallback: após 3 segundos, animar todos os elementos visíveis
        this.fallbackTimeout = setTimeout(() => {
            console.log('AnimationController: Executando fallback para elementos não animados');
            this.forceAnimateVisible();
        }, 3000);
    }

    observeElements() {
        const elements = document.querySelectorAll('[data-animate="step"]');
        console.log(`AnimationController: Observando ${elements.length} elementos`);
        elements.forEach(element => {
            this.observer.observe(element);
        });
    }

    checkVisibleElements() {
        // Verificar elementos que já estão visíveis e animá-los imediatamente
        const elements = document.querySelectorAll('[data-animate="step"]');
        elements.forEach(element => {
            if (this.isElementVisible(element) && !this.animatedElements.has(element)) {
                console.log('AnimationController: Elemento já visível, animando imediatamente:', element);
                this.animateElement(element);
                this.animatedElements.add(element);
            }
        });
    }

    isElementVisible(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top < window.innerHeight &&
            rect.bottom > 0 &&
            rect.left < window.innerWidth &&
            rect.right > 0 &&
            rect.width > 0 &&
            rect.height > 0
        );
    }

    animateElement(element) {
        const delay = parseInt(element.getAttribute('data-delay')) || 0;
        
        setTimeout(() => {
            element.classList.add('animate-in');
            console.log('AnimationController: Elemento animado:', element);
        }, delay);
    }

    forceAnimateVisible() {
        // Forçar animação de todos os elementos visíveis que ainda não foram animados
        const elements = document.querySelectorAll('[data-animate="step"]');
        let animated = 0;
        
        elements.forEach(element => {
            if (!this.animatedElements.has(element)) {
                if (this.isElementVisible(element)) {
                    this.animateElement(element);
                    this.animatedElements.add(element);
                    animated++;
                } else {
                    // Se não está visível, ainda adicionar ao set para evitar tentativas repetidas
                    // mas não animar ainda
                    this.animatedElements.add(element);
                }
            } else if (!element.classList.contains('animate-in')) {
                // Se já está no set mas não tem animate-in, forçar
                this.animateElement(element);
                animated++;
            }
        });
        
        // Garantir que elementos de gráficos sejam visíveis mesmo sem animação
        const chartContainers = document.querySelectorAll('.chart-container, .map-container');
        chartContainers.forEach(container => {
            if (this.isElementVisible(container) && !container.classList.contains('animate-in')) {
                container.classList.add('animate-in');
                container.style.opacity = '1';
                container.style.visibility = 'visible';
            }
        });
        
        if (animated > 0) {
            console.log(`AnimationController: Fallback animou ${animated} elementos`);
        }
    }

    reset() {
        this.animatedElements.clear();
        if (this.fallbackTimeout) {
            clearTimeout(this.fallbackTimeout);
        }
        const elements = document.querySelectorAll('[data-animate="step"]');
        elements.forEach(element => {
            element.classList.remove('animate-in');
            if (this.observer) {
                this.observer.unobserve(element);
            }
        });
        this.init();
    }
}

// Inicializar controlador de animações
const animationController = new AnimationController();

// Exportar
window.animationController = animationController;
