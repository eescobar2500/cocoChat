# Módulo: Autenticación

**Estado global: `PROPUESTO`.** No existe ninguna noción de usuario en el
código.

## Objetivo

Establecer y verificar la identidad de quien accede: personas en el panel y
sistemas en la API.

## Actores

Personas del cliente (propietario, desarrollador, operador), backend del
cliente, operador de CocoChat, usuario final del chat.

## Estado actual

| Elemento | Estado | Evidencia |
|---|---|---|
| Registro e inicio de sesión | No existe | No hay entidad `user` en `backend/src/` |
| Sesiones de usuario | No existe | — |
| Autenticación de servicio | `PARCIAL` | `x-admin-token` en `backend/src/middleware/requireAdminToken.js` |
| Autenticación del chat | No existe | `POST /api/chat` es público |
| MFA | No existe | — |

El `ADMIN_TOKEN` es un secreto compartido, único para todo el despliegue, sin
caducidad ni rotación, y opcional: si la variable no está definida, las rutas
de mantenimiento quedan abiertas. No identifica a nadie; solo autoriza.

## Requisitos funcionales

| ID | Requisito | Estado | Prioridad |
|---|---|---|---|
| RF-AUT-01 | Registro de usuario con correo y contraseña | `PROPUESTO` | MVP |
| RF-AUT-02 | Inicio de sesión con emisión de sesión firmada y de corta vida | `PROPUESTO` | MVP |
| RF-AUT-03 | Cierre de sesión y revocación | `PROPUESTO` | MVP |
| RF-AUT-04 | Invitación por correo a una organización | `PROPUESTO` | MVP |
| RF-AUT-05 | Recuperación de contraseña con enlace de un solo uso | `PROPUESTO` | MVP |
| RF-AUT-06 | Claves de API por organización para el backend del cliente | `PROPUESTO` | MVP |
| RF-AUT-07 | Rotación y revocación de claves de API sin cortar el servicio | `PROPUESTO` | MVP |
| RF-AUT-08 | Un usuario pertenece a varias organizaciones y cambia entre ellas | `PROPUESTO` | MVP |
| RF-AUT-09 | MFA (TOTP) | `PROPUESTO` | Post-MVP |
| RF-AUT-10 | SSO / OIDC para clientes grandes | `PROPUESTO` | Post-MVP |
| RF-AUT-11 | Identidad del usuario final del chat | `PENDIENTE-VALIDAR` | Ver [P7](../open-questions.md) |

## Casos de uso

**CU-AUT-01 — Alta de una empresa.** Una persona se registra, crea la
organización y queda como `owner`. Invita a su equipo.
*Alternativas*: correo ya registrado (se le añade la pertenencia, no se crea
otra cuenta); dominio de correo desechable (rechazo).

**CU-AUT-02 — El backend del cliente se autentica.** Envía su clave de API en
cabecera; la plataforma resuelve la organización, valida el ámbito, registra
`last_used_at` y continúa.
*Alternativas*: clave revocada o caducada → `401`; ámbito insuficiente →
`403`.

**CU-AUT-03 — Rotación de clave.** Se emite una segunda clave activa, el
cliente migra, se revoca la primera. Nunca hay corte: **dos claves activas a
la vez es un requisito, no una concesión.**

## Reglas de negocio

1. Las contraseñas se almacenan con un algoritmo de derivación lento
   (Argon2id o bcrypt). Nunca en claro ni con hash rápido.
2. El valor de una clave de API se muestra una sola vez; se guarda hasheado.
3. Las comparaciones de secretos se hacen en tiempo constante (hoy no es el
   caso: ver `backend/src/middleware/requireAdminToken.js`).
4. Toda autenticación fallida se registra; el bloqueo por intentos es
   obligatorio en el inicio de sesión.
5. Un usuario sin pertenencias activas no puede operar, aunque su cuenta
   exista.

## Dependencias

Bloquea a: Autorización, Organizaciones, Agentes, Administración.
Depende de: la decisión P1 (modelo de producto) — en el Modelo B, este módulo
se reduce drásticamente.

## Riesgos

- Es el módulo con más superficie de ataque y el primero que se audita en una
  compra empresarial.
- Tentación de resolverlo "rápido" con tokens de larga vida sin revocación:
  es exactamente lo que hay hoy y lo que hay que dejar atrás.
