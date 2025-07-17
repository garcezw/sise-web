# crud.py (versão final e padronizada)

from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from datetime import date
import models, schemas, security
from sqlalchemy import func, extract
from datetime import datetime
import models

# =================================================================
# Funções CRUD para Produtos
# =================================================================
def get_produto(db: Session, produto_id: int):
    return db.query(models.Produto).filter(models.Produto.id == produto_id).first()

def get_produtos(db: Session):
    return db.query(models.Produto).order_by(models.Produto.nome).all()

def create_produto(db: Session, produto: schemas.ProdutoCreate):
    db_produto = models.Produto(**produto.dict())
    db.add(db_produto)
    db.commit()
    db.refresh(db_produto)
    return db_produto

def update_produto(db: Session, produto_id: int, produto_data: schemas.ProdutoUpdate):
    db_produto = get_produto(db, produto_id)
    if not db_produto: return None
    update_data = produto_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_produto, key, value)
    db.add(db_produto)
    db.commit()
    db.refresh(db_produto)
    return db_produto

def delete_produto(db: Session, produto_id: int):
    servico_usando = db.query(models.ServicoProdutoAssociado).filter(models.ServicoProdutoAssociado.produto_id == produto_id).first()
    if servico_usando:
        raise ValueError(f"Produto ID {produto_id} não pode ser excluído pois está associado ao serviço ID: {servico_usando.servico_id}.")
    db_produto = get_produto(db, produto_id)
    if not db_produto: raise Exception("Produto não encontrado")
    db.delete(db_produto)
    db.commit()
    return {"ok": True}

def add_estoque(db: Session, produto_id: int, quantidade: float):
    db_produto = get_produto(db, produto_id)
    if not db_produto: return None
    db_produto.estoque_atual += quantidade
    db.add(db_produto)
    db.commit()
    db.refresh(db_produto)
    return db_produto

def get_produto(db: Session, produto_id: int):
    """Busca um único produto pelo seu ID."""
    return db.query(models.Produto).filter(models.Produto.id == produto_id).first()

def get_produtos_usados_detalhado_mes_atual(db: Session):
    """
    Retorna uma lista de produtos usados no mês atual,
    com o total de uso para cada um.
    """
    agora = datetime.now()
    query = (
        db.query(
            models.Produto.nome,
            # ✅ CORREÇÃO 1: Usar o nome correto do modelo
            func.sum(models.ServicoProdutoAssociado.quantidade_usada).label("total_usado"),
            models.Produto.unidade_uso,
        )
        # ✅ CORREÇÃO 2: Usar o nome correto aqui também
        .join(models.ServicoProdutoAssociado, models.Produto.id == models.ServicoProdutoAssociado.produto_id)
        .join(models.Servico, models.ServicoProdutoAssociado.servico_id == models.Servico.id)
        .filter(extract('year', models.Servico.data) == agora.year)
        .filter(extract('month', models.Servico.data) == agora.month)
        .group_by(models.Produto.nome, models.Produto.unidade_uso)
        .order_by(models.Produto.nome)
    )
    return query.all()

