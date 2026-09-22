import { timingSafeEqual } from "node:crypto";

import env from "../config/env.js";

import ApiError from "../utils/ApiError.js";

// Comparar con `!==` tarda más cuanto más prefijo coincide, y esa
// diferencia de tiempo permite adivinar el token carácter a carácter.
export function safeCompare(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string") {
    return false;
  }

  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");

  if (a.length !== b.length) {
    // Se compara igualmente contra sí mismo para no responder antes cuando
    // la longitud no coincide.
    timingSafeEqual(a, a);
    return false;
  }

  return timingSafeEqual(a, b);
}

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

  if (!safeCompare(provided, env.adminToken)) {
    return next(ApiError.unauthorized("Token de administración inválido"));
  }

  next();
};

export default requireAdminToken;
