import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import OpenAI from "openai";

import env from "../config/env.js";

// Modo de respaldo: habla con la Responses API en vez de la Agents API.
//
// POR QUÉ EXISTE
// La Agents API está en beta y puede dejar de procesar turnos (las sesiones
// se quedan en `in_progress` indefinidamente). Cuando eso pasa, este modo
// mantiene el chat funcionando.
//
// QUÉ SE PIERDE respecto al agente:
//   - El knowledge del agente: acá solo van las instructions.
//   - La memoria del lado del servidor: la Responses API no tiene sesiones,
//     así que el historial lo reenvía el cliente en cada turno (que es como
//     funcionaba este backend antes de migrar a agentes).
//
// Se activa con CHAT_MODE=responses en el .env.

let client;

function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: env.openai.apiKey });
  }

  return client;
}

// Las instructions se leen del archivo una sola vez, no en cada petición.
// El archivo se genera desde el agente real (ver README): así no duplicamos
// el texto dentro del código.
let instructions;

function getInstructions() {
  if (instructions === undefined) {
    const here = dirname(fileURLToPath(import.meta.url));

    try {
      instructions = readFileSync(
        join(here, "..", "config", "fallbackInstructions.txt"),
        "utf8"
      ).trim();
    } catch {
      // Sin archivo, el asistente responde igual pero sin personalidad
      // definida. Preferimos eso a que el backend no arranque.
      instructions =
        "Eres un asistente conversacional útil y conciso. " +
        "Respondes en el idioma en que te escriban.";
    }
  }

  return instructions;
}

// Ventana deslizante: cuántos mensajes del historial se envían como máximo.
// La Responses API no tiene memoria, así que el historial viaja completo en
// cada llamada; sin tope acabaríamos superando la ventana de contexto.
const MAX_HISTORY = 20;

/**
 * Envía un mensaje usando la Responses API.
 *
 * Mantiene la MISMA firma que `sendMessageToAgent` para que el controller
 * no tenga que saber qué modo está activo.
 *
 * @param {string} message Texto del usuario.
 * @param {string} [sessionId] Se ignora: este modo no usa sesiones.
 * @param {Array<{role: string, content: string}>} [history]
 *   Historial que manda el cliente. Sin él, cada mensaje es independiente.
 * @param {{apiKey?: string}} [options]
 *   `apiKey`: clave de la organización (BYOK). Sin ella se usa la del
 *   proceso. No se cachea un cliente por organización: el SDK es barato de
 *   construir y así la clave no queda retenida en memoria más que el turno.
 * @returns {Promise<{reply: string, sessionId: string|null, usage: object}>}
 */
export async function sendMessageViaResponses(
  message,
  sessionId,
  history = [],
  { apiKey } = {}
) {
  const input = [
    ...history.slice(-MAX_HISTORY),
    { role: "user", content: message },
  ];

  const client = apiKey ? new OpenAI({ apiKey }) : getClient();

  const response = await client.responses.create({
    model: env.openai.fallbackModel,
    instructions: getInstructions(),
    input,
  });

  return {
    reply: response.output_text,

    // No hay sesión que devolver: en este modo la memoria la lleva el
    // cliente. Lo dejamos en null para que el frontend no guarde un id
    // que luego no serviría al volver al modo agentes.
    sessionId: null,

    usage: response.usage,
  };
}
