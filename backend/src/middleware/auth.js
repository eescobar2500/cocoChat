import { isDatabaseEnabled } from "../db/prisma.js";

import { authenticateApiKey } from "../services/apiKeyService.js";
import { verifySessionToken } from "../services/authService.js";

import ApiError from "../utils/ApiError.js";

// Sin base de datos no hay organizaciones: las rutas de tenant no existen.
export const requireDatabase = (req, res, next) => {
  if (!isDatabaseEnabled()) {
    return next(ApiError.notFound("Las organizaciones no están habilitadas"));
  }

  next();
};

const bearer = (req) => {
  const header = req.get("authorization") ?? "";
  const [scheme, value] = header.split(" ");

  return scheme?.toLowerCase() === "bearer" && value ? value.trim() : null;
};

// Sesión de usuario del panel. Deja en `req.auth` el usuario, la
// organización y el rol; opcionalmente exige uno de varios roles.
export const requireUser =
  (...roles) =>
  (req, res, next) => {
    const claims = verifySessionToken(bearer(req));

    if (!claims) {
      return next(ApiError.unauthorized("Sesión inválida o caducada"));
    }

    if (roles.length > 0 && !roles.includes(claims.role)) {
      return next(ApiError.forbidden());
    }

    req.auth = claims;
    next();
  };

const apiKeyFrom = (req) => req.get("x-api-key") ?? bearer(req);

// API key de servicio. Deja en `req.organization` la dueña de la key.
export const requireApiKey = async (req, res, next) => {
  try {
    const { organization, apiKey } = await authenticateApiKey(apiKeyFrom(req));

    req.organization = organization;
    req.apiKey = apiKey;
    next();
  } catch (error) {
    next(error);
  }
};

// Como `requireApiKey`, pero si no viene ninguna key sigue sin
// organización. Con una key mal formada o inválida sí falla: un cliente
// que intentó autenticarse y no pudo no debe caer en el modo sin tenant.
export const optionalApiKey = async (req, res, next) => {
  if (!isDatabaseEnabled() || !apiKeyFrom(req)) {
    return next();
  }

  return requireApiKey(req, res, next);
};
