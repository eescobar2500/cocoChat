import OpenAI from "openai";

import env from "../config/env.js";

// Administración de las sesiones del agente.
//
// Una "sesión" es una conversación viva del lado de OpenAI. Si un turno se
// interrumpe, la sesión puede quedarse en `in_progress` o `requires_action`
// indefinidamente: ocupa una ranura de concurrencia y no se puede borrar
// (la API exige que esté `idle` o `failed` para eliminarla).
//
// Este módulo permite listarlas, cancelar su turno activo y borrarlas.
//
// OJO con la terminología: esto NO borra agentes. El agente
// (OPENAI_AGENT_ID) guarda las instructions, el knowledge y las tools:
// borrarlo destruiría esa configuración. Lo que se limpia son sesiones.

let client;

function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: env.openai.apiKey });
  }

  return client;
}

// Estados desde los que la API permite borrar una sesión.
const DELETABLE = new Set(["idle", "failed"]);

// Una sesión se considera atascada si lleva demasiado tiempo sin actividad
// y no está en un estado terminal. El umbral evita cancelar turnos que
// simplemente están tardando (el agente puede tardar 10-20 s por respuesta).
const STUCK_AFTER_SECONDS = 180;

function isStuck(session, now) {
  return (
    !DELETABLE.has(session.status) &&
    now - session.last_active_at > STUCK_AFTER_SECONDS
  );
}

/**
 * Devuelve las sesiones de la cuenta con un resumen por estado.
 *
 * @param {{limit?: number}} [options]
 */
export async function listSessions({ limit = 100 } = {}) {
  const openai = getClient();
  const now = Date.now() / 1000;

  const sessions = [];

  for await (const session of openai.beta.agents.sessions.list({ limit })) {
    sessions.push({
      id: session.id,
      status: session.status,
      agentId: session.agent?.id ?? null,
      environment: session.environment?.type ?? null,
      createdAt: session.created_at,
      lastActiveAt: session.last_active_at,
      idleSeconds: Math.round(now - session.last_active_at),
      stuck: isStuck(session, now),
      error: session.error ?? null,
    });

    if (sessions.length >= limit) {
      break;
    }
  }

  const byStatus = sessions.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    total: sessions.length,
    byStatus,
    stuck: sessions.filter((s) => s.stuck).length,
    sessions,
  };
}

/**
 * Cancela el turno activo de una sesión.
 *
 * No existe un método `sessions.cancel()`: la cancelación se envía como un
 * EVENTO a la sesión. Si el turno estaba corriendo, pasa a `cancelled` y la
 * sesión vuelve a `idle`, momento en que ya se puede borrar.
 *
 * @param {string} sessionId
 */
export async function cancelSession(sessionId) {
  await getClient().beta.agents.sessions.events.create(sessionId, {
    events: [{ type: "agent.session.input.cancel" }],
  });
}

/**
 * Borra una sesión. Solo funciona si está `idle` o `failed`.
 *
 * @param {string} sessionId
 */
export async function deleteSession(sessionId) {
  await getClient().beta.agents.sessions.delete(sessionId);
}

/**
 * Limpia las sesiones atascadas: cancela su turno y las borra.
 *
 * El proceso es en dos fases porque la cancelación no es inmediata: OpenAI
 * necesita un momento para cerrar el turno y devolver la sesión a `idle`.
 * Entre fases esperamos y volvemos a consultar el estado real, en vez de
 * asumir que el cancel funcionó.
 *
 * @param {{dryRun?: boolean, waitMs?: number}} [options]
 *   dryRun: solo informa qué se haría, sin tocar nada.
 */
export async function cleanupSessions({ dryRun = false, waitMs = 8000 } = {}) {
  const openai = getClient();
  const { sessions } = await listSessions();

  const stuck = sessions.filter((s) => s.stuck);
  const deletable = sessions.filter((s) => DELETABLE.has(s.status));

  if (dryRun) {
    return {
      dryRun: true,
      wouldCancel: stuck.map((s) => s.id),
      wouldDelete: deletable.map((s) => s.id),
    };
  }

  const result = {
    cancelled: [],
    deleted: [],
    failed: [],
  };

  // --- Fase 1: cancelar el turno de las atascadas ---
  for (const session of stuck) {
    try {
      await cancelSession(session.id);
      result.cancelled.push(session.id);
    } catch (error) {
      result.failed.push({
        id: session.id,
        step: "cancel",
        reason: error.message,
      });
    }
  }

  // --- Fase 2: borrar lo que haya quedado en estado borrable ---
  //
  // Damos tiempo a que las cancelaciones surtan efecto antes de releer.
  if (result.cancelled.length > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const { sessions: after } = await listSessions();

  for (const session of after) {
    if (!DELETABLE.has(session.status)) {
      continue;
    }

    try {
      await openai.beta.agents.sessions.delete(session.id);
      result.deleted.push(session.id);
    } catch (error) {
      result.failed.push({
        id: session.id,
        step: "delete",
        reason: error.message,
      });
    }
  }

  // Estado final para que quien llame sepa qué quedó pendiente.
  const { byStatus, stuck: stillStuck } = await listSessions();

  return {
    ...result,
    remaining: byStatus,
    stillStuck,
  };
}

// ---------------------------------------------------------------------
// Agentes
//
// Un agente guarda las instructions, el knowledge y las tools. Borrarlo
// es IRREVERSIBLE y no se puede deshacer desde la API: por eso el
// controller exige confirmación explícita antes de llamar acá.
// ---------------------------------------------------------------------

/**
 * Lista los agentes de la cuenta.
 */
export async function listAgents() {
  const openai = getClient();
  const agents = [];

  for await (const agent of openai.beta.agents.list()) {
    agents.push({
      id: agent.id,
      name: agent.name ?? null,
      model: agent.model ?? null,
      tools: agent.tools?.map((t) => t.type) ?? [],
      instructionsLength: agent.instructions?.length ?? 0,
      // Marcamos el que usa el backend: borrarlo dejaría el chat sin agente.
      inUse: agent.id === env.openai.agentId,
    });

    if (agents.length >= 100) {
      break;
    }
  }

  return { total: agents.length, agents };
}

/**
 * Devuelve la configuración completa de un agente. Útil para respaldar
 * sus instructions antes de borrarlo.
 *
 * @param {string} agentId
 */
export async function getAgent(agentId) {
  return getClient().beta.agents.retrieve(agentId);
}

/**
 * Elimina un agente.
 *
 * @param {string} agentId
 * @returns {Promise<{id: string, name: string|null, instructionsLength: number}>}
 *   Un resumen de lo que se borró, para poder registrarlo.
 */
export async function deleteAgent(agentId) {
  const openai = getClient();

  // Lo leemos ANTES de borrar: después ya no habría forma de saber qué
  // contenía, y ese resumen es lo único que queda en el log.
  const agent = await openai.beta.agents.retrieve(agentId);

  await openai.beta.agents.delete(agentId);

  return {
    id: agent.id,
    name: agent.name ?? null,
    model: agent.model ?? null,
    instructionsLength: agent.instructions?.length ?? 0,
  };
}
