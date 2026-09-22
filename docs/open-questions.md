# Preguntas abiertas

> Esta es la entrega más importante de la fase de análisis: **lo que no se
> puede decidir leyendo el código.**
>
> **Actualizado 2026-09** con las decisiones del dueño de producto. Las
> respondidas se conservan aquí, marcadas, para no perder la trazabilidad de
> por qué se decidió lo que se decidió.

## Resumen de lo decidido

| | Pregunta | Decisión | Dónde queda registrada |
|---|---|---|---|
| P1 | Modelo de producto | **Modelo A**, plataforma gestionada | [ADR-0006](architecture/architecture-decisions/ADR-0006-modelo-de-producto-y-costes.md) |
| P2 | Quién paga los tokens | **El cliente (BYOK)**; CocoChat custodia la clave cifrada | ADR-0006 |
| P3 | Conversaciones por CocoChat | **Sí** | ADR-0006 |
| P4 | Backends de los pilotos | **REST + JSON** | [ADR-0004](architecture/architecture-decisions/ADR-0004-motor-de-conectores.md) |
| P5 | Alcance del MVP | **Solo lectura** | ADR-0004 |
| P6 | Dónde vive el agente | **En CocoChat**, con `AgentRuntime`; no se usan agentes de OpenAI | [ADR-0005](architecture/architecture-decisions/ADR-0005-persistencia-y-runtime.md) |
| P11 | Capa de datos | **Prisma**, con tres condiciones sobre RLS | [ADR-0007](architecture/architecture-decisions/ADR-0007-prisma-como-capa-de-datos.md) |
| — | Proveedor de modelo | **Solo OpenAI** en el MVP, multi-proveedor después | ADR-0006 |

Queda **una decisión bloqueante pendiente**: P12, dónde se guardan los
secretos. Con BYOK gana peso, porque ahora CocoChat custodia también claves
de facturación de sus clientes.

## Decididas

### P1. ¿Modelo A (plataforma gestionada) o Modelo B (backend entregado)? — **DECIDIDA: Modelo A**
- **Por qué importaba**: determina si hace falta multi-tenancy, RLS, cuotas,
  facturación y custodia de secretos ajenos. Es la decisión más cara de
  revertir.
- **Consecuencia**: se confirman ADR-0002 y el módulo de organizaciones al
  completo. La Etapa 1 del roadmap se ejecuta entera.

### P2. ¿Quién paga los tokens? — **DECIDIDA: el cliente, con su propia clave**
- CocoChat no paga tokens; custodia la clave del cliente cifrada y la usa en
  su nombre. Solo OpenAI en el MVP.
- **Consecuencia**: aparece `provider_credentials`; la cuota pasa de control
  económico a control de abuso; la fricción se traslada al alta, que hay que
  cuidar mucho. Detalle en ADR-0006.

### P3. ¿Las conversaciones pueden pasar por la infraestructura de CocoChat? — **DECIDIDA: sí**
- **Consecuencia**: no se construye ejecutor autoalojado ni plan dedicado.
  Si un cliente grande lo exige más adelante, será un cambio de arquitectura,
  no de configuración: conviene detectarlo pronto en la fase comercial.

### P4. ¿Qué backends reales hay que integrar en los primeros pilotos? — **DECIDIDA: REST + JSON**
- **Consecuencia**: el conector HTTP declarativo de ADR-0004 es suficiente.
- **Aviso**: sigue siendo el supuesto con más riesgo del análisis. En cuanto
  haya un backend piloto concreto, conviene revisar contra él el contrato de
  [`api/integrations.md`](api/integrations.md) —sobre todo paginación,
  formato de errores y autenticación— antes de construir el motor.

### P5. ¿El MVP incluye acciones con efectos? — **DECIDIDA: solo lectura**
- **Consecuencia**: no hay idempotencia, ni confirmación, ni compensación en
  el MVP. La Etapa 5 del roadmap queda fuera de alcance por ahora.

### P6. ¿Agents API o Responses? ¿Dónde vive el agente? — **DECIDIDA: el agente vive en CocoChat**
- No se gestionan agentes en la plataforma de OpenAI. Las instrucciones, los
  parámetros y las herramientas son datos de CocoChat.
- **Consecuencia**: la implementación de referencia de `AgentRuntime` es la
  Responses API; `chatService.js` (Agents API, `waitForIdle`, limpieza de
  sesiones) deja de ser el camino principal. El bucle de *tool calling* lo
  implementa CocoChat, que era necesario de todos modos para autorizar,
  validar y auditar. Detalle en ADR-0005.

### P11. ¿Qué herramienta de migraciones y acceso a datos? — **DECIDIDA: Prisma**
- **Consecuencia**: RLS no viene de serie y hay que montarla explícitamente
  (rol sin `BYPASSRLS`, `set_config` por transacción, acceso encapsulado y
  prueba de aislamiento). Las tres condiciones están en ADR-0007.

