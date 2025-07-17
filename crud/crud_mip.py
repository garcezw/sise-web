# Arquivo: crud/crud_mip.py

from sqlalchemy.orm import Session
from typing import List

import models
import schemas

# =================================================================
# Funções CRUD para Pragas
# =================================================================

def get_praga_by_name(db: Session, nome: str):
    """Busca uma praga pelo nome."""
    return db.query(models.Praga).filter(models.Praga.nome == nome).first()

def get_pragas(db: Session):
    """Retorna uma lista de todas as pragas, ordenadas por nome."""
    return db.query(models.Praga).order_by(models.Praga.nome).all()

def create_praga(db: Session, praga: schemas.PragaCreate):
    """Cria um novo tipo de praga."""
    db_praga = models.Praga(nome=praga.nome)
    db.add(db_praga)
    db.commit()
    db.refresh(db_praga)
    return db_praga

def delete_praga(db: Session, praga_id: int):
    """Deleta um tipo de praga."""
    db_praga = db.query(models.Praga).filter(models.Praga.id == praga_id).first()
    if db_praga:
        db.delete(db_praga)
        db.commit()
        return {"ok": True}
    return None

# =================================================================
# Funções CRUD para MIP e Contagem
# =================================================================

def get_mip_data_for_servico(db: Session, servico_id: int):
    """Busca todos os registros MIP e de Contagem para um serviço específico."""
    ocorrencias = db.query(models.MIPRegistro).filter(models.MIPRegistro.servico_id == servico_id).all()
    contagens = db.query(models.ContagemPraga).filter(models.ContagemPraga.servico_id == servico_id).all()
    return {"ocorrencias": ocorrencias, "contagens": contagens}

def save_mip_data_for_servico(db: Session, servico_id: int, mip_data: schemas.MIPDataCreate):
    """ Salva (sobrescrevendo) os dados de MIP e Contagem para um serviço. """
    db_servico = db.query(models.Servico).filter(models.Servico.id == servico_id).first()
    if not db_servico:
        raise ValueError(f"Serviço com ID {servico_id} não encontrado.")
        
    # Apaga dados antigos para este serviço
    db.query(models.MIPRegistro).filter(models.MIPRegistro.servico_id == servico_id).delete()
    db.query(models.ContagemPraga).filter(models.ContagemPraga.servico_id == servico_id).delete()
    
    # Adiciona novos dados de ocorrências
    novas_ocorrencias = []
    for praga_nome in mip_data.ocorrencias:
        db_ocorrencia = models.MIPRegistro(praga_observada=praga_nome, servico_id=servico_id)
        db.add(db_ocorrencia)
        novas_ocorrencias.append(db_ocorrencia)

    # Adiciona novos dados de contagens
    novas_contagens = []
    for contagem in mip_data.contagens:
        db_contagem = models.ContagemPraga(**contagem.dict(), servico_id=servico_id)
        db.add(db_contagem)
        novas_contagens.append(db_contagem)

    db.commit()
    
    # O refresh é necessário para carregar IDs e outros dados gerados pelo banco
    for ocorrencia in novas_ocorrencias:
        db.refresh(ocorrencia)
    for contagem in novas_contagens:
        db.refresh(contagem)
        
    return {"ocorrencias": novas_ocorrencias, "contagens": novas_contagens}

def create_mip_registro(db: Session, registro: schemas.MIPRegistroCreate) -> models.MIPRegistro:
    """Cria um único registro de MIP (observação)."""
    db_servico = db.query(models.Servico).filter(models.Servico.id == registro.servico_id).first()
    if not db_servico:
        raise ValueError("Serviço com o ID fornecido não foi encontrado.")
    
    db_registro = models.MIPRegistro(
        servico_id=registro.servico_id,
        data_observacao=registro.data_observacao,
        pragas_observadas=registro.pragas_observadas,
        observacao_texto=f"Praga(s) observada(s): {registro.pragas_observadas}"
    )
    db.add(db_registro)
    db.commit()
    db.refresh(db_registro)
    return db_registro
