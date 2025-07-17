// Arquivo: js/module_produtos.js (versão final e corrigida)

import { apiUrl, token } from './app.js';
import { showToast, showConfirmModal, setButtonLoading } from './ui_utils.js';

let produtosDisponiveis = [];

export async function loadProdutosModule() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    
    mainContent.innerHTML = `
        <h1 class="mb-4">Gestão de Produtos</h1>
        <div class="card mb-4">
            <div class="card-header" id="form-titulo-prod">Adicionar Novo Produto</div>
            <div class="card-body">
                <form id="form-produto"><input type="hidden" id="produto-id">
                    <div class="row g-3">
                        <div class="col-md-3"><label for="codigo" class="form-label">Código</label><input type="text" class="form-control" id="codigo"></div>
                        <div class="col-md-9"><label for="nome" class="form-label">Nome do Produto*</label><input type="text" class="form-control" id="nome" required></div>
                        <div class="col-md-6"><label for="lote" class="form-label">Lote</label><input type="text" class="form-control" id="lote"></div>
                        <div class="col-md-6"><label for="validade" class="form-label">Validade (dd/mm/aaaa)</label><input type="text" class="form-control" id="validade" placeholder="ex: 31/12/2025"></div>
                        <div class="col-md-4"><label for="unidade_estoque" class="form-label">Un. Estoque*</label><input type="text" class="form-control" id="unidade_estoque" value="Unidade(s)" required></div>
                        <div class="col-md-4"><label for="unidade_uso" class="form-label">Un. Uso*</label><input type="text" class="form-control" id="unidade_uso" value="Unidade(s)" required></div>
                        <div class="col-md-4"><label for="fator_conversao_uso" class="form-label">Fator Conversão*</label><input type="number" step="0.01" class="form-control" id="fator_conversao_uso" value="1.0" required></div>
                        <div class="col-md-6"><label for="estoque_atual" class="form-label">Estoque Inicial*</label><input type="number" step="0.01" class="form-control" id="estoque_atual" value="0.0" required></div>
                        <div class="col-md-6"><label for="estoque_minimo" class="form-label">Estoque Mínimo*</label><input type="number" step="0.01" class="form-control" id="estoque_minimo" value="0.0" required></div>
                        <div class="col-12"><label for="obs_unidade" class="form-label">Observações</label><input type="text" class="form-control" id="obs_unidade"></div>
                    </div>
                    <div class="d-flex justify-content-end mt-4">
                        <button type="button" class="btn btn-secondary me-2" data-action="cancel-edit-produto" style="display: none;">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="btn-submit-prod">Adicionar Produto</button>
                    </div>
                </form>
            </div>
        </div>
        <h2>Produtos Cadastrados</h2>
        <div class="table-responsive"><table class="table table-striped table-hover">
            <thead><tr><th>Cód.</th><th>Nome</th><th>Estq. Atual</th><th>Un. Estq.</th><th>Lote</th><th>Validade</th><th class="text-center">Ações</th></tr></thead>
            <tbody id="tabela-produtos-corpo"></tbody>
        </table></div>
    `;

    document.getElementById('form-produto').addEventListener('submit', handleProdutoSubmit);
    fetchAndDisplayProdutos();
}

