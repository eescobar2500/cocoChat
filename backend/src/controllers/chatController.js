import env from "../config/env.js";

import { sendMessageToAgent } from "../services/chatService.js";
import { chatWithAgent } from "../services/agentConversationService.js";
import { sendMessageViaResponses } from "../services/responsesChatService.js";
import { recordUsage } from "../services/usageService.js";

import { validateChatRequest } from "../utils/validations/chatValidation.js";

import ApiError from "../utils/ApiError.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const optionalUuid = (value, name) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw ApiError.badRequest(`El campo '${name}' no es un identificador válido`);
  }

  return value;
};

// Turno de una organización: su agente (datos de CocoChat), su clave BYOK
// y su conversación persistida. `history` del cliente se ignora: la
// memoria la lleva CocoChat en `conversationId`.
async function chatForOrganization(organization, body) {
  const result = await chatWithAgent(organization, {
    message: body.message,
    agentId: optionalUuid(body.agentId, "agentId"),
    conversationId: optionalUuid(body.conversationId, "conversationId"),
    endUserRef: body.endUserRef,
  });

  return { ...result, sessionId: result.conversationId };
}

export const postChat = async (req, res) => {
  // `history` solo lo usa el modo de respaldo sin organización: la
  // Responses API no guarda la conversación, así que el cliente puede
  // reenviarla. En modo agentes se ignora, porque OpenAI ya tiene el
  // contexto en la sesión.
  const { message, sessionId, history } = req.body ?? {};

  // Validar SIEMPRE lo que llega de fuera: el frontend corre en el navegador
  // del usuario, así que cualquiera puede mandarnos lo que quiera. Además,
  // cortar acá evita pagar una llamada a OpenAI que iba a fallar igual.
  const validation = validateChatRequest({ message, sessionId, history });

  if (!validation.valid) {
    throw ApiError.badRequest(validation.error);
  }

  const startedAt = Date.now();

  // Con API key de organización manda su clave; sin ella, el modo del
  // .env (CHAT_MODE). Ambos caminos devuelven la misma forma.
  const organization = req.organization ?? null;
  const mode = organization ? "agent" : env.chatMode;

  const result = organization
    ? await chatForOrganization(organization, req.body)
    : mode === "responses"
      ? await sendMessageViaResponses(message, sessionId, history)
      : await sendMessageToAgent(message, sessionId);

  // El consumo es el único dato que permite saber cuánto cuesta una
  // conversación real. No se espera a que se escriba: la respuesta del
  // usuario no depende de una métrica.
  recordUsage({
    usage: result.usage,
    mode,
    sessionId: result.sessionId,
    durationMs: Date.now() - startedAt,
    organizationId: organization?.id ?? null,
  }).catch(() => {});

  res.json({
    reply: result.reply,

    // Indica con qué API se respondió: útil para saber si el chat está
    // funcionando en modo degradado.
    mode,

    // El cliente debe guardar este id y reenviarlo en el próximo mensaje:
    // es lo que permite al agente recordar la conversación. En el primer
    // turno es nuevo; después es el mismo que nos mandaron.
    sessionId: result.sessionId,

    usage: result.usage,

    // Solo con organización: qué agente y versión respondieron, y la
    // conversación que hay que reenviar en el próximo turno.
    ...(organization && {
      conversationId: result.conversationId,
      agentId: result.agentId,
      configurationId: result.configurationId,
      configurationVersion: result.configurationVersion,
    }),
  });
};
