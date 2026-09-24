import { Router } from "express";

import {
  deleteApiKey,
  deleteProviderCredential,
  getApiKeys,
  getCurrentOrganization,
  getMembers,
  getOrganizations,
  getProviderCredentials,
  postApiKey,
  postLogin,
  postMember,
  postOrganization,
  putOpenAIKey,
} from "../controllers/organizationController.js";

import { requireDatabase, requireUser } from "../middleware/auth.js";
import { createRateLimit } from "../middleware/rateLimit.js";
import requireAdminToken from "../middleware/requireAdminToken.js";
import asyncHandler from "../utils/asyncHandler.js";

// Rutas de plataforma: crear y listar organizaciones. Exigen el token de
// administración porque todavía no hay registro público.
export const platformRouter = Router();

platformRouter.use(requireDatabase, requireAdminToken);
platformRouter.post("/", asyncHandler(postOrganization));
platformRouter.get("/", asyncHandler(getOrganizations));

// Sesión de usuario.
export const authRouter = Router();

authRouter.use(requireDatabase);
// Tope bajo por IP: es la ruta donde se prueban contraseñas.
authRouter.post(
  "/login",
  createRateLimit({ windowMs: 15 * 60_000, max: 20 }),
  asyncHandler(postLogin)
);

// Rutas de la organización en sesión. El tenant sale del token, nunca de
// la URL: así una petición no puede pedir datos de otra organización.
export const organizationRouter = Router();

organizationRouter.use(requireDatabase);

organizationRouter.get("/", requireUser(), asyncHandler(getCurrentOrganization));

const manage = requireUser("owner", "admin");

organizationRouter.get("/members", manage, asyncHandler(getMembers));
organizationRouter.post("/members", manage, asyncHandler(postMember));

organizationRouter.get("/api-keys", manage, asyncHandler(getApiKeys));
organizationRouter.post("/api-keys", manage, asyncHandler(postApiKey));
organizationRouter.delete("/api-keys/:id", manage, asyncHandler(deleteApiKey));

organizationRouter.get("/provider-credentials", manage, asyncHandler(getProviderCredentials));
organizationRouter.put("/provider-credentials/openai", manage, asyncHandler(putOpenAIKey));
organizationRouter.delete("/provider-credentials/:id", manage, asyncHandler(deleteProviderCredential));
