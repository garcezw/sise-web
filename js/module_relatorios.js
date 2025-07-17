// Arquivo: js/module_relatorios.js

import { apiUrl, token, areasDisponiveis } from './app.js';
import { showToast } from './ui_utils.js';

// Variáveis de estado locais para este módulo
let dadosRelatorioAtual = [];
let dadosRelatorioProdutos = [];

export function loadRelatoriosModule() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `
        <h1 class="mb-4">Central de Relatórios</h1>
        <ul class="nav nav-tabs" id="relatoriosTab" role="tablist">
            <li class="nav-item" role="presentation"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#servicos-tab-pane">Relatório de Serviços</button></li>
            <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#produtos-tab-pane">Relatório de Estoque</button></li>
            <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#area-tab-pane">Relatório por Área</button></li>
        </ul>
        <div class="tab-content" id="relatoriosTabContent">
            <div class="tab-pane fade show active" id="servicos-tab-pane" role="tabpanel">
                <div class="card card-body border-top-0 rounded-bottom">
                    <div class="row g-3 align-items-end">
                        <div class="col-md-4"><label for="data-inicio" class="form-label">Data de Início</label><input type="date" id="data-inicio" class="form-control"></div>
                        <div class="col-md-4"><label for="data-fim" class="form-label">Data de Fim</label><input type="date" id="data-fim" class="form-control"></div>
                        <div class="col-md-4"><button class="btn btn-primary w-100" data-action="gerar-relatorio-servicos"><i class="bi bi-search me-2"></i>Gerar Relatório</button></div>
                    </div>
                </div>
            </div>
            <div class="tab-pane fade" id="produtos-tab-pane" role="tabpanel">
                <div class="card card-body border-top-0 rounded-bottom">
                    <p>Gere um relatório completo do status do seu estoque de produtos.</p>
                    <div class="col-md-4"><button class="btn btn-primary w-100" data-action="gerar-relatorio-produtos"><i class="bi bi-box-seam me-2"></i>Gerar Relatório</button></div>
                </div>
            </div>
            <div class="tab-pane fade" id="area-tab-pane" role="tabpanel">
                <div class="card card-body border-top-0 rounded-bottom">
                     <div class="row g-3 align-items-end">
                        <div class="col-md-4"><label for="rel-area-select" class="form-label">Selecione a Área</label>
                            <select id="rel-area-select" class="form-select">
                                <option value="">Selecione...</option>
                                ${areasDisponiveis.map(a => `<option value="${a.id}">${a.nome}</option>`).join('')}
                            </select>
                        </div>
                        <div class="col-md-3"><label for="rel-data-inicio" class="form-label">Data de Início</label><input type="date" id="rel-data-inicio" class="form-control"></div>
                        <div class="col-md-3"><label for="rel-data-fim" class="form-label">Data de Fim</label><input type="date" id="rel-data-fim" class="form-control"></div>
                        <div class="col-md-2"><button class="btn btn-primary w-100" data-action="gerar-relatorio-area"><i class="bi bi-search"></i> Gerar</button></div>
                    </div>
                </div>
            </div>
        </div>
        <div id="resultado-relatorio" class="mt-4"></div>
    `;
}

