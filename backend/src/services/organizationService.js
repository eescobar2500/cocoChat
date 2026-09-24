import { randomUUID } from "node:crypto";

import { withOrganization, withPlatform } from "../db/prisma.js";

import { createWrappedDataKey } from "./secretsService.js";

import ApiError from "../utils/ApiError.js";

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$/;

export function validateSlug(slug) {
  return typeof slug === "string" && SLUG_PATTERN.test(slug);
}

// Lo que se expone de una organización. La clave de datos envuelta no sale
// nunca de la capa de servicios.
export const publicOrganization = (org) => ({
  id: org.id,
  name: org.name,
  slug: org.slug,
  plan: org.plan,
  status: org.status,
  createdAt: org.createdAt,
});

// Crear una organización es la única operación que necesita el id antes
// de la fila: la clave de datos se envuelve con el id como dato asociado.
export async function createOrganization({ name, slug }) {
  const id = randomUUID();

  const existing = await withPlatform((tx) =>
    tx.organization.findUnique({ where: { slug }, select: { id: true } })
  );

  if (existing) {
    throw ApiError.conflict(`Ya existe una organización con el slug "${slug}"`);
  }

  const organization = await withPlatform((tx) =>
    tx.organization.create({
      data: { id, name, slug, ...createWrappedDataKey(id) },
    })
  );

  return publicOrganization(organization);
}

export async function listOrganizations() {
  const organizations = await withPlatform((tx) =>
    tx.organization.findMany({ orderBy: { createdAt: "asc" } })
  );

  return organizations.map(publicOrganization);
}

export async function getOrganization(organizationId) {
  const organization = await withOrganization(organizationId, (tx) =>
    tx.organization.findUnique({ where: { id: organizationId } })
  );

  if (!organization) {
    throw ApiError.notFound("La organización no existe");
  }

  return publicOrganization(organization);
}
