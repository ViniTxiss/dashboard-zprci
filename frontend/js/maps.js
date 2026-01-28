// Mapa do Brasil - Leaflet.js
const stateCoordinates = {
    'AC': [-9.97499, -67.82435], 'AL': [-9.57131, -36.78195], 'AP': [0.03493, -51.06944],
    'AM': [-3.11903, -60.02173], 'BA': [-12.97111, -38.51083], 'CE': [-3.71722, -38.54333],
    'DF': [-15.77972, -47.92972], 'ES': [-20.31944, -40.33778], 'GO': [-16.67861, -49.25389],
    'MA': [-2.52972, -44.30278], 'MT': [-15.60111, -56.0975], 'MS': [-20.44278, -54.64639],
    'MG': [-19.91667, -43.93444], 'PA': [-1.45583, -48.50444], 'PB': [-7.115, -34.86306],
    'PR': [-25.42778, -49.27306], 'PE': [-8.05389, -34.88111], 'PI': [-5.08917, -42.80194],
    'RJ': [-22.90694, -43.17278], 'RN': [-5.795, -35.20944], 'RS': [-30.03306, -51.23],
    'RO': [-8.76194, -63.90389], 'RR': [2.81972, -60.67333], 'SC': [-27.59667, -48.54917],
    'SP': [-23.55052, -46.63331], 'SE': [-10.91111, -37.07167], 'TO': [-10.18417, -48.33389]
};

let mapInstance = null;
let stateCircles = {};
let stateMarkers = {};

