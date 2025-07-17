// Arquivo: js/module_dispositivos.js

import { apiUrl, token, areasDisponiveis } from './app.js';
import { showToast, showConfirmModal, setButtonLoading } from './ui_utils.js';

// Constante específica deste módulo
const STATUS_OPCOES = ["OK", "Troca", "Substituido", "Consumido", "Danificado", "Extraviado", "Manutenção", "Acesso Impedido", "Desligada", "Implantação", "Removido"];

// --- Funções Principais do Módulo ---

export async function loadDispositivosModule() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1>Gestão de Dispositivos</h1>
            <button class="btn btn-success" data-action="open-lote-modal">
                <i class="bi bi-plus-slash-minus"></i> Adicionar em Lote
            </button>
        </div>
        
        <div class="card mb-4">
            <div class="card-header" id="form-titulo-disp">Adicionar Novo Dispositivo</div>
            <div class="card-body">
                 <form id="form-dispositivo">
                    <input type="hidden" id="dispositivo-id">
                    <div class="row g-3">
                        <div class="col-md-4"><label for="disp-area-select" class="form-label">Área*</label>
                            <select class="form-select" id="disp-area-select" required>
                                <option value="">Selecione...</option>
                                ${areasDisponiveis.map(a => `<option value="${a.id}">${a.nome}</option>`).join('')}
                            </select>
                        </div>
                        <div class="col-md-2"><label for="disp-numero" class="form-label">Número*</label><input type="text" class="form-control" id="disp-numero" required></div>
                        <div class="col-md-2">
                            <label for="disp-tipo" class="form-label">Tipo</label>
                            <select class="form-select" id="disp-tipo">
                                <option value="AL" selected>AL</option>
                                <option value="PPE">PPE</option>
                                <option value="PPI">PPI</option>
                            </select>
                        </div>
                        <div class="col-md-4"><label for="disp-status" class="form-label">Status</label><select class="form-select" id="disp-status"><option>Ativo</option><option>Inativo</option><option>Transferido</option></select></div>
                        <div class="col-12"><label for="disp-descricao" class="form-label">Descrição</label><input type="text" class="form-control" id="disp-descricao"></div>
                    </div>
                    <div class="d-flex justify-content-end mt-4">
                        <button type="button" class="btn btn-secondary me-2" data-action="cancel-edit-dispositivo" style="display: none;">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="btn-submit-disp">Adicionar Dispositivo</button>
                    </div>
                 </form>
            </div>
        </div>

        <h2>Dispositivos Cadastrados</h2>
        
        <div class="row mb-3">
            <div class="col-md-6">
                <label for="filtro-area-dispositivos" class="form-label fw-bold">Primeiro, selecione uma Área para começar:</label>
                <select class="form-select form-select-lg" id="filtro-area-dispositivos">
                    <option value="">-- Selecione uma Área --</option>
                    ${areasDisponiveis.map(a => `<option value="${a.id}">${a.nome}</option>`).join('')}
                </select>
            </div>
        </div>

        <div id="container-lista-dispositivos" style="display: none;">
            <div class="card card-body mb-3">
                <div class="row align-items-end">
                    <div class="col-md-12">
                        <label class="form-label">Filtrar por Tipo</label>
                        <ul class="nav nav-pills" id="pills-tab-disp">
                            <li class="nav-item"><button class="nav-link active" data-action="filter-dispositivos" data-filter="">Todos</button></li>
                            <li class="nav-item"><button class="nav-link" data-action="filter-dispositivos" data-filter="AL">AL</button></li>
                            <li class="nav-item"><button class="nav-link" data-action="filter-dispositivos" data-filter="PPE">PPE</button></li>
                            <li class="nav-item"><button class="nav-link" data-action="filter-dispositivos" data-filter="PPI">PPI</button></li>
                        </ul>
                    </div>
                </div>
            </div>
            <div class="table-responsive">
                <table class="table table-striped table-hover">
                    <thead><tr><th>Área</th><th>Número</th><th>Tipo</th><th>Descrição</th><th>Status</th><th>Ações</th></tr></thead>
                    <tbody id="tabela-dispositivos-corpo"></tbody>
                </table>
            </div>
        </div>

        <div id="placeholder-dispositivos" class="text-center text-muted mt-4">
            <p><i class="bi bi-arrow-up-circle fs-3"></i></p>
            <p>Selecione uma área acima para visualizar os dispositivos.</p>
        </div>
    `;
    
    document.getElementById('form-dispositivo').addEventListener('submit', handleDispositivoSubmit);
    document.getElementById('filtro-area-dispositivos').addEventListener('change', (event) => {
        const areaId = event.target.value;
        const containerLista = document.getElementById('container-lista-dispositivos');
        const placeholder = document.getElementById('placeholder-dispositivos');

        if (areaId) {
            containerLista.style.display = 'block';
            placeholder.style.display = 'none';
            fetchAndDisplayDispositivos();
        } else {
            containerLista.style.display = 'none';
            placeholder.style.display = 'block';
            document.getElementById('tabela-dispositivos-corpo').innerHTML = '';
        }
    });
}

export async function fetchAndDisplayDispositivos() {
    // Pega os valores atuais dos filtros
    const areaFiltro = document.getElementById('filtro-area-dispositivos').value;
    const tipoFiltroAtivo = document.querySelector('#pills-tab-disp .nav-link.active');
    const tipoFiltro = tipoFiltroAtivo ? tipoFiltroAtivo.dataset.filter : '';

    console.log(`PISTA 1: Buscando dispositivos para Area ID: '${areaFiltro}' e Tipo: '${tipoFiltro}'`);

    if (!areaFiltro) {
        console.log("Pista X: Nenhuma área selecionada, a função vai parar aqui.");
        return;
    }

    // Monta a URL da API dinamicamente
    let url = new URL(`${apiUrl}/api/dispositivos/`);
    url.searchParams.append('area_id', areaFiltro);
    if (tipoFiltro) {
        url.searchParams.append('tipo', tipoFiltro);
    }
    console.log(`PISTA 2: URL da API sendo chamada: ${url.toString()}`);

    const tabelaCorpo = document.getElementById('tabela-dispositivos-corpo');
    if(!tabelaCorpo) return;
    tabelaCorpo.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
    
    try {
        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` }});
        if (!response.ok) {
            throw new Error('Erro na resposta da API: ' + response.statusText);
        }
        
        const dispositivos = await response.json();
        // ESTA É A PISTA MAIS IMPORTANTE
        console.log("PISTA 3: Dados recebidos da API:", dispositivos); 
        
        tabelaCorpo.innerHTML = '';
        if(dispositivos.length === 0) {
            console.log("PISTA 4: Nenhum dispositivo encontrado, exibindo mensagem.");
            tabelaCorpo.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum dispositivo encontrado para os filtros selecionados.</td></tr>';
            return;
        }
        
        console.log(`PISTA 5: Encontrados ${dispositivos.length} dispositivos. Iniciando renderização da tabela.`);
        dispositivos.forEach(d => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${d.area.nome}</td>
                <td>${d.numero}</td>
                <td>${d.tipo}</td>
                <td>${d.descricao || ''}</td>
                <td><span class="badge bg-${d.status === 'Ativo' ? 'success' : 'danger'}">${d.status}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" data-action="edit-dispositivo" data-id="${d.id}"><i class="bi bi-pencil-square"></i> Editar</button>
                    <button class="btn btn-sm btn-outline-danger ms-1" data-action="delete-dispositivo" data-id="${d.id}"><i class="bi bi-trash3"></i> Excluir</button>
                </td>`;
            tabelaCorpo.appendChild(tr);
        });
        console.log("PISTA 6: Renderização da tabela concluída.");

    } catch (error) { 
        console.error("ERRO NA FUNÇÃO fetchAndDisplayDispositivos:", error);
        tabelaCorpo.innerHTML = `<tr><td colspan="6" class="text-danger">${error.message}</td></tr>`;
    }
}

async function handleDispositivoSubmit(event) {
    event.preventDefault();
    const submitButton = event.target.querySelector('button[type="submit"]');
    const id = document.getElementById('dispositivo-id').value;
    const data = {
        area_id: parseInt(document.getElementById('disp-area-select').value),
        numero: document.getElementById('disp-numero').value,
        tipo: document.getElementById('disp-tipo').value, 
        descricao: document.getElementById('disp-descricao').value,
        status: document.getElementById('disp-status').value,
    };
    if(!data.area_id || !data.numero) { showToast("Área e Número são obrigatórios.", "error"); return; }
    
    const url = id ? `${apiUrl}/api/dispositivos/${id}` : `${apiUrl}/api/dispositivos/`;
    const method = id ? 'PUT' : 'POST';
    setButtonLoading(submitButton, true);
    try {
        const response = await fetch(url, { method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!response.ok) { const err = await response.json(); throw new Error(err.detail); }
        showToast(`Dispositivo ${id ? 'atualizado' : 'criado'}!`, 'success');
        modoAdicionarDispositivo();
        fetchAndDisplayDispositivos();
    } catch (error) { 
        showToast(`Falha: ${error.message}`, 'error'); 
    } finally {
        setButtonLoading(submitButton, false, id ? 'Salvar Alterações' : 'Adicionar Dispositivo');
    }
}

export function iniciarEdicaoDispositivo(id) {
    fetch(`${apiUrl}/api/dispositivos/${id}`, { headers: { 'Authorization': `Bearer ${token}` } })
    .then(response => {
        if (!response.ok) throw new Error("Dispositivo não encontrado");
        return response.json();
    })
    .then(dispositivo => {
        document.getElementById('dispositivo-id').value = dispositivo.id;
        document.getElementById('disp-area-select').value = dispositivo.area.id;
        document.getElementById('disp-numero').value = dispositivo.numero;
        document.getElementById('disp-tipo').value = dispositivo.tipo;
        document.getElementById('disp-descricao').value = dispositivo.descricao || '';
        document.getElementById('disp-status').value = dispositivo.status;
        document.getElementById('form-titulo-disp').textContent = `Editando Dispositivo: ${dispositivo.area.nome} - ${dispositivo.numero}`;
        document.getElementById('btn-submit-disp').textContent = 'Salvar Alterações';
        document.querySelector('[data-action="cancel-edit-dispositivo"]').style.display = 'inline-block';
        window.scrollTo(0, 0);
    })
    .catch(error => showToast(error.message, 'error'));
}

export async function excluirDispositivo(id) {
    const confirmado = await showConfirmModal('Excluir Dispositivo', 'Tem certeza que deseja excluir este dispositivo?');
    if (!confirmado) return;
    try {
        const response = await fetch(`${apiUrl}/api/dispositivos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }});
        if (response.status !== 204) throw new Error('Falha ao excluir.');
        showToast('Dispositivo excluído!', 'success');
        fetchAndDisplayDispositivos();
    } catch (error) { showToast(`Falha: ${error.message}`, 'error'); }
}

