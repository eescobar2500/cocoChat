# Módulo: Conversaciones

**Estado global: `PARCIAL`.** Las conversaciones funcionan, pero CocoChat no
las guarda: viven en OpenAI y en el navegador.

## Objetivo

Gestionar los hilos de conversación entre usuarios finales y agentes, con
histórico propio, trazabilidad y retención controlada.

## Estado actual

| Elemento | Estado | Evidencia |
|---|---|---|
| Turno de conversación | `IMPLEMENTADO` | `POST /api/chat` |
| Continuidad por sesión | `IMPLEMENTADO` | `sessionId` devuelto y reenviado (`frontend/src/hooks/useChat.js`) |
| Historial enviado al modelo (modo `responses`) | `IMPLEMENTADO` | Hasta 50 mensajes, `backend/src/utils/validations/chatValidation.js` |
| Persistencia del historial | No existe en CocoChat | Está en OpenAI y en `localStorage` |
| Administración de sesiones | `IMPLEMENTADO` | `GET/DELETE /api/sessions`, cancelar, limpiar |
| Administración de conversaciones de OpenAI | `IMPLEMENTADO` | `backend/src/services/conversationService.js` |
| Propiedad de la conversación | No se comprueba | Quien conozca un `sessionId` puede continuarlo |
| Cancelación por el usuario | `IMPLEMENTADO` | `AbortController` en el frontend |

Dos consecuencias importantes. Primera: el historial que se manda al modelo
en modo `responses` **lo aporta el cliente**, así que es manipulable.
Segunda: si el usuario limpia el navegador, su conversación desaparece, y
nadie en la empresa puede revisar qué se respondió.

## Requisitos funcionales

| ID | Requisito | Estado | Prioridad |
|---|---|---|---|
| RF-CV-01 | Conversaciones y mensajes persistidos en CocoChat | `PROPUESTO` | MVP |
| RF-CV-02 | Cada conversación pertenece a una organización y a un agente | `PROPUESTO` | MVP |
| RF-CV-03 | El servidor reconstruye el contexto; no se confía en el cliente | `PROPUESTO` | MVP |
| RF-CV-04 | Solo puede continuar la conversación quien la posee | `PROPUESTO` | MVP |
| RF-CV-05 | Registro de la versión de configuración usada en cada turno | `PROPUESTO` | MVP |
| RF-CV-06 | Registro de consumo por turno | `PROPUESTO` | MVP |
| RF-CV-07 | Listado y búsqueda de conversaciones en el panel | `PROPUESTO` | MVP |
| RF-CV-08 | Retención configurable y borrado efectivo | `PROPUESTO` | MVP |
| RF-CV-09 | Resumen del contexto largo en lugar de truncado ciego | `PROPUESTO` | Post-MVP |
| RF-CV-10 | Respuesta en streaming hacia el frontend | `PROPUESTO` | Post-MVP |
| RF-CV-11 | Traspaso a un agente humano | `PROPUESTO` | Post-MVP |
| RF-CV-12 | Valoración de la respuesta por el usuario | `PROPUESTO` | Post-MVP |

RF-CV-10 tiene impacto de producto real: el código del backend ya consume
eventos en *streaming* (`collectTurn` en `chatService.js`) pero espera a
tenerlo todo antes de responder. La percepción de lentitud actual es, en
parte, una decisión reversible.

## Reglas de negocio

1. El historial es autoritativo en el servidor. Aceptar el que envía el
   cliente permite manipular el contexto del modelo.
2. Toda conversación referencia el agente y la versión de configuración con
   la que se atendió.
3. Los identificadores de OpenAI son referencias externas, no la fuente de
   verdad.
4. Los mensajes contienen datos personales de usuarios finales: retención por
   plan y borrado efectivo, no lógico, al vencer.
5. Las llamadas a herramientas de un turno se enlazan con su mensaje, para
   poder explicar de dónde salió cada dato.

## Casos de uso

**CU-CV-01 — Turno completo.** Se valida la entrada, se resuelve
organización y agente, se carga el contexto desde la base de datos, se
ejecuta el turno (con herramientas si las hay), se guardan mensajes,
ejecuciones y consumo, y se responde.

**CU-CV-02 — Revisar una conversación.** Marta abre el historial y ve los
mensajes, qué herramientas se invocaron, con qué argumentos y qué
devolvieron. Esta vista **es** el producto para el comprador: sin ella, el
agente es una caja negra.

## Dependencias

Depende de: Organizaciones, Agentes, persistencia.
Se relaciona con: Conectores (los registros de ejecución cuelgan de la
conversación).

## Riesgos

- Es la tabla que más crece y la que más datos sensibles acumula:
  particionado y retención desde el principio, no después.
- Migrar desde el estado actual implica decidir qué pasa con las
  conversaciones que hoy viven en OpenAI. Lo razonable es no migrarlas.
- Reutilizable tal cual: toda la validación de
  `chatValidation.js` y el servicio de mantenimiento de sesiones.
