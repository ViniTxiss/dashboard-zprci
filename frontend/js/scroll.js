/**
 * Controle de Scroll e Lazy Loading
 */

class ScrollController {
    constructor() {
        this.loadedSections = new Set();
        this.entradasData = null;
        this.encerradosData = null;
        this.selectedObjetoEncerrados = null;
        this.sortEntradas = { col: null, asc: true };
        this.saldoData = null;
        this.sortSaldo = { col: null, asc: true };
        this.reincidenciaData = null;
        this.sortReincidencia = { col: null, asc: true };
        this.filtrosReincidencia = {
            nome: '',
            qtdMin: null,
            qtdMax: null,
            resultadoMin: null,
            resultadoMax: null
        };
        this.casosCriticosData = null;
        this.filtrosCasosCriticos = {
            nome: '',
            tipo: '',
            motivo: '',
            situacao: '',
            prejuizoMin: null,
            prejuizoMax: null
        };
        this.init();
    }

    init() {
        // Observar seções para carregar dados quando entrarem em viewport
        const sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const sectionId = entry.target.id;
                    // Para seção de reiterações, permitir recarregamento se necessário
                    const shouldLoad = !this.loadedSections.has(sectionId) || sectionId === 'reiteracoes';
                    
                    if (shouldLoad) {
                        // Verificar se o elemento tem dimensões válidas antes de carregar
                        const rect = entry.target.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            // Usar requestAnimationFrame para garantir que o DOM está pronto
                            requestAnimationFrame(async () => {
                                try {
                                    await this.loadSectionData(entry.target);
                                    // Para reiterações, não marcar como loaded imediatamente
                                    // Aguardar um pouco para garantir que o gráfico foi renderizado
                                    if (sectionId === 'reiteracoes') {
                                        setTimeout(() => {
                                            this.loadedSections.add(sectionId);
                                        }, 500);
                                    } else {
                                        this.loadedSections.add(sectionId);
                                    }
                                } catch (error) {
                                    console.error(`Erro ao carregar seção ${sectionId}:`, error);
                                    // Não adicionar ao loadedSections para permitir retry
                                }
                            });
                        } else {
                            // Se não tem dimensões válidas, tentar novamente após um delay
                            setTimeout(async () => {
                                if (!this.loadedSections.has(sectionId) || sectionId === 'reiteracoes') {
                                    const retryRect = entry.target.getBoundingClientRect();
                                    if (retryRect.width > 0 && retryRect.height > 0) {
                                        try {
                                            await this.loadSectionData(entry.target);
                                            if (sectionId === 'reiteracoes') {
                                                setTimeout(() => {
                                                    this.loadedSections.add(sectionId);
                                                }, 500);
                                            } else {
                                                this.loadedSections.add(sectionId);
                                            }
                                        } catch (error) {
                                            console.error(`Erro ao carregar seção ${sectionId} (retry):`, error);
                                        }
                                    }
                                }
                            }, 200);
                        }
                    }
                }
            });
        }, {
            root: null,
            rootMargin: '200px', // Aumentado de 100px para 200px para carregar antes
            threshold: 0.2 // Aumentado de 0.1 para 0.2 para garantir mais visibilidade
        });

        // Observar todas as seções
        document.querySelectorAll('.slide').forEach(section => {
            sectionObserver.observe(section);
        });

        // Precarregar entradas, encerrados e saldo (não depender só do scroll)
        this.loadedSections.add('entradas-encerrados');
        const secEntradas = document.getElementById('entradas-encerrados');
        if (secEntradas) this.loadSectionData(secEntradas);

        // Event listeners para filtros de reincidência
        this.setupReincidenciaFilters();
        // Event listeners para filtros de casos críticos
        this.setupCasosCriticosFilters();

        document.addEventListener('click', (e) => {
            this.handleTableEntradasClick(e);
            this.handleTableSaldoClick(e);
            this.handleTableReincidenciaClick(e);
            this.handleCasosCriticosClick(e);
            if (e.target.closest('#btn-encerrados-ver-todos')) {
                this.selectedObjetoEncerrados = null;
                this.renderEncerradosTable(null);
                const info = document.getElementById('encerrados-espelho-info');
                if (info) info.style.display = 'none';
            }
        });
    }

    handleTableEntradasClick(e) {
        const table = e.target.closest('#table-entradas');
        if (!table) return;
        const th = e.target.closest('th.sortable');
        if (th) {
            this.handleEntradasSort(th);
            return;
        }
        const td = e.target.closest('tbody td.celula-clicavel');
        if (td) {
            const tr = td.closest('tr');
            const objeto = (tr && tr.dataset.objeto) ? tr.dataset.objeto : '';
            if (objeto) {
                this.selectedObjetoEncerrados = objeto;
                this.renderEncerradosTable(objeto);
                const info = document.getElementById('encerrados-espelho-info');
                const txt = document.getElementById('encerrados-espelho-texto');
                if (info) info.style.display = 'flex';
                if (txt) txt.textContent = 'Espelhando: ' + objeto;
            }
        }
    }

    handleTableSaldoClick(e) {
        const table = e.target.closest('#table-saldo');
        if (!table) return;
        const th = e.target.closest('th.sortable');
        if (th) {
            this.handleSaldoSort(th);
            return;
        }
    }

    applySortSaldo(dados) {
        if (!this.sortSaldo.col || !dados.length) return;
        const col = this.sortSaldo.col;
        const asc = this.sortSaldo.asc;
        
        if (col === 'objeto') {
            dados.sort((a, b) => 
                (a.objeto_acao || '').localeCompare(b.objeto_acao || '') * (asc ? 1 : -1)
            );
        } else {
            const keyMap = {
                'entradas': 'qtd_entradas',
                'encerramentos': 'qtd_encerramentos',
                'saldo': 'saldo'
            };
            const key = keyMap[col];
            if (key) {
                dados.sort((a, b) => {
                    const va = Number(a[key] || 0);
                    const vb = Number(b[key] || 0);
                    return (va - vb) * (asc ? 1 : -1);
                });
            }
        }
    }

    handleSaldoSort(th) {
        const col = th && th.dataset && th.dataset.col;
        if (!col) return;
        this.sortSaldo = { col, asc: this.sortSaldo.col === col ? !this.sortSaldo.asc : true };
        const dados = (this.saldoData && this.saldoData.dados ? this.saldoData.dados : []).slice();
        this.applySortSaldo(dados);
        this.renderSaldoTable(dados, this.saldoData);
    }

    renderSaldoTable(dados, data) {
        const tbody = document.querySelector('#table-saldo tbody');
        if (!tbody) return;
        
        if (!dados || dados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhum dado disponível</td></tr>';
            return;
        }
        
        // Renderizar linhas de dados
        let html = dados.map(item => {
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
        if (data) {
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
        }
        
        tbody.innerHTML = html;
    }

    applySortEntradas(dados) {
        if (!this.sortEntradas.col || !dados.length) return;
        const col = this.sortEntradas.col;
        const asc = this.sortEntradas.asc;
        if (col === 'objeto') {
            dados.sort((a, b) => (a.objeto_acao || '').localeCompare(b.objeto_acao || '') * (asc ? 1 : -1));
        } else {
            const key = col === 'total' ? 'Total' : col;
            dados.sort((a, b) => {
                const va = Number(a[key] ?? a[String(key)] ?? 0);
                const vb = Number(b[key] ?? b[String(key)] ?? 0);
                return (va - vb) * (asc ? 1 : -1);
            });
        }
    }

    handleEntradasSort(th) {
        const col = th && th.dataset && th.dataset.col;
        if (!col) return;
        this.sortEntradas = { col, asc: this.sortEntradas.col === col ? !this.sortEntradas.asc : true };
        const dados = (this.entradasData && this.entradasData.dados ? this.entradasData.dados : []).slice();
        this.applySortEntradas(dados);
        const tbody = document.querySelector('#table-entradas tbody');
        if (tbody) tbody.innerHTML = this.renderEntradasBodyHtml(dados);
    }

    renderEntradasBodyHtml(dados) {
        return dados.map(item => {
            const objeto = item.objeto_acao || item.objeto || 'N/A';
            const objEsc = (objeto + '').replace(/"/g, '&quot;');
            const ano2022 = item[2022] ?? item['2022'] ?? 0;
            const ano2023 = item[2023] ?? item['2023'] ?? 0;
            const ano2024 = item[2024] ?? item['2024'] ?? 0;
            const ano2025 = item[2025] ?? item['2025'] ?? 0;
            const total = item.Total ?? item.total ?? (ano2022 + ano2023 + ano2024 + ano2025);
            return `<tr data-objeto="${objEsc}">
                <td class="celula-clicavel">${objeto}</td>
                <td class="celula-clicavel" data-ano="2022">${formatNumber(ano2022)}</td>
                <td class="celula-clicavel" data-ano="2023">${formatNumber(ano2023)}</td>
                <td class="celula-clicavel" data-ano="2024">${formatNumber(ano2024)}</td>
                <td class="celula-clicavel" data-ano="2025">${formatNumber(ano2025)}</td>
                <td class="celula-clicavel" data-col="total">${formatNumber(total)}</td>
            </tr>`;
        }).join('');
    }

    renderEncerradosTable(filtroObjeto) {
        const tbody = document.querySelector('#table-encerrados tbody');
        if (!tbody) return;
        const dados = (this.encerradosData && this.encerradosData.dados) ? this.encerradosData.dados : [];
        let lista = dados;
        
        // Se há filtro, mostrar apenas o objeto filtrado
        // Se não há filtro, mostrar TODOS os objetos (incluindo com 0 casos)
        if (filtroObjeto) {
            const enc = dados.find(d => (d.objeto_acao || d.objeto || '') === filtroObjeto);
            lista = enc ? [enc] : [{ objeto_acao: filtroObjeto, 2023: 0, 2024: 0, 2025: 0, Total: 0 }];
        } else {
            // Sem filtro: garantir que TODOS os objetos sejam exibidos
            lista = dados.length > 0 ? dados : [];
        }
        
        const hasYearColumns = document.querySelector('#table-encerrados thead th:nth-child(2)')?.textContent.includes('2023');
        if (hasYearColumns) {
            tbody.innerHTML = lista.map(item => {
                const objeto = item.objeto_acao || item.objeto || 'N/A';
                const a23 = item[2023] ?? item['2023'] ?? 0;
                const a24 = item[2024] ?? item['2024'] ?? 0;
                const a25 = item[2025] ?? item['2025'] ?? item['2025.0'] ?? 0;
                const total = item.Total ?? item.total ?? (a23 + a24 + a25);
                return `<tr><td>${objeto}</td><td>${formatNumber(a23)}</td><td>${formatNumber(a24)}</td><td>${formatNumber(a25)}</td><td>${formatNumber(total)}</td></tr>`;
            }).join('');
        } else {
            tbody.innerHTML = lista.map(item => `
                <tr><td>${item.objeto_acao || item.objeto || 'N/A'}</td><td>${formatNumber(item.quantidade || 0)}</td><td>${formatPercent(item.percentual || 0)}</td><td>${formatCurrency(item.total_impacto || 0)}</td></tr>
            `).join('');
        }
    }

    async loadSectionData(section) {
        const sectionId = section.id;

        try {
            switch (sectionId) {
                case 'entradas-encerrados':
                    await this.loadEntradas();
                    await this.loadEncerrados();
                    break;
                case 'saldo-entradas-encerramentos':
                    await this.loadSaldo();
                    break;
                case 'entradas-objeto':
                    await this.loadEntradas();
                    break;
                case 'encerrados-objeto':
                    await this.loadEncerrados();
                    break;
                case 'estatisticas-gerais':
                    await this.loadEstatisticasGerais();
                    break;
                case 'dashboard-acoes-ganhas-perdidas':
                    await this.loadAcoesGanhasPerdidas();
                    break;
                case 'evolucao':
                    await this.loadEvolucao();
                    break;
                case 'mapa-nacional':
                    await this.loadMapa();
                    break;
                case 'objeto-estado-mapa':
                    await this.loadObjetoEstado();
                    await this.loadMapa();
                    break;
                case 'objeto-estado':
                    await this.loadObjetoEstado();
                    break;
                case 'tempo-medio':
                    await this.loadTempoMedio();
                    break;
                case 'casos-impacto':
                    await this.loadCasosImpacto();
                    break;
                case 'sla-area':
                    await this.loadSLAArea();
                    await this.loadSolicitacoesPrazo();
                    break;
                case 'solicitacoes-prazo':
                    await this.loadSolicitacoesPrazo();
                    break;
                case 'volume-custo':
                    await this.loadVolumeCusto();
                    break;
                case 'reiteracoes':
                    await this.loadReiteracoes();
                    break;
                case 'pareto-impacto':
                    await this.loadPareto();
                    break;
                case 'distribuicao-casos-uf':
                    await this.loadDistribuicaoUF();
                    break;
                case 'casos-criticos-sentencas':
                    await this.loadCasosCriticos();
                    await this.loadSentencas();
                    break;
                case 'casos-criticos':
                    await this.loadCasosCriticos();
                    break;
                case 'sentencas':
                    await this.loadSentencas();
                    break;
                case 'reincidencia':
                    await this.loadReincidencia();
                    break;
                case 'tipos-acoes-reincidencia':
                    await this.loadTiposAcoes();
                    await this.loadReincidencia();
                    break;
                case 'tipos-acoes-2025':
                    await this.loadTiposAcoes();
                    break;
                case 'erro-sistemico-prejuizo':
                    await this.loadPrejuizoErroCritico();
                    await this.loadErroSistemico();
                    break;
                case 'erro-sistemico':
                    await this.loadErroSistemico();
                    break;
                case 'maior-reiteracao':
                    await this.loadMaiorReiteracao();
                    break;
                case 'kpis-finais':
                    await this.loadKPIsFinais();
                    break;
                case 'slide-analise-impacto':
                    await this.loadSlideAnaliseImpacto();
                    break;
            }
        } catch (error) {
            console.error(`Erro ao carregar dados da seção ${sectionId}:`, error);
        }
    }

    async loadEntradas() {
        const tbody = document.querySelector('#table-entradas tbody');
        const msgErro = '<tr><td colspan="6" style="text-align:center;color:#c00;">Erro: backend não respondeu (porta 8001).<br><small>Dê dois cliques em <strong>iniciar_backend.bat</strong> na pasta do projeto.</small></td></tr>';
        try {
            const data = await api.getEntradasPorObjeto();
            this.entradasData = data;
            const hasYearColumns = document.querySelector('#table-entradas thead th:nth-child(2)')?.textContent.includes('2022');
            if (tbody) {
                if (hasYearColumns && data.dados && data.dados.length > 0) {
                    const dados = (data.dados || []).slice();
                    this.applySortEntradas(dados);
                    tbody.innerHTML = this.renderEntradasBodyHtml(dados);
                } else if (data.dados && data.dados.length > 0) {
                    tbody.innerHTML = (data.dados || []).map(item => `
                        <tr>
                            <td>${item.objeto_acao || item.objeto || 'N/A'}</td>
                            <td>${formatNumber(item.quantidade || 0)}</td>
                            <td>${formatPercent(item.percentual || 0)}</td>
                            <td>${formatCurrency(item.total_impacto || 0)}</td>
                        </tr>
                    `).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhum dado disponível</td></tr>';
                }
            }
        } catch (e) {
            console.error('loadEntradas:', e);
            if (tbody) tbody.innerHTML = msgErro;
        }
    }

    async loadEncerrados() {
        const tbody = document.querySelector('#table-encerrados tbody');
        const msgErro = '<tr><td colspan="5" style="text-align:center;color:#c00;">Erro: backend não respondeu (porta 8001).<br><small>Dê dois cliques em <strong>iniciar_backend.bat</strong> na pasta do projeto.</small></td></tr>';
        try {
            const data = await api.getEncerradosPorObjeto();
            this.encerradosData = data;
            // Sempre renderizar TODOS os objetos inicialmente (sem filtro)
            // O scroll permitirá visualizar todos os objetos
            this.renderEncerradosTable(null);
        } catch (e) {
            console.error('loadEncerrados:', e);
            if (tbody) tbody.innerHTML = msgErro;
        }
    }

    async loadSaldo() {
        const tbodySaldo = document.querySelector('#table-saldo tbody');
        const msgErro = '<tr><td colspan="4" style="text-align:center;color:#c00;">Erro: backend não respondeu (porta 8001).<br><small>Dê dois cliques em <strong>iniciar_backend.bat</strong> na pasta do projeto.</small></td></tr>';
        try {
            const data = await api.getSaldoPorObjeto();
            this.saldoData = data;
            if (data && data.dados && data.dados.length > 0) {
                const dados = data.dados.slice();
                this.applySortSaldo(dados);
                this.renderSaldoTable(dados, data);
            } else if (tbodySaldo) {
                tbodySaldo.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhum dado disponível</td></tr>';
            }
        } catch (e) {
            console.error('loadSaldo (tabela):', e);
            if (tbodySaldo) tbodySaldo.innerHTML = msgErro;
        }
        try {
            const data = await api.getSaldo();
            const saldoEntradasEl = document.getElementById('saldo-entradas');
            const saldoEncerradosEl = document.getElementById('saldo-encerrados');
            const saldoTotalEl = document.getElementById('saldo-total');
            if (saldoEntradasEl) saldoEntradasEl.textContent = formatNumber(data.entradas);
            if (saldoEncerradosEl) saldoEncerradosEl.textContent = formatNumber(data.encerrados);
            if (saldoTotalEl) saldoTotalEl.textContent = formatNumber(data.saldo);
            if (window.chartFunctions && window.chartFunctions.renderSaldoChart) {
                await window.chartFunctions.renderSaldoChart();
            }
        } catch (e) {
            console.warn('loadSaldo: resumo/gráfico não disponíveis', e);
        }
    }

    async loadEstatisticasGerais() {
        try {
            const data = await api.getEstatisticasGerais();
            if (data) {
                const totalAcoesEl = document.getElementById('kpi-total-acoes');
                const totalEncerramentosEl = document.getElementById('kpi-total-encerramentos');
                const mediaPagamentoEl = document.getElementById('kpi-media-pagamento');
                
                if (totalAcoesEl) {
                    totalAcoesEl.textContent = formatNumber(data.total_acoes || 0);
                }
                if (totalEncerramentosEl) {
                    totalEncerramentosEl.textContent = formatNumber(data.total_encerramentos || 0);
                }
                if (mediaPagamentoEl) {
                    mediaPagamentoEl.textContent = formatCurrency(data.media_pagamento || 0);
                }
            }
        } catch (e) {
            console.error('loadEstatisticasGerais:', e);
        }
    }

    async loadAcoesGanhasPerdidas() {
        console.log('loadAcoesGanhasPerdidas: Iniciando carregamento...');
        
        // Verificar se chartFunctions está disponível
        if (!window.chartFunctions) {
            console.error('loadAcoesGanhasPerdidas: window.chartFunctions não encontrado!');
            // Tentar aguardar um pouco e verificar novamente
            await new Promise(resolve => setTimeout(resolve, 500));
            if (!window.chartFunctions) {
                console.error('loadAcoesGanhasPerdidas: window.chartFunctions ainda não disponível após espera');
                return;
            }
        }
        
        // Verificar se a seção está visível
        const section = document.getElementById('dashboard-acoes-ganhas-perdidas');
        if (!section) {
            console.error('loadAcoesGanhasPerdidas: Seção não encontrada no DOM');
            return;
        }
        
        // Aguardar seção estar visível
        const waitForVisible = async (element, maxWait = 3000) => {
            const startTime = Date.now();
            while (Date.now() - startTime < maxWait) {
                const rect = element.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && 
                    rect.top < window.innerHeight && 
                    rect.bottom > 0) {
                    return true;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return false;
        };
        
        const isVisible = await waitForVisible(section);
        if (!isVisible) {
            console.warn('loadAcoesGanhasPerdidas: Seção não está visível, mas continuando...');
        }
        
        // Verificar se os canvas existem
        const canvas1 = document.getElementById('chart-acoes-ganhas-perdidas');
        const canvas2 = document.getElementById('chart-acordo-antes-sentenca');
        
        if (!canvas1) {
            console.error('loadAcoesGanhasPerdidas: Canvas chart-acoes-ganhas-perdidas não encontrado');
        }
        if (!canvas2) {
            console.error('loadAcoesGanhasPerdidas: Canvas chart-acordo-antes-sentenca não encontrado');
        }
        
        console.log('loadAcoesGanhasPerdidas: chartFunctions encontrado, renderizando gráficos...');
        
        // Renderizar primeiro gráfico
        try {
            await window.chartFunctions.renderAcoesGanhasPerdidasChart();
            console.log('loadAcoesGanhasPerdidas: renderAcoesGanhasPerdidasChart concluído');
        } catch (error) {
            console.error('loadAcoesGanhasPerdidas: Erro ao renderizar gráfico de ações ganhas/perdidas:', error);
            // Não retornar aqui, continuar com o próximo gráfico
        }
        
        // Aguardar um pouco antes de renderizar o segundo gráfico
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Renderizar segundo gráfico
        try {
            await window.chartFunctions.renderAcordoAntesSentencaChart();
            console.log('loadAcoesGanhasPerdidas: renderAcordoAntesSentencaChart concluído');
        } catch (error) {
            console.error('loadAcoesGanhasPerdidas: Erro ao renderizar gráfico de acordo antes sentença:', error);
        }
        
        console.log('loadAcoesGanhasPerdidas: Carregamento concluído');
    }

    async loadEvolucao() {
        if (window.chartFunctions) {
            await window.chartFunctions.renderEvolucaoChart();
        }
    }

    async loadMapa() {
        if (window.renderMapaBrasil) {
            await window.renderMapaBrasil();
        }
    }

    async loadObjetoEstado() {
        if (window.chartFunctions) {
            await window.chartFunctions.renderObjetoEstadoChart();
        }
    }

    async loadTempoMedio() {
        const data = await api.getTempoMedio();
        document.getElementById('tempo-medio-geral').textContent = `${data.media_geral.toFixed(1)} dias`;
        if (window.chartFunctions) {
            await window.chartFunctions.renderTempoMedioChart();
        }
    }

    async loadCasosImpacto() {
        if (window.chartFunctions) {
            await window.chartFunctions.renderCasosImpactoChart();
        }
    }

    async loadSLAArea() {
        if (window.chartFunctions) {
            await window.chartFunctions.renderSLAAreaChart();
            await window.chartFunctions.renderSolicitacoesPrazoAreaChart();
        }
    }

    async loadSolicitacoesPrazo() {
        if (window.chartFunctions) {
            await window.chartFunctions.renderSolicitacoesPrazoChart();
        }
    }

    async loadVolumeCusto() {
        if (window.chartFunctions) {
            await window.chartFunctions.renderVolumeCustoChart();
        }
    }

    async loadReiteracoes() {
        try {
            // Verificar se o canvas existe
            const canvas = document.getElementById('chart-reiteracoes');
            if (!canvas) {
                console.warn('loadReiteracoes: Canvas chart-reiteracoes não encontrado');
                return;
            }
            
            // Destruir gráfico existente se houver
            if (window.chartFunctions && window.chartFunctions.destroyChart) {
                window.chartFunctions.destroyChart('chart-reiteracoes');
            }
            
            // Aguardar um frame para garantir que o DOM está pronto
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            // Renderizar o gráfico
            if (window.chartFunctions && window.chartFunctions.renderReiteracoesChart) {
                const chart = await window.chartFunctions.renderReiteracoesChart();
                // Verificar se o gráfico foi criado com sucesso
                if (!chart) {
                    console.warn('loadReiteracoes: Gráfico não foi criado, tentando novamente...');
                    // Tentar novamente após um delay
                    setTimeout(async () => {
                        if (window.chartFunctions && window.chartFunctions.renderReiteracoesChart) {
                            await window.chartFunctions.renderReiteracoesChart();
                        }
                    }, 500);
                }
            }
        } catch (error) {
            console.error('loadReiteracoes: Erro ao carregar gráfico:', error);
            // Tentar novamente após um delay em caso de erro
            setTimeout(async () => {
                if (window.chartFunctions && window.chartFunctions.renderReiteracoesChart) {
                    try {
                        await window.chartFunctions.renderReiteracoesChart();
                    } catch (retryError) {
                        console.error('loadReiteracoes: Erro no retry:', retryError);
                    }
                }
            }, 1000);
        }
    }

    async loadDistribuicaoUF() {
        if (window.chartFunctions) {
            await window.chartFunctions.renderDistribuicaoUFChart();
        }
    }

    async loadPareto() {
        if (window.chartFunctions) {
            await window.chartFunctions.renderParetoImpactoChart();
        }
    }

    async loadCasosCriticos() {
        const data = await api.getCasosCriticos();
        const tbody = document.querySelector('#table-casos-criticos tbody');
        if (tbody) {
            // Verificar se a tabela tem as colunas corretas
            const hasDetailedColumns = document.querySelector('#table-casos-criticos thead th:nth-child(1)')?.textContent.includes('Nome');
            if (hasDetailedColumns) {
                // Armazenar dados originais
                this.casosCriticosData = data.dados.map(item => {
                    const nome = item.nome_cliente || item.cliente || item.Pólo_Ativo || 'N/A';
                    const tipo = item.tipo_ocorrencia || item.objeto_acao || item.Descricao_do_Tipo_de_Ação || 'N/A';
                    const motivo = item.motivo_detalhado || item.detalhes || item.motivo_encerramento || 'N/A';
                    const situacao = item.situacao || item.status || item.Situação || 'N/A';
                    const prejuizo = item.prejuizo || item.impacto_financeiro || item.Valor_da_Causa_Atual || 0;
                    const valorPretendido = item.valor_pretendido || item.valor_causa || prejuizo || 0;
                    const ano = item.ano || null;
                    
                    return {
                        nome_cliente: nome,
                        tipo_ocorrencia: tipo,
                        motivo_detalhado: motivo,
                        situacao: situacao,
                        prejuizo: prejuizo,
                        valor_pretendido: valorPretendido,
                        ano: ano
                    };
                });
                
                // Separar casos de 2025
                this.casosCriticos2025 = data.dados_2025 || [];
                this.casosCriticosOutros = data.dados_outros || [];
                // Aplicar filtros e renderizar
                this.renderCasosCriticosTable();
            } else {
                this.casosCriticosData = data.dados.map(item => ({
                    objeto_acao: item.objeto_acao || 'N/A',
                    estado: item.estado || 'N/A',
                    impacto_financeiro: item.impacto_financeiro || 0,
                    reiteracoes: item.reiteracoes || 0
                }));
                this.renderCasosCriticosTable();
            }
        }
        
        // Carregar gráfico de sentenças por área
        if (window.chartFunctions && window.chartFunctions.renderSentencasPorAreaChart) {
            await window.chartFunctions.renderSentencasPorAreaChart();
        }
    }

    handleCasosCriticosClick(e) {
        if (e.target.closest('#btn-limpar-filtros-criticos')) {
            this.limparFiltrosCasosCriticos();
        }
    }

    aplicarFiltrosCasosCriticos(dados) {
        if (!dados || !Array.isArray(dados)) return [];
        
        return dados.filter(item => {
            // Filtro por nome
            if (this.filtrosCasosCriticos.nome) {
                const nome = (item.nome_cliente || '').toLowerCase();
                const filtroNome = this.filtrosCasosCriticos.nome.toLowerCase();
                if (!nome.includes(filtroNome)) return false;
            }
            
            // Filtro por tipo de ocorrência
            if (this.filtrosCasosCriticos.tipo) {
                const tipo = (item.tipo_ocorrencia || '').toLowerCase();
                const filtroTipo = this.filtrosCasosCriticos.tipo.toLowerCase();
                if (!tipo.includes(filtroTipo)) return false;
            }
            
            // Filtro por motivo detalhado
            if (this.filtrosCasosCriticos.motivo) {
                const motivo = (item.motivo_detalhado || '').toLowerCase();
                const filtroMotivo = this.filtrosCasosCriticos.motivo.toLowerCase();
                if (!motivo.includes(filtroMotivo)) return false;
            }
            
            // Filtro por situação
            if (this.filtrosCasosCriticos.situacao) {
                const situacao = (item.situacao || '').toLowerCase();
                const filtroSituacao = this.filtrosCasosCriticos.situacao.toLowerCase();
                if (!situacao.includes(filtroSituacao)) return false;
            }
            
            // Filtro por prejuízo
            const prejuizo = item.prejuizo || 0;
            if (this.filtrosCasosCriticos.prejuizoMin !== null && prejuizo < this.filtrosCasosCriticos.prejuizoMin) return false;
            if (this.filtrosCasosCriticos.prejuizoMax !== null && prejuizo > this.filtrosCasosCriticos.prejuizoMax) return false;
            
            return true;
        });
    }

    renderCasosCriticosTable() {
        const tbody = document.querySelector('#table-casos-criticos tbody');
        if (!tbody || !this.casosCriticosData) return;
        
        const dadosFiltrados = this.aplicarFiltrosCasosCriticos(this.casosCriticosData);
        
        // Verificar se a tabela tem as colunas detalhadas
        const hasDetailedColumns = document.querySelector('#table-casos-criticos thead th:nth-child(1)')?.textContent.includes('Nome');
        const hasValorPretendido = document.querySelector('#table-casos-criticos thead th:nth-child(6)')?.textContent.includes('Valor Pretendido');
        const colspan = hasValorPretendido ? 7 : 5;
        
        if (dadosFiltrados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align:center;color:#718096;">Nenhum resultado encontrado</td></tr>`;
            return;
        }
        
        if (hasDetailedColumns) {
            if (hasValorPretendido) {
                tbody.innerHTML = dadosFiltrados.map(item => `
                    <tr>
                        <td>${item.nome_cliente || 'N/A'}</td>
                        <td>${item.tipo_ocorrencia || 'N/A'}</td>
                        <td>${item.motivo_detalhado || 'N/A'}</td>
                        <td>${item.situacao || 'N/A'}</td>
                        <td>${formatCurrency(item.prejuizo || 0)}</td>
                        <td>${formatCurrency(item.valor_pretendido || item.prejuizo || 0)}</td>
                        <td>${item.ano || 'N/A'}</td>
                    </tr>
                `).join('');
            } else {
                tbody.innerHTML = dadosFiltrados.map(item => `
                    <tr>
                        <td>${item.nome_cliente || 'N/A'}</td>
                        <td>${item.tipo_ocorrencia || 'N/A'}</td>
                        <td>${item.motivo_detalhado || 'N/A'}</td>
                        <td>${item.situacao || 'N/A'}</td>
                        <td>${formatCurrency(item.prejuizo || 0)}</td>
                    </tr>
                `).join('');
            }
        } else {
            tbody.innerHTML = dadosFiltrados.map(item => `
                    <tr>
                        <td>${item.objeto_acao || 'N/A'}</td>
                        <td>${item.estado || 'N/A'}</td>
                        <td>${formatCurrency(item.impacto_financeiro || 0)}</td>
                        <td>${item.reiteracoes || 0}</td>
                    </tr>
                `).join('');
            }
        }

    setupCasosCriticosFilters() {
        const filterNome = document.getElementById('filter-nome-criticos');
        const filterTipo = document.getElementById('filter-tipo-criticos');
        const filterMotivo = document.getElementById('filter-motivo-criticos');
        const filterSituacao = document.getElementById('filter-situacao-criticos');
        const filterPrejuizoMin = document.getElementById('filter-prejuizo-min-criticos');
        const filterPrejuizoMax = document.getElementById('filter-prejuizo-max-criticos');
        
        if (filterNome) {
            filterNome.addEventListener('input', (e) => {
                this.filtrosCasosCriticos.nome = e.target.value;
                this.renderCasosCriticosTable();
            });
        }
        
        if (filterTipo) {
            filterTipo.addEventListener('input', (e) => {
                this.filtrosCasosCriticos.tipo = e.target.value;
                this.renderCasosCriticosTable();
            });
        }
        
        if (filterMotivo) {
            filterMotivo.addEventListener('input', (e) => {
                this.filtrosCasosCriticos.motivo = e.target.value;
                this.renderCasosCriticosTable();
            });
        }
        
        if (filterSituacao) {
            filterSituacao.addEventListener('input', (e) => {
                this.filtrosCasosCriticos.situacao = e.target.value;
                this.renderCasosCriticosTable();
            });
        }
        
        if (filterPrejuizoMin) {
            filterPrejuizoMin.addEventListener('input', (e) => {
                this.filtrosCasosCriticos.prejuizoMin = e.target.value ? Number(e.target.value) : null;
                this.renderCasosCriticosTable();
            });
        }
        
        if (filterPrejuizoMax) {
            filterPrejuizoMax.addEventListener('input', (e) => {
                this.filtrosCasosCriticos.prejuizoMax = e.target.value ? Number(e.target.value) : null;
                this.renderCasosCriticosTable();
            });
        }
    }

    limparFiltrosCasosCriticos() {
        this.filtrosCasosCriticos = {
            nome: '',
            tipo: '',
            motivo: '',
            situacao: '',
            prejuizoMin: null,
            prejuizoMax: null
        };
        
        // Limpar campos de input
        const filterNome = document.getElementById('filter-nome-criticos');
        const filterTipo = document.getElementById('filter-tipo-criticos');
        const filterMotivo = document.getElementById('filter-motivo-criticos');
        const filterSituacao = document.getElementById('filter-situacao-criticos');
        const filterPrejuizoMin = document.getElementById('filter-prejuizo-min-criticos');
        const filterPrejuizoMax = document.getElementById('filter-prejuizo-max-criticos');
        
        if (filterNome) filterNome.value = '';
        if (filterTipo) filterTipo.value = '';
        if (filterMotivo) filterMotivo.value = '';
        if (filterSituacao) filterSituacao.value = '';
        if (filterPrejuizoMin) filterPrejuizoMin.value = '';
        if (filterPrejuizoMax) filterPrejuizoMax.value = '';
        
        this.renderCasosCriticosTable();
    }

    async loadSentencas() {
        if (window.chartFunctions) {
            await window.chartFunctions.renderSentencasChart();
        }
    }

    async loadReincidencia() {
        try {
            // Carregar taxa de reincidência
        const data = await api.getReincidencia();
        const taxaEl = document.getElementById('taxa-reincidencia');
        if (taxaEl) {
                taxaEl.textContent = formatPercent(data.taxa_reincidencia || 0);
        }
            
            // Carregar tabela de reincidência por cliente
            const tbody = document.querySelector('#table-reincidencia tbody');
            if (tbody) {
                try {
                    const dataClientes = await api.getReincidenciaPorCliente();
                    if (dataClientes && dataClientes.dados && dataClientes.dados.length > 0) {
                        // Armazenar dados originais
                        this.reincidenciaData = dataClientes.dados;
                        // Aplicar filtros e ordenação
                        this.renderReincidenciaTable();
                    } else {
                        this.reincidenciaData = [];
                        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#718096;">Nenhum dado disponível</td></tr>';
                    }
                } catch (error) {
                    console.error('Erro ao carregar tabela de reincidência:', error);
                    if (tbody) {
                        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#f56565;">Erro ao carregar dados</td></tr>';
                    }
                }
            }
        } catch (error) {
            console.error('Erro ao carregar reincidência:', error);
        }
    }

    handleTableReincidenciaClick(e) {
        const table = e.target.closest('#table-reincidencia');
        if (!table) return;
        const th = e.target.closest('th.sortable');
        if (th) {
            this.handleReincidenciaSort(th);
            return;
        }
        if (e.target.closest('#btn-limpar-filtros-reincidencia')) {
            this.limparFiltrosReincidencia();
        }
    }

    handleReincidenciaSort(th) {
        const col = th && th.dataset && th.dataset.col;
        if (!col) return;
        this.sortReincidencia = { col, asc: this.sortReincidencia.col === col ? !this.sortReincidencia.asc : true };
        this.renderReincidenciaTable();
        }

    aplicarFiltrosReincidencia(dados) {
        if (!dados || !Array.isArray(dados)) return [];
        
        let filtrados = dados.filter(item => {
            // Filtro por nome
            if (this.filtrosReincidencia.nome) {
                const nome = (item.nome_cliente || '').toLowerCase();
                const filtroNome = this.filtrosReincidencia.nome.toLowerCase();
                if (!nome.includes(filtroNome)) return false;
            }
            
            // Filtro por quantidade de processos
            const qtd = item.qtd_processos || 0;
            if (this.filtrosReincidencia.qtdMin !== null && qtd < this.filtrosReincidencia.qtdMin) return false;
            if (this.filtrosReincidencia.qtdMax !== null && qtd > this.filtrosReincidencia.qtdMax) return false;
            
            // Filtro por resultado
            const resultado = item.resultado || 0;
            if (this.filtrosReincidencia.resultadoMin !== null && resultado < this.filtrosReincidencia.resultadoMin) return false;
            if (this.filtrosReincidencia.resultadoMax !== null && resultado > this.filtrosReincidencia.resultadoMax) return false;
            
            return true;
        });
        
        // Aplicar ordenação
        if (this.sortReincidencia.col) {
            const col = this.sortReincidencia.col;
            const asc = this.sortReincidencia.asc;
            
            filtrados.sort((a, b) => {
                if (col === 'nome_cliente') {
                    const nomeA = (a.nome_cliente || '').toLowerCase();
                    const nomeB = (b.nome_cliente || '').toLowerCase();
                    return nomeA.localeCompare(nomeB) * (asc ? 1 : -1);
                } else {
                    const valA = Number(a[col] || 0);
                    const valB = Number(b[col] || 0);
                    return (valA - valB) * (asc ? 1 : -1);
                }
            });
        }
        
        return filtrados;
    }

    renderReincidenciaTable() {
        const tbody = document.querySelector('#table-reincidencia tbody');
        if (!tbody || !this.reincidenciaData) return;
        
        const dadosFiltrados = this.aplicarFiltrosReincidencia(this.reincidenciaData);
        
        if (dadosFiltrados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#718096;">Nenhum resultado encontrado</td></tr>';
            return;
        }
        
        tbody.innerHTML = dadosFiltrados.map(item => `
                <tr>
                <td>${item.nome_cliente || 'N/A'}</td>
                <td>${formatNumber(item.qtd_processos || 0)}</td>
                <td>${formatCurrency(item.resultado || 0)}</td>
                </tr>
            `).join('');
        }

    setupReincidenciaFilters() {
        const filterNome = document.getElementById('filter-nome-reincidencia');
        const filterQtdMin = document.getElementById('filter-qtd-min');
        const filterQtdMax = document.getElementById('filter-qtd-max');
        const filterResultadoMin = document.getElementById('filter-resultado-min');
        const filterResultadoMax = document.getElementById('filter-resultado-max');
        
        if (filterNome) {
            filterNome.addEventListener('input', (e) => {
                this.filtrosReincidencia.nome = e.target.value;
                this.renderReincidenciaTable();
            });
        }
        
        if (filterQtdMin) {
            filterQtdMin.addEventListener('input', (e) => {
                this.filtrosReincidencia.qtdMin = e.target.value ? Number(e.target.value) : null;
                this.renderReincidenciaTable();
            });
        }
        
        if (filterQtdMax) {
            filterQtdMax.addEventListener('input', (e) => {
                this.filtrosReincidencia.qtdMax = e.target.value ? Number(e.target.value) : null;
                this.renderReincidenciaTable();
            });
        }
        
        if (filterResultadoMin) {
            filterResultadoMin.addEventListener('input', (e) => {
                this.filtrosReincidencia.resultadoMin = e.target.value ? Number(e.target.value) : null;
                this.renderReincidenciaTable();
            });
        }
        
        if (filterResultadoMax) {
            filterResultadoMax.addEventListener('input', (e) => {
                this.filtrosReincidencia.resultadoMax = e.target.value ? Number(e.target.value) : null;
                this.renderReincidenciaTable();
            });
        }
    }

    limparFiltrosReincidencia() {
        this.filtrosReincidencia = {
            nome: '',
            qtdMin: null,
            qtdMax: null,
            resultadoMin: null,
            resultadoMax: null
        };
        
        // Limpar campos de input
        const filterNome = document.getElementById('filter-nome-reincidencia');
        const filterQtdMin = document.getElementById('filter-qtd-min');
        const filterQtdMax = document.getElementById('filter-qtd-max');
        const filterResultadoMin = document.getElementById('filter-resultado-min');
        const filterResultadoMax = document.getElementById('filter-resultado-max');
        
        if (filterNome) filterNome.value = '';
        if (filterQtdMin) filterQtdMin.value = '';
        if (filterQtdMax) filterQtdMax.value = '';
        if (filterResultadoMin) filterResultadoMin.value = '';
        if (filterResultadoMax) filterResultadoMax.value = '';
        
        this.renderReincidenciaTable();
    }

    async loadTiposAcoes() {
        if (window.chartFunctions) {
            await window.chartFunctions.renderTiposAcoesChart();
        }
    }

    async loadPrejuizoErroCritico() {
        if (window.chartFunctions) {
            await window.chartFunctions.renderPrejuizoErroCriticoChart();
        }
    }

    async loadErroSistemico() {
        const data = await api.getErroSistemico();
        const totalErrosEl = document.getElementById('total-erros-sistemicos');
        if (totalErrosEl) {
            totalErrosEl.textContent = formatNumber(data.total_erros);
        }
        if (window.chartFunctions) {
            await window.chartFunctions.renderErroSistemicoChart();
        }
    }

    async loadMaiorReiteracao() {
        const data = await api.getMaiorReiteracao();
        const tbody = document.querySelector('#table-reiteracao tbody');
        tbody.innerHTML = data.dados.map(item => `
            <tr>
                <td>${item.objeto_acao || 'N/A'}</td>
                <td>${item.estado || 'N/A'}</td>
                <td>${item.reiteracoes || 0}</td>
                <td>${formatCurrency(item.impacto_financeiro || 0)}</td>
            </tr>
        `).join('');
    }

    async loadKPIsFinais() {
        const data = await api.getKPIsFinais();
        document.getElementById('kpi-final-casos').textContent = formatNumber(data.total_casos);
        document.getElementById('kpi-final-impacto').textContent = formatCurrency(data.total_impacto);
        document.getElementById('kpi-final-media').textContent = formatCurrency(data.media_impacto);
        document.getElementById('kpi-final-criticos').textContent = formatNumber(data.casos_criticos);
        document.getElementById('kpi-final-taxa').textContent = formatPercent(data.taxa_encerramento);
    }

    async loadSlideAnaliseImpacto() {
        console.log('loadSlideAnaliseImpacto: Iniciando carregamento');
        try {
            if (window.chartFunctions && window.chartFunctions.renderSlideImpacto) {
                console.log('loadSlideAnaliseImpacto: Função encontrada, chamando renderSlideImpacto');
                await window.chartFunctions.renderSlideImpacto(null);
                console.log('loadSlideAnaliseImpacto: Função executada com sucesso');
            } else {
                console.error('loadSlideAnaliseImpacto: renderSlideImpacto não está disponível');
                console.log('loadSlideAnaliseImpacto: chartFunctions:', window.chartFunctions);
            }
        } catch (error) {
            console.error('loadSlideAnaliseImpacto: Erro ao carregar:', error);
        }
    }

    /**
     * Recarrega todas as seções visíveis (usado quando filtro muda)
     */
    async reloadVisibleSections() {
        // Limpar gráficos existentes
        if (window.chartFunctions && window.chartFunctions.clearAllCharts) {
            window.chartFunctions.clearAllCharts();
        }
        
        // Encontrar seções visíveis
        const visibleSections = [];
        document.querySelectorAll('.slide').forEach(section => {
            const rect = section.getBoundingClientRect();
            const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
            if (isVisible) {
                visibleSections.push(section.id);
            }
        });
        
        // Recarregar dados de cada seção visível
        for (const sectionId of visibleSections) {
            try {
                await this.loadSectionData(document.getElementById(sectionId));
            } catch (error) {
                console.error(`Erro ao recarregar seção ${sectionId}:`, error);
            }
        }
    }
}

// Inicializar controlador de scroll
const scrollController = new ScrollController();

// Exportar
window.scrollController = scrollController;
