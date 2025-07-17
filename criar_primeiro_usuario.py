# Arquivo: criar_primeiro_usuario.py

# Importa as ferramentas que precisamos
from database import SessionLocal, engine
import models, schemas, security
from crud import crud_usuario

# Garante que as tabelas existam no banco de dados
print("Inicializando... Garantindo que as tabelas existem.")
models.Base.metadata.create_all(bind=engine)
print("Tabelas prontas.")

# Cria uma sessão com o banco de dados
db = SessionLocal()

# --- DADOS DO USUÁRIO ADMINISTRADOR ---
# Você pode alterar o nome de usuário e a senha se quiser
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin"
# Todas as permissões são concedidas ao admin
ADMIN_PERMISSIONS = "dashboard,agenda,areas,produtos,dispositivos,servicos,contagem,relatorios,configuracoes,seguranca"

try:
    # Verifica se o usuário 'admin' já existe
    user = crud_usuario.get_user_by_username(db, username=ADMIN_USERNAME)

    if not user:
        print(f"Usuário '{ADMIN_USERNAME}' não encontrado. Criando agora...")
        
        # Cria o objeto do novo usuário com os dados e a senha criptografada
        user_in = schemas.UserCreate(username=ADMIN_USERNAME, password=ADMIN_PASSWORD)
        
        # Usa a função do CRUD para criar o usuário
        crud_usuario.create_user(db=db, user=user_in, permissions=ADMIN_PERMISSIONS)
        
        print(">>> SUCESSO: Usuário 'admin' criado com todas as permissões! <<<")
    else:
        print(f">>> AVISO: Usuário '{ADMIN_USERNAME}' já existe no banco de dados. Nenhuma ação foi tomada. <<<")

finally:
    # Sempre fecha a conexão com o banco de dados no final
    db.close()