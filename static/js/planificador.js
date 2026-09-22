let mapa, directionsService, directionsRenderer;
let marcadorInicio = null;
let marcadorFinal = null;
let selecaoPonto = null;

// Lista de ruas/avenidas que devem ser evitadas (personalize conforme necessário)
const ruasProibidas = [
    'perimetral', 
    'av. perimetral', 
    'avenida perimetral',
    'br-316',
    'rodovia',
    'mário covas',
    'br316',
    'estrada',
    'via expressa'
];

// Polígonos aproximados do campus UFPA Guamá (ajuste as coordenadas)
const poligonosCampus = [
    [
        {lat: -1.468, lng: -48.449},
        {lat: -1.468, lng: -48.459},
        {lat: -1.478, lng: -48.459},
        {lat: -1.478, lng: -48.449}
    ]
];

window.markers = [];

// Inicializar o mapa
function iniciarMapa() {
    mapa = new google.maps.Map(document.getElementById('mapa'), {
        zoom: 16,
        center: { lat: -1.4734421601851373, lng: -48.45414365652551 },
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        fullscreenControl: false,
        mapTypeControl: false
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer();
    directionsRenderer.setMap(mapa);
}

function ativarSelecaoPontos(type) {
    selecaoPonto = type;

    const listener = mapa.addListener('click', function (event) {
        const coords = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng()
        };

        if (type === 'start') {
            if (marcadorInicio) marcadorInicio.setMap(null);
            marcadorInicio = new google.maps.Marker({
                position: coords,
                map: mapa,
                label: 'A'
            });
            document.getElementById('start-point').value = `${coords.lat},${coords.lng}`;
        }

        if (type === 'end') {
            if (marcadorFinal) marcadorFinal.setMap(null);
            marcadorFinal = new google.maps.Marker({
                position: coords,
                map: mapa,
                label: 'B'
            });
            document.getElementById('end-point').value = `${coords.lat},${coords.lng}`;
        }

        google.maps.event.removeListener(listener);
    });
}

function coletarCoordenadas(input) {
    const coordPattern = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;
    if (coordPattern.test(input.trim())) {
        const [lat, lng] = input.trim().split(',').map(Number);
        return { lat, lng };
    } else {
        alert('Digite as coordenadas no formato "lat,lng" ou selecione no mapa.');
        return null;
    }
}

// Verifica se uma instrução contém ruas proibidas
function contemRuaProibida(instrucao) {
    const instrucaoLower = instrucao.toLowerCase();
    return ruasProibidas.some(rua => instrucaoLower.includes(rua));
}

// Verifica se a rota é válida (não usa ruas proibidas)
function verificarRotaValida(rota) {
    try {
        const passos = rota.legs[0].steps;
        
        for (const passo of passos) {
            const instrucao = passo.instructions.replace(/<[^>]*>/g, '');
            if (contemRuaProibida(instrucao)) {
                return false; // Rota inválida - contém rua proibida
            }
        }
        
        return true; // Rota válida
    } catch (error) {
        console.error('Erro ao verificar rota:', error);
        return false; // Em caso de erro, considera inválida
    }
}

// Função principal para gerar rota com restrições
function gerarRota() {
    const inputInicio = document.getElementById('start-point').value;
    const inputFinal = document.getElementById('end-point').value;

    const coordenadaInicio = coletarCoordenadas(inputInicio);
    const coordenadaFinal = coletarCoordenadas(inputFinal);

    if (!coordenadaInicio || !coordenadaFinal) {
        alert('Selecione os dois pontos.');
        return;
    }

    const request = {
        origin: coordenadaInicio,
        destination: coordenadaFinal,
        travelMode: google.maps.TravelMode.WALKING,
        provideRouteAlternatives: true // Solicita rotas alternativas
    };

    directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
            let rotaValidaEncontrada = false;
            
            // Verifica todas as rotas alternativas
            for (let i = 0; i < result.routes.length; i++) {
                const rota = result.routes[i];
                
                if (verificarRotaValida(rota)) {
                    // Encontrou uma rota válida
                    directionsRenderer.setDirections({
                        routes: [rota],
                        request: result.request
                    });
                    mostrarPassosRota({routes: [rota]});
                    rotaValidaEncontrada = true;
                    break;
                }
            }
            
            if (!rotaValidaEncontrada) {
                // Se nenhuma rota for válida, mostra a primeira com aviso
                directionsRenderer.setDirections(result);
                mostrarPassosRota(result);
                alert('Atenção: Esta rota utiliza vias externas ao campus. Tente pontos mais internos ou verifique os passos.');
            }
            
        } else {
            console.error('Erro ao calcular rota:', status);
            alert('Não foi possível calcular a rota.');
        }
    });
}

