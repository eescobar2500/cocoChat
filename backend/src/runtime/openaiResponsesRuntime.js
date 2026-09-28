import OpenAI from "openai";

// Implementación de referencia de `AgentRuntime`: la Responses API de
// OpenAI. Es sin estado, así que encaja con "el agente vive en CocoChat":
// en cada turno se le manda lo que el orquestador decide (instrucciones,
// parámetros e historial) y el proveedor solo genera texto.
//
// No se cachea un cliente por organización: el SDK es barato de construir
// y así la clave BYOK no queda retenida en memoria más que el turno.

const NUMERIC_PARAMS = ["temperature", "top_p", "max_output_tokens"];

function pickParams(params) {
  const picked = {};

  for (const key of NUMERIC_PARAMS) {
    if (typeof params?.[key] === "number") {
      picked[key] = params[key];
    }
  }

  return picked;
}

export const openaiResponsesRuntime = {
  id: "openai_responses",
  provider: "openai",

  async run({ configuration, apiKey, messages }) {
    const client = new OpenAI({ apiKey });

    const response = await client.responses.create({
      model: configuration.model,
      instructions: configuration.instructions,
      input: messages.map(({ role, content }) => ({ role, content })),
      ...pickParams(configuration.params),
    });

    return {
      reply: response.output_text,
      usage: response.usage ?? null,
      providerRef: response.id ?? null,
    };
  },
};
