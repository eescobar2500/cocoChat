# Módulo: Conocimiento

**Estado global: `PROPUESTO`.** Hoy el conocimiento del agente vive
íntegramente en OpenAI y CocoChat no lo gestiona.

## Objetivo

Dar al agente el contexto estático que necesita —políticas, catálogos,
preguntas frecuentes, tono— frente al contexto dinámico que aportan los
conectores.

## Distinción fundamental

| | Conocimiento | Conectores |
|---|---|---|
| Naturaleza | Estático, cambia poco | Dinámico, cambia por minuto |
| Ejemplo | "La cancelación es gratuita hasta 24 h antes" | "¿Hay hueco el martes a las 17:00?" |
| Origen | Documentos del cliente | Backend del cliente |
| Riesgo si se equivoca | Respuesta desactualizada | Respuesta falsa sobre datos reales |

**Un error frecuente es intentar resolver con conocimiento lo que exige un
conector.** Volcar el catálogo de horarios en un documento parece más fácil
que integrar, y garantiza respuestas erróneas. La documentación debe insistir
en ello: si el dato cambia, es un conector.

## Estado actual

- Las instrucciones y los archivos del agente están en OpenAI, asociados a
  `OPENAI_AGENT_ID`. CocoChat solo los referencia.
- En modo `responses` existe un texto de instrucciones de respaldo dentro de
  `backend/src/services/responsesChatService.js`: es el único conocimiento
  que vive en este repositorio, y está en el código, no en configuración.
- No hay carga de documentos, ni indexación, ni búsqueda semántica.

## Requisitos funcionales

| ID | Requisito | Estado | Prioridad |
|---|---|---|---|
| RF-KB-01 | Instrucciones del agente editables desde el panel y versionadas | `PROPUESTO` | MVP |
| RF-KB-02 | Fragmentos de conocimiento breves adjuntos a un agente | `PROPUESTO` | MVP |
| RF-KB-03 | Carga de documentos (PDF, Markdown, texto) | `PROPUESTO` | Post-MVP |
| RF-KB-04 | Troceado, *embeddings* y búsqueda semántica | `PROPUESTO` | Post-MVP |
| RF-KB-05 | Citar la fuente utilizada en la respuesta | `PROPUESTO` | Post-MVP |
| RF-KB-06 | Reindexado al actualizar un documento | `PROPUESTO` | Post-MVP |
| RF-KB-07 | Sincronización desde una fuente externa | `PROPUESTO` | Futuro |
| RF-KB-08 | Aislamiento del conocimiento entre organizaciones | `PROPUESTO` | Con RF-KB-03 |

## Por qué no está en el MVP

Es una decisión consciente, no un olvido. Un sistema RAG propio implica
ingesta, troceado, *embeddings*, almacén vectorial, reindexado, evaluación de
calidad y coste adicional por consulta: es un producto dentro del producto.
Mientras el agente de OpenAI lo cubra y la propuesta de valor sean los
conectores, construirlo desvía el esfuerzo del diferenciador real.

El MVP se queda en instrucciones versionadas (RF-KB-01), que es lo que Marta
necesita de verdad para trabajar sin depender de nadie.

## Reglas de negocio

1. El conocimiento pertenece a una organización y jamás se comparte entre
   tenants. En un almacén vectorial compartido esto es un riesgo real: el
   filtro por tenant debe aplicarse en la búsqueda, no después.
2. Los documentos del cliente pueden contener datos sensibles: cifrado en
   reposo y borrado efectivo al eliminarlos.
3. El contenido recuperado se trata como datos, nunca como instrucciones al
   modelo.
4. Si conocimiento y conector se contradicen, **gana el conector**: es el
   dato vivo.

## Dependencias

Depende de: Organizaciones, Agentes.
Se solapa con: el runtime, según qué parte del conocimiento gestione el
proveedor.

## Riesgos

- Conocimiento desactualizado que el agente presenta con total seguridad.
- Coste creciente e invisible del contexto largo.
- Si más adelante se abandona OpenAI, el conocimiento que hoy vive allí no es
  portable: motivo añadido para traer al menos las instrucciones a CocoChat
  en el MVP.
