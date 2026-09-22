# ADR-0005 — Persistencia propia y abstracción del proveedor de modelo

- **Estado**: Propuesto
- **Fecha**: 2026-01
- **Ámbito**: Datos y dependencias externas

## Contexto

CocoChat no tiene base de datos. Todo el estado vive en OpenAI (agentes,
sesiones, conversaciones) o en el `localStorage` del navegador del usuario
(`frontend/src/hooks/useChat.js`). Las dependencias del backend son tres:
`express`, `cors` y `openai`.

Además, el sistema depende de una API **en beta** cuyos fallos ya están
documentados dentro del propio código: sesiones que se quedan en
`in_progress`, una espera activa a que la sesión vuelva a `idle`, un reintento
por turno y un módulo completo de limpieza de sesiones atascadas. El modo
`responses` existe precisamente como plan B.

## Problema

Dos decisiones acopladas: (a) si CocoChat debe guardar estado propio, y (b)
cómo se reduce la dependencia de una API en beta que hoy sostiene el producto
entero.

## Alternativas

**Persistencia**

1. Seguir sin base de datos y apoyarse en las APIs del proveedor. Coste cero,
   pero impide facturar por uso, auditar, aislar tenants y mostrar histórico;
   y la Conversations API de OpenAI ni siquiera permite listar conversaciones
   (documentado en `backend/src/services/conversationService.js`).
2. PostgreSQL. Relacional, JSONB para esquemas, RLS para aislamiento, madurez
   operativa.
3. MongoDB. Cómodo para configuraciones heterogéneas, más débil justo donde
   este dominio es relacional (organización → agente → herramienta → ejecución)
   y sin equivalente directo de RLS.
4. SQLite. Suficiente para un piloto local, inadecuado para varias instancias.

**Runtime del modelo**

1. Seguir con el `if` sobre `CHAT_MODE` en el controller.
2. Extraer un puerto `AgentRuntime` con dos implementaciones.
3. Adoptar una librería de orquestación de terceros (LangChain y similares).

## Decisión

- **PostgreSQL** como base única del MVP (opción 2), con JSONB para esquemas
  de herramientas y configuración de agentes, y RLS según ADR-0002.
- **Extraer el puerto `AgentRuntime`** (opción 2) con las dos
  implementaciones que ya existen, seleccionadas por configuración **de
  organización** y no de proceso. Esto convierte el plan B actual en una
  capacidad del producto y abre la puerta a otro proveedor sin tocar el
  orquestador.
- **No** adoptar una librería de orquestación por ahora: añade una capa de
  abstracción sobre otra que cambia rápido, y el bucle de *tool calling* que
  se necesita es pequeño y conviene que sea explícito y auditable.
- La verdad sobre conversaciones y mensajes pasa a estar **en CocoChat**. El
  estado del proveedor (`sess_…`, `conv_…`) se guarda como referencia externa,
  no como fuente de verdad.

## Consecuencias

**Positivas**: se puede facturar, auditar, aislar y mostrar histórico; el
producto sobrevive a un cambio de API del proveedor; el modo de respaldo deja
de ser un interruptor global.

**Negativas**: aparece una base de datos que operar, migraciones que gestionar
y datos de conversaciones que custodiar —con las obligaciones de privacidad
que eso conlleva—. Hay duplicidad de estado entre CocoChat y el proveedor, con
riesgo de divergencia; se acota guardando solo referencias y no intentando
sincronizar.

## Riesgos

- **Custodia de datos personales** en las conversaciones: exige política de
  retención, borrado por petición y cifrado en reposo. Es un requisito legal,
  no una mejora.
- **Migraciones con RLS** mal configuradas que bloqueen despliegues.
  Mitigación: rol de migración separado y probado en CI.
- **Coste de almacenamiento de logs de ejecución**: particionado por fecha y
  retención por plan desde el primer día.
