from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import date, time
from enum import Enum

# =================================================================
# 1. Enums
# =================================================================
class NivelUrgenciaEnum(str, Enum):
    baixa = "Baixa"
    media = "Média"
    alta = "Alta"

# =================================================================
# 2. Schemas Base e de Autenticação
# =================================================================

# --- Usuário e Autenticação ---
class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    permissions: Optional[str] = None
    is_active: bool
    class Config:
        from_attributes = True

class UserUpdatePermissions(BaseModel):
    permissions: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# --- Área ---
class AreaBase(BaseModel):
    nome: str
    responsavel: Optional[str] = None
    telefone: Optional[str] = None

class AreaCreate(AreaBase):
    pass

class Area(AreaBase):
    id: int
    class Config:
        from_attributes = True

class AreaComStatus(Area):
    visitas_no_mes: int = 0

# --- Praga ---
class PragaBase(BaseModel):
    nome: str

class PragaCreate(PragaBase):
    pass

class Praga(PragaBase):
    id: int
    class Config:
        from_attributes = True

# --- Produto ---
class ProdutoBase(BaseModel):
    codigo: Optional[str] = None
    nome: str = Field(..., min_length=1)
    lote: Optional[str] = None
    validade: Optional[str] = None
    unidade_estoque: str = "Unidade(s)"
    unidade_uso: str = "Unidade(s)"
    fator_conversao_uso: float = Field(1.0, gt=0)
    obs_unidade: Optional[str] = None
    estoque_minimo: float = 0.0

class ProdutoCreate(ProdutoBase):
    estoque_atual: float = 0.0

class ProdutoUpdate(BaseModel):
    codigo: Optional[str] = None
    nome: Optional[str] = Field(None, min_length=1)
    lote: Optional[str] = None
    validade: Optional[str] = None
    unidade_estoque: Optional[str] = None
    unidade_uso: Optional[str] = None
    fator_conversao_uso: Optional[float] = Field(None, gt=0)
    obs_unidade: Optional[str] = None
    estoque_minimo: Optional[float] = None
    
class Produto(ProdutoBase):
    id: int
    estoque_atual: float
    class Config:
        from_attributes = True

# =================================================================
# 3. Schemas Dependentes Nível 1
# =================================================================

# --- Dispositivos ---
class DispositivoBase(BaseModel):
    numero: str
    tipo: str
    descricao: Optional[str] = None
    status: str
    area_id: int

class DispositivoCreate(DispositivoBase):
    pass

class Dispositivo(DispositivoBase):
    id: int
    area: Area
    class Config:
        from_attributes = True

class DispositivoLoteCreate(BaseModel):
    area: str
    prefixo: str
    numero_inicio: int
    numero_fim: int
    tipo: str
    descricao_base: Optional[str] = None
    status: str

class DispositivoStatusUpdate(BaseModel):
    dispositivo_id: int
    status: str

# --- Agenda ---
class AgendamentoBase(BaseModel):
    data_agendamento: date
    horario: Optional[time] = None
    area_id: int 
    tipo_servico: str
    observacoes: Optional[str] = None
    responsavel_id: int

class AgendamentoCreate(AgendamentoBase):
    pass

class AgendamentoUpdate(BaseModel):
    horario: Optional[time] = None
    tipo_servico: Optional[str] = None
    observacoes: Optional[str] = None
    status: Optional[str] = None

class Agendamento(AgendamentoBase):
    id: int
    status: str
    responsavel: User
    area: Area
    class Config:
        from_attributes = True

class OcorrenciaBase(BaseModel):
    data_ocorrencia: date
    descricao: str
    nivel_urgencia: NivelUrgenciaEnum
    area_id: int
    registrado_por_id: int

class OcorrenciaCreate(OcorrenciaBase):
    pass

class OcorrenciaUpdate(BaseModel):
    descricao: Optional[str] = None
    nivel_urgencia: Optional[NivelUrgenciaEnum] = None
    status: Optional[str] = None

