# Arquivo: routers/usuarios.py

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List
from datetime import timedelta

# Importando os módulos necessários
import models, schemas, security
from database import get_db # Assumindo que get_db está em database.py
from crud import crud_usuario

# =================================================================
# 1. CONFIGURAÇÃO DO ROUTER
# =================================================================
# Criamos um "mini-app" com APIRouter.
# Todas as rotas aqui terão o prefixo /api e a tag Usuários.
router = APIRouter(
    prefix="/api",
    tags=["Usuários & Autenticação"]
)

# =================================================================
# 2. DEPENDÊNCIAS DE AUTENTICAÇÃO
# =================================================================
# Movendo as dependências que são específicas deste router para cá
oauth2_scheme = security.OAuth2PasswordBearer(tokenUrl="/api/token")

def get_current_active_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não foi possível validar as credenciais",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = security.jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except Exception:
        raise credentials_exception
        
    user = crud_usuario.get_user_by_username(db, username=username)
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Usuário inativo")
    return user

# =================================================================
# 3. ENDPOINTS
# =================================================================

@router.post("/token", response_model=schemas.Token)
def login_for_access_token(db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()):
    # A linha abaixo estava chamando 'security.authenticate_user'
    #  CORREÇÃO: Chamar a função a partir do seu novo local em 'crud_usuario'
    user = crud_usuario.authenticate_user(db, username=form_data.username, password=form_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nome de usuário ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(data={"sub": user.username}, expires_delta=access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/users/me", response_model=schemas.User)
def read_users_me(current_user: models.User = Depends(get_current_active_user)):
    return current_user

@router.get("/users/", response_model=List[schemas.User])
def read_users(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    if "seguranca" not in current_user.permissions:
        raise HTTPException(status_code=403, detail="Acesso negado")
    return crud_usuario.get_users(db=db)

@router.put("/users/{user_id}/permissions", response_model=schemas.User)
def update_permissions(user_id: int, new_permissions: schemas.UserUpdatePermissions, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    if "seguranca" not in current_user.permissions:
        raise HTTPException(status_code=403, detail="Acesso negado")
    updated_user = crud_usuario.update_user_permissions(db, user_id=user_id, permissions=new_permissions.permissions)
    if not updated_user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return updated_user

@router.post("/users/", response_model=schemas.User)
def api_create_user(user: schemas.UserCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    if "seguranca" not in current_user.permissions:
        raise HTTPException(status_code=403, detail="Acesso negado")
    db_user = crud_usuario.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Nome de usuário já registrado")
    return crud_usuario.create_user(db=db, user=user)

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def api_delete_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    if "seguranca" not in current_user.permissions:
        raise HTTPException(status_code=403, detail="Acesso negado")
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Não é possível apagar o próprio usuário.")
    if not crud_usuario.delete_user(db, user_id=user_id):
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return {"ok": True}