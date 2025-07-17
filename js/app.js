// Arquivo: js/app.js (VERSÃO FINAL E COMPLETA)

// =================================================================
// --- IMPORTS DE TODOS OS MÓDULOS E FUNÇÕES ---
// =================================================================
import { showToast } from './ui_utils.js';
import { loadDashboardModule } from './module_dashboard.js';
import { loadAreasModule, iniciarEdicaoArea, excluirArea, modoAdicionarArea } from './module_areas.js';
import { loadProdutosModule, iniciarEdicaoProduto, excluirProduto, modoAdicionarProduto } from './module_produtos.js';
import { loadDispositivosModule, fetchAndDisplayDispositivos, iniciarEdicaoDispositivo, excluirDispositivo, modoAdicionarDispositivo, abrirModalLote, abrirModalVerificacao } from './module_dispositivos.js';
import { loadServicosModule, iniciarEdicaoServico, excluirServico, concluirServico, modoAdicionarServico, adicionarProdutoAoServicoTemp, removerProdutoDoServicoTemp, handleServicoSubmit } from './module_servicos.js';
import { loadContagemModule, carregarGradeContagem, salvarContagem } from './module_contagem.js';
import { loadConfiguracoesModule, excluirPraga } from './module_configuracoes.js';
import { loadSegurancaModule, salvarPermissoes, excluirUsuario } from './module_seguranca.js';
import { loadRelatoriosModule, gerarRelatorioServicos, exportarRelatorioServicosPDF, gerarRelatorioProdutos, exportarRelatorioProdutosPDF, gerarRelatorioArea } from './module_relatorios.js';
import { abrirModalObservacaoMIP } from './module_mip_modal.js';
import { loadAgendaModule, abrirModalAgendamento, abrirModalOcorrencia, iniciarExclusaoOcorrencia, iniciarEdicaoOcorrencia, iniciarExclusaoAgendamento, iniciarEdicaoAgendamento } from './module_agenda.js';
import { exibirRelatorioServico } from './module_servico_relatorio.js';

// =================================================================
// --- GLOBAIS E INICIALIZAÇÃO ---
// =================================================================

export const token = localStorage.getItem('accessToken');
export const apiUrl = 'http://127.0.0.1:8000';
export let currentUser = null;
export let areasDisponiveis = [];

// ✅ FONTE ÚNICA DA VERDADE PARA OS MÓDULOS
export const modules = {
    // Adicionamos 'isNav: true' para todos os módulos que devem aparecer no menu
    dashboard: { label: 'Dashboard', icon: 'bi-grid-1x2-fill', isNav: true },
    agenda: { label: 'Agenda', icon: 'bi-calendar-week', isNav: true },
    areas: { label: 'Áreas', icon: 'bi-geo-alt-fill', isNav: true },
    produtos: { label: 'Produtos', icon: 'bi-box-seam', isNav: true },
    dispositivos: { label: 'Dispositivos', icon: 'bi-hdd-stack', isNav: true },
    servicos: { label: 'Serviços', icon: 'bi-tools', isNav: true },
    contagem: { label: 'Contagem de Pragas', icon: 'bi-grid-1x2', isNav: true },
    relatorios: { label: 'Relatórios', icon: 'bi-file-earmark-bar-graph', isNav: true },
    configuracoes: { label: 'Configurações', icon: 'bi-gear', isNav: true },
    seguranca: { label: 'Segurança', icon: 'bi-shield-lock', isNav: true },
    
    // A nossa permissão especial não tem 'isNav', então ela continuará escondida do menu
    admin_servicos: { label: 'Editar Serviços Concluídos', icon: 'bi-shield-check' }
};
const sidebarMenu = document.getElementById('sidebar-menu');
const usernameDisplay = document.getElementById('username-display');
const logoutButton = document.getElementById('logout-button');

