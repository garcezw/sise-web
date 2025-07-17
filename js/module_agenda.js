import { apiUrl, token, currentUser } from './app.js';
import { showToast, setButtonLoading, showConfirmModal } from './ui_utils.js';

let nav = 0; 
let eventosDoMes = []; 

// =================================================================
// INICIALIZAÇÃO E RENDERIZAÇÃO PRINCIPAL
// =================================================================

export function loadAgendaModule() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1 class="mb-0">Agenda de Atividades</h1>
            <button class="btn btn-primary" id="todayButton"><i class="bi bi-calendar-check"></i> Mês Atual</button>
        </div>
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <button class="btn btn-outline-primary" id="backButton"><i class="bi bi-arrow-left-circle"></i> Anterior</button>
                <h3 id="monthDisplay" class="mb-0 h4"></h3>
                <button class="btn btn-outline-primary" id="nextButton">Próximo <i class="bi bi-arrow-right-circle"></i></button>
            </div>
            <div id="calendar-container">
                <div id="weekdays">
                    ${['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'].map(day => `<div>${day}</div>`).join('')}
                </div>
                <div id="calendar" class="p-2"></div>
            </div>
        </div>
        <div id="agenda-detalhes" class="mt-4"></div>
        <div class="row mt-4">
            <div class="col-lg-6">
                <div class="card">
                    <div class="card-header"><h5 class="card-title mb-0"><i class="bi bi-exclamation-triangle-fill text-success"></i> Ocorrências do Mês</h5></div>
                    <div class="card-body p-0"><ul class="list-group list-group-flush" id="lista-ocorrencias"></ul></div>
                </div>
            </div>
            <div class="col-lg-6">
                <div class="card">
                    <div class="card-header"><h5 class="card-title mb-0"><i class="bi bi-calendar-plus-fill text-primary"></i> Agendamentos do Mês</h5></div>
                    <div class="card-body p-0"><ul class="list-group list-group-flush" id="lista-agendamentos"></ul></div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('backButton').addEventListener('click', () => { nav--; renderCalendar(); });
    document.getElementById('nextButton').addEventListener('click', () => { nav++; renderCalendar(); });
    document.getElementById('todayButton').addEventListener('click', () => { nav = 0; renderCalendar(); });
    
    renderCalendar();
}

