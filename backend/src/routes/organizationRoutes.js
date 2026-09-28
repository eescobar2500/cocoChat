import { Router } from "express";

import env from "../config/env.js";
import {
  deleteAgent,
  getAgentById,
  getAgents,
  getConfigurations,
  getConversationById,
  getConversations,
  patchAgent,
  postAgent,
  postAgentChat,
  postConfiguration,
  postPublish,
} from "../controllers/organizationAgentController.js";
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

// Agentes: cualquier miembro puede verlos y probarlos; editar y publicar
// es de owner/admin.
const member = requireUser();

organizationRouter.get("/agents", member, asyncHandler(getAgents));
organizationRouter.post("/agents", manage, asyncHandler(postAgent));
organizationRouter.get("/agents/:id", member, asyncHandler(getAgentById));
organizationRouter.patch("/agents/:id", manage, asyncHandler(patchAgent));
organizationRouter.delete("/agents/:id", manage, asyncHandler(deleteAgent));
organizationRouter.get("/agents/:id/configurations", member, asyncHandler(getConfigurations));
organizationRouter.post("/agents/:id/configurations", manage, asyncHandler(postConfiguration));
organizationRouter.post(
  "/agents/:id/configurations/:configurationId/publish",
  manage,
  asyncHandler(postPublish)
);
organizationRouter.post(
  "/agents/:id/chat",
  member,
  createRateLimit({
    ...env.chatRateLimit,
    keyGenerator: (req) => `org:${req.auth.organizationId}`,
  }),
  asyncHandler(postAgentChat)
);

organizationRouter.get("/conversations", member, asyncHandler(getConversations));
organizationRouter.get("/conversations/:id", member, asyncHandler(getConversationById));
