# Arquivo: run.py

import uvicorn
import webview
import threading
from main_api import app # Importa a sua instância do FastAPI

# Função para rodar o servidor Uvicorn em uma thread separada
# Isso é crucial para que a API e a janela rodem ao mesmo tempo
def run_server():
    uvicorn.run(app, host="127.0.0.1", port=8000)

if __name__ == '__main__':
    # Cria e inicia a thread para o servidor da API
    server_thread = threading.Thread(target=run_server)
    server_thread.daemon = True # Permite que a thread feche quando a janela principal fechar
    server_thread.start()

    # Cria a janela do aplicativo desktop com pywebview
    webview.create_window(
        'SISE - Sistema Integrado',     # Título da Janela
        'http://127.0.0.1:8000/app.html', # URL que a janela deve carregar
        width=1366,
        height=768,
        resizable=True,
        maximized=True # Inicia a janela maximizada
    )
    # Inicia o loop da aplicação GUI e abre as ferramentas de desenvolvedor para depuração
    webview.start(debug=True)