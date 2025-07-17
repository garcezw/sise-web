// Arquivo: js/module_seguranca.js

// ✅ Importa a lista de módulos do app.js, além de outras variáveis globais
import { apiUrl, token, currentUser, modules } from './app.js';
import { showToast, showConfirmModal, setButtonLoading } from './ui_utils.js';

// ❌ A constante local de permissões foi removida daqui, pois agora usamos a importada.

export async function loadSegurancaModule() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `
        <h1 class="mb-4">Gestão de Segurança</h1>
        <div class="card mb-4">
            <div class="card-header">Criar Novo Usuário</div>
            <div class="card-body">
                <form id="form-usuario" class="row g-3">
                    <div class="col-md-5"><label for="new-username" class="form-label">Nome de Usuário</label><input type="text" id="new-username" class="form-control" required></div>
                    <div class="col-md-5"><label for="new-password" class="form-label">Senha</label><input type="password" id="new-password" class="form-control" required></div>
                    <div class="col-md-2 d-grid"><label class="form-label">&nbsp;</label><button type="submit" class="btn btn-primary">Criar Usuário</button></div>
                </form>
            </div>
        </div>
        <h2>Usuários e Permissões</h2>
        <div class="table-responsive">
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Username</th>
                        <th>Permissões</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody id="tabela-usuarios-corpo"></tbody>
            </table>
        </div>
    `;
    
    document.getElementById('form-usuario').addEventListener('submit', handleUserSubmit);
    fetchAndDisplayUsers();
}

async function fetchAndDisplayUsers() {
    const tabelaCorpo = document.getElementById('tabela-usuarios-corpo');
    if(!tabelaCorpo) return;
    tabelaCorpo.innerHTML = '<tr><td colspan="4">Carregando usuários...</td></tr>';

    try {
        const response = await fetch(`${apiUrl}/api/users/`, { headers: { 'Authorization': `Bearer ${token}` }});
        if (!response.ok) { const err = await response.json(); throw new Error(err.detail); }
        const users = await response.json();
        
        tabelaCorpo.innerHTML = '';
        if (users.length === 0) {
            tabelaCorpo.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum usuário encontrado.</td></tr>';
            return;
        }

        users.forEach(user => {
            const userPermissions = (user.permissions || '').split(',');
            
            // ✅ Usa a lista de módulos importada para gerar os checkboxes
            const checkboxesHtml = Object.keys(modules).map(permKey => `
                <div class="form-check form-check-inline">
                    <input class="form-check-input" type="checkbox" value="${permKey}" id="perm-${user.id}-${permKey}" 
                           ${userPermissions.includes(permKey) ? 'checked' : ''} 
                           ${user.id === currentUser.id && permKey === 'seguranca' ? 'disabled' : ''}>
                    <label class="form-check-label" for="perm-${user.id}-${permKey}">${modules[permKey].label}</label>
                </div>`).join('');
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td><div id="perms-container-${user.id}">${checkboxesHtml}</div></td>
                <td>
                    <button class="btn btn-primary btn-sm" data-action="save-perms" data-id="${user.id}">Salvar</button>
                    <button class="btn btn-danger btn-sm ms-1" data-action="delete-user" data-id="${user.id}" data-username="${user.username}" 
                            ${user.id === currentUser.id ? 'disabled' : ''}>Excluir</button>
                </td>`;
            tabelaCorpo.appendChild(tr);
        });
    } catch (error) { 
        tabelaCorpo.innerHTML = `<tr><td colspan="4" class="text-danger">Erro ao carregar usuários: ${error.message}</td></tr>`;
    }
}

async function handleUserSubmit(event) {
    event.preventDefault();
    const submitButton = event.target.querySelector('button[type="submit"]');
    const username = document.getElementById('new-username').value;
    const password = document.getElementById('new-password').value;
    if(!username || !password) { 
        showToast("Nome de usuário e senha são obrigatórios.", 'error'); 
        return; 
    }

    setButtonLoading(submitButton, true);
    try {
        const response = await fetch(`${apiUrl}/api/users/`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (!response.ok) { const err = await response.json(); throw new Error(err.detail); }
        showToast(`Usuário '${username}' criado com sucesso!`, 'success');
        document.getElementById('form-usuario').reset();
        fetchAndDisplayUsers();
    } catch(error) { 
        showToast(`Falha ao criar usuário: ${error.message}`, 'error'); 
    } finally {
        setButtonLoading(submitButton, false, 'Criar Usuário');
    }
}

export async function salvarPermissoes(target) {
    const userId = target.dataset.id;
    const container = document.getElementById(`perms-container-${userId}`);
    const checkedBoxes = container.querySelectorAll('input[type="checkbox"]:checked');
    const novasPermissoes = Array.from(checkedBoxes).map(cb => cb.value).join(',');
    
    setButtonLoading(target, true);
    try {
        const response = await fetch(`${apiUrl}/api/users/${userId}/permissions`, {
            method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ permissions: novasPermissoes })
        });
        if (!response.ok) throw new Error("Falha ao salvar permissões.");
        showToast('Permissões salvas!', 'success');
    } catch(error) {
        showToast(error.message, 'error');
    } finally {
        setButtonLoading(target, false, 'Salvar');
    }
}

export async function excluirUsuario(target) {
    const userId = target.dataset.id;
    const username = target.dataset.username;
    
    const confirmado = await showConfirmModal('Excluir Usuário', `Tem certeza que deseja excluir o usuário "${username}"? Esta ação não pode ser desfeita.`);
    if (!confirmado) return;

    setButtonLoading(target, true);
    try {
        const response = await fetch(`${apiUrl}/api/users/${userId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }});
        if (!response.ok) { const err = await response.json(); throw new Error(err.detail); }
        showToast("Usuário excluído com sucesso.", 'success');
        fetchAndDisplayUsers();
    } catch(error) { 
        showToast(`Falha ao excluir usuário: ${error.message}`, 'error'); 
        setButtonLoading(target, false, 'Excluir');
    }
}