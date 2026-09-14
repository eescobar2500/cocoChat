# YVR Assistant

Chatbot con la API de OpenAI: un backend Express que habla con un agente y
un frontend React que lo consume.

```
React  →  Express  →  OpenAI (agente)  →  Express  →  React
```

La API key vive **solo** en el backend: el navegador nunca la ve.

## Estructura

Es un monorepo pnpm. Los dos proyectos comparten lockfile y se arrancan juntos.

```
.
├── backend/          Express + SDK de OpenAI (MVC)
│   ├── src/
│   │   ├── config/env.js      punto único de acceso a process.env
│   │   ├── controllers/       validan, delegan, responden
│   │   ├── services/          único lugar que habla con OpenAI
│   │   ├── routes/            mapean verbo → controller
│   │   ├── middleware/        logger, errores, token de admin
│   │   └── utils/             ApiError, asyncHandler, validaciones
│   └── postman/               colección para probar la API
└── frontend/         React + Vite
    └── src/
        ├── services/chatApi.js   única capa que hace fetch
        ├── hooks/useChat.js      estado de la conversación
        └── components/           presentación
```

## Puesta en marcha

```bash
pnpm install

# Backend
cd backend
cp .env.example .env
#   → pegá tu OPENAI_API_KEY (platform.openai.com/api-keys)
#   → pegá tu OPENAI_AGENT_ID (platform.openai.com/agents)
#   → generá un ADMIN_TOKEN:
#     node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"

cd ..
pnpm dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

También por separado: `pnpm dev:backend` / `pnpm dev:frontend`.

## Los dos modos del chat

El backend puede hablar con dos APIs distintas, según `CHAT_MODE` en el `.env`:

| Modo | API | Memoria | Knowledge del agente |
|---|---|---|---|
| `agents` (por defecto) | Agents API | Sesión en OpenAI (`sessionId`) | Sí |
| `responses` | Responses API | El cliente reenvía `history` | No, solo instructions |

**`agents`** es el modo normal: el agente aporta su knowledge y OpenAI guarda
la conversación.

**`responses`** es el respaldo. La Agents API está en beta pública y puede
dejar de procesar turnos (las sesiones se quedan en `in_progress`
indefinidamente). Cuando eso pasa, cambiar una variable mantiene el chat vivo:

```bash
# backend/.env
CHAT_MODE=responses
```

En ese modo las instructions salen de `src/config/fallbackInstructions.txt`,
que **no se versiona** (contiene el knowledge del negocio). Ver
`fallbackInstructions.example.txt` para generarlo desde tu agente.

Cada respuesta incluye `mode` para saber con qué API se contestó.

## API

### Chat

```
POST /api/chat
  { message, sessionId?, history? }
  → { reply, mode, sessionId, usage }
```

`sessionId` lo devuelve la primera respuesta y el cliente lo reenvía en los
turnos siguientes. `history` solo lo usa el modo de respaldo.

```
GET /api/health
```

### Mantenimiento

Estas rutas exigen la cabecera `x-admin-token` con el valor de `ADMIN_TOKEN`.
Sin esa variable definida quedan deshabilitadas.

```
GET    /api/sessions                    listar, marca las atascadas
POST   /api/sessions/cleanup            cancelar atascadas y borrar
POST   /api/sessions/cleanup?dryRun=true  simular sin tocar nada
POST   /api/sessions/:id/cancel         cancelar el turno de una sesión
DELETE /api/sessions/:id                borrar una sesión

GET    /api/agents                      listar, marca el que está en uso
GET    /api/agents/:id                  configuración completa
DELETE /api/agents/:id                  borrar (exige { confirm: "<id>" })

POST   /api/conversations               crear
GET    /api/conversations/:id           leer con sus mensajes
DELETE /api/conversations/:id           borrar
DELETE /api/conversations/:id/items/:itemId   borrar un mensaje
```

Tres recursos que conviene no confundir:

| Recurso | Prefijo | Qué es | ¿Listable? |
|---|---|---|---|
| Agente | `agent_` | Instructions, knowledge y tools | Sí |
| Sesión | `sess_` | Ejecuta un agente; puede atascarse | Sí |
| Conversación | `conv_` | Solo almacena mensajes | No (la API no lo permite) |

### Errores

```json
{ "status": "error", "statusCode": 400, "message": "..." }
```

| Código | Cuándo |
|--------|--------|
| 400 | Entrada mal formada |
| 401 | Falta el token de administración o es inválido |
| 404 | Ruta o recurso inexistente |
| 413 | Mensaje demasiado largo |
| 429 | Límite de uso de OpenAI |
| 502 | Fallo de OpenAI o agente mal configurado |

## Probar con Postman

Importá `backend/postman/cocoChat.postman_collection.json` y pegá tu
`ADMIN_TOKEN` en la variable `adminToken`.

Son 7 carpetas: health, chat (agentes), chat en modo respaldo, conversaciones,
sesiones, agentes y errores.

## Variables de entorno

### `backend/.env`

| Variable | Obligatoria | Por defecto |
|----------|-------------|-------------|
| `OPENAI_API_KEY` | sí | — |
| `OPENAI_AGENT_ID` | sí | — |
| `ADMIN_TOKEN` | no¹ | — |
| `CHAT_MODE` | no | `agents` |
| `OPENAI_FALLBACK_MODEL` | no | `gpt-5.4-mini` |
| `PORT` | no | `3001` |
| `NODE_ENV` | no | `development` |

¹ Sin ella las rutas de mantenimiento quedan deshabilitadas.

### `frontend/.env`

| Variable | Por defecto |
|----------|-------------|
| `VITE_API_URL` | `http://localhost:3001` |

⚠️ Todo lo que empiece por `VITE_` viaja en el bundle y es **público**. La API
key nunca va ahí.

## Qué NO se versiona

- `backend/.env` — secretos
- `backend/src/config/fallbackInstructions.txt` — knowledge del negocio
- `backend/backups/` — respaldos de agentes (incluyen sus instructions)
- `node_modules/`, `dist/`

Cada uno tiene su `.example` con la forma esperada.
