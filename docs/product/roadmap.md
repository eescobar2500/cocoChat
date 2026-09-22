# Roadmap técnico por etapas

> **Actualizado 2026-09** con las decisiones tomadas (Modelo A, BYOK, solo
> lectura, agentes en CocoChat, Prisma). Queda **una** decisión bloqueante:
> P12, la gestión de secretos, necesaria para la Etapa 1.
>
> Ninguna etapa se inicia sin validar antes las
> [preguntas abiertas](../open-questions.md) que la bloquean.
>
> Las etapas están ordenadas por dependencia, no por fecha. No se dan plazos:
> con el equipo y la disponibilidad sin definir, cualquier fecha sería
> inventada. Cada etapa indica en cambio **qué la bloquea** y **cómo se sabe
> que terminó**.

## Principio rector

Cada etapa debe dejar el sistema funcionando y aportar valor por sí sola.
Nada de "seis etapas y en la séptima se ve algo". La funcionalidad actual
—chat contra un agente— no puede romperse en ninguna de ellas.

---

## Etapa 0 — Endurecer lo que ya existe

**Por qué primero**: hoy `POST /api/chat` es público, sin autenticación ni
límite de peticiones, con CORS abierto y usando una key de pago. Es un riesgo
económico inmediato, y no depende de ninguna decisión de producto.

- Restringir CORS por lista de orígenes.
- Límite de peticiones por IP en `/api/chat`.
- Tope de gasto y alerta de consumo en el panel de OpenAI (mientras la clave
  siga siendo nuestra; con BYOK pasará a ser del cliente).
- Persistir el `usage` que la API ya devuelve y hoy se descarta (es el dato
  que hace falta para todo el análisis económico posterior).
- Comparar `x-admin-token` en tiempo constante.
- Pruebas automatizadas mínimas: no hay ninguna, y las etapas siguientes
  tocan seguridad.

**Bloqueada por**: nada. Puede empezar hoy.
**Terminada cuando**: un tercero no puede consumir la key, y cada turno queda
registrado con su consumo.

---

## Etapa 1 — Persistencia y multi-tenancy

**Por qué**: todo lo demás cuelga de aquí. Sin organizaciones no hay agentes
por cliente, ni conectores, ni auditoría.

- PostgreSQL con **Prisma** y sus migraciones; `organizations`, `users`,
  `memberships`, `api_keys`, `provider_credentials`.
- Cifrado de secretos según lo que se decida en P12, y alta de la clave de
  OpenAI del cliente (BYOK) con validación al guardarla.
- Autenticación de usuarios y de servicio; `x-admin-token` pasa a ser solo
  para operación interna.
- `organization_id` en todo, RLS activada
  ([ADR-0002](../architecture/architecture-decisions/ADR-0002-multi-tenancy.md))
  con las tres condiciones de Prisma
  ([ADR-0007](../architecture/architecture-decisions/ADR-0007-prisma-como-capa-de-datos.md)):
  rol sin `BYPASSRLS`, contexto por transacción y acceso encapsulado.
- Conversaciones y mensajes propios; los IDs de OpenAI quedan como
  referencias.

**Bloqueada por**: P12 (gestión de secretos). El modelo de producto ya está
decidido ([ADR-0006](../architecture/architecture-decisions/ADR-0006-modelo-de-producto-y-costes.md)).
**Terminada cuando**: dos organizaciones conviven en el mismo despliegue sin
poder verse, y existe una prueba automatizada que lo demuestra.

---

## Etapa 2 — Agentes gestionados por el cliente

**Por qué**: es el primer momento en que el cliente configura algo sin
intervención nuestra.

- `agents` y `agent_configurations` versionadas.
- Extracción del puerto `AgentRuntime`
  ([ADR-0005](../architecture/architecture-decisions/ADR-0005-persistencia-y-runtime.md)),
  con la Responses API como implementación de referencia. **El agente pasa a
  vivir en CocoChat**: instrucciones, parámetros y herramientas son datos
  propios, y `OPENAI_AGENT_ID` desaparece del camino principal.
- La credencial del proveedor se resuelve por organización, no desde el
  entorno del proceso.
