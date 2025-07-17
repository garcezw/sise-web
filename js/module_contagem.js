// Arquivo: js/module_contagem.js

import { apiUrl, token, areasDisponiveis } from './app.js';
import { showToast, showConfirmModal, setButtonLoading } from './ui_utils.js';

export async function loadContagemModule() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

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
        <div id="grade-container"><p class="text-center text-muted">Selecione uma área e data e clique em "Carregar Grade".</p></div>
    `;
}

export async function carregarGradeContagem() {
    const areaId = document.getElementById('contagem-area-select').value;
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
            gradeContainer.innerHTML = `<div class="alert alert-warning">Nenhuma praga cadastrada. Vá em 'Configurações' para adicioná-las.</div>`;
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
        
        const areaNome = areasDisponiveis.find(a => a.id == areaId)?.nome || "Desconhecida";
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

export async function salvarContagem(areaId, data, servicoId) {
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