## Bloqueante pendiente

### P12. ¿Dónde se guardan los secretos?
- **Por qué importa**: CocoChat custodia dos tipos de secreto ajeno —las
  credenciales de los conectores y, desde la decisión de BYOK, las claves de
  facturación de OpenAI de sus clientes—. Una filtración de las segundas se
  traduce en gasto directo para el cliente.
- **Bloquea**: Etapa 1 (no se puede guardar una clave sin decidir cómo).
- **Propuesta**: **cifrado por sobre**. Cada organización tiene una clave de
  datos; esa clave se cifra con una clave maestra de un KMS (AWS KMS o GCP
  KMS); en la base solo queda el *ciphertext* y la versión de clave. Si el
  proveedor de nube todavía no está decidido, el MVP puede arrancar con la
  clave maestra en variable de entorno **manteniendo la misma estructura**
  (`ciphertext`, `key_version`), de forma que pasar a KMS después sea una
  rotación y no una migración de esquema.
- **Descartado por ahora**: Vault, por coste operativo desproporcionado en
  esta fase.
- **Invariantes, decida lo que se decida**: el secreto nunca se devuelve por
  la API, nunca aparece en logs, se descifra solo en el momento de usarlo y
  admite rotación sin corte.

## Importantes: se pueden asumir por defecto, pero conviene confirmarlas

### P7. ¿Quién es el usuario final y hay que identificarlo?
- Hoy no hay ninguna noción de usuario final. Si el agente va a consultar
  datos personales ("mis reservas"), hace falta identidad y autorización del
  usuario final, no solo del tenant. Esto es un subsistema entero.
- **Por defecto**: usuarios finales anónimos, con referencia opaca aportada
  por el cliente.

### P8. ¿Qué compromisos legales y de cumplimiento se van a asumir?
- RGPD, encargado del tratamiento, retención, residencia de datos, uso de los
  datos para entrenamiento. Afecta contratos y arquitectura.
- **Por defecto**: retención configurable, sin entrenamiento con datos de
  clientes, región única.

### P9. ¿Qué nivel de servicio se promete?
- Latencia, disponibilidad, soporte. Una respuesta de agente tarda hoy
  decenas de segundos; eso condiciona qué casos de uso son viables.
- **Por defecto**: mejor esfuerzo, sin SLA contractual en el MVP.

### P10. ¿Qué equipo hay disponible?
- El roadmap está ordenado por dependencias y sin fechas precisamente porque
  esto no se sabe. Con el equipo definido se puede secuenciar de verdad.
- **Por defecto**: sin estimación temporal.

## Técnicas: decidibles por el equipo, pero deben quedar registradas

### P13. ¿TypeScript o seguir en JavaScript?
- El proyecto es JavaScript ESM sin tipos. Un motor de conectores con
  esquemas, contratos y validación se beneficia mucho de tipos, pero migrar
  tiene coste.
- **Por defecto**: mantener JavaScript en el MVP y validar en tiempo de
  ejecución con JSON Schema. Reevaluar en la Etapa 3.

### P14. ¿Qué frontend administrativo?
- El actual es una interfaz de chat; el panel es otro producto. ¿Se amplía la
  aplicación existente o se crea una nueva en el mismo monorepo?
- **Por defecto**: aplicación nueva en el monorepo, compartiendo cliente de
  API.

### P15. ¿Qué estrategia de pruebas?
- No existe ninguna prueba. Antes de tocar seguridad y multi-tenancy hay que
  decidir el mínimo exigible.
- **Por defecto**: pruebas de integración sobre las rutas y pruebas unitarias
  del motor de conectores y de la validación de destinos.

## Supuestos asumidos en esta documentación

Para poder avanzar, el análisis ha asumido lo siguiente. **Si alguno es
falso, hay documentos que deben revisarse:**

| Supuesto | Estado | Documentos afectados si es falso |
|---|---|---|
| El objetivo es SaaS multi-tenant | **Confirmado** (P1) | — |
| Los backends de los clientes son REST+JSON | **Confirmado** (P4), pero sin backend piloto concreto | `api/integrations.md`, ADR-0004 |
| El MVP es de solo lectura | **Confirmado** (P5) | — |
| Se sigue con OpenAI como proveedor | **Confirmado** para el MVP | ADR-0005, ADR-0006 |
| Los clientes tienen equipo de desarrollo propio | Sin confirmar | `product/personas.md`, `product/vision.md` |
| Un cliente = una organización | Sin confirmar | Modelo de datos, modelo de seguridad |
| El cliente acepta crear y ceder su clave de OpenAI en el alta | Sin confirmar | ADR-0006, embudo de alta |
