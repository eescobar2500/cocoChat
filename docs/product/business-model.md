# Modelos de producto: comparación

> **DECIDIDO (2026-09): Modelo A con "trae tu propia clave" (híbrido 3).**
> Registrado en [ADR-0006](../architecture/architecture-decisions/ADR-0006-modelo-de-producto-y-costes.md).
>
> La comparación se conserva íntegra a propósito: documenta con qué criterios
> se decidió y qué se aceptaba a cambio. Si alguna vez se reconsidera, este
> es el punto de partida.

## Los dos modelos

**Modelo A — Plataforma gestionada (SaaS multi-tenant).** CocoChat opera la
infraestructura. El cliente entra a un panel, crea agentes, declara conectores
hacia su backend y paga una membresía. CocoChat ejecuta las conversaciones y
las llamadas a las herramientas.

**Modelo B — Backend entregado al cliente.** CocoChat entrega el backend
(licencia, imagen de contenedor, repositorio) y el cliente lo despliega en su
propia infraestructura, lo configura y lo integra con sus sistemas.

## Comparación

| Criterio | Modelo A (gestionado) | Modelo B (entregado) |
|---|---|---|
| **Complejidad de implementación** | Alta: multi-tenancy, aislamiento, cuotas, panel, facturación, operación 24/7 | Media: no hace falta multi-tenancy real; sí instalador, documentación y soporte de despliegues heterogéneos |
| **Tiempo de incorporación** | Horas: alta, conectar, probar | Días o semanas: infraestructura, despliegue, revisión de seguridad interna del cliente |
| **Mantenimiento** | Un despliegue que CocoChat controla; corrige una vez para todos | N versiones en producción que no controla; corregir implica que N clientes actualicen |
| **Responsabilidad sobre la seguridad** | De CocoChat, incluida la custodia de credenciales de producción ajenas. Muy exigente | Mayormente del cliente. Reduce el riesgo legal de CocoChat |
| **Costes de infraestructura** | De CocoChat, variables con el uso (tokens incluidos si usa su key) | Del cliente. CocoChat tiene coste marginal casi nulo |
| **Personalización** | Limitada a lo que el producto permita configurar | Alta: el cliente puede extender el código |
| **Dependencia del equipo del cliente** | Baja: configurar | **Alta**: desplegar, operar, actualizar |
| **Escalabilidad comercial** | Alta: crecer = vender | Baja: cada venta arrastra implantación y soporte |
| **Soporte y operación** | CocoChat opera; incidencias visibles y reproducibles | Depurar a ciegas en entornos ajenos; el coste de soporte por cliente es alto |
| **Diferenciación** | Producto acumulativo: cada mejora llega a todos | Se parece a vender un *boilerplate*; fácil de replicar |
| **Datos del cliente** | Las conversaciones pasan por CocoChat: objeción frecuente en compras empresariales | Nunca salen de su infraestructura: elimina la objeción |
| **Ingresos** | Recurrentes y predecibles | Licencia + soporte; menos recurrente, más irregular |

## Consecuencias arquitectónicas de la elección

No es una decisión comercial con una traducción técnica menor. Cambia el
trabajo de fondo:

| Pieza | Modelo A | Modelo B |
|---|---|---|
| Multi-tenancy y RLS | Obligatorio | Innecesario (un cliente por despliegue) |
| Gestión de secretos con KMS y rotación | Obligatorio | El cliente puede usar su propio gestor |
| Cuotas y facturación por uso | Obligatorio | Innecesario |
| Panel de administración | Obligatorio | Necesario, pero más simple |
| Instalador, imágenes, actualizaciones, documentación de operación | No | Obligatorio |
| Observabilidad multi-tenant | Obligatorio | Del cliente |

Dicho de otro modo: **el Modelo B es bastante más barato de construir y mucho
más caro de vender y sostener.** Y elegir mal cuesta una reescritura, porque
la multi-tenancy no se añade después sin migración de datos y auditoría.

## Modelos híbridos

1. **Gestionado con ejecutor en casa del cliente.** El panel, los agentes y la
   orquestación son SaaS; un pequeño agente desplegado por el cliente ejecuta
   las llamadas a su backend. Las credenciales y el tráfico interno no salen
   de su red. Responde a la objeción de datos sin perder el modelo SaaS, a
   cambio de un componente más que operar y diagnosticar.
2. **Gestionado con plan dedicado.** Misma base de código, instancia y base de
   datos aisladas para clientes que lo exijan, con precio acorde. Encaja de
   forma natural con [ADR-0002](../architecture/architecture-decisions/ADR-0002-multi-tenancy.md).
3. **Gestionado con "trae tu propia key".** El cliente pone su key de OpenAI;
   CocoChat cobra por plataforma, no por tokens. Elimina el mayor riesgo
   económico del Modelo A —márgenes negativos por consumo— y hace la
   estructura de costes predecible desde el primer día.
4. **SaaS ahora, opción autoalojada después**, como plan de gama alta, solo si
   aparece demanda real. Mantiene una sola base de código si se diseña el
   aislamiento bien desde el principio.

## MVP (decidido)

Es exactamente la opción que se proponía, y la que se ha aprobado:

- **Modelo A** (para no cerrarse la puerta a la escalabilidad comercial)
- **con "trae tu propia key"** (híbrido 3, elimina el riesgo de márgenes)
- **con un solo tipo de conector: HTTP declarativo de lectura**
  ([ADR-0004](../architecture/architecture-decisions/ADR-0004-motor-de-conectores.md))
- **con OpenAI como único proveedor**, y el diseño preparado para añadir
  otros después
- **con 2 o 3 clientes piloto reales**, no con un producto abierto.

El objetivo del MVP no es facturar: es responder a una pregunta concreta —
*¿una empresa consigue, sin nuestra ayuda, que su agente responda con datos de
su backend en menos de un día?*— porque toda la propuesta de valor depende de
que la respuesta sea sí.

## Lo que no se puede evaluar todavía

No se inventan cifras. Para completar este análisis hacen falta datos que hoy
no existen en el proyecto:

Con BYOK, el coste de tokens deja de ser un riesgo de margen —ya no lo paga
CocoChat—, pero sigue siendo un dato de venta: el cliente querrá saber qué le
va a costar. Sigue pendiente de medir:

- Coste medio de tokens por conversación en un caso real (medible con un
  piloto; hoy ni siquiera se guarda el `usage` que la API ya devuelve).
- Disposición a pagar por la membresía y precios de referencia del mercado
  objetivo.
- Volumen de conversaciones esperado por cliente.
- **Cuántos clientes abandonan el alta al pedirles su clave de OpenAI.** Con
  BYOK decidido, esta es la métrica de riesgo principal del embudo.
- Coste de soporte por cliente.
