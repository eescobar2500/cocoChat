import { PrismaClient } from "@prisma/client";

import env from "../config/env.js";

// Único punto de acceso a la base de datos (ADR-0007, condición 2).
//
// Nadie usa `prisma` suelto: toda consulta pasa por `withOrganization` o
// `withPlatform`, que abren una transacción y fijan el contexto que leen
// las políticas de RLS. Fuera de esas dos funciones el rol de la
// aplicación no ve ninguna fila.

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let client = null;

export function isDatabaseEnabled() {
  return Boolean(env.databaseUrl);
}

function getClient() {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL no está configurada");
  }

  client ??= new PrismaClient({ datasourceUrl: env.databaseUrl });

  return client;
}

// Ejecuta `fn(tx)` con las políticas filtrando por `organizationId`.
//
// El tercer argumento de set_config (`true`) limita el valor a la
// transacción: sin él quedaría pegado a la conexión del pool y se
// filtraría a la siguiente petición, que puede ser de otro cliente.
export function withOrganization(organizationId, fn) {
  if (typeof organizationId !== "string" || !UUID_PATTERN.test(organizationId)) {
    throw new Error("withOrganization requiere un organizationId válido");
  }

  return getClient().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.organization_id', ${organizationId}, true)`;

    return fn(tx);
  });
}

// Contexto de plataforma: ve todas las organizaciones. Solo para lo que no
// tiene tenant todavía —crear una organización, resolver a quién pertenece
// una API key, iniciar sesión—. Nunca desde un handler de tenant.
export function withPlatform(fn) {
  return getClient().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.context', 'platform', true)`;

    return fn(tx);
  });
}

// Comprobación al arrancar (ADR-0007): con un rol que puede saltarse RLS,
// las políticas existen pero no filtran nada, y nadie se entera. Preferimos
// no arrancar.
export async function assertRlsEnforced() {
  const prisma = getClient();

  const [role] = await prisma.$queryRaw`
    SELECT rolname, rolsuper, rolbypassrls
    FROM pg_roles
    WHERE rolname = current_user
  `;

  if (role.rolsuper || role.rolbypassrls) {
    throw new Error(
      `El rol de base de datos "${role.rolname}" puede saltarse RLS ` +
        "(SUPERUSER o BYPASSRLS). La API debe conectar con un rol que herede " +
        "de cocochat_app; ver prisma/roles.example.sql."
    );
  }

  const owned = await prisma.$queryRaw`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tableowner = current_user
      AND tablename <> '_prisma_migrations'
  `;

  if (owned.length > 0) {
    throw new Error(
      `El rol "${role.rolname}" es dueño de tablas (${owned
        .map((t) => t.tablename)
        .join(", ")}); RLS no se aplica al dueño. Usá un rol distinto al de ` +
        "migraciones."
    );
  }

  const unprotected = await prisma.$queryRaw`
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname <> '_prisma_migrations'
      AND NOT (c.relrowsecurity AND c.relforcerowsecurity)
  `;

  if (unprotected.length > 0) {
    throw new Error(
      `Tablas sin RLS forzada: ${unprotected.map((t) => t.relname).join(", ")}`
    );
  }
}

export async function disconnectDatabase() {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}
