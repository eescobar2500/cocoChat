// `config/env.js` valida las variables obligatorias al importarse y aborta
// si faltan. Los tests importan módulos que dependen de él, así que hay
// que definirlas antes de cualquier import que lo arrastre.
process.env.OPENAI_API_KEY ??= "sk-test";
process.env.OPENAI_AGENT_ID ??= "agent_test";
process.env.NODE_ENV ??= "test";
process.env.CORS_ORIGINS ??= "https://app.ejemplo.com";
process.env.ADMIN_TOKEN ??= "token-de-prueba";
