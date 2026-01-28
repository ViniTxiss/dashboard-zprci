# Guia de Deploy Seguro - Dashboard Zappa

Este guia fornece instruções passo a passo para fazer deploy seguro do dashboard com proteção de dados sensíveis.

## 📋 Pré-requisitos

- Conta no Render (backend)
- Conta no Vercel (frontend)
- Conta AWS (opcional, para S3)
- Repositório GitHub com código

## 🔐 Passo 1: Configurar Segurança no Backend (Render)

### 1.1. Gerar API Key Segura

```bash
# Linux/Mac
openssl rand -hex 32

# Windows PowerShell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

**Anote esta chave** - você precisará dela no frontend também.

### 1.2. Configurar Variáveis de Ambiente no Render

1. Acesse https://dashboard.render.com
2. Vá para seu serviço → **Environment** → **Environment Variables**
3. Adicione as seguintes variáveis:

| Key | Value | Descrição |
|-----|-------|-----------|
| `PYTHON_VERSION` | `3.11.0` | Versão do Python |
| `ENVIRONMENT` | `production` | Ambiente de produção |
| `API_KEY` | `sua-chave-gerada` | Chave de autenticação (use a gerada acima) |
| `ALLOWED_ORIGINS` | `https://seu-projeto.vercel.app` | URL do frontend (atualize após deploy) |

### 1.3. Configurar Storage S3 (Opcional mas Recomendado)

Se você quiser manter arquivos Excel em S3 privado:

#### 1.3.1. Criar Bucket S3

1. Acesse AWS Console → S3
2. Crie um bucket privado (ex: `dashboard-zappa-dados`)
3. Desabilite acesso público
4. Configure política de bucket para acesso restrito

#### 1.3.2. Criar IAM User

1. Acesse AWS Console → IAM
2. Crie um novo usuário (ex: `dashboard-zappa-s3-access`)
3. Anexe política com permissões mínimas:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::seu-bucket-name/*",
        "arn:aws:s3:::seu-bucket-name"
      ]
    }
  ]
}
```

4. Crie Access Key e Secret Key

#### 1.3.3. Configurar Variáveis no Render

Adicione no Render:

| Key | Value |
|-----|-------|
| `AWS_ACCESS_KEY_ID` | `sua-access-key` |
| `AWS_SECRET_ACCESS_KEY` | `sua-secret-key` |
| `S3_BUCKET_NAME` | `seu-bucket-name` |
| `AWS_REGION` | `us-east-1` |

#### 1.3.4. Fazer Upload dos Arquivos Excel

```bash
# Via AWS CLI
aws s3 cp "backend/data/Material Casos Críticos - RCI - 2025 - Base completa.xlsx" \
  s3://seu-bucket-name/data/

aws s3 cp "backend/data/novos casos .xlsx" \
  s3://seu-bucket-name/data/
```

Ou use o AWS Console para fazer upload manual.

### 1.4. Instalar Dependência boto3 (se usar S3)

Adicione ao `requirements.txt`:

```
boto3==1.34.0
```

### 1.5. Fazer Deploy do Backend

1. Faça commit e push do código
2. O Render fará deploy automaticamente
3. Verifique logs para confirmar que arquivos foram baixados do S3 (se configurado)

## 🌐 Passo 2: Configurar Segurança no Frontend (Vercel)

### 2.1. Configurar Variáveis de Ambiente no Vercel

1. Acesse https://vercel.com/dashboard
2. Vá para seu projeto → **Settings** → **Environment Variables**
3. Adicione:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | `https://seu-backend.onrender.com/api` |
| `NEXT_PUBLIC_API_KEY` | `mesma-chave-do-render` |

**⚠️ IMPORTANTE**: Use a **mesma** API Key do backend.

### 2.2. Fazer Deploy do Frontend

1. Faça commit e push do código
2. O Vercel fará deploy automaticamente
3. Copie a URL do projeto (ex: `https://seu-projeto.vercel.app`)

### 2.3. Atualizar CORS no Render

1. Volte ao Render Dashboard
2. Atualize `ALLOWED_ORIGINS` com a URL do Vercel:
   ```
   https://seu-projeto.vercel.app
   ```
3. Salve e aguarde redeploy

## ✅ Passo 3: Verificação de Segurança

### 3.1. Testar Autenticação

```bash
# Teste sem API Key (deve falhar)
curl https://seu-backend.onrender.com/api/entradas/por-objeto

# Teste com API Key (deve funcionar)
curl -H "X-API-Key: sua-chave" \
  https://seu-backend.onrender.com/api/entradas/por-objeto
```

### 3.2. Verificar Frontend

1. Acesse a URL do Vercel
2. Abra o console do navegador (F12)
3. Verifique se não há erros de autenticação
4. Verifique se os dados estão carregando

### 3.3. Verificar Logs

- **Render**: Verifique logs para confirmar que autenticação está funcionando
- **Vercel**: Verifique se não há erros de rede

## 🔄 Atualizar Arquivos Excel

### Se usar S3:

1. Faça upload do novo arquivo para S3
2. Reinicie o serviço no Render (ou aguarde próximo deploy)
3. O backend baixará automaticamente

### Se usar upload manual:

1. Conecte via SSH ao Render
2. Faça upload do arquivo para `backend/data/`
3. Reinicie o serviço

## 🚨 Troubleshooting

### Erro: "API Key não fornecida"

**Causa**: Frontend não está enviando API Key

**Solução**:
1. Verifique se `NEXT_PUBLIC_API_KEY` está configurada no Vercel
2. Verifique se o frontend está usando a variável corretamente
3. Verifique console do navegador para erros

### Erro: "API Key inválida"

**Causa**: API Keys diferentes no frontend e backend

**Solução**:
1. Verifique se ambas as chaves são idênticas
2. Verifique se não há espaços extras
3. Reconfigure se necessário

### Erro: "CORS policy"

**Causa**: URL do Vercel não está em `ALLOWED_ORIGINS`

**Solução**:
1. Verifique URL exata do Vercel (sem barra final)
2. Atualize `ALLOWED_ORIGINS` no Render
3. Aguarde redeploy

### Arquivos não baixam do S3

**Causa**: Credenciais ou configuração incorreta

**Solução**:
1. Verifique credenciais AWS no Render
2. Verifique nome do bucket
3. Verifique permissões do IAM user
4. Verifique logs do Render para erros específicos

## 📊 Monitoramento

### Logs de Acesso

- **Render**: Dashboard → Logs (veja tentativas de acesso)
- Configure alertas para múltiplas falhas de autenticação

### Métricas

- Monitore número de requisições
- Configure alertas para picos anômalos
- Monitore uso de recursos

## 🔄 Rotação de Chaves

### Quando Rotacionar

- A cada 90 dias (recomendado)
- Após qualquer suspeita de comprometimento
- Quando funcionário com acesso sai da empresa

### Como Rotacionar

1. Gere nova API Key
2. Atualize no Render (backend)
3. Atualize no Vercel (frontend)
4. Teste funcionamento
5. Remova chave antiga após confirmação

## 📝 Checklist Final

- [ ] API Key gerada e configurada
- [ ] Backend deployado no Render com autenticação
- [ ] Frontend deployado no Vercel com API Key
- [ ] CORS configurado corretamente
- [ ] Arquivos Excel em storage seguro (S3 ou upload manual)
- [ ] Testes de autenticação passando
- [ ] Logs sendo monitorados
- [ ] Documentação atualizada

---

**Última atualização**: 2025
