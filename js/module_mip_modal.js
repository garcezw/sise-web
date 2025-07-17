// Arquivo: js/module_mip_modal.js

import { apiUrl, token } from './app.js';
import { showToast, setButtonLoading } from './ui_utils.js';

export function abrirModalObservacaoMIP(servicoId, areaNome) {
    const oldModal = document.getElementById('mipObservacaoModal');
    if (oldModal) oldModal.remove();

    const hoje = new Date().toISOString().split('T')[0];

    const modalHtml = `
        <div class="modal fade" id="mipObservacaoModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header"><h5 class="modal-title">Registrar Observação MIP</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                    <div class="modal-body">
                        <form id="form-observacao-mip" data-servico-id="${servicoId}">
                            <div class="mb-3"><label class="form-label">Área</label><input type="text" class="form-control" value="${areaNome}" readonly disabled></div>
                            <div class="mb-3"><label for="mip-data" class="form-label">Data da Observação*</label><input type="date" class="form-control" id="mip-data" value="${hoje}" required></div>
                            <div class="mb-3"><label for="mip-pragas" class="form-label">Praga(s) Encontrada(s)*</label><textarea class="form-control" id="mip-pragas" rows="3" required placeholder="Ex: Formigas, Baratas..."></textarea></div>
                        </form>
                    </div>
                    <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button><button type="submit" class="btn btn-primary" form="form-observacao-mip" id="btn-salvar-mip">Salvar</button></div>
                </div>
            </div>
        </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalElement = document.getElementById('mipObservacaoModal');
    const mipModal = new bootstrap.Modal(modalElement);
    
    document.getElementById('form-observacao-mip').addEventListener('submit', handleObservacaoMIPSubmit);
    mipModal.show();
}

async function handleObservacaoMIPSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = document.getElementById('btn-salvar-mip');

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
        const response = await fetch(`${apiUrl}/api/mip-registros/`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
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