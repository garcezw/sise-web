// =================================================================
// --- GLOBAIS, INICIALIZAÇÃO E FUNÇÕES UTILITÁRIAS ---
// =================================================================

const token = localStorage.getItem('accessToken');
const apiUrl = 'http://127.0.0.1:8000';

// Elementos principais da UI
let mainContent = document.getElementById('main-content');
const sidebarMenu = document.getElementById('sidebar-menu');
const usernameDisplay = document.getElementById('username-display');
const logoutButton = document.getElementById('logout-button');

// Estado da Aplicação
let currentUser = null;
let areasDisponiveis = [];
let produtosDisponiveis = [];
let produtosNoServicoAtual = [];
const TODAS_AS_PERMISSOES = ['dashboard', 'areas', 'produtos', 'servicos', 'dispositivos', 'contagem', 'configuracoes', 'seguranca', 'admin_servicos', 'relatorios'];
let LISTA_PRAGAS_DINAMICA = [];
let currentMIPData = { ocorrencias: [], contagens: [] };

// --- Funções Utilitárias ---

/**
 * Exibe uma notificação toast na tela.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} type - 'success', 'error', ou 'info'.
 */
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    const icon = type === 'success' ? 'bi-check-circle-fill' : type === 'error' ? 'bi-x-circle-fill' : 'bi-info-circle-fill';
    const color = type === 'success' ? 'text-success' : type === 'error' ? 'text-danger' : 'text-primary';

    toast.className = 'toast align-items-center mb-2 border-0 bg-light shadow-sm';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body fs-6">
                <i class="bi ${icon} ${color} me-2"></i>
                ${message}
            </div>
            <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    toastContainer.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast, { delay: 5000 });
    bsToast.show();
    toast.addEventListener('hidden.bs.toast', () => toast.remove());
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '1090';
    document.body.appendChild(container);
    return container;
}

/**
 * Exibe um modal de confirmação.
 * @param {string} title - O título do modal.
 * @param {string} body - A mensagem do corpo do modal.
 * @returns {Promise<boolean>} - Resolve para true se confirmado, false caso contrário.
 */
