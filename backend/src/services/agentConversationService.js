import { withOrganization } from "../db/prisma.js";

import { getRuntime } from "../runtime/agentRuntime.js";

import { resolveAgentForChat } from "./agentService.js";
import { markCredential, resolveOpenAIKey } from "./providerCredentialService.js";

import ApiError from "../utils/ApiError.js";

// Conversaciones y mensajes propios (ADR-0005): la verdad está aquí, no en
// el proveedor. El orquestador de un turno:
//
//   1. resuelve el agente publicado y su versión activa;
//   2. abre o recupera la conversación y carga la ventana de historial;
//   3. descifra la credencial BYOK solo para esta llamada;
//   4. ejecuta el runtime de la versión activa;
//   5. persiste el turno del usuario y el del asistente con su consumo y
//      la versión exacta que respondió.
//
// El texto de los mensajes contiene datos de usuarios finales: no se
// registra en logs y su retención es asunto del cliente (pendiente en el
// roadmap: borrado por petición).

// Ventana deslizante: la Responses API no tiene memoria, así que el
// historial viaja completo en cada turno; sin tope superaríamos la ventana
// de contexto.
const MAX_HISTORY = 20;
const MAX_END_USER_REF = 128;

export const publicConversation = (conversation) => ({
  id: conversation.id,
  agentId: conversation.agentId,
  channel: conversation.channel,
  endUserRef: conversation.endUserRef,
  status: conversation.status,
  startedAt: conversation.startedAt,
  lastMessageAt: conversation.lastMessageAt,
  messageCount: conversation._count?.messages,
});

export const publicMessage = (message) => ({
  id: message.id,
  role: message.role,
  content: message.content,
  tokenUsage: message.tokenUsage,
  configurationId: message.configurationId,
  createdAt: message.createdAt,
});

function validateEndUserRef(endUserRef) {
  if (endUserRef === undefined || endUserRef === null) {
    return null;
  }

  if (typeof endUserRef !== "string" || endUserRef.length > MAX_END_USER_REF) {
    throw ApiError.badRequest(
      `El campo 'endUserRef' debe ser texto de hasta ${MAX_END_USER_REF} caracteres`
    );
  }

  return endUserRef;
}

async function loadConversation(tx, agent, conversationId) {
  const conversation = await tx.conversation.findUnique({ where: { id: conversationId } });

  if (!conversation) {
    throw ApiError.notFound("La conversación no existe");
  }

  if (conversation.agentId !== agent.id) {
    throw ApiError.conflict("La conversación pertenece a otro agente");
  }

  if (conversation.status !== "open") {
    throw ApiError.conflict("La conversación está cerrada");
  }

  return conversation;
}

async function loadHistory(tx, conversationId) {
  const rows = await tx.message.findMany({
    where: { conversationId, role: { in: ["user", "assistant"] } },
    orderBy: { createdAt: "desc" },
    take: MAX_HISTORY,
    select: { role: true, content: true },
  });

  return rows.reverse();
}

/**
 * Un turno de chat de una organización contra uno de sus agentes.
 *
 * @param {object} organization Fila de `organizations` (ya autenticada).
 * @param {object} input
 * @param {string} input.message
 * @param {string} [input.agentId] Sin él, el único agente publicado.
 * @param {string} [input.conversationId] Sin él, se abre una nueva.
 * @param {string} [input.endUserRef] Identificador opaco del usuario final.
 * @param {string} [input.channel]
 * @param {string} [input.configurationId] Solo desde el panel: probar una
 *   versión concreta (borrador incluido) sin publicarla.
 */
