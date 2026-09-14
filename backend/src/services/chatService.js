import OpenAI from "openai";

import env from "../config/env.js";

// Este es el ÚNICO módulo que habla con OpenAI. El controller no sabe que
// OpenAI existe: solo pide "respondé este mensaje en esta conversación".
// Si mañana cambiamos de proveedor, se toca este archivo y ninguno más.

// Creamos el cliente de forma diferida (solo al primer uso), NO al importar el
// módulo: los `import` se resuelven antes de que corra la primera línea de
// server.js, así que un `new OpenAI()` en el nivel superior se ejecutaría antes
// de que env.js haya validado la key.
let client;

function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: env.openai.apiKey });
  }

  return client;
}

/**
 * Consume el flujo de eventos de un turno y extrae lo que nos interesa.
 *
 * El agente trabaja de forma asíncrona y emite muchos eventos (razona, llama
 * herramientas, escribe texto parcial). Nos quedamos con tres cosas: el texto
 * final, el consumo de tokens y el id de la sesión.
 *
 * @returns {Promise<{reply: string, usage: object|null, sessionId: string|null}>}
 */
async function collectTurn(events) {
  const parts = [];
  let usage = null;
  let sessionId = null;

  for await (const event of events) {
    // El id de sesión viaja en los eventos. Al crear una sesión nueva es la
    // única forma de conocerlo, así que lo capturamos del primero que lo traiga.
    if (!sessionId) {
      sessionId = event.session_id ?? event.session?.id ?? null;
    }

    switch (event.type) {
      // Texto completo de un mensaje del agente. Un turno puede producir
      // más de uno, por eso acumulamos en vez de sobrescribir.
      case "agent.session.turn.output_text.done":
        parts.push(event.text);
        break;

      // El turno terminó bien: acá viene el consumo de tokens.
      case "agent.session.turn.completed":
        usage = event.usage ?? null;
        break;

      // El turno o la sesión fallaron: cortamos con un error explícito en
      // vez de devolver una respuesta vacía que confundiría al usuario.
      case "agent.session.turn.failed":
      case "agent.session.failed":
        throw new Error(
          event.session?.error ?? "El agente no pudo completar la respuesta"
        );

      default:
        // El resto de eventos (razonamiento, llamadas a tools, deltas de
        // texto parcial) no los necesitamos para una respuesta no-streaming.
        break;
    }
  }

  return { reply: parts.join("\n\n").trim(), usage, sessionId };
}

/**
 * Espera a que la sesión esté lista para recibir un turno nuevo.
 *
 * `stream()` exige una sesión en estado `idle`. Normalmente ya lo está al
 * terminar el turno anterior, pero la Agents API está en beta y a veces el
 * estado tarda un instante en propagarse: sin esta espera, el turno siguiente
 * falla con "Session event stream ended before the turn reached idle".
 */
async function waitForIdle(openai, sessionId, { attempts = 15 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const session = await openai.beta.agents.sessions.retrieve(sessionId);

    if (session.status === "idle") {
      return;
    }

    if (session.status === "failed") {
      throw new Error(session.error ?? "La sesión del agente falló");
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("La sesión del agente no quedó disponible a tiempo");
}

/**
 * Envía un mensaje al agente y devuelve su respuesta.
 *
 * A diferencia del enfoque anterior con la Responses API, acá NO reenviamos
 * el historial: la Agents API guarda la conversación del lado de OpenAI en
 * una "sesión". El cliente solo necesita conservar el `sessionId` y mandarlo
 * en los turnos siguientes.
 *
 * @param {string} message Texto del usuario.
 * @param {string} [sessionId] Sesión existente. Si falta, se crea una nueva.
 * @returns {Promise<{reply: string, sessionId: string, usage: object|null}>}
 */
export async function sendMessageToAgent(message, sessionId) {
  const openai = getClient();

  // --- Turnos siguientes: la sesión ya existe ---
  if (sessionId) {
    // Nos aseguramos de que la sesión acepte input antes de escribir en ella.
    await waitForIdle(openai, sessionId);

    // stream() abre un turno nuevo sobre la sesión. Aunque internamente use
    // streaming, acá consumimos todos los eventos y devolvemos el texto final:
    // el contrato con el frontend sigue siendo una respuesta simple.
    //
    // El reintento cubre un fallo intermitente de la beta: el stream puede
    // cortarse antes de que el turno termine. Reintentamos UNA vez; si vuelve
    // a fallar, dejamos que el error suba al middleware.
    let turn;

    try {
      turn = await collectTurn(
        openai.beta.agents.sessions.stream(sessionId, { input: message })
      );
    } catch (error) {
      console.warn(
        `[chatService] El turno se cortó (${error.message}). Reintentando…`
      );

      await waitForIdle(openai, sessionId);

      turn = await collectTurn(
        openai.beta.agents.sessions.stream(sessionId, { input: message })
      );
    }

    return { reply: turn.reply, sessionId, usage: turn.usage };
  }

  // --- Primer turno: creamos la sesión CON el mensaje incluido ---
  //
  // El `input` va en la propia creación: una sesión sin entorno de ejecución
  // ("conversation-only") no se puede crear vacía, la API la rechaza con
  // "conversation-only sessions currently require initial input".
  const events = await openai.beta.agents.sessions.create({
    // Referenciamos el agente guardado por su ID. Al NO pasar el campo
    // `agent`, su configuración (modelo, instructions, knowledge, tools)
    // se usa tal cual está en la plataforma.
    agent_id: env.openai.agentId,

    // `environment` es obligatorio. "none" = el agente razona y usa sus
    // herramientas remotas, pero no ejecuta comandos ni edita archivos.
    // Un asistente de preguntas frecuentes no necesita sandbox, así que no
    // hace falta ningún entorno hospedado ni self-hosted.
    environment: { type: "none" },

    input: message,

    // stream: true devuelve los eventos del primer turno, así reutilizamos
    // el mismo collectTurn que en los turnos siguientes.
    stream: true,
  });

  const turn = await collectTurn(events);

  return {
    reply: turn.reply,
    sessionId: turn.sessionId,
    usage: turn.usage,
  };
}
