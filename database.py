# Arquivo: database.py (Preparado para Cloud Run e desenvolvimento local)

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from google.cloud.sql.connector import Connector, IPTypes

# --- Lógica para Conexão ---

# Pega as variáveis de ambiente para a conexão com o Cloud SQL.
# Nós vamos configurar essas variáveis no serviço do Cloud Run mais tarde.
DB_USER = os.environ.get("DB_USER")          # ex: "postgres"
DB_PASS = os.environ.get("DB_PASS")          # ex: "your-password"
DB_NAME = os.environ.get("DB_NAME")          # ex: "sise_db"
INSTANCE_CONNECTION_NAME = os.environ.get("INSTANCE_CONNECTION_NAME") # ex: "project:region:instance-name"

# Verifica se estamos em um ambiente Cloud Run (se as variáveis existem)
if INSTANCE_CONNECTION_NAME:
    print("--- DETECTADO AMBIENTE CLOUD RUN. CONECTANDO AO CLOUD SQL... ---")
    
    # Inicializa o conector
    connector = Connector()

    # Função para criar a conexão com o banco de dados
    def getconn():
        conn = connector.connect(
            INSTANCE_CONNECTION_NAME,
            "pg8000",
            user=DB_USER,
            password=DB_PASS,
            db=DB_NAME,
            ip_type=IPTypes.PUBLIC  # ou IPTypes.PRIVATE se estiver usando rede VPC
        )
        return conn

    # Cria o "engine" do SQLAlchemy usando a função do conector
    engine = create_engine(
        "postgresql+pg8000://",
        creator=getconn,
    )

else:
    # --- Fallback para SQLite para desenvolvimento local ---
    print("--- AMBIENTE LOCAL DETECTADO. USANDO SQLITE... ---")
    from pathlib import Path
    BASE_DIR = Path(__file__).resolve().parent
    DB_PATH = BASE_DIR / "sise.db"
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"
    
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )

# --- O resto do código continua o mesmo ---
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()