async function renderCalendar() {
    const dt = new Date();
    dt.setDate(1);
    if (nav !== 0) dt.setMonth(new Date().getMonth() + nav);

    const year = dt.getFullYear();
    const month = dt.getMonth();
    const monthForAPI = month + 1;

    document.getElementById('monthDisplay').innerText = 
        `${dt.toLocaleDateString('pt-br', { month: 'long' }).toUpperCase()} ${year}`;

    fetchAndDisplayAgendaLists(year, monthForAPI);

    const calendarGrid = document.getElementById('calendar');
    calendarGrid.innerHTML = '<div class="w-100 text-center p-5"><div class="spinner-border text-primary"></div></div>';
    
    try {
        const response = await fetch(`${apiUrl}/api/agenda/mes/${year}/${monthForAPI}`, { headers: { 'Authorization': `Bearer ${token}` }});
        if (!response.ok) throw new Error('Falha ao buscar eventos da agenda.');
        eventosDoMes = await response.json();
    } catch(error) {
        showToast(error.message, 'error');
        eventosDoMes = [];
    }

    calendarGrid.innerHTML = ''; 

    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dateString = firstDayOfMonth.toLocaleDateString('en-us', { weekday: 'long' });
    const paddingDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(dateString);
    const today = new Date();

    for(let i = 1; i <= paddingDays + daysInMonth; i++) {
        const daySquare = document.createElement('div');
        daySquare.classList.add('day');
        const dayOfMonth = i - paddingDays;

        if (i > paddingDays) {
            const dayString = `${year}-${String(monthForAPI).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
            daySquare.innerText = dayOfMonth;

            // ✅ LÓGICA DE DESTAQUE ATUALIZADA
            if (dayOfMonth === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                daySquare.classList.add('today');
            }
            
            const eventosDoDia = eventosDoMes.filter(e => e.data === dayString);
            if (eventosDoDia.length > 0) {
                // Adiciona a classe de cor na borda do dia
                if (eventosDoDia.some(e => e.tipo === 'ocorrencia')) {
                    daySquare.classList.add('day-with-occurrence');
                }
                if (eventosDoDia.some(e => e.tipo === 'agendamento' || e.tipo === 'servico')) {
                    daySquare.classList.add('day-with-appointment');
                }

                // Adiciona os pequenos marcadores de evento
                eventosDoDia.forEach(evento => {
                    const eventDiv = document.createElement('div');
                    eventDiv.classList.add('event', evento.tipo);
                    eventDiv.innerText = evento.descricao;
                    daySquare.appendChild(eventDiv);
                });
            }
            daySquare.addEventListener('click', () => openDayModal(dayString));
        } else {
            daySquare.classList.add('padding');
        }
        calendarGrid.appendChild(daySquare);      
    }
}

function openDayModal(clickedDate) {
    const eventosDoDia = eventosDoMes.filter(e => e.data === clickedDate);
    const detalhesDiv = document.getElementById('agenda-detalhes');
    
    let htmlEventos = '<h5>Nenhum evento para esta data.</h5>';
    if (eventosDoDia.length > 0) {
        htmlEventos = `<h5>Eventos em ${new Date(clickedDate+'T00:00:00').toLocaleDateString('pt-br')}:</h5><ul class="list-group">${eventosDoDia.map(e => `<li class="list-group-item">${e.descricao} (Status: ${e.status})</li>`).join('')}</ul>`;
    }

    detalhesDiv.innerHTML = `<div class="card"><div class="card-header d-flex justify-content-between align-items-center"><span>Detalhes do Dia</span><button type="button" class="btn-close" onclick="document.getElementById('agenda-detalhes').innerHTML=''"></button></div><div class="card-body">${htmlEventos}<hr><div class="d-flex justify-content-end"><button class="btn btn-success me-2" data-action="abrir-form-ocorrencia" data-date="${clickedDate}">Registrar Ocorrência</button><button class="btn btn-primary" data-action="abrir-form-agendamento" data-date="${clickedDate}">Novo Agendamento</button></div></div></div>`;
    detalhesDiv.scrollIntoView({ behavior: 'smooth' });
}

// =================================================================
// LÓGICA DAS LISTAS DE CONSULTA
// =================================================================

async function fetchAndDisplayAgendaLists(year, month) {
    const ocorrenciasList = document.getElementById('lista-ocorrencias');
    const agendamentosList = document.getElementById('lista-agendamentos');
    ocorrenciasList.innerHTML = '<li class="list-group-item">Carregando...</li>';
    agendamentosList.innerHTML = '<li class="list-group-item">Carregando...</li>';
    try {
        const urlOcorrencias = `${apiUrl}/api/agenda/ocorrencias/?year=${year}&month=${month}`;
        const urlAgendamentos = `${apiUrl}/api/agenda/agendamentos/?year=${year}&month=${month}`;

        const [ocorrenciasRes, agendamentosRes] = await Promise.all([
            fetch(urlOcorrencias, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(urlAgendamentos, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        
        const ocorrencias = await ocorrenciasRes.json();
        const agendamentos = await agendamentosRes.json();
        
        ocorrenciasList.innerHTML = '';
        if (ocorrencias.length > 0) {
            ocorrencias.forEach(item => {
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center';
                li.innerHTML = `<div><strong>${item.area.nome}</strong> (${new Date(item.data_ocorrencia+'T00:00:00').toLocaleDateString('pt-br')})<p class="mb-0 text-muted">${item.descricao}</p></div><div class="btn-group"><button class="btn btn-sm btn-outline-primary" data-action="edit-ocorrencia" data-id="${item.id}" title="Editar Ocorrência"><i class="bi bi-pencil-square"></i></button><button class="btn btn-sm btn-outline-danger" data-action="delete-ocorrencia" data-id="${item.id}" title="Excluir Ocorrência"><i class="bi bi-trash"></i></button></div>`;
                ocorrenciasList.appendChild(li);
            });
        } else {
            ocorrenciasList.innerHTML = '<li class="list-group-item">Nenhuma ocorrência neste mês.</li>';
        }
        
        agendamentosList.innerHTML = '';
        if (agendamentos.length > 0) {
            agendamentos.forEach(item => {
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center';
                li.innerHTML = `<div><strong>${item.area.nome}</strong> - ${item.tipo_servico}<p class="mb-0 text-muted">Agendado para: ${new Date(item.data_agendamento+'T00:00:00').toLocaleDateString('pt-br')}</p></div><div class="btn-group"><button class="btn btn-sm btn-outline-primary" data-action="edit-agendamento" data-id="${item.id}" title="Editar Agendamento"><i class="bi bi-pencil-square"></i></button><button class="btn btn-sm btn-outline-danger" data-action="delete-agendamento" data-id="${item.id}" title="Excluir Agendamento"><i class="bi bi-trash"></i></button></div>`;
                agendamentosList.appendChild(li);
            });
        } else {
            agendamentosList.innerHTML = '<li class="list-group-item">Nenhum agendamento neste mês.</li>';
        }
    } catch (error) {
        console.error("Erro ao buscar listas da agenda:", error);
        showToast("Não foi possível carregar as listas da agenda.", "error");
    }
}

// =================================================================
// LÓGICA DE AGENDAMENTOS
// =================================================================

export async function abrirModalAgendamento(data) {
    const modalEl = document.getElementById('modal-agendamento');
    if (!modalEl) return;
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    const form = document.getElementById('form-agendamento');
    form.reset();
    form.classList.remove('was-validated');
    delete form.dataset.editId;
    document.getElementById('modalAgendamentoLabel').innerText = 'Novo Agendamento';
    document.getElementById('agendamento-data').value = data;
    const selectArea = document.getElementById('agendamento-area');
    selectArea.innerHTML = '<option value="" selected disabled>Carregando...</option>';
    try {
        const response = await fetch(`${apiUrl}/api/areas/`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error('Falha ao buscar áreas.');
        const areas = await response.json();
        selectArea.innerHTML = '<option value="" selected disabled>Selecione uma área</option>';
        areas.forEach(area => selectArea.add(new Option(area.nome, area.id)));
    } catch (error) {
        console.error("Erro ao popular áreas:", error);
        selectArea.innerHTML = '<option value="" selected disabled>Erro ao carregar</option>';
    }
    modal.show();
}

async function handleAgendamentoSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.closest('.modal-content').querySelector('button[type="submit"]');
    if (!form.checkValidity()) {
        event.stopPropagation();
        form.classList.add('was-validated');
        return;
    }
    const editId = form.dataset.editId;
    const method = editId ? 'PUT' : 'POST';
    const url = editId ? `${apiUrl}/api/agenda/agendamentos/${editId}` : `${apiUrl}/api/agenda/agendamentos/`;
    setButtonLoading(submitButton, true, "Salvando...");
    const agendamentoData = {
        horario: document.getElementById('agendamento-horario').value || null,
        tipo_servico: document.getElementById('agendamento-servico').value,
        observacoes: document.getElementById('agendamento-obs').value,
    };
    if (method === 'POST') {
        agendamentoData.data_agendamento = document.getElementById('agendamento-data').value;
        agendamentoData.area_id = parseInt(document.getElementById('agendamento-area').value, 10);
        agendamentoData.responsavel_id = currentUser.id;
    }
    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(agendamentoData)
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Falha ao salvar o agendamento.');
        }
        showToast(editId ? 'Agendamento atualizado!' : 'Agendamento registrado!', 'success');
        bootstrap.Modal.getInstance(form.closest('.modal')).hide();
        renderCalendar();
        fetchAndDisplayAgendaLists();
    } catch (error) {
        console.error("Erro ao salvar agendamento:", error);
        showToast(error.message, "error");
    } finally {
        setButtonLoading(submitButton, false, "Salvar");
    }
}

export async function iniciarEdicaoAgendamento(id) {
    try {
        const response = await fetch(`${apiUrl}/api/agenda/agendamentos/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("Não foi possível carregar os dados do agendamento.");
        const agendamento = await response.json();
        await abrirModalAgendamento(agendamento.data_agendamento);
        const form = document.getElementById('form-agendamento');
        form.dataset.editId = id;
        document.getElementById('modalAgendamentoLabel').innerText = 'Editar Agendamento';
        setTimeout(() => {
             document.getElementById('agendamento-area').value = agendamento.area_id;
             document.getElementById('agendamento-horario').value = agendamento.horario;
             document.getElementById('agendamento-servico').value = agendamento.tipo_servico;
             document.getElementById('agendamento-obs').value = agendamento.observacoes;
        }, 200);
    } catch (error) {
        console.error("Erro ao iniciar edição de agendamento:", error);
        showToast(error.message, "error");
    }
}

export async function iniciarExclusaoAgendamento(id) {
    const confirmado = await showConfirmModal("Confirmar Exclusão", "Você tem certeza de que deseja excluir este agendamento?");
    if (confirmado) {
        try {
            const response = await fetch(`${apiUrl}/api/agenda/agendamentos/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.status !== 204) throw new Error('Falha ao excluir o agendamento.');
            showToast("Agendamento excluído com sucesso!", "success");
            renderCalendar();
            fetchAndDisplayAgendaLists();
        } catch (error) {
            console.error("Erro ao excluir agendamento:", error);
            showToast(error.message, "error");
        }
    }
}

// =================================================================
// LÓGICA DE OCORRÊNCIAS
// =================================================================

export async function abrirModalOcorrencia(data) {
    const modalEl = document.getElementById('modal-ocorrencia');
    if (!modalEl) return;
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    const form = document.getElementById('form-ocorrencia');
    form.reset();
    form.classList.remove('was-validated');
    delete form.dataset.editId;
    document.getElementById('modalOcorrenciaLabel').innerText = 'Registrar Nova Ocorrência';
    document.getElementById('ocorrencia-data').value = data;
    const selectArea = document.getElementById('ocorrencia-area');
    selectArea.innerHTML = '<option value="" selected disabled>Carregando...</option>';
    try {
        const response = await fetch(`${apiUrl}/api/areas/`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error('Falha ao buscar áreas.');
        const areas = await response.json();
        selectArea.innerHTML = '<option value="" selected disabled>Selecione uma área</option>';
        areas.forEach(area => selectArea.add(new Option(area.nome, area.id)));
    } catch (error) {
        console.error("Erro ao popular áreas:", error);
        selectArea.innerHTML = '<option value="" selected disabled>Erro ao carregar</option>';
    }
    modal.show();
}

async function handleOcorrenciaSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.closest('.modal-content').querySelector('button[type="submit"]');
    if (!form.checkValidity()) {
        event.stopPropagation();
        form.classList.add('was-validated');
        return;
    }
    const editId = form.dataset.editId;
    const method = editId ? 'PUT' : 'POST';
    const url = editId ? `${apiUrl}/api/agenda/ocorrencias/${editId}` : `${apiUrl}/api/agenda/ocorrencias/`;
    setButtonLoading(submitButton, true, "Salvando...");
    const ocorrenciaData = {};
    if (method === 'POST') {
        ocorrenciaData.data_ocorrencia = document.getElementById('ocorrencia-data').value;
        ocorrenciaData.area_id = parseInt(document.getElementById('ocorrencia-area').value, 10);
        ocorrenciaData.registrado_por_id = currentUser.id;
    }
    ocorrenciaData.descricao = document.getElementById('ocorrencia-descricao').value;
    ocorrenciaData.nivel_urgencia = document.getElementById('ocorrencia-urgencia').value;
    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(ocorrenciaData)
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Falha ao salvar a ocorrência.');
        }
        showToast(editId ? 'Ocorrência atualizada!' : 'Ocorrência registrada!', 'success');
        bootstrap.Modal.getInstance(form.closest('.modal')).hide();
        renderCalendar();
        fetchAndDisplayAgendaLists();
    } catch (error) {
        console.error("Erro ao salvar ocorrência:", error);
        showToast(error.message, "error");
    } finally {
        setButtonLoading(submitButton, false, "Salvar");
    }
}

export async function iniciarEdicaoOcorrencia(id) {
    try {
        const response = await fetch(`${apiUrl}/api/agenda/ocorrencias/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("Não foi possível carregar dados da ocorrência.");
        const ocorrencia = await response.json();
        await abrirModalOcorrencia(ocorrencia.data_ocorrencia);
        const form = document.getElementById('form-ocorrencia');
        form.dataset.editId = id;
        document.getElementById('modalOcorrenciaLabel').innerText = 'Editar Ocorrência';
        setTimeout(() => {
             document.getElementById('ocorrencia-area').value = ocorrencia.area_id;
             document.getElementById('ocorrencia-urgencia').value = ocorrencia.nivel_urgencia;
             document.getElementById('ocorrencia-descricao').value = ocorrencia.descricao;
        }, 200);
    } catch (error) {
        console.error("Erro ao iniciar edição:", error);
        showToast(error.message, "error");
    }
}

export async function iniciarExclusaoOcorrencia(id) {
    const confirmado = await showConfirmModal("Confirmar Exclusão", "Você tem certeza de que deseja excluir esta ocorrência? Esta ação não pode ser desfeita.");
    if (confirmado) {
        try {
            const response = await fetch(`${apiUrl}/api/agenda/ocorrencias/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.status !== 204) throw new Error('Falha ao excluir a ocorrência.');
            showToast("Ocorrência excluída com sucesso!", "success");
            renderCalendar();
            fetchAndDisplayAgendaLists();
        } catch (error) {
            console.error("Erro ao excluir ocorrência:", error);
            showToast(error.message, "error");
        }
    }
}

// =================================================================
// EVENT LISTENERS GLOBAIS
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    const formOcorrencia = document.getElementById('form-ocorrencia');
    if (formOcorrencia) {
        formOcorrencia.addEventListener('submit', handleOcorrenciaSubmit);
    }
    const formAgendamento = document.getElementById('form-agendamento');
    if(formAgendamento) {
        formAgendamento.addEventListener('submit', handleAgendamentoSubmit);
    }
});