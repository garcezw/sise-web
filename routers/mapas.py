# Arquivo: routers/mapas.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
import models, schemas
from database import get_db
from crud import crud_mapas
from .usuarios import get_current_active_user
import shutil
from pathlib import Path

router = APIRouter(
    tags=["Mapas"] # Agrupa na documentação da API
)

# Cria o diretório para salvar os mapas, se não existir
MAPS_DIR = Path("static/mapas")
MAPS_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/api/areas/{area_id}/mapa", response_model=schemas.Area)
def upload_mapa_para_area(
    area_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Faz o upload de uma imagem de mapa e a associa a uma área específica.
    """
    # Define o caminho onde o arquivo será salvo
    file_path = MAPS_DIR / f"area_{area_id}_{file.filename}"

    # Salva o arquivo no servidor
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Gera a URL relativa que será salva no banco
    mapa_url_relativa = str(file_path).replace('\\', '/')

    # Atualiza o banco de dados
    db_area = crud_mapas.associar_mapa_a_area(db, area_id=area_id, mapa_url=mapa_url_relativa)

    if db_area is None:
        raise HTTPException(status_code=404, detail="Área não encontrada")

    return db_area