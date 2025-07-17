# Arquivo: database.py (versão final com caminho absoluto)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from pathlib import Path # Importa a biblioteca para manipulação de caminhos

# --- Lógica do Caminho Absoluto ---
# Pega o diretório onde este arquivo (database.py) está
BASE_DIR = Path(__file__).resolve().parent

# Cria o caminho completo e absoluto para o arquivo do banco de dados
# Ex: E:\sise_web\sise.db
DB_PATH = BASE_DIR / "sise.db"

# Define a URL do banco de dados usando o caminho absoluto
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

print(f"--- CONECTANDO AO BANCO DE DADOS EM: {SQLALCHEMY_DATABASE_URL} ---")

# --- O resto do código continua o mesmo ---
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()