export function modoAdicionarDispositivo() {
    const form = document.getElementById('form-dispositivo');
    if(!form) return;
    form.reset();
    document.getElementById('dispositivo-id').value = '';
    document.getElementById('form-titulo-disp').textContent = 'Adicionar Novo Dispositivo';
    document.getElementById('btn-submit-disp').textContent = 'Adicionar Dispositivo';
    document.querySelector('[data-action="cancel-edit-dispositivo"]').style.display = 'none';
}

export function abrirModalLote() {
    const oldModal = document.getElementById('loteModal');
    if (oldModal) oldModal.remove();
    const modalHtml = `
        <div class="modal fade" id="loteModal" tabindex="-1">
            <div class="modal-dialog"><div class="modal-content">
                <div class="modal-header"><h5 class="modal-title">Criar Dispositivos em Lote</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                <div class="modal-body"><form id="form-lote">
                    <div class="mb-3"><label for="lote-area" class="form-label">Área*</label>
                        <select class="form-select" id="lote-area" required>
                            <option value="">Selecione...</option>
                            ${areasDisponiveis.map(a => `<option value="${a.nome}">${a.nome}</option>`).join('')}
                        </select>
                    </div>
                    <div class="row">
                        <div class="col-md-6"><label for="lote-tipo" class="form-label">Tipo*</label>
                            <select class="form-select" id="lote-tipo"><option>AL</option><option>PPE</option><option>PPI</option></select>
                        </div>
                        <div class="col-md-6"><label for="lote-prefixo" class="form-label">Prefixo</label><input type="text" class="form-control" id="lote-prefixo" placeholder="Opcional"></div>
                    </div>
                    <div class="row mt-3">
                        <div class="col"><label for="lote-inicio" class="form-label">De*</label><input type="number" class="form-control" id="lote-inicio" min="1" required></div>
                        <div class="col"><label for="lote-fim" class="form-label">Até*</label><input type="number" class="form-control" id="lote-fim" min="1" required></div>
                    </div>
                </form></div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                    <button type="button" class="btn btn-primary" id="btn-submit-lote">Criar Dispositivos</button>
                </div>
            </div></div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const loteModal = new bootstrap.Modal(document.getElementById('loteModal'));
    document.getElementById('btn-submit-lote').addEventListener('click', handleLoteSubmit);
    loteModal.show();
}

async function handleLoteSubmit(event) {
    const submitButton = event.target;
    const payload = {
        area: document.getElementById('lote-area').value,
        tipo: document.getElementById('lote-tipo').value,
        prefixo: document.getElementById('lote-prefixo').value || document.getElementById('lote-tipo').value,
        numero_inicio: parseInt(document.getElementById('lote-inicio').value),
        numero_fim: parseInt(document.getElementById('lote-fim').value),

        // ✅ LINHA FALTANDO ADICIONADA:
        // Assumimos 'Ativo' como padrão para novos dispositivos criados em lote.
        status: 'Ativo'
    };

    if (!payload.area || !payload.tipo || !payload.numero_inicio || !payload.numero_fim) {
        showToast("Preencha todos os campos obrigatórios (*).", 'error');
        return;
    }

    setButtonLoading(submitButton, true);
    try {
        const response = await fetch(`${apiUrl}/api/dispositivos/lote`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok) {
            // A resposta de erro do FastAPI geralmente está em 'detail'
            throw new Error(result.detail || "Erro desconhecido ao criar dispositivos.");
        }

        showToast(`${result.length} dispositivo(s) do tipo '${payload.tipo}' criado(s) com sucesso!`, 'success');
        bootstrap.Modal.getInstance(document.getElementById('loteModal')).hide();

        // Se o usuário estiver vendo a área correta, atualiza a lista
        if (document.getElementById('filtro-area-dispositivos').selectedOptions[0].text === payload.area) {
            fetchAndDisplayDispositivos();
        }

    } catch (error) { 
        showToast(`Falha ao criar em lote: ${error.message}`, 'error'); 
    } finally {
        setButtonLoading(submitButton, false, 'Criar Dispositivos');
    }
}

export async function abrirModalVerificacao(servicoId, areaId) {
    const response = await fetch(`${apiUrl}/api/dispositivos/?area_id=${areaId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const dispositivos = await response.json();

    if (dispositivos.length === 0) {
        showToast("Nenhum dispositivo cadastrado para esta área.", "info");
        return;
    }

    const dispositivosAgrupados = dispositivos.reduce((acc, d) => {
        (acc[d.tipo] = acc[d.tipo] || []).push(d);
        return acc;
    }, {});

    let navTabsHtml = '<ul class="nav nav-tabs mb-3" id="dispositivosTab" role="tablist">';
    let isFirstTab = true;
    for (const tipo in dispositivosAgrupados) {
        navTabsHtml += `<li class="nav-item" role="presentation"><button class="nav-link ${isFirstTab ? 'active' : ''}" id="tab-${tipo}" data-bs-toggle="tab" data-bs-target="#pane-${tipo}" type="button" role="tab">${tipo}</button></li>`;
        isFirstTab = false;
    }
    navTabsHtml += '</ul>';

    let tabContentHtml = '<div class="tab-content" id="dispositivosTabContent">';
    isFirstTab = true;
    for (const tipo in dispositivosAgrupados) {
        const dispositivosDoTipo = dispositivosAgrupados[tipo];
        tabContentHtml += `<div class="tab-pane fade ${isFirstTab ? 'show active' : ''}" id="pane-${tipo}" role="tabpanel">`;
        
        dispositivosDoTipo.forEach(d => {
            let inputHtml = '';
            if (d.status !== 'Inativo' && d.status !== 'Transferido') {
                const opcoesHtml = STATUS_OPCOES.map(opt => `<option value="${opt}" ${d.status === opt ? 'selected' : ''}>${opt}</option>`).join('');
                inputHtml = `<select class="form-select form-select-sm" data-dispositivo-id="${d.id}">${opcoesHtml}</select>`;
            } else {
                inputHtml = `<input type="text" class="form-control-plaintext form-control-sm text-muted" value="${d.status}" readonly disabled>`;
            }

            tabContentHtml += `
                <div class="row mb-2 align-items-center">
                    <div class="col-sm-6"><label class="form-label mb-0">${d.tipo} - ${d.numero}</label></div>
                    <div class="col-sm-6">${inputHtml}</div>
                </div>
            `;
        });
        
        tabContentHtml += `</div>`;
        isFirstTab = false;
    }
    tabContentHtml += '</div>';

    const modalHtml = `
        <div class="modal fade" id="verificacaoModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-scrollable"><div class="modal-content">
                <div class="modal-header"><h5 class="modal-title">Verificar Dispositivos do Serviço #${servicoId}</h5></div>
                <div class="modal-body"><form id="form-verificacao">${navTabsHtml}${tabContentHtml}</form></div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                    <button type="button" class="btn btn-primary" id="btn-salvar-verificacao">Salvar Status</button>
                </div>
            </div></div>
        </div>`;
    
    const oldModal = document.getElementById('verificacaoModal');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modalEl = document.getElementById('verificacaoModal');
    const verificacaoModal = new bootstrap.Modal(modalEl);
    
    document.getElementById('btn-salvar-verificacao').addEventListener('click', () => handleVerificacaoSubmit(servicoId));
    modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());
    verificacaoModal.show();
}

async function handleVerificacaoSubmit(servicoId) {
    const selects = document.querySelectorAll('#form-verificacao select');
    const payload = Array.from(selects).map(select => ({
        dispositivo_id: parseInt(select.dataset.dispositivoId),
        status: select.value
    }));

    try {
        const response = await fetch(`${apiUrl}/api/servicos/${servicoId}/dispositivos-status`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error("Falha ao salvar status.");

        showToast("Status dos dispositivos salvos com sucesso!", "success");
        bootstrap.Modal.getInstance(document.getElementById('verificacaoModal')).hide();
        // Não precisamos recarregar a lista de serviços aqui, a menos que a tabela mostre esse status
    } catch (error) {
        showToast(error.message, 'error');
    }
}