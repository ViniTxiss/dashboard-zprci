# Guia de Deploy - Backend no Render

Este guia contém instruções passo a passo para fazer deploy do backend no Render.

## 📋 Pré-requisitos

- Conta no Render (https://render.com) - Plano gratuito disponível
- Repositório GitHub com o código do projeto
- Arquivo `DADOS_NOVOS_CASOS.xlsx` em `backend/data/`

## 🚀 Passo 1: Preparar Repositório

Certifique-se de que os seguintes arquivos estão no repositório:
- ✅ `render.yaml` ou `Procfile`
- ✅ `runtime.txt`
- ✅ `requirements.txt`
- ✅ `backend/app.py` e todos os arquivos do backend

## 🚀 Passo 2: Criar Serviço Web no Render

### 2.1. Acessar Dashboard do Render

1. Acesse https://dashboard.render.com
2. Faça login na sua conta

### 2.2. Criar Novo Web Service

1. Clique em **"New +"** → **"Web Service"**
2. Conecte seu repositório GitHub
3. Selecione o repositório do projeto

### 2.3. Configurar o Serviço

**Configurações Básicas:**
- **Name**: `dashboard-backend` (ou o nome que preferir)
- **Environment**: `Python 3`
- **Region**: Escolha a mais próxima (ex: `Oregon (US West)`)
- **Branch**: `main` (ou `master`)

**Configurações de Build:**
- **Build Command**: `python -m pip install --upgrade pip && pip install -r requirements.txt`
- **Start Command**: `gunicorn backend.app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --pythonpath .`

**⚠️ IMPORTANTE:**
- O Start Command **NÃO deve conter** `cd backend` no início
- Use `backend.app:app` (não `app:app`)
- O Render pode usar Python 3.13 por padrão. Certifique-se de selecionar **Python 3.11.0** na seção "Python Version" ou "Environment" do dashboard do Render.

### 2.4. Configurar Variáveis de Ambiente

Na seção **"Environment Variables"**, adicione:

| Key | Value |
|-----|-------|
| `PYTHON_VERSION` | `3.11.0` |
| `ENVIRONMENT` | `production` |
| `ALLOWED_ORIGINS` | `https://dashboard-rci.vercel.app,https://dashboard-rci.vercel.app/*` |

**Nota:** Se você estiver usando autenticação por API Key, adicione também:
| Key | Value |
|-----|-------|
| `API_KEY` | `sua-chave-secreta-aqui` |

### 2.5. Configurar Health Check

Na seção **"Health Check Path"**, configure:
- **Health Check Path**: `/health`

### 2.6. Deploy

1. Clique em **"Create Web Service"**
2. O Render começará a fazer o build e deploy automaticamente
3. Aguarde o processo concluir (pode levar alguns minutos)

## 🔍 Passo 3: Verificar Deploy

### 3.1. Verificar Status

1. No dashboard do Render, verifique se o serviço está **"Live"** (verde)
2. Clique no serviço para ver os logs

### 3.2. Testar Endpoint de Health

Abra no navegador ou use curl:
```bash
curl https://seu-servico.onrender.com/health
```

Deve retornar:
```json
{"message":"Dashboard API - Backend funcionando"}
```

### 3.3. Testar Endpoint da API

```bash
curl https://seu-servico.onrender.com/api/indicadores/kpis-finais
```

## 🔧 Passo 4: Configurar Frontend (Vercel)

O frontend já está configurado para usar o backend do Render quando estiver em produção na Vercel.

O arquivo `frontend/js/api.js` detecta automaticamente:
- Se está na Vercel → usa `https://dashboard-zprci-1.onrender.com/api`
- Se está em localhost → usa `http://localhost:8001/api`

## 🐛 Troubleshooting

### Erro: "Module not found"

**Causa:** O Python path não está configurado corretamente.

**Solução:** Verifique se o Start Command está usando `--pythonpath .`:
```
gunicorn backend.app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --pythonpath .
```

### Erro: "Port already in use"

**Causa:** O Render define a porta via variável de ambiente `$PORT`.

**Solução:** Certifique-se de que o Start Command usa `$PORT`:
```
--bind 0.0.0.0:$PORT
```

### Erro: CORS bloqueando requisições

**Causa:** O CORS não está configurado para permitir o domínio do frontend.

**Solução:** Verifique se a variável de ambiente `ALLOWED_ORIGINS` está configurada corretamente:
```
https://dashboard-rci.vercel.app,https://dashboard-rci.vercel.app/*
```

### Erro: "File not found" para arquivos Excel

**Causa:** Os arquivos de dados não estão no repositório ou não foram commitados.

**Solução:** 
1. Certifique-se de que `backend/data/DADOS_NOVOS_CASOS.xlsx` está no repositório
2. Se o arquivo for muito grande, considere usar storage externo (S3) e configurar `storage_loader.py`

### Serviço fica "Sleeping" após inatividade

**Causa:** No plano gratuito do Render, serviços ficam inativos após 15 minutos sem requisições.

**Solução:**
- A primeira requisição após o "sleep" pode levar alguns segundos para "acordar" o serviço
- Considere usar um serviço de "ping" periódico para manter o serviço ativo
- Ou faça upgrade para um plano pago

## 📝 Notas Importantes

1. **Plano Gratuito:** O Render oferece um plano gratuito, mas serviços podem ficar inativos após 15 minutos sem uso.

2. **Build Time:** O primeiro build pode levar 5-10 minutos. Builds subsequentes são mais rápidos devido ao cache.

3. **Logs:** Você pode ver os logs em tempo real no dashboard do Render. Isso é útil para debug.

4. **Variáveis de Ambiente:** Nunca commite chaves secretas no código. Use sempre variáveis de ambiente no Render.

5. **Health Check:** O endpoint `/health` é usado pelo Render para verificar se o serviço está funcionando.

## ✅ Checklist Final

- [ ] Serviço criado no Render
- [ ] Variáveis de ambiente configuradas
- [ ] Build concluído com sucesso
- [ ] Health check retornando 200 OK
- [ ] Endpoint `/api/indicadores/kpis-finais` funcionando
- [ ] Frontend na Vercel conectando ao backend do Render
- [ ] CORS configurado corretamente

## 🎉 Pronto!

Seu backend está rodando no Render e o frontend na Vercel está configurado para usá-lo!
