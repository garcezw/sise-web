import { apiUrl, token } from './app.js';
import { showToast, showConfirmModal, setButtonLoading } from './ui_utils.js';

let areasDisponiveisCache = []; // Cache local para este módulo

export async function loadAreasModule() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `
        <h1 class="mb-4">Gestão de Áreas</h1>
        <div class="card mb-4">
            <div class="card-header" id="form-titulo-area">Adicionar Nova Área</div>
            <div class="card-body">
                <form id="form-area">
                    <input type="hidden" id="area-id">
                    <div class="row g-3">
                        <div class="col-md-6"><label for="area-nome" class="form-label">Nome da Área*</label><input type="text" class="form-control" id="area-nome" required></div>
                        <div class="col-md-6"><label for="area-responsavel" class="form-label">Responsável</label><input type="text" class="form-control" id="area-responsavel"></div>
                        <div class="col-md-6"><label for="area-telefone" class="form-label">Telefone</label><input type="text" class="form-control" id="area-telefone"></div>
                    </div>
                    <div class="d-flex justify-content-end mt-4">
                        <button type="button" class="btn btn-secondary me-2" data-action="cancel-edit-area" style="display: none;">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="btn-submit-area">Adicionar Área</button>
                    </div>
                </form>
            </div>
        </div>
        <h2>Áreas Cadastradas</h2>
        <div class="table-responsive">
            <table class="table table-striped table-hover">
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Responsável</th>
                        <th>Telefone</th>
                        <th>Status Mensal</th> <th>Ações</th>
                    </tr>
                </thead>
                <tbody id="tabela-areas-corpo"></tbody>
            </table>
        </div>
    `;
    
    document.getElementById('form-area').addEventListener('submit', handleAreaSubmit);
    fetchAndDisplayAreas();
}

async function fetchAndDisplayAreas() {
    const tabelaCorpo = document.getElementById('tabela-areas-corpo');
    if (!tabelaCorpo) return;
    tabelaCorpo.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';

    try {
        const response = await fetch(`${apiUrl}/api/areas/`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error('Erro ao buscar áreas.');
        
        const areas = await response.json();
        areasDisponiveisCache = areas;

        tabelaCorpo.innerHTML = '';
        if (areas.length === 0) {
            tabelaCorpo.innerHTML = '<tr><td colspan="5" class="text-center">Nenhuma área cadastrada.</td></tr>';
            return;
        }

        areas.forEach(area => {
            const tr = document.createElement('tr');
            
            // ✅ LÓGICA DO SEMÁFORO
            let statusHtml;
            const visitas = area.visitas_no_mes;

            if (visitas >= 2) {
                statusHtml = `<span class="badge rounded-pill bg-success" title="2 ou mais visitas de rotina no mês"><i class="bi bi-check-circle-fill me-1"></i> 2ª Visita</span>`;
            } else if (visitas === 1) {
                statusHtml = `<span class="badge rounded-pill bg-warning text-dark" title="Apenas 1 visita de rotina no mês"><i class="bi bi-exclamation-triangle-fill me-1"></i> 1ª Visita</span>`;
            } else {
                statusHtml = `<span class="badge rounded-pill bg-danger" title="Nenhuma visita de rotina no mês"><i class="bi bi-x-circle-fill me-1"></i> Atrasado</span>`;
            }
            
            tr.innerHTML = `
                <td>${area.nome}</td>
                <td>${area.responsavel || ''}</td>
                <td>${area.telefone || ''}</td>
                <td>${statusHtml}</td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-primary" data-action="edit-area" data-id="${area.id}"><i class="bi bi-pencil-square"></i> Editar</button>
                        <button class="btn btn-sm btn-outline-danger ms-1" data-action="delete-area" data-id="${area.id}"><i class="bi bi-trash3"></i> Excluir</button>
                    </div>
                </td>
            `;
            tabelaCorpo.appendChild(tr);
        });
    } catch (error) {
        tabelaCorpo.innerHTML = `<tr><td colspan="5" class="text-danger">${error.message}</td></tr>`;
    }
}

async function handleAreaSubmit(event) {
    event.preventDefault();
    const submitButton = event.target.querySelector('button[type="submit"]');
    const id = document.getElementById('area-id').value;
    const data = {
        nome: document.getElementById('area-nome').value,
        responsavel: document.getElementById('area-responsavel').value,
        telefone: document.getElementById('area-telefone').value
    };

    if (!data.nome) {
        showToast("O nome da área é obrigatório.", "error");
        return;
    }

    const url = id ? `${apiUrl}/api/areas/${id}` : `${apiUrl}/api/areas/`;
    const method = id ? 'PUT' : 'POST';

    setButtonLoading(submitButton, true);
    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail);
        }
        showToast(`Área ${id ? 'atualizada' : 'criada'}!`, 'success');
        modoAdicionarArea();
        fetchAndDisplayAreas();
    } catch (error) {
        showToast(`Falha: ${error.message}`, 'error');
    } finally {
        setButtonLoading(submitButton, false, id ? 'Salvar Alterações' : 'Adicionar Área');
    }
}

export function modoAdicionarArea() {
    const form = document.getElementById('form-area');
    if (!form) return;
    form.reset();
    document.getElementById('area-id').value = '';
    document.getElementById('form-titulo-area').textContent = 'Adicionar Nova Área';
    document.getElementById('btn-submit-area').textContent = 'Adicionar Área';
    const cancelButton = form.querySelector('[data-action="cancel-edit-area"]');
    if (cancelButton) {
        cancelButton.style.display = 'none';
    }
}

export async function iniciarEdicaoArea(id) {
    const area = areasDisponiveisCache.find(a => a.id == id);
    if (!area) {
        showToast("Área não encontrada. Recarregando lista...", "error");
        await fetchAndDisplayAreas();
        return;
    }

    document.getElementById('area-id').value = area.id;
    document.getElementById('area-nome').value = area.nome;
    document.getElementById('area-responsavel').value = area.responsavel || '';
    document.getElementById('area-telefone').value = area.telefone || '';
    document.getElementById('form-titulo-area').textContent = `Editando Área: ${area.nome}`;
    document.getElementById('btn-submit-area').textContent = 'Salvar Alterações';
    document.querySelector('[data-action="cancel-edit-area"]').style.display = 'inline-block';
    window.scrollTo(0, 0);
}

export async function excluirArea(id) {
    const confirmado = await showConfirmModal('Excluir Área', 'Tem certeza que deseja excluir esta área? Ela não pode estar associada a nenhum dispositivo ou serviço.');
    if (!confirmado) return;

    try {
        const response = await fetch(`${apiUrl}/api/areas/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.status !== 204) {
            const err = await response.json();
            throw new Error(err.detail || 'Falha ao excluir.');
        }
        showToast('Área excluída!', 'success');
        fetchAndDisplayAreas();
    } catch (error) {
        showToast(`Falha: ${error.message}`, 'error');
    }
}