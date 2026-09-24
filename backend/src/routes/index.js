import { Router } from "express";

import agentRoutes from "./agentRoutes.js";
import chatRoutes from "./chatRoutes.js";
import conversationRoutes from "./conversationRoutes.js";
import healthRoutes from "./healthRoutes.js";
import {
  authRouter,
  organizationRouter,
  platformRouter,
} from "./organizationRoutes.js";
import sessionRoutes from "./sessionRoutes.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/chat", chatRoutes);

// Multi-tenancy (Etapa 1). Solo existen con DATABASE_URL configurada.
router.use("/auth", authRouter);
router.use("/organizations", platformRouter);
router.use("/organization", organizationRouter);

// Mantenimiento de sesiones. Protegidas por token (ver sessionRoutes).
router.use("/sessions", sessionRoutes);
router.use("/agents", agentRoutes);
router.use("/conversations", conversationRoutes);

export default router;