# =================================================================
# Funções CRUD para Usuários
# =================================================================
def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = security.get_password_hash(user.password)
    db_user = models.User(username=user.username, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
    
def get_users(db: Session):
    return db.query(models.User).all()

def update_user_permissions(db: Session, user_id: int, permissions: str):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user: return None
    db_user.permissions = permissions
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def delete_user(db: Session, user_id: int):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user:
        db.delete(db_user)
        db.commit()
        return {"ok": True}
    return None

# =================================================================
# Funções CRUD para Serviços
# =================================================================
def get_servicos(db: Session, area_id: Optional[int] = None, data: Optional[date] = None):
    query = db.query(models.Servico).options(
        joinedload(models.Servico.area), # Carrega os dados da área junto
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

def _ajustar_estoque_para_servico(db: Session, servico_id: int, produtos_associados: list, operacao: str):
    for prod_assoc in produtos_associados:
        produto_db = db.query(models.Produto).filter(models.Produto.id == prod_assoc.produto_id).first()
        if not produto_db: raise ValueError(f"Produto ID {prod_assoc.produto_id} não encontrado no estoque.")
        if operacao == 'subtrair':
            if produto_db.estoque_atual < prod_assoc.quantidade_usada: raise ValueError(f"Estoque insuficiente para '{produto_db.nome}'.")
            produto_db.estoque_atual -= prod_assoc.quantidade_usada
        elif operacao == 'adicionar':
            produto_db.estoque_atual += prod_assoc.quantidade_usada
        db.add(produto_db)

def create_servico(db: Session, servico: schemas.ServicoCreate):
    _ajustar_estoque_para_servico(db, None, servico.produtos_associados, 'subtrair')
    produtos_para_salvar = servico.produtos_associados
    servico_data = servico.dict(exclude={'produtos_associados'})
    db_servico = models.Servico(**servico_data)
    for prod_assoc in produtos_para_salvar:
        assoc = models.ServicoProdutoAssociado(produto_id=prod_assoc.produto_id, quantidade_usada=prod_assoc.quantidade_usada)
        db_servico.produtos_associados.append(assoc)
    db.add(db_servico)
    db.commit()
    db.refresh(db_servico)
    return db_servico

def update_servico(db: Session, servico_id: int, servico_update: schemas.ServicoCreate):
    db_servico = db.query(models.Servico).options(joinedload(models.Servico.produtos_associados)).filter(models.Servico.id == servico_id).first()
    if not db_servico: return None
    produtos_antigos = [schemas.ProdutoParaServicoBase(produto_id=p.produto_id, quantidade_usada=p.quantidade_usada) for p in db_servico.produtos_associados]
    _ajustar_estoque_para_servico(db, servico_id, produtos_antigos, 'adicionar')
    _ajustar_estoque_para_servico(db, servico_id, servico_update.produtos_associados, 'subtrair')
    update_data = servico_update.dict(exclude={'produtos_associados'})
    for key, value in update_data.items():
        setattr(db_servico, key, value)
    db_servico.produtos_associados.clear()
    for prod_assoc in servico_update.produtos_associados:
        assoc = models.ServicoProdutoAssociado(produto_id=prod_assoc.produto_id, quantidade_usada=prod_assoc.quantidade_usada)
        db_servico.produtos_associados.append(assoc)
    db.commit()
    db.refresh(db_servico)
    return db_servico

def delete_servico(db: Session, servico_id: int):
    db_servico = db.query(models.Servico).options(joinedload(models.Servico.produtos_associados)).filter(models.Servico.id == servico_id).first()
    if not db_servico: raise ValueError("Serviço não encontrado")
    produtos_para_devolver = [schemas.ProdutoParaServicoBase(produto_id=p.produto_id, quantidade_usada=p.quantidade_usada) for p in db_servico.produtos_associados]
    _ajustar_estoque_para_servico(db, servico_id, produtos_para_devolver, 'adicionar')
    db.delete(db_servico)
    db.commit()
    return {"ok": True}

def concluir_servico(db: Session, servico_id: int):
    db_servico = db.query(models.Servico).filter(models.Servico.id == servico_id).first()
    if not db_servico: raise ValueError(f"Serviço com ID {servico_id} não encontrado.")
    if db_servico.status == "Concluído": return db_servico
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

from datetime import date # Verifique se 'date' já está importado no topo do arquivo

def get_servicos_por_periodo(db: Session, data_inicio: date, data_fim: date):
    """Busca todos os serviços dentro de um intervalo de datas."""
    return db.query(models.Servico).filter(
        models.Servico.data >= data_inicio,
        models.Servico.data <= data_fim
    ).order_by(models.Servico.data).all()

# =================================================================
# Funções CRUD para Pragas
# =================================================================
def get_praga_by_name(db: Session, nome: str):
    return db.query(models.Praga).filter(models.Praga.nome == nome).first()

def get_pragas(db: Session):
    return db.query(models.Praga).order_by(models.Praga.nome).all()

def create_praga(db: Session, praga: schemas.PragaCreate):
    db_praga = models.Praga(nome=praga.nome)
    db.add(db_praga)
    db.commit()
    db.refresh(db_praga)
    return db_praga

def delete_praga(db: Session, praga_id: int):
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
    """ Salva os dados de MIP e Contagem para um serviço. """
    db_servico = db.query(models.Servico).filter(models.Servico.id == servico_id).first()
    if not db_servico:
        raise ValueError(f"Serviço com ID {servico_id} não encontrado.")
    db.query(models.MIPRegistro).filter(models.MIPRegistro.servico_id == servico_id).delete()
    db.query(models.ContagemPraga).filter(models.ContagemPraga.servico_id == servico_id).delete()
    
    novas_ocorrencias = []
    for praga_nome in mip_data.ocorrencias:
        db_ocorrencia = models.MIPRegistro(praga_observada=praga_nome, servico_id=servico_id)
        db.add(db_ocorrencia)
        novas_ocorrencias.append(db_ocorrencia)

    novas_contagens = []
    for contagem in mip_data.contagens:
        db_contagem = models.ContagemPraga(**contagem.dict(), servico_id=servico_id)
        db.add(db_contagem)
        novas_contagens.append(db_contagem)

    db.commit()
    for ocorrencia in novas_ocorrencias:
        db.refresh(ocorrencia)
    for contagem in novas_contagens:
        db.refresh(contagem)
    return {"ocorrencias": novas_ocorrencias, "contagens": novas_contagens}

# =================================================================
# Funções CRUD para Dispositivos
# =================================================================
def get_dispositivos(db: Session, area_id: Optional[int] = None, tipo: Optional[str] = None):
    """Busca todos os dispositivos, com filtros opcionais por área e tipo."""
    query = db.query(models.Dispositivo).join(models.Area).order_by(models.Area.nome, models.Dispositivo.numero)
    if area_id:
        query = query.filter(models.Dispositivo.area_id == area_id)
    if tipo:
        query = query.filter(models.Dispositivo.tipo == tipo)
    return query.all()

def create_dispositivo(db: Session, dispositivo: schemas.DispositivoCreate):
    db_dispositivo = models.Dispositivo(**dispositivo.dict())
    db.add(db_dispositivo)
    db.commit()
    db.refresh(db_dispositivo)
    return db_dispositivo

def update_dispositivo(db: Session, dispositivo_id: int, dispositivo_data: schemas.DispositivoCreate):
    db_dispositivo = db.query(models.Dispositivo).filter(models.Dispositivo.id == dispositivo_id).first()
    if not db_dispositivo: return None
    update_data = dispositivo_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_dispositivo, key, value)
    db.commit()
    db.refresh(db_dispositivo)
    return db_dispositivo

def delete_dispositivo(db: Session, dispositivo_id: int):
    db_dispositivo = db.query(models.Dispositivo).filter(models.Dispositivo.id == dispositivo_id).first()
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
    # Primeiro, apaga os status antigos para este serviço para evitar duplicatas
    # Isso permite que o usuário possa re-salvar os status para o mesmo serviço.
    db.query(models.ServicoDispositivoStatus).filter(models.ServicoDispositivoStatus.servico_id == servico_id).delete()

    lista_retorno = []
    for update in status_updates:
        # A linha que atualizava o status principal do dispositivo foi REMOVIDA.
        # Agora, nós apenas criamos o registro histórico na tabela de associação.
        db_status = models.ServicoDispositivoStatus(
            servico_id=servico_id,
            dispositivo_id=update.dispositivo_id,
            status_registrado=update.status
        )
        db.add(db_status)
        lista_retorno.append(db_status)
    
    db.commit()
    return lista_retorno

def get_dispositivo(db: Session, dispositivo_id: int):
    """Busca um único dispositivo pelo seu ID."""
    return db.query(models.Dispositivo).filter(models.Dispositivo.id == dispositivo_id).first()

# =================================================================
# Funções CRUD para Áreas
# =================================================================
def get_area(db: Session, area_id: int):
    return db.query(models.Area).filter(models.Area.id == area_id).first()

def get_area_by_name(db: Session, nome: str):
    return db.query(models.Area).filter(models.Area.nome == nome).first()

def get_areas(db: Session):
    return db.query(models.Area).order_by(models.Area.nome).all()

def create_area(db: Session, area: schemas.AreaCreate):
    db_area = models.Area(**area.dict())
    db.add(db_area)
    db.commit()
    db.refresh(db_area)
    return db_area

def update_area(db: Session, area_id: int, area_data: schemas.AreaCreate):
    db_area = get_area(db, area_id)
    if not db_area: return None
    update_data = area_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_area, key, value)
    db.commit()
    db.refresh(db_area)
    return db_area

