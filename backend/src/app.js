import express from "express";
import cors from "cors";

import env from "./config/env.js";
import logger from "./middleware/logger.js";
import errorHandle from "./middleware/errorHandle.js";
import routes from "./routes/index.js";
import ApiError from "./utils/ApiError.js";

const app = express();

// Detrás de un proxy, `req.ip` es la del proxy salvo que se declare cuántos
// saltos de confianza hay. El límite de peticiones depende de ese dato.
if (env.trustProxy > 0) {
  app.set("trust proxy", env.trustProxy);
}

// Middlewares
// CORS: el navegador bloquea peticiones entre orígenes distintos. React corre
// en :5173 y Express en :3001, así que hay que autorizarlo explícitamente.
// La lista viene de CORS_ORIGINS: un `cors()` sin argumentos autoriza
// cualquier sitio web a gastar nuestra cuota desde el navegador de sus
// visitantes.
// (Solo afecta a navegadores; curl no pasa por esta restricción.)
app.use(
  cors({
    origin(origin, callback) {
      // Sin cabecera `Origin` no hay navegador de por medio (curl, health
      // checks, peticiones servidor a servidor): CORS no aplica.
      if (!origin || env.corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      callback(null, false);
    },
  })
);

// Tope de tamaño del cuerpo. El límite por defecto de Express (100 kb) ya
// es razonable, pero dejarlo explícito documenta la intención.
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(logger);

// Rutas
app.use("/api", routes);

// 404: ninguna ruta coincidió
app.use((req, res, next) => {
  next(ApiError.notFound(`No existe la ruta ${req.method} ${req.originalUrl}`));
});

// Middleware de errores: siempre al final
app.use(errorHandle);

export default app;
