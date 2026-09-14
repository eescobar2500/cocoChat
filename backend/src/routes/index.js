import { Router } from "express";

import agentRoutes from "./agentRoutes.js";
import chatRoutes from "./chatRoutes.js";
import conversationRoutes from "./conversationRoutes.js";
import healthRoutes from "./healthRoutes.js";
import sessionRoutes from "./sessionRoutes.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/chat", chatRoutes);

// Mantenimiento de sesiones. Protegidas por token (ver sessionRoutes).
router.use("/sessions", sessionRoutes);
router.use("/agents", agentRoutes);
router.use("/conversations", conversationRoutes);

export default router;
