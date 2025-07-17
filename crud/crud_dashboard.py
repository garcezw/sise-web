# Em crud/crud_dashboard.py
from sqlalchemy.orm import Session
from sqlalchemy import extract, func, case
from datetime import date
import models
from collections import defaultdict

def get_dashboard_summary(db: Session):
    hoje = date.today()

    # Dados de Serviços e Produtos (Lógica existente)
    servicos_no_mes = db.query(func.count(models.Servico.id)).filter(extract('year', models.Servico.data) == hoje.year, extract('month', models.Servico.data) == hoje.month).scalar() or 0
    produtos_usados_query = db.query(models.Produto.nome, func.sum(models.ServicoProdutoAssociado.quantidade_usada).label('total_usado'), models.Produto.unidade_uso).join(models.ServicoProdutoAssociado).join(models.Servico).filter(extract('year', models.Servico.data) == hoje.year, extract('month', models.Servico.data) == hoje.month).group_by(models.Produto.id).order_by(func.sum(models.ServicoProdutoAssociado.quantidade_usada).desc()).limit(5).all()
    produtos_usados_no_mes = [{"nome": n, "total_usado": t, "unidade_uso": u} for n, t, u in produtos_usados_query]

    # ✅ LÓGICA DE DISPOSITIVOS ADICIONADA DE VOLTA
    contagem_dispositivos = db.query(
        models.Dispositivo.tipo,
        models.Dispositivo.status,
        func.count(models.Dispositivo.id).label('contagem')
    ).group_by(models.Dispositivo.tipo, models.Dispositivo.status).all()
    dispositivos_summary = defaultdict(lambda: defaultdict(int))
    for tipo, status, contagem in contagem_dispositivos:
        dispositivos_summary[tipo][status] = contagem

    # RETORNO COMPLETO
    return {
        "servicos_no_mes": servicos_no_mes,
        "produtos_usados_no_mes": produtos_usados_no_mes,
        "dispositivos_summary": dispositivos_summary
    }