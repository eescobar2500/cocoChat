# Estrategia de integración con backends de clientes

> Estado: `PROPUESTO`. Nada de esto existe en el código.
> Objetivo: que un agente de CocoChat pueda consultar y operar sobre el
> backend de un cliente sin que CocoChat conozca ni desarrolle nada
> específico de ese cliente.

## 1. El problema, planteado con precisión

Dos clientes con el mismo caso de negocio exponen APIs incompatibles:

```
Peluquería:  GET  /appointments/available?date=2026-01-10
Clínica:     POST /api/v2/scheduling/slots   { "day": "10-01-2026" }
```

Si CocoChat escribe un adaptador por cliente, el coste de incorporación crece
linealmente con el número de clientes y el equipo de CocoChat se convierte en
una consultora. **Ese es el fracaso que hay que evitar.**

El problema real no es "llamar a un HTTP ajeno". Son cinco problemas:

1. **Descubrimiento**: cómo sabe el modelo qué puede hacer.
2. **Traducción**: cómo se convierte la intención del usuario en una llamada
   concreta y válida.
3. **Confianza**: cómo se garantiza que el agente solo hace lo autorizado.
4. **Contrato**: quién define la forma de entrada y salida, y quién la versiona.
5. **Operación**: qué pasa con timeouts, errores, reintentos y costes.

Cualquier alternativa que solo resuelva (1) y (2) es una demo, no un producto.

## 2. Alternativas evaluadas

Para cada una: cómo funciona, cómo se registra, cómo se autentica, quién hace
qué, riesgos y cuándo conviene.

---

### Alternativa A — Adaptador por cliente (código en CocoChat)

**Cómo funciona.** El equipo de CocoChat escribe un módulo TypeScript/JS por
cliente que traduce las herramientas del agente a llamadas concretas.

- *Registro*: un despliegue de CocoChat.
- *Configuración del agente*: en código.
- *Autenticación*: credenciales en el `.env` de CocoChat.
- *Ejecución*: llamada directa.
- *Errores*: a criterio de quien escribió el adaptador.
- *CocoChat hace*: todo. *El cliente hace*: nada (salvo exponer su API).
- *Coste*: días de ingeniería por cliente; el mantenimiento crece sin techo.
- *Riesgos*: no escala comercialmente; cada cambio del cliente rompe CocoChat.

**Cuándo conviene**: para los **primeros 1-3 clientes piloto**, como forma de
descubrir el contrato real antes de generalizarlo. Como estrategia de producto
es un callejón sin salida, pero como herramienta de aprendizaje es válida.

---

### Alternativa B — Conector HTTP declarativo (configuración, no código)

**Cómo funciona.** El cliente declara, desde el panel administrativo, una
"herramienta": nombre, descripción en lenguaje natural, esquema JSON de
parámetros, método y plantilla de URL, mapeo de parámetros a
query/path/body, y un mapeo (o un `jq`/JSONPath) de la respuesta a un
resultado estructurado. CocoChat guarda esa declaración y, en tiempo de
ejecución, la expone al modelo como una *function tool*.

- *Registro*: formulario o import de OpenAPI → se genera un borrador de
  herramientas que el cliente revisa y publica.
- *Configuración del agente*: el cliente asocia herramientas publicadas al
  agente (`AgentTool`), con permisos por herramienta.
- *Autenticación*: la credencial se guarda **cifrada y referenciada por id**,
  nunca dentro de la configuración del agente. Soporta API key en cabecera,
  Bearer estático y OAuth 2.0 *client credentials* con refresco.
- *Ejecución*: el motor valida argumentos contra el JSON Schema → construye la
  petición → la lanza con allowlist de destino, timeout y límite de tamaño →
  valida la respuesta → la devuelve al modelo.
- *Errores*: taxonomía propia y uniforme (ver
  [`../api/integrations.md`](../api/integrations.md)), con reintento solo en
  operaciones marcadas idempotentes.
- *CocoChat hace*: descubrimiento, validación, seguridad, ejecución, auditoría.
  *El cliente hace*: exponer endpoints HTTPS y declararlos una vez.
- *Coste*: alto de una vez (es el núcleo del producto), casi cero por cliente.
- *Riesgos*: **SSRF** (URL la aporta el cliente), exfiltración vía prompt
  injection, mapeos mal declarados que devuelven basura al modelo, y una
  superficie de configuración que puede abrumar a un usuario no técnico.

**Cuándo conviene**: es la **opción por defecto** para un SaaS multi-tenant.
Convierte la incorporación de un cliente en configuración, que es exactamente
la promesa comercial.

---

### Alternativa C — Contrato de integración fijo (el cliente implementa la API de CocoChat)

