import { Router } from "express";

import {
  getSessions,
  postCancelSession,
  postCleanup,
  removeSession,
} from "../controllers/sessionController.js";

import requireAdminToken from "../middleware/requireAdminToken.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

// Todas las rutas de este router son de mantenimiento: exigen el token.
router.use(requireAdminToken);

router.get("/", asyncHandler(getSessions));
router.post("/cleanup", asyncHandler(postCleanup));
router.post("/:id/cancel", asyncHandler(postCancelSession));
router.delete("/:id", asyncHandler(removeSession));

export default router;
