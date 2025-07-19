from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

# Importando seus módulos de banco de dados e routers
import models
from database import engine
from routers import (
    usuarios, 
    areas, 
    dispositivos, 
    produtos, 
    servicos, 
    mip, 
    relatorios, 
    agenda, 
    dashboard
)

# =================================================================
# INICIALIZAÇÃO E CONFIGURAÇÃO DA APLICAÇÃO
# =================================================================

# Cria as tabelas no banco de dados se elas não existirem.
# Ideal para desenvolvimento e para a primeira execução na produção.
models.Base.metadata.create_all(bind=engine)

# Cria a instância principal do FastAPI
app = FastAPI(
    title="API do Sistema SISE",
    description="API com lógica de negócio para a aplicação web do SISE.",
    version="1.2.0",
)

# =================================================================
# MIDDLEWARE (Configurações Globais)
# =================================================================

# ✅ ATUALIZAÇÃO:
# Para evitar erros de CORS (Cross-Origin Resource Sharing) entre a sua
# interface e a API, que agora estão em domínios diferentes, a forma mais
# simples para começar é permitir todas as origens com ["*"].
# No futuro, por segurança, você pode substituir "*" pelas URLs exatas
# do seu frontend e do seu site em produção.
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Permite todos os métodos (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"], # Permite todos os cabeçalhos
)

# =================================================================
# INCLUSÃO DOS ROUTERS (Módulos da API)
# =================================================================

# Esta parte está perfeita, nenhuma alteração necessária.
app.include_router(usuarios.router)
app.include_router(areas.router)
app.include_router(dispositivos.router)
app.include_router(produtos.router)
app.include_router(servicos.router)
app.include_router(mip.router)
app.include_router(relatorios.router)
app.include_router(agenda.router)
app.include_router(dashboard.router)

# =================================================================
# ROTA PRINCIPAL
# =================================================================

@app.get("/", tags=["Root"], include_in_schema=False)
def read_root():
    """Rota raiz para verificar se a API está online."""
    return {"Sistema": "API do SISE", "Status": "Online"}

# =================================================================
# BLOCO DE EXECUÇÃO LOCAL
# =================================================================

# Este bloco só é executado quando você roda o arquivo diretamente com `python main_api.py`
if __name__ == "__main__":
    import uvicorn
    
    # ✅ ATUALIZAÇÃO:
    # O primeiro parâmetro do uvicorn.run deve ser "nome_do_arquivo:instancia_fastapi".
    # Corrigido para usar "main_api:app", que corresponde ao seu projeto.
    uvicorn.run("main_api:app", host="0.0.0.0", port=8000, reload=True)