function showConfirmModal(title, body) {
    return new Promise(resolve => {
        const modalId = 'confirmModal';
        const oldModal = document.getElementById(modalId);
        if (oldModal) oldModal.remove();

        const modalHtml = `
            <div class="modal fade" id="${modalId}" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${title}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body"><p>${body}</p></div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" id="confirm-cancel">Cancelar</button>
                            <button type="button" class="btn btn-danger" id="confirm-ok">Confirmar</button>
                        </div>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modalElement = document.getElementById(modalId);
        const confirmModal = new bootstrap.Modal(modalElement);

        const cleanup = () => {
            confirmModal.hide();
            modalElement.remove();
        };

        const onConfirm = () => { cleanup(); resolve(true); };
        const onCancel = () => { cleanup(); resolve(false); };

        modalElement.querySelector('#confirm-ok').addEventListener('click', onConfirm, { once: true });
        modalElement.querySelector('#confirm-cancel').addEventListener('click', onCancel, { once: true });
        modalElement.addEventListener('hidden.bs.modal', () => onCancel(), { once: true });

        confirmModal.show();
    });
}


/**
 * Habilita/desabilita um botão e mostra um texto de "carregando".
 * @param {HTMLElement} button - O elemento do botão.
 * @param {boolean} isLoading - True para mostrar o estado de carregamento, false para reverter.
 * @param {string} [originalText=''] - O texto original do botão para restaurar.
 */
function setButtonLoading(button, isLoading, originalText = '') {
    if (!button) return;
    if (isLoading) {
        button.disabled = true;
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Carregando...`;
    } else {
        button.disabled = false;
        button.innerHTML = originalText || button.dataset.originalText || 'Ação';
    }
}


// --- Inicialização da Aplicação ---

if (!token) {
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Carrega dados essenciais em paralelo
        const [userResponse, areasResponse] = await Promise.all([
            fetch(`${apiUrl}/api/users/me`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${apiUrl}/api/areas/`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (!userResponse.ok) throw new Error('Sessão inválida ou expirada. Por favor, faça login novamente.');

        currentUser = await userResponse.json();
        areasDisponiveis = await areasResponse.json();

        usernameDisplay.textContent = currentUser.username;
        buildSidebar(currentUser.permissions);
        loadInitialModule(currentUser.permissions);

    } catch (error) {
        console.error("Erro na inicialização:", error);
        localStorage.removeItem('accessToken');
        showToast(error.message, 'error');
        setTimeout(() => window.location.href = 'login.html', 3000);
    }
});

logoutButton.addEventListener('click', () => {
    localStorage.removeItem('accessToken');
    showToast('Você saiu do sistema.', 'info');
    setTimeout(() => window.location.href = 'login.html', 1500);
});


// =================================================================
// --- LÓGICA DE NAVEGAÇÃO E CARREGAMENTO DE MÓDULOS ---
// =================================================================

function buildSidebar(permissionsStr) {
    // CORREÇÃO: Usamos .map(p => p.trim()) para remover espaços de cada permissão.
    const permissions = (permissionsStr || '').split(',').map(p => p.trim());
    
    sidebarMenu.innerHTML = ''; // Limpa o menu atual
    
    // Módulos disponíveis na aplicação
    const modules = {
        dashboard: { label: 'Dashboard', icon: 'bi-grid-1x2-fill' }, // ADICIONE AQUI
        areas: { label: 'Áreas', icon: 'bi-geo-alt-fill' },
        servicos: { label: 'Serviços', icon: 'bi-tools' },
        dispositivos: { label: 'Dispositivos', icon: 'bi-hdd-stack' },
        contagem: { label: 'Contagem de Pragas', icon: 'bi-grid-1x2' },
        areas: { label: 'Áreas', icon: 'bi-geo-alt-fill' },
        produtos: { label: 'Produtos', icon: 'bi-box-seam' },      
        relatorios: { label: 'Relatórios', icon: 'bi-file-earmark-bar-graph' },
        configuracoes: { label: 'Configurações', icon: 'bi-gear' },
        seguranca: { label: 'Segurança', icon: 'bi-shield-lock' }
    };

    // Percorre cada módulo e verifica se o usuário tem permissão para vê-lo
    Object.keys(modules).forEach(key => {
        if (permissions.includes(key)) {
            const li = document.createElement('li');
            li.innerHTML = `<a href="#" class="nav-link text-white" data-module="${key}"><i class="bi ${modules[key].icon} me-2"></i>${modules[key].label}</a>`;
            sidebarMenu.appendChild(li);
        }
    });
}

function loadInitialModule(permissionsStr) {
    const permissions = (permissionsStr || '').split(',').map(p => p.trim());
    
    // Tenta carregar o dashboard primeiro, se o usuário tiver permissão
    if (permissions.includes('dashboard')) {
        loadModule('dashboard');
        // Ativa o link do menu correspondente
        const link = sidebarMenu.querySelector(`.nav-link[data-module="dashboard"]`);
        if (link) link.classList.add('active');
    } 
    // Se não tiver, carrega a primeira permissão da lista
    else if (permissions.length > 0) {
        const firstPermission = permissions[0];
        loadModule(firstPermission);
        const link = sidebarMenu.querySelector(`.nav-link[data-module="${firstPermission}"]`);
        if (link) link.classList.add('active');
    } 
    // Se não tiver nenhuma permissão
    else {
        mainContent.innerHTML = '<h1>Acesso Negado</h1><p>Você não tem permissão para acessar nenhum módulo.</p>';
    }
}

function loadModule(moduleName) {
    // Clona e substitui o mainContent para limpar event listeners antigos
    const newMainContent = mainContent.cloneNode(false);
    mainContent.parentNode.replaceChild(newMainContent, mainContent);
    mainContent = newMainContent; // Reatribui a variável global
    mainContent.innerHTML = `<div class="d-flex justify-content-center align-items-center" style="height: 80vh;">
                                <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                                    <span class="visually-hidden">Carregando...</span>
                                </div>
                             </div>`;
    
    // Adiciona o manipulador de eventos central ao novo mainContent
    mainContent.addEventListener('click', handleMainContentClick);


    setTimeout(() => {
        switch (moduleName) {
            case 'areas': loadAreasModule(); break;
            case 'produtos': loadProdutosModule(); break;
            case 'servicos': loadServicosModule(); break;
            case 'dispositivos': loadDispositivosModule(); break;
            case 'contagem': loadContagemModule(); break;
            case 'configuracoes': loadConfiguracoesModule(); break;
            case 'seguranca': loadSegurancaModule(); break;
            default: mainContent.innerHTML = `<h1>Módulo não encontrado</h1>`;
        }
    }, 50);
}

sidebarMenu.addEventListener('click', (e) => {
    const link = e.target.closest('a.nav-link');
    if (link) {
        e.preventDefault();
        sidebarMenu.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        loadModule(link.dataset.module);
    }
});

// =================================================================
// --- LÓGICA DE NAVEGAÇÃO E CARREGAMENTO DE MÓDULOS ---
// =================================================================

/**
 * Carrega um módulo específico na área de conteúdo principal.
 * Esta função funciona como um "roteador" do front-end.
 * @param {string} moduleName - O nome do módulo a ser carregado (ex: 'areas', 'relatorios').
 */
function loadModule(moduleName) {
    // Clona e substitui o mainContent para limpar event listeners antigos de formulários, etc.
    const newMainContent = mainContent.cloneNode(false);
    mainContent.parentNode.replaceChild(newMainContent, mainContent);
    mainContent = newMainContent; // Reatribui a variável global
    mainContent.innerHTML = `<div class="d-flex justify-content-center align-items-center" style="height: 80vh;">
                                 <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                                     <span class="visually-hidden">Carregando...</span>
                                 </div>
                             </div>`;
    
    // Adiciona o manipulador de eventos central ao novo mainContent
    mainContent.addEventListener('click', handleMainContentClick);

    // Este é o SWITCH que você estava procurando.
    // Usamos um pequeno timeout para que o "spinner" de carregamento apareça na tela.
    setTimeout(() => {
        switch (moduleName) {
            case 'dashboard': loadDashboardModule(); break;
            case 'areas': loadAreasModule(); break;
            case 'produtos': loadProdutosModule(); break;
            case 'servicos': loadServicosModule(); break;
            case 'dispositivos': loadDispositivosModule(); break;
            case 'contagem': loadContagemModule(); break;
            case 'configuracoes': loadConfiguracoesModule(); break;
            case 'seguranca': loadSegurancaModule(); break;
            case 'relatorios': loadRelatoriosModule(); break; // <-- O nosso novo módulo
            default: mainContent.innerHTML = `<h1>Módulo não encontrado</h1>`;
        }
    }, 50);
}

/**
 * Carrega o primeiro módulo que o usuário tem permissão para ver quando a página abre.
 * @param {string} permissionsStr - A string de permissões do usuário.
 */
function loadInitialModule(permissionsStr) {
    const firstPermission = (permissionsStr || '').split(',')[0].trim();
    if (firstPermission) {
        loadModule(firstPermission);
        // Ativa o link do menu correspondente
        const firstLink = sidebarMenu.querySelector(`.nav-link[data-module="${firstPermission}"]`);
        if (firstLink) firstLink.classList.add('active');
    } else {
        mainContent.innerHTML = '<h1>Acesso Negado</h1><p>Você não tem permissão para acessar nenhum módulo.</p>';
    }
}

/**
 * "Ouvinte" de eventos para o menu lateral.
 * Ele captura os cliques nos links do menu e delega a ação para a função loadModule.
 */
sidebarMenu.addEventListener('click', (e) => {
    const link = e.target.closest('a.nav-link');
    if (link) {
        e.preventDefault();
        // Remove a classe 'active' de todos os links e a adiciona apenas no clicado
        sidebarMenu.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        // Carrega o módulo correspondente ao link clicado
        loadModule(link.dataset.module);
    }
});


// =================================================================
// --- MANIPULADOR DE EVENTOS CENTRAL (EVENT DELEGATION) ---
// =================================================================
function handleMainContentClick(e) {
    // Encontra o elemento clicado (ou o "pai" mais próximo) que tenha o atributo data-action
    const target = e.target.closest('[data-action]');
    if (!target) return; // Se não encontrou, não faz nada

    const action = target.dataset.action;
    const id = target.dataset.id;

    // O switch direciona para a função correta com base na ação
    switch(action) {
        // Ação para o novo pop-up de MIP
        case 'abrir-form-mip':
            const areaNome = target.dataset.areaNome;
            abrirModalObservacaoMIP(id, areaNome);
            break;

        // Ação para o pop-up de Adicionar em Lote
        case 'open-lote-modal':
            abrirModalLote();
            break;

        // Segurança
        case 'save-perms': salvarPermissoes(target); break;
        case 'delete-user': excluirUsuario(target); break;
        
        // Áreas
        case 'edit-area': iniciarEdicaoArea(id); break;
        case 'delete-area': excluirArea(id); break;
        case 'cancel-edit-area': modoAdicionarArea(); break;
        
        // Produtos
        case 'edit-produto': iniciarEdicaoProduto(id); break;
        case 'delete-produto': excluirProduto(id); break;
        case 'cancel-edit-produto': modoAdicionarProduto(); break;
        
        // Dispositivos
        case 'edit-dispositivo': iniciarEdicaoDispositivo(id); break;
        case 'delete-dispositivo': excluirDispositivo(id); break;
        case 'cancel-edit-dispositivo': modoAdicionarDispositivo(); break;
        case 'filter-dispositivos': fetchAndDisplayDispositivos(target.dataset.filter); break;
        case 'verificar-dispositivos':
        abrirModalVerificacao(id, target.dataset.areaId);
        break;
        
        // Serviços
        case 'add-produto-servico': adicionarProdutoAoServicoTemp(); break;
        case 'remove-produto-servico': removerProdutoDoServicoTemp(id); break;
        case 'submit-servico': handleServicoSubmit(e); break;
        case 'cancel-edit-servico': modoAdicionarServico(); break;
        case 'edit-servico': iniciarEdicaoServico(id); break;
        case 'delete-servico': excluirServico(id); break;
        case 'concluir-servico': concluirServico(id); break;
        
        // Configurações (Pragas)
        case 'delete-praga': excluirPraga(id, target.dataset.nome); break;
        
        // Contagem
        case 'carregar-grade': carregarGradeContagem(); break;
        case 'salvar-contagem': salvarContagem(target.dataset.areaid, target.dataset.data, target.dataset.servicoid || null); break;

        case 'gerar-relatorio-servicos':
        gerarRelatorioServicos();
        break;

        case 'exportar-pdf': // Este continua o mesmo, mas podemos torná-lo específico
        exportarRelatorioParaPDF(); // Idealmente, renomear para exportarRelatorioServicosPDF()
        break;
        case 'gerar-relatorio-produtos':
        gerarRelatorioProdutos();
        break;
        case 'exportar-pdf-produtos':
        exportarRelatorioProdutosPDF();
        break;

        case 'gerar-relatorio-area':
        gerarRelatorioArea();
        break;

        // Dentro do switch da função loadModule
        case 'dashboard': loadDashboardModule(); break;
        
        // Dentro do switch da função relatorio
        case 'ver-relatorio':
    }
}

// =================================================================
// --- MÓDULO DE ÁREAS ---
// =================================================================
async function loadAreasModule() {
    mainContent.innerHTML = `
        <h1 class="mb-4">Gestão de Áreas</h1>
        <div class="card mb-4"><div class="card-header" id="form-titulo-area">Adicionar Nova Área</div>
            <div class="card-body">
                <form id="form-area"><input type="hidden" id="area-id">
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
        <div class="table-responsive"><table class="table table-striped table-hover">
            <thead><tr><th>Nome</th><th>Responsável</th><th>Telefone</th><th>Ações</th></tr></thead>
            <tbody id="tabela-areas-corpo"></tbody>
        </table></div>`;
    document.getElementById('form-area').addEventListener('submit', handleAreaSubmit);
    fetchAndDisplayAreas();
}

async function fetchAndDisplayAreas() {
    const tabelaCorpo = document.getElementById('tabela-areas-corpo');
    if(!tabelaCorpo) return;
    tabelaCorpo.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';
    try {
        const response = await fetch(`${apiUrl}/api/areas/`, { headers: { 'Authorization': `Bearer ${token}` }});
        if (!response.ok) throw new Error('Erro ao buscar áreas.');
        areasDisponiveis = await response.json();
        
        tabelaCorpo.innerHTML = '';
        if(areasDisponiveis.length === 0) {
            tabelaCorpo.innerHTML = '<tr><td colspan="4" class="text-center">Nenhuma área cadastrada.</td></tr>';
            return;
        }
        areasDisponiveis.forEach(a => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${a.nome}</td><td>${a.responsavel || ''}</td><td>${a.telefone || ''}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" data-action="edit-area" data-id="${a.id}"><i class="bi bi-pencil-square"></i> Editar</button>
                    <button class="btn btn-sm btn-outline-danger ms-1" data-action="delete-area" data-id="${a.id}"><i class="bi bi-trash3"></i> Excluir</button>
                </td>`;
            tabelaCorpo.appendChild(tr);
        });
    } catch (error) { 
        tabelaCorpo.innerHTML = `<tr><td colspan="4" class="text-danger">${error.message}</td></tr>`;
    }
}

function modoAdicionarArea() {
    const form = document.getElementById('form-area');
    if (!form) return;
    form.reset();
    document.getElementById('area-id').value = '';
    document.getElementById('form-titulo-area').textContent = 'Adicionar Nova Área';
    document.getElementById('btn-submit-area').textContent = 'Adicionar Área';
    form.querySelector('[data-action="cancel-edit-area"]').style.display = 'none';
}

async function handleAreaSubmit(event) {
    event.preventDefault();
    const submitButton = event.target.querySelector('button[type="submit"]');
    const id = document.getElementById('area-id').value;
    const data = { nome: document.getElementById('area-nome').value, responsavel: document.getElementById('area-responsavel').value, telefone: document.getElementById('area-telefone').value };
    if (!data.nome) { showToast("O nome da área é obrigatório.", "error"); return; }
    
    const url = id ? `${apiUrl}/api/areas/${id}` : `${apiUrl}/api/areas/`;
    const method = id ? 'PUT' : 'POST';
    
    setButtonLoading(submitButton, true);
    try {
        const response = await fetch(url, { method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!response.ok) { const err = await response.json(); throw new Error(err.detail); }
        showToast(`Área ${id ? 'atualizada' : 'criada'}!`, 'success');
        modoAdicionarArea();
        fetchAndDisplayAreas();
    } catch (error) { 
        showToast(`Falha: ${error.message}`, 'error'); 
    } finally {
        setButtonLoading(submitButton, false, id ? 'Salvar Alterações' : 'Adicionar Área');
    }
}

async function iniciarEdicaoArea(id) {
    const area = areasDisponiveis.find(a => a.id == id);
    if (!area) { showToast("Área não encontrada", "error"); return; }
    
    document.getElementById('area-id').value = area.id;
    document.getElementById('area-nome').value = area.nome;
    document.getElementById('area-responsavel').value = area.responsavel || '';
    document.getElementById('area-telefone').value = area.telefone || '';
    document.getElementById('form-titulo-area').textContent = `Editando Área: ${area.nome}`;
    document.getElementById('btn-submit-area').textContent = 'Salvar Alterações';
    document.querySelector('[data-action="cancel-edit-area"]').style.display = 'inline-block';
    window.scrollTo(0, 0);
}

async function excluirArea(id) {
    const confirmado = await showConfirmModal('Excluir Área', 'Tem certeza que deseja excluir esta área? Ela não pode estar associada a nenhum dispositivo ou serviço.');
    if (!confirmado) return;

    try {
        const response = await fetch(`${apiUrl}/api/areas/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }});
        if (response.status !== 204) {
             const err = await response.json();
             throw new Error(err.detail || 'Falha ao excluir.');
        }
        showToast('Área excluída!', 'success');
        fetchAndDisplayAreas();
    } catch (error) { showToast(`Falha: ${error.message}`, 'error'); }
}


// =================================================================
// --- MÓDULO DE PRODUTOS ---
// =================================================================
async function loadProdutosModule() {
    mainContent.innerHTML = `
        <h1 class="mb-4">Gestão de Produtos</h1>
        <div class="card mb-4"><div class="card-header" id="form-titulo-prod">Adicionar Novo Produto</div>
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
        </table></div>`;

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
                <td>${p.codigo || ''}</td><td>${p.nome}</td><td>${p.estoque_atual.toFixed(2)}</td>
                <td>${p.unidade_estoque}</td><td>${p.lote || ''}</td><td>${p.validade || ''}</td>
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

function modoAdicionarProduto() {
    const form = document.getElementById('form-produto');
    if(!form) return;
    form.reset();
    document.getElementById('produto-id').value = '';
    document.getElementById('form-titulo-prod').textContent = 'Adicionar Novo Produto';
    document.getElementById('btn-submit-prod').textContent = 'Adicionar Produto';
    document.querySelector('[data-action="cancel-edit-produto"]').style.display = 'none';
    document.getElementById('estoque_atual').disabled = false;
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
    if (!id) data.estoque_atual = parseFloat(document.getElementById('estoque_atual').value);

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

async function iniciarEdicaoProduto(id) {
    try {
        const response = await fetch(`${apiUrl}/api/produtos/${id}`, { headers: { 'Authorization': `Bearer ${token}` }});
        if (!response.ok) throw new Error('Produto não encontrado.');
        const p = await response.json();
        
        document.getElementById('produto-id').value = p.id;
        document.getElementById('codigo').value = p.codigo || ''; document.getElementById('nome').value = p.nome;
        document.getElementById('lote').value = p.lote || ''; document.getElementById('validade').value = p.validade || '';
        document.getElementById('unidade_estoque').value = p.unidade_estoque; document.getElementById('unidade_uso').value = p.unidade_uso;
        document.getElementById('fator_conversao_uso').value = p.fator_conversao_uso; document.getElementById('estoque_atual').value = p.estoque_atual;
        document.getElementById('estoque_minimo').value = p.estoque_minimo; document.getElementById('obs_unidade').value = p.obs_unidade || '';
        document.getElementById('form-titulo-prod').textContent = `Editando Produto: ${p.nome}`;
        document.getElementById('btn-submit-prod').textContent = 'Salvar Alterações';
        document.querySelector('[data-action="cancel-edit-produto"]').style.display = 'inline-block';
        document.getElementById('estoque_atual').disabled = true;
        window.scrollTo(0, 0);
    } catch (error) { 
        showToast('Erro ao carregar dados para edição.', 'error'); 
    }
}

async function excluirProduto(id) {
    const confirmado = await showConfirmModal('Excluir Produto', 'Tem certeza que deseja excluir este produto?');
    if (!confirmado) return;

    try {
        const response = await fetch(`${apiUrl}/api/produtos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }});
        if (response.status === 204) { 
            showToast('Produto excluído!', 'success'); 
            fetchAndDisplayProdutos(); 
        } else { 
            const err = await response.json();
            throw new Error(err.detail); 
        }
    } catch (error) { 
        showToast(`Falha ao excluir: ${error.message}`, 'error'); 
    }
}


