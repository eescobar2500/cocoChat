# ADR-0003 — Estilo arquitectónico: monolito modular por capas, con puertos solo donde hacen falta

- **Estado**: Propuesto
- **Fecha**: 2026-01
- **Ámbito**: Estructura del backend

## Contexto

El backend actual es una arquitectura por capas (rutas → controllers →
servicios) bien ejecutada para su tamaño: una sola capa habla con OpenAI, la
configuración tiene un único punto de lectura y el manejo de errores está
centralizado. No hay dominio, ni repositorios, ni casos de uso, porque hoy no
hay nada que persistir ni reglas de negocio propias.

La evolución añade tres cosas que sí son dominio: agentes configurables,
conectores con permisos y ejecución auditada de herramientas.

La tentación evidente es "aprovechar el rediseño" para imponer Clean
Architecture completa, CQRS y microservicios. Ninguna de esas decisiones se
justifica por el problema; se justificarían por la moda.

## Problema

¿Qué estructura soporta la evolución a plataforma sin pagar una ceremonia que
no aporta valor con cero clientes en producción?

## Alternativas

1. **Seguir con capas planas** y añadir carpetas según haga falta. Barato, pero
   sin fronteras: en seis meses todo depende de todo y extraer el ejecutor de
   herramientas es imposible.
2. **Clean Architecture completa** (entidades, casos de uso, puertos y
   adaptadores en todos los módulos). Máxima testabilidad, a cambio de mucha
   indirección; para módulos CRUD (organizaciones, memberships) el coste supera
   el beneficio de forma clara.
3. **Monolito modular**: módulos con frontera explícita y contrato público;
   dentro de cada módulo, capas simples. Inversión de dependencias **solo**
   donde hay varias implementaciones reales.
4. **Microservicios desde el principio**. Coste operativo alto,
   transacciones distribuidas y despliegue complejo para un equipo pequeño y
   un producto sin validar.

## Decisión

Se adopta (3).

- **Módulos** con un archivo de contrato público (`index.js` que exporta solo
  lo que otros módulos pueden usar). Prohibido importar internos de otro
  módulo.
- **Puertos e implementaciones intercambiables solo en dos sitios**, porque son
  los únicos donde hoy existe más de una implementación real:
  - `AgentRuntime`: `OpenAIAgentsRuntime` y `OpenAIResponsesRuntime` (ya
    existen de facto, hoy seleccionadas con un `if` sobre `CHAT_MODE`).
  - `ConnectorDriver`: `Http`, y más adelante `Contract` y `Mcp`.
- **Repositorios** solo cuando aparezca la base de datos, y con el contexto de
  tenant obligatorio en su firma (ver ADR-0002).
- **Sin CQRS, sin event sourcing, sin microservicios** hasta que un problema
  concreto y medido los pida. El único candidato razonable a extracción futura
  es el ejecutor de herramientas, y por motivos de seguridad, no de escala
  (ver [ADR-0004](ADR-0004-motor-de-conectores.md)).
- Se mantiene **JavaScript con ESM** en el MVP; migrar a TypeScript es una
  decisión aparte y con coste propio, discutida en las preguntas abiertas.

## Consecuencias

**Positivas**: la evolución es incremental y el código actual sigue siendo
válido; las fronteras permiten extraer un servicio si algún día hace falta;
se evita la indirección inútil en los módulos CRUD.

**Negativas**: las fronteras de un monolito modular son convención, no
imposición física del lenguaje; hace falta disciplina (y, idealmente, una
regla de *lint* de importaciones) para que no se erosionen.

## Riesgos

- Erosión gradual de las fronteras. Mitigación: regla de importación
  automatizada y revisión de PR.
- Que "extraer el ejecutor más adelante" se posponga indefinidamente pese a
  manejar secretos y URLs de terceros. Mitigación: fijar el disparador
  explícito —primer conector de escritura en producción— en el roadmap.
