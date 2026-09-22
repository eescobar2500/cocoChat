# Módulo: Administración

**Estado global: `PARCIAL`.** Existe una API de mantenimiento operada con un
token compartido; no existe panel de administración para clientes.

## Objetivo

Dar a cada organización una interfaz para gestionar sus agentes, conectores,
miembros y consumo, y a CocoChat las herramientas para operar y dar soporte.

## Dos superficies distintas

Conviene no mezclarlas desde el principio:

| | Panel del cliente | Operación de CocoChat |
|---|---|---|
| Quién | Usuarios de la organización | Equipo de CocoChat |
| Alcance | Solo su organización | Transversal |
| Estado | `PROPUESTO` | `PARCIAL` |

## Estado actual

Lo que hay es la segunda superficie, en forma de API y sin interfaz:

| Capacidad | Estado | Evidencia |
|---|---|---|
| Listar, cancelar, borrar y limpiar sesiones | `IMPLEMENTADO` | `backend/src/routes/sessionRoutes.js` |
| Listar y borrar agentes de la cuenta de OpenAI | `IMPLEMENTADO` | `backend/src/routes/agentRoutes.js` |
| Gestionar conversaciones de OpenAI | `IMPLEMENTADO` | `backend/src/routes/conversationRoutes.js` |
| Comprobación de salud | `IMPLEMENTADO` | `GET /api/health` |
| Colección de pruebas de la API | `IMPLEMENTADO` | `backend/postman/cocoChat.postman_collection.json` |
| Interfaz de administración | No existe | El frontend es solo el chat |
| Métricas y registro estructurado | No existe | Logger de una línea en `backend/src/middleware/logger.js` |

Estas rutas operan directamente sobre los recursos de la cuenta de OpenAI.
En una plataforma multi-tenant serían peligrosas: `DELETE /api/agents/:id`
borra un agente de la cuenta compartida. Hay que reencuadrarlas como
operación interna, nunca exponerlas al cliente.

## Requisitos funcionales

### Panel del cliente

| ID | Requisito | Estado | Prioridad |
|---|---|---|---|
| RF-ADM-01 | Cuadro de mando: agentes, conversaciones, consumo, salud de conectores | `PROPUESTO` | MVP |
| RF-ADM-02 | Gestión de agentes y de sus versiones | `PROPUESTO` | MVP |
| RF-ADM-03 | Gestión de conectores, herramientas y credenciales | `PROPUESTO` | MVP |
| RF-ADM-04 | Banco de pruebas de herramientas y de agentes | `PROPUESTO` | MVP |
| RF-ADM-05 | Historial de conversaciones con sus ejecuciones | `PROPUESTO` | MVP |
| RF-ADM-06 | Miembros, roles e invitaciones | `PROPUESTO` | MVP |
| RF-ADM-07 | Claves de API: emisión, rotación, revocación | `PROPUESTO` | MVP |
| RF-ADM-08 | Consumo y límites | `PROPUESTO` | MVP |
| RF-ADM-09 | Registro de auditoría consultable | `PROPUESTO` | MVP |
| RF-ADM-10 | Facturación y plan | `PENDIENTE-VALIDAR` | Ver [P2](../open-questions.md) |

### Operación de CocoChat

| ID | Requisito | Estado | Prioridad |
|---|---|---|---|
| RF-OPS-01 | Rutas de operación separadas y con autenticación propia | `PROPUESTO` | MVP |
| RF-OPS-02 | Registro estructurado con identificador de petición y de organización | `PROPUESTO` | MVP |
| RF-OPS-03 | Métricas de latencia, errores y consumo | `PROPUESTO` | MVP |
| RF-OPS-04 | Alertas por fallos de conector y por gasto anómalo | `PROPUESTO` | MVP |
| RF-OPS-05 | Suspender una organización | `PROPUESTO` | MVP |
| RF-OPS-06 | Acceso de soporte a una organización, consentido y auditado | `PROPUESTO` | Post-MVP |
| RF-OPS-07 | Mantenimiento de sesiones y recursos del proveedor | `IMPLEMENTADO` | — |

## Reglas de negocio

1. Un usuario del panel **nunca** ve datos de otra organización.
2. Toda acción administrativa relevante se audita con actor, recurso y
   momento.
3. El acceso de soporte a los datos de un cliente requiere consentimiento y
   deja rastro. Sin esto, ninguna auditoría empresarial se pasa.
4. Las credenciales no se muestran nunca; solo se reemplazan.
5. El panel refleja permisos, pero la comprobación es siempre del servidor.

## Casos de uso

**CU-ADM-01 — Diagnosticar por qué el agente no responde bien.** El operador
del cliente abre la conversación, ve que una herramienta devolvió `TIMEOUT`,
consulta el registro de ejecución y avisa a su equipo. **Sin este flujo, cada
incidencia acaba en soporte de CocoChat**, y el coste de soporte por cliente
es justo lo que hace inviable el modelo.

**CU-ADM-02 — Gasto anómalo.** Se detecta un consumo fuera de lo normal, se
avisa al cliente y, si procede, se suspende temporalmente.

## Dependencias

Depende de: Autenticación, Autorización, Organizaciones, Agentes,
Conectores, Conversaciones. Es el último módulo en la cadena.

## Riesgos

- El panel es tan grande como el backend; conviene priorizar despiadadamente
  y empezar por lo que quita trabajo de soporte.
- Las rutas de mantenimiento actuales, tal cual están, no pueden exponerse en
  un entorno multi-tenant.
- Decidir si el panel es una aplicación nueva o una ampliación del frontend
  actual es la [P14](../open-questions.md).
