# ADR-0006 — Modelo de producto, coste de tokens y credenciales de proveedor

- **Estado**: **Aceptado** — decidido por el dueño de producto (2026-09)
- **Fecha**: 2026-09
- **Ámbito**: Producto, arquitectura y seguridad
- **Relacionado**: [`../../product/business-model.md`](../../product/business-model.md),
  [`ADR-0002`](ADR-0002-multi-tenancy.md), [`ADR-0005`](ADR-0005-persistencia-y-runtime.md)

## Contexto

[`business-model.md`](../../product/business-model.md) planteaba dos modelos
(plataforma gestionada frente a backend entregado) y varios híbridos, sin
recomendar uno, porque la elección condiciona la arquitectura entera:
multi-tenancy, RLS, cuotas, custodia de secretos y operación.

Quedaban abiertas las preguntas P1 (modelo), P2 (quién paga los tokens) y P3
(si las conversaciones pueden atravesar la infraestructura de CocoChat).

## Decisión

1. **Modelo A: plataforma gestionada multi-tenant.** CocoChat opera la
   infraestructura; el cliente configura desde un panel.
2. **BYOK — el cliente pone su clave del proveedor.** CocoChat no paga los
   tokens: los paga el cliente con su propia clave, que la plataforma
   **custodia cifrada** y usa en su nombre. El ingreso de CocoChat es la
   membresía por plataforma, no un margen sobre el consumo.
3. **Las conversaciones pasan por la infraestructura de CocoChat.** No se
   contempla, por ahora, ejecutor autoalojado ni plan dedicado.
4. **Un solo proveedor en el MVP: OpenAI.** El diseño debe admitir más
   proveedores después, pero no se construyen adaptadores adicionales ahora.

Es el híbrido 3 de `business-model.md`: Modelo A con "trae tu propia clave".

## Consecuencias

**Positivas**

- El mayor riesgo económico del Modelo A —márgenes negativos con un cliente
  intensivo— desaparece. La estructura de costes es predecible desde el
  primer día y el precio no depende de medir consumo con precisión.
- Facilita la venta: el cliente ve y controla su gasto en su propia cuenta de
  OpenAI, y no hay una caja negra de costes.
- La cuota deja de ser un mecanismo de protección económica y pasa a ser un
  control de abuso; se puede simplificar en el MVP.

**Negativas**

- **La incorporación se complica**: el cliente tiene que crear una cuenta de
  OpenAI, una clave, y entender qué está pagando, antes de ver nada
  funcionando. Choca de frente con la métrica principal de la visión —tiempo
  hasta el primer agente útil—, así que el alta debe guiar ese paso con
  mucho cuidado.
- CocoChat custodia **claves de facturación ajenas**: una filtración se
  traduce en gasto directo para el cliente. Eleva la exigencia sobre la
  gestión de secretos, no la reduce.
- No se puede ofrecer una prueba sin fricción. Conviene prever una clave de
  la plataforma, con tope estricto, solo para el entorno de pruebas.

**Arquitectónicas**

- Se confirman ADR-0002 (multi-tenancy con RLS) y todo el módulo de
  organizaciones: sin Modelo A, sobraban.
- Aparece una entidad nueva, `provider_credentials`, con el mismo trato que
  las credenciales de conector: cifradas, nunca legibles por la API, nunca en
  logs. Ver [`../../data/data-model.md`](../../data/data-model.md).
- El `AgentRuntime` recibe la credencial del proveedor **por organización**,
  no del entorno del proceso. `OPENAI_API_KEY` como variable global
  (`backend/src/config/env.js`) deja de ser el camino: como mucho queda para
  el entorno de pruebas de la plataforma.
- Multi-proveedor futuro: el puerto `AgentRuntime` ya lo contempla; lo que
  se añade es que la credencial es por organización **y por proveedor**.

## Riesgos

- **Clave de producción del cliente mal custodiada.** Mitigación: cifrado por
  sobre, clave de datos por organización, sin lectura desde la API, rotación
  soportada y alerta ante uso anómalo.
- **Abandono en el alta** por la fricción de la clave. Mitigación: medir
  cuántos clientes se quedan en ese paso durante los pilotos; si es alto,
  reconsiderar un plan con tokens incluidos.
- **Errores del proveedor atribuibles al cliente** (clave sin saldo, límite
  de la cuenta alcanzado). Hay que distinguirlos en la interfaz de los fallos
  de CocoChat, o todos acabarán en nuestro soporte.

## Pendiente

P12 (dónde se guardan exactamente los secretos) sigue abierta y ahora es más
importante, porque afecta también a las claves del proveedor. Propuesta en
[`../../open-questions.md`](../../open-questions.md).
