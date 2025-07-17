# Arquivo: routers/mip.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

import models, schemas
from database import get_db
from crud import crud_mip
from .usuarios import get_current_active_user

# =================================================================
# 1. CONFIGURAÇÃO DO ROUTER
# =================================================================
# Usamos um prefixo genérico /api pois as rotas são variadas
router = APIRouter(
    prefix="/api",
    tags=["MIP & Pragas"]
)

# =================================================================
# 2. ENDPOINTS DE MIP E CONTAGEM
# =================================================================

@router.get("/servicos/{servico_id}/mip", response_model=schemas.MIPData)
def api_get_mip_data(
    servico_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    return crud_mip.get_mip_data_for_servico(db, servico_id=servico_id)

@router.post("/servicos/{servico_id}/mip", response_model=schemas.MIPData)
def api_save_mip_data(
    servico_id: int, 
    mip_data: schemas.MIPDataCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    try:
        return crud_mip.save_mip_data_for_servico(db, servico_id=servico_id, mip_data=mip_data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/mip-registros/", response_model=schemas.MIPRegistro)
def api_create_mip_registro(
    registro: schemas.MIPRegistroCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    try:
        return crud_mip.create_mip_registro(db=db, registro=registro)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# =================================================================
# 3. ENDPOINTS DE CONFIGURAÇÕES (PRAGAS)
# =================================================================

@router.get("/pragas/", response_model=List[schemas.Praga])
def api_get_pragas(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    return crud_mip.get_pragas(db=db)

@router.post("/pragas/", response_model=schemas.Praga)
def api_create_praga(
    praga: schemas.PragaCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    if "configuracoes" not in current_user.permissions:
        raise HTTPException(status_code=403, detail="Acesso negado.")
    db_praga = crud_mip.get_praga_by_name(db, nome=praga.nome)
    if db_praga:
        raise HTTPException(status_code=400, detail="Esta praga já está cadastrada.")
    return crud_mip.create_praga(db=db, praga=praga)

@router.delete("/pragas/{praga_id}", status_code=status.HTTP_204_NO_CONTENT)
def api_delete_praga(
    praga_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    if "configuracoes" not in current_user.permissions:
        raise HTTPException(status_code=403, detail="Acesso negado.")
    if not crud_mip.delete_praga(db, praga_id=praga_id):
        raise HTTPException(status_code=404, detail="Praga não encontrada.")
    return {"ok": True}
