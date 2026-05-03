# 🤖 Discord Server Cloner Bot

Bot Discord profissional para clonar estrutura de servidores via comandos de prefixo.
Desenvolvido para produção com Docker, Railway e GitHub.

---

## 📦 Funcionalidades

- `!clone <invite>` — Clona cargos, categorias e canais de outro servidor
- `!snapshot` — Cria um backup completo da estrutura atual do servidor
- `!restore <id>` — Restaura a estrutura a partir de um snapshot
- `!template <link>` — Aplica um template oficial do Discord
- `!ping` — Verifica a latência do bot
- `!info` — Informações do bot
- `!help` — Lista todos os comandos

---

## 🗂️ Estrutura do Projeto

```
discord-bot/
├── src/
│   ├── commands/         # Comandos de prefixo (um arquivo por comando)
│   ├── events/           # Eventos do Discord
│   ├── handlers/         # Carregadores de comandos e eventos
│   ├── services/         # Lógica de clonagem e templates
│   ├── utils/            # Logger, cooldown, anti-spam, sanitização
│   ├── config/           # Configurações centralizadas
│   ├── database/         # SQLite com better-sqlite3
│   └── index.js          # Ponto de entrada
├── data/                 # Banco de dados SQLite (criado automaticamente)
├── logs/                 # Logs do sistema (criados automaticamente)
├── Dockerfile
├── .dockerignore
├── .env.example
├── railway.json
└── package.json
```

---

## 🚀 Instalação e Configuração

### 1. Pré-requisitos

- Node.js 18+ 
- npm ou Docker

### 2. Configurar variáveis de ambiente

Copie o arquivo de exemplo e preencha:

```bash
cp .env.example .env
```

Edite o `.env`:

```env
DISCORD_TOKEN=seu_token_aqui
DISCORD_CLIENT_ID=seu_client_id_aqui
BOT_PREFIX=!
BOT_OWNER_ID=seu_discord_id_aqui
LOG_LEVEL=info
DATABASE_PATH=./data/bot.db
NODE_ENV=production
```

### 3. Instalar dependências

```bash
npm install
```

### 4. Executar localmente

```bash
npm start
# ou em desenvolvimento:
npm run dev
```

---

## 🔑 Como obter o Token do Discord

1. Acesse o [Discord Developer Portal](https://discord.com/developers/applications)
2. Clique em **New Application** → dê um nome ao bot
3. Vá em **Bot** → **Add Bot**
4. Em **Privileged Gateway Intents**, ative:
   - ✅ PRESENCE INTENT
   - ✅ SERVER MEMBERS INTENT
   - ✅ MESSAGE CONTENT INTENT
5. Clique em **Reset Token** → copie o token → cole no `.env`

### Convidar o bot para o servidor

Vá em **OAuth2 → URL Generator**:
- Scopes: `bot`
- Permissions: `Administrator` (necessário para clonar)

---

## 🐳 Docker

### Build e execução local

```bash
# Build da imagem
docker build -t discord-cloner .

# Executar
docker run -d \
  --name discord-cloner \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  discord-cloner
```

### Ver logs do container

```bash
docker logs -f discord-cloner
```

---

## 🚂 Deploy no Railway

### Passo a passo

1. **Criar conta** em [railway.app](https://railway.app)

2. **Novo projeto** → *Deploy from GitHub repo*

3. **Configurar variáveis de ambiente** no painel Railway:
   ```
   DISCORD_TOKEN=seu_token
   DISCORD_CLIENT_ID=seu_client_id
   BOT_PREFIX=!
   BOT_OWNER_ID=seu_id
   LOG_LEVEL=info
   NODE_ENV=production
   ```
   > ⚠️ Para SQLite no Railway, use volume persistente ou mude para PostgreSQL.

4. Railway detecta o `railway.json` e `Dockerfile` automaticamente.

5. Clique em **Deploy** — o bot vai online!

### Dica: Volume persistente (Railway)

Para manter o banco de dados entre deploys:
1. No Railway, vá em *Settings → Volumes*
2. Monte em `/app/data`
3. Ajuste `DATABASE_PATH=/app/data/bot.db`

---

## 📂 GitHub — Versionamento

```bash
# Inicializar repositório
git init
git add .
git commit -m "feat: discord server cloner bot v1.0"

# Conectar ao GitHub
git remote add origin https://github.com/seu-usuario/discord-cloner.git
git push -u origin main
```

### Integração Railway + GitHub

Railway pode fazer deploy automático a cada push na branch `main`. Ative em:
**Railway → Settings → Source → Auto Deploy**

---

## ☁️ Replit

### Executar no Replit

1. Crie um **Repl** do tipo Node.js
2. Faça upload dos arquivos ou conecte via GitHub
3. Configure os **Secrets** do Replit (canto lateral → 🔒):
   ```
   DISCORD_TOKEN = seu_token
   BOT_PREFIX = !
   BOT_OWNER_ID = seu_id
   ```
4. No arquivo `.replit`, configure:
   ```
   run = "node src/index.js"
   ```
5. Use **UptimeRobot** para manter o Repl ativo 24/7

---

## 🔐 Segurança

| Recurso | Implementação |
|--------|---------------|
| Token por env | `process.env.DISCORD_TOKEN` |
| Anti-spam | 5 msgs/5s → mute 30s |
| Cooldown por comando | Configurável por comando |
| Validação de permissões | Admin only para clone/restore |
| Sanitização de inputs | Remoção de caracteres perigosos |
| Tratamento global de erros | `uncaughtException` + `unhandledRejection` |
| Shutdown gracioso | `SIGTERM` + `SIGINT` handlers |
| Logs estruturados | Winston com rotação de arquivos |

---

## ⚙️ Adicionando Novos Comandos

Crie um arquivo em `src/commands/meucomando.js`:

```js
module.exports = {
  name: 'meucomando',
  aliases: ['mc'],
  cooldown: 5,
  description: 'Descrição do comando.',
  usage: '<argumento>',

  async execute(message, args, client) {
    message.reply('Olá!');
  },
};
```

O handler carrega automaticamente todos os arquivos da pasta `commands/`.

---

## 🐛 Solução de Erros Comuns

### `Error: Used disallowed intents`
→ Ative os **Privileged Intents** no Developer Portal (Presence, Members, Message Content)

### `Missing Permissions`
→ O bot precisa de **Administrador** para clonar. Verifique as permissões no servidor.

### `Invalid Token`
→ Verifique se `DISCORD_TOKEN` está correto no `.env` ou nas variáveis do Railway.

### Bot clona apenas nome e ícone
→ O bot precisa **estar no servidor de origem** para fazer clonagem completa. Adicione-o ao servidor fonte com permissão de Administrador.

### Banco de dados perdido após redeploy
→ Configure um **volume persistente** no Railway montado em `/app/data`.

### `SQLITE_CANTOPEN`
→ Verifique se a pasta `data/` existe e tem permissão de escrita.

---

## 📋 Checklist de Segurança

- [ ] Token NUNCA está no código-fonte
- [ ] `.env` está no `.gitignore`
- [ ] Bot usa permissão mínima necessária
- [ ] Anti-spam ativo
- [ ] Cooldowns configurados
- [ ] Logs sendo monitorados
- [ ] Volumes persistentes configurados em produção
- [ ] `NODE_ENV=production` definido

---

## 📄 Licença

MIT — Uso livre para fins educacionais e pessoais.
