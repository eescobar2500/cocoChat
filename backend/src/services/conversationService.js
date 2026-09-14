import OpenAI from "openai";

import env from "../config/env.js";

// Administración de conversaciones de OpenAI.
//
// Una "conversación" (`conv_…`) es un contenedor de mensajes que vive del
// lado de OpenAI, independiente de las sesiones de agente (`sess_…`).
//
// Diferencias con las sesiones, que conviene tener claras:
//   - La sesión ejecuta un agente y puede quedarse atascada en un turno.
//   - La conversación solo almacena mensajes: no ejecuta nada, así que
//     nunca se "cuelga" y su borrado es inmediato.
//
// LIMITACIÓN de la API: no existe `GET /conversations`. No hay forma de
// listarlas, así que solo se puede operar con un id que ya se conozca.
// Por eso acá no hay un `listConversations()` ni una limpieza masiva.

let client;

function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: env.openai.apiKey });
  }

  return client;
}

/**
 * Crea una conversación vacía.
 *
 * @param {{metadata?: Record<string, string>}} [options]
 */
export async function createConversation({ metadata } = {}) {
  const conversation = await getClient().conversations.create(
    metadata ? { metadata } : {}
  );

  return {
    id: conversation.id,
    createdAt: conversation.created_at,
    metadata: conversation.metadata ?? null,
  };
}

/**
 * Devuelve una conversación con sus mensajes.
 *
 * @param {string} conversationId
 * @param {{limit?: number}} [options]
 */
export async function getConversation(conversationId, { limit = 50 } = {}) {
  const openai = getClient();

  const conversation = await openai.conversations.retrieve(conversationId);

  const items = [];

  for await (const item of openai.conversations.items.list(conversationId)) {
    items.push({
      id: item.id,
      type: item.type,
      role: item.role ?? null,
      content: item.content ?? null,
    });

    if (items.length >= limit) {
      break;
    }
  }

  return {
    id: conversation.id,
    createdAt: conversation.created_at,
    metadata: conversation.metadata ?? null,
    itemCount: items.length,
    items,
  };
}

/**
 * Elimina una conversación y todos sus mensajes.
 *
 * A diferencia de las sesiones, el borrado es inmediato y no depende del
 * estado: una conversación no ejecuta nada, solo almacena.
 *
 * @param {string} conversationId
 */
export async function deleteConversation(conversationId) {
  const result = await getClient().conversations.delete(conversationId);

  return {
    id: result.id,
    deleted: result.deleted,
  };
}

/**
 * Elimina un mensaje concreto de una conversación, dejando el resto intacto.
 *
 * @param {string} conversationId
 * @param {string} itemId
 */
export async function deleteConversationItem(conversationId, itemId) {
  await getClient().conversations.items.delete(itemId, {
    conversation_id: conversationId,
  });
}
