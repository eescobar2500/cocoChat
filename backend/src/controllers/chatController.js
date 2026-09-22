import env from "../config/env.js";

import { sendMessageToAgent } from "../services/chatService.js";
import { sendMessageViaResponses } from "../services/responsesChatService.js";
import { recordUsage } from "../services/usageService.js";

import { validateChatRequest } from "../utils/validations/chatValidation.js";

import ApiError from "../utils/ApiError.js";

export const postChat = async (req, res) => {
  // `history` solo lo usa el modo de respaldo: la Responses API no guarda
  // la conversación, así que el cliente puede reenviarla. En modo agentes
  // se ignora, porque OpenAI ya tiene el contexto en la sesión.
  const { message, sessionId, history } = req.body ?? {};

  // Validar SIEMPRE lo que llega de fuera: el frontend corre en el navegador
  // del usuario, así que cualquiera puede mandarnos lo que quiera. Además,
  // cortar acá evita pagar una llamada a OpenAI que iba a fallar igual.
  const validation = validateChatRequest({ message, sessionId, history });

  if (!validation.valid) {
    throw ApiError.badRequest(validation.error);
  }

  // El modo se elige en el .env (CHAT_MODE). Ambos servicios devuelven la
  // misma forma, así que el resto del controller no cambia.
  const startedAt = Date.now();

  const result =
    env.chatMode === "responses"
      ? await sendMessageViaResponses(message, sessionId, history)
      : await sendMessageToAgent(message, sessionId);

  // El consumo es el único dato que permite saber cuánto cuesta una
  // conversación real. No se espera a que se escriba: la respuesta del
  // usuario no depende de una métrica.
  recordUsage({
    usage: result.usage,
    mode: env.chatMode,
    sessionId: result.sessionId,
    durationMs: Date.now() - startedAt,
  }).catch(() => {});

  res.json({
    reply: result.reply,

    // Indica con qué API se respondió: útil para saber si el chat está
    // funcionando en modo degradado.
    mode: env.chatMode,

    // El cliente debe guardar este id y reenviarlo en el próximo mensaje:
    // es lo que permite al agente recordar la conversación. En el primer
    // turno es nuevo; después es el mismo que nos mandaron.
    sessionId: result.sessionId,

    usage: result.usage,
  });
};
