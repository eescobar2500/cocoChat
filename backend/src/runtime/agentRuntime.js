import { openaiResponsesRuntime } from "./openaiResponsesRuntime.js";

// Puerto `AgentRuntime` (ADR-0005).
//
// Un runtime recibe la configuración del agente (datos de CocoChat), la
// credencial del proveedor ya resuelta y el historial, y devuelve el texto
// del turno con su consumo. El orquestador no sabe qué proveedor hay detrás
// ni cómo se llama a su API; el runtime no sabe de organizaciones, base de
// datos ni credenciales cifradas.
//
// Contrato:
//   run({ configuration, apiKey, messages }) ->
//     Promise<{ reply: string, usage: object|null, providerRef: string|null }>
//
//   - `configuration`: fila de `agent_configurations` (instructions, model,
//     params, runtime).
//   - `messages`: turnos previos + el actual, `{ role, content }`, ya
//     recortados por el orquestador.
//   - `providerRef`: identificador que el proveedor haya dado a la respuesta
//     (`resp_…`), solo como referencia para soporte.

const runtimes = new Map([[openaiResponsesRuntime.id, openaiResponsesRuntime]]);

export const runtimeIds = () => [...runtimes.keys()];

// Permite añadir implementaciones (otro proveedor, un doble en tests) sin
// tocar el orquestador.
export function registerRuntime(runtime) {
  runtimes.set(runtime.id, runtime);
}

export function getRuntime(id) {
  const runtime = runtimes.get(id);

  if (!runtime) {
    throw new Error(`Runtime de agente desconocido: ${id}`);
  }

  return runtime;
}
