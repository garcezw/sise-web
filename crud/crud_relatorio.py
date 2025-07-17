# Arquivo: crud/crud_relatorio.py

from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import datetime, date

import models

# =================================================================
# Funções para o Dashboard
# =================================================================

def count_servicos_mes_atual(db: Session):
    """Conta quantos serviços foram realizados no mês e ano correntes."""
    hoje = datetime.utcnow()
    return db.query(models.Servico).filter(
        extract('year', models.Servico.data) == hoje.year,
        extract('month', models.Servico.data) == hoje.month
    ).count()

def sum_produtos_usados_mes_atual(db: Session):
    """Soma a quantidade de produtos usados em serviços do mês e ano correntes."""
    hoje = datetime.utcnow()
    total = db.query(func.sum(models.ServicoProdutoAssociado.quantidade_usada))\
        .join(models.Servico)\
        .filter(
            extract('year', models.Servico.data) == hoje.year,
            extract('month', models.Servico.data) == hoje.month
        ).scalar()
    return total or 0.0

def count_dispositivos_por_tipo_e_status(db: Session):
    """Conta dispositivos agrupando por tipo e status."""
    resultado = db.query(
        models.Dispositivo.tipo,
        models.Dispositivo.status,
        func.count(models.Dispositivo.id)
    ).group_by(models.Dispositivo.tipo, models.Dispositivo.status).all()
    
    dados_formatados = {}
    for tipo, status, contagem in resultado:
        if tipo not in dados_formatados:
            dados_formatados[tipo] = {}
        dados_formatados[tipo][status] = contagem
    return dados_formatados

# =================================================================
# Funções para Relatórios
# =================================================================

def get_relatorio_contagem_pragas(db: Session, data_inicio: date, data_fim: date):
    """Busca e totaliza a contagem de pragas por tipo dentro de um período."""
    resultado = db.query(
        models.ContagemPraga.praga_nome,
        func.sum(models.ContagemPraga.quantidade).label("total_contado")
    ).join(models.Servico, models.ContagemPraga.servico_id == models.Servico.id)\
     .filter(models.Servico.data >= data_inicio)\
     .filter(models.Servico.data <= data_fim)\
     .group_by(models.ContagemPraga.praga_nome)\
     .order_by(func.sum(models.ContagemPraga.quantidade).desc())\
     .all()
    
    return resultado

def get_relatorio_compilado_area(db: Session, area_id: int, data_inicio: date, data_fim: date):
    """Busca todas as informações compiladas de uma área em um período."""
    servicos_no_periodo = db.query(models.Servico).filter(
        models.Servico.area_id == area_id,
        models.Servico.data >= data_inicio,
        models.Servico.data <= data_fim
    ).all()

    if not servicos_no_periodo:
        return None

    servico_ids = [s.id for s in servicos_no_periodo]

    produtos = db.query(
        models.Produto.nome,
        models.Produto.unidade_uso,
        func.sum(models.ServicoProdutoAssociado.quantidade_usada).label("total_usado")
    ).join(models.ServicoProdutoAssociado, models.Produto.id == models.ServicoProdutoAssociado.produto_id)\
     .filter(models.ServicoProdutoAssociado.servico_id.in_(servico_ids))\
     .group_by(models.Produto.nome, models.Produto.unidade_uso).all()

    contagens = db.query(models.ContagemPraga).filter(models.ContagemPraga.servico_id.in_(servico_ids)).all()

    ocorrencias = db.query(models.MIPRegistro).filter(models.MIPRegistro.servico_id.in_(servico_ids)).all()

    status_dispositivos = db.query(
        models.Dispositivo.numero,
        models.Dispositivo.tipo,
        models.ServicoDispositivoStatus.status_registrado
    ).join(models.Dispositivo, models.ServicoDispositivoStatus.dispositivo_id == models.Dispositivo.id)\
     .filter(models.ServicoDispositivoStatus.servico_id.in_(servico_ids)).all()

    observacoes = [{"servico_id": s.id, "observacoes": s.observacoes} for s in servicos_no_periodo if s.observacoes]

    return {
        "produtos_utilizados": produtos,
        "contagens_pragas": contagens,
        "ocorrencias_mip": ocorrencias,
        "dispositivos_status": status_dispositivos,
        "observacoes_gerais": observacoes
    }