// =================================================================
// --- MÓDULO DE DISPOSITIVOS ---
// =================================================================
async function loadDispositivosModule() {
    mainContent.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1>Gestão de Dispositivos</h1>
            <button class="btn btn-success" data-action="open-lote-modal">
                <i class="bi bi-plus-slash-minus"></i> Adicionar em Lote
            </button>
        </div>
        
        <div class="card mb-4">
            <div class="card-header" id="form-titulo-disp">Adicionar Novo Dispositivo (Individual)</div>
            <div class="card-body">
                 <form id="form-dispositivo">
                    </form>
            </div>
        </div>

        <h2>Dispositivos Cadastrados</h2>
        
        <div class="card card-body mb-3">
            <div class="row align-items-end">
                <div class="col-md-5">
                    <label for="filtro-area-dispositivos" class="form-label">Filtrar por Área</label>
                    <select class="form-select" id="filtro-area-dispositivos">
                        <option value="">Todas as Áreas</option>
                        ${areasDisponiveis.map(a => `<option value="${a.id}">${a.nome}</option>`).join('')}
                    </select>
                </div>
                <div class="col-md-7">
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
    `;
    
    // Adiciona os event listeners para os formulários e o novo filtro
    document.getElementById('form-dispositivo').addEventListener('submit', handleDispositivoSubmit);
    document.getElementById('filtro-area-dispositivos').addEventListener('change', () => fetchAndDisplayDispositivos());
    
    // Carrega a lista inicial
    fetchAndDisplayDispositivos();
}

async function fetchAndDisplayDispositivos(tipoFiltro = null) {
    document.querySelectorAll('#pills-tab-disp .nav-link').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === (tipoFiltro || ''));
    });
    const tabelaCorpo = document.getElementById('tabela-dispositivos-corpo');
    if(!tabelaCorpo) return;
    tabelaCorpo.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
    try {
        let url = `${apiUrl}/api/dispositivos/`;
        if (tipoFiltro) url += `?tipo=${tipoFiltro}`;
        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` }});
        if (!response.ok) throw new Error('Erro ao buscar dispositivos.');
        const dispositivos = await response.json();
        
        tabelaCorpo.innerHTML = '';
        if(dispositivos.length === 0) {
            tabelaCorpo.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum dispositivo encontrado.</td></tr>';
            return;
        }
        dispositivos.forEach(d => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${d.area.nome}</td><td>${d.numero}</td><td>${d.tipo}</td><td>${d.descricao || ''}</td>
                <td><span class="badge bg-${d.status === 'Ativo' ? 'success' : 'danger'}">${d.status}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" data-action="edit-dispositivo" data-id="${d.id}"><i class="bi bi-pencil-square"></i> Editar</button>
                    <button class="btn btn-sm btn-outline-danger ms-1" data-action="delete-dispositivo" data-id="${d.id}"><i class="bi bi-trash3"></i> Excluir</button>
                </td>`;
            tabelaCorpo.appendChild(tr);
        });
    } catch (error) { 
        tabelaCorpo.innerHTML = `<tr><td colspan="6" class="text-danger">${error.message}</td></tr>`;
    }
}

function modoAdicionarDispositivo() {
    const form = document.getElementById('form-dispositivo');
    if(!form) return;
    form.reset();
    document.getElementById('dispositivo-id').value = '';
    document.getElementById('form-titulo-disp').textContent = 'Adicionar Novo Dispositivo';
    document.getElementById('btn-submit-disp').textContent = 'Adicionar Dispositivo';
    document.querySelector('[data-action="cancel-edit-dispositivo"]').style.display = 'none';
}

async function handleDispositivoSubmit(event) {
    event.preventDefault();
    const submitButton = event.target.querySelector('button[type="submit"]');
    const id = document.getElementById('dispositivo-id').value;
    const data = {
        area_id: parseInt(document.getElementById('disp-area-select').value),
        numero: document.getElementById('disp-numero').value, tipo: document.getElementById('disp-tipo').value, 
        descricao: document.getElementById('disp-descricao').value, status: document.getElementById('disp-status').value,
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

async function iniciarEdicaoDispositivo(id) {
    // Para editar, é mais seguro buscar o dispositivo individualmente para garantir dados atualizados
    try {
        const response = await fetch(`${apiUrl}/api/dispositivos/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error("Dispositivo não encontrado");
        const dispositivo = await response.json();
        
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
    } catch(error) {
        showToast(error.message, 'error');
    }
}

