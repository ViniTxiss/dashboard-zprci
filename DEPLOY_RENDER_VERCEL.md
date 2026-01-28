# Guia de Deploy - Render + Vercel

Este guia contém instruções passo a passo para fazer deploy do dashboard no Render (backend) e Vercel (frontend).

## 📋 Pré-requisitos

- Conta no Render (https://render.com) - Plano gratuito disponível
- Conta no Vercel (https://vercel.com) - Plano gratuito disponível
- Repositório GitHub com o código do projeto
- Arquivo `BASE_TRATADA_FINAL.xlsx` em `backend/data/`

## 🚀 Passo 1: Deploy do Backend no Render

### 1.1. Preparar Repositório

Certifique-se de que os seguintes arquivos estão no repositório:
- ✅ `render.yaml` ou `Procfile`
- ✅ `runtime.txt`
- ✅ `requirements.txt`
- ✅ `backend/app.py` e todos os arquivos do backend

### 1.2. Criar Serviço no Render

1. Acesse https://dashboard.render.com
2. Clique em **"New +"** → **"Web Service"**
3. Conecte seu repositório GitHub
4. Selecione o repositório do projeto
5. Configure o serviço:
   - **Name**: `dashboard-backend`
   - **Environment**: `Python 3`
   - **Python Version**: `3.11.0` (IMPORTANTE: Selecione manualmente na interface)
   - **Region**: Escolha a mais próxima (ex: `Oregon (US West)`)
   - **Branch**: `main` (ou `master`)
   - **Root Directory**: (deixe vazio)
   - **Build Command**: `python -m pip install --upgrade pip && pip install -r requirements.txt`
   - **Start Command**: `gunicorn backend.app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --pythonpath .`
   
   **⚠️ CRÍTICO**: 
   - O Start Command **NÃO deve conter** `cd backend` no início
   - Use `backend.app:app` (não `app:app`)
   - O Render pode usar Python 3.13 por padrão. Certifique-se de selecionar **Python 3.11.0** na seção "Python Version" ou "Environment" do dashboard do Render. O arquivo `runtime.txt` deve especificar `python-3.11.0`.

### 1.3. Configurar Variáveis de Ambiente

Na seção **"Environment Variables"**, adicione:

| Key | Value |
|-----|-------|
| `PYTHON_VERSION` | `3.11.0` |
| `ENVIRONMENT` | `production` |
| `ALLOWED_ORIGINS` | `https://seu-projeto.vercel.app` (atualize após deploy do frontend) |

**Nota**: A URL `ALLOWED_ORIGINS` será atualizada após fazer o deploy do frontend no Vercel.

### 1.4. Configurar Arquivo de Dados

O Render não permite upload direto de arquivos. Você tem 3 opções:

#### Opção A: Git LFS (Recomendado para arquivos grandes)

```bash
# Instalar Git LFS
git lfs install

# Adicionar arquivo ao LFS
git lfs track "backend/data/*.xlsx"
git add .gitattributes
git add backend/data/BASE_TRATADA_FINAL.xlsx
git commit -m "Adicionar arquivo de dados via LFS"
git push
```

#### Opção B: Storage Externo (S3, Google Cloud Storage, etc.)

1. Faça upload do arquivo para seu storage
2. Configure variáveis de ambiente no Render:
   - `AWS_ACCESS_KEY_ID` (se usar S3)
   - `AWS_SECRET_ACCESS_KEY`
   - `S3_BUCKET_NAME`
   - `DATA_FILE_URL` (URL pública do arquivo)
3. Modifique `backend/services/data_loader.py` para baixar do storage

#### Opção C: Variável de Ambiente Base64 (Não recomendado para arquivos grandes)

```bash
# Converter para base64
base64 -i backend/data/BASE_TRATADA_FINAL.xlsx > data_base64.txt

# Adicionar como variável de ambiente no Render
# Key: DATA_FILE_BASE64
# Value: (cole o conteúdo do data_base64.txt)
```

### 1.5. Criar Serviço

1. Clique em **"Create Web Service"**
2. Aguarde o build e deploy (pode levar 5-10 minutos)
3. Após o deploy, copie a URL do serviço (ex: `https://dashboard-backend.onrender.com`)

### 1.6. Verificar Deploy

1. Acesse `https://seu-backend.onrender.com/health`
2. Deve retornar: `{"status": "ok"}`
3. Acesse `https://seu-backend.onrender.com/docs` para ver a documentação da API

## 🌐 Passo 2: Deploy do Frontend no Vercel

### 2.1. Preparar Repositório

Certifique-se de que os seguintes arquivos estão no repositório:
- ✅ `vercel.json`
- ✅ `frontend/index.html` e todos os arquivos do frontend

### 2.2. Criar Projeto no Vercel

1. Acesse https://vercel.com/dashboard
2. Clique em **"Add New..."** → **"Project"**
3. Conecte seu repositório GitHub
4. Selecione o repositório do projeto
5. Configure o projeto:
   - **Framework Preset**: `Other`
   - **Root Directory**: `frontend`
   - **Build Command**: (deixe vazio - arquivos estáticos)
   - **Output Directory**: `.`
   - **Install Command**: (deixe vazio)

### 2.3. Configurar Variáveis de Ambiente

Na seção **"Environment Variables"**, adicione:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://seu-backend.onrender.com/api` (URL do Render) |

**Alternativa**: Você pode editar `frontend/index.html` e substituir manualmente a URL no script de configuração.

### 2.4. Deploy

1. Clique em **"Deploy"**
2. Aguarde o deploy (geralmente 1-2 minutos)
3. Após o deploy, copie a URL do projeto (ex: `https://seu-projeto.vercel.app`)

### 2.5. Atualizar URL da API no HTML (se necessário)

Se não usou variável de ambiente, edite `frontend/index.html` e atualize a linha no script:

```javascript
window.API_BASE_URL = 'https://seu-backend.onrender.com/api';
```

Faça commit e push. O Vercel fará redeploy automaticamente.

## 🔄 Passo 3: Atualizar CORS no Render

Após obter a URL do Vercel:

1. Volte ao Render Dashboard
2. Vá em **"Environment"** → **"Environment Variables"**
3. Atualize `ALLOWED_ORIGINS` com a URL completa do Vercel:
   ```
   https://seu-projeto.vercel.app
   ```
4. Salve as alterações
5. O Render fará redeploy automaticamente

**Importante**: Não inclua barra final (`/`) na URL.

## ✅ Passo 4: Verificação

### 4.1. Testar Frontend

1. Acesse a URL do Vercel
2. Abra o console do navegador (F12)
3. Verifique se não há erros de CORS
4. Verifique se os dados estão carregando

### 4.2. Testar Backend

1. Acesse `https://seu-backend.onrender.com/docs`
2. Teste alguns endpoints
3. Verifique os logs no Render Dashboard

### 4.3. Verificar CORS

No console do navegador, verifique se as requisições para a API estão funcionando:
- Abra a aba **Network**
- Recarregue a página
- Verifique se as requisições para `/api/...` retornam status 200

## 🔧 Configurações Adicionais

### Custom Domain (Opcional)

#### Render
1. Vá em **Settings** → **Custom Domains**
2. Adicione seu domínio
3. Configure DNS conforme instruções

#### Vercel
1. Vá em **Settings** → **Domains**
2. Adicione seu domínio
3. Configure DNS conforme instruções

### Variáveis de Ambiente Adicionais

#### Render (Backend)
- `LOG_LEVEL`: `info` (opcional)
- `MAX_WORKERS`: `4` (opcional, padrão)

#### Vercel (Frontend)
- `NODE_ENV`: `production` (automático)

## 🐛 Troubleshooting

### Erro: "Se `rewrites`, `redirects`, `headers`, `cleanUrls` or `trailingSlash` forem usados, então `routes` não pode estar presente"

**Causa**: O arquivo `vercel.json` contém tanto `routes` quanto `rewrites`/`headers`, o que não é permitido.

**Solução**:
1. Remova a seção `routes` do `vercel.json`
2. Mantenha apenas `rewrites` e `headers`
3. O `rewrites` já faz o trabalho do `routes` de forma mais moderna
4. Faça commit e push das alterações
5. O Vercel irá redeployar automaticamente

**Exemplo correto do `vercel.json`**:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "frontend/**",
      "use": "@vercel/static"
    }
  ],
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/frontend/$1"
    },
    {
      "source": "/",
      "destination": "/frontend/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot))",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

### Erro: "CORS policy: No 'Access-Control-Allow-Origin'"

**Causa**: URL do Vercel não está em `ALLOWED_ORIGINS`

**Solução**:
1. Verifique se `ALLOWED_ORIGINS` no Render contém a URL exata do Vercel
2. Certifique-se de que não há barra final na URL
3. Aguarde o redeploy do Render

### Erro: "Failed to fetch"

**Causa**: URL da API incorreta ou backend não está acessível

**Solução**:
1. Verifique se o backend está online no Render Dashboard
2. Teste a URL do backend diretamente: `https://seu-backend.onrender.com/health`
3. Verifique a URL configurada no frontend (console do navegador)

### Backend não inicia

**Causa**: Erro no código ou dependências

**Solução**:
1. Verifique os logs no Render Dashboard
2. Teste localmente: `cd backend && python app.py`
3. Verifique se todas as dependências estão no `requirements.txt`

### Frontend não carrega dados

**Causa**: URL da API incorreta ou CORS

**Solução**:
1. Abra o console do navegador (F12)
2. Verifique a URL sendo usada: `console.log(window.API_BASE_URL)`
3. Verifique erros de rede na aba Network
4. Teste a API diretamente no navegador

### Arquivo de dados não encontrado

**Causa**: Arquivo não foi enviado corretamente

**Solução**:
1. Verifique se o arquivo está no repositório (se usar Git LFS)
2. Verifique se o caminho está correto: `backend/data/BASE_TRATADA_FINAL.xlsx`
3. Se usar storage externo, verifique as credenciais

## 📊 Monitoramento

### Render

- **Logs**: Acesse o serviço → **"Logs"** para ver logs em tempo real
- **Metrics**: Acesse o serviço → **"Metrics"** para ver CPU, memória, etc.
- **Health Check**: Configure alertas para `/health`

### Vercel

- **Analytics**: Disponível no dashboard do Vercel
- **Logs**: Acesse o projeto → **"Deployments"** → **"Functions"** (se usar serverless)

## 💰 Custos

### Render (Plano Gratuito)
- ✅ 750 horas/mês de runtime
- ✅ Pode hibernar após 15 minutos de inatividade
- ✅ 512 MB RAM
- ⚠️ Primeira requisição após hibernação pode levar 30-60 segundos

### Vercel (Plano Gratuito)
- ✅ 100 GB bandwidth/mês
- ✅ Deploy ilimitado
- ✅ SSL automático
- ✅ CDN global

## 🔄 Atualizações

### Atualizar Backend

1. Faça alterações no código
2. Commit e push para GitHub
3. Render fará deploy automático
4. Aguarde alguns minutos

### Atualizar Frontend

1. Faça alterações no código
2. Commit e push para GitHub
3. Vercel fará deploy automático
4. Aguarde 1-2 minutos

## 📝 Checklist Final

- [ ] Backend deployado no Render
- [ ] Frontend deployado no Vercel
- [ ] CORS configurado corretamente
- [ ] URL da API configurada no frontend
- [ ] Arquivo de dados acessível
- [ ] Health check funcionando
- [ ] Dados carregando no frontend
- [ ] Sem erros no console do navegador
- [ ] Testado em diferentes navegadores

## 📞 Suporte

- **Render**: https://render.com/docs
- **Vercel**: https://vercel.com/docs
- **FastAPI**: https://fastapi.tiangolo.com/

---

**Última atualização**: 2025
