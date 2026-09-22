# Visión de producto

> Estado: `PROPUESTO` — redactado a partir del enunciado del análisis y del
> código existente. Requiere validación del dueño de producto.

## Enunciado

**CocoChat es la capa de agentes de IA para empresas que ya tienen un backend
y un equipo de desarrollo, pero no tienen IA en sus procesos.**

La empresa no cambia sus sistemas ni migra sus datos: expone las operaciones
que ya tiene, las declara como herramientas en CocoChat y obtiene agentes
conversacionales capaces de consultar y —más adelante— operar sobre ellos.

## El problema

Una empresa mediana con backend propio que quiere un asistente de IA hoy tiene
tres caminos, y los tres son malos:

1. **Construirlo**: integrar un proveedor de modelos, resolver el bucle de
   herramientas, la seguridad, la auditoría y el coste. Meses de un equipo que
   ya está ocupado, y en un terreno donde no tiene experiencia.
2. **Un chatbot genérico**: se configura en una tarde, pero no sabe nada de sus
   datos. Responde sobre el horario de apertura, no sobre si hay hueco el
   martes.
3. **Una consultora**: funciona, pero es un proyecto a medida, caro y difícil
   de evolucionar.

El hueco está en el medio: **la potencia de la opción 1 con el tiempo de
puesta en marcha de la opción 2**.

## La propuesta de valor

> "Conecta tu backend y ten un agente que sabe responder con tus datos reales,
> en horas, sin escribir un servicio de IA."

Concretamente, CocoChat aporta lo que ninguna empresa quiere construir dos
veces:

- El bucle de conversación y llamada a herramientas.
- El registro de qué herramientas existen y cuáles puede usar cada agente.
- La ejecución **segura** contra sistemas ajenos: validación, allowlist,
  timeouts, credenciales cifradas.
- La auditoría: qué preguntó el usuario, qué consultó el agente, qué
  respondió el sistema.
- El control de coste por organización.

Y lo que deja al cliente: **sus reglas de negocio y sus datos, donde ya
están**.

## Diferenciación

Frente a un chatbot genérico: responde con datos reales y operables.
Frente a construirlo en casa: semanas de trabajo convertidas en configuración,
y una superficie de seguridad ya resuelta.
Frente a una consultora: producto, no proyecto; evoluciona sin renegociar.

El activo defendible no es el modelo —eso es de OpenAI— ni el chat. Es **el
catálogo de integraciones del cliente y el registro auditable de lo que sus
agentes hacen sobre sus sistemas**. Cuanto más se configura, más cuesta
irse; y es una dependencia que se gana dando valor, no atrapando datos.

## Lo que CocoChat no es

Decirlo evita meses de trabajo mal dirigido:

- **No es un constructor de flujos** tipo *no-code* de propósito general.
- **No es un data warehouse ni un ETL**: no copia los datos del cliente, los
  consulta en el momento.
- **No es un proveedor de modelos**: los consume.
- **No es un CRM ni un helpdesk**: se integra con los que el cliente ya tiene.
- **No sustituye al equipo de desarrollo del cliente**: le evita escribir la
  parte de IA, no la lógica de su negocio.

## Punto de partida real

Conviene no confundir la visión con el estado. Hoy existe un chat funcional
contra un único agente, sin usuarios, sin tenants, sin base de datos y sin
conectores: ver
[`../architecture/current-state.md`](../architecture/current-state.md).
La visión describe el destino, no el producto actual.

## Cómo se sabrá si funciona

Métricas propuestas, en orden de importancia:

1. **Tiempo desde el alta hasta el primer agente que responde con datos
   reales.** Es *la* métrica: si no baja de días a horas, no hay producto.
2. Número de herramientas publicadas por cliente (profundidad de adopción).
3. Porcentaje de conversaciones que invocan al menos una herramienta.
4. Tasa de error de los conectores (calidad de la ejecución).
5. Coste de tokens por conversación (viabilidad del modelo económico).