**Cómo funciona.** CocoChat publica una especificación —p. ej.
`POST /cocochat/tools/:name` con un sobre JSON estándar— y el cliente
implementa ese endpoint en su backend, traduciéndolo internamente.

- *Registro*: el cliente da una URL base y CocoChat descubre las herramientas
  mediante un `GET /cocochat/tools` (manifiesto).
- *Autenticación*: bidireccional. CocoChat firma sus peticiones (HMAC o mTLS)
  para que el cliente pueda verificar el origen; el cliente da una credencial
  a CocoChat.
- *Ejecución*: una sola forma de llamada para todos los clientes.
- *CocoChat hace*: orquestación y seguridad. *El cliente hace*: **el trabajo de
  traducción**, que es justo lo que en (B) hace el motor declarativo.
- *Coste*: bajo para CocoChat, **traslada días de desarrollo al cliente**.
- *Riesgos*: fricción comercial (un cliente sin equipo disponible no arranca);
  versionado del contrato entre dos organizaciones.

**Cuándo conviene**: cuando el cliente tiene equipo de ingeniería y lógica de
negocio compleja que no cabe en un mapeo declarativo (reglas de precios,
validaciones cruzadas). Es el complemento natural de (B), no su rival: (B)
para el 80 % de casos CRUD, (C) para el 20 % complejo. El enunciado del
producto —"empresas medianas **con equipo de programadores**"— hace que (C)
sea más viable aquí que en un SaaS dirigido a pymes sin equipo técnico.

---

### Alternativa D — MCP (Model Context Protocol)

**Cómo funciona.** El cliente expone un servidor MCP (propio o generado desde
su OpenAPI) y CocoChat actúa como cliente MCP: descubre herramientas y
recursos por protocolo estándar y las inyecta en el agente.

- *Registro*: URL del servidor MCP + credenciales; el descubrimiento es
  automático y **dinámico** (la lista de herramientas puede cambiar).
- *Autenticación*: la que soporte el transporte; en remoto, típicamente OAuth
  2.0 o cabecera de autorización.
- *CocoChat hace*: cliente MCP, política de permisos y auditoría.
  *El cliente hace*: operar un servidor MCP.
- *Coste*: medio; el ecosistema y los SDK ya existen, pero es infraestructura
  adicional que el cliente debe desplegar y mantener.
- *Riesgos*: el descubrimiento dinámico es un riesgo de seguridad real —una
  herramienta nueva o una descripción modificada puede alterar el
  comportamiento del agente sin que nadie lo apruebe ("rug pull"). Exige
  fijar y aprobar explícitamente las versiones de las herramientas.

**Cuándo conviene**: como **segundo tipo de conector**, no como el primero.
Es la apuesta correcta a medio plazo por interoperabilidad (el cliente reutiliza
su servidor MCP con otras herramientas), pero exige más madurez del cliente que
(B) y añade una dependencia de protocolo antes de haber validado el negocio.

---

### Alternativa E — SDK entregado al cliente

**Cómo funciona.** CocoChat publica una librería (`@cocochat/sdk`) que el
cliente monta en su backend; la librería expone sus funciones como
herramientas y se encarga de la autenticación y el transporte.

- *Coste*: alto y **recurrente por cada lenguaje soportado** (Node, Python,
  PHP, Java, .NET…). Cada cambio del contrato exige publicar N versiones y
  esperar a que los clientes actualicen.
- *Riesgos*: fragmentación de versiones en producción; responsabilidad difusa
  cuando falla algo dentro del proceso del cliente.

**Cuándo conviene**: como *azúcar* sobre (C) una vez el contrato esté estable y
haya demanda en un lenguaje concreto. **Nunca como mecanismo base.**

---

### Alternativa F — Webhooks / arquitectura de eventos

**Cómo funciona.** El cliente notifica a CocoChat cuando algo cambia (nueva
reserva, stock actualizado) y/o CocoChat notifica al cliente cuando un agente
decide una acción, que el cliente procesa de forma asíncrona.

- *Naturaleza*: **asíncrona**, y una conversación es síncrona. Un usuario que
  pregunta "¿qué horarios hay mañana?" no puede esperar a un webhook.
- *CocoChat hace*: recibir, validar firma, deduplicar, reintentar.
- *Riesgos*: entrega al menos una vez → hace falta idempotencia; datos
  obsoletos si se usa como caché.

**Cuándo conviene**: **complementario, no alternativo**. Encaja bien para
(a) notificar al cliente de eventos del agente (escalado a humano, conversación
cerrada), (b) invalidar caché de datos poco cambiantes, y (c) operaciones
largas que no caben en el turno. No sirve como mecanismo principal de consulta.

---

### Alternativa G — Integration Hub / servicio de ejecución de herramientas separado

