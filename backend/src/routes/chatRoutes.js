import { Router } from "express";

import env from "../config/env.js";

import { postChat } from "../controllers/chatController.js";

import { optionalApiKey } from "../middleware/auth.js";
import { createRateLimit } from "../middleware/rateLimit.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

// Cada turno cuesta dinero y la ruta es pública: sin tope, cualquiera
// puede agotar la cuota de OpenAI con un bucle. Con API key de
// organización el cupo es por organización, no por IP: su backend llama
// desde pocas IPs en nombre de muchos usuarios.
router.post(
  "/",
  optionalApiKey,
  createRateLimit({
    ...env.chatRateLimit,
    keyGenerator: (req) => (req.organization ? `org:${req.organization.id}` : req.ip),
  }),
  asyncHandler(postChat)
);

export default router;