export async function gerarRelatorioServicos() {
    const dataInicio = document.getElementById('data-inicio').value;
    const dataFim = document.getElementById('data-fim').value;
    const resultadoDiv = document.getElementById('resultado-relatorio');

    if (!dataInicio || !dataFim) {
        showToast("Por favor, selecione a data de início e de fim.", "error");
        return;
    }

    resultadoDiv.innerHTML = '<p class="text-center">Buscando dados...</p>';
    try {
        const url = `${apiUrl}/api/relatorios/servicos?data_inicio=${dataInicio}&data_fim=${dataFim}`;
        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error('Falha ao buscar dados do relatório.');

        dadosRelatorioAtual = await response.json();
        if (dadosRelatorioAtual.length === 0) {
            resultadoDiv.innerHTML = '<div class="alert alert-warning">Nenhum serviço encontrado para o período selecionado.</div>';
            return;
        }

        let tabelaHtml = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h3>Resultados</h3>
                <button class="btn btn-success" data-action="exportar-pdf-servicos"><i class="bi bi-file-earmark-arrow-down-fill me-2"></i>Exportar para PDF</button>
            </div>
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead><tr><th>ID</th><th>Área</th><th>Data</th><th>Status</th><th>Produtos Utilizados</th></tr></thead>
                    <tbody>`;
        
        dadosRelatorioAtual.forEach(s => {
            const produtosStr = s.produtos_associados.map(p => `${p.produto.nome} (${p.quantidade_usada})`).join(', ') || 'N/A';
            tabelaHtml += `<tr><td>${s.id}</td><td>${s.area.nome}</td><td>${new Date(s.data + 'T00:00:00').toLocaleDateString()}</td><td>${s.status}</td><td>${produtosStr}</td></tr>`;
        });

        tabelaHtml += '</tbody></table></div>';
        resultadoDiv.innerHTML = tabelaHtml;
    } catch (error) {
        resultadoDiv.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}

export function exportarRelatorioServicosPDF() {
    if (dadosRelatorioAtual.length === 0) {
        showToast("Não há dados para exportar.", "info");
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Relatório de Serviços", 14, 22);

    const dataInicio = new Date(document.getElementById('data-inicio').value + 'T00:00:00').toLocaleDateString();
    const dataFim = new Date(document.getElementById('data-fim').value + 'T00:00:00').toLocaleDateString();
    doc.setFontSize(11);
    doc.text(`Período de ${dataInicio} a ${dataFim}`, 14, 30);

    const head = [['ID', 'Data', 'Área', 'Status', 'Produtos Utilizados']];
    const body = dadosRelatorioAtual.map(s => {
        const dataFormatada = new Date(s.data + 'T00:00:00').toLocaleDateString();
        const produtosStr = s.produtos_associados.map(p => `${p.produto.nome} (${p.quantidade_usada})`).join(', ') || 'N/A';
        return [s.id, dataFormatada, s.area.nome, s.status, produtosStr];
    });

    doc.autoTable({ startY: 40, head: head, body: body, theme: 'striped', headStyles: { fillColor: [41, 128, 185] } });
    doc.save(`relatorio_servicos_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function gerarRelatorioProdutos() {
    const resultadoDiv = document.getElementById('resultado-relatorio');
    resultadoDiv.innerHTML = '<p class="text-center">Buscando dados de produtos...</p>';
    try {
        const response = await fetch(`${apiUrl}/api/relatorios/produtos`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error('Falha ao buscar dados de produtos.');
        dadosRelatorioProdutos = await response.json();

        if (dadosRelatorioProdutos.length === 0) {
            resultadoDiv.innerHTML = '<div class="alert alert-warning">Nenhum produto cadastrado.</div>';
            return;
        }

        let tabelaHtml = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h3>Relatório de Estoque</h3>
                <button class="btn btn-success" data-action="exportar-pdf-produtos"><i class="bi bi-file-earmark-arrow-down-fill me-2"></i>Exportar para PDF</button>
            </div>
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead><tr><th>ID</th><th>Produto</th><th>Estoque Atual</th><th>Estoque Mínimo</th><th>Status</th></tr></thead>
                    <tbody>`;
        dadosRelatorioProdutos.forEach(p => {
            const status = p.estoque_atual > p.estoque_minimo ? 'OK' : 'BAIXO';
            const statusClass = p.estoque_atual > p.estoque_minimo ? 'text-success' : 'text-danger fw-bold';
            tabelaHtml += `<tr><td>${p.id}</td><td>${p.nome}</td><td>${p.estoque_atual.toFixed(2)} ${p.unidade_estoque}</td><td>${p.estoque_minimo.toFixed(2)}</td><td class="${statusClass}">${status}</td></tr>`;
        });
        tabelaHtml += '</tbody></table></div>';
        resultadoDiv.innerHTML = tabelaHtml;
    } catch (error) {
        resultadoDiv.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}

export function exportarRelatorioProdutosPDF() {
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

    doc.autoTable({ startY: 30, head: head, body: body, theme: 'striped', headStyles: { fillColor: [41, 128, 185] } });
    doc.save(`relatorio_estoque_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function gerarRelatorioArea() {
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

        // --- Lógica para a tabela de Produtos (sem alteração) ---
        const produtosHtml = data.produtos_utilizados.length > 0 ?
            data.produtos_utilizados.map(p => `<tr><td>${p.nome}</td><td>${p.total_usado.toFixed(2)} ${p.unidade_uso}</td></tr>`).join('') :
            '<tr><td colspan="2">Nenhum produto utilizado.</td></tr>';
        
        // --- ✅ INÍCIO DA NOVA LÓGICA PARA A GRADE DE CONTAGEM ---
        let contagensHtml = '';
        if (data.contagens_pragas.length > 0) {
            const todasPragas = [...new Set(data.contagens_pragas.map(c => c.praga_nome))].sort();
            const todosDispositivos = [...new Set(data.contagens_pragas.map(c => c.dispositivo_numero))].sort((a, b) => parseInt(a) - parseInt(b));

            let cabecalho = '<th>Dispositivo #</th>';
            todasPragas.forEach(p => cabecalho += `<th>${p}</th>`);
            
            let corpo = '';
            todosDispositivos.forEach(dispNum => {
                corpo += `<tr><td><strong>${dispNum}</strong></td>`;
                todasPragas.forEach(pragaNome => {
                    const contagem = data.contagens_pragas.find(c => c.dispositivo_numero === dispNum && c.praga_nome === pragaNome);
                    corpo += `<td>${contagem ? contagem.quantidade : 0}</td>`;
                });
                corpo += '</tr>';
            });
            contagensHtml = `<table class="table table-sm table-bordered text-center"><thead><tr>${cabecalho}</tr></thead><tbody>${corpo}</tbody></table>`;
        } else {
            contagensHtml = '<p>Nenhuma praga contada.</p>';
        }
        // --- ✅ FIM DA NOVA LÓGICA ---

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
                <div class="text-center mb-4"><h2>Relatório de Atividades por Área</h2><p class="lead">SISE - Sistema Integrado de Serviços</p></div>
                <div class="card mb-4"><div class="card-header"><strong>Área: ${data.area.nome}</strong></div><div class="card-body row"><div class="col-md-4"><strong>Responsável:</strong> ${data.area.responsavel || 'Não informado'}</div><div class="col-md-4"><strong>Telefone:</strong> ${data.area.telefone || 'Não informado'}</div><div class="col-md-4"><strong>Período:</strong> ${new Date(data.data_inicio+'T00:00:00').toLocaleDateString()} a ${new Date(data.data_fim+'T00:00:00').toLocaleDateString()}</div></div></div>
                
                <h5 class="mt-4">Contagem de Pragas (Grade)</h5>
                ${contagensHtml}
                
                <div class="row mt-4">
                    <div class="col-md-6">
                        <h5>Produtos Utilizados (Total)</h5>
                        <table class="table table-sm table-bordered"><thead><th>Produto</th><th>Qtd. Total</th></thead><tbody>${produtosHtml}</tbody></table>
                    </div>
                    <div class="col-md-6">
                        <h5>Status de Dispositivos Registrados</h5>
                        <ul class="list-unstyled">${statusHtml}</ul>
                    </div>
                </div>
                <div class="row mt-4">
                    <div class="col-md-6">
                        <h5>Observações MIP Registradas</h5>
                        <ul class="list-unstyled">${mipHtml}</ul>
                    </div>
                    <div class="col-md-6">
                        <h5>Observações Gerais dos Serviços</h5>
                        <ul class="list-unstyled">${obsHtml}</ul>
                    </div>
                </div>
            </div>
            <div class="text-center mt-4"><button class="btn btn-primary" onclick="window.print()"><i class="bi bi-printer"></i> Imprimir Relatório</button></div>`;

        resultadoDiv.innerHTML = relatorioHtml;
    } catch (error) {
        resultadoDiv.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}