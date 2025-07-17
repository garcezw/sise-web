# Arquivo: crud/crud_usuario.py

from sqlalchemy.orm import Session
from typing import Optional

import models
import schemas
import security

# =================================================================
# Funções de Autenticação (que tocam o banco de dados)
# =================================================================

def authenticate_user(db: Session, username: str, password: str) -> Optional[models.User]:
    """
    Busca um usuário no banco e verifica se a senha fornecida está correta.
    Retorna o objeto do usuário se for bem-sucedido, caso contrário, None.
    """
    user = get_user_by_username(db, username=username)
    if not user:
        return None
    if not security.verify_password(password, user.hashed_password):
        return None
    return user

# =================================================================
# Funções CRUD para Usuários
# =================================================================

def get_user_by_username(db: Session, username: str):
    """Busca um usuário pelo seu nome de usuário."""
    return db.query(models.User).filter(models.User.username == username).first()

def create_user(db: Session, user: schemas.UserCreate, permissions: str = None):
    """
    Cria um novo usuário, agora com a capacidade de definir permissões.
    """
    hashed_password = security.get_password_hash(user.password)

    # Adicionamos o campo 'permissions' ao criar o objeto do modelo
    db_user = models.User(
        username=user.username, 
        hashed_password=hashed_password,
        permissions=permissions 
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_users(db: Session):
    """Retorna uma lista de todos os usuários."""
    return db.query(models.User).all()

def update_user_permissions(db: Session, user_id: int, permissions: str):
    """Atualiza a string de permissões de um usuário."""
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        return None
        
    db_user.permissions = permissions
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def delete_user(db: Session, user_id: int):
    """Deleta um usuário do banco de dados."""
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user:
        db.delete(db_user)
        db.commit()
        return {"ok": True}
    return None