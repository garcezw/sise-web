// Arquivo: js/ui_utils.js

export function showToast(message, type = 'info') {
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

export function showConfirmModal(title, body) {
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
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) backdrop.remove();
            modalElement.remove();
        };

        const onConfirm = () => { resolve(true); cleanup(); };
        const onCancel = () => { resolve(false); cleanup(); };

        modalElement.querySelector('#confirm-ok').addEventListener('click', onConfirm, { once: true });
        modalElement.querySelector('#confirm-cancel').addEventListener('click', onCancel, { once: true });
        modalElement.addEventListener('hidden.bs.modal', () => {
             if (!confirmModal._isTransitioning) { // Previne chamada dupla
                onCancel();
             }
        }, { once: true });

        confirmModal.show();
    });
}

export function setButtonLoading(button, isLoading, originalText = '') {
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