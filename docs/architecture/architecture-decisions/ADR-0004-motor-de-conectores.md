# ADR-0004 — Primer mecanismo de integración: conector HTTP declarativo, de solo lectura

- **Estado**: **Aceptado** — validado 2026-09: MVP de solo lectura sobre
  backends REST+JSON ([P4 y P5](../../open-questions.md))
- **Fecha**: 2026-01
- **Ámbito**: Producto y seguridad
- **Relacionado**: [`../integration-strategy.md`](../integration-strategy.md)

## Contexto

La promesa comercial de CocoChat es que una empresa conecte sus sistemas a un
agente **configurando, no programando**, y que CocoChat no tenga que escribir
código específico por cliente. Hoy no existe ningún mecanismo de integración:
el bucle que procesa los eventos del agente descarta explícitamente las
llamadas a herramientas (`collectTurn()` en `backend/src/services/chatService.js`).

Hay seis alternativas evaluadas en el documento de estrategia. Esta decisión
fija **cuál se construye primero** y **con qué alcance**.

## Problema

¿Qué mecanismo de integración se implementa en el MVP, y debe permitir
escritura desde el principio?

## Alternativas

Ver la comparativa completa en [`../integration-strategy.md`](../integration-strategy.md).
Resumen de las candidatas a ir primero:

- **Adaptador por cliente**: rápido para el piloto, insostenible como producto.
- **HTTP declarativo**: cumple la promesa comercial; concentra el riesgo de
  seguridad (SSRF) y el esfuerzo de ingeniería en CocoChat.
- **Contrato fijo implementado por el cliente**: menos riesgo para CocoChat,
  pero traslada días de desarrollo al cliente y frena la incorporación.
- **MCP**: la apuesta correcta a medio plazo, demasiada superficie y demasiada
  madurez exigida al cliente para ser lo primero.

## Decisión

Implementar primero el **conector HTTP declarativo restringido a operaciones
de lectura** (`GET` y `POST` explícitamente marcados como consulta sin efectos
secundarios), con:

1. **Definición de herramienta en JSON Schema**, versionada y publicada por el
   cliente. El modelo solo ve nombre, descripción y esquema de parámetros.
2. **Allowlist de destinos por conector**: host y prefijo de ruta declarados y
   aprobados. Resolución de DNS y verificación de que la IP no es privada,
   *antes* de conectar y de nuevo tras las redirecciones (que se prohíben por
   defecto). Sin esto, el conector es un SSRF ofrecido como servicio.
3. **Solo HTTPS**, con validación de certificado, timeout corto (p. ej. 5-10 s),
   límite de tamaño de respuesta y de número de llamadas por turno.
4. **Allowlist de salida**: al modelo solo llegan los campos declarados en el
   mapeo. La respuesta cruda del backend del cliente nunca se pasa tal cual.
5. **Credenciales por referencia**, cifradas por organización y descifradas
   solo en el momento de ejecutar (ver ADR-0002 y el modelo de seguridad).
6. **Un registro de ejecución por llamada**, con duración, resultado y quién la
   originó.

La escritura (crear reservas, pedidos) queda **explícitamente fuera del MVP** y
llega en la fase siguiente con clave de idempotencia, confirmación explícita y
aprobación por herramienta.

## Consecuencias

**Positivas**: incorporación de un cliente en horas, no semanas; el riesgo de
un error del agente se limita a *leer de más*, nunca a crear datos falsos en
el sistema de un cliente; el mismo motor sirve después para MCP y contrato
fijo, porque la abstracción estable es `Tool`, no `Connector`.

**Negativas**: el mapeo declarativo no cubre lógica compleja (paginación
sofisticada, reglas de negocio cruzadas), así que habrá clientes que necesiten
el contrato fijo antes de lo previsto. CocoChat asume la mayor parte del
trabajo de ingeniería y **toda** la superficie de seguridad saliente.

## Riesgos

- **SSRF**: el riesgo central. Mitigaciones arriba; además, ejecución con
  egreso de red restringido cuando el ejecutor se aísle.
- **Prompt injection que provoque llamadas no deseadas**: acotado por el
  conjunto reducido de herramientas por agente y por el hecho de que en el MVP
  ninguna escribe.
- **Exfiltración de datos del cliente vía la conversación**: acotado por la
  allowlist de campos de salida y por reglas de redacción declarables.
- **Complejidad de configuración** que abrume al administrador del cliente.
  Mitigación: importar OpenAPI para generar borradores de herramientas y un
  botón de "probar herramienta" antes de publicarla.