async function excluirDispositivo(id) {
    const confirmado = await showConfirmModal('Excluir Dispositivo', 'Tem certeza que deseja excluir este dispositivo?');
    if (!confirmado) return;
    try {
        const response = await fetch(`${apiUrl}/api/dispositivos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }});
        if (response.status !== 204) throw new Error('Falha ao excluir.');
        showToast('Dispositivo excluído!', 'success');
        fetchAndDisplayDispositivos();
    } catch (error) { showToast(`Falha: ${error.message}`, 'error'); }
}

function abrirModalLote() {
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
    };
    if (!payload.area || !payload.tipo || !payload.numero_inicio || !payload.numero_fim) { showToast("Preencha todos os campos obrigatórios (*).", 'error'); return; }
    
    setButtonLoading(submitButton, true);
    try {
        const response = await fetch(`${apiUrl}/api/dispositivos/lote`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || "Erro desconhecido.");
        showToast(`${result.length} dispositivo(s) do tipo '${payload.tipo}' criado(s) com sucesso!`, 'success');
        bootstrap.Modal.getInstance(document.getElementById('loteModal')).hide();
        fetchAndDisplayDispositivos();
    } catch (error) { 
        showToast(`Falha ao criar em lote: ${error.message}`, 'error'); 
    } finally {
        setButtonLoading(submitButton, false, 'Criar Dispositivos');
    }
}

const STATUS_OPCOES = ["OK", "Troca", "Consumido", "Danificado", "Extraviado", "Manutenção","Acesso Impedido", "Desligada","implantação"]; // Opções de status

async function abrirModalVerificacao(servicoId, areaId) {
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
            
            // --- LÓGICA CORRIGIDA AQUI ---
            // Agora, bloqueamos apenas se o status for 'Inativo' ou 'Transferido'.
            // Qualquer outro status (como 'Ativo' ou 'OK') será editável.
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
        fetchAndDisplayServicos(); // Atualiza a lista de serviços
    } catch (error) {
        showToast(error.message, 'error');
    }
}
async function fetchAndDisplayDispositivos() {
    // 1. Pega os valores atuais dos filtros diretamente da tela
    const areaFiltro = document.getElementById('filtro-area-dispositivos').value;
    const tipoFiltro = document.querySelector('#pills-tab-disp .nav-link.active').dataset.filter;

    // 2. Monta a URL da API dinamicamente
    let url = new URL(`${apiUrl}/api/dispositivos/`);
    if (areaFiltro) {
        url.searchParams.append('area_id', areaFiltro);
    }
    if (tipoFiltro) {
        url.searchParams.append('tipo', tipoFiltro);
    }

    const tabelaCorpo = document.getElementById('tabela-dispositivos-corpo');
    if(!tabelaCorpo) return;
    tabelaCorpo.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
    
    try {
        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` }});
        if (!response.ok) throw new Error('Erro ao buscar dispositivos.');
        const dispositivos = await response.json();
        
        tabelaCorpo.innerHTML = '';
        if(dispositivos.length === 0) {
            tabelaCorpo.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum dispositivo encontrado para os filtros selecionados.</td></tr>';
            return;
        }
        
        // 3. Renderiza a tabela (lógica existente, sem alterações)
        dispositivos.forEach(d => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${d.area.nome}</td><td>${d.numero}</td><td>${d.tipo}</td><td>${d.descricao || ''}</td>
                <td><span class="badge bg-${d.status === 'Ativo' ? 'success' : 'danger'}">${d.status}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" data-action="edit-dispositivo" data-id="${d.id}"><i class="bi bi-pencil-square"></i> Editar</button>
                    <button class="btn btn-sm btn-outline-danger ms-1" data-action="delete-dispositivo" data-id="${d.id}"><i class="bi bi-trash3"></i> Excluir</button>
                </td>`;
            tabelaCorpo.appendChild(tr);
        });
    } catch (error) { 
        tabelaCorpo.innerHTML = `<tr><td colspan="6" class="text-danger">${error.message}</td></tr>`;
    }
}

// =================================================================
// --- MÓDULO DE SERVIÇOS ---
// =================================================================

async function loadServicosModule() {
    try {
        const prodResponse = await fetch(`${apiUrl}/api/produtos/`, { headers: { 'Authorization': `Bearer ${token}` }});
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
                        
                        <div class="col-md-4"><label for="serv-data" class="form-label">Data*</label><input type="date" class="form-control" id="serv-data" value="${new Date().toISOString().split('T')[0]}" required></div>
                        <div class="col-md-4"><label for="serv-horario-inicio" class="form-label">Horário de Início</label><input type="time" class="form-control" id="serv-horario-inicio"></div>
                        <div class="col-md-4"><label for="serv-horario-termino" class="form-label">Horário de Término</label><input type="time" class="form-control" id="serv-horario-termino"></div>

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
        </table></div>`;
    fetchAndDisplayServicos();
}

function adicionarProdutoAoServicoTemp() {
    const produtoSelect = document.getElementById('serv-produto-select');
    const produtoId = parseInt(produtoSelect.value);
    const produtoNome = produtoSelect.options[produtoSelect.selectedIndex].text;
    const quantidade = parseFloat(document.getElementById('serv-produto-qtd').value);
    if (!produtoId || !quantidade || quantidade <= 0) { showToast("Selecione um produto e insira uma quantidade válida.", 'error'); return; }
    if (produtosNoServicoAtual.some(p => p.produto_id === produtoId)) { showToast("Este produto já foi adicionado.", 'error'); return; }
    produtosNoServicoAtual.push({ produto_id: produtoId, nome: produtoNome, quantidade_usada: quantidade });
    redrawTabelaProdutosTemp();
}

function removerProdutoDoServicoTemp(produtoId) {
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

function modoAdicionarServico() {
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

            // --- Construção dos botões de ação para cada serviço ---
            let acoesHtml = `<button class="btn btn-sm btn-info" data-action="abrir-form-mip" data-id="${s.id}" data-area-nome="${s.area.nome}"><i class="bi bi-bug"></i> MIP</button>`;
                
            acoesHtml += `<button class="btn btn-sm btn-secondary ms-1" data-action="ver-relatorio" data-id="${s.id}"><i class="bi bi-file-earmark-text"></i> Relatório</button>`;
            acoesHtml += `<button class="btn btn-sm btn-warning ms-1" data-action="verificar-dispositivos" data-id="${s.id}" data-area-id="${s.area.id}"><i class="bi bi-card-checklist"></i> Verificar</button>`;
            
            if (s.status === 'Pendente') {
                acoesHtml += `<button class="btn btn-sm btn-success ms-1" data-action="concluir-servico" data-id="${s.id}"><i class="bi bi-check-lg"></i> Concluir</button>`;
            }
            
            acoesHtml += `<button class="btn btn-sm btn-outline-primary ms-1" data-action="edit-servico" data-id="${s.id}"><i class="bi bi-pencil-square"></i> Editar</button>`;
            acoesHtml += `<button class="btn btn-sm btn-outline-danger ms-1" data-action="delete-servico" data-id="${s.id}"><i class="bi bi-trash3"></i> Excluir</button>`;
            
            // Monta a linha da tabela com todas as informações e os botões
            tr.innerHTML = `
                <td>${s.id}</td>
                <td>${s.area.nome}</td>
                <td>${s.descricao}</td>
                <td>${new Date(s.data + 'T00:00:00').toLocaleDateString()}</td>
                <td>${s.horario_inicio || '--:--'}</td>
                <td>${s.horario_termino || '--:--'}</td>
                <td>${produtosStr}</td>
                <td><span class="badge bg-${s.status === 'Concluído' ? 'success' : 'secondary'}">${s.status}</span></td>
                <td>${acoesHtml}</td>
            `;
            tabelaCorpo.appendChild(tr);
        });
    } catch (error) {
        tabelaCorpo.innerHTML = `<tr><td colspan="9" class="text-danger">${error.message}</td></tr>`;
    }
}

