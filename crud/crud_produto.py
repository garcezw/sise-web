# Arquivo: crud/crud_produto.py

from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import datetime

# Importamos os modelos e schemas do diretório pai (../)
# A forma de importar pode variar um pouco dependendo da sua estrutura
# mas para FastAPI/Uvicorn, isso geralmente funciona:
import models
import schemas

# =================================================================
# Funções CRUD para Produtos
# =================================================================

def get_produto(db: Session, produto_id: int):
    """Busca um único produto pelo seu ID."""
    return db.query(models.Produto).filter(models.Produto.id == produto_id).first()

def get_produtos(db: Session):
    """Retorna uma lista de todos os produtos, ordenados por nome."""
    return db.query(models.Produto).order_by(models.Produto.nome).all()

def create_produto(db: Session, produto: schemas.ProdutoCreate):
    """Cria um novo produto no banco de dados."""
    db_produto = models.Produto(**produto.dict())
    db.add(db_produto)
    db.commit()
    db.refresh(db_produto)
    return db_produto

def update_produto(db: Session, produto_id: int, produto_data: schemas.ProdutoUpdate):
    """Atualiza os dados de um produto existente."""
    db_produto = get_produto(db, produto_id)
    if not db_produto:
        return None
    
    update_data = produto_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_produto, key, value)
        
    db.add(db_produto)
    db.commit()
    db.refresh(db_produto)
    return db_produto

def delete_produto(db: Session, produto_id: int):
    """Deleta um produto, verificando se não está em uso em um serviço."""
    servico_usando = db.query(models.ServicoProdutoAssociado).filter(models.ServicoProdutoAssociado.produto_id == produto_id).first()
    if servico_usando:
        raise ValueError(f"Produto ID {produto_id} não pode ser excluído pois está associado ao serviço ID: {servico_usando.servico_id}.")
    
    db_produto = get_produto(db, produto_id)
    if not db_produto:
        raise Exception("Produto não encontrado")
        
    db.delete(db_produto)
    db.commit()
    return {"ok": True}

def add_estoque(db: Session, produto_id: int, quantidade: float):
    """Adiciona uma quantidade ao estoque de um produto."""
    db_produto = get_produto(db, produto_id)
    if not db_produto:
        return None
        
    db_produto.estoque_atual += quantidade
    db.add(db_produto)
    db.commit()
    db.refresh(db_produto)
    return db_produto

def get_produtos_usados_detalhado_mes_atual(db: Session):
    """
    Retorna uma lista de produtos usados no mês atual,
    com o total de uso para cada um.
    """
    agora = datetime.now()
    query = (
        db.query(
            models.Produto.nome,
            func.sum(models.ServicoProdutoAssociado.quantidade_usada).label("total_usado"),
            models.Produto.unidade_uso,
        )
        .join(models.ServicoProdutoAssociado, models.Produto.id == models.ServicoProdutoAssociado.produto_id)
        .join(models.Servico, models.ServicoProdutoAssociado.servico_id == models.Servico.id)
        .filter(extract('year', models.Servico.data) == agora.year)
        .filter(extract('month', models.Servico.data) == agora.month)
        .group_by(models.Produto.nome, models.Produto.unidade_uso)
        .order_by(models.Produto.nome)
    )
    return query.all()
