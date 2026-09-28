import env from "../config/env.js";
import { withOrganization } from "../db/prisma.js";

import { runtimeIds } from "../runtime/agentRuntime.js";

import ApiError from "../utils/ApiError.js";

// Agentes del cliente y sus versiones de configuración.
//
// Reglas:
//   - Una configuración nunca se edita: cada cambio crea la versión N+1
//     (borrador). Así el historial es fiable y un mensaje antiguo puede
//     explicarse con la versión exacta que lo generó.
//   - Publicar = apuntar `activeConfigurationId` a una versión. Volver a una
//     versión anterior es publicarla de nuevo; no hace falta nada más.
//   - El chat solo usa agentes `published`; un borrador se prueba desde el
//     panel con el endpoint de prueba, que puede elegir versión.

export const AGENT_STATUSES = ["draft", "published", "archived"];

const MAX_INSTRUCTIONS = 20_000;
const MAX_NAME = 120;
const MAX_DESCRIPTION = 500;
const MAX_MODEL = 80;

const PARAM_LIMITS = {
  temperature: [0, 2],
  top_p: [0, 1],
  max_output_tokens: [16, 128_000],
};

export const publicConfiguration = (configuration) => ({
  id: configuration.id,
  agentId: configuration.agentId,
  version: configuration.version,
  instructions: configuration.instructions,
  model: configuration.model,
  params: configuration.params,
  provider: configuration.provider,
  runtime: configuration.runtime,
  publishedAt: configuration.publishedAt,
  createdBy: configuration.createdBy,
  createdAt: configuration.createdAt,
});

export const publicAgent = (agent) => ({
  id: agent.id,
  name: agent.name,
  description: agent.description,
  status: agent.status,
  activeConfigurationId: agent.activeConfigurationId,
  activeConfiguration: agent.activeConfiguration
    ? publicConfiguration(agent.activeConfiguration)
    : undefined,
  createdAt: agent.createdAt,
  updatedAt: agent.updatedAt,
  archivedAt: agent.archivedAt,
});

// --- validación --------------------------------------------------------------

const text = (value, name, max, { required = true } = {}) => {
  if (value === undefined || value === null) {
    if (required) {
      throw ApiError.badRequest(`El campo '${name}' es obligatorio`);
    }

    return null;
  }

  if (typeof value !== "string" || (required && value.trim() === "") || value.length > max) {
    throw ApiError.badRequest(
      `El campo '${name}' debe ser texto de hasta ${max} caracteres`
    );
  }

  return value.trim();
};

export function validateParams(params = {}) {
  if (params === null || typeof params !== "object" || Array.isArray(params)) {
    throw ApiError.badRequest("El campo 'params' debe ser un objeto");
  }

  const clean = {};

  for (const [key, value] of Object.entries(params)) {
    const limits = PARAM_LIMITS[key];

    if (!limits) {
      throw ApiError.badRequest(`Parámetro no soportado: '${key}'`);
    }

    const [min, max] = limits;

    if (typeof value !== "number" || Number.isNaN(value) || value < min || value > max) {
      throw ApiError.badRequest(
        `El parámetro '${key}' debe ser un número entre ${min} y ${max}`
      );
    }

    clean[key] = value;
  }

  return clean;
}

function validateConfigurationInput(input, previous) {
  const instructions = text(input.instructions, "instructions", MAX_INSTRUCTIONS, {
    required: previous === undefined,
  });
  const model = text(input.model, "model", MAX_MODEL, { required: false });
  const available = runtimeIds();
  const runtime = input.runtime ?? previous?.runtime ?? available[0];

  if (!available.includes(runtime)) {
    throw ApiError.badRequest(
      `Runtime no soportado: '${runtime}'. Disponibles: ${available.join(", ")}`
    );
  }

  return {
    instructions: instructions ?? previous.instructions,
    model: model ?? previous?.model ?? env.openai.fallbackModel,
    params: input.params === undefined ? previous?.params ?? {} : validateParams(input.params),
    provider: "openai",
    runtime,
  };
}

// --- consultas ---------------------------------------------------------------

async function findAgent(tx, id, { includeActive = true } = {}) {
  const agent = await tx.agent.findUnique({
    where: { id },
    include: includeActive ? { activeConfiguration: true } : undefined,
  });

  if (!agent) {
    throw ApiError.notFound("El agente no existe");
  }

  return agent;
}

