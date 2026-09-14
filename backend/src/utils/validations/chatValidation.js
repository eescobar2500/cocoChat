// Tope de caracteres por mensaje. Evita que un texto gigantesco dispare
// el coste de una sola llamada.
const MAX_MESSAGE_LENGTH = 8000;

// Formato de los IDs de sesión que devuelve la Agents API. Validamos la
// forma (no que exista) para descartar basura antes de llamar a OpenAI.
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// Tope de mensajes del historial (solo aplica al modo de respaldo).
const MAX_HISTORY_MESSAGES = 50;

export function validateChatRequest({ message, sessionId, history }) {
  if (typeof message !== "string" || message.trim() === "") {
    return {
      valid: false,
      error: "El campo 'message' es obligatorio y debe ser texto no vacío",
    };
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      valid: false,
      error: `El mensaje supera los ${MAX_MESSAGE_LENGTH} caracteres`,
    };
  }

  // sessionId es opcional: en el primer turno no existe todavía.
  // Pero si viene, tiene que tener forma válida.
  if (sessionId !== undefined && sessionId !== null) {
    if (typeof sessionId !== "string" || !SESSION_ID_PATTERN.test(sessionId)) {
      return {
        valid: false,
        error: "El campo 'sessionId' no tiene un formato válido",
      };
    }
  }

  // history es opcional: solo lo usa el modo de respaldo. Si viene, tiene
  // que tener la forma correcta.
  if (history !== undefined && history !== null) {
    if (!Array.isArray(history)) {
      return {
        valid: false,
        error: "El campo 'history' debe ser un array",
      };
    }

    if (history.length > MAX_HISTORY_MESSAGES) {
      return {
        valid: false,
        error: `El historial no puede superar los ${MAX_HISTORY_MESSAGES} mensajes`,
      };
    }

    const formatoValido = history.every(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.length <= MAX_MESSAGE_LENGTH
    );

    if (!formatoValido) {
      return {
        valid: false,
        error:
          "Cada mensaje del historial necesita 'role' ('user' o 'assistant') " +
          "y 'content' de texto",
      };
    }
  }

  return {
    valid: true,
  };
}
