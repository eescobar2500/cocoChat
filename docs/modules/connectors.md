# Módulo: Conectores

**Estado global: `PROPUESTO`.** No existe ni una línea de código. Es, a la
vez, **el módulo que define el producto** y el que más riesgo concentra.

## Objetivo

Permitir que una organización declare cómo se accede a su backend y qué
operaciones quedan expuestas al agente, sin que CocoChat escriba código
específico para cada cliente.

## Conceptos

Separación deliberada (ver [`../api/integrations.md`](../api/integrations.md)):

| Concepto | Qué es | Quién lo ve |
|---|---|---|
| **Conector** | Cómo se llega al backend: URL base, transporte, credencial, límites | Solo el desarrollador del cliente |
| **Herramienta** | Qué operación de negocio se ofrece: nombre, descripción, esquema de parámetros | **El modelo** y el desarrollador |
| **Credencial** | El secreto. Cifrado y separado de la configuración | Nadie lo lee |
| **Autorización** | Qué agente puede usar qué herramienta | El administrador |

La herramienta es la abstracción estable; el conector es un detalle de
transporte. Esta separación es la que permite cambiar de HTTP a MCP sin
reconfigurar los agentes.

## Requisitos funcionales

| ID | Requisito | Estado | Prioridad |
|---|---|---|---|
| RF-CON-01 | Crear conector HTTP con URL base y credencial | `PROPUESTO` | MVP |
| RF-CON-02 | Credenciales cifradas, nunca legibles por la API | `PROPUESTO` | MVP |
| RF-CON-03 | Definir herramientas con JSON Schema de parámetros | `PROPUESTO` | MVP |
| RF-CON-04 | Enlazar herramienta con método, ruta y mapeo de argumentos | `PROPUESTO` | MVP |
| RF-CON-05 | Validar argumentos antes de ejecutar, y rechazar los inválidos | `PROPUESTO` | MVP |
| RF-CON-06 | Allowlist de hosts y prefijos de ruta | `PROPUESTO` | MVP |
| RF-CON-07 | Defensas anti-SSRF: solo HTTPS, bloqueo de redes privadas, revalidación tras DNS, sin redirecciones | `PROPUESTO` | MVP |
| RF-CON-08 | Timeouts, límite de tamaño de respuesta y de peticiones por minuto | `PROPUESTO` | MVP |
| RF-CON-09 | Banco de pruebas de la herramienta antes de publicarla | `PROPUESTO` | MVP |
| RF-CON-10 | Registro de cada ejecución con campos sensibles redactados | `PROPUESTO` | MVP |
| RF-CON-11 | Versionado de herramientas y despublicación | `PROPUESTO` | MVP |
| RF-CON-12 | Comprobación periódica de salud del conector | `PROPUESTO` | Post-MVP |
| RF-CON-13 | Importar borradores de herramientas desde OpenAPI | `PROPUESTO` | Post-MVP |
| RF-CON-14 | Herramientas con efectos: idempotencia y confirmación | `PENDIENTE-VALIDAR` | Ver [P5](../open-questions.md) |
| RF-CON-15 | Drivers MCP y de contrato fijo | `PROPUESTO` | Post-MVP |
| RF-CON-16 | Transformación de la respuesta antes de dársela al modelo | `PROPUESTO` | MVP |

RF-CON-16 no es cosmético: devolverle al modelo un JSON de 200 KB cuesta
dinero, añade latencia y empeora la respuesta.

## Casos de uso

**CU-CON-01 — Publicar una herramienta de consulta.** Diego crea el conector
hacia `https://api.peluqueria.example`, guarda la clave, define
`consultar_disponibilidad` con su esquema, la enlaza a
`GET /v1/slots?date=…&service=…`, la prueba con datos reales y la publica.
Marta se la autoriza al agente.

**CU-CON-02 — Ejecución.** El modelo solicita la herramienta con unos
argumentos; el ejecutor comprueba autorización, valida contra el esquema,
resuelve el destino y lo revalida tras el DNS, descifra la credencial, llama
con timeout, limita el tamaño, transforma el resultado y lo devuelve.
*Alternativas*: argumentos inválidos → error estructurado sin salir a la red;
timeout → error `TIMEOUT`, el agente lo explica; `5xx` → un reintento solo si
es idempotente; destino no permitido → bloqueo y alerta.

**CU-CON-03 — Rotación de credencial.** Diego guarda la nueva; se usa en la
siguiente ejecución sin reiniciar nada y sin tocar las herramientas.

## Reglas de negocio

1. **Nada de URLs arbitrarias.** Toda ejecución resuelve contra un conector
   con allowlist. Sin esto, CocoChat es un proxy de peticiones para
   cualquiera.
2. La credencial no se expone al modelo, ni a la API, ni a los logs.
3. Toda ejecución se registra, incluidas las rechazadas.
4. En el MVP solo se permiten operaciones sin efectos secundarios.
5. Una herramienta publicada no se modifica: se publica una versión nueva.
6. Los errores del backend del cliente se traducen a la taxonomía propia; no
   se filtran cuerpos de error crudos al modelo.

## Dependencias

Depende de: Organizaciones, Autorización, gestión de secretos.
Bloquea a: la propuesta de valor entera.

## Riesgos

- **SSRF es el riesgo crítico**: el producto consiste, literalmente, en hacer
  peticiones HTTP que decide un modelo de lenguaje. Detalle completo en
  [`../security/security-model.md`](../security/security-model.md).
- **Inyección de prompt**: un backend comprometido puede devolver texto que
  intente manipular al agente. Los resultados se tratan como datos, nunca
  como instrucciones.
- **Riesgo de diseño**: el mapeo declarativo puede no cubrir backends reales
  (paginación, autenticación por sesión, GraphQL). Es la
  [P4](../open-questions.md) y hay que validarla con clientes antes de
  construir el motor, no después.
