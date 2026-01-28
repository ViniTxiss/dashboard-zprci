# Política de Segurança

Este documento descreve as medidas de segurança implementadas no Dashboard Zappa e boas práticas para manter o sistema seguro.

## 🔒 Medidas de Segurança Implementadas

### 1. Autenticação de API

- **API Key**: Todas as rotas da API (exceto `/health` e `/docs`) requerem autenticação via header `X-API-Key`
- **Middleware**: Autenticação implementada via middleware do FastAPI
- **Rotas Públicas**: Apenas endpoints de health check e documentação são públicos

### 2. Proteção de Dados Sensíveis

- **Arquivos Excel**: Não são commitados no Git (`.gitignore`)
- **Storage Privado**: Suporte para armazenar arquivos em S3 privado
- **Variáveis de Ambiente**: Credenciais e chaves armazenadas apenas em variáveis de ambiente

### 3. CORS (Cross-Origin Resource Sharing)

- **Restrito**: Apenas domínios específicos podem fazer requisições
- **Configurável**: Via variável de ambiente `ALLOWED_ORIGINS`
- **Produção**: Apenas domínio do Vercel permitido

### 4. HTTPS

- **Obrigatório**: Render e Vercel fornecem SSL/TLS automaticamente
- **Redirecionamento**: HTTP é redirecionado para HTTPS

### 5. Validação de Dados

- **Input Validation**: Todas as entradas são validadas
- **Sanitização**: Dados são sanitizados antes de retornar
- **Type Checking**: Validação de tipos em todas as rotas

## 📋 Checklist de Segurança para Deploy

- [ ] API Key configurada no Render (backend)
- [ ] API Key configurada no Vercel (frontend) - mesma chave do backend
- [ ] `ALLOWED_ORIGINS` configurado com URL do Vercel
- [ ] Arquivos Excel NÃO estão no repositório Git
- [ ] Variáveis de ambiente configuradas (não hardcoded)
- [ ] Storage S3 configurado com acesso restrito (se usar)
- [ ] Credenciais AWS com permissões mínimas (se usar S3)
- [ ] HTTPS habilitado (automático no Render/Vercel)

## 🔑 Gerenciamento de API Keys

### Gerar uma API Key Segura

```bash
# Linux/Mac
openssl rand -hex 32

# Windows (PowerShell)
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

### Configurar no Render

1. Acesse o dashboard do Render
2. Vá em **Environment** → **Environment Variables**
3. Adicione: `API_KEY` = `sua-chave-gerada`

### Configurar no Vercel

1. Acesse o dashboard do Vercel
2. Vá em **Settings** → **Environment Variables**
3. Adicione: `NEXT_PUBLIC_API_KEY` = `mesma-chave-do-render`

## 📁 Proteção de Arquivos Excel

### Opção 1: Storage Privado (Recomendado)

1. Crie um bucket S3 privado
2. Configure credenciais AWS no Render:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `S3_BUCKET_NAME`
   - `AWS_REGION`
3. Faça upload dos arquivos Excel para o S3
4. O backend baixará automaticamente no startup

### Opção 2: Upload Manual

1. Faça deploy inicial sem arquivos
2. Conecte via SSH ao Render
3. Faça upload dos arquivos para `backend/data/`
4. Reinicie o serviço

**⚠️ IMPORTANTE**: Arquivos Excel contêm dados sensíveis. Nunca os commite no Git.

## 🛡️ Boas Práticas

### Desenvolvimento

1. Use `.env` local (não commitar)
2. API Key opcional em desenvolvimento (backend permite acesso sem key)
3. Teste autenticação antes de fazer deploy

### Produção

1. **Sempre** configure API Key em produção
2. Use chaves diferentes para dev e prod
3. Rotacione chaves periodicamente (a cada 90 dias)
4. Monitore logs de acesso
5. Configure alertas para tentativas de acesso não autorizado

## 🚨 Em Caso de Comprometimento

1. **Rotacione API Keys imediatamente**
2. Revise logs de acesso
3. Verifique integridade dos dados
4. Notifique usuários se necessário
5. Documente o incidente

## 📞 Suporte

Para questões de segurança, entre em contato com a equipe de desenvolvimento.

---

**Última atualização**: 2025
