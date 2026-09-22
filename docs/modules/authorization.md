# Módulo: Autorización

**Estado global: `PARCIAL`.** Existe una única comprobación binaria; no hay
roles, ni permisos, ni pertenencia a organizaciones.

## Objetivo

Decidir qué puede hacer cada identidad autenticada, sobre qué recursos y en
qué organización.

## Estado actual

Toda la autorización del sistema es esto
(`backend/src/middleware/requireAdminToken.js`):

- Si `ADMIN_TOKEN` no está definido, la comprobación se omite y las rutas de
  mantenimiento quedan **abiertas**.
- Si está definido, se compara con la cabecera `x-admin-token`. Quien la
  tenga, lo puede todo: listar y borrar sesiones, agentes y conversaciones.
- `POST /api/chat` no pasa por ninguna comprobación.

Es decir: **dos niveles, "todo" y "nada", sin usuarios y sin recursos
propios.**

## Modelo propuesto

Control de acceso basado en roles, con la organización como ámbito. Roles
alineados con las personas descritas en
[`../product/personas.md`](../product/personas.md).

| Permiso | `owner` | `admin` | `developer` | `operator` | `viewer` |
|---|---|---|---|---|---|
| Gestionar facturación y plan | Sí | No | No | No | No |
| Invitar y expulsar miembros | Sí | Sí | No | No | No |
| Crear y revocar claves de API | Sí | Sí | No | No | No |
| Crear y editar conectores | Sí | Sí | Sí | No | No |
| Definir y publicar herramientas | Sí | Sí | Sí | No | No |
| Escribir o rotar credenciales de conector | Sí | Sí | Sí | No | No |
| **Leer credenciales en claro** | **No** | **No** | **No** | **No** | **No** |
| Crear agentes y editar instrucciones | Sí | Sí | Sí | Sí | No |
| Autorizar una herramienta a un agente | Sí | Sí | Sí | No | No |
| Ver conversaciones | Sí | Sí | Sí | Sí | Sí |
| Ver registros de ejecución | Sí | Sí | Sí | Sí | Sí |
| Ver consumo | Sí | Sí | No | Sí | Sí |

La fila de credenciales no es un olvido: **nadie las lee, ni siquiera el
propietario.** Se escriben y se usan en ejecución.

## Requisitos funcionales

| ID | Requisito | Estado | Prioridad |
|---|---|---|---|
| RF-AZ-01 | Toda petición se resuelve a un contexto `(identidad, organización, rol)` | `PROPUESTO` | MVP |
| RF-AZ-02 | Comprobación de permiso por operación, no por ruta | `PROPUESTO` | MVP |
| RF-AZ-03 | Todo acceso a datos filtra por `organization_id`, con RLS como segunda barrera | `PROPUESTO` | MVP |
| RF-AZ-04 | Un agente solo invoca herramientas con autorización explícita | `PROPUESTO` | MVP |
| RF-AZ-05 | Las claves de API tienen ámbitos limitados | `PROPUESTO` | MVP |
| RF-AZ-06 | Cambios de rol y permisos quedan auditados | `PROPUESTO` | MVP |
| RF-AZ-07 | Rutas de operación de CocoChat separadas de las del cliente | `PROPUESTO` | MVP |
| RF-AZ-08 | Permisos a nivel de recurso concreto (este agente sí, ese no) | `PROPUESTO` | Post-MVP |

## Reglas de negocio

1. **Denegar por defecto.** Lo que no está permitido explícitamente, se
   rechaza. Lo contrario de la situación actual, donde un `ADMIN_TOKEN` sin
   definir abre las puertas.
2. Una organización no puede quedarse sin `owner`.
3. Un recurso de otra organización responde `404`, no `403`: no se revela su
   existencia.
4. La autorización de herramientas es una lista blanca. Que un conector
   exista no implica que un agente pueda usarlo.
5. Los permisos se comprueban en el servidor en cada petición; el panel oculta
   opciones por comodidad, nunca como medida de seguridad.

## Casos de uso

**CU-AZ-01 — El agente intenta invocar una herramienta.** El ejecutor
comprueba que existe una autorización activa para ese agente y esa versión de
herramienta, y que ambos pertenecen a la organización de la conversación. Si
falla, no se ejecuta, se registra el intento y el agente recibe un error
estructurado que puede explicar al usuario.

**CU-AZ-02 — Un desarrollador intenta ver una credencial.** Se deniega
siempre. Solo puede reemplazarla.

## Dependencias

Depende de: Autenticación, Organizaciones.
Bloquea a: Conectores, Agentes, Administración.

## Riesgos

- El principal riesgo de una plataforma multi-tenant es la fuga entre
  tenants, y casi siempre nace de una consulta a la que se le olvidó el
  filtro. Por eso RLS es una exigencia y no una preferencia
  ([ADR-0002](../architecture/architecture-decisions/ADR-0002-multi-tenancy.md)).
- Una matriz de permisos demasiado fina al principio es difícil de mantener y
  de explicar; empezar con cinco roles y refinar con datos de uso.
