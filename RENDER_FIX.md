# Correção do Deploy no Render

## Problema
O Render está tentando executar `cd backend && gunicorn app:app ...` mas o diretório `backend` não existe na estrutura do repositório clonado.

## Solução

### Opção 1: Atualizar a Configuração no Dashboard do Render (RECOMENDADO)

1. Acesse o dashboard do Render: https://dashboard.render.com
2. Vá para o serviço "dashboard-backend"
3. Clique em "Settings" (Configurações)
4. Na seção "Build & Deploy", verifique:
   - **Build Command**: `python -m pip install --upgrade pip && pip install -r requirements.txt`
   - **Start Command**: `gunicorn backend.app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --pythonpath .`
5. Certifique-se de que **não há** `cd backend` no Start Command
6. Salve as alterações
7. Faça um novo deploy

### Opção 2: Usar o render.yaml (Alternativa)

Se o Render não estiver usando o `render.yaml` automaticamente:

1. No dashboard do Render, vá para "Settings"
2. Procure por "Render Configuration File" ou "render.yaml"
3. Certifique-se de que está apontando para `render.yaml` na raiz do repositório
4. Ou copie o conteúdo do `render.yaml` para as configurações do dashboard

### Verificação

Após atualizar, o comando de start deve ser:
```bash
gunicorn backend.app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --pythonpath .
```

**NÃO deve conter** `cd backend` no início.

## Estrutura do Projeto

O projeto tem a seguinte estrutura:
```
.
├── backend/
│   ├── app.py
│   ├── routes/
│   └── services/
├── frontend/
├── requirements.txt
├── render.yaml
└── Procfile
```

O `app.py` está em `backend/app.py`, então o comando do Gunicorn deve ser `backend.app:app` (não `app:app`).