const nextVersion = async (tx, agentId) => {
  const last = await tx.agentConfiguration.findFirst({
    where: { agentId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  return (last?.version ?? 0) + 1;
};

export function listAgents(organizationId, { includeArchived = false } = {}) {
  return withOrganization(organizationId, async (tx) => {
    const agents = await tx.agent.findMany({
      where: includeArchived ? {} : { status: { not: "archived" } },
      include: { activeConfiguration: true },
      orderBy: { createdAt: "asc" },
    });

    return agents.map(publicAgent);
  });
}

export function getAgent(organizationId, id) {
  return withOrganization(organizationId, async (tx) => publicAgent(await findAgent(tx, id)));
}

export function listConfigurations(organizationId, agentId) {
  return withOrganization(organizationId, async (tx) => {
    await findAgent(tx, agentId, { includeActive: false });

    const configurations = await tx.agentConfiguration.findMany({
      where: { agentId },
      orderBy: { version: "desc" },
    });

    return configurations.map(publicConfiguration);
  });
}

// --- comandos ----------------------------------------------------------------

// Crea el agente con su versión 1 como borrador. `instructions` es lo único
// obligatorio: modelo y parámetros tienen valores por defecto sensatos.
export function createAgent(organizationId, input, { userId = null } = {}) {
  const name = text(input.name, "name", MAX_NAME);
  const description = text(input.description, "description", MAX_DESCRIPTION, {
    required: false,
  });
  const configuration = validateConfigurationInput(input);

  return withOrganization(organizationId, async (tx) => {
    const agent = await tx.agent.create({
      data: { organizationId, name, description, status: "draft" },
    });

    await tx.agentConfiguration.create({
      data: {
        ...configuration,
        organizationId,
        agentId: agent.id,
        version: 1,
        createdBy: userId,
      },
    });

    return publicAgent(await findAgent(tx, agent.id));
  });
}

// Nombre y descripción no se versionan: son metadatos, no comportamiento.
export function updateAgent(organizationId, id, input) {
  const data = {};

  if (input.name !== undefined) {
    data.name = text(input.name, "name", MAX_NAME);
  }

  if (input.description !== undefined) {
    data.description = text(input.description, "description", MAX_DESCRIPTION, {
      required: false,
    });
  }

  return withOrganization(organizationId, async (tx) => {
    await findAgent(tx, id, { includeActive: false });
    await tx.agent.update({ where: { id }, data });

    return publicAgent(await findAgent(tx, id));
  });
}

// Nueva versión (borrador) a partir de la última. Los campos que no se
// mandan se heredan, así que "cambiar solo las instrucciones" es un PATCH
// natural. No toca la versión publicada.
export function createConfiguration(organizationId, agentId, input, { userId = null } = {}) {
  return withOrganization(organizationId, async (tx) => {
    const agent = await findAgent(tx, agentId, { includeActive: false });

    if (agent.status === "archived") {
      throw ApiError.conflict("El agente está archivado");
    }

    const previous = await tx.agentConfiguration.findFirst({
      where: { agentId },
      orderBy: { version: "desc" },
    });

    const configuration = validateConfigurationInput(input, previous ?? undefined);

    const created = await tx.agentConfiguration.create({
      data: {
        ...configuration,
        organizationId,
        agentId,
        version: await nextVersion(tx, agentId),
        createdBy: userId,
      },
    });

    return publicConfiguration(created);
  });
}

// Publicar una versión la convierte en la activa. Sirve tanto para estrenar
// un borrador como para volver a una versión anterior (rollback).
export function publishConfiguration(organizationId, agentId, configurationId) {
  return withOrganization(organizationId, async (tx) => {
    const agent = await findAgent(tx, agentId, { includeActive: false });

    if (agent.status === "archived") {
      throw ApiError.conflict("El agente está archivado");
    }

    const configuration = await tx.agentConfiguration.findFirst({
      where: { id: configurationId, agentId },
    });

    if (!configuration) {
      throw ApiError.notFound("La versión no existe para este agente");
    }

    await tx.agentConfiguration.update({
      where: { id: configuration.id },
      data: { publishedAt: configuration.publishedAt ?? new Date() },
    });

    await tx.agent.update({
      where: { id: agentId },
      data: { status: "published", activeConfigurationId: configuration.id },
    });

    return publicAgent(await findAgent(tx, agentId));
  });
}

// Archivar no borra nada: las conversaciones siguen siendo consultables y
// el agente deja de responder por el chat.
export function archiveAgent(organizationId, id) {
  return withOrganization(organizationId, async (tx) => {
    const agent = await findAgent(tx, id, { includeActive: false });

    if (agent.status === "archived") {
      return publicAgent(await findAgent(tx, id));
    }

    await tx.agent.update({
      where: { id },
      data: { status: "archived", archivedAt: new Date() },
    });

    return publicAgent(await findAgent(tx, id));
  });
}

// Resolución para el chat: el agente pedido o, sin `agentId`, el único
// publicado de la organización. Con varios publicados hay que elegir; con
// ninguno el error dice qué hacer.
export async function resolveAgentForChat(tx, agentId) {
  if (agentId) {
    const agent = await tx.agent.findUnique({
      where: { id: agentId },
      include: { activeConfiguration: true },
    });

    if (!agent || agent.status === "archived") {
      throw ApiError.notFound("El agente no existe");
    }

    if (agent.status !== "published" || !agent.activeConfiguration) {
      throw ApiError.unprocessable(
        "El agente no tiene una versión publicada. Publicá una desde el panel."
      );
    }

    return agent;
  }

  const published = await tx.agent.findMany({
    where: { status: "published" },
    include: { activeConfiguration: true },
    take: 2,
  });

  if (published.length === 0) {
    throw ApiError.unprocessable(
      "La organización no tiene ningún agente publicado. Creá uno y publicalo desde el panel."
    );
  }

  if (published.length > 1) {
    throw ApiError.badRequest(
      "La organización tiene varios agentes publicados: indicá 'agentId'"
    );
  }

  return published[0];
}
