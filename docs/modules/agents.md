# Módulo: Agentes

**Estado global: `PARCIAL`.** Existe exactamente un agente, definido fuera del
sistema y compartido por todo el despliegue.

## Objetivo

Permitir que cada organización cree, configure, pruebe, publique y versione
sus propios agentes conversacionales.

## Estado actual

| Elemento | Estado | Evidencia |
|---|---|---|
| Un agente por proceso | `IMPLEMENTADO` | `OPENAI_AGENT_ID` obligatorio en `backend/src/config/env.js` |
| Conversar con el agente | `IMPLEMENTADO` | `POST /api/chat` → `backend/src/services/chatService.js` |
| Dos runtimes intercambiables | `IMPLEMENTADO` | `CHAT_MODE` selecciona `agents` o `responses` en `backend/src/controllers/chatController.js` |
| Reintento y espera de sesión ocupada | `IMPLEMENTADO` | `waitForIdle` en `chatService.js` |
| Consultar agentes existentes | `PARCIAL` | `GET /api/agents` solo lista los de la cuenta de OpenAI |
| Crear o editar agentes | No existe | Se hace en el panel de OpenAI, a mano |
| Instrucciones gestionadas por el cliente | No existe | Viven en OpenAI, salvo el texto de respaldo de `responsesChatService.js` |
| Versionado, borrador y publicación | No existe | — |
| Herramientas | No existe | El agente no puede invocar nada |

La consecuencia práctica: **CocoChat no gestiona agentes, los usa.** Cambiar
el comportamiento del asistente exige entrar en OpenAI y reiniciar el proceso
con otro identificador.

## Requisitos funcionales

| ID | Requisito | Estado | Prioridad |
|---|---|---|---|
| RF-AG-01 | CRUD de agentes dentro de una organización | `PROPUESTO` | MVP |
| RF-AG-02 | Configuración versionada: instrucciones, modelo, parámetros | `PROPUESTO` | MVP |
| RF-AG-03 | Estados borrador / publicado / archivado | `PROPUESTO` | MVP |
| RF-AG-04 | Volver a una versión anterior | `PROPUESTO` | MVP |
| RF-AG-05 | Probar un agente en el panel sin afectar a producción | `PROPUESTO` | MVP |
| RF-AG-06 | Autorizar herramientas concretas a un agente | `PROPUESTO` | MVP |
| RF-AG-07 | El runtime se elige por organización, no por variable de entorno | `PROPUESTO` | MVP |
| RF-AG-08 | Bucle de llamada a herramientas con tope de iteraciones | `PROPUESTO` | MVP |
| RF-AG-09 | Consumo y latencia por agente | `PROPUESTO` | MVP |
| RF-AG-10 | Varios agentes por organización con enrutado por canal | `PROPUESTO` | Post-MVP |
| RF-AG-11 | Agentes que delegan en otros agentes | `PROPUESTO` | Post-MVP |

## Casos de uso

**CU-AG-01 — Crear el agente de reservas.** Marta crea el agente, escribe sus
instrucciones, lo guarda como borrador, le autoriza la herramienta
`consultar_disponibilidad` que publicó Diego, lo prueba en el panel y lo
publica.

**CU-AG-02 — Un turno con herramienta.** Llega el mensaje del usuario; se
resuelve el agente de la organización y su configuración activa; se envían al
runtime las herramientas autorizadas; el modelo pide una; el ejecutor la
valida, la ejecuta y devuelve el resultado; el modelo redacta la respuesta.
Todo el turno queda registrado.
*Alternativas*: la herramienta falla → el agente informa de que no puede
consultarlo ahora y **no inventa**; se supera el tope de iteraciones → se
corta el turno y se registra.

**CU-AG-03 — Revertir un cambio.** Una instrucción nueva empeora las
respuestas; Marta vuelve a la versión anterior y el cambio surte efecto en el
siguiente turno. Las conversaciones antiguas siguen indicando con qué versión
se generaron.

## Reglas de negocio

1. Un agente solo puede usar herramientas de su propia organización y
   explícitamente autorizadas.
2. Las configuraciones publicadas son inmutables; editar crea una versión
   nueva. Sin esto no hay explicabilidad ni *rollback*.
3. Un agente archivado no atiende conversaciones nuevas, pero su historial se
   conserva.
4. Si una herramienta falla, el agente debe reconocer la limitación. Inventar
   el dato es el peor fallo posible del producto.
5. Todo turno tiene tope de iteraciones de herramientas y presupuesto máximo.

## Dependencias

Depende de: Organizaciones, Autorización, Conectores (para las herramientas).
Se apoya en: el puerto `AgentRuntime`
([ADR-0005](../architecture/architecture-decisions/ADR-0005-persistencia-y-runtime.md)).

## Riesgos

- La Agents API que usa hoy `chatService.js` es beta; la abstracción de
  runtime es la defensa.
- El bucle de herramientas es la pieza con más casos límite del sistema
  (bucles infinitos, argumentos inválidos, respuestas enormes, latencia
  acumulada). Merece pruebas propias desde el primer día.
- Reutilizable tal cual: la validación de entrada de
  `backend/src/utils/validations/chatValidation.js` y el tratamiento de
  errores de `backend/src/middleware/errorHandle.js`.
