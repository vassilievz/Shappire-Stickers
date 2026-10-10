# Shappire API

Backend do Shappire Stickers. Gerencia perfis de usuário (nome, username, bio, avatar e banner) no MongoDB e hospeda imagens de perfil no [V0X](https://docs.v0x.lol) — o banco guarda apenas metadados, nunca binário.

## Arquitetura

```
apps/app (Android) ── Firebase ID token ──> apps/api (esta API)
                                               ├── MongoDB (perfil + metadados de imagem)
                                               └── V0X (arquivos → URL pública no CDN)
```

- **Autenticação:** Firebase Auth. O app envia `Authorization: Bearer <FIREBASE_ID_TOKEN>`; a API valida com o Admin SDK (`verifyIdToken`). A identidade vem sempre do token — uid/email enviados pelo cliente são ignorados.
- **Perfil:** MongoDB via Mongoose (modelo `User`). Username é único, normalizado (minúsculo, sem acentos, `a-z0-9_`, 3–20 caracteres).
- **Imagens:** upload multipart → validação de tamanho e magic bytes → V0X → URL pública → o MongoDB persiste apenas `{ fileId, url, mimeType }`.

## Requisitos

- Node.js 20+
- MongoDB (local ou Atlas) — a URI precisa terminar com o nome do banco (`.../shappirestickers`)
- Conta de serviço do Firebase (Admin SDK)
- Chave de API do V0X

## Instalação

Na raiz do monorepo:

```bash
npm install
```

## Configuração

Copie `.env.example` para `.env` e preencha:

| Variável | Descrição |
| --- | --- |
| `PORT` | Porta HTTP (padrão `8080`) |
| `MONGODB_URI` | URI do MongoDB terminando com o nome do banco, ex.: `mongodb+srv://USUARIO:SENHA@cluster.mongodb.net/shappirestickers?retryWrites=true&w=majority` |
| `V0X_API` | Chave secreta do V0X — **somente no backend, nunca no app/APK/Git** |
| `FIREBASE_PROJECT_ID` | ID do projeto Firebase |
| `FIREBASE_CLIENT_EMAIL` | Email da conta de serviço |
| `FIREBASE_PRIVATE_KEY` | Chave privada da conta de serviço (`\n` escapados funcionam) |
| `CORS_ORIGIN` | Origens permitidas separadas por vírgula. Obrigatória em produção e nunca `*`. O WebView do Capacitor Android usa `https://localhost` |
| `NODE_ENV` | `development` ou `production` |
| `TRUST_PROXY` | `true` quando atrás de proxy reverso (para rate limit por IP real) |

Segredos ficam apenas em `apps/api/.env` (ignorado pelo Git). O `.env.example` documenta o formato sem valores reais.

## Rodar

```bash
npm run dev -w apps/api   # desenvolvimento (reload a cada alteração)
npm start -w apps/api     # produção
```

A inicialização falha rápido (fail-fast) se alguma variável obrigatória estiver ausente ou se a `MONGODB_URI` não tiver nome de banco explícito.

## Deploy (Railway)

A API de produção é hospedada na [Railway](https://railway.app). Não há arquivos nem scripts de Discloud neste repositório.

1. Crie um serviço apontando para o diretório `apps/api` (ou a raiz do monorepo com **Root Directory** `apps/api`).
2. Comando de start: `npm start` (usa `node src/server.js`).
3. Defina `PORT` a partir da variável que a Railway injeta (`PORT` já é lida em `src/config/env.js`).
4. Configure todas as variáveis de `apps/api/.env.example` no painel da Railway (nunca no Git).
5. Ative `TRUST_PROXY=true` atrás do proxy da Railway.
6. No app Android/web, defina `VITE_API_URL` com a URL pública do serviço (ex.: `https://shappireapi-production.up.railway.app`), conforme `apps/app/.env.example`.

## Testes

```bash
npm test -w apps/api
```

Todos os testes rodam com V0X, MongoDB e Firebase Admin mockados — nenhum upload real, nenhum banco de produção, nenhum custo de rate limit.

## Endpoints

### `GET /health`

Estado do serviço, sem exigir autenticação nem expor credenciais.

```json
{ "status": "ok", "service": "shappire-api", "mongodb": "connected", "v0x": "configured" }
```

### `GET /api/profile`

Retorna o perfil do usuário autenticado (criado sob demanda no primeiro acesso). 404 `PROFILE_NOT_FOUND` se ainda não existir.

### `PATCH /api/profile`

Atualiza o próprio perfil. Campos aceitos: `displayName` (1–40), `username` (`null` para remover; normalizado, 3–20, `a-z0-9_`), `bio` (≤160), `avatar`/`banner` (metadados `{ fileId, url, mimeType }`). Campos desconhecidos são rejeitados; `email` não é gravável (vem do token). Quando uma imagem é substituída, a anterior é apagada do V0X em best-effort.

```bash
curl -X PATCH https://SUA_API/api/profile \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"displayName": "Vasil", "bio": "criador de figurinhas"}'
```

### `POST /api/profile/avatar` e `POST /api/profile/banner`

Upload multipart (campo `file`) de jpeg/png/webp/gif — avatar até 5 MB, banner até 10 MB. O tipo real é verificado por magic bytes (o MIME declarado pelo cliente não é confiável). O fluxo é: upload ao V0X → metadados no MongoDB → exclusão best-effort da imagem anterior.

```bash
curl -X POST https://SUA_API/api/profile/avatar \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -F "file=@avatar.png"
```

### Erros

Sempre no formato `{"error": "<CODIGO>", "message": "<mensagem>"}` — o app mapeia o código estável, não a mensagem. Códigos: `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `PROFILE_NOT_FOUND`, `USERNAME_TAKEN`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `RATE_LIMIT_EXCEEDED`, `UPLOAD_FAILED`, `INTERNAL_ERROR`. Nunca há stack trace, string de conexão ou segredo no corpo.

## Segurança

- Helmet, CORS restrito por origem (nunca `*` em produção), corpo JSON limitado a 128 KB.
- Rate limits por uid autenticado: leitura 60/min, escrita 20/min, upload 10/min.
- Toda a comunicação com o V0X passa pelo `src/services/v0xService.js`; a chave sai apenas no header `Authorization` e nunca é logada nem devolvida.
- Timeouts em todas as chamadas ao V0X (30 s upload, 10 s demais).
- Todas as rotas de perfil operam apenas sobre `req.user.uid` do token verificado — não existe parâmetro de id, então não há como acessar o perfil de outro usuário.
