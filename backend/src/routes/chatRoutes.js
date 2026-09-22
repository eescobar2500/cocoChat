import { Router } from "express";

import env from "../config/env.js";

import { postChat } from "../controllers/chatController.js";

import { createRateLimit } from "../middleware/rateLimit.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

// Cada turno cuesta dinero y la ruta es pública: sin tope, cualquiera
// puede agotar la cuota de OpenAI con un bucle.
router.post("/", createRateLimit(env.chatRateLimit), asyncHandler(postChat));

export default router;
