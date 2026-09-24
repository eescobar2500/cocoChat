import app from "./app.js";
import env from "./config/env.js";
import { assertRlsEnforced, isDatabaseEnabled } from "./db/prisma.js";

// server.js solo levanta el servidor. Separarlo de app.js permite importar
// la app (para tests, por ejemplo) sin abrir un puerto.

// Con base de datos, antes de aceptar tráfico se comprueba que el rol no
// pueda saltarse RLS. Si puede, las políticas no filtran nada y es mejor
// no arrancar que servir datos de todas las organizaciones a cualquiera.
if (isDatabaseEnabled()) {
  try {
    await assertRlsEnforced();
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
}

app.listen(env.port, () => {
  console.log(`✅ Backend escuchando en http://localhost:${env.port}`);
  console.log(`   Health check: http://localhost:${env.port}/api/health`);
  console.log(`   Agente:       ${env.openai.agentId}`);
  console.log(`   Entorno:      ${env.nodeEnv}`);
  console.log(
    `   Tenants:      ${isDatabaseEnabled() ? "habilitados (RLS verificada)" : "deshabilitados (sin DATABASE_URL)"}`
  );
});
