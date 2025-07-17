# Arquivo: routers/relatorios.py (versão final corrigida)

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date

import models, schemas
from database import get_db
from crud import crud_produto, crud_servico, crud_relatorio, crud_area
from .usuarios import get_current_active_user

# =================================================================
# ✅ LINHA FALTANTE ADICIONADA AQUI
# =================================================================
router = APIRouter(
    prefix="/api",
    tags=["Relatórios & Dashboard"]
)

# =================================================================
# ENDPOINTS DE RELATÓRIOS
# =================================================================

@router.get("/relatorios/produtos", response_model=List[schemas.Produto])
def api_get_relatorio_produtos(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    return crud_produto.get_produtos(db=db)

@router.get("/relatorios/servicos", response_model=List[schemas.Servico])
def api_get_relatorio_servicos(
    data_inicio: date,
    data_fim: date,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    return crud_servico.get_servicos_por_periodo(db=db, data_inicio=data_inicio, data_fim=data_fim)

@router.get("/relatorios/area-compilado", response_model=schemas.RelatorioAreaCompilado)
def api_get_relatorio_area_compilado(
    area_id: int,
    data_inicio: date,
    data_fim: date,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    area = crud_area.get_area(db, area_id=area_id)
    if not area:
        raise HTTPException(status_code=404, detail="Área não encontrada.")

    dados_compilados = crud_relatorio.get_relatorio_compilado_area(db, area_id, data_inicio, data_fim)
    if not dados_compilados:
        raise HTTPException(status_code=404, detail="Nenhum serviço encontrado para esta área no período selecionado.")

    # Converte os dados dos produtos para o formato Pydantic
    produtos_formatados = [
        schemas.ProdutoUsadoSummary(
            nome=p.nome,
            unidade_uso=p.unidade_uso,
            total_usado=p.total_usado
        ) for p in dados_compilados["produtos_utilizados"]
    ]
    dados_compilados["produtos_utilizados"] = produtos_formatados

    return schemas.RelatorioAreaCompilado(
        area=area,
        data_inicio=data_inicio,
        data_fim=data_fim,
        **dados_compilados
    )

# =================================================================
# ENDPOINT DE DASHBOARD
# =================================================================

@router.get("/dashboard/summary", response_model=schemas.DashboardSummary)
def get_dashboard_summary(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    servicos_mes = crud_relatorio.count_servicos_mes_atual(db)
    produtos_usados_raw = crud_produto.get_produtos_usados_detalhado_mes_atual(db)
    dispositivos_summary_raw = crud_relatorio.count_dispositivos_por_tipo_e_status(db)

    produtos_formatados = [
        schemas.ProdutoUsadoSummary(
            nome=produto.nome,
            total_usado=produto.total_usado,
            unidade_uso=produto.unidade_uso
        )
        for produto in produtos_usados_raw
    ]

    summary = schemas.DashboardSummary(
        servicos_no_mes=servicos_mes,
        produtos_usados_no_mes=produtos_formatados,
        dispositivos_summary=dispositivos_summary_raw
    )
    
    return summary