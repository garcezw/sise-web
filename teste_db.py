# Em teste_db.py

# Importações necessárias para acessar o banco e os modelos
from sqlalchemy import extract, func
from database import SessionLocal  # Importa o criador de sessão do seu projeto
import models
from datetime import date

def testar_consulta_descricoes():
    """
    Esta função se conecta ao banco de dados e executa a consulta
    exata que está no nosso dashboard, para vermos o resultado bruto.
    """
    print("--- INICIANDO TESTE DIRETO NO BANCO DE DADOS ---")
    
    # Cria uma nova sessão com o banco, exatamente como a API faz
    db = SessionLocal()
    
    try:
        # Define o período que estamos buscando
        hoje = date.today()
        ano_corrente = hoje.year
        mes_corrente = hoje.month
        
        print(f"Buscando serviços para o período: Ano={ano_corrente}, Mês={mes_corrente}")

        # A consulta exata do nosso dashboard
        contagem_descricoes = db.query(
            models.Servico.descricao,
            func.count(models.Servico.id).label('total')
        ).filter(
            extract('year', models.Servico.data) == ano_corrente,
            extract('month', models.Servico.data) == mes_corrente,
            models.Servico.descricao.is_not(None)
        ).group_by(
            models.Servico.descricao
        ).all()

        print("\n--- RESULTADO DA CONSULTA ---")
        if not contagem_descricoes:
            print("A consulta não retornou nenhum resultado. A lista está vazia: []")
        else:
            print("A consulta encontrou os seguintes dados:")
            print(contagem_descricoes)
        print("-----------------------------\n")

    finally:
        # Garante que a conexão com o banco seja fechada
        db.close()
        print("--- TESTE FINALIZADO ---")

# Executa a nossa função de teste
if __name__ == "__main__":
    testar_consulta_descricoes()