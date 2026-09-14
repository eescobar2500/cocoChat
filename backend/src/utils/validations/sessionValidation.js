// Formato de los IDs de sesión que devuelve la Agents API. Validamos la
// forma (no que existan) para no pasar basura a la API ni permitir que un
// id manipulado se cuele en la ruta.
const SESSION_ID_PATTERN = /^sess_[A-Za-z0-9]{1,128}$/;

export function validateSessionId(sessionId) {
  if (typeof sessionId !== "string" || !SESSION_ID_PATTERN.test(sessionId)) {
    return {
      valid: false,
      error: "El id de sesión no tiene un formato válido",
    };
  }

  return {
    valid: true,
  };
}

// Formato de los IDs de agente.
const AGENT_ID_PATTERN = /^agent_[A-Za-z0-9]{1,128}$/;

export function validateAgentId(agentId) {
  if (typeof agentId !== "string" || !AGENT_ID_PATTERN.test(agentId)) {
    return {
      valid: false,
      error: "El id de agente no tiene un formato válido",
    };
  }

  return {
    valid: true,
  };
}