async function handleServicoSubmit(event) {
    const submitButton = event.target;
    const id = document.getElementById('servico-id').value;
    const servicoData = {
        area_id: parseInt(document.getElementById('serv-area-select').value),
        descricao: document.getElementById('serv-descricao').value, 
        data: document.getElementById('serv-data').value,
        horario_inicio: document.getElementById('serv-horario-inicio').value,
        horario_termino: document.getElementById('serv-horario-termino').value,
        observacoes: document.getElementById('serv-observacoes').value, 
        status: 'Pendente',
        produtos_associados: produtosNoServicoAtual.map(({ produto_id, quantidade_usada }) => ({ produto_id, quantidade_usada }))
    };
    if(!servicoData.area_id || !servicoData.descricao || !servicoData.data) { showToast("Área, Descrição e Data são obrigatórios.", 'error'); return; }
    
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

async function iniciarEdicaoServico(id) {
    try {
        const response = await fetch(`${apiUrl}/api/servicos/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if(!response.ok) throw new Error("Serviço não encontrado");
        const servico = await response.json();

        if (servico.status === 'Concluído') {
            if (!currentUser.permissions.includes('admin_servicos')) {
                showToast("Serviços concluídos só podem ser editados por um administrador autorizado.", 'error'); return;
            }
            const confirmado = await showConfirmModal("Atenção", "Este serviço já está concluído. Deseja mesmo editá-lo? O estoque será reajustado.");
            if (!confirmado) return;
        }
        document.getElementById('servico-id').value = servico.id;
        document.getElementById('serv-area-select').value = servico.area.id;
        document.getElementById('serv-descricao').value = servico.descricao;
        document.getElementById('serv-data').value = servico.data;
        document.getElementById('serv-horario-inicio').value = servico.horario_inicio || '';
        document.getElementById('serv-horario-termino').value = servico.horario_termino || '';
        document.getElementById('serv-observacoes').value = servico.observacoes;
        produtosNoServicoAtual = servico.produtos_associados.map(p => ({ produto_id: p.produto.id, nome: p.produto.nome, quantidade_usada: p.quantidade_usada }));
        redrawTabelaProdutosTemp();
        document.getElementById('form-titulo-serv').textContent = `Editando Serviço ID: ${id}`;
        document.getElementById('btn-submit-serv').textContent = 'Salvar Alterações';
        document.querySelector('[data-action="cancel-edit-servico"]').style.display = 'inline-block';
        window.scrollTo(0, 0);
    } catch(error) {
        showToast(error.message, 'error');
    }
}

async function excluirServico(id) {
    const confirmado = await showConfirmModal('Excluir Serviço', 'Tem certeza que deseja excluir este serviço? O estoque dos produtos associados será reajustado.');
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

async function concluirServico(id) {
    const confirmado = await showConfirmModal('Concluir Serviço', 'Marcar este serviço como "Concluído"? Esta ação não pode ser desfeita.');
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

// =================================================================
// --- MÓDULO DE CONTAGEM DE PRAGAS ---
// =================================================================
async function loadContagemModule() {
    mainContent.innerHTML = `
        <h1 class="mb-4">Contagem de Pragas</h1>
        <div class="card mb-4">
            <div class="card-header">Selecionar Contexto</div>
            <div class="card-body">
                <div class="row g-3 align-items-end">
                    <div class="col-md-4"><label for="contagem-area-select" class="form-label">Área</label>
                        <select class="form-select" id="contagem-area-select">
                            <option value="">Selecione uma área...</option>
                            ${areasDisponiveis.map(area => `<option value="${area.id}">${area.nome}</option>`).join('')}
                        </select>
                    </div>
                    <div class="col-md-3"><label for="contagem-data-select" class="form-label">Data</label><input type="date" class="form-control" id="contagem-data-select" value="${new Date().toISOString().split('T')[0]}"></div>
                    <div class="col-md-5"><button class="btn btn-primary w-100" data-action="carregar-grade">Carregar Grade de Contagem</button></div>
                </div>
            </div>
        </div>
        <div id="grade-container"><p class="text-center text-muted">Selecione uma área e data e clique em "Carregar Grade".</p></div>`;
}

async function carregarGradeContagem() {
    const areaId = document.getElementById('contagem-area-select').value;
    const areaNome = document.getElementById('contagem-area-select').options[document.getElementById('contagem-area-select').selectedIndex].text;
    const data = document.getElementById('contagem-data-select').value;
    const gradeContainer = document.getElementById('grade-container');

    if (!areaId || !data) {
        showToast("Por favor, selecione uma área e uma data.", 'error');
        return;
    }

    gradeContainer.innerHTML = `<p class="text-center fs-5"><i class="bi bi-arrow-clockwise"></i> Carregando dados da grade...</p>`;

    try {
        const [dispositivos, pragas, servicos] = await Promise.all([
            fetch(`${apiUrl}/api/dispositivos/?area_id=${areaId}`, { headers: { 'Authorization': `Bearer ${token}` }}).then(res => res.json()),
            fetch(`${apiUrl}/api/pragas/`, { headers: { 'Authorization': `Bearer ${token}` }}).then(res => res.json()),
            fetch(`${apiUrl}/api/servicos/?area_id=${areaId}&data=${data}`, { headers: { 'Authorization': `Bearer ${token}` }}).then(res => res.json())
        ]);
        
        if (pragas.length === 0) {
            gradeContainer.innerHTML = `<div class="alert alert-warning">Nenhuma praga cadastrada. Por favor, adicione tipos de pragas na aba 'Configurações' antes de continuar.</div>`;
            return;
        }

        const servicoDoDia = servicos.length > 0 ? servicos[0] : null;
        let contagensSalvas = {};
        if (servicoDoDia) {
            const mipResponse = await fetch(`${apiUrl}/api/servicos/${servicoDoDia.id}/mip`, { headers: { 'Authorization': `Bearer ${token}` }});
            const mipData = await mipResponse.json();
            mipData.contagens.forEach(c => {
                if (!contagensSalvas[c.dispositivo_numero]) contagensSalvas[c.dispositivo_numero] = {};
                contagensSalvas[c.dispositivo_numero][c.praga_nome] = c.quantidade;
            });
        }
        
        const dispositivosAtivos = dispositivos.filter(d => d.status === 'Ativo' && d.tipo === 'AL').sort((a,b) => parseInt(a.numero) - parseInt(b.numero));

        if(dispositivosAtivos.length === 0) {
             gradeContainer.innerHTML = `<div class="alert alert-warning">Nenhum dispositivo do tipo "AL" ativo encontrado para a área "${areaNome}".</div>`;
             return;
        }

        let gridHtml = `<h2>Grade de Contagem - ${areaNome} - ${new Date(data + 'T00:00:00').toLocaleDateString()}</h2><div class="table-responsive"><table class="table table-bordered text-center">
            <thead class="table-light"><tr><th>AL #</th><th>Descrição</th>`;
        pragas.forEach(p => gridHtml += `<th>${p.nome}</th>`);
        gridHtml += `<th>Total</th></tr></thead><tbody>`;

        dispositivosAtivos.forEach(d => {
            let totalLinha = 0;
            gridHtml += `<tr><td><b>${d.numero}</b></td><td class="text-start">${d.descricao || ''}</td>`;
            pragas.forEach(p => {
                const qtd = contagensSalvas[d.numero]?.[p.nome] || "";
                if (qtd) totalLinha += parseInt(qtd);
                gridHtml += `<td><input type="number" class="form-control form-control-sm contagem-input" 
                                       data-dispositivo-numero="${d.numero}" data-praga-nome="${p.nome}" value="${qtd}" min="0"></td>`;
            });
            gridHtml += `<td class="fw-bold align-middle">${totalLinha}</td></tr>`;
        });
        gridHtml += `</tbody></table></div>`;
        gridHtml += `<div class="d-flex justify-content-end mt-3"><button class="btn btn-success" data-action="salvar-contagem" data-areaid="${areaId}" data-data="${data}" data-servicoid="${servicoDoDia ? servicoDoDia.id : ''}">Salvar Contagem</button></div>`;

        gradeContainer.innerHTML = gridHtml;

    } catch (error) {
        gradeContainer.innerHTML = `<div class="alert alert-danger">Erro ao carregar a grade: ${error.message}</div>`;
    }
}

async function salvarContagem(areaId, data, servicoId) {
    const saveButton = document.querySelector('[data-action="salvar-contagem"]');
    const contagens = [];
    document.querySelectorAll('.contagem-input').forEach(input => {
        if (input.value && parseInt(input.value) >= 0) {
            contagens.push({
                dispositivo_numero: input.dataset.dispositivoNumero,
                praga_nome: input.dataset.pragaNome,
                quantidade: parseInt(input.value)
            });
        }
    });

    let targetServicoId = servicoId;
    if (!targetServicoId) {
        const confirmado = await showConfirmModal("Criar Novo Serviço?", "Não existe um serviço para esta área e data. Deseja criar um novo serviço automaticamente para salvar esta contagem?");
        if (!confirmado) return;
        
        setButtonLoading(saveButton, true);
        try {
            const areaNome = areasDisponiveis.find(a=>a.id==parseInt(areaId)).nome;
            const servicoPayload = {
                area_id: parseInt(areaId), descricao: `Serviço de Contagem - ${areaNome}`,
                data: data, observacoes: "Criado automaticamente pela tela de Contagem de Pragas.", produtos_associados: []
            };
            const response = await fetch(`${apiUrl}/api/servicos/`, {
                method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(servicoPayload)
            });
            if (!response.ok) throw new Error("Falha ao criar serviço de suporte para a contagem.");
            const novoServico = await response.json();
            targetServicoId = novoServico.id;
        } catch (error) { 
            showToast(error.message, 'error'); 
            setButtonLoading(saveButton, false, "Salvar Contagem");
            return;
        }
    }

    const mipPayload = { ocorrencias: [], contagens: contagens };
    setButtonLoading(saveButton, true);
    try {
        const response = await fetch(`${apiUrl}/api/servicos/${targetServicoId}/mip`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(mipPayload)
        });
        if (!response.ok) throw new Error("Falha ao salvar os dados da contagem.");
        showToast("Contagem de pragas salva com sucesso!", 'success');
        carregarGradeContagem(); // Recarrega a grade para mostrar os dados salvos
    } catch (error) { 
        showToast(error.message, 'error'); 
    } finally {
        setButtonLoading(saveButton, false, "Salvar Contagem");
    }
}

function abrirModalObservacaoMIP(servicoId, areaNome) {
    // Remove qualquer modal antigo para evitar conflitos
    const oldModal = document.getElementById('mipObservacaoModal');
    if (oldModal) oldModal.remove();

    const hoje = new Date().toISOString().split('T')[0]; // Pega a data de hoje

    const modalHtml = `
        <div class="modal fade" id="mipObservacaoModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Registrar Observação MIP</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="form-observacao-mip" data-servico-id="${servicoId}">
                            <div class="mb-3">
                                <label class="form-label">Área</label>
                                <input type="text" class="form-control" value="${areaNome}" readonly disabled>
                            </div>
                            <div class="mb-3">
                                <label for="mip-data" class="form-label">Data da Observação*</label>
                                <input type="date" class="form-control" id="mip-data" value="${hoje}" required>
                            </div>
                            <div class="mb-3">
                                <label for="mip-pragas" class="form-label">Praga(s) Encontrada(s)*</label>
                                <textarea class="form-control" id="mip-pragas" rows="3" required placeholder="Ex: Formigas, Baratas..."></textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="submit" class="btn btn-primary" form="form-observacao-mip" id="btn-salvar-mip">Salvar</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modalElement = document.getElementById('mipObservacaoModal');
    const mipModal = new bootstrap.Modal(modalElement);
    
    // Adiciona o listener que chama a função de envio quando o formulário for submetido
    document.getElementById('form-observacao-mip').addEventListener('submit', handleObservacaoMIPSubmit);
    
    mipModal.show();
}


async function handleObservacaoMIPSubmit(event) {
    event.preventDefault(); // Impede o recarregamento da página
    const form = event.target;
    const submitButton = document.getElementById('btn-salvar-mip');

    // 1. Coleta os dados do formulário
    const payload = {
        servico_id: parseInt(form.dataset.servicoId),
        data_observacao: document.getElementById('mip-data').value,
        pragas_observadas: document.getElementById('mip-pragas').value
    };

    if (!payload.data_observacao || !payload.pragas_observadas) {
        showToast("Por favor, preencha todos os campos obrigatórios (*).", "error");
        return;
    }

    setButtonLoading(submitButton, true);

    try {
        // 2. AQUI ESTÁ A LINHA: Envia os dados para a sua nova API
        const response = await fetch(`${apiUrl}/api/mip-registros/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Falha ao salvar a observação.");
        }

        showToast("Observação MIP salva com sucesso!", "success");
        bootstrap.Modal.getInstance(document.getElementById('mipObservacaoModal')).hide();

    } catch (error) {
        showToast(`Erro: ${error.message}`, 'error');
    } finally {
        setButtonLoading(submitButton, false, 'Salvar');
    }
}

