# Arquivo: routers/servicos.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

import models, schemas
from database import get_db
from crud import crud_servico, crud_dispositivo
from .usuarios import get_current_active_user

# =================================================================
# 1. CONFIGURAÇÃO DO ROUTER
# =================================================================
router = APIRouter(
    prefix="/api/servicos",
    tags=["Serviços"]
)

# =================================================================
# 2. ENDPOINTS DE SERVIÇOS
# =================================================================

@router.get("/", response_model=List[schemas.Servico])
def api_listar_servicos(
    area_id: Optional[int] = None, 
    data: Optional[date] = None, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    return crud_servico.get_servicos(db=db, area_id=area_id, data=data)

@router.post("/", response_model=schemas.Servico)
def api_criar_servico(
    servico: schemas.ServicoCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    try:
        return crud_servico.create_servico(db=db, servico=servico)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{service_id}", response_model=schemas.Servico)
def read_service(
    service_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    db_service = crud_servico.get_service(db, service_id=service_id)
    if db_service is None:
        raise HTTPException(status_code=404, detail="Serviço não encontrado")
    return db_service

@router.get("/{servico_id}/relatorio-completo", response_model=schemas.ServicoCompleto)
def api_get_relatorio_completo(
    servico_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    """ Retorna todos os dados de um serviço para a geração de um relatório detalhado. """
    servico_completo = crud_servico.get_servico_completo(db, servico_id=servico_id)
    if servico_completo is None:
        raise HTTPException(status_code=404, detail="Serviço não encontrado")
    return servico_completo

@router.put("/{servico_id}", response_model=schemas.Servico)
def api_update_servico(
    servico_id: int, 
    servico_update: schemas.ServicoCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    try:
        updated_servico = crud_servico.update_servico(db, servico_id=servico_id, servico_update=servico_update)
        if updated_servico is None:
            raise HTTPException(status_code=404, detail="Serviço não encontrado")
        return updated_servico
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
@router.delete("/{servico_id}", status_code=status.HTTP_204_NO_CONTENT)
def api_delete_servico(
    servico_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    try:
        crud_servico.delete_servico(db, servico_id=servico_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}

@router.post("/{servico_id}/concluir", response_model=schemas.Servico)
def endpoint_marcar_servico_concluido(
    servico_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    try:
        servico_concluido = crud_servico.concluir_servico(db=db, servico_id=servico_id)
        return servico_concluido
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.put("/{servico_id}/dispositivos-status")
def api_atualizar_status_dispositivos(
    servico_id: int,
    status_updates: List[schemas.DispositivoStatusUpdate],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    # Note que esta rota estava na seção de Dispositivos no seu main_api.py original,
    # mas ela faz mais sentido aqui, pois está relacionada a um serviço.
    return crud_dispositivo.atualizar_status_dispositivos(db, servico_id=servico_id, status_updates=status_updates)