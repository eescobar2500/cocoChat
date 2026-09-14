import env from "../config/env.js";

import {
  deleteAgent,
  getAgent,
  listAgents,
} from "../services/sessionService.js";

import { validateAgentId } from "../utils/validations/sessionValidation.js";

import ApiError from "../utils/ApiError.js";

export const getAgents = async (req, res) => {
  const result = await listAgents();

  res.json(result);
};

export const getAgentById = async (req, res) => {
  const { id } = req.params;

  const validation = validateAgentId(id);

  if (!validation.valid) {
    throw ApiError.badRequest(validation.error);
  }

  const agent = await getAgent(id);

  res.json(agent);
};

export const removeAgent = async (req, res) => {
  const { id } = req.params;

  const validation = validateAgentId(id);

  if (!validation.valid) {
    throw ApiError.badRequest(validation.error);
  }

  // Borrar un agente destruye sus instructions y su knowledge, y no se
  // puede deshacer. Exigimos que el id vaya también en el cuerpo: así un
  // DELETE lanzado por error (o un id copiado a medias) no borra nada.
  if (req.body?.confirm !== id) {
    throw ApiError.badRequest(
      "Para confirmar, enviá { \"confirm\": \"<id del agente>\" } en el cuerpo. " +
        "Esta acción es irreversible."
    );
  }

  // El agente que usa el backend no se borra sin más: dejaría el chat sin
  // funcionar. Hay que apuntar OPENAI_AGENT_ID a otro agente primero.
  if (id === env.openai.agentId) {
    throw ApiError.badRequest(
      "Este agente es el que usa el backend (OPENAI_AGENT_ID). " +
        "Cambiá esa variable a otro agente antes de borrarlo."
    );
  }

  const deleted = await deleteAgent(id);

  // Queda registro en el log de qué se borró y cuánto contenía.
  console.warn(
    `[agentController] Agente eliminado: ${deleted.id} ` +
      `("${deleted.name}", ${deleted.instructionsLength} caracteres de instructions)`
  );

  res.json({
    message: "Agente eliminado",
    agent: deleted,
  });
};
