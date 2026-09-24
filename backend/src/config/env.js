// Punto único de acceso a las variables de entorno.
// Ningún otro módulo debería leer process.env directamente.
//
// Nota: aquí no importamos "dotenv/config" porque el .env se carga con el flag
// nativo de Node (--env-file=.env, ver los scripts del package.json).

const required = ["OPENAI_API_KEY", "OPENAI_AGENT_ID"];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(
    `Faltan variables de entorno obligatorias: ${missing.join(", ")}\n` +
      `  1. cp .env.example .env\n` +
      `  2. Editá .env con tu key (https://platform.openai.com/api-keys)\n` +
      `     y el ID de tu agente (https://platform.openai.com/agents)`
  );
}

const nodeEnv = process.env.NODE_ENV || "development";

// Lista de orígenes autorizados, separados por comas. En desarrollo, si no
// se define, se asume el Vite local; en producción no hay valor por
// defecto: una lista vacía bloquea todos los navegadores, que es
// preferible a dejar la API abierta a cualquier sitio.
const parseOrigins = (raw) =>
  (raw ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const corsOrigins = process.env.CORS_ORIGINS
  ? parseOrigins(process.env.CORS_ORIGINS)
  : nodeEnv === "development"
    ? ["http://localhost:5173"]
    : [];

if (corsOrigins.length === 0) {
  console.warn(
    "[env] CORS_ORIGINS está vacía: ningún navegador podrá llamar a la API."
  );
}

const positiveInt = (raw, fallback) => {
  const value = Number(raw);

  return Number.isInteger(value) && value > 0 ? value : fallback;
};

// Clave maestra del cifrado por sobre: 32 bytes en base64. Con ella se
// envuelven las claves de datos de cada organización; nunca cifra datos
// directamente, para que rotarla sea re-envolver claves y no re-cifrar
// tablas. `SECRETS_MASTER_KEY_VERSION` viaja con cada secreto guardado.
const parseMasterKey = (raw) => {
  if (!raw) {
    return null;
  }

  const key = Buffer.from(raw, "base64");

  if (key.length !== 32) {
    throw new Error(
      "SECRETS_MASTER_KEY debe ser 32 bytes en base64. Generá una con:\n" +
        `  node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`
    );
  }

  return key;
};

const databaseUrl = process.env.DATABASE_URL || null;
const secretsMasterKey = parseMasterKey(process.env.SECRETS_MASTER_KEY);

if (databaseUrl && !secretsMasterKey) {
  throw new Error(
    "Con DATABASE_URL definida hace falta SECRETS_MASTER_KEY: sin ella no se " +
      "pueden guardar las claves de OpenAI de las organizaciones."
  );
}

function parsePreviousKeys(raw) {
  const keys = new Map();

  for (const entry of (raw ?? "").split(",")) {
    const [version, value] = entry.split(":").map((s) => s.trim());

    if (version && value) {
      keys.set(Number(version), parseMasterKey(value));
    }
  }

  return keys;
}

const env = {
  port: Number(process.env.PORT) || 3001,
  nodeEnv,

  // Sin DATABASE_URL la API funciona como en la Etapa 0: un solo agente
  // con la clave del proceso y sin organizaciones. Las rutas de tenant
  // responden 404, igual que las de mantenimiento sin ADMIN_TOKEN.
  databaseUrl,

  secrets: {
    masterKey: secretsMasterKey,
    masterKeyVersion: positiveInt(process.env.SECRETS_MASTER_KEY_VERSION, 1),
    // Claves maestras anteriores, para descifrar durante una rotación:
    // "1:base64,2:base64".
    previousMasterKeys: parsePreviousKeys(process.env.SECRETS_PREVIOUS_MASTER_KEYS),
  },

  // Duración de la sesión de usuario del panel.
  sessionTtlSeconds: positiveInt(process.env.SESSION_TTL_SECONDS, 12 * 60 * 60),

  // Número de proxies de confianza delante de la app. Sin esto, detrás de
  // un balanceador todas las peticiones comparten la IP del proxy y el
  // límite de peticiones se aplicaría a todos los usuarios a la vez.
  trustProxy: positiveInt(process.env.TRUST_PROXY, 0),

  corsOrigins,

  // Límite de peticiones de /api/chat. Cada turno cuesta dinero, así que
  // el tope es bajo a propósito.
  chatRateLimit: {
    windowMs: positiveInt(process.env.CHAT_RATE_LIMIT_WINDOW_MS, 60_000),
    max: positiveInt(process.env.CHAT_RATE_LIMIT_MAX, 20),
  },

  // Archivo donde se acumula el consumo de tokens, una línea JSON por
  // turno. Es un apaño hasta que exista base de datos: sin este dato no
  // se puede calcular el coste real por conversación.
  usageLogFile: process.env.USAGE_LOG_FILE || null,

  // Llave para las rutas de mantenimiento (/api/sessions). Si no está
  // definida, esas rutas quedan deshabilitadas: preferimos que no
  // funcionen antes que dejarlas abiertas por olvido.
  adminToken: process.env.ADMIN_TOKEN || null,
  // Qué API usa el chat:
  //   "agents"    → Agents API (el agente con su knowledge). Por defecto.
  //   "responses" → Responses API. Respaldo para cuando la Agents API
  //                 deja de procesar turnos: pierde el knowledge, pero
  //                 mantiene el chat funcionando.
  chatMode: process.env.CHAT_MODE === "responses" ? "responses" : "agents",

  openai: {
    apiKey: process.env.OPENAI_API_KEY,

    // Modelo del modo de respaldo. En modo "agents" no se usa: el modelo
    // lo define el propio agente.
    fallbackModel: process.env.OPENAI_FALLBACK_MODEL || "gpt-5.4-mini",

    // El agente ya trae su modelo, instructions, knowledge y tools desde la
    // plataforma. El backend solo lo referencia por ID: no duplicamos nada
    // de su configuración acá.
    agentId: process.env.OPENAI_AGENT_ID,
  },
};

export default env;
