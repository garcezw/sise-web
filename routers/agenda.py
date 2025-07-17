# Arquivo: routers/agenda.py (Versão Atualizada)

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import date

import models, schemas
from database import get_db
# ✅ Passo 1: Importar o novo módulo crud_agenda
from crud import crud_servico, crud_agenda 
from .usuarios import get_current_active_user

router = APIRouter(
    prefix="/api/agenda",
    tags=["Agenda"]
)

# --- Endpoint existente (mantido) ---

@router.get("/mes/{year}/{month}", response_model=List[schemas.AgendaItem])
def get_eventos_do_mes(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Retorna todos os serviços, ocorrências e agendamentos de um 
    determinado mês para popular o calendário.
    """
    eventos_finais = []

    # 1. Busca os serviços do mês
    servicos = crud_servico.get_servicos_para_agenda(db=db, year=year, month=month)
    for s in servicos:
        # ✅ Descrição agora inclui a área do serviço
        s.descricao = f"{s.area.nome} - {s.descricao}" if s.area else s.descricao
        eventos_finais.append(s)

    # 2. Busca as ocorrências do mês
    ocorrencias = crud_agenda.get_ocorrencias(db, year=year, month=month)
    for o in ocorrencias:
        eventos_finais.append(schemas.AgendaItem(
            id=o.id,
            data=o.data_ocorrencia,
            # ✅ Descrição agora é o nome da área
            descricao=o.area.nome if o.area else "Ocorrência",
            status=o.status,
            tipo="ocorrencia"
        ))

    # 3. Busca os agendamentos do mês
    agendamentos = crud_agenda.get_agendamentos(db, year=year, month=month)
    for a in agendamentos:
         eventos_finais.append(schemas.AgendaItem(
            id=a.id,
            data=a.data_agendamento,
            # ✅ Descrição agora é a área e o tipo de serviço
            descricao=f"{a.area.nome} - {a.tipo_servico}" if a.area else a.tipo_servico,
            status=a.status,
            tipo="agendamento"
        ))

    return eventos_finais

# =================================================================
# ✅ Passo 2: Adicionar Endpoints para AGENDAMENTOS
# =================================================================

@router.post("/agendamentos/", response_model=schemas.Agendamento, status_code=status.HTTP_201_CREATED)
def create_agendamento(
    agendamento: schemas.AgendamentoCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    """Cria um novo agendamento."""
    # Garante que o responsável pelo agendamento é o usuário logado
    if agendamento.responsavel_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="O ID do responsável não corresponde ao usuário logado."
        )
    return crud_agenda.create_agendamento(db=db, agendamento=agendamento)

@router.get("/agendamentos/", response_model=List[schemas.Agendamento])
def read_agendamentos(
    year: int, 
    month: int,
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Retorna uma lista de agendamentos para um mês e ano específicos."""
    agendamentos = crud_agenda.get_agendamentos(db, year=year, month=month, skip=skip, limit=limit)
    return agendamentos

# =================================================================
# ✅ Passo 3: Adicionar Endpoints para OCORRÊNCIAS
# =================================================================

@router.post("/ocorrencias/", response_model=schemas.Ocorrencia, status_code=status.HTTP_201_CREATED)
def create_ocorrencia(
    ocorrencia: schemas.OcorrenciaCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Cria uma nova ocorrência."""
    # Garante que quem registrou a ocorrência é o usuário logado
    if ocorrencia.registrado_por_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="O ID de quem registrou não corresponde ao usuário logado."
        )
    return crud_agenda.create_ocorrencia(db=db, ocorrencia=ocorrencia)

@router.get("/ocorrencias/", response_model=List[schemas.Ocorrencia])
def read_ocorrencias(
    year: int,
    month: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Retorna uma lista de ocorrências para um mês e ano específicos."""
    ocorrencias = crud_agenda.get_ocorrencias(db, year=year, month=month, skip=skip, limit=limit)
    return ocorrencias

@router.delete("/ocorrencias/{ocorrencia_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ocorrencia(
    ocorrencia_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Exclui uma ocorrência pelo seu ID."""
    db_ocorrencia = crud_agenda.get_ocorrencia_by_id(db, ocorrencia_id=ocorrencia_id)
    if not db_ocorrencia:
        raise HTTPException(status_code=404, detail="Ocorrência não encontrada")
    
    # Você pode adicionar uma lógica de permissão aqui, se necessário
    # Ex: if db_ocorrencia.registrado_por_id != current_user.id: ...
    
    crud_agenda.delete_ocorrencia(db=db, ocorrencia_id=ocorrencia_id)
    # Para DELETE, é comum não retornar conteúdo, apenas o status de sucesso.

@router.get("/ocorrencias/{ocorrencia_id}", response_model=schemas.Ocorrencia)
def read_ocorrencia_by_id(
    ocorrencia_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Busca os dados de uma única ocorrência para edição."""
    db_ocorrencia = crud_agenda.get_ocorrencia_by_id(db, ocorrencia_id=ocorrencia_id)
    if not db_ocorrencia:
        raise HTTPException(status_code=404, detail="Ocorrência não encontrada")
    return db_ocorrencia


# ✅ NOVO ENDPOINT (2/2): Atualizar uma ocorrência
@router.put("/ocorrencias/{ocorrencia_id}", response_model=schemas.Ocorrencia)
def update_ocorrencia(
    ocorrencia_id: int,
    ocorrencia: schemas.OcorrenciaUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Atualiza uma ocorrência existente."""
    db_ocorrencia = crud_agenda.get_ocorrencia_by_id(db, ocorrencia_id=ocorrencia_id)
    if not db_ocorrencia:
        raise HTTPException(status_code=404, detail="Ocorrência não encontrada")
    
    updated_ocorrencia = crud_agenda.update_ocorrencia(db=db, ocorrencia_id=ocorrencia_id, ocorrencia_update=ocorrencia)
    return updated_ocorrencia

@router.delete("/agendamentos/{agendamento_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agendamento(
    agendamento_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Exclui um agendamento pelo seu ID."""
    db_agendamento = crud_agenda.get_agendamento_by_id(db, agendamento_id=agendamento_id)
    if not db_agendamento:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    
    crud_agenda.delete_agendamento(db=db, agendamento_id=agendamento_id)
    return

@router.get("/agendamentos/{agendamento_id}", response_model=schemas.Agendamento)
def read_agendamento_by_id(
    agendamento_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Busca os dados de um único agendamento para edição."""
    db_agendamento = crud_agenda.get_agendamento_by_id(db, agendamento_id=agendamento_id)
    if not db_agendamento:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    return db_agendamento


#  NOVO ENDPOINT (2/2): Atualizar um agendamento
@router.put("/agendamentos/{agendamento_id}", response_model=schemas.Agendamento)
def update_agendamento(
    agendamento_id: int,
    agendamento: schemas.AgendamentoUpdate, # Usamos o schema de Update
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Atualiza um agendamento existente."""
    db_agendamento = crud_agenda.get_agendamento_by_id(db, agendamento_id=agendamento_id)
    if not db_agendamento:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    
    updated_agendamento = crud_agenda.update_agendamento(db=db, agendamento_id=agendamento_id, agendamento_update=agendamento)
    return updated_agendamento

