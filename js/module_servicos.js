// Arquivo: js/module_servicos.js

import { apiUrl, token, areasDisponiveis, currentUser } from './app.js';
import { showToast, showConfirmModal, setButtonLoading } from './ui_utils.js';

// Variáveis de estado locais para este módulo
let produtosDisponiveis = [];
let produtosNoServicoAtual = [];

// Função principal que desenha a tela do módulo
export async function loadServicosModule() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    try {
        const prodResponse = await fetch(`${apiUrl}/api/produtos/`, { headers: { 'Authorization': `Bearer ${token}` } });
        produtosDisponiveis = await prodResponse.json();
    } catch (e) {
        produtosDisponiveis = [];
        showToast("Não foi possível carregar a lista de produtos.", "error");
    }

    mainContent.innerHTML = `
        <h1 class="mb-4">Gestão de Serviços</h1>
        <div class="card mb-4">
            <div class="card-header" id="form-titulo-serv">Registrar Novo Serviço</div>
            <div class="card-body">
            <form id="form-servico"><input type="hidden" id="servico-id">
                <div class="row g-3">
                    <div class="col-md-4"><label for="serv-area-select" class="form-label">Área*</label>
                        <select class="form-select" id="serv-area-select" required>
                            <option value="">Selecione...</option>
                            ${areasDisponiveis.map(a => `<option value="${a.id}">${a.nome}</option>`).join('')}
                        </select>
                    </div>
                    <div class="col-md-8"><label for="serv-descricao" class="form-label">Descrição*</label><input type="text" class="form-control" id="serv-descricao" required></div>
                    
                    <div class="col-md-4"><label for="serv-tipo-atividade" class="form-label">Tipo de Atividade*</label>
                        <select class="form-select" id="serv-tipo-atividade" required>
                            <option value="Visita de Rotina" selected>Visita de Rotina</option>
                            <option value="Chamado Técnico">Chamado Técnico</option>
                            <option value="Emergência">Emergência</option>
                        </select>
                    </div>

                    <div class="col-md-4"><label for="serv-data" class="form-label">Data*</label><input type="date" class="form-control" id="serv-data" value="${new Date().toISOString().split('T')[0]}" required></div>
                    <div class="col-md-2"><label for="serv-horario-inicio" class="form-label">Início</label><input type="time" class="form-control" id="serv-horario-inicio"></div>
                    <div class="col-md-2"><label for="serv-horario-termino" class="form-label">Término</label><input type="time" class="form-control" id="serv-horario-termino"></div>
                    <div class="col-12"><label for="serv-observacoes" class="form-label">Observações</label><textarea class="form-control" id="serv-observacoes" rows="2"></textarea></div>
                </div>
            </form>
                <hr class="my-4"><h5>Produtos Utilizados</h5>
                <div class="row g-3 align-items-end p-2 rounded" style="background-color: #f8f9fa;">
                    <div class="col-md-6"><label for="serv-produto-select" class="form-label">Produto</label><select class="form-select" id="serv-produto-select">${produtosDisponiveis.map(p => `<option value="${p.id}">${p.nome} (Estq: ${p.estoque_atual.toFixed(2)})</option>`).join('')}</select></div>
                    <div class="col-md-3"><label for="serv-produto-qtd" class="form-label">Qtd. Usada</label><input type="number" class="form-control" id="serv-produto-qtd" value="1" step="0.01"></div>
                    <div class="col-md-3"><button type="button" class="btn btn-success w-100" data-action="add-produto-servico">Adicionar</button></div>
                </div>
                <table class="table mt-3"><thead><tr><th>Produto</th><th>Qtd. Usada</th><th>Ação</th></tr></thead><tbody id="tabela-produtos-servico-temp"></tbody></table>
                <div class="d-flex justify-content-end mt-4">
                    <button type="button" class="btn btn-secondary me-2" data-action="cancel-edit-servico" style="display: none;">Cancelar</button>
                    <button type="button" class="btn btn-primary" data-action="submit-servico" id="btn-submit-serv">Salvar Serviço</button>
                </div>
            </div>
        </div>
        <h2>Serviços Registrados</h2>
        <div class="table-responsive"><table class="table table-striped table-hover">
            <thead><tr><th>ID</th><th>Área</th><th>Descrição</th><th>Data</th><th>Início</th><th>Fim</th><th>Produtos</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody id="tabela-servicos-corpo"></tbody>
        </table></div>
    `;
    fetchAndDisplayServicos();
}