async function fetchAndDisplayProdutos() {
    const tabelaCorpo = document.getElementById('tabela-produtos-corpo');
    if(!tabelaCorpo) return;
    tabelaCorpo.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';
    try {
        const response = await fetch(`${apiUrl}/api/produtos/`, { headers: { 'Authorization': `Bearer ${token}` }});
        if (!response.ok) throw new Error('Erro ao buscar produtos.');
        produtosDisponiveis = await response.json();
        
        tabelaCorpo.innerHTML = '';
        if(produtosDisponiveis.length === 0) {
            tabelaCorpo.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum produto cadastrado.</td></tr>';
            return;
        }
        produtosDisponiveis.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.codigo || ''}</td>
                <td>${p.nome}</td>
                <td>${p.estoque_atual.toFixed(2)}</td>
                <td>${p.unidade_estoque}</td>
                <td>${p.lote || ''}</td>
                <td>${p.validade || ''}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary" data-action="edit-produto" data-id="${p.id}"><i class="bi bi-pencil-square"></i> Editar</button>
                    <button class="btn btn-sm btn-outline-danger ms-1" data-action="delete-produto" data-id="${p.id}"><i class="bi bi-trash3"></i> Excluir</button>
                </td>`;
            tabelaCorpo.appendChild(tr);
        });
    } catch (error) { 
        tabelaCorpo.innerHTML = `<tr><td colspan="7" class="text-danger">${error.message}</td></tr>`;
    }
}

async function handleProdutoSubmit(event) {
    event.preventDefault();
    const submitButton = event.target.querySelector('button[type="submit"]');
    const id = document.getElementById('produto-id').value;
    const url = id ? `${apiUrl}/api/produtos/${id}` : `${apiUrl}/api/produtos/`;
    const method = id ? 'PUT' : 'POST';
    const data = {
        codigo: document.getElementById('codigo').value, nome: document.getElementById('nome').value, lote: document.getElementById('lote').value,
        validade: document.getElementById('validade').value, unidade_estoque: document.getElementById('unidade_estoque').value,
        unidade_uso: document.getElementById('unidade_uso').value, fator_conversao_uso: parseFloat(document.getElementById('fator_conversao_uso').value),
        estoque_minimo: parseFloat(document.getElementById('estoque_minimo').value), obs_unidade: document.getElementById('obs_unidade').value,
    };
    if (!id) {
        data.estoque_atual = parseFloat(document.getElementById('estoque_atual').value);
    }

    setButtonLoading(submitButton, true);
    try {
        const response = await fetch(url, { method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!response.ok) { const err = await response.json(); throw new Error(err.detail); }
        showToast(`Produto ${id ? 'atualizado' : 'criado'}!`, 'success');
        modoAdicionarProduto();
        fetchAndDisplayProdutos();
    } catch (error) { 
        showToast(`Falha: ${error.message}`, 'error'); 
    } finally {
        setButtonLoading(submitButton, false, id ? 'Salvar Alterações' : 'Adicionar Produto');
    }
}

// ✅ CORREÇÃO: Adicionando 'export' aqui
export function modoAdicionarProduto() {
    const form = document.getElementById('form-produto');
    if(!form) return;
    form.reset();
    document.getElementById('produto-id').value = '';
    document.getElementById('form-titulo-prod').textContent = 'Adicionar Novo Produto';
    document.getElementById('btn-submit-prod').textContent = 'Adicionar Produto';
    const cancelButton = form.querySelector('[data-action="cancel-edit-produto"]');
    if(cancelButton) cancelButton.style.display = 'none';
    const estoqueAtualInput = document.getElementById('estoque_atual');
    if(estoqueAtualInput) estoqueAtualInput.disabled = false;
}

// ✅ CORREÇÃO: Adicionando 'export' aqui
export async function iniciarEdicaoProduto(id) {
    const produto = produtosDisponiveis.find(p => p.id == id);
    if (!produto) {
        showToast("Produto não encontrado. Recarregando lista...", "error");
        await fetchAndDisplayProdutos();
        return;
    }

    document.getElementById('produto-id').value = produto.id;
    document.getElementById('codigo').value = produto.codigo || '';
    document.getElementById('nome').value = produto.nome;
    document.getElementById('lote').value = produto.lote || '';
    document.getElementById('validade').value = produto.validade || '';
    document.getElementById('unidade_estoque').value = produto.unidade_estoque;
    document.getElementById('unidade_uso').value = produto.unidade_uso;
    document.getElementById('fator_conversao_uso').value = produto.fator_conversao_uso;
    document.getElementById('estoque_atual').value = produto.estoque_atual;
    document.getElementById('estoque_minimo').value = produto.estoque_minimo;
    document.getElementById('obs_unidade').value = produto.obs_unidade || '';
    
    document.getElementById('form-titulo-prod').textContent = `Editando Produto: ${produto.nome}`;
    document.getElementById('btn-submit-prod').textContent = 'Salvar Alterações';
    document.querySelector('[data-action="cancel-edit-produto"]').style.display = 'inline-block';
    document.getElementById('estoque_atual').disabled = true;
    window.scrollTo(0, 0);
}

// ✅ CORREÇÃO: Adicionando 'export' aqui
export async function excluirProduto(id) {
    const confirmado = await showConfirmModal('Excluir Produto', 'Tem certeza que deseja excluir este produto?');
    if (!confirmado) return;

    try {
        const response = await fetch(`${apiUrl}/api/produtos/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.status !== 204) {
            const err = await response.json();
            throw new Error(err.detail || 'Falha ao excluir.');
        }
        showToast('Produto excluído!', 'success');
        fetchAndDisplayProdutos();
    } catch (error) {
        showToast(`Falha ao excluir: ${error.message}`, 'error');
    }
}