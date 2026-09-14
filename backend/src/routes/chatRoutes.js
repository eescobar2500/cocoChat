import { Router } from "express";

import { postChat } from "../controllers/chatController.js";

import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

router.post("/", asyncHandler(postChat));

export default router;
