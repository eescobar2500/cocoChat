import {
  archiveAgent,
  createAgent,
  createConfiguration,
  getAgent,
  listAgents,
  listConfigurations,
  publishConfiguration,
  updateAgent,
} from "../services/agentService.js";
import {
  chatWithAgent,
  getConversation,
  listConversations,
} from "../services/agentConversationService.js";
import { getOrganization } from "../services/organizationService.js";
import { recordUsage } from "../services/usageService.js";

import { validateChatRequest } from "../utils/validations/chatValidation.js";

import ApiError from "../utils/ApiError.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const requireUuid = (value, name) => {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw ApiError.badRequest(`El campo '${name}' no es un identificador válido`);
  }

  return value;
};

const optionalUuid = (value, name) =>
  value === undefined || value === null || value === "" ? undefined : requireUuid(value, name);

// --- agentes -----------------------------------------------------------------

export const getAgents = async (req, res) => {
  res.json({
    agents: await listAgents(req.auth.organizationId, {
      includeArchived: req.query.includeArchived === "true",
    }),
  });
};

export const postAgent = async (req, res) => {
  const agent = await createAgent(req.auth.organizationId, req.body ?? {}, {
    userId: req.auth.userId,
  });

  res.status(201).json({ agent });
};

export const getAgentById = async (req, res) => {
  res.json({
    agent: await getAgent(req.auth.organizationId, requireUuid(req.params.id, "id")),
  });
};

export const patchAgent = async (req, res) => {
  res.json({
    agent: await updateAgent(
      req.auth.organizationId,
      requireUuid(req.params.id, "id"),
      req.body ?? {}
    ),
  });
};

export const deleteAgent = async (req, res) => {
  res.json({
    agent: await archiveAgent(req.auth.organizationId, requireUuid(req.params.id, "id")),
  });
};

// --- versiones ---------------------------------------------------------------

export const getConfigurations = async (req, res) => {
  res.json({
    configurations: await listConfigurations(
      req.auth.organizationId,
      requireUuid(req.params.id, "id")
    ),
  });
};

export const postConfiguration = async (req, res) => {
  const configuration = await createConfiguration(
    req.auth.organizationId,
    requireUuid(req.params.id, "id"),
    req.body ?? {},
    { userId: req.auth.userId }
  );

  res.status(201).json({ configuration });
};

export const postPublish = async (req, res) => {
  res.json({
    agent: await publishConfiguration(
      req.auth.organizationId,
      requireUuid(req.params.id, "id"),
      requireUuid(req.params.configurationId, "configurationId")
    ),
  });
};

// Prueba desde el panel: conversa con el agente usando la sesión de
// usuario (sin API key). Puede fijar una versión concreta para probar un
// borrador antes de publicarlo.
export const postAgentChat = async (req, res) => {
  const { message, conversationId, configurationId } = req.body ?? {};
  const validation = validateChatRequest({ message });

  if (!validation.valid) {
    throw ApiError.badRequest(validation.error);
  }

  const startedAt = Date.now();
  const organization = await getOrganization(req.auth.organizationId);

  const result = await chatWithAgent(organization, {
    message,
    agentId: requireUuid(req.params.id, "id"),
    conversationId: optionalUuid(conversationId, "conversationId"),
    configurationId: optionalUuid(configurationId, "configurationId"),
    channel: "panel",
  });

  recordUsage({
    usage: result.usage,
    mode: "agent",
    sessionId: result.conversationId,
    durationMs: Date.now() - startedAt,
    organizationId: organization.id,
  }).catch(() => {});

  res.json(result);
};

// --- conversaciones ----------------------------------------------------------

export const getConversations = async (req, res) => {
  res.json({
    conversations: await listConversations(req.auth.organizationId, {
      agentId: optionalUuid(req.query.agentId, "agentId"),
      limit: req.query.limit,
    }),
  });
};

export const getConversationById = async (req, res) => {
  res.json({
    conversation: await getConversation(
      req.auth.organizationId,
      requireUuid(req.params.id, "id")
    ),
  });
};
