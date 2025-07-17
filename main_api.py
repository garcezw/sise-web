from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import models
from database import engine

# ✅ 1. Importando todos os routers, incluindo o novo 'dashboard'
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
models.Base.metadata.create_all(bind=engine)

# Cria a instância principal do FastAPI
app = FastAPI(
    title="API do Sistema SISE",
    description="API com lógica de negócio para a aplicação web do SISE.",
    version="1.2.0", # Versão com Dashboard Completo e Refatorado!
)

# =================================================================
# MIDDLEWARE (Configurações Globais)
# =================================================================

# Configuração de CORS para permitir a comunicação com o frontend
origins = [
    "http://localhost:8080",
    # Futuramente, adicione aqui o domínio do seu site em produção
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =================================================================
# INCLUSÃO DOS ROUTERS (Módulos da API)
# =================================================================

# ✅ A lógica do dashboard foi movida para o seu próprio router.
#    O arquivo main_api.py agora só precisa incluir a referência.

app.include_router(usuarios.router)
app.include_router(areas.router)
app.include_router(dispositivos.router)
app.include_router(produtos.router)
app.include_router(servicos.router)
app.include_router(mip.router)
app.include_router(relatorios.router)
app.include_router(agenda.router)
app.include_router(dashboard.router) # ✅ Roteador do Dashboard incluído!

# =================================================================
# ROTA PRINCIPAL
# =================================================================

@app.get("/", tags=["Root"], include_in_schema=False)
def read_root():
    """Rota raiz para verificar se a API está online."""
    return {"Sistema": "API do SISE", "Status": "Online"}