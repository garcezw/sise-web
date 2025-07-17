# Arquivo: routers/produtos.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

import models, schemas
from database import get_db
from crud import crud_produto
from .usuarios import get_current_active_user

# =================================================================
# 1. CONFIGURAÇÃO DO ROUTER
# =================================================================
router = APIRouter(
    prefix="/api/produtos",
    tags=["Produtos"]
)

# =================================================================
# 2. ENDPOINTS DE PRODUTOS
# =================================================================

@router.post("/", response_model=schemas.Produto)
def criar_produto(
    produto: schemas.ProdutoCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    return crud_produto.create_produto(db=db, produto=produto)

@router.get("/", response_model=List[schemas.Produto])
def listar_produtos(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    return crud_produto.get_produtos(db=db)

@router.get("/{produto_id}", response_model=schemas.Produto)
def api_get_produto(
    produto_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    db_produto = crud_produto.get_produto(db, produto_id=produto_id)
    if db_produto is None:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return db_produto