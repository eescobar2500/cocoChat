import app from "./app.js";
import env from "./config/env.js";

// server.js solo levanta el servidor. Separarlo de app.js permite importar
// la app (para tests, por ejemplo) sin abrir un puerto.
app.listen(env.port, () => {
  console.log(`✅ Backend escuchando en http://localhost:${env.port}`);
  console.log(`   Health check: http://localhost:${env.port}/api/health`);
  console.log(`   Agente:       ${env.openai.agentId}`);
  console.log(`   Entorno:      ${env.nodeEnv}`);
});
