# Guia de Deploy - Dashboard Web

Este guia contém instruções para fazer o deploy do dashboard em produção.

## 📋 Pré-requisitos

- Python 3.11 ou superior
- pip (gerenciador de pacotes Python)
- Servidor web (Nginx, Apache, ou similar) para servir o frontend
- Acesso ao servidor de produção

## 🚀 Deploy do Backend

### 1. Preparar Ambiente

```bash
# Criar ambiente virtual
python -m venv venv

# Ativar ambiente virtual
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Instalar dependências
pip install -r requirements.txt
```

### 2. Configurar Dados

Coloque o arquivo `BASE_TRATADA_FINAL.xlsx` em `backend/data/`.

**Importante**: O arquivo de dados não deve ser commitado no repositório (já está no .gitignore).

### 3. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto (opcional, para configurações avançadas):

```env
# Porta do backend (padrão: 8001)
BACKEND_PORT=8001

# Host do backend (padrão: 0.0.0.0)
BACKEND_HOST=0.0.0.0

# Ambiente (development/production)
ENVIRONMENT=production

# CORS - URLs permitidas (separadas por vírgula)
ALLOWED_ORIGINS=http://localhost:8080,https://seu-dominio.com
```

### 4. Executar Backend

#### Opção A: Usando uvicorn diretamente

```bash
cd backend
uvicorn app:app --host 0.0.0.0 --port 8001 --workers 4
```

#### Opção B: Usando gunicorn (recomendado para produção)

```bash
# Instalar gunicorn
pip install gunicorn

# Executar com gunicorn
cd backend
gunicorn app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8001
```

#### Opção C: Usando systemd (Linux)

Crie o arquivo `/etc/systemd/system/dashboard-backend.service`:

```ini
[Unit]
Description=Dashboard Backend Service
After=network.target

[Service]
Type=simple
User=seu-usuario
WorkingDirectory=/caminho/para/projeto/backend
Environment="PATH=/caminho/para/venv/bin"
ExecStart=/caminho/para/venv/bin/gunicorn app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8001
Restart=always

[Install]
WantedBy=multi-user.target
```

Ativar serviço:

```bash
sudo systemctl enable dashboard-backend
sudo systemctl start dashboard-backend
sudo systemctl status dashboard-backend
```

### 5. Configurar Nginx como Proxy Reverso (Opcional)

Crie o arquivo `/etc/nginx/sites-available/dashboard-backend`:

```nginx
server {
    listen 80;
    server_name api.seu-dominio.com;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ativar configuração:

```bash
sudo ln -s /etc/nginx/sites-available/dashboard-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🌐 Deploy do Frontend

### 1. Preparar Arquivos

Os arquivos do frontend já estão prontos. Apenas certifique-se de que:

- O arquivo `frontend/js/api.js` está configurado com a URL correta do backend
- Todas as imagens e assets estão no lugar correto

### 2. Configurar URL da API

Edite `frontend/js/api.js` e atualize a URL base:

```javascript
const API_BASE_URL = 'https://api.seu-dominio.com'; // ou 'http://localhost:8001' para desenvolvimento
```

### 3. Servir Frontend

#### Opção A: Nginx (Recomendado)

Crie o arquivo `/etc/nginx/sites-available/dashboard-frontend`:

```nginx
server {
    listen 80;
    server_name seu-dominio.com;
    root /caminho/para/projeto/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache para assets estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API proxy (opcional, se quiser servir pelo mesmo domínio)
    location /api {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ativar configuração:

```bash
sudo ln -s /etc/nginx/sites-available/dashboard-frontend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Opção B: Apache

Crie o arquivo `/etc/apache2/sites-available/dashboard-frontend.conf`:

```apache
<VirtualHost *:80>
    ServerName seu-dominio.com
    DocumentRoot /caminho/para/projeto/frontend

    <Directory /caminho/para/projeto/frontend>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # Rewrite para SPA
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</VirtualHost>
```

Ativar configuração:

```bash
sudo a2ensite dashboard-frontend
sudo systemctl reload apache2
```

#### Opção C: Servidor HTTP Simples (Apenas para testes)

```bash
cd frontend
python -m http.server 8080
```

## 🔒 Segurança

### 1. Configurar CORS no Backend

Edite `backend/app.py` e configure CORS para produção:

```python
# Substituir allow_origins=["*"] por:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://seu-dominio.com", "https://www.seu-dominio.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
```

### 2. HTTPS

Configure SSL/TLS usando Let's Encrypt:

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d seu-dominio.com
```

### 3. Firewall

Configure o firewall para permitir apenas as portas necessárias:

```bash
# Permitir HTTP e HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Permitir porta do backend apenas localmente (se usar proxy)
sudo ufw allow from 127.0.0.1 to any port 8001
```

## 📊 Monitoramento

### 1. Logs do Backend

Os logs do backend são exibidos no console. Para produção, redirecione para arquivo:

```bash
gunicorn app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8001 --access-logfile - --error-logfile -
```

### 2. Health Check

O backend expõe um endpoint de health check:

```
GET http://localhost:8001/health
```

Configure seu monitoramento para verificar este endpoint.

## 🔄 Atualizações

### Atualizar Backend

```bash
# Parar serviço
sudo systemctl stop dashboard-backend

# Atualizar código
git pull

# Atualizar dependências (se necessário)
pip install -r requirements.txt --upgrade

# Reiniciar serviço
sudo systemctl start dashboard-backend
```

### Atualizar Frontend

```bash
# Atualizar código
git pull

# Reiniciar servidor web
sudo systemctl reload nginx  # ou apache2
```

## 🐛 Troubleshooting

### Backend não inicia

1. Verifique se a porta 8001 está livre: `netstat -tulpn | grep 8001`
2. Verifique os logs: `journalctl -u dashboard-backend -f`
3. Verifique se o arquivo de dados existe em `backend/data/`

### Frontend não carrega dados

1. Verifique se o backend está acessível
2. Abra o console do navegador (F12) e verifique erros
3. Verifique a URL da API em `frontend/js/api.js`
4. Verifique CORS no backend

### Performance

1. Use gunicorn com múltiplos workers
2. Configure cache no Nginx para assets estáticos
3. Use CDN para bibliotecas JavaScript (Chart.js, Leaflet.js)

## 📝 Checklist de Deploy

- [ ] Ambiente virtual criado e ativado
- [ ] Dependências instaladas (`pip install -r requirements.txt`)
- [ ] Arquivo de dados (`BASE_TRATADA_FINAL.xlsx`) colocado em `backend/data/`
- [ ] Backend configurado e testado localmente
- [ ] CORS configurado para produção
- [ ] Frontend configurado com URL correta da API
- [ ] Servidor web configurado (Nginx/Apache)
- [ ] SSL/HTTPS configurado
- [ ] Firewall configurado
- [ ] Monitoramento configurado
- [ ] Logs configurados
- [ ] Backup do arquivo de dados configurado

## 📞 Suporte

Em caso de problemas, verifique:
- Logs do backend
- Logs do servidor web
- Console do navegador (F12)
- Documentação do FastAPI: https://fastapi.tiangolo.com/
