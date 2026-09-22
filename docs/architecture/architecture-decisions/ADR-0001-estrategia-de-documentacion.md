# ADR-0001 — Estrategia de documentación

- **Estado**: Aceptado
- **Fecha**: 2026-01
- **Ámbito**: Proceso

## Contexto

CocoChat pasa de ser un proyecto de aprendizaje (un chatbot de un agente) a un
producto con ambición de plataforma. Hoy toda la explicación del sistema vive
en el `README.md` y en comentarios del código —que, por cierto, son de calidad
inusualmente alta—. Eso funciona para un autor único y deja de funcionar en
cuanto hay que decidir arquitectura, incorporar a alguien o negociar un
contrato de integración con un cliente.

El riesgo concreto: empezar a escribir código de multi-tenancy y conectores sin
haber fijado qué existe, qué se propone y qué está sin decidir.

## Problema

¿Dónde vive la verdad funcional y arquitectónica del sistema, y cómo se evita
que la documentación describa funcionalidades que no existen?

## Alternativas

1. **Seguir con README + comentarios.** Coste cero, pero no soporta decisiones
   ni trazabilidad; y un README que crece se convierte en un documento que
   nadie lee entero ni mantiene.
2. **Wiki externa (Notion, Confluence).** Cómoda para no técnicos, pero se
   desincroniza del código: no entra en el *pull request* y nadie la revisa al
   cambiar el comportamiento.
3. **`docs/` versionado en el repositorio, con estados explícitos por
   funcionalidad y ADRs.** La documentación viaja con el código y se revisa en
   el mismo PR.
4. **Documentación generada desde el código (OpenAPI, JSDoc).** Excelente para
   la referencia de la API, inútil para reglas de negocio y decisiones.

## Decisión

Se adopta (3), con (4) como complemento futuro para la referencia de endpoints.

Reglas obligatorias:

- Toda funcionalidad documentada lleva estado: `IMPLEMENTADO`, `PARCIAL`,
  `PROPUESTO` o `PENDIENTE-VALIDAR`.
- Las afirmaciones sobre el sistema actual citan el archivo que las respalda.
- Las decisiones arquitectónicas relevantes se registran como ADR con
  contexto, alternativas, decisión, consecuencias y riesgos.
- Los requisitos funcionales usan identificadores estables (`RF-<MÓDULO>-NNN`)
  para poder enlazar requisito → caso de uso → endpoint → prueba.
- Un cambio de comportamiento y su documentación viajan en el mismo PR.

## Consecuencias

**Positivas**: se puede decidir con evidencia; la separación entre lo que
existe y lo que se propone evita construir sobre supuestos; los ADR conservan
el *porqué*, que es lo que siempre se pierde.

**Negativas**: hay que mantenerla, y documentación desactualizada es peor que
ninguna. Mitigación: la carpeta es deliberadamente pequeña y cada documento
tiene un dueño temático.

## Riesgos

- Que la documentación se convierta en un fin en sí mismo y retrase la
  validación del negocio. Mitigación: la Fase 0 produce análisis y propuesta,
  no especificación exhaustiva de todo lo imaginable.
- Que se documenten como `PROPUESTO` funcionalidades que luego se lean como
  compromisos de producto. Mitigación: la tabla de estados está en el
  `docs/README.md` y se repite en cada documento.
