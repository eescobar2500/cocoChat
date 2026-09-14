import { Router } from "express";

const router = Router();

// Comprueba que el servidor está vivo sin gastar una llamada a OpenAI.
router.get("/", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
  });
});

export default router;