No es una forma distinta de integrar, sino una **decisión de despliegue** sobre
dónde corre el motor de (B)/(C)/(D): dentro del backend de CocoChat o en un
servicio aislado.

A favor de aislarlo: la ejecución de conectores es la parte peligrosa del
sistema (hace peticiones a URLs que aporta un tercero, maneja secretos
descifrados y puede tumbar el proceso con timeouts). Aislarlo permite una
red restringida, escalado independiente y un radio de daño acotado.

En contra: latencia añadida, un despliegue más que operar y complejidad que hoy
no se justifica con cero clientes.

**Recomendación**: diseñar el motor **como módulo con frontera explícita**
(interfaz `ToolExecutor`, sin acceso a la base de datos principal salvo por
repositorios acotados) para poder extraerlo a un servicio cuando el volumen o
el riesgo lo pidan. No extraerlo en el MVP. Ver
[ADR-0004](architecture-decisions/ADR-0004-motor-de-conectores.md).

## 3. Comparativa

| Criterio | A: Adaptador | B: HTTP declarativo | C: Contrato fijo | D: MCP | E: SDK | F: Eventos |
|---|---|---|---|---|---|---|
| Esfuerzo de CocoChat por cliente | Muy alto | **Casi nulo** | Bajo | Bajo | Bajo | Bajo |
| Esfuerzo del cliente | Nulo | **Bajo** (configurar) | Alto (implementar) | Medio-alto | Medio | Medio |
| Tiempo de incorporación | Semanas | **Horas** | Días | Días | Días | Días |
| Escalabilidad comercial | Nula | **Alta** | Media | Alta | Media | n/a |
| Cubre lógica compleja | Sí | Limitado | **Sí** | Sí | Sí | Sí |
| Superficie de seguridad | Baja | **Alta (SSRF)** | Media | Media-alta | Media | Media |
| Interoperabilidad | Nula | Media | Baja | **Alta** | Baja | Media |
| Síncrono (sirve en un turno) | Sí | Sí | Sí | Sí | Sí | **No** |
| Madurez requerida del cliente | Ninguna | **Baja** | Alta | Alta | Media | Media |

## 4. Recomendación (para validar, no para ejecutar)

Una plataforma sostenible necesita **más de un tipo de conector**, pero no
todos a la vez. La secuencia que propongo:

1. **MVP: (B) conector HTTP declarativo, solo lectura, con JSON Schema.**
   Es el único que cumple la promesa comercial ("configurar, no programar")
   sin depender de trabajo del cliente, y ejercita de punta a punta las cinco
   piezas difíciles: descubrimiento, validación, seguridad, ejecución y
   auditoría. Empezar por **solo lectura** reduce a la mitad el riesgo: un
   `GET` mal ejecutado devuelve datos de más; un `POST` mal ejecutado crea una
   reserva falsa.
2. **Segundo paso: (C) contrato fijo** para clientes con lógica que no cabe en
   un mapeo, y **escritura** con idempotencia y confirmación.
3. **Tercero: (D) MCP** como tipo de conector adicional cuando haya demanda de
   interoperabilidad, con aprobación explícita de versiones de herramientas.
4. **Transversal: (F) webhooks** para eventos salientes y para invalidar caché.
5. **(A) solo** como vía de descubrimiento con el cliente piloto, y con fecha
   de caducidad explícita.
6. **(E) SDK** solo si el contrato (C) se estabiliza y hay demanda real.

La clave de diseño que hace compatible esta secuencia: **el agente no habla
con conectores, habla con herramientas**. `Tool` es la abstracción estable;
`Connector` es el detalle de transporte intercambiable. Añadir MCP más adelante
debe ser añadir una implementación de `ConnectorDriver`, no rediseñar el
producto.

## 5. Lo que NO se resuelve con ninguna alternativa

Hay que decirlo explícitamente, porque afecta a la viabilidad:

- **Prompt injection.** Si el agente lee datos del backend del cliente (o del
  mensaje de un usuario final) y esos datos contienen instrucciones, puede
  intentar llamar a otra herramienta. La mitigación no es el conector: es
  limitar el conjunto de herramientas por agente, exigir confirmación humana
  en las de escritura y auditarlo todo. No hay solución completa conocida.
- **Calidad de la descripción de la herramienta.** Si el cliente escribe una
  descripción ambigua, el modelo elegirá mal. Esto es soporte y buenas
  plantillas, no arquitectura.
- **Datos sensibles que el backend devuelve de más.** CocoChat no puede saber
  que un campo es un DNI. Hacen falta reglas de redacción declaradas por el
  cliente y el principio de devolver solo campos mapeados explícitamente
  (allowlist de salida, nunca pasar la respuesta cruda al modelo).
