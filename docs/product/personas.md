# Personas y actores

> Estado: `PROPUESTO`. Derivado del enunciado del producto; conviene
> contrastarlo con los clientes piloto reales.

## Actores del sistema

Distinción importante: una **persona** usa el panel; un **sistema** consume la
API. Hoy el código no distingue ninguno de los dos: no hay usuarios.

| Actor | Tipo | Interactúa con | ¿Existe hoy? |
|---|---|---|---|
| Responsable de la empresa cliente | Persona | Panel: contrata, invita, ve consumo | No |
| Desarrollador del cliente | Persona | Panel: conectores, herramientas, pruebas | No |
| Responsable de operaciones del cliente | Persona | Panel: agentes, instrucciones, logs | No |
| Usuario final | Persona | Chat (widget, web, canal) | Sí, sin identidad |
| Backend del cliente | Sistema | Recibe llamadas de herramientas; puede llamar a la API | No |
| Agente de IA | Sistema | Interpreta y ejecuta herramientas autorizadas | Parcial (sin herramientas) |
| Operador de CocoChat | Persona | Soporte, mantenimiento de sesiones | Sí, vía `x-admin-token` |
| Proveedor de modelo | Sistema externo | Genera respuestas | Sí (OpenAI) |

## Personas

### Diego — Desarrollador backend del cliente

*Empresa de 60 personas, equipo de 4 desarrolladores. Mantiene una API REST en
Node y tiene la lista de tareas llena.*

- **Necesita**: conectar su API sin escribir un servicio de IA, entender qué
  se le va a llamar y cuándo, y probar antes de publicar.
- **Le preocupa**: darle a un tercero una credencial de producción, que un
  agente llame a un endpoint que no debe, y depurar un fallo que ocurre dentro
  de una caja negra.
- **Le convence**: "importa tu OpenAPI, revisa las herramientas, pruébalas y
  publícalas", más un registro de ejecuciones que pueda leer cuando algo
  falle.
- **Le espanta**: un lenguaje de mapeo propio mal documentado, y no poder ver
  la petición exacta que se envió a su backend.

### Marta — Responsable de operaciones

*Gestiona la atención al cliente. No programa.*

- **Necesita**: que el agente responda bien, cambiar su tono e instrucciones
  sin depender de Diego, y ver qué está preguntando la gente.
- **Le preocupa**: que el agente invente datos o prometa algo imposible.
- **Le convence**: poder editar instrucciones con historial y *rollback*, y
  ver conversaciones reales.
- **Requisito derivado**: separar `agent_configurations` como versiones no es
  un lujo técnico; es lo que le permite trabajar sin miedo.

### Javier — Director / decisor de compra

*Firma el contrato.*

- **Necesita**: un caso claro (menos carga en atención, respuesta inmediata),
  coste predecible y evitar un proyecto de seis meses.
- **Le preocupa**: el coste variable descontrolado, la fuga de datos y la
  dependencia del proveedor.
- **Le convence**: puesta en marcha en días, límite de gasto configurable y la
  posibilidad de usar su propia key de OpenAI.
- **Requisito derivado**: la cuota por organización y el panel de consumo son
  criterios de compra, no adornos.

### Lucía — Usuaria final

*Quiere saber si hay hueco el martes por la tarde.*

- **Necesita**: respuesta correcta y rápida; que el agente admita cuando no
  puede consultar algo.
- **Le preocupa**: que le den información falsa.
- **Requisito derivado**: la regla de "si la herramienta falla, no inventes"
  es un requisito de producto, y la latencia de la conversación —hoy de 10-20
  s según el propio código del frontend— es una métrica que el negocio nota.

## Implicaciones de diseño

1. **Al menos tres roles distintos** con permisos diferentes: Diego toca
   conectores, Marta toca instrucciones, Javier ve consumo. La tabla de roles
   de [`../security/security-model.md`](../security/security-model.md#autorización-roles-propuestos)
   sale directamente de aquí.
2. **Marta no debe poder leer credenciales; Diego no debe necesitar leerlas
   tampoco.**
3. **El panel necesita dos superficies muy distintas**: técnica (conectores,
   esquemas, logs) y de negocio (instrucciones, conversaciones, consumo).
   Mezclarlas hará que ninguna de las dos sirva.
4. **La ansiedad dominante del comprador es el control**, no las capacidades:
   límites, registro y reversibilidad venden más que un modelo mejor.