class Ocorrencia(OcorrenciaBase):
    id: int
    status: str
    area: Area
    registrado_por: User
    class Config:
        from_attributes = True

# --- Serviços e suas associações ---
class ProdutoParaServicoBase(BaseModel):
    produto_id: int
    quantidade_usada: float

class ProdutoEmServico(ProdutoParaServicoBase):
    produto: Produto
    class Config:
        from_attributes = True
        
class ServicoBase(BaseModel):
    descricao: str
    data: Optional[date] = None
    horario_inicio: Optional[str] = None
    horario_termino: Optional[str] = None
    observacoes: Optional[str] = None
    status: str
    area_id: int
    tipo_atividade: str = "Visita de Rotina"


class ServicoCreate(ServicoBase):
    produtos_associados: List[ProdutoParaServicoBase] = []

class Servico(ServicoBase):
    id: int
    produtos_associados: List[ProdutoEmServico] = []
    area: Area
    class Config:
        from_attributes = True

# =================================================================
# 4. Schemas Dependentes Nível 2 (MIP, Contagem)
# =================================================================
class ContagemPragaBase(BaseModel):
    dispositivo_numero: str
    praga_nome: str
    quantidade: int

class ContagemPragaCreate(ContagemPragaBase):
    pass

class ContagemPraga(ContagemPragaBase):
    id: int
    servico_id: int
    class Config:
        from_attributes = True

class MIPRegistroBase(BaseModel):
    servico_id: int
    data_observacao: date
    pragas_observadas: str

class MIPRegistroCreate(MIPRegistroBase):
    pass

class MIPRegistro(MIPRegistroBase):
    id: int
    class Config:
        from_attributes = True

class MIPDataCreate(BaseModel):
    ocorrencias: List[str]
    contagens: List[ContagemPragaCreate]

class MIPData(BaseModel):
    ocorrencias: List[MIPRegistro] = []
    contagens: List[ContagemPraga] = []

# =================================================================
# 5. Schemas Compilados (para Relatórios e Dashboard)
# =================================================================
class RelatorioDispositivoStatus(BaseModel):
    numero: str
    tipo: str
    status_registrado: str
    class Config:
        from_attributes = True

class ServicoCompleto(Servico):
    contagens_praga: List[ContagemPraga] = []
    dispositivos_verificados: List[RelatorioDispositivoStatus] = []
    class Config:
        from_attributes = True

class ProdutoUsadoSummary(BaseModel):
    nome: str
    total_usado: float
    unidade_uso: str

class RelatorioContagemPraga(BaseModel):
    praga_nome: str
    total_contado: int
    class Config:
        from_attributes = True

class ObservacaoServico(BaseModel):
    servico_id: int
    observacoes: str
    class Config:
        from_attributes = True

class RelatorioAreaCompilado(BaseModel):
    area: Area
    data_inicio: date
    data_fim: date
    produtos_utilizados: List[ProdutoUsadoSummary]
    contagens_pragas: List[ContagemPraga]
    dispositivos_status: List[RelatorioDispositivoStatus]
    ocorrencias_mip: List[MIPRegistro]
    observacoes_gerais: List[ObservacaoServico]
    class Config:
        from_attributes = True

class DashboardSummary(BaseModel):
    agendamentos_hoje: List[Agendamento] = []
    ocorrencias_no_mes: List[Ocorrencia] = []
    servicos_no_mes: int = 0
    areas_cadastradas: int = 0
    produtos_usados_no_mes: List[ProdutoUsadoSummary] = []
    dispositivos_summary: Dict[str, Dict[str, int]] = {}
    resumo_descricoes: Dict[str, int] = {}
    
# =================================================================
# 6. Schemas Utilitários
# =================================================================
class AgendaItem(BaseModel):
    id: int
    data: date
    descricao: str
    status: str
    tipo: str = "servico"
    class Config:
        from_attributes = True