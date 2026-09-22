# Módulos funcionales

Documentación funcional por módulo. Cada ficha sigue la misma estructura:
objetivo, actores, estado actual con evidencia, requisitos funcionales, casos
de uso, reglas de negocio y dependencias.

**Regla de lectura**: el estado de cada requisito es explícito. La mayoría del
sistema descrito aquí **todavía no existe**.

| Módulo | Estado global | Ficha |
|---|---|---|
| Autenticación | `PROPUESTO` (no existe identidad) | [`authentication.md`](authentication.md) |
| Autorización | `PARCIAL` (un token compartido) | [`authorization.md`](authorization.md) |
| Organizaciones (tenants) | `PROPUESTO` | [`tenants.md`](tenants.md) |
| Agentes | `PARCIAL` (uno, global, en `.env`) | [`agents.md`](agents.md) |
| Conectores | `PROPUESTO` | [`connectors.md`](connectors.md) |
| Conversaciones | `PARCIAL` (delegadas en OpenAI) | [`conversations.md`](conversations.md) |
| Conocimiento | `PROPUESTO` (hoy vive en OpenAI) | [`knowledge.md`](knowledge.md) |
| Administración | `PARCIAL` (solo API de mantenimiento) | [`administration.md`](administration.md) |

## Resumen del estado

De los ocho módulos que el producto necesita, **ninguno está completo**:
tres tienen una versión parcial heredada del prototipo y cinco no existen.
Es el reflejo esperable de un chat funcional que aún no es una plataforma.
