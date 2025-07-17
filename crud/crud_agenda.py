# crud/crud_agenda.py

from sqlalchemy.orm import Session
import models
import schemas
from typing import List, Optional
from sqlalchemy import extract

# =================================================================
# Funções CRUD para Agendamentos
# =================================================================

def create_agendamento(db: Session, agendamento: schemas.AgendamentoCreate) -> models.Agendamento:
    """
    Cria um novo agendamento no banco de dados.
    """
    db_agendamento = models.Agendamento(**agendamento.model_dump())
    db.add(db_agendamento)
    db.commit()
    db.refresh(db_agendamento)
    return db_agendamento

def get_agendamento_by_id(db: Session, agendamento_id: int) -> Optional[models.Agendamento]:
    """
    Busca um agendamento específico pelo seu ID.
    """
    return db.query(models.Agendamento).filter(models.Agendamento.id == agendamento_id).first()

def get_agendamentos(db: Session, year: int, month: int, skip: int = 0, limit: int = 100) -> List[models.Agendamento]:
    """ Busca uma lista de agendamentos, filtrando por ano e mês. """
    query = db.query(models.Agendamento).filter(
        extract('year', models.Agendamento.data_agendamento) == year,
        extract('month', models.Agendamento.data_agendamento) == month
    )
    return query.order_by(models.Agendamento.data_agendamento).offset(skip).limit(limit).all()


def update_agendamento(db: Session, agendamento_id: int, agendamento_update: schemas.AgendamentoUpdate) -> Optional[models.Agendamento]:
    """
    Atualiza um agendamento existente.
    """
    db_agendamento = get_agendamento_by_id(db, agendamento_id)
    if db_agendamento:
        update_data = agendamento_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_agendamento, key, value)
        db.commit()
        db.refresh(db_agendamento)
    return db_agendamento

def delete_agendamento(db: Session, agendamento_id: int) -> Optional[models.Agendamento]:
    """
    Deleta um agendamento do banco de dados.
    """
    db_agendamento = get_agendamento_by_id(db, agendamento_id)
    if db_agendamento:
        db.delete(db_agendamento)
        db.commit()
    return db_agendamento


# =================================================================
# Funções CRUD para Ocorrências
# =================================================================

def create_ocorrencia(db: Session, ocorrencia: schemas.OcorrenciaCreate) -> models.Ocorrencia:
    """
    Cria uma nova ocorrência no banco de dados.
    """
    db_ocorrencia = models.Ocorrencia(**ocorrencia.model_dump())
    db.add(db_ocorrencia)
    db.commit()
    db.refresh(db_ocorrencia)
    return db_ocorrencia

def get_ocorrencia_by_id(db: Session, ocorrencia_id: int) -> Optional[models.Ocorrencia]:
    """
    Busca uma ocorrência específica pelo seu ID.
    """
    return db.query(models.Ocorrencia).filter(models.Ocorrencia.id == ocorrencia_id).first()

def get_ocorrencias(db: Session, year: int, month: int, skip: int = 0, limit: int = 100) -> List[models.Ocorrencia]:
    """ Busca uma lista de ocorrências, filtrando por ano e mês. """
    query = db.query(models.Ocorrencia).filter(
        extract('year', models.Ocorrencia.data_ocorrencia) == year,
        extract('month', models.Ocorrencia.data_ocorrencia) == month
    )
    return query.order_by(models.Ocorrencia.data_ocorrencia).offset(skip).limit(limit).all()

def update_ocorrencia(db: Session, ocorrencia_id: int, ocorrencia_update: schemas.OcorrenciaUpdate) -> Optional[models.Ocorrencia]:
    """
    Atualiza uma ocorrência existente.
    """
    db_ocorrencia = get_ocorrencia_by_id(db, ocorrencia_id)
    if db_ocorrencia:
        update_data = ocorrencia_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_ocorrencia, key, value)
        db.commit()
        db.refresh(db_ocorrencia)
    return db_ocorrencia

def delete_ocorrencia(db: Session, ocorrencia_id: int) -> Optional[models.Ocorrencia]:
    """
    Deleta uma ocorrência do banco de dados.
    """
    db_ocorrencia = get_ocorrencia_by_id(db, ocorrencia_id)
    if db_ocorrencia:
        db.delete(db_ocorrencia)
        db.commit()
    return db_ocorrencia