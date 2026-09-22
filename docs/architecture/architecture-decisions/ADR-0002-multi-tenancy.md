# ADR-0002 — Estrategia de multi-tenancy

- **Estado**: **Propuesto — requiere validación** (depende de la elección
  Modelo A / Modelo B, ver [`../../product/business-model.md`](../../product/business-model.md))
- **Fecha**: 2026-01
- **Ámbito**: Datos y seguridad

## Contexto

Hoy no hay tenants: `OPENAI_AGENT_ID` y `OPENAI_API_KEY` son variables de
proceso, y el único control de acceso es un token estático compartido
(`backend/src/middleware/requireAdminToken.js`). Un despliegue sirve a un
cliente con un agente.

La visión exige que varias empresas convivan, cada una con sus agentes, sus
conectores y —lo más delicado— **credenciales de acceso a sus propios
sistemas de producción**. El aislamiento deja de ser una buena práctica y pasa
a ser el requisito que decide si el producto es vendible.

## Problema

¿Cómo se aíslan los datos y los secretos de cada organización, sin que el
coste operativo crezca con cada cliente y sin que un error de programación
provoque una fuga entre tenants?

## Alternativas

| Opción | Aislamiento | Coste operativo | Migraciones | Ruido entre vecinos |
|---|---|---|---|---|
| 1. BD compartida, `organization_id`, filtrado solo en aplicación | Débil: un `WHERE` olvidado es una fuga | Mínimo | Una | Sí |
| 2. BD compartida + `organization_id` + **Row Level Security** | Fuerte: defensa en profundidad | Mínimo | Una | Sí |
| 3. Un esquema PostgreSQL por tenant | Fuerte | Medio | × N esquemas | Parcial |
| 4. Una base de datos (o instancia) por tenant | Muy fuerte | Alto | × N bases | No |
| 5. Un despliegue completo por cliente (Modelo B) | Total | Muy alto, o del cliente | × N | No |

## Decisión

**Opción 2 para el MVP**: base compartida, `organization_id` obligatorio en
toda tabla de negocio y Row Level Security como red de seguridad, con la
opción 4 reservada como *plan dedicado* para clientes empresariales que lo
exijan por cumplimiento.

Reglas que acompañan a la decisión:

1. Ninguna tabla de negocio se crea sin `organization_id NOT NULL`.
2. Las claves foráneas entre tablas de negocio son **compuestas**
   (`(organization_id, id)`), de modo que la base de datos impida referenciar
   un recurso de otro tenant.
3. El contexto de tenant se resuelve **una vez**, en el borde HTTP, y viaja
   explícito; ningún servicio lo lee de una variable global.
4. La capa de acceso a datos no expone ningún método sin filtro de tenant.
5. Los secretos de conectores se cifran con una clave derivada **por
   organización**, de modo que un volcado de la tabla no sea suficiente para
   usar credenciales de todos los clientes.
6. Hay una prueba automatizada de aislamiento —"el tenant A no ve ni una fila
   del tenant B"— por cada recurso expuesto, y es de obligado cumplimiento
   antes de aceptar un segundo cliente.

## Consecuencias

**Positivas**: una migración, un despliegue, coste marginal por cliente casi
nulo; RLS convierte un bug de aplicación en una consulta vacía en vez de en
una brecha; permite plan dedicado sin rediseñar el modelo.

**Negativas**: RLS añade complejidad en pruebas, *pooling* de conexiones y
tareas administrativas (hay que decidir con qué rol corren migraciones y
trabajos de fondo, que necesitan saltarse RLS de forma controlada). El ruido
entre vecinos se gestiona con cuotas, no con aislamiento físico.

## Riesgos

- **Fuga entre tenants por error de aplicación**: mitigado con RLS + FK
  compuestas + pruebas de aislamiento.
- **Conexión mal inicializada** (olvidar fijar el `organization_id` de sesión)
  que deje las consultas vacías o, peor, abiertas si se usa un rol que ignora
  RLS. Mitigación: un único punto de obtención de conexión que lo fije siempre
  y falle si no hay contexto.
- **Si finalmente se elige el Modelo B** (backend entregado al cliente), gran
  parte de esta complejidad sobra. Por eso el ADR está en estado *propuesto*:
  la decisión de producto va primero.
