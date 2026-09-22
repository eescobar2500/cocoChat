# Convenciones de la API

Este documento describe **lo que hay hoy** y **lo que se propone** para la API
pública de CocoChat. Las secciones están marcadas.

## 1. Estado actual `IMPLEMENTADO`

- Prefijo único: `/api`.
- Cuerpo y respuesta en JSON; `express.json()` y `express.urlencoded()`.
- Sin versionado en la URL.
- Errores con forma uniforme, generada por `backend/src/middleware/errorHandle.js`:

```json
{ "status": "error", "statusCode": 400, "message": "..." }
```

- Códigos usados: `400` entrada mal formada, `401` token de administración
  ausente o inválido, `404` ruta o recurso inexistente, `413` mensaje
  demasiado largo, `429` límite de OpenAI, `502` fallo del proveedor o agente
  mal configurado.
- Autenticación de mantenimiento: cabecera `x-admin-token`. `POST /api/chat`
  es público.
- Validación explícita por recurso en `backend/src/utils/validations/`, siempre
  antes de llamar al proveedor (evita pagar una llamada que iba a fallar).
- El stack solo se expone en `development` y nunca cuando el error viene del
  SDK de OpenAI.

Lo que **no** hay hoy: versionado, paginación, idempotencia, límite de
peticiones, identificador de correlación y encabezados de cuota.

## 2. Convenciones propuestas `PROPUESTO`

### Versionado

Prefijo `/v1` para la API que consumirán clientes externos. La API actual
puede mantenerse como `/api` durante la transición, con fecha de retirada
anunciada. Solo se rompe compatibilidad subiendo de versión mayor.

### Autenticación

Dos canales, con mecanismos distintos:

| Canal | Mecanismo | Uso |
|---|---|---|
| Panel administrativo | Sesión de usuario (cookie `HttpOnly` o *bearer* de corta vida) | Personas |
| Integración servidor a servidor | API key por organización (`Authorization: Bearer ck_live_…`) | El backend del cliente |
| Widget de chat público | Token efímero acotado a un agente y un origen, emitido por el backend del cliente | Usuarios finales |

El widget **nunca** lleva la API key de la organización: viaja en el navegador
y sería pública, exactamente el mismo razonamiento que hoy aplica el proyecto
con la key de OpenAI.

### Errores

Se mantiene la forma actual, añadiendo un código estable legible por máquina y
el identificador de correlación:

```jsonc
{
  "status": "error",
  "statusCode": 422,
  "code": "tool_schema_invalid",
  "message": "El parámetro 'fecha' no cumple el formato YYYY-MM-DD",
  "requestId": "req_01H..."
}
```

`message` es para personas y puede cambiar; `code` es contrato y no cambia sin
subir versión mayor.

### Idempotencia

Toda operación de escritura no trivial acepta `Idempotency-Key`. Obligatoria
en las ejecuciones de herramientas con `sideEffects != none`.

### Paginación

Por cursor (`?limit=&cursor=`), nunca por *offset*: los datos crecen y el
*offset* produce resultados inconsistentes y consultas caras. Respuesta:

```jsonc
{ "data": [ ... ], "nextCursor": "eyJ..." }
```

### Límites y cuotas

Cabeceras `RateLimit-Limit`, `RateLimit-Remaining` y `RateLimit-Reset` en cada
respuesta, y `429` con `Retry-After` al superarlas. El límite se aplica **por
organización**, no por IP, porque la unidad de coste es el tenant.

### Nomenclatura

- Recursos en plural y en inglés en las rutas (`/v1/agents`, `/v1/connectors`),
  coherente con lo que ya existe.
- Campos JSON en `camelCase` en la API pública (como hoy: `sessionId`,
  `itemCount`), aunque las columnas de base de datos usen `snake_case`.
- Identificadores con prefijo por tipo (`org_`, `agent_`, `conn_`, `tool_`,
  `exec_`), como hacen OpenAI y Stripe: hace imposible confundir un id de
  agente con uno de conector en un log o en un mensaje de error.

### Trazabilidad

Cada petición recibe un `requestId`, que aparece en la respuesta de error, en
los logs y en el `ExecutionLog`. Si el cliente envía `X-Request-Id`, se
respeta y se propaga.