// --- Inicialização da Aplicação ---
if (!token) {
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const [userResponse, areasResponse] = await Promise.all([
            fetch(`${apiUrl}/api/users/me`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${apiUrl}/api/areas/`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (!userResponse.ok) {
            throw new Error('Sessão inválida ou expirada. Por favor, faça login novamente.');
        }

        currentUser = await userResponse.json();
        areasDisponiveis = await areasResponse.json();
        
        // Pega a referência ao mainContent e adiciona o ouvinte de cliques aqui
        // ✅ CORREÇÃO: Adicionamos 'const' para declarar a variável
        const mainContent = document.getElementById('main-content');
        mainContent.addEventListener('click', handleMainContentClick);

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
// --- ROTEADOR PRINCIPAL E NAVEGAÇÃO ---
// =================================================================

function buildSidebar(permissionsStr) {
    const permissions = (permissionsStr || '').split(',').map(p => p.trim());
    sidebarMenu.innerHTML = '';
    
    Object.keys(modules).forEach(key => {
        const module = modules[key];
        
        // ✅ CONDIÇÃO ATUALIZADA:
        // Agora só cria o item se o usuário tiver a permissão E se o módulo for de navegação
        if (permissions.includes(key) && module.isNav) {
            const li = document.createElement('li');
            li.innerHTML = `<a href="#" class="nav-link text-white" data-module="${key}"><i class="bi ${module.icon} me-2"></i>${module.label}</a>`;
            sidebarMenu.appendChild(li);
        }
    });
}

function loadInitialModule(permissionsStr) {
    const permissions = (permissionsStr || '').split(',').map(p => p.trim());
    const firstPermission = permissions.includes('dashboard') ? 'dashboard' : permissions[0];

    if (firstPermission) {
        loadModule(firstPermission);
        const link = sidebarMenu.querySelector(`.nav-link[data-module="${firstPermission}"]`);
        if (link) link.classList.add('active');
    } else {
        const mainContent = document.getElementById('main-content');
        if (mainContent) mainContent.innerHTML = '<h1>Acesso Negado</h1><p>Você não tem permissão para acessar nenhum módulo.</p>';
    }
}

function loadModule(moduleName) {
    
    const mainContent = document.getElementById('main-content');
    
    // Apenas limpa o conteúdo e mostra o spinner de carregamento
    mainContent.innerHTML = `<div class="d-flex justify-content-center align-items-center" style="height: 80vh;"><div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;"><span class="visually-hidden">Carregando...</span></div></div>`;

    // Chama a função do módulo apropriado
    setTimeout(() => {
        // O seu switch com todos os 'cases' para cada módulo vai aqui.
        // Certifique-se de que ele chama a função correta importada do seu novo sistema modular.
        switch (moduleName) {
            case 'dashboard': loadDashboardModule(); break;
            case 'agenda': loadAgendaModule(); break;
            case 'areas': loadAreasModule(); break;
            case 'produtos': loadProdutosModule(); break;
            case 'dispositivos': loadDispositivosModule(); break;
            case 'servicos': loadServicosModule(); break;
            case 'contagem': loadContagemModule(); break;
            case 'relatorios': loadRelatoriosModule(); break;
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
// --- MANIPULADOR DE EVENTOS CENTRAL (EVENT DELEGATION) ---
// =================================================================

function handleMainContentClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const id = target.dataset.id;

    switch(action) {
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
        case 'open-lote-modal': abrirModalLote(); break;
        case 'verificar-dispositivos': abrirModalVerificacao(id, target.dataset.areaId); break;
        case 'filter-dispositivos':
            document.querySelectorAll('#pills-tab-disp .nav-link').forEach(btn => btn.classList.remove('active'));
            target.classList.add('active');
            fetchAndDisplayDispositivos();
            break;
        // Serviços
        case 'add-produto-servico': adicionarProdutoAoServicoTemp(); break;
        case 'remove-produto-servico': removerProdutoDoServicoTemp(id); break;
        case 'submit-servico': handleServicoSubmit(e); break;
        case 'cancel-edit-servico': modoAdicionarServico(); break;
        case 'edit-servico': iniciarEdicaoServico(id); break;
        case 'delete-servico': excluirServico(id); break;
        case 'concluir-servico': concluirServico(id); break;
        case 'ver-relatorio': exibirRelatorioServico(id); break;
        // Configurações
        case 'delete-praga': excluirPraga(id, target.dataset.nome); break;
        // Contagem
        case 'carregar-grade': carregarGradeContagem(); break;
        case 'salvar-contagem': salvarContagem(target.dataset.areaid, target.dataset.data, target.dataset.servicoid || null); break;
        // Relatórios
        case 'gerar-relatorio-servicos': gerarRelatorioServicos(); break;
        case 'exportar-pdf-servicos': exportarRelatorioServicosPDF(); break;
        case 'gerar-relatorio-produtos': gerarRelatorioProdutos(); break;
        case 'exportar-pdf-produtos': exportarRelatorioProdutosPDF(); break;
        case 'gerar-relatorio-area': gerarRelatorioArea(); break;
        // MIP
        case 'abrir-form-mip': abrirModalObservacaoMIP(id, target.dataset.areaNome); break;
        // Agenda
        case 'delete-ocorrencia': iniciarExclusaoOcorrencia(id); break;
        case 'edit-ocorrencia': iniciarEdicaoOcorrencia(id); break;
        case 'abrir-form-agendamento': abrirModalAgendamento(target.dataset.date); break;
        case 'abrir-form-ocorrencia': abrirModalOcorrencia(target.dataset.date); break;
        case 'edit-agendamento': iniciarEdicaoAgendamento(id); break; // Preparando para o futuro
        case 'delete-agendamento': iniciarExclusaoAgendamento(id); break;
        
    }
}