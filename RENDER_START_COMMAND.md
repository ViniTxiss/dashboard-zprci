# Configuração do Start Command no Render

## ⚠️ IMPORTANTE: Configurar Start Command Manualmente

O Render pode estar ignorando o `render.yaml` ou `Procfile`. Você **DEVE** configurar o Start Command manualmente no dashboard do Render.

## Passos para Configurar

1. Acesse https://dashboard.render.com
2. Vá para o serviço **"dashboard-backend"**
3. Clique em **"Settings"**
4. Role até a seção **"Build & Deploy"**
5. Procure por **"Start Command"**
6. Cole exatamente este comando:

```bash
gunicorn backend.app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --pythonpath .
```

7. **NÃO** use `python app.py` ou `python backend/app.py`
8. **NÃO** adicione `cd backend` no início
9. Clique em **"Save Changes"**
10. Faça um novo deploy

## Verificação

Após configurar, os logs devem mostrar:
- ✅ `[INFO] Starting gunicorn`
- ✅ `[INFO] Listening at: http://0.0.0.0:XXXX` (onde XXXX é a porta do Render)
- ❌ **NÃO** deve mostrar `python app.py` ou `uvicorn running on http://0.0.0.0:8001`

## Por que isso é necessário?

- O Render pode não estar lendo o `render.yaml` automaticamente
- O `Procfile` pode não estar sendo usado
- Configurar manualmente garante que o comando correto seja executado
- O Gunicorn é necessário para produção (melhor performance e estabilidade)

## Comando Alternativo (se o acima não funcionar)

Se ainda houver problemas, tente:

```bash
export PYTHONPATH="${PYTHONPATH}:." && gunicorn backend.app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --pythonpath .
```
