import env from "../config/env.js";

import ApiError from "../utils/ApiError.js";

// Las rutas de administración borran conversaciones: no pueden quedar
// abiertas como /api/chat. Se protegen con un token que viaja en la
// cabecera y vive en el .env, nunca en el frontend.
//
// No es un sistema de autenticación (no hay usuarios ni sesiones): es una
// llave simple para operaciones de mantenimiento.
const requireAdminToken = (req, res, next) => {
  // Sin token configurado, las rutas quedan cerradas. Preferimos que no
  // funcionen a que queden abiertas por olvidar una variable de entorno.
  if (!env.adminToken) {
    return next(
      ApiError.notFound("Las rutas de administración no están habilitadas")
    );
  }

  const provided = req.get("x-admin-token");

  if (provided !== env.adminToken) {
    return next(ApiError.unauthorized("Token de administración inválido"));
  }

  next();
};

export default requireAdminToken;
