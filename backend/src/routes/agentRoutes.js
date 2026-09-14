import { Router } from "express";

import {
  getAgentById,
  getAgents,
  removeAgent,
} from "../controllers/agentController.js";

import requireAdminToken from "../middleware/requireAdminToken.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

// Rutas de mantenimiento: exigen el token de administración.
router.use(requireAdminToken);

router.get("/", asyncHandler(getAgents));
router.get("/:id", asyncHandler(getAgentById));
router.delete("/:id", asyncHandler(removeAgent));

export default router;
