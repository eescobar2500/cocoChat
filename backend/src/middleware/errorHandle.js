import { APIError } from "openai";

import env from "../config/env.js";

// Traduce errores del SDK de OpenAI a status y mensajes propios. Sin esto,
// un fallo de la API saldría como 500 con el mensaje crudo del proveedor,
// que puede incluir detalles internos que no queremos exponer al cliente.
const translateOpenAIError = (err) => {
  if (!(err instanceof APIError)) {
    return null;
  }

  switch (err.status) {
    // Nuestra API key es inválida o fue revocada. Es un problema de
    // configuración del servidor, NO del cliente: por eso 502 y no 401.
    // Un 401 al cliente sugeriría que él debe autenticarse, y no es el caso.
    case 401:
      return {
        statusCode: 502,
        message: "El servidor no está correctamente configurado con OpenAI",
      };

    // Sin cuota o demasiadas peticiones.
    case 429:
      return {
        statusCode: 429,
        message: "Límite de uso alcanzado, intentá de nuevo en unos momentos",
      };

    // Un 404 de OpenAI significa cosas distintas según qué se pidió:
    //
    //   - Si el cliente pasó el id de un recurso (conversación, sesión,
    //     agente) que no existe, el error es suyo: 404.
    //   - Si el que falta es el agente configurado en OPENAI_AGENT_ID, el
    //     error es de configuración del servidor: 502.
    //
    // Distinguimos por el mensaje de la API, que nombra el recurso.
    case 404: {
      const detail = String(err.message ?? "");
      const isConfiguredAgent = detail.includes(env.openai.agentId);

      if (isConfiguredAgent) {
        return {
          statusCode: 502,
          message: "El agente configurado en el servidor no está disponible",
        };
      }

      return {
        statusCode: 404,
        message: "El recurso solicitado no existe o ya fue eliminado",
      };
    }

    default:
      return {
        statusCode: 502,
        message: "No se pudo obtener respuesta del modelo",
      };
  }
};

const errorHandle = (err, req, res, next) => {
  const openaiError = translateOpenAIError(err);

  const statusCode = openaiError?.statusCode || err.statusCode || 500;
  const message =
    openaiError?.message || err.message || "Ocurrió un error inesperado";

  // El detalle completo queda en el log del servidor (para nosotros),
  // no en la respuesta al cliente.
  console.error(`${new Date().toISOString()} - ${statusCode} - ${message}`);

  if (err.stack) {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    status: "error",
    statusCode,
    message,
    // El stack solo se expone en desarrollo Y si no viene de OpenAI: los
    // errores del SDK incluyen la API key parcialmente enmascarada en el
    // mensaje, y eso no debe salir del servidor bajo ninguna circunstancia.
    ...(env.nodeEnv === "development" &&
      !openaiError && {
        stack: err.stack,
      }),
  });
};

export default errorHandle;