export async function chatWithAgent(
  organization,
  { message, agentId, conversationId, endUserRef, channel = "api", configurationId }
) {
  const organizationId = organization.id;
  const cleanEndUserRef = validateEndUserRef(endUserRef);

  // Fase 1 (transacción corta): resolver agente, conversación e historial.
  // No se mantiene una transacción abierta mientras se espera al proveedor.
  const context = await withOrganization(organizationId, async (tx) => {
    const agent = configurationId
      ? await resolveAgentForTest(tx, agentId, configurationId)
      : await resolveAgentForChat(tx, agentId);

    // La conversación nueva se crea al persistir el turno: si el proveedor
    // falla no queda una conversación vacía.
    const conversation = conversationId
      ? await loadConversation(tx, agent, conversationId)
      : null;

    const history = conversation ? await loadHistory(tx, conversation.id) : [];

    return { agent, configuration: agent.activeConfiguration, conversation, history };
  });

  const credential = await resolveOpenAIKey(organizationId);
  const runtime = getRuntime(context.configuration.runtime);

  let result;

  try {
    result = await runtime.run({
      configuration: context.configuration,
      apiKey: credential.apiKey,
      messages: [...context.history, { role: "user", content: message }],
    });

    markCredential(organizationId, credential.id, "lastUsedAt");
  } catch (error) {
    // Permite distinguir en soporte "su clave falla" de "CocoChat falla".
    markCredential(organizationId, credential.id, "lastErrorAt");
    throw error;
  }

  // Fase 2: persistir el turno. Si esto falla la respuesta ya se pagó; se
  // devuelve igual y el error sube al log del servidor.
  const now = new Date();

  const conversation = await withOrganization(organizationId, async (tx) => {
    const current =
      context.conversation ??
      (await tx.conversation.create({
        data: {
          organizationId,
          agentId: context.agent.id,
          channel,
          endUserRef: cleanEndUserRef,
        },
      }));

    await tx.message.createMany({
      data: [
        {
          organizationId,
          conversationId: current.id,
          role: "user",
          content: message,
          configurationId: context.configuration.id,
          createdAt: new Date(now.getTime() - 1),
        },
        {
          organizationId,
          conversationId: current.id,
          role: "assistant",
          content: result.reply ?? "",
          tokenUsage: result.usage ?? undefined,
          configurationId: context.configuration.id,
          createdAt: now,
        },
      ],
    });

    await tx.conversation.update({
      where: { id: current.id },
      data: {
        lastMessageAt: now,
        externalSessionRef: result.providerRef ?? undefined,
      },
    });

    return current;
  });

  return {
    reply: result.reply,
    usage: result.usage,
    agentId: context.agent.id,
    configurationId: context.configuration.id,
    configurationVersion: context.configuration.version,
    conversationId: conversation.id,
  };
}

// Modo prueba del panel: cualquier versión del agente, publicada o no.
async function resolveAgentForTest(tx, agentId, configurationId) {
  if (!agentId) {
    throw ApiError.badRequest("Para probar una versión hay que indicar 'agentId'");
  }

  const agent = await tx.agent.findUnique({ where: { id: agentId } });

  if (!agent || agent.status === "archived") {
    throw ApiError.notFound("El agente no existe");
  }

  const configuration = await tx.agentConfiguration.findFirst({
    where: { id: configurationId, agentId },
  });

  if (!configuration) {
    throw ApiError.notFound("La versión no existe para este agente");
  }

  return { ...agent, activeConfiguration: configuration };
}

// --- consultas del panel -----------------------------------------------------

export function listConversations(organizationId, { agentId, limit = 50 } = {}) {
  return withOrganization(organizationId, async (tx) => {
    const conversations = await tx.conversation.findMany({
      where: agentId ? { agentId } : {},
      include: { _count: { select: { messages: true } } },
      orderBy: { lastMessageAt: "desc" },
      take: Math.min(Math.max(Number(limit) || 50, 1), 200),
    });

    return conversations.map(publicConversation);
  });
}

export function getConversation(organizationId, id) {
  return withOrganization(organizationId, async (tx) => {
    const conversation = await tx.conversation.findUnique({
      where: { id },
      include: {
        _count: { select: { messages: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!conversation) {
      throw ApiError.notFound("La conversación no existe");
    }

    return {
      ...publicConversation(conversation),
      messages: conversation.messages.map(publicMessage),
    };
  });
}
