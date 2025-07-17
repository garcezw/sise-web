// Arquivo: js/module_servico_relatorio.js

import { apiUrl, token } from './app.js';
import { showToast } from './ui_utils.js';

// Função para imprimir o relatório (pode ser local ou importada)
function imprimirRelatorio() {
    window.print();
}
// Anexa a função à janela global para que o 'onclick' a encontre
window.imprimirRelatorio = imprimirRelatorio;


export async function exibirRelatorioServico(servicoId) {
    showToast("Gerando relatório completo...", "info");

    try {
        const response = await fetch(`${apiUrl}/api/servicos/${servicoId}/relatorio-completo`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Não foi possível gerar o relatório.");
        }
        const data = await response.json();

        const produtosHtml = data.produtos_associados.length > 0 ?
            data.produtos_associados.map(p => `<li>${p.produto.nome}: <strong>${p.quantidade_usada.toFixed(2)} ${p.produto.unidade_uso}</strong></li>`).join('') :
            '<li>Nenhum produto utilizado.</li>';

        const statusHtml = data.dispositivos_status.length > 0 ?
            data.dispositivos_status.map(d => `<li>${d.tipo} ${d.numero}: <strong>${d.status_registrado}</strong></li>`).join('') :
            '<li>Nenhuma alteração de status registrada.</li>';

        const contagensHtml = data.contagens_pragas.length > 0 ?
            data.contagens_pragas.map(c => `<li>${c.praga_nome} em ${c.dispositivo_numero}: <strong>${c.quantidade}</strong></li>`).join('') :
            '<li>Nenhuma contagem de praga registrada.</li>';
        
        const mipHtml = data.ocorrencias_mip.length > 0 ?
            data.ocorrencias_mip.map(o => `<li>${o.pragas_observadas}</li>`).join('') :
            '<li>Nenhuma observação MIP registrada.</li>';

        const relatorioBodyHtml = `
            <div id="relatorio-para-imprimir">
                <h3 class="text-center mb-4">Ordem de Serviço #${data.id}</h3>
                <div class="row mb-3"><div class="col"><strong>Área:</strong> ${data.area.nome}</div><div class="col"><strong>Data:</strong> ${new Date(data.data + 'T00:00:00').toLocaleDateString()}</div></div>
                <div class="row mb-4"><div class="col"><strong>Início:</strong> ${data.horario_inicio || '--:--'}</div><div class="col"><strong>Término:</strong> ${data.horario_termino || '--:--'}</div></div>
                <h4><i class="bi bi-box-seam me-2"></i>Produtos Utilizados</h4><ul class="list-unstyled mb-4">${produtosHtml}</ul>
                <h4><i class="bi bi-card-checklist me-2"></i>Status dos Dispositivos</h4><ul class="list-unstyled mb-4">${statusHtml}</ul>
                <h4><i class="bi bi-bug me-2"></i>Contagem de Pragas</h4><ul class="list-unstyled mb-4">${contagensHtml}</ul>
                <h4><i class="bi bi-eye me-2"></i>Observações MIP</h4><ul class="list-unstyled mb-4">${mipHtml}</ul>
                <h4><i class="bi bi-chat-left-text me-2"></i>Observações Gerais do Serviço</h4><p>${data.observacoes || 'Nenhuma observação geral.'}</p>
            </div>`;
        
        const oldModal = document.getElementById('relatorioModal');
        if (oldModal) oldModal.remove();

        const modalHtml = `
            <div class="modal fade" id="relatorioModal" tabindex="-1">
                <div class="modal-dialog modal-lg modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header"><h5 class="modal-title">Relatório do Serviço #${servicoId}</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                        <div class="modal-body">${relatorioBodyHtml}</div>
                        <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button><button type="button" class="btn btn-primary" onclick="imprimirRelatorio()"><i class="bi bi-printer"></i> Imprimir</button></div>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const relatorioModal = new bootstrap.Modal(document.getElementById('relatorioModal'));
        relatorioModal.show();
    } catch (error) {
        showToast(`Erro ao gerar relatório: ${error.message}`, 'error');
    }
}