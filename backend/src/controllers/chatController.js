import env from "../config/env.js";

import { sendMessageToAgent } from "../services/chatService.js";
import {
  markCredential,
  resolveOpenAIKey,
} from "../services/providerCredentialService.js";
import { sendMessageViaResponses } from "../services/responsesChatService.js";
import { recordUsage } from "../services/usageService.js";

import { validateChatRequest } from "../utils/validations/chatValidation.js";

import ApiError from "../utils/ApiError.js";

// Turno de una organización (BYOK): se usa su clave de OpenAI, descifrada
// solo para esta llamada, y siempre la Responses API. La Agents API
// depende de un agente de la plataforma de OpenAI que la organización no
// tiene; el agente propio llega en la Etapa 2.
async function chatForOrganization(organization, message, history) {
  const credential = await resolveOpenAIKey(organization.id);

  try {
    const result = await sendMessageViaResponses(message, null, history, {
      apiKey: credential.apiKey,
    });

    markCredential(organization.id, credential.id, "lastUsedAt");

    return result;
  } catch (error) {
    // Permite distinguir en soporte "su clave falla" de "CocoChat falla".
    markCredential(organization.id, credential.id, "lastErrorAt");
    throw error;
  }
}

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

  const startedAt = Date.now();

  // Con API key de organización manda su clave; sin ella, el modo del
  // .env (CHAT_MODE). Ambos caminos devuelven la misma forma.
  const organization = req.organization ?? null;
  const mode = organization ? "responses" : env.chatMode;

  const result = organization
    ? await chatForOrganization(organization, message, history)
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
  });
};
