# Solução Final para Deploy no Render

## Problema Identificado

O Render está:
1. Usando Python 3.13 em vez de 3.11.0
2. Não encontrando o módulo 'backend'
3. Executando `python app.py` em vez do Gunicorn

## Solução: Configurar Manualmente no Dashboard

O Render pode ignorar o `render.yaml`. Você **DEVE** configurar manualmente:

### 1. Python Version

1. Dashboard Render → Seu Serviço → **Settings**
2. Seção **"Environment"**
3. **Python Version**: Selecione manualmente **Python 3.11.0**
4. **NÃO** deixe em "Auto" ou "Latest"

### 2. Root Directory

1. Dashboard Render → Seu Serviço → **Settings**
2. Seção **"Build & Deploy"**
3. **Root Directory**: Deixe **VAZIO** (não coloque `backend`)

### 3. Build Command

```bash
python3.11 -m pip install --upgrade pip && python3.11 -m pip install -r requirements.txt
```

### 4. Start Command (CRÍTICO)

Cole exatamente este comando:

```bash
cd /opt/render/project/src && export PYTHONPATH="${PYTHONPATH}:." && python3.11 -m gunicorn backend.app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --pythonpath .
```

**OU** (se `python3.11` não funcionar):

```bash
cd /opt/render/project/src && export PYTHONPATH="${PYTHONPATH}:." && gunicorn backend.app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --pythonpath .
```

### 5. Variáveis de Ambiente

| Key | Value |
|-----|-------|
| `PYTHON_VERSION` | `3.11.0` |
| `ENVIRONMENT` | `production` |
| `ALLOWED_ORIGINS` | `https://dashboard-rci.vercel.app,https://dashboard-rci.vercel.app/*` |

### 6. Health Check Path

```
/health
```

## Verificação

Após configurar, os logs devem mostrar:
- ✅ Python 3.11.x (não 3.13)
- ✅ `[INFO] Starting gunicorn`
- ✅ `[INFO] Listening at: http://0.0.0.0:XXXX`
- ❌ **NÃO** deve mostrar `python app.py`

## Por que isso é necessário?

- O Render pode não ler o `render.yaml` automaticamente
- O `runtime.txt` pode ser ignorado se o Python Version não estiver configurado manualmente
- Configurar manualmente garante que as configurações corretas sejam usadas

## Teste

Após o deploy, teste:
```
https://dashboard-zprci-1.onrender.com/health
```

Deve retornar:
```json
{"message": "Dashboard API - Backend funcionando"}
```