- CRUD de agentes y panel mínimo de administración.
- El chat resuelve el agente por organización, no por `.env`.

**Bloqueada por**: Etapa 1.
**Terminada cuando**: un cliente crea un agente, edita sus instrucciones,
publica una versión, vuelve a la anterior y conversa con él.

---

## Etapa 3 — Conectores de solo lectura (el MVP real)

**Por qué**: aquí es donde el producto deja de ser un chatbot.

- `connectors`, `connector_credentials` cifradas, `tool_definitions`,
  `agent_tools`.
- Driver HTTP declarativo, **solo lectura**
  ([ADR-0004](../architecture/architecture-decisions/ADR-0004-motor-de-conectores.md)).
- Validación de destino y defensas anti-SSRF, timeouts y límites de tamaño.
- Bucle de llamada a herramientas en el runtime.
- `execution_logs` y su vista en el panel.
- Banco de pruebas de herramientas antes de publicar.

**Bloqueada por**: Etapa 2, y por la validación del contrato de conectores
([`../api/integrations.md`](../api/integrations.md)) con un cliente real.
**Terminada cuando**: el caso de la peluquería funciona de extremo a extremo
—"¿hay hueco el martes?" consulta el backend real y responde— y cada llamada
aparece registrada.

---

## Etapa 4 — Incorporación autónoma

**Por qué**: la métrica de la visión es el tiempo hasta el primer agente útil.
Si hace falta que nosotros configuremos cada cliente, no hay producto
escalable.

- Importación desde OpenAPI para generar borradores de herramientas.
- Asistente de alta, documentación para desarrolladores, entorno de pruebas.
- Comprobación de salud de conectores y alertas.
- Cuotas y panel de consumo por organización.

**Bloqueada por**: Etapa 3 y los resultados de los pilotos.
**Terminada cuando**: un cliente nuevo llega a su primera respuesta con datos
reales sin hablar con nosotros.

---

## Etapa 5 — Acciones con efectos

**Por qué**: reservar vale más que consultar. Y rompe más cosas: por eso va
después, y no antes.

- Herramientas con efectos secundarios, idempotencia y claves de
  deduplicación.
- Confirmación explícita del usuario antes de ejecutar.
- Compensación y reintentos seguros.
- Auditoría reforzada.

**Bloqueada por**: Etapa 3 en producción estable y una política clara de
responsabilidad ante una acción errónea (pregunta abierta).
**Terminada cuando**: un agente crea una reserva real, el usuario la confirma
antes y el reintento no duplica.

---

## Etapa 6 — Ampliación del ecosistema

**Por qué**: solo cuando el núcleo es estable y hay demanda que lo justifique.

- Driver MCP para clientes que ya lo hablen.
- Contrato fijo para backends complejos.
- Webhooks y eventos entrantes.
- Canales adicionales (WhatsApp, Slack, widget embebible).
- Plan dedicado o ejecutor autoalojado, según lo que pidan los clientes.

**Bloqueada por**: demanda demostrada. Sin ella, esta etapa es trabajo
desperdiciado.

---

## Riesgos que pueden alterar el orden

| Riesgo | Efecto | Mitigación |
|---|---|---|
| La Agents API es beta y puede cambiar | Rotura del núcleo actual | Mitigado: deja de ser el camino principal en la Etapa 2 |
| RLS mal montada sobre Prisma (rol con `BYPASSRLS`, `set_config` fuera de transacción) | Fuga entre tenants, y silenciosa | Prueba de aislamiento y comprobación al arrancar (ADR-0007) |
| Clientes que abandonan el alta al pedirles su clave de OpenAI | Embudo roto | Medir en los pilotos; clave de plataforma con tope para el entorno de pruebas |
| Fuga de la clave de OpenAI de un cliente | Gasto directo para él y daño reputacional | Cifrado por sobre, sin lectura por API, rotación y alerta de uso anómalo |
| Los pilotos revelan que el HTTP declarativo no cubre sus backends | Etapa 3 mal enfocada | Validar el contrato con backends reales **antes** de construir el motor |
| El precio de la membresía no cubre el coste de operar y dar soporte | Modelo económico roto | Medir coste de soporte por cliente en los pilotos |
