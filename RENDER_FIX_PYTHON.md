# Correção: ModuleNotFoundError: No module named 'backend'

## Problema

O Render está usando Python 3.13 por padrão e não encontra o módulo 'backend'.

## Soluções

### Solução 1: Configurar Python 3.11 no Dashboard do Render (RECOMENDADO)

1. Acesse https://dashboard.render.com
2. Vá para o serviço "dashboard-backend"
3. Clique em **"Settings"**
4. Na seção **"Environment"**, procure por **"Python Version"**
5. Selecione manualmente **Python 3.11.0** (não deixe em "Auto" ou "Latest")
6. Salve as alterações

### Solução 2: Verificar Root Directory

1. No dashboard do Render, vá para **"Settings"**
2. Procure por **"Root Directory"**
3. Deixe **VAZIO** (não coloque `backend` ou qualquer outro valor)
4. O Render deve usar a raiz do repositório como diretório raiz

### Solução 3: Start Command Correto

Certifique-se de que o **Start Command** está assim:

```bash
export PYTHONPATH="${PYTHONPATH}:." && python3.11 -m gunicorn backend.app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --pythonpath .
```

**OU** (se Python 3.11 não estiver disponível como `python3.11`):

```bash
export PYTHONPATH="${PYTHONPATH}:." && gunicorn backend.app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --pythonpath .
```

### Solução 4: Verificar Estrutura do Projeto

Certifique-se de que a estrutura está assim:

```
.
├── backend/
│   ├── __init__.py  ← IMPORTANTE: Este arquivo deve existir
│   ├── app.py
│   ├── routes/
│   └── services/
├── requirements.txt
├── runtime.txt
├── render.yaml
└── Procfile
```

O arquivo `backend/__init__.py` foi criado para garantir que o Python reconheça `backend` como um módulo.

## Verificação

Após aplicar as correções:

1. Faça um novo deploy no Render
2. Verifique os logs para confirmar que está usando Python 3.11
3. Teste o endpoint: `https://seu-servico.onrender.com/health`

## Notas Importantes

- O Render pode ignorar o `runtime.txt` se o Python Version não estiver configurado manualmente no dashboard
- Sempre verifique os logs do build para confirmar qual versão do Python está sendo usada
- O `__init__.py` no diretório `backend` é necessário para que o Python reconheça como um pacote
