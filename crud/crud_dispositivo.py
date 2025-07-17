# Arquivo: crud/crud_dispositivo.py

from sqlalchemy.orm import Session
from typing import Optional, List

import models
import schemas

# ✅ Importamos a função de outro módulo crud para reutilizar o código!
from .crud_area import get_area_by_name

# =================================================================
# Funções CRUD para Dispositivos
# =================================================================

def get_dispositivo(db: Session, dispositivo_id: int):
    """Busca um único dispositivo pelo seu ID."""
    return db.query(models.Dispositivo).filter(models.Dispositivo.id == dispositivo_id).first()

def get_dispositivos(db: Session, area_id: Optional[int] = None, tipo: Optional[str] = None):
    """Busca todos os dispositivos, com filtros opcionais por área e tipo."""
    query = db.query(models.Dispositivo).join(models.Area).order_by(models.Area.nome, models.Dispositivo.numero)
    if area_id:
        query = query.filter(models.Dispositivo.area_id == area_id)
    if tipo:
        query = query.filter(models.Dispositivo.tipo == tipo)
    return query.all()

def create_dispositivo(db: Session, dispositivo: schemas.DispositivoCreate):
    """Cria um novo dispositivo individual."""
    db_dispositivo = models.Dispositivo(**dispositivo.dict())
    db.add(db_dispositivo)
    db.commit()
    db.refresh(db_dispositivo)
    return db_dispositivo

def update_dispositivo(db: Session, dispositivo_id: int, dispositivo_data: schemas.DispositivoCreate):
    """Atualiza os dados de um dispositivo existente."""
    db_dispositivo = get_dispositivo(db, dispositivo_id)
    if not db_dispositivo:
        return None
        
    update_data = dispositivo_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_dispositivo, key, value)
        
    db.commit()
    db.refresh(db_dispositivo)
    return db_dispositivo

def delete_dispositivo(db: Session, dispositivo_id: int):
    """Deleta um dispositivo."""
    db_dispositivo = get_dispositivo(db, dispositivo_id)
    if db_dispositivo:
        db.delete(db_dispositivo)
        db.commit()
        return {"ok": True}
    return None

def create_dispositivos_em_lote(db: Session, lote_info: schemas.DispositivoLoteCreate):
    """Cria múltiplos dispositivos em uma única transação."""
    novos_dispositivos = []
    if lote_info.numero_inicio > lote_info.numero_fim:
        raise ValueError("O número inicial não pode ser maior que o número final.")
        
    # Usando a função importada do crud_area
    area_obj = get_area_by_name(db, nome=lote_info.area)
    if not area_obj:
        raise ValueError(f"Área '{lote_info.area}' não foi encontrada. Cadastre a área primeiro.")
        
    for i in range(lote_info.numero_inicio, lote_info.numero_fim + 1):
        existe = db.query(models.Dispositivo).filter(
            models.Dispositivo.area_id == area_obj.id,
            models.Dispositivo.numero == str(i),
            models.Dispositivo.tipo == lote_info.tipo
        ).first()
        
        if not existe:
            descricao = lote_info.descricao_base or f"{lote_info.tipo} na área {lote_info.area}"
            db_dispositivo = models.Dispositivo(
                numero=str(i),
                tipo=lote_info.tipo,
                area_id=area_obj.id,
                descricao=descricao,
                status=lote_info.status
            )
            db.add(db_dispositivo)
            novos_dispositivos.append(db_dispositivo)
            
    if not novos_dispositivos:
        raise ValueError("Nenhum dispositivo novo para criar (talvez todos já existam para esta área).")
        
    db.commit()
    for disp in novos_dispositivos:
        db.refresh(disp)
        
    return novos_dispositivos

def atualizar_status_dispositivos(db: Session, servico_id: int, status_updates: List[schemas.DispositivoStatusUpdate]):
    """Cria registros históricos de status de dispositivos para um serviço."""
    db.query(models.ServicoDispositivoStatus).filter(models.ServicoDispositivoStatus.servico_id == servico_id).delete()

    lista_retorno = []
    for update in status_updates:
        db_status = models.ServicoDispositivoStatus(
            servico_id=servico_id,
            dispositivo_id=update.dispositivo_id,
            status_registrado=update.status
        )
        db.add(db_status)
        lista_retorno.append(db_status)
    
    db.commit()
    return lista_retorno