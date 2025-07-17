// Arquivo: js/module_configuracoes.js

import { apiUrl, token } from './app.js';
import { showToast, showConfirmModal, setButtonLoading } from './ui_utils.js';

let LISTA_PRAGAS_DINAMICA = [];

export async function loadConfiguracoesModule() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `
        <h1 class="mb-4">Configurações</h1>
        <div class="row">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">Gerenciar Tipos de Pragas</div>
                    <div class="card-body">
                        <p>Adicione ou remova os tipos de pragas que aparecerão na tela de contagem.</p>
                        <form id="form-praga" class="d-flex mb-3">
                            <input type="text" id="praga-nome" class="form-control me-2" placeholder="Nome da nova praga" required>
                            <button type="submit" class="btn btn-primary">Adicionar</button>
                        </form>
                        <ul class="list-group" id="lista-pragas"></ul>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.getElementById('form-praga').addEventListener('submit', handlePragaSubmit);
    fetchAndDisplayPragas();
}

async function fetchAndDisplayPragas() {
    const listaPragas = document.getElementById('lista-pragas');
    if(!listaPragas) return;
    listaPragas.innerHTML = '<li class="list-group-item">Carregando...</li>';
    try {
        const response = await fetch(`${apiUrl}/api/pragas/`, { headers: { 'Authorization': `Bearer ${token}` }});
        if (!response.ok) throw new Error("Não foi possível carregar a lista de pragas.");
        const pragas = await response.json();
        LISTA_PRAGAS_DINAMICA = pragas;
        
        listaPragas.innerHTML = '';
        if (pragas.length === 0) { 
            listaPragas.innerHTML = '<li class="list-group-item">Nenhuma praga cadastrada.</li>'; 
        } else {
            pragas.forEach(praga => {
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center';
                li.textContent = praga.nome;
                li.innerHTML += `<button class="btn btn-danger btn-sm" data-action="delete-praga" data-id="${praga.id}" data-nome="${praga.nome}"><i class="bi bi-trash3"></i></button>`;
                listaPragas.appendChild(li);
            });
        }
    } catch (error) { 
        listaPragas.innerHTML = `<li class="list-group-item text-danger">${error.message}</li>`;
    }
}

async function handlePragaSubmit(event) {
    event.preventDefault();
    const submitButton = event.target.querySelector('button[type="submit"]');
    const nomeInput = document.getElementById('praga-nome');
    const nomePraga = nomeInput.value.trim();
    if (!nomePraga) { showToast("O nome da praga não pode ser vazio.", "error"); return; }
    
    setButtonLoading(submitButton, true);
    try {
        const response = await fetch(`${apiUrl}/api/pragas/`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: nomePraga })
        });
        if (!response.ok) { const err = await response.json(); throw new Error(err.detail); }
        nomeInput.value = '';
        showToast("Praga adicionada!", "success");
        fetchAndDisplayPragas();
    } catch (error) { 
        showToast(`Erro ao adicionar praga: ${error.message}`, 'error'); 
    } finally {
        setButtonLoading(submitButton, false, 'Adicionar');
    }
}

export async function excluirPraga(pragaId, pragaNome) {
    const confirmado = await showConfirmModal('Excluir Praga', `Tem certeza que deseja excluir a praga "${pragaNome}"?`);
    if (!confirmado) return;

    try {
        const response = await fetch(`${apiUrl}/api/pragas/${pragaId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error("Falha ao excluir a praga.");
        showToast("Praga excluída.", "success");
        fetchAndDisplayPragas();
    } catch (error) { 
        showToast(error.message, 'error'); 
    }
}