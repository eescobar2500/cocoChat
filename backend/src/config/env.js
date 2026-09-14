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

const env = {
  port: Number(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || "development",

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
