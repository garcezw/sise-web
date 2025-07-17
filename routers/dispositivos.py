# Arquivo: routers/dispositivos.py (Versão Corrigida)

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

import models, schemas
from database import get_db
from crud import crud_dispositivo
from .usuarios import get_current_active_user

router = APIRouter(
    prefix="/api/dispositivos",
    tags=["Dispositivos"]
)

@router.get("/", response_model=List[schemas.Dispositivo])
def api_get_dispositivos(
    area_id: Optional[int] = None, 
    tipo: Optional[str] = None, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    return crud_dispositivo.get_dispositivos(db=db, area_id=area_id, tipo=tipo)

# ✅ NOVO ENDPOINT ADICIONADO
@router.post("/", response_model=schemas.Dispositivo, status_code=status.HTTP_201_CREATED)
def api_create_dispositivo(
    dispositivo: schemas.DispositivoCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    """Cria um novo dispositivo individualmente."""
    return crud_dispositivo.create_dispositivo(db=db, dispositivo=dispositivo)

@router.post("/lote", response_model=List[schemas.Dispositivo])
def api_create_dispositivos_em_lote(
    lote_info: schemas.DispositivoLoteCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    try:
        return crud_dispositivo.create_dispositivos_em_lote(db=db, lote_info=lote_info)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
@router.get("/{dispositivo_id}", response_model=schemas.Dispositivo)
def api_get_dispositivo(
    dispositivo_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    db_dispositivo = crud_dispositivo.get_dispositivo(db, dispositivo_id=dispositivo_id)
    if db_dispositivo is None:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")
    return db_dispositivo
    
@router.put("/{dispositivo_id}", response_model=schemas.Dispositivo)
def api_update_dispositivo(
    dispositivo_id: int, 
    dispositivo: schemas.DispositivoCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    db_dispositivo = crud_dispositivo.update_dispositivo(db, dispositivo_id=dispositivo_id, dispositivo_data=dispositivo)
    if db_dispositivo is None:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")
    return db_dispositivo

@router.delete("/{dispositivo_id}", status_code=status.HTTP_204_NO_CONTENT)
def api_delete_dispositivo(
    dispositivo_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    if not crud_dispositivo.delete_dispositivo(db, dispositivo_id=dispositivo_id):
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")
    return {"ok": True}