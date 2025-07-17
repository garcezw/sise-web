# Arquivo: crud/crud_mapas.py
from sqlalchemy.orm import Session
import models

def associar_mapa_a_area(db: Session, area_id: int, mapa_url: str):
    """
    Atualiza uma área no banco de dados para associar um novo caminho de imagem de mapa.
    """
    db_area = db.query(models.Area).filter(models.Area.id == area_id).first()
    if not db_area:
        return None # Retorna None se a área não for encontrada

    db_area.mapa_url = mapa_url
    db.commit()
    db.refresh(db_area)
    return db_area