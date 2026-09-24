import { appendFile } from "node:fs/promises";

import env from "../config/env.js";
import { withOrganization } from "../db/prisma.js";

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

export function buildUsageRecord({
  usage,
  mode,
  sessionId,
  durationMs,
  organizationId = null,
}) {
  return {
    type: "usage",
    at: new Date().toISOString(),
    mode,
    organizationId,
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

  // Perder una métrica no puede tumbar una conversación que ya se pagó.
  try {
    if (record.organizationId) {
      // Con organización el consumo va a la base: es el dato de la
      // facturación y del control de abuso por tenant.
      await withOrganization(record.organizationId, (tx) =>
        tx.usageRecord.create({
          data: {
            organizationId: record.organizationId,
            mode: record.mode,
            sessionId: record.sessionId,
            durationMs: record.durationMs,
            inputTokens: record.inputTokens,
            outputTokens: record.outputTokens,
            totalTokens: record.totalTokens,
          },
        })
      );
    } else if (env.usageLogFile) {
      await appendFile(env.usageLogFile, `${line}\n`);
    }
  } catch (error) {
    console.error(`[usageService] No se pudo escribir el consumo: ${error.message}`);
  }

  return record;
}

export default recordUsage;
