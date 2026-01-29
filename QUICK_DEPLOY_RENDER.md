# Deploy Rápido - Backend no Render

## 🚀 Passos Rápidos

### 1. Criar Serviço no Render

1. Acesse https://dashboard.render.com
2. Clique em **"New +"** → **"Web Service"**
3. Conecte seu repositório GitHub
4. Selecione o repositório do projeto

### 2. Configurar Serviço

**Nome:** `dashboard-backend`

**Build Command:**
```
python -m pip install --upgrade pip && pip install -r requirements.txt
```

**Start Command:**
```
gunicorn backend.app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --pythonpath .
```

**Python Version:** `3.11.0` (selecione manualmente)

### 3. Variáveis de Ambiente

Adicione estas variáveis na seção "Environment Variables":

| Key | Value |
|-----|-------|
| `PYTHON_VERSION` | `3.11.0` |
| `ENVIRONMENT` | `production` |
| `ALLOWED_ORIGINS` | `https://dashboard-rci.vercel.app,https://dashboard-rci.vercel.app/*` |

### 4. Health Check

Configure o **Health Check Path** como: `/health`

### 5. Deploy

Clique em **"Create Web Service"** e aguarde o build concluir.

## ✅ Verificação

Após o deploy, teste:
```
https://seu-servico.onrender.com/health
```

Deve retornar:
```json
{"message":"Dashboard API - Backend funcionando"}
```

## 📝 Notas

- O frontend na Vercel já está configurado para usar o backend do Render
- No plano gratuito, o serviço pode "dormir" após 15 minutos de inatividade
- A primeira requisição após dormir pode levar alguns segundos