// =================================================================
// --- MÓDULO DE SEGURANÇA ---
// =================================================================
async function loadSegurancaModule() {
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
        <div class="table-responsive"><table class="table table-striped">
            <thead><tr><th>ID</th><th>Username</th><th>Permissões</th><th>Ações</th></tr></thead>
            <tbody id="tabela-usuarios-corpo"></tbody>
        </table></div>`;
    
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
            
            const checkboxesHtml = TODAS_AS_PERMISSOES.map(perm => `
                <div class="form-check form-check-inline">
                    <input class="form-check-input" type="checkbox" value="${perm}" id="perm-${user.id}-${perm}" 
                           ${userPermissions.includes(perm) ? 'checked' : ''} 
                           ${user.id === currentUser.id && perm === 'seguranca' ? 'disabled' : ''}>
                    <label class="form-check-label" for="perm-${user.id}-${perm}">${perm}</label>
                </div>`).join('');
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td><div id="perms-container-${user.id}">${checkboxesHtml}</div></td>
                <td>
                    <button class="btn btn-primary btn-sm" data-action="save-perms" data-userid="${user.id}">Salvar</button>
                    <button class="btn btn-danger btn-sm ms-1" data-action="delete-user" data-userid="${user.id}" data-username="${user.username}" 
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

async function salvarPermissoes(saveButton) {
    const userId = saveButton.dataset.userid;
    const container = document.getElementById(`perms-container-${userId}`);
    const checkedBoxes = container.querySelectorAll('input[type="checkbox"]:checked');
    const novasPermissoes = Array.from(checkedBoxes).map(cb => cb.value).join(',');
    
    setButtonLoading(saveButton, true);
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
        setButtonLoading(saveButton, false, 'Salvar');
    }
}

async function excluirUsuario(deleteButton) {
    const userId = deleteButton.dataset.userid;
    const username = deleteButton.dataset.username;
    
    const confirmado = await showConfirmModal('Excluir Usuário', `Tem certeza que deseja excluir o usuário "${username}"? Esta ação não pode ser desfeita.`);
    if (!confirmado) return;

    setButtonLoading(deleteButton, true);
    try {
        const response = await fetch(`${apiUrl}/api/users/${userId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }});
        if (!response.ok) { const err = await response.json(); throw new Error(err.detail); }
        showToast("Usuário excluído com sucesso.", 'success');
        fetchAndDisplayUsers();
    } catch(error) { 
        showToast(`Falha ao excluir usuário: ${error.message}`, 'error'); 
        setButtonLoading(deleteButton, false, 'Excluir');
    }
}

