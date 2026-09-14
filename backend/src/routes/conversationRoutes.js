import { Router } from "express";

import {
  getConversationById,
  postConversation,
  removeConversation,
  removeConversationItem,
} from "../controllers/conversationController.js";

import requireAdminToken from "../middleware/requireAdminToken.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

// Rutas de mantenimiento: exigen el token de administración.
router.use(requireAdminToken);

// No hay GET "/" porque la API de OpenAI no permite listar conversaciones:
// solo se puede operar con un id conocido.
router.post("/", asyncHandler(postConversation));
router.get("/:id", asyncHandler(getConversationById));
router.delete("/:id", asyncHandler(removeConversation));
router.delete("/:id/items/:itemId", asyncHandler(removeConversationItem));

export default router;
