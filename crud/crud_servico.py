# Arquivo: crud/crud_servico.py

from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from datetime import date
from sqlalchemy import extract
import models
import schemas

# ✅ Reutilizando a lógica de produto que já separamos!
from .crud_produto import get_produto

# =================================================================
# Funções CRUD para Serviços
# =================================================================

def _ajustar_estoque_para_servico(db: Session, produtos_associados: list, operacao: str):
    """Função auxiliar interna para adicionar ou subtrair do estoque."""
    for prod_assoc in produtos_associados:
        # Usando a função importada para mais organização
        produto_db = get_produto(db, prod_assoc.produto_id)
        if not produto_db:
            raise ValueError(f"Produto ID {prod_assoc.produto_id} não encontrado no estoque.")
            
        if operacao == 'subtrair':
            if produto_db.estoque_atual < prod_assoc.quantidade_usada:
                raise ValueError(f"Estoque insuficiente para '{produto_db.nome}'.")
            produto_db.estoque_atual -= prod_assoc.quantidade_usada
        elif operacao == 'adicionar':
            produto_db.estoque_atual += prod_assoc.quantidade_usada
            
        db.add(produto_db)

def get_servicos(db: Session, area_id: Optional[int] = None, data: Optional[date] = None):
    """Busca serviços com filtros opcionais, carregando dados relacionados."""
    query = db.query(models.Servico).options(
        joinedload(models.Servico.area),
        joinedload(models.Servico.produtos_associados).joinedload(models.ServicoProdutoAssociado.produto)
    )
    if area_id:
        query = query.filter(models.Servico.area_id == area_id)
    if data:
        query = query.filter(models.Servico.data == data)
    return query.order_by(models.Servico.data.desc()).all()

def get_service(db: Session, service_id: int):
    """Busca um único serviço pelo seu ID, carregando os dados relacionados."""
    return db.query(models.Servico).options(
        joinedload(models.Servico.area),
        joinedload(models.Servico.produtos_associados).joinedload(models.ServicoProdutoAssociado.produto)
    ).filter(models.Servico.id == service_id).first()

def get_servico_completo(db: Session, servico_id: int):
    """
    Busca um serviço e todos os seus dados relacionados para um relatório completo.
    """
    servico = db.query(models.Servico).options(
        # Carrega os dados da área relacionada
        joinedload(models.Servico.area),
        # Carrega os produtos e os detalhes de cada produto
        joinedload(models.Servico.produtos_associados).joinedload(models.ServicoProdutoAssociado.produto),
        # Carrega as contagens de pragas feitas neste serviço
        joinedload(models.Servico.contagens_praga),
        # Carrega os dispositivos que foram verificados neste serviço
        joinedload(models.Servico.dispositivos_verificados).joinedload(models.ServicoDispositivoStatus.dispositivo)
    ).filter(models.Servico.id == servico_id).first()

    return servico

def create_servico(db: Session, servico: schemas.ServicoCreate):
    """Cria um novo serviço e ajusta o estoque dos produtos utilizados."""
    _ajustar_estoque_para_servico(db, servico.produtos_associados, 'subtrair')
    
    produtos_para_salvar = servico.produtos_associados
    servico_data = servico.dict(exclude={'produtos_associados'})
    db_servico = models.Servico(**servico_data)
    
    for prod_assoc in produtos_para_salvar:
        assoc = models.ServicoProdutoAssociado(
            produto_id=prod_assoc.produto_id, 
            quantidade_usada=prod_assoc.quantidade_usada
        )
        db_servico.produtos_associados.append(assoc)
        
    db.add(db_servico)
    db.commit()
    db.refresh(db_servico)
    return db_servico

def update_servico(db: Session, servico_id: int, servico_update: schemas.ServicoCreate):
    """Atualiza um serviço, devolvendo e retirando produtos do estoque corretamente."""
    db_servico = get_service(db, servico_id)
    if not db_servico:
        return None
        
    # Devolve o estoque dos produtos antigos
    produtos_antigos = [
        schemas.ProdutoParaServicoBase(produto_id=p.produto_id, quantidade_usada=p.quantidade_usada) 
        for p in db_servico.produtos_associados
    ]
    _ajustar_estoque_para_servico(db, produtos_antigos, 'adicionar')
    
    # Subtrai o estoque dos novos produtos
    _ajustar_estoque_para_servico(db, servico_update.produtos_associados, 'subtrair')
    
    # Atualiza os dados do serviço
    update_data = servico_update.dict(exclude={'produtos_associados'})
    for key, value in update_data.items():
        setattr(db_servico, key, value)
        
    # Atualiza a lista de produtos associados
    db_servico.produtos_associados.clear()
    for prod_assoc in servico_update.produtos_associados:
        assoc = models.ServicoProdutoAssociado(
            produto_id=prod_assoc.produto_id, 
            quantidade_usada=prod_assoc.quantidade_usada
        )
        db_servico.produtos_associados.append(assoc)
        
    db.commit()
    db.refresh(db_servico)
    return db_servico

def delete_servico(db: Session, servico_id: int):
    """Deleta um serviço e devolve os produtos utilizados ao estoque."""
    db_servico = get_service(db, servico_id)
    if not db_servico:
        raise ValueError("Serviço não encontrado")
        
    produtos_para_devolver = [
        schemas.ProdutoParaServicoBase(produto_id=p.produto_id, quantidade_usada=p.quantidade_usada) 
        for p in db_servico.produtos_associados
    ]
    _ajustar_estoque_para_servico(db, produtos_para_devolver, 'adicionar')
    
    db.delete(db_servico)
    db.commit()
    return {"ok": True}

def concluir_servico(db: Session, servico_id: int):
    """Marca um serviço como 'Concluído'."""
    db_servico = get_service(db, servico_id)
    if not db_servico:
        raise ValueError(f"Serviço com ID {servico_id} não encontrado.")
    if db_servico.status == "Concluído":
        return db_servico
        
    db_servico.status = "Concluído"
    db.add(db_servico)
    db.commit()
    db.refresh(db_servico)
    return db_servico

def get_servicos_por_periodo(db: Session, data_inicio: date, data_fim: date):
    """Busca todos os serviços dentro de um intervalo de datas."""
    return db.query(models.Servico).filter(
        models.Servico.data >= data_inicio,
        models.Servico.data <= data_fim
    ).order_by(models.Servico.data).all()

def get_servicos_para_agenda(db: Session, year: int, month: int):
    """Busca todos os serviços de um determinado ano e mês para a agenda."""
    return db.query(models.Servico).filter(
        extract('year', models.Servico.data) == year,
        extract('month', models.Servico.data) == month
    ).all()