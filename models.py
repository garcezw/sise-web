# models.py (Versão Final com Ordem Corrigida)

from sqlalchemy import (
    Column, Integer, String, Float, ForeignKey, Boolean, Date, Text, Time, Enum
)
from sqlalchemy.orm import relationship
from database import Base

# --- Modelos Base (sem dependências complexas) ---
class Area(Base):
    __tablename__ = "areas"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, unique=True, index=True, nullable=False)
    responsavel = Column(String, nullable=True)
    telefone = Column(String, nullable=True)
    ocorrencias = relationship("Ocorrencia", back_populates="area")
    dispositivos = relationship("Dispositivo", back_populates="area", cascade="all, delete-orphan")
    servicos = relationship("Servico", back_populates="area")
    agendamentos = relationship("Agendamento", back_populates="area")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    permissions = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    agendamentos = relationship("Agendamento", back_populates="responsavel")
    ocorrencias_registradas = relationship("Ocorrencia", back_populates="registrado_por")


class Produto(Base):
    __tablename__ = "produtos"
    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String, index=True, nullable=True)
    nome = Column(String, index=True, nullable=False)
    unidade_estoque = Column(String, default="Unidade(s)")
    estoque_atual = Column(Float, default=0.0)
    unidade_uso = Column(String, default="Unidade(s)")
    fator_conversao_uso = Column(Float, default=1.0)
    lote = Column(String, nullable=True)
    validade = Column(String, nullable=True)
    obs_unidade = Column(String, nullable=True)
    estoque_minimo = Column(Float, default=0.0)
    
    servicos_associados = relationship("ServicoProdutoAssociado", back_populates="produto")

class Praga(Base):
    __tablename__ = "pragas"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, unique=True, index=True, nullable=False)

# --- Modelos que dependem dos básicos ---
class Dispositivo(Base):
    __tablename__ = "dispositivos"
    id = Column(Integer, primary_key=True, index=True)
    numero = Column(String, nullable=False)
    tipo = Column(String, default="AL")
    descricao = Column(String, nullable=True)
    status = Column(String, default="Ativo")
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=False)
    
    area = relationship("Area", back_populates="dispositivos")
    servicos_onde_foi_verificado = relationship("ServicoDispositivoStatus", back_populates="dispositivo")

class Servico(Base):
    __tablename__ = "servicos"
    id = Column(Integer, primary_key=True, index=True)
    descricao = Column(String, nullable=False)
    data = Column(Date)
    horario_inicio = Column(String, nullable=True)
    horario_termino = Column(String, nullable=True)
    status = Column(String, default="Pendente")
    observacoes = Column(Text, nullable=True)
    tipo_atividade = Column(String, default="Visita de Rotina", nullable=False)
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=False)
    area = relationship("Area", back_populates="servicos")
    produtos_associados = relationship("ServicoProdutoAssociado", back_populates="servico", cascade="all, delete-orphan")
    registros_mip = relationship("MIPRegistro", back_populates="servico", cascade="all, delete-orphan")
    contagens_praga = relationship("ContagemPraga", back_populates="servico", cascade="all, delete-orphan")
    dispositivos_verificados = relationship("ServicoDispositivoStatus", back_populates="servico", cascade="all, delete-orphan")

# --- Tabelas de Associação e Modelos que dependem de 'Servico' e 'Dispositivo' ---
class ServicoProdutoAssociado(Base):
    __tablename__ = 'servico_produto'
    servico_id = Column(Integer, ForeignKey('servicos.id'), primary_key=True)
    produto_id = Column(Integer, ForeignKey('produtos.id'), primary_key=True)
    quantidade_usada = Column(Float, nullable=False)
    
    servico = relationship("Servico", back_populates="produtos_associados")
    produto = relationship("Produto", back_populates="servicos_associados")

class ServicoDispositivoStatus(Base):
    __tablename__ = 'servico_dispositivo_status'
    servico_id = Column(Integer, ForeignKey('servicos.id'), primary_key=True)
    dispositivo_id = Column(Integer, ForeignKey('dispositivos.id'), primary_key=True)
    status_registrado = Column(String, nullable=False)

    servico = relationship("Servico", back_populates="dispositivos_verificados")
    dispositivo = relationship("Dispositivo", back_populates="servicos_onde_foi_verificado")

class MIPRegistro(Base):
    __tablename__ = "mip_registros"
    id = Column(Integer, primary_key=True, index=True)
    data_observacao = Column(Date, nullable=False)
    observacao_texto = Column(Text, nullable=True)
    pragas_observadas = Column(String, nullable=True)
    servico_id = Column(Integer, ForeignKey("servicos.id"), nullable=False)
    
    servico = relationship("Servico", back_populates="registros_mip")

class ContagemPraga(Base):
    __tablename__ = "contagens_pragas"
    id = Column(Integer, primary_key=True, index=True)
    dispositivo_numero = Column(String, nullable=False)
    praga_nome = Column(String, nullable=False)
    quantidade = Column(Integer, nullable=False)
    servico_id = Column(Integer, ForeignKey("servicos.id"), nullable=False)
    
    servico = relationship("Servico", back_populates="contagens_praga")

class Agendamento(Base):
    __tablename__ = "agendamentos"
    id = Column(Integer, primary_key=True, index=True)
    data_agendamento = Column(Date, nullable=False)
    horario = Column(Time, nullable=True)
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=False)
    area = relationship("Area", back_populates="agendamentos")

    tipo_servico = Column(String, nullable=False)
    status = Column(String, default="Pendente", nullable=False)
    observacoes = Column(Text, nullable=True)

    responsavel_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    responsavel = relationship("User", back_populates="agendamentos")

class Ocorrencia(Base):
    __tablename__ = "ocorrencias"
    id = Column(Integer, primary_key=True, index=True)
    data_ocorrencia = Column(Date, nullable=False)
    descricao = Column(Text, nullable=False)
    nivel_urgencia = Column(Enum("Baixa", "Média", "Alta", name="nivel_urgencia_enum"), nullable=False, default="Baixa")
    status = Column(String, default="Aberta", nullable=False)
    
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=False)
    area = relationship("Area", back_populates="ocorrencias")
    
    registrado_por_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    registrado_por = relationship("User", back_populates="ocorrencias_registradas")