import { appendFile } from "node:fs/promises";

import env from "../config/env.js";

// Registro del consumo de tokens de cada turno.
//
// La API ya devuelve `usage` en cada respuesta y hasta ahora se descartaba.
// Es el único dato que permite saber cuánto cuesta de verdad una
// conversación, que es la pregunta que hay que responder antes de fijar
// precios. Mientras no haya base de datos, cada turno se escribe como una
// línea JSON: en stdout siempre, y además en un archivo si se configura
// USAGE_LOG_FILE.
//
// No se registra el texto del mensaje: solo métricas.

// Las dos APIs nombran distinto lo mismo: la Responses API usa
// `input_tokens` y la Agents API puede devolver `prompt_tokens`.
const pickNumber = (usage, ...keys) => {
  for (const key of keys) {
    if (typeof usage?.[key] === "number") {
      return usage[key];
    }
  }

  return null;
};

export function buildUsageRecord({ usage, mode, sessionId, durationMs }) {
  return {
    type: "usage",
    at: new Date().toISOString(),
    mode,
    sessionId: sessionId ?? null,
    durationMs,
    inputTokens: pickNumber(usage, "input_tokens", "prompt_tokens"),
    outputTokens: pickNumber(usage, "output_tokens", "completion_tokens"),
    totalTokens: pickNumber(usage, "total_tokens"),
  };
}

export async function recordUsage(details) {
  const record = buildUsageRecord(details);
  const line = JSON.stringify(record);

  console.log(line);

  if (!env.usageLogFile) {
    return record;
  }

  try {
    await appendFile(env.usageLogFile, `${line}\n`);
  } catch (error) {
    // Perder una métrica no puede tumbar una conversación que ya se pagó.
    console.error(`[usageService] No se pudo escribir el consumo: ${error.message}`);
  }

  return record;
}

export default recordUsage;