async function renderMapaBrasil() {
    const c = document.getElementById('map-brasil');
    if (!c) return;
    if (mapInstance) { mapInstance.remove(); mapInstance = null; }
    
    mapInstance = L.map('map-brasil').setView([-14.235, -51.9253], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM', maxZoom: 19 }).addTo(mapInstance);
    
    try {
        const data = await api.getMapaNacional();
        const estados = data.estados || [];
        if (!estados.length) return;
        
        const maxImpacto = Math.max(...estados.map(s => s.impacto_mil || 0), 1);
        
        estados.forEach(state => {
            const co = stateCoordinates[state.estado];
            if (!co) return;
            
            const impactoMil = state.impacto_mil || 0;
            const int = maxImpacto > 0 ? impactoMil / maxImpacto : 0;
            const radius = Math.max(8, Math.min(40, 8 + (int * 32)));
            
            const colors = ['#3182ce', '#667eea'];
            const colorIndex = estados.indexOf(state) % colors.length;
            const color = colors[colorIndex];
            
            const circle = L.circleMarker(co, {
                radius: radius,
                fillColor: color,
                color: '#1e3a5f',
                weight: 2,
                opacity: 0.8,
                fillOpacity: 0.5
            }).addTo(mapInstance);
            
            circle.originalColor = '#1e3a5f';
            circle.originalFillColor = color;
            stateCircles[state.estado] = circle;
            
            circle.bindPopup(`
                <div style="padding:8px;">
                    <strong>${state.estado}</strong><br>
                    Impacto: ${formatCurrencyMil(state.impacto_mil * 1000)}<br>
                    Quantidade: ${formatNumber(state.quantidade || 0)}
                </div>
            `);
            
            circle.on('click', function() {
                const currentFilters = api.getFilters();
                if (currentFilters.uf === state.estado) {
                    api.updateFilters({ uf: null });
                } else {
                    api.updateFilters({ uf: state.estado });
                }
            });
        });
        
        updateMapVisualization();
    } catch (error) {
        console.error('Erro ao renderizar mapa do Brasil:', error);
    }
}

function updateMapVisualization() {
    const currentFilters = api.getFilters();
    const activeUF = currentFilters.uf;

    Object.keys(stateCircles).forEach(uf => {
        const circle = stateCircles[uf];
        if (circle) {
            if (activeUF && uf === activeUF) {
                circle.setStyle({
                    fillOpacity: 0.9,
                    weight: 4,
                    color: '#1e3a5f',
                    fillColor: '#3182ce'
                });
                if (stateMarkers[uf]) stateMarkers[uf].openPopup();
            } else if (activeUF) {
                circle.setStyle({
                    fillOpacity: 0.2,
                    weight: 2,
                    color: circle.originalColor,
                    fillColor: circle.originalFillColor
                });
            } else {
                circle.setStyle({
                    fillOpacity: 0.5,
                    weight: 2,
                    color: circle.originalColor,
                    fillColor: circle.originalFillColor
                });
            }
        }
    });
}

function updateDashboardFilter(estado) {
    if (window.api) {
        window.api.updateFilters({ uf: estado });
    }
}

// Exportar funções
window.renderMapaBrasil = renderMapaBrasil;
window.updateDashboardFilter = updateDashboardFilter;

let mapInstanceAnaliseImpacto = null;
let cidadeMarkers = {};
let estadoCirclesAnaliseImpacto = {}; // Armazenar referências às bolhas do mapa de análise de impacto
let estadoSelecionadoAnaliseImpacto = null; // Estado atualmente selecionado

async function renderMapaAnaliseImpacto(estados) {
    var c = document.getElementById('map-analise-impacto');
    if (!c) return;
    if (mapInstanceAnaliseImpacto) { 
        mapInstanceAnaliseImpacto.remove(); 
        mapInstanceAnaliseImpacto = null; 
    }
    mapInstanceAnaliseImpacto = L.map('map-analise-impacto').setView([-14.235, -51.9253], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM', maxZoom: 19 }).addTo(mapInstanceAnaliseImpacto);
    
    if (!estados || !estados.length) return;
    
    // Buscar dados de capitais
    try {
        const capitaisData = await api.getCapitais();
        const capitais = capitaisData.capitais || [];
        
        // Criar mapa de estados para lookup rápido
        const estadosMap = {};
        estados.forEach(state => {
            estadosMap[state.estado] = state;
        });
        
        var maxQ = Math.max.apply(null, estados.map(function(s){ return Number(s.quantidade)||0; }).concat([1]));
        
        // Calcular tamanho baseado em prejuízo (impacto_total), não quantidade
        const maxImpacto = Math.max.apply(null, estados.map(function(s){ return Number(s.impacto_total)||0; }).concat([1]));
        
        capitais.forEach(function(capital){
            const estado = estadosMap[capital.uf];
            if (!estado) return;
            
            // Tamanho baseado em prejuízo (impacto_total)
            var impacto = Number(estado.impacto_total)||0;
            var int = maxImpacto>0 ? impacto/maxImpacto : 0;
            
            // Cores baseadas na magnitude do prejuízo
            var col = int>0.7 ? '#f56565' : int>0.4 ? '#ed8936' : '#48bb78';
            
            // Raio proporcional ao prejuízo (entre 8 e 50px)
            var r = Math.max(8, Math.min(50, 8 + (int * 42)));
            
            // Criar círculo na capital
            var circ = L.circleMarker([capital.lat, capital.lon], {
                color: col,
                fillColor: col,
                fillOpacity: 0.7,
                radius: r,
                weight: 2
            }).addTo(mapInstanceAnaliseImpacto);
            
            // Popup com informações do estado (prejuízo em R$ Mil)
            var impactoMil = (estado.impacto_total || 0) / 1000;
            var popupContent = '<div style="padding:8px;"><strong>'+capital.uf+' - '+capital.capital+'</strong><br>' +
                'Quantidade: '+new Intl.NumberFormat('pt-BR').format(estado.quantidade||0)+'<br>' +
                'Erro Sistêmico: '+formatCurrencyMil(estado.impacto_total||0)+'<br>' +
                'Tempo Médio: '+(Number(estado.tempo_medio)||0).toFixed(1)+' dias<br>' +
                '<button onclick="expandirCidades(\''+capital.uf+'\')" style="margin-top:5px; padding:4px 8px; background:#3182ce; color:white; border:none; border-radius:4px; cursor:pointer;">Ver Cidades</button>' +
                '</div>';
            circ.bindPopup(popupContent);
            
            // Armazenar referência ao círculo
            estadoCirclesAnaliseImpacto[capital.uf] = circ;
            circ.originalColor = col;
            circ.originalFillColor = col;
            circ.originalFillOpacity = 0.7;
            circ.originalWeight = 2;
            
            // Click handler para interatividade com gráfico
            circ.on('click', async function() {
                const ufSelecionado = capital.uf;
                
                // Se o mesmo estado foi clicado novamente, desmarcar
                if (estadoSelecionadoAnaliseImpacto === ufSelecionado) {
                    resetarFiltroEstadoAnaliseImpacto();
                } else {
                    // Destacar bolha clicada
                    destacarBolhaAnaliseImpacto(ufSelecionado);
                    
                    // Atualizar gráfico de distribuição por UF
                    if (window.chartFunctions && window.chartFunctions.updateDistribuicaoUFPorEstado) {
                        await window.chartFunctions.updateDistribuicaoUFPorEstado(ufSelecionado);
                    }
                }
            });
        });
    } catch (error) {
        console.error('Erro ao carregar capitais:', error);
        // Fallback: usar coordenadas antigas se houver
        var maxImpacto = Math.max.apply(null, estados.map(function(s){ return Number(s.impacto_total)||0; }).concat([1]));
        estados.forEach(function(state){
            var co = stateCoordinates[state.estado];
            if (!co) return;
            var impacto = Number(state.impacto_total)||0, int = maxImpacto>0 ? impacto/maxImpacto : 0;
            var col = int>0.7 ? '#f56565' : int>0.4 ? '#ed8936' : '#48bb78';
            var r = Math.max(8, Math.min(50, 8 + (int * 42)));
            var impactoMil = impacto / 1000;
            var circ = L.circleMarker(co, { color: col, fillColor: col, fillOpacity: 0.7, radius: r, weight: 2 }).addTo(mapInstanceAnaliseImpacto);
            circ.bindPopup('<div style="padding:8px;"><strong>'+state.estado+'</strong><br>Quantidade: '+new Intl.NumberFormat('pt-BR').format(state.quantidade||0)+'<br>Erro Sistêmico: '+formatCurrencyMil(impacto)+'<br>Tempo: '+(Number(state.tempo_medio)||0).toFixed(1)+' dias</div>');
            
            // Armazenar referência ao círculo
            estadoCirclesAnaliseImpacto[state.estado] = circ;
            circ.originalColor = col;
            circ.originalFillColor = col;
            circ.originalFillOpacity = 0.7;
            circ.originalWeight = 2;
            
            // Click handler para interatividade com gráfico
            circ.on('click', async function() {
                const ufSelecionado = state.estado;
                
                // Se o mesmo estado foi clicado novamente, desmarcar
                if (estadoSelecionadoAnaliseImpacto === ufSelecionado) {
                    resetarFiltroEstadoAnaliseImpacto();
                } else {
                    // Destacar bolha clicada
                    destacarBolhaAnaliseImpacto(ufSelecionado);
                    
                    // Atualizar gráfico de distribuição por UF
                    if (window.chartFunctions && window.chartFunctions.updateDistribuicaoUFPorEstado) {
                        await window.chartFunctions.updateDistribuicaoUFPorEstado(ufSelecionado);
                    }
                }
            });
        });
    }
}

async function expandirCidades(uf) {
    // Limpar marcadores de cidades anteriores
    Object.values(cidadeMarkers).forEach(marker => {
        if (mapInstanceAnaliseImpacto) {
            mapInstanceAnaliseImpacto.removeLayer(marker);
        }
    });
    cidadeMarkers = {};
    
    try {
        const cidadesData = await api.getCidadesPorUF(uf);
        const cidades = cidadesData.cidades || [];
        
        if (cidades.length === 0) {
            alert('Nenhuma cidade encontrada para ' + uf);
            return;
        }
        
        // Adicionar marcadores para cada cidade
        cidades.forEach(function(cidade){
            var marker = L.marker([cidade.lat, cidade.lon], {
                icon: L.divIcon({
                    className: 'cidade-marker',
                    html: '<div style="background:#3182ce; color:white; padding:4px 8px; border-radius:4px; font-size:10px; white-space:nowrap;">'+cidade.cidade+'</div>',
                    iconSize: [100, 20]
                })
            }).addTo(mapInstanceAnaliseImpacto);
            
            marker.bindPopup('<div style="padding:8px;"><strong>'+cidade.cidade+'</strong><br>' +
                'Qtd: '+new Intl.NumberFormat('pt-BR').format(cidade.quantidade)+'<br>' +
                'Impacto: '+new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cidade.impacto_total||0)+'</div>');
            
            cidadeMarkers[cidade.cidade] = marker;
        });
        
        // Ajustar zoom para mostrar todas as cidades
        if (cidades.length > 0) {
            var bounds = cidades.map(c => [c.lat, c.lon]);
            mapInstanceAnaliseImpacto.fitBounds(bounds, { padding: [50, 50] });
        }
    } catch (error) {
        console.error('Erro ao carregar cidades:', error);
        alert('Erro ao carregar cidades de ' + uf);
    }
}

// Função para destacar bolha no mapa de análise de impacto
function destacarBolhaAnaliseImpacto(uf) {
    estadoSelecionadoAnaliseImpacto = uf;
    
    Object.keys(estadoCirclesAnaliseImpacto).forEach(ufKey => {
        const circle = estadoCirclesAnaliseImpacto[ufKey];
        if (circle) {
            if (ufKey === uf) {
                // Destacar bolha selecionada
                circle.setStyle({
                    fillOpacity: 1.0,
                    weight: 4,
                    color: '#1e3a5f',
                    fillColor: '#3182ce'
                });
            } else {
                // Diminuir opacidade das outras bolhas
                circle.setStyle({
                    fillOpacity: 0.3,
                    weight: circle.originalWeight || 2,
                    color: circle.originalColor,
                    fillColor: circle.originalFillColor
                });
            }
        }
    });
}

// Função para resetar filtro de estado
function resetarFiltroEstadoAnaliseImpacto() {
    estadoSelecionadoAnaliseImpacto = null;
    
    Object.keys(estadoCirclesAnaliseImpacto).forEach(uf => {
        const circle = estadoCirclesAnaliseImpacto[uf];
        if (circle) {
            circle.setStyle({
                fillOpacity: circle.originalFillOpacity || 0.7,
                weight: circle.originalWeight || 2,
                color: circle.originalColor,
                fillColor: circle.originalFillColor
            });
        }
    });
    
    // Atualizar gráfico para mostrar todos os estados
    if (window.chartFunctions && window.chartFunctions.updateDistribuicaoUFPorEstado) {
        window.chartFunctions.updateDistribuicaoUFPorEstado(null);
    }
}

// Expor funções globalmente
window.expandirCidades = expandirCidades;
window.renderMapaAnaliseImpacto = renderMapaAnaliseImpacto;
window.destacarBolhaAnaliseImpacto = destacarBolhaAnaliseImpacto;
window.resetarFiltroEstadoAnaliseImpacto = resetarFiltroEstadoAnaliseImpacto;