// Versão alternativa que força rotas internas com waypoints
function gerarRotaForcada() {
    const inputInicio = document.getElementById('start-point').value;
    const inputFinal = document.getElementById('end-point').value;

    const coordenadaInicio = coletarCoordenadas(inputInicio);
    const coordenadaFinal = coletarCoordenadas(inputFinal);

    if (!coordenadaInicio || !coordenadaFinal) {
        alert('Selecione os dois pontos.');
        return;
    }

    // Waypoints estratégicos dentro do campus (ajuste conforme necessário)
    const waypointsInternos = [
        {location: {lat: -1.4735, lng: -48.4545}, stopover: false},
        {location: {lat: -1.4730, lng: -48.4540}, stopover: false}
    ];

    const request = {
        origin: coordenadaInicio,
        destination: coordenadaFinal,
        waypoints: waypointsInternos,
        travelMode: google.maps.TravelMode.WALKING,
        optimizeWaypoints: true
    };

    directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
            directionsRenderer.setDirections(result);
            mostrarPassosRota(result);
        } else {
            // Fallback para rota normal
            alert('Não foi possível gerar rota interna. Tentando rota normal...');
            gerarRota();
        }
    });
}

function mostrarPassosRota(result) {
    const divPassos = document.getElementById('pontos');
    divPassos.innerHTML = '';

    const passos = result.routes[0].legs[0].steps;
    
    // Adiciona cabeçalho com informações da rota
    const infoHeader = document.createElement('div');
    infoHeader.className = 'alert alert-info';
    infoHeader.innerHTML = `
        <strong>Distância total:</strong> ${result.routes[0].legs[0].distance.text}<br>
        <strong>Tempo estimado:</strong> ${result.routes[0].legs[0].duration.text}
    `;
    divPassos.appendChild(infoHeader);

    passos.forEach((passo, index) => {
        const instrucao = passo.instructions.replace(/<[^>]*>/g, '');
        const distancia = passo.distance.text;
        const duracao = passo.duration.text;

        const passoDiv = document.createElement('div');
        passoDiv.className = 'card mb-2';
        
        // Destaca passos com ruas proibidas
        if (contemRuaProibida(instrucao)) {
            passoDiv.className += ' border-danger';
        }
        
        passoDiv.innerHTML = `
            <div class="card-body">
                <h6 class="card-title">Passo ${index + 1}</h6>
                <p class="card-text">${instrucao}</p>
                <small class="text-muted">${distancia} • ${duracao}</small>
            </div>
        `;
        divPassos.appendChild(passoDiv);
    });
}

function resetarEntradas() {
    document.getElementById('start-point').value = '';
    document.getElementById('end-point').value = '';
    document.getElementById('pontos').innerHTML = '';

    if (directionsRenderer) {
        directionsRenderer.setMap(null);
        directionsRenderer = new google.maps.DirectionsRenderer();
        directionsRenderer.setMap(mapa);
    }

    if (marcadorInicio) {
        marcadorInicio.setMap(null);
        marcadorInicio = null;
    }
    if (marcadorFinal) {
        marcadorFinal.setMap(null);
        marcadorFinal = null;
    }
}

// Adiciona botão alternativo no HTML
function adicionarBotoesAlternativos() {
    const buscarDiv = document.getElementById('buscar');
    
    const btnForcarRota = document.createElement('button');
    btnForcarRota.className = 'btn btn-info col-12 mt-2';
    btnForcarRota.innerHTML = '<i class="fa-solid fa-route"></i> Forçar Rota Interna';
    btnForcarRota.onclick = gerarRotaForcada;
    btnForcarRota.title = 'Tenta forçar rota dentro do campus';
    
    buscarDiv.appendChild(btnForcarRota);
}

window.onload = () => {
    iniciarMapa();
    adicionarBotoesAlternativos(); // Adiciona o botão extra
};