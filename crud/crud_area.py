# Arquivo: crud/crud_area.py

from sqlalchemy.orm import Session
from sqlalchemy import extract, func, case
from datetime import date
from typing import List # ✅ ADICIONE ESTA LINHA
import models
import schemas
from collections import defaultdict # Garanta que esta também esteja aqui


# =================================================================
# Funções CRUD para Áreas
# =================================================================

def get_area(db: Session, area_id: int):
    """Busca uma única área pelo seu ID."""
    return db.query(models.Area).filter(models.Area.id == area_id).first()

def get_area_by_name(db: Session, nome: str):
    """Busca uma única área pelo seu nome."""
    return db.query(models.Area).filter(models.Area.nome == nome).first()

def get_areas(db: Session) -> List[models.Area]:
    """
    Retorna uma lista de todas as áreas, e para cada uma, calcula
    o número de visitas de rotina no mês atual.
    """
    hoje = date.today()

    # Subquery para contar os serviços de rotina para cada área no mês atual
    subquery = db.query(
        models.Servico.area_id,
        func.count(models.Servico.id).label("visitas_no_mes")
    ).filter(
        models.Servico.tipo_atividade == "Visita de Rotina",
        extract('year', models.Servico.data) == hoje.year,
        extract('month', models.Servico.data) == hoje.month
    ).group_by(models.Servico.area_id).subquery()

    # Query principal que busca todas as áreas e junta com a contagem
    resultados = db.query(
        models.Area,
        # Usa a função coalesce para retornar 0 se a contagem for nula
        func.coalesce(subquery.c.visitas_no_mes, 0) 
    ).outerjoin(
        subquery, models.Area.id == subquery.c.area_id
    ).order_by(models.Area.nome).all()

    # Monta o resultado final no formato do nosso novo schema
    areas_com_status = []
    for area, contagem in resultados:
        area.visitas_no_mes = contagem
        areas_com_status.append(area)

    return areas_com_status



def create_area(db: Session, area: schemas.AreaCreate):
    """Cria uma nova área."""
    db_area = models.Area(**area.dict())
    db.add(db_area)
    db.commit()
    db.refresh(db_area)
    return db_area

def update_area(db: Session, area_id: int, area_data: schemas.AreaCreate):
    """Atualiza os dados de uma área existente."""
    db_area = get_area(db, area_id)
    if not db_area:
        return None
        
    update_data = area_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_area, key, value)
        
    db.commit()
    db.refresh(db_area)
    return db_area

def delete_area(db: Session, area_id: int):
    """Deleta uma área, verificando se ela não possui dependências."""
    db_area = get_area(db, area_id)
    if not db_area:
        return None
        
    if db_area.dispositivos or db_area.servicos:
        raise ValueError("Não é possível excluir área com dispositivos ou serviços associados.")
        
    db.delete(db_area)
    db.commit()
    return {"ok": True}