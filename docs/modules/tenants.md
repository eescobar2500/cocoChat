# Módulo: Organizaciones (tenants)

**Estado global: `PROPUESTO`.** Hoy un despliegue equivale a un cliente.

## Objetivo

Representar a la empresa cliente como unidad de aislamiento, configuración,
cuota y facturación.

## Estado actual

No existe el concepto. La evidencia es directa: el agente es una variable de
entorno global del proceso (`OPENAI_AGENT_ID` en
`backend/src/config/env.js`), la key de OpenAI es única para todo el
despliegue y ningún dato lleva propietario. Atender a dos clientes hoy exige
**dos despliegues completos**.

## Requisitos funcionales

| ID | Requisito | Estado | Prioridad |
|---|---|---|---|
| RF-ORG-01 | Crear organización con nombre e identificador único | `PROPUESTO` | MVP |
| RF-ORG-02 | Todo recurso pertenece a exactamente una organización | `PROPUESTO` | MVP |
| RF-ORG-03 | Gestión de miembros y roles | `PROPUESTO` | MVP |
| RF-ORG-04 | Configuración por organización (runtime, key propia, límites) | `PROPUESTO` | MVP |
| RF-ORG-05 | Cuotas de consumo y aviso al acercarse al límite | `PROPUESTO` | MVP |
| RF-ORG-06 | Suspensión por impago o abuso sin borrar datos | `PROPUESTO` | MVP |
| RF-ORG-07 | Exportación de los datos de la organización | `PROPUESTO` | Post-MVP |
| RF-ORG-08 | Borrado con periodo de gracia | `PROPUESTO` | Post-MVP |
| RF-ORG-09 | Planes y suscripciones | `PENDIENTE-VALIDAR` | Ver [P2](../open-questions.md) |

## Reglas de negocio

1. Un usuario puede pertenecer a varias organizaciones; `users` es la única
   tabla sin `organization_id`
   ([modelo de datos](../data/data-model.md)).
2. Los recursos **nunca** se comparten ni se mueven entre organizaciones.
3. Una organización suspendida no puede conversar ni ejecutar herramientas,
   pero conserva sus datos y su configuración.
4. La cuota se comprueba **antes** de llamar al proveedor de modelo, no
   después: si no, el gasto ya se ha producido.
5. La configuración global de hoy (`OPENAI_AGENT_ID`, `CHAT_MODE`) pasa a ser
   configuración de organización. Esto es lo que convierte el prototipo en
   plataforma.

## Casos de uso

**CU-ORG-01 — Alta.** Se crea la organización, su propietario y una
configuración por defecto. Si el plan es "trae tu propia key", se solicita y
se guarda cifrada antes de permitir conversaciones.

**CU-ORG-02 — Se alcanza la cuota.** Las conversaciones nuevas se rechazan
con un error explícito y accionable; las abiertas terminan su turno. Se avisa
a los administradores. No se corta en mitad de una respuesta ya pagada.

**CU-ORG-03 — Baja.** La organización se marca como eliminada, se revocan
claves y credenciales, y los datos se conservan durante el periodo de gracia
acordado antes del borrado efectivo.

## Aislamiento

Tres barreras, descritas en
[`../security/security-model.md`](../security/security-model.md):

1. Contexto de organización resuelto en la autenticación.
2. Filtro obligatorio en la capa de acceso a datos.
3. RLS en PostgreSQL como red de seguridad ante un olvido.

Para clientes que lo exijan, plan dedicado con base de datos aislada —
posible sin cambiar la base de código si el aislamiento lógico está bien
hecho desde el principio.

## Dependencias

Depende de: Autenticación.
Bloquea a: todo lo demás.

## Riesgos

- **Introducir esto tarde es carísimo.** Cada tabla creada antes habrá que
  migrarla, y cada consulta escrita antes habrá que revisarla.
- Confundir organización con espacio de trabajo: si un cliente pide separar
  sedes o marcas, se resuelve con un nivel adicional, no duplicando
  organizaciones. Conviene preguntarlo en los pilotos.
