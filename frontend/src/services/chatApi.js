// Única capa que conoce la URL del backend y el formato de la API.
// Los componentes y hooks no hacen fetch directamente: si mañana cambia el
// endpoint o el formato de respuesta, se toca este archivo y ninguno más.

// Las variables de entorno de Vite deben empezar por VITE_ para llegar al
// navegador. OJO: todo lo que esté acá es PÚBLICO (viaja en el bundle), por eso
// la API key de OpenAI vive solo en el backend y nunca acá.
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export class ChatApiError extends Error {
  constructor(message, statusCode) {
    super(message);

    this.name = "ChatApiError";
    this.statusCode = statusCode;
  }
}

/**
 * Envía un mensaje al agente y devuelve su respuesta.
 *
 * En modo agentes basta con el mensaje y el `sessionId`: OpenAI guarda la
 * conversación del lado del servidor. En modo de respaldo (Responses API)
 * no hay sesiones, así que mandamos también el historial. Enviar ambos
 * siempre es inofensivo: el backend usa lo que necesite según su modo.
 *
 * @param {string} message Texto del usuario.
 * @param {string|null} sessionId Sesión en curso. null en el primer mensaje.
 * @param {{signal?: AbortSignal, history?: Array}} [options]
 *   history: el backend solo lo usa en modo de respaldo (Responses API),
 *   donde no hay sesiones y la memoria la lleva el cliente. En modo agentes
 *   se ignora, así que mandarlo siempre es inofensivo.
 * @returns {Promise<{reply: string, sessionId: string, usage: object|null}>}
 */
export async function sendChat(message, sessionId, { signal, history } = {}) {
  let response;

  try {
    response = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // sessionId solo se incluye si existe: en el primer turno el backend
      // crea la sesión y nos devuelve el id.
      body: JSON.stringify({
        message,
        ...(sessionId && { sessionId }),
        ...(history?.length && { history }),
      }),
      signal,
    });
  } catch (error) {
    // Una petición abortada no es un fallo: la propagamos tal cual para que
    // quien llame pueda distinguirla de un error real de red.
    if (error.name === "AbortError") {
      throw error;
    }

    throw new ChatApiError(
      "No se pudo conectar con el servidor. ¿Está corriendo el backend?",
      0
    );
  }

  if (!response.ok) {
    // El backend responde { status, statusCode, message } en los errores.
    // Si la respuesta no fuera JSON (un proxy caído, por ejemplo), evitamos
    // que el .json() reviente y tape el error real.
    const data = await response.json().catch(() => null);

    throw new ChatApiError(
      data?.message ?? "Ocurrió un error inesperado",
      response.status
    );
  }

  return response.json();
}