async function fetchAndDisplayServicos() {
    const tabelaCorpo = document.getElementById('tabela-servicos-corpo');
    if (!tabelaCorpo) return;
    tabelaCorpo.innerHTML = '<tr><td colspan="9">Carregando...</td></tr>';

    try {
        const response = await fetch(`${apiUrl}/api/servicos/`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error('Erro ao buscar serviços.');
        const servicos = await response.json();

        tabelaCorpo.innerHTML = '';
        if (servicos.length === 0) {
            tabelaCorpo.innerHTML = '<tr><td colspan="9" class="text-center">Nenhum serviço registrado.</td></tr>';
            return;
        }

        servicos.forEach(s => {
            const tr = document.createElement('tr');
            const produtosStr = s.produtos_associados.map(p => `${p.produto.nome} (${p.quantidade_usada})`).join(', ') || 'Nenhum';

            let acoesHtml = `<button class="btn btn-sm btn-info" data-action="abrir-form-mip" data-id="${s.id}" data-area-nome="${s.area.nome}"><i class="bi bi-bug"></i> MIP</button>`;
           // botão relatorio acoesHtml += `<button class="btn btn-sm btn-secondary ms-1" data-action="ver-relatorio" data-id="${s.id}"><i class="bi bi-file-earmark-text"></i> Relatório</button>`;
            acoesHtml += `<button class="btn btn-sm btn-warning ms-1" data-action="verificar-dispositivos" data-id="${s.id}" data-area-id="${s.area.id}"><i class="bi bi-card-checklist"></i> Verificar</button>`;
            
            if (s.status === 'Pendente') {
                acoesHtml += `<button class="btn btn-sm btn-success ms-1" data-action="concluir-servico" data-id="${s.id}"><i class="bi bi-check-lg"></i> Concluir</button>`;
            }
            
            acoesHtml += `<button class="btn btn-sm btn-outline-primary ms-1" data-action="edit-servico" data-id="${s.id}"><i class="bi bi-pencil-square"></i> Editar</button>`;
            acoesHtml += `<button class="btn btn-sm btn-outline-danger ms-1" data-action="delete-servico" data-id="${s.id}"><i class="bi bi-trash3"></i> Excluir</button>`;
            
            tr.innerHTML = `
                <td>${s.id}</td><td>${s.area.nome}</td><td>${s.descricao}</td>
                <td>${new Date(s.data + 'T00:00:00').toLocaleDateString()}</td>
                <td>${s.horario_inicio || '--:--'}</td><td>${s.horario_termino || '--:--'}</td>
                <td>${produtosStr}</td>
                <td><span class="badge bg-${s.status === 'Concluído' ? 'success' : 'secondary'}">${s.status}</span></td>
                <td>${acoesHtml}</td>`;
            tabelaCorpo.appendChild(tr);
        });
    } catch (error) {
        tabelaCorpo.innerHTML = `<tr><td colspan="9" class="text-danger">${error.message}</td></tr>`;
    }
}

export async function handleServicoSubmit(event) {
    const submitButton = document.getElementById('btn-submit-serv');
    const id = document.getElementById('servico-id').value;
    
    // Objeto de dados que será enviado para a API
    const servicoData = {
        area_id: parseInt(document.getElementById('serv-area-select').value),
        descricao: document.getElementById('serv-descricao').value,
        data: document.getElementById('serv-data').value,
        
        // ✅ NOVA LINHA ADICIONADA
        tipo_atividade: document.getElementById('serv-tipo-atividade').value,
        
        horario_inicio: document.getElementById('serv-horario-inicio').value || null,
        horario_termino: document.getElementById('serv-horario-termino').value || null,
        observacoes: document.getElementById('serv-observacoes').value,
        status: 'Pendente',
        produtos_associados: produtosNoServicoAtual.map(({ produto_id, quantidade_usada }) => ({ produto_id, quantidade_usada }))
    };

    if (!servicoData.area_id || !servicoData.descricao || !servicoData.data) { 
        showToast("Área, Descrição e Data são obrigatórios.", 'error'); 
        return; 
    }
    
    const url = id ? `${apiUrl}/api/servicos/${id}` : `${apiUrl}/api/servicos/`;
    const method = id ? 'PUT' : 'POST';
    
    setButtonLoading(submitButton, true);
    try {
        const response = await fetch(url, { method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(servicoData) });
        if (!response.ok) { const err = await response.json(); throw new Error(err.detail); }
        
        showToast(`Serviço ${id ? 'atualizado' : 'criado'}!`, 'success');
        modoAdicionarServico(); 
        fetchAndDisplayServicos();
    } catch (error) { 
        showToast(`Falha ao salvar: ${error.message}`, 'error'); 
    } finally {
        setButtonLoading(submitButton, false, id ? 'Salvar Alterações' : 'Salvar Serviço');
    }
}
export async function iniciarEdicaoServico(id) {
    try {
        const response = await fetch(`${apiUrl}/api/servicos/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if(!response.ok) throw new Error("Serviço não encontrado");
        const servico = await response.json();

        if (servico.status === 'Concluído' && !currentUser.permissions.includes('admin_servicos')) {
            showToast("Serviços concluídos só podem ser editados por um administrador.", 'error'); 
            return;
        }
        
        document.getElementById('servico-id').value = servico.id;
        document.getElementById('serv-area-select').value = servico.area.id;
        document.getElementById('serv-descricao').value = servico.descricao;
        document.getElementById('serv-data').value = servico.data;
        document.getElementById('serv-horario-inicio').value = servico.horario_inicio || '';
        document.getElementById('serv-horario-termino').value = servico.horario_termino || '';
        document.getElementById('serv-observacoes').value = servico.observacoes;
        
        produtosNoServicoAtual = servico.produtos_associados.map(p => ({ 
            produto_id: p.produto.id, 
            nome: p.produto.nome, 
            quantidade_usada: p.quantidade_usada 
        }));
        redrawTabelaProdutosTemp();
        
        document.getElementById('form-titulo-serv').textContent = `Editando Serviço ID: ${id}`;
        document.getElementById('btn-submit-serv').textContent = 'Salvar Alterações';
        document.querySelector('[data-action="cancel-edit-servico"]').style.display = 'inline-block';
        window.scrollTo(0, 0);
    } catch(error) {
        showToast(error.message, 'error');
    }
}

export async function excluirServico(id) {
    const confirmado = await showConfirmModal('Excluir Serviço', 'Tem certeza? O estoque dos produtos associados será reajustado.');
    if (!confirmado) return;
    try {
        const response = await fetch(`${apiUrl}/api/servicos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }});
        if (response.status !== 204) { const err = await response.json(); throw new Error(err.detail); }
        showToast("Serviço excluído e estoque ajustado!", 'success'); 
        fetchAndDisplayServicos();
    } catch (error) { 
        showToast(`Falha ao excluir: ${error.message}`, 'error'); 
    }
}