// =================================================================
// --- MÓDULO DE CONFIGURAÇÕES (PRAGAS) ---
// =================================================================
async function loadConfiguracoesModule() {
    mainContent.innerHTML = `
        <h1 class="mb-4">Configurações</h1>
        <div class="row"><div class="col-md-6"><div class="card">
            <div class="card-header">Gerenciar Tipos de Pragas</div>
            <div class="card-body">
                <p>Adicione ou remova os tipos de pragas que aparecerão na tela de contagem.</p>
                <form id="form-praga" class="d-flex mb-3">
                    <input type="text" id="praga-nome" class="form-control me-2" placeholder="Nome da nova praga" required>
                    <button type="submit" class="btn btn-primary">Adicionar</button>
                </form>
                <ul class="list-group" id="lista-pragas"></ul>
            </div>
        </div></div></div>`;
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

async function excluirPraga(pragaId, pragaNome) {
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

// Em app.js (pode adicionar no final do arquivo)

let dadosRelatorioAtual = []; // Guarda os dados do relatório gerado

function loadRelatoriosModule() {
    mainContent.innerHTML = `
        <h1 class="mb-4">Central de Relatórios</h1>
        
        <ul class="nav nav-tabs" id="relatoriosTab" role="tablist">
            <li class="nav-item" role="presentation">
                <button class="nav-link active" id="servicos-tab" data-bs-toggle="tab" data-bs-target="#servicos-tab-pane" type="button" role="tab">Relatório de Serviços</button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link" id="produtos-tab" data-bs-toggle="tab" data-bs-target="#produtos-tab-pane" type="button" role="tab">Relatório de Estoque</button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link" id="area-tab" data-bs-toggle="tab" data-bs-target="#area-tab-pane" type="button" role="tab">Relatório por Área</button>
            </li>
        </ul>

        <div class="tab-content" id="relatoriosTabContent">
            <div class="tab-pane fade show active" id="servicos-tab-pane" role="tabpanel">
                <div class="card card-body border-top-0 rounded-bottom">
                    <div class="row g-3 align-items-end">
                        <div class="col-md-4">
                            <label for="data-inicio" class="form-label">Data de Início</label>
                            <input type="date" id="data-inicio" class="form-control">
                        </div>
                        <div class="col-md-4">
                            <label for="data-fim" class="form-label">Data de Fim</label>
                            <input type="date" id="data-fim" class="form-control">
                        </div>
                        <div class="col-md-4">
                            <button class="btn btn-primary w-100" data-action="gerar-relatorio-servicos">
                                <i class="bi bi-search me-2"></i>Gerar Relatório de Serviços
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="tab-pane fade" id="produtos-tab-pane" role="tabpanel">
                <div class="card card-body border-top-0 rounded-bottom">
                    <p>Gere um relatório completo do status do seu estoque de produtos.</p>
                    <div class="col-md-4">
                        <button class="btn btn-primary w-100" data-action="gerar-relatorio-produtos">
                            <i class="bi bi-box-seam me-2"></i>Gerar Relatório de Estoque
                        </button>
                    </div>
                </div>
            </div>

            <div class="tab-pane fade" id="area-tab-pane" role="tabpanel">
                <div class="card card-body border-top-0 rounded-bottom">
                    <div class="row g-3 align-items-end">
                        <div class="col-md-4">
                            <label for="rel-area-select" class="form-label">Selecione a Área</label>
                            <select id="rel-area-select" class="form-select">
                                <option value="">Selecione...</option>
                                ${areasDisponiveis.map(a => `<option value="${a.id}">${a.nome}</option>`).join('')}
                            </select>
                        </div>
                        <div class="col-md-3">
                            <label for="rel-data-inicio" class="form-label">Data de Início</label>
                            <input type="date" id="rel-data-inicio" class="form-control">
                        </div>
                        <div class="col-md-3">
                            <label for="rel-data-fim" class="form-label">Data de Fim</label>
                            <input type="date" id="rel-data-fim" class="form-control">
                        </div>
                        <div class="col-md-2">
                            <button class="btn btn-primary w-100" data-action="gerar-relatorio-area">
                                <i class="bi bi-search"></i> Gerar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div id="resultado-relatorio" class="mt-4"></div>
    `;
}
async function gerarRelatorioServicos() {
    const dataInicio = document.getElementById('data-inicio').value;
    const dataFim = document.getElementById('data-fim').value;
    const resultadoDiv = document.getElementById('resultado-relatorio');

    if (!dataInicio || !dataFim) {
        showToast("Por favor, selecione a data de início e de fim.", "error");
        return;
    }

    resultadoDiv.innerHTML = '<p>Buscando dados...</p>';
    console.log("--- PISTA A: Função iniciada.");

    try {
        const urlCompleta = `${apiUrl}/api/relatorios/servicos?data_inicio=${dataInicio}&data_fim=${dataFim}`;
        const response = await fetch(urlCompleta, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log("--- PISTA B: Resposta da API recebida com status:", response.status);
        if (!response.ok) throw new Error('Falha ao buscar dados do relatório.');

        dadosRelatorioAtual = await response.json();
        console.log(`--- PISTA C: Dados convertidos para JSON. Encontrados ${dadosRelatorioAtual.length} registros.`);

        if (dadosRelatorioAtual.length === 0) {
            resultadoDiv.innerHTML = '<div class="alert alert-warning">Nenhum serviço encontrado para o período selecionado.</div>';
            return;
        }

        let tabelaHtml = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h3>Resultados</h3>
                <button class="btn btn-success" data-action="exportar-pdf">
                    <i class="bi bi-file-earmark-arrow-down-fill me-2"></i>Exportar para PDF
                </button>
            </div>
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr><th>ID</th><th>Área</th><th>Data</th><th>Status</th><th>Produtos Utilizados</th></tr>
                    </thead>
                    <tbody>`;
        
        console.log("--- PISTA D: Iniciando a criação da tabela HTML.");
        
        dadosRelatorioAtual.forEach(s => {
            const produtosStr = s.produtos_associados.map(p => `${p.produto.nome} (${p.quantidade_usada})`).join(', ') || 'N/A';
            tabelaHtml += `<tr><td>${s.id}</td><td>${s.area.nome}</td><td>${new Date(s.data + 'T00:00:00').toLocaleDateString()}</td><td>${s.status}</td><td>${produtosStr}</td></tr>`;
        });

        tabelaHtml += '</tbody></table></div>';
        console.log("--- PISTA E: Tabela HTML criada. Inserindo na página.");
        resultadoDiv.innerHTML = tabelaHtml;
        console.log("--- PISTA F: Relatório exibido com sucesso!");

    } catch (error) {
        console.error("--- ERRO NO BLOCO CATCH: ---", error); // Log de erro explícito
        resultadoDiv.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}
/**
 * Exporta os dados do relatório atual para um arquivo PDF.
 */
function exportarRelatorioParaPDF() {
    if (dadosRelatorioAtual.length === 0) {
        showToast("Não há dados para exportar.", "info");
        return;
    }
    
    // Inicia a biblioteca jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Título do PDF
    doc.setFontSize(18);
    doc.text("Relatório de Serviços", 14, 22);

    // Cabeçalho dos dados
    doc.setFontSize(11);
    const dataInicio = new Date(document.getElementById('data-inicio').value + 'T00:00:00').toLocaleDateString();
    const dataFim = new Date(document.getElementById('data-fim').value + 'T00:00:00').toLocaleDateString();
    doc.text(`Período de ${dataInicio} a ${dataFim}`, 14, 30);

    // Define os cabeçalhos da nossa tabela
    const head = [['ID', 'Data', 'Área', 'Status', 'Produtos Utilizados']];
    
    // Prepara o corpo da tabela, mapeando nossos dados para o formato de array
    const body = dadosRelatorioAtual.map(s => {
        const dataFormatada = new Date(s.data + 'T00:00:00').toLocaleDateString();
        const produtosStr = s.produtos_associados.map(p => `${p.produto.nome} (${p.quantidade_usada})`).join(', ') || 'N/A';
        return [s.id, dataFormatada, s.area.nome, s.status, produtosStr];
    });

    // Usa a função autoTable para desenhar a tabela
    doc.autoTable({
        startY: 40, // Posição vertical onde a tabela começa
        head: head,
        body: body,
        theme: 'striped', // Estilo da tabela: 'striped', 'grid' ou 'plain'
        headStyles: { fillColor: [41, 128, 185] } // Cor do cabeçalho (azul)
    });

    // Salva o arquivo
    doc.save(`relatorio_servicos_${new Date().toISOString().slice(0, 10)}.pdf`);
}

let dadosRelatorioProdutos = []; // Guarda os dados do relatório de produtos

/**
 * Busca os dados de produtos e exibe o relatório de estoque.
 */
async function gerarRelatorioProdutos() {
    const resultadoDiv = document.getElementById('resultado-relatorio');
    resultadoDiv.innerHTML = '<p>Buscando dados de produtos...</p>';

    try {
        const response = await fetch(`${apiUrl}/api/relatorios/produtos`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Falha ao buscar dados de produtos.');
        
        dadosRelatorioProdutos = await response.json();

        if (dadosRelatorioProdutos.length === 0) {
            resultadoDiv.innerHTML = '<div class="alert alert-warning">Nenhum produto cadastrado.</div>';
            return;
        }

        let tabelaHtml = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h3>Relatório de Estoque</h3>
                <button class="btn btn-success" data-action="exportar-pdf-produtos">
                    <i class="bi bi-file-earmark-arrow-down-fill me-2"></i>Exportar para PDF
                </button>
            </div>
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>ID</th><th>Produto</th><th>Estoque Atual</th><th>Estoque Mínimo</th><th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        dadosRelatorioProdutos.forEach(p => {
            const status = p.estoque_atual > p.estoque_minimo ? 'OK' : 'BAIXO';
            const statusClass = p.estoque_atual > p.estoque_minimo ? 'text-success' : 'text-danger fw-bold';
            tabelaHtml += `
                <tr>
                    <td>${p.id}</td>
                    <td>${p.nome}</td>
                    <td>${p.estoque_atual.toFixed(2)} ${p.unidade_estoque}</td>
                    <td>${p.estoque_minimo.toFixed(2)}</td>
                    <td class="${statusClass}">${status}</td>
                </tr>
            `;
        });
        tabelaHtml += '</tbody></table></div>';
        resultadoDiv.innerHTML = tabelaHtml;

    } catch (error) {
        resultadoDiv.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}

/**
 * Exporta os dados do relatório de estoque para um arquivo PDF.
 */
function exportarRelatorioProdutosPDF() {
    if (dadosRelatorioProdutos.length === 0) {
        showToast("Não há dados para exportar.", "info");
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Relatório de Estoque de Produtos", 14, 22);
    
    const head = [['ID', 'Produto', 'Estoque Atual', 'Estoque Mínimo', 'Status']];
    const body = dadosRelatorioProdutos.map(p => {
        const status = p.estoque_atual > p.estoque_minimo ? 'OK' : 'Estoque Baixo';
        return [p.id, p.nome, `${p.estoque_atual.toFixed(2)} ${p.unidade_estoque}`, p.estoque_minimo.toFixed(2), status];
    });

    doc.autoTable({
        startY: 30,
        head: head,
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] }
    });

    doc.save(`relatorio_estoque_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function loadDashboardModule() {
    mainContent.innerHTML = `
        <h1 class="mb-4">Dashboard</h1>
        <div class="row">
            <div class="col-lg-4 col-md-6 mb-4">
                <div class="card text-center h-100">
                    <div class="card-header">Serviços no Mês</div>
                    <div class="card-body d-flex align-items-center justify-content-center">
                        <p class="card-text display-4" id="kpi-servicos-mes">0</p>
                    </div>
                </div>
            </div>
            <div class="col-lg-8 col-md-6 mb-4">
                <div class="card h-100">
                    <div class="card-header">Produtos Mais Usados no Mês</div>
                    <div class="card-body">
                        <ul class="list-group list-group-flush" id="kpi-produtos-lista">
                            <li class="list-group-item">Carregando...</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <ul class="nav nav-tabs card-header-tabs" id="dashboard-tabs" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active" id="grafico-tab" data-bs-toggle="tab" data-bs-target="#grafico-pane" type="button" role="tab">Gráfico Resumo</button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="tabela-tab" data-bs-toggle="tab" data-bs-target="#tabela-pane" type="button" role="tab">Tabela de Contagem</button>
                    </li>
                </ul>
            </div>
            <div class="card-body">
                <div class="tab-content" id="dashboard-tabs-content">
                    <div class="tab-pane fade show active" id="grafico-pane" role="tabpanel">
                        <canvas id="grafico-dispositivos"></canvas>
                    </div>
                    <div class="tab-pane fade" id="tabela-pane" role="tabpanel">
                        <div class="table-responsive">
                            <table class="table table-striped">
                                <thead class="table-light">
                                    <tr>
                                        <th>Tipo de Dispositivo</th>
                                        <th>Ativos</th>
                                        <th>Inativos</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody id="tabela-contagem-corpo">
                                    </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    fetchAndDisplayDashboardData();
}

async function fetchAndDisplayDashboardData() {
    try {
        const response = await fetch(`${apiUrl}/api/dashboard/summary`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error('Falha ao carregar dados do dashboard.');
        const data = await response.json();

        // --- Preenche os cards de KPI (nenhuma mudança aqui) ---
        document.getElementById('kpi-servicos-mes').textContent = data.servicos_no_mes;
        const listaProdutos = document.getElementById('kpi-produtos-lista');
        listaProdutos.innerHTML = '';
        if (data.produtos_usados_no_mes.length > 0) {
            data.produtos_usados_no_mes.forEach(p => {
                const li = document.createElement('li');
                li.className = 'list-group-item';
                li.textContent = `${p.nome} - ${p.total_usado.toFixed(2)} ${p.unidade_uso}`;
                listaProdutos.appendChild(li);
            });
        } else {
            listaProdutos.innerHTML = '<li class="list-group-item">Nenhum produto usado este mês.</li>';
        }

        // --- Preenche a Aba 1: Gráfico (nenhuma mudança aqui) ---
        const summary = data.dispositivos_summary;
        const labels = Object.keys(summary).sort();
        const dadosAtivos = labels.map(tipo => summary[tipo].Ativo || 0);
        const dadosInativos = labels.map(tipo => summary[tipo].Inativo || 0);
        
        const ctx = document.getElementById('grafico-dispositivos').getContext('2d');
        if (window.myDeviceChart) window.myDeviceChart.destroy();
        window.myDeviceChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Ativo', data: dadosAtivos, backgroundColor: 'rgba(25, 135, 84, 0.7)' },
                    { label: 'Inativo', data: dadosInativos, backgroundColor: 'rgba(220, 53, 69, 0.7)' }
                ]
            },
            options: { /* ... opções do gráfico ... */ }
        });

        // =================================================================
        // ✅ CÓDIGO NOVO PARA PREENCHER A ABA 2: TABELA
        // =================================================================
        const tabelaCorpo = document.getElementById('tabela-contagem-corpo');
        tabelaCorpo.innerHTML = ''; // Limpa a tabela
        let totalGeralAtivos = 0;
        let totalGeralInativos = 0;

        labels.forEach(tipo => {
            const ativos = summary[tipo].Ativo || 0;
            const inativos = summary[tipo].Inativo || 0;
            const totalTipo = ativos + inativos;
            totalGeralAtivos += ativos;
            totalGeralInativos += inativos;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${tipo}</strong></td>
                <td>${ativos}</td>
                <td>${inativos}</td>
                <td>${totalTipo}</td>
            `;
            tabelaCorpo.appendChild(tr);
        });

        // Adiciona uma linha de total no final da tabela
        const trTotal = document.createElement('tr');
        trTotal.className = 'table-group-divider fw-bold';
        trTotal.innerHTML = `
            <td>Total Geral</td>
            <td>${totalGeralAtivos}</td>
            <td>${totalGeralInativos}</td>
            <td>${totalGeralAtivos + totalGeralInativos}</td>
        `;
        tabelaCorpo.appendChild(trTotal);

    } catch (error) {
        showToast(error.message, 'error');
    }
    
}

// Em app.js, adicione esta nova função

async function gerarRelatorioArea() {
    const areaId = document.getElementById('rel-area-select').value;
    const dataInicio = document.getElementById('rel-data-inicio').value;
    const dataFim = document.getElementById('rel-data-fim').value;
    const resultadoDiv = document.getElementById('resultado-relatorio');

    if (!areaId || !dataInicio || !dataFim) {
        showToast("Por favor, selecione a área e o período de datas.", "error");
        return;
    }

    resultadoDiv.innerHTML = '<p class="text-center">Buscando dados compilados...</p>';

    try {
        const url = `${apiUrl}/api/relatorios/area-compilado?area_id=${areaId}&data_inicio=${dataInicio}&data_fim=${dataFim}`;
        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Falha ao buscar dados do relatório.');
        }

        const data = await response.json();

        // --- Monta o HTML do Relatório ---
        const produtosHtml = data.produtos_utilizados.length > 0 ?
            data.produtos_utilizados.map(p => `<tr><td>${p.nome}</td><td>${p.total_usado.toFixed(2)} ${p.unidade_uso}</td></tr>`).join('') :
            '<tr><td colspan="2">Nenhum produto utilizado.</td></tr>';

        const contagensHtml = data.contagens_pragas.length > 0 ?
            data.contagens_pragas.map(c => `<tr><td>${c.praga_nome}</td><td>${c.total_contado}</td></tr>`).join('') :
            '<tr><td colspan="2">Nenhuma praga contada.</td></tr>';
            
        const statusHtml = data.dispositivos_status.length > 0 ?
            data.dispositivos_status.map(d => `<li>${d.tipo} ${d.numero}: <strong>${d.status_registrado}</strong></li>`).join('') :
            '<li>Nenhuma alteração de status registrada.</li>';
            
        const mipHtml = data.ocorrencias_mip.length > 0 ?
            data.ocorrencias_mip.map(o => `<li><strong>Serviço #${o.servico_id}:</strong> ${o.pragas_observadas}</li>`).join('') :
            '<li>Nenhuma observação MIP.</li>';
            
        const obsHtml = data.observacoes_gerais.length > 0 ?
            data.observacoes_gerais.map(o => `<li><strong>Serviço #${o.servico_id}:</strong> ${o.observacoes}</li>`).join('') :
            '<li>Nenhuma observação geral.</li>';


        const relatorioHtml = `
            <div class="report-container border p-4 bg-white" id="relatorio-para-imprimir">
                <div class="text-center mb-4">
                    <h2>Relatório de Atividades por Área</h2>
                    <p class="lead">SISE - Sistema Integrado de Serviços</p>
                </div>

                <div class="card mb-4">
                    <div class="card-header"><strong>Área: ${data.area.nome}</strong></div>
                    <div class="card-body row">
                        <div class="col-md-4"><strong>Responsável:</strong> ${data.area.responsavel || 'Não informado'}</div>
                        <div class="col-md-4"><strong>Telefone:</strong> ${data.area.telefone || 'Não informado'}</div>
                        <div class="col-md-4"><strong>Período:</strong> ${new Date(data.data_inicio+'T00:00:00').toLocaleDateString()} a ${new Date(data.data_fim+'T00:00:00').toLocaleDateString()}</div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-6">
                        <h5>Produtos Utilizados (Total)</h5>
                        <table class="table table-sm table-bordered"><thead><th>Produto</th><th>Qtd. Total</th></thead><tbody>${produtosHtml}</tbody></table>
                        
                        <h5 class="mt-4">Contagem de Pragas (Total)</h5>
                        <table class="table table-sm table-bordered"><thead><th>Praga</th><th>Total Contado</th></thead><tbody>${contagensHtml}</tbody></table>
                    </div>
                    <div class="col-md-6">
                        <h5>Status de Dispositivos Registrados</h5>
                        <ul class="list-unstyled">${statusHtml}</ul>

                        <h5 class="mt-4">Observações MIP Registradas</h5>
                        <ul class="list-unstyled">${mipHtml}</ul>
                        
                        <h5 class="mt-4">Observações Gerais dos Serviços</h5>
                        <ul class="list-unstyled">${obsHtml}</ul>
                    </div>
                </div>
            </div>
            <div class="text-center mt-4">
                <button class="btn btn-primary" onclick="window.print()"><i class="bi bi-printer"></i> Imprimir Relatório</button>
            </div>
        `;

        resultadoDiv.innerHTML = relatorioHtml;

    } catch (error) {
        resultadoDiv.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}

