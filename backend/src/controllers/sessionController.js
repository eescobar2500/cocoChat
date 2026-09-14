import {
  cancelSession,
  cleanupSessions,
  deleteSession,
  listSessions,
} from "../services/sessionService.js";

import { validateSessionId } from "../utils/validations/sessionValidation.js";

import ApiError from "../utils/ApiError.js";

export const getSessions = async (req, res) => {
  const result = await listSessions();

  res.json(result);
};

export const postCancelSession = async (req, res) => {
  const { id } = req.params;

  const validation = validateSessionId(id);

  if (!validation.valid) {
    throw ApiError.badRequest(validation.error);
  }

  await cancelSession(id);

  res.json({
    message: "Cancelación enviada",
    sessionId: id,
  });
};

export const removeSession = async (req, res) => {
  const { id } = req.params;

  const validation = validateSessionId(id);

  if (!validation.valid) {
    throw ApiError.badRequest(validation.error);
  }

  await deleteSession(id);

  res.json({
    message: "Sesión eliminada",
    sessionId: id,
  });
};

export const postCleanup = async (req, res) => {
  // ?dryRun=true informa qué se haría sin tocar nada. Es el modo seguro
  // para revisar antes de ejecutar una limpieza real.
  const dryRun = req.query.dryRun === "true";

  const result = await cleanupSessions({ dryRun });

  res.json(result);
};
