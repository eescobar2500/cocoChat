import express from "express";
import cors from "cors";

import logger from "./middleware/logger.js";
import errorHandle from "./middleware/errorHandle.js";
import routes from "./routes/index.js";
import ApiError from "./utils/ApiError.js";

const app = express();

// Middlewares
// CORS: el navegador bloquea peticiones entre orígenes distintos. React correrá
// en :5173 y Express en :3001, así que hay que autorizarlo explícitamente.
// (Solo afecta a navegadores; curl no pasa por esta restricción.)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