def delete_area(db: Session, area_id: int):
    db_area = get_area(db, area_id)
    if not db_area: return None
    if db_area.dispositivos or db_area.servicos:
        raise ValueError("Não é possível excluir área com dispositivos ou serviços associados.")
    db.delete(db_area)
    db.commit()
    return {"ok": True}

# =================================================================
# CORREÇÃO FINAL: Função de criação de registro de MIP
# =================================================================
def create_mip_registro(db: Session, registro: schemas.MIPRegistroCreate) -> models.MIPRegistro:
    """Cria um único registro de MIP."""
    db_servico = db.query(models.Servico).filter(models.Servico.id == registro.servico_id).first()
    if not db_servico:
        raise ValueError("Serviço com o ID fornecido não foi encontrado.")
    
    # Cria o registro usando o modelo correto
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

# =================================================================
# Funções CRUD para o Dashboard
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
    total = db.query(func.sum(models.ServicoProdutoAssociado.quantidade_usada)).join(models.Servico).filter(
        extract('year', models.Servico.data) == hoje.year,
        extract('month', models.Servico.data) == hoje.month
    ).scalar()
    return total or 0.0 # Retorna 0 se o total for None

def count_dispositivos_por_tipo_e_status(db: Session):
    """Conta dispositivos agrupando por tipo e status."""
    resultado = db.query(
        models.Dispositivo.tipo,
        models.Dispositivo.status,
        func.count(models.Dispositivo.id)
    ).group_by(models.Dispositivo.tipo, models.Dispositivo.status).all()
    
    # Formata o resultado para ser mais fácil de usar no front-end
    # Ex: {'AL': {'Ativo': 10, 'Inativo': 2}, 'PPE': {'Ativo': 8}}
    dados_formatados = {}
    for tipo, status, contagem in resultado:
        if tipo not in dados_formatados:
            dados_formatados[tipo] = {}
        dados_formatados[tipo][status] = contagem
    return dados_formatados


def get_relatorio_compilado_area(db: Session, area_id: int, data_inicio: date, data_fim: date):
    """
    Busca todas as informações relacionadas a um único serviço para gerar
    um relatório completo (Ordem de Serviço).
    """
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

    # Esta linha agora funciona porque a função foi definida acima
    contagens = get_relatorio_contagem_pragas(db, data_inicio, data_fim)

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


