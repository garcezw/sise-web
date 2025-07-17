# Arquivo: routers/areas.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

import models, schemas
from database import get_db
from crud import crud_area

# ✅ Importando a dependência de autenticação do nosso outro router
from .usuarios import get_current_active_user

# =================================================================
# 1. CONFIGURAÇÃO DO ROUTER
# =================================================================
# Note o prefixo: todas as rotas aqui começarão com /api/areas
router = APIRouter(
    prefix="/api/areas",
    tags=["Áreas"]
)

# =================================================================
# 2. ENDPOINTS DE ÁREAS
# =================================================================

@router.get("/", response_model=List[schemas.AreaComStatus])
def api_get_areas(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return crud_area.get_areas(db=db)


@router.post("/", response_model=schemas.Area, status_code=status.HTTP_201_CREATED)
def api_create_area(area: schemas.AreaCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    if crud_area.get_area_by_name(db, nome=area.nome):
        raise HTTPException(status_code=400, detail="Uma área com este nome já existe.")
    return crud_area.create_area(db=db, area=area)

@router.put("/{area_id}", response_model=schemas.Area)
def api_update_area(area_id: int, area: schemas.AreaCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    db_area = crud_area.update_area(db, area_id=area_id, area_data=area)
    if db_area is None:
        raise HTTPException(status_code=404, detail="Área não encontrada")
    return db_area

@router.delete("/{area_id}", status_code=status.HTTP_204_NO_CONTENT)
def api_delete_area(area_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    try:
        resultado = crud_area.delete_area(db, area_id=area_id)
        if not resultado:
             raise HTTPException(status_code=404, detail="Área não encontrada")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    return {"ok": True}



