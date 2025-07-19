// Arquivo: js/module_mapas.js

import { apiUrl, token, areasDisponiveis, refreshAreas } from './app.js';
import { showToast, setButtonLoading } from './ui_utils.js';

export function loadMapasModule() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `
        <h1 class="mb-4">Gerenciar Mapas das Áreas</h1>
        <div class="row">
            <div class="col-lg-7">
                <div class="card">
                    <div class="card-header fw-bold">
                        1. Selecione uma Área e envie a imagem do mapa
                    </div>
                    <div class="card-body">
                        <form id="form-upload-mapa" class="mt-3">
                            <div class="mb-3">
                                <label for="mapa-area-select" class="form-label">Área</label>
                                <select class="form-select" id="mapa-area-select" required>
                                    <option value="" selected disabled>Selecione uma área...</option>
                                    ${areasDisponiveis.map(a => `<option value="${a.id}" data-mapa-url="${a.mapa_url || ''}">${a.nome}</option>`).join('')}
                                </select>
                            </div>
                            <div class="mb-3">
                                <label for="mapa-file-input" class="form-label">Arquivo de Imagem (Planta Baixa)</label>
                                <input class="form-control" type="file" id="mapa-file-input" accept="image/*" required>
                            </div>
                            <button type="submit" class="btn btn-primary"><i class="bi bi-upload me-2"></i>Enviar Mapa</button>
                        </form>
                    </div>
                </div>
            </div>
            <div class="col-lg-5">
                <div class="card">
                    <div class="card-header fw-bold">2. Preview do Mapa</div>
                    <div class="card-body text-center" id="mapa-preview-container" style="min-height: 300px; display: flex; align-items: center; justify-content: center;">
                        <p class="text-muted">Selecione uma área para ver o mapa.</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Adiciona os listeners de eventos
    document.getElementById('form-upload-mapa').addEventListener('submit', handleMapaUpload);
    document.getElementById('mapa-area-select').addEventListener('change', displayMapaPreview);
}

function displayMapaPreview() {
    const select = document.getElementById('mapa-area-select');
    // Pega a opção que está selecionada no momento
    const selectedOption = select.options[select.selectedIndex];
    // Pega a URL do mapa que guardamos no atributo 'data-mapa-url'
    const mapaUrl = selectedOption.dataset.mapaUrl;
    const previewContainer = document.getElementById('mapa-preview-container');

    if (mapaUrl) {
         previewContainer.innerHTML = `<img src="${apiUrl}/${mapaUrl}" class="img-fluid rounded" alt="Preview do Mapa">`;
    } else {
        previewContainer.innerHTML = '<p class="text-muted">Esta área ainda não possui um mapa.</p>';
    }
}

async function handleMapaUpload(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const areaId = document.getElementById('mapa-area-select').value;
    const fileInput = document.getElementById('mapa-file-input');

    if (!areaId || fileInput.files.length === 0) {
        showToast("Por favor, selecione uma área e um arquivo de imagem.", "error");
        return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    setButtonLoading(submitButton, true, "Enviando...");

    try {
        const response = await fetch(`${apiUrl}/api/areas/${areaId}/mapa`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Falha no upload do mapa.");
        }

        const updatedArea = await response.json();
        
        // Atualiza a URL do mapa no <select> para o preview funcionar sem recarregar a página
        const selectOption = document.querySelector(`#mapa-area-select option[value="${areaId}"]`);
        if (selectOption) {
            selectOption.dataset.mapaUrl = updatedArea.mapa_url;
        }

        showToast("Mapa enviado com sucesso!", "success");
        displayMapaPreview(); // Atualiza o preview com a nova imagem

    } catch (error) {
        console.error("Erro no upload do mapa:", error);
        showToast(error.message, "error");
    } finally {
        setButtonLoading(submitButton, false, '<i class="bi bi-upload me-2"></i>Enviar Mapa');
    }
}