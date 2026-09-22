# Preguntas abiertas

> Estado: `PENDIENTE-VALIDAR`. Esta es la entrega más importante de la fase de
> análisis: **lo que no se puede decidir leyendo el código.**
>
> Cada pregunta indica por qué importa, qué bloquea y cuál sería la respuesta
> por defecto si no llega una decisión. Las respuestas por defecto son
> supuestos de trabajo, no decisiones tomadas.

## Bloqueantes: hay que responderlas antes de escribir código

### P1. ¿Modelo A (plataforma gestionada) o Modelo B (backend entregado)?
- **Por qué importa**: determina si hace falta multi-tenancy, RLS, cuotas,
  facturación y custodia de secretos ajenos. Es la decisión más cara de
  revertir.
- **Bloquea**: Etapa 1 completa.
- **Por defecto**: Modelo A. Ver [`product/business-model.md`](product/business-model.md).

### P2. ¿Quién paga los tokens?
- **Por qué importa**: si los paga CocoChat con una membresía plana, un
  cliente intensivo puede dejar márgenes negativos. Si los paga el cliente con
  su propia key, el modelo económico es predecible pero la propuesta pierde
  simplicidad.
- **Bloquea**: modelo de precios, cuotas, gestión de credenciales del
  proveedor.
- **Por defecto**: "trae tu propia key" en el MVP, con medición desde la
  Etapa 0.

### P3. ¿Las conversaciones pueden pasar por la infraestructura de CocoChat?
- **Por qué importa**: si algún cliente objetivo lo prohíbe, hace falta el
  ejecutor autoalojado o un plan dedicado, y eso cambia la arquitectura, no
  solo el empaquetado.
- **Bloquea**: diseño del aislamiento y del despliegue.
- **Por defecto**: sí, con plan dedicado disponible para quien lo exija.

### P4. ¿Qué backends reales hay que integrar en los primeros pilotos?
- **Por qué importa**: el motor de conectores se está diseñando sobre un caso
  hipotético. Si los backends reales usan SOAP, GraphQL, autenticación por
  sesión o paginación exótica, el HTTP declarativo se queda corto.
- **Bloquea**: la Etapa 3 entera.
- **Por defecto**: REST + JSON con clave en cabecera. **Es el supuesto de
  mayor riesgo de todo el análisis.**

### P5. ¿El MVP incluye acciones con efectos (reservar) o solo consultas?
- **Por qué importa**: escribir exige idempotencia, confirmación,
  compensación y un marco de responsabilidad. Multiplica el alcance.
- **Bloquea**: alcance del MVP y el contrato de herramientas.
- **Por defecto**: solo lectura ([ADR-0004](architecture/architecture-decisions/ADR-0004-motor-de-conectores.md)).

## Importantes: se pueden asumir por defecto, pero conviene confirmarlas

### P6. ¿Se sigue con la Agents API (beta) o se consolida en Responses?
- Mantener dos runtimes duplica el trabajo indefinidamente. Existe un puerto
  propuesto para no depender de la respuesta, pero hay que elegir cuál es el
  camino principal.
- **Por defecto**: puerto `AgentRuntime`, Responses como implementación
  estable de referencia.

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

### P11. ¿Qué herramienta de migraciones y acceso a datos?
- Hoy no hay ORM. La elección condiciona cómo se aplica RLS.
- **Por defecto**: SQL con una capa ligera de consultas y migraciones
  versionadas; evitar un ORM que oculte el `organization_id`.

### P12. ¿Dónde se guardan los secretos de los conectores?
- Base de datos con cifrado por sobre y clave en KMS, o un gestor dedicado.
- **Por defecto**: cifrado por sobre con KMS, clave por organización.

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

| Supuesto | Documentos afectados si es falso |
|---|---|
| El objetivo es SaaS multi-tenant | Todo `architecture/target-architecture.md` y el modelo de datos |
| Los backends de los clientes son REST+JSON | `api/integrations.md`, ADR-0004 |
| Los clientes tienen equipo de desarrollo propio | `product/personas.md`, `product/vision.md` |
| El MVP es de solo lectura | Roadmap, contrato de herramientas |
| Se sigue con OpenAI como proveedor | ADR-0005 |
| Un cliente = una organización | Modelo de datos, modelo de seguridad |
