import OpenAI, { APIError } from "openai";

import { withOrganization } from "../db/prisma.js";

import { decryptSecret, encryptSecret } from "./secretsService.js";

import ApiError from "../utils/ApiError.js";

// BYOK: la clave de OpenAI de cada organización (ADR-0006).
//
// Invariantes, pase lo que pase: la clave nunca se devuelve por la API,
// nunca se escribe en logs y se descifra solo en el momento de usarla.

const OPENAI_KEY_PATTERN = /^sk-[A-Za-z0-9_-]{20,}$/;

export const publicCredential = (credential) => ({
  id: credential.id,
  provider: credential.provider,
  label: credential.label ?? null,
  lastUsedAt: credential.lastUsedAt,
  lastErrorAt: credential.lastErrorAt,
  revokedAt: credential.revokedAt,
  createdAt: credential.createdAt,
});

// Una llamada barata que falla con 401 si la clave no sirve. Mejor saberlo
// al guardarla que a mitad de una conversación.
async function verifyOpenAIKey(apiKey) {
  try {
    await new OpenAI({ apiKey, maxRetries: 0 }).models.list();
  } catch (error) {
    if (error instanceof APIError && error.status === 401) {
      throw ApiError.unprocessable("OpenAI rechazó la clave: revisá que sea válida");
    }

    throw ApiError.badGateway("No se pudo verificar la clave con OpenAI");
  }
}

// Guarda la clave y revoca la anterior en la misma transacción. Durante
// la rotación no hay ventana sin credencial activa.
export async function setOpenAIKey(organizationId, { apiKey, label, verify = verifyOpenAIKey }) {
  if (typeof apiKey !== "string" || !OPENAI_KEY_PATTERN.test(apiKey.trim())) {
    throw ApiError.badRequest("La clave de OpenAI no tiene un formato válido");
  }

  const key = apiKey.trim();

  await verify(key);

  const credential = await withOrganization(organizationId, async (tx) => {
    const organization = await tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });

    await tx.providerCredential.updateMany({
      where: { organizationId, provider: "openai", revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return tx.providerCredential.create({
      data: {
        organizationId,
        provider: "openai",
        label: label ?? null,
        ...encryptSecret(organization, key),
      },
    });
  });

  return publicCredential(credential);
}

export function listCredentials(organizationId) {
  return withOrganization(organizationId, async (tx) => {
    const credentials = await tx.providerCredential.findMany({
      where: { revokedAt: null },
      orderBy: { createdAt: "desc" },
    });

    return credentials.map(publicCredential);
  });
}

export async function revokeCredential(organizationId, id) {
  const result = await withOrganization(organizationId, (tx) =>
    tx.providerCredential.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  );

  if (result.count === 0) {
    throw ApiError.notFound("La credencial no existe o ya estaba revocada");
  }
}

// Devuelve la clave en claro para usarla ahora mismo, más el id para
// anotar uso o error. Es la única función que expone el secreto, y solo a
// código del servidor.
export async function resolveOpenAIKey(organizationId) {
  const result = await withOrganization(organizationId, async (tx) => {
    const credential = await tx.providerCredential.findFirst({
      where: { organizationId, provider: "openai", revokedAt: null },
      include: { organization: true },
      orderBy: { createdAt: "desc" },
    });

    if (!credential) {
      return null;
    }

    return {
      id: credential.id,
      apiKey: decryptSecret(credential.organization, credential.ciphertext),
    };
  });

  if (!result) {
    // Regla 6 del modelo de datos: error accionable, no fallo del proveedor.
    throw ApiError.unprocessable(
      "La organización no tiene una clave de OpenAI configurada"
    );
  }

  return result;
}

export function markCredential(organizationId, id, field) {
  return withOrganization(organizationId, (tx) =>
    tx.providerCredential.update({ where: { id }, data: { [field]: new Date() } })
  ).catch(() => {});
}
