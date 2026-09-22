# Documentación de CocoChat

Esta carpeta es la fuente de verdad funcional y arquitectónica del proyecto.
Está escrita para que alguien que no ha leído el código entienda qué hace hoy
el sistema, qué se propone que haga y por qué.

## Convención de estados

Cada funcionalidad documentada lleva una etiqueta de estado. Es la regla más
importante de esta carpeta: **nada propuesto se describe como si existiera**.

| Etiqueta | Significado |
|---|---|
| `IMPLEMENTADO` | Existe en el código de este repositorio y se puede verificar. |
| `PARCIAL` | Existe una versión reducida o con limitaciones relevantes. |
| `PROPUESTO` | Diseño sugerido en esta documentación. No existe código. |
| `PENDIENTE-VALIDAR` | Requiere una decisión del dueño de producto antes de diseñarse. |

## Mapa de la documentación

| Ruta | Qué contiene |
|---|---|
| [`architecture/current-state.md`](architecture/current-state.md) | Qué es CocoChat hoy, con evidencia del código. **Empezar por aquí.** |
| [`architecture/target-architecture.md`](architecture/target-architecture.md) | Arquitectura objetivo propuesta. |
| [`architecture/integration-strategy.md`](architecture/integration-strategy.md) | Alternativas de integración con backends de clientes y su comparación. |
| [`architecture/architecture-decisions/`](architecture/architecture-decisions/) | ADRs: contexto, alternativas, decisión, consecuencias. |
| [`modules/`](modules/) | Documentación funcional por módulo (objetivo, actores, RF, casos de uso). |
| [`api/conventions.md`](api/conventions.md) | Convenciones de la API pública. |
| [`api/integrations.md`](api/integrations.md) | Contrato propuesto de conectores y herramientas. |
| [`security/security-model.md`](security/security-model.md) | Modelo de seguridad y multi-tenancy. |
| [`data/data-model.md`](data/data-model.md) | Modelo de datos actual y propuesto. |
| [`product/`](product/) | Visión, modelo de negocio, personas y roadmap. |
| [`product/roadmap.md`](product/roadmap.md) | Plan de implementación por etapas. |
| [`open-questions.md`](open-questions.md) | Lo que hay que responder antes de implementar. |

## Estado de esta documentación

Escrita en la **Fase 0 (análisis)**. No se ha modificado ni una línea de código
de `backend/` ni de `frontend/`. Todo lo que aparece como `PROPUESTO` espera
validación antes de convertirse en trabajo de implementación.

Commit analizado: `f1e97af` (único commit del repositorio en el momento del
análisis).
