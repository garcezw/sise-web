// Arquivo: js/module_dashboard.js (Versão com Gráfico de Dispositivos)

import { apiUrl, token } from './app.js';
import { showToast } from './ui_utils.js';

export function loadDashboardModule() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `
        <h1 class="mb-4">Dashboard</h1>
        <div class="row">
            <div class="col-lg-5">
                <div class="card mb-4">
                    <div class="card-header fw-bold">Serviços no Mês</div>
                    <div class="card-body text-center">
                        <p class="card-text display-4" id="kpi-servicos-mes"><span class="spinner-border spinner-border-sm"></span></p>
                    </div>
                </div>
                <div class="card mb-4">
                    <div class="card-header fw-bold"><i class="bi bi-box-seam-fill text-info me-2"></i>Produtos Mais Usados no Mês</div>
                    <ul class="list-group list-group-flush" id="kpi-produtos-lista" style="max-height: 250px; overflow-y: auto;"></ul>
                </div>
            </div>
            <div class="col-lg-7">
                 <div class="card">
                    <div class="card-header">
                        <ul class="nav nav-tabs card-header-tabs" id="dashboard-tabs" role="tablist">
                            <li class="nav-item" role="presentation"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#grafico-pane">Gráfico</button></li>
                            <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabela-pane">Tabela</button></li>
                            <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#total-pane">Total por Tipo</button></li>
                        </ul>
                    </div>
                    <div class="card-body">
                        <div class="tab-content" id="dashboard-tabs-content">
                            <div class="tab-pane fade show active" id="grafico-pane" role="tabpanel"><canvas id="grafico-dispositivos"></canvas></div>
                            <div class="tab-pane fade" id="tabela-pane" role="tabpanel"><div class="table-responsive"><table class="table table-striped"><thead class="table-light"><tr><th>Tipo</th><th>Ativo</th><th>Inativo</th><th>Total</th></tr></thead><tbody id="tabela-contagem-corpo"></tbody></table></div></div>
                            <div class="tab-pane fade" id="total-pane" role="tabpanel">
                                <h5 class="card-title mt-3">Resumo Total de Dispositivos</h5>
                                <div id="resumo-total-dispositivos"></div>
                            </div>
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

        // Preenche Serviços e Produtos
        document.getElementById('kpi-servicos-mes').textContent = data.servicos_no_mes;
        const listaProdutos = document.getElementById('kpi-produtos-lista');
        listaProdutos.innerHTML = '';
        if (data.produtos_usados_no_mes && data.produtos_usados_no_mes.length > 0) {
            data.produtos_usados_no_mes.forEach(p => {
                const li = document.createElement('li');
                li.className = 'list-group-item';
                li.textContent = `${p.nome} - ${p.total_usado.toFixed(2)} ${p.unidade_uso}`;
                listaProdutos.appendChild(li);
            });
        } else {
            listaProdutos.innerHTML = '<li class="list-group-item text-muted">Nenhum produto usado este mês.</li>';
        }

        // Preenche Gráfico, Tabela e Totais de Dispositivos
        const summary = data.dispositivos_summary;
        const labels = Object.keys(summary).sort();
        document.getElementById('tabela-contagem-corpo').innerHTML = '';
        document.getElementById('resumo-total-dispositivos').innerHTML = '';

        if (labels.length > 0) {
            const dadosAtivos = labels.map(tipo => summary[tipo].Ativo || 0);
            const dadosInativos = labels.map(tipo => summary[tipo].Inativo || 0);
            const ctx = document.getElementById('grafico-dispositivos').getContext('2d');
            if (window.myDeviceChart) window.myDeviceChart.destroy();
            window.myDeviceChart = new Chart(ctx, {
                type: 'bar',
                data: { labels: labels, datasets: [
                    { label: 'Ativo', data: dadosAtivos, backgroundColor: 'rgba(25, 135, 84, 0.7)' },
                    { label: 'Inativo', data: dadosInativos, backgroundColor: 'rgba(220, 53, 69, 0.7)' }
                ]},
                options: { responsive: true, scales: { y: { beginAtZero: true } } }
            });

            labels.forEach(tipo => {
                const statusCounts = summary[tipo];
                const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
                const detalhes = Object.entries(statusCounts).map(([status, count]) => `${count} ${status.toUpperCase()}`).join(', ');
                document.getElementById('resumo-total-dispositivos').innerHTML += `<p><strong>${tipo} TOTAL ${total}</strong> (${detalhes})</p>`;
                document.getElementById('tabela-contagem-corpo').innerHTML += `<tr><td><strong>${tipo}</strong></td><td>${statusCounts.Ativo || 0}</td><td>${statusCounts.Inativo || 0}</td><td>${total}</td></tr>`;
            });
        } else {
            document.getElementById('grafico-pane').innerHTML = '<p class="text-center p-4 text-muted">Nenhum dispositivo cadastrado.</p>';
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}