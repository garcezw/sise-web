import sys
from a2wsgi import ASGIMiddleware

# ATENÇÃO: Deixaremos este caminho genérico por enquanto.
# Vamos ajustá-lo depois, dentro do site do PythonAnywhere.
path = '/home/seu_usuario/seu_projeto' 

if path not in sys.path:
    sys.path.insert(0, path)

# Importa sua aplicação FastAPI
from main_api import app

# Envelopa a aplicação ASGI (FastAPI) em um middleware WSGI
application = ASGIMiddleware(app)