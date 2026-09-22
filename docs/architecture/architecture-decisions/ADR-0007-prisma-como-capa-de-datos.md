# ADR-0007 — Prisma como ORM y capa de migraciones

- **Estado**: **Aceptado** — decidido por el dueño de producto (2026-09)
- **Fecha**: 2026-09
- **Ámbito**: Datos
- **Relacionado**: [`ADR-0002`](ADR-0002-multi-tenancy.md),
  [`ADR-0005`](ADR-0005-persistencia-y-runtime.md)

## Contexto

La pregunta P11 dejaba abierta la herramienta de acceso a datos. La
documentación previa sugería por defecto SQL con una capa ligera, por un
motivo concreto: **un ORM que abstrae demasiado facilita olvidar el
`organization_id`**, y ese olvido es exactamente la fuga entre tenants que
ADR-0002 quiere evitar.

El dueño de producto elige **Prisma**.

## Decisión

Prisma como ORM y gestor de migraciones sobre PostgreSQL, con tres
condiciones que no son opcionales.

### Condición 1 — RLS se mantiene, y Prisma no la trae puesta

Prisma no gestiona RLS. Para que las políticas de ADR-0002 se apliquen hacen
falta tres cosas:

- La aplicación conecta con un rol de PostgreSQL **sin** `BYPASSRLS` y que no
  sea propietario de las tablas. Con el rol equivocado, las políticas se
  escriben, se despliegan y **no hacen nada**: es el fallo silencioso más
  peligroso de este diseño.
- El contexto de organización se fija por transacción antes de cualquier
  consulta:

  ```js
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.organization_id', ${orgId}, true)`;
    return tx.agent.findMany(); // RLS filtra; no hace falta el where
  });
  ```

  El tercer argumento `true` limita el ajuste a la transacción. Sin él, el
  valor queda pegado a la conexión del *pool* y **se filtra a la siguiente
  petición, que puede ser de otro cliente**.
- Las migraciones se aplican con un rol distinto y con privilegios distintos
  al de la aplicación.

### Condición 2 — El acceso a datos se encapsula

Nada de usar `prisma` suelto desde los controladores. Se accede a través de
un cliente con contexto de organización ya fijado (una extensión de Prisma
Client o una función que envuelva la transacción). Así el desarrollador no
puede saltarse el paso, ni por descuido ni por prisa.

### Condición 3 — Se prueba el aislamiento

Una prueba automatizada que, con dos organizaciones en la base, verifique que
la consulta de una no ve los datos de la otra —incluso si el `where` se
omite—. Es la prueba que demuestra que RLS está viva.

## Alternativas consideradas

| Opción | A favor | En contra |
|---|---|---|
| **Prisma** (elegida) | Esquema declarativo, migraciones sólidas, tipos generados (útiles en un proyecto sin TypeScript), buena experiencia de desarrollo | RLS no soportada de forma nativa; el JSONB de los esquemas de herramientas queda poco tipado; añade un paso de generación al arranque |
| SQL + migraciones versionadas | Control total, RLS natural | Más código repetitivo y más superficie para olvidar el filtro |
| Drizzle | Ligero, cercano al SQL | Menos maduro y con menos rodaje en el equipo |

## Consecuencias

**Positivas**: el modelo de datos queda descrito en un único `schema.prisma`
legible, las migraciones dejan de ser artesanales, y los tipos generados
compensan en parte la ausencia de TypeScript (P13).

**Negativas**: la seguridad multi-tenant deja de estar solo en la base de
datos y pasa a depender también de **cómo se use** el cliente de Prisma. Es
una responsabilidad nueva del equipo, y hay que documentarla y probarla, no
confiar en la disciplina.

**Operativas**: `prisma generate` entra en el arranque y en CI; las
migraciones necesitan su propio rol y su paso de despliegue; conviene fijar
el tamaño del *pool* teniendo en cuenta que cada petición abre transacción.

## Riesgos

- **`set_config` sin `true`** o fuera de transacción: fuga entre tenants.
  Mitigación: encapsular en un único punto y probarlo.
- **Rol con `BYPASSRLS`** en producción: las políticas no se aplican y nadie
  se entera. Mitigación: comprobación al arrancar que verifique que el rol no
  puede saltarse RLS.
- **Prisma y RLS conviviendo mal en migraciones**: las políticas se escriben
  a mano en SQL dentro de las migraciones de Prisma, y hay que revisarlas en
  cada cambio de esquema.