export async function concluirServico(id) {
    const confirmado = await showConfirmModal('Concluir Serviço', 'Marcar este serviço como "Concluído"?');
    if (!confirmado) return;
    try {
        const response = await fetch(`${apiUrl}/api/servicos/${id}/concluir`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) { const err = await response.json(); throw new Error(err.detail); }
        showToast("Serviço concluído!", 'success'); 
        fetchAndDisplayServicos();
    } catch (error) { 
        showToast(`Falha: ${error.message}`, 'error'); 
    }
}

export function modoAdicionarServico() {
    const form = document.getElementById('form-servico');
    if(!form) return;
    form.reset();
    document.getElementById('servico-id').value = '';
    produtosNoServicoAtual = [];
    redrawTabelaProdutosTemp();
    document.getElementById('form-titulo-serv').textContent = 'Registrar Novo Serviço';
    document.getElementById('btn-submit-serv').textContent = 'Salvar Serviço';
    document.querySelector('[data-action="cancel-edit-servico"]').style.display = 'none';
}

// Funções auxiliares para a lista temporária de produtos
export function adicionarProdutoAoServicoTemp() {
    const produtoSelect = document.getElementById('serv-produto-select');
    const produtoId = parseInt(produtoSelect.value);
    const produtoNome = produtoSelect.options[produtoSelect.selectedIndex].text;
    const quantidade = parseFloat(document.getElementById('serv-produto-qtd').value);

    if (!produtoId || !quantidade || quantidade <= 0) {
        showToast("Selecione um produto e insira uma quantidade válida.", 'error');
        return;
    }
    if (produtosNoServicoAtual.some(p => p.produto_id === produtoId)) {
        showToast("Este produto já foi adicionado.", 'error');
        return;
    }
    produtosNoServicoAtual.push({ produto_id: produtoId, nome: produtoNome, quantidade_usada: quantidade });
    redrawTabelaProdutosTemp();
}

export function removerProdutoDoServicoTemp(produtoId) {
    produtosNoServicoAtual = produtosNoServicoAtual.filter(p => p.produto_id != produtoId);
    redrawTabelaProdutosTemp();
}

function redrawTabelaProdutosTemp() {
    const tabelaTempCorpo = document.getElementById('tabela-produtos-servico-temp');
    if(!tabelaTempCorpo) return;
    tabelaTempCorpo.innerHTML = '';
    produtosNoServicoAtual.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${p.nome}</td><td>${p.quantidade_usada.toFixed(2)}</td><td><button class="btn btn-danger btn-sm" data-action="remove-produto-servico" data-id="${p.produto_id}">Remover</button></td>`;
        tabelaTempCorpo.appendChild(tr);
    });
}