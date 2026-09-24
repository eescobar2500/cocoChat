import { createHash, randomBytes } from "node:crypto";

import { withOrganization, withPlatform } from "../db/prisma.js";

import { safeCompare } from "../middleware/requireAdminToken.js";

import ApiError from "../utils/ApiError.js";

// API keys de servicio: con ellas el backend del cliente se autentica
// ante CocoChat. Forma: `cck_<prefijo de 8>_<secreto de 40>`. El prefijo
// es visible y sirve para encontrar la fila; del secreto solo se guarda
// el hash. El valor completo se muestra una única vez, al crearla.

const KEY_PATTERN = /^cck_([A-Za-z0-9]{8})_([A-Za-z0-9]{40})$/;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randomToken(length) {
  const bytes = randomBytes(length);
  let out = "";

  for (const byte of bytes) {
    out += ALPHABET[byte % ALPHABET.length];
  }

  return out;
}

const hashSecret = (secret) => createHash("sha256").update(secret).digest("hex");

export const publicApiKey = (key) => ({
  id: key.id,
  name: key.name,
  prefix: key.prefix,
  scopes: key.scopes,
  lastUsedAt: key.lastUsedAt,
  expiresAt: key.expiresAt,
  revokedAt: key.revokedAt,
  createdAt: key.createdAt,
});

export async function createApiKey(organizationId, { name, scopes = ["chat"] }) {
  const prefix = randomToken(8);
  const secret = randomToken(40);

  const key = await withOrganization(organizationId, (tx) =>
    tx.apiKey.create({
      data: { organizationId, name, prefix, scopes, keyHash: hashSecret(secret) },
    })
  );

  return {
    ...publicApiKey(key),
    // Única vez que el valor viaja en claro.
    key: `cck_${prefix}_${secret}`,
  };
}

export function listApiKeys(organizationId) {
  return withOrganization(organizationId, async (tx) => {
    const keys = await tx.apiKey.findMany({ orderBy: { createdAt: "asc" } });

    return keys.map(publicApiKey);
  });
}

export async function revokeApiKey(organizationId, id) {
  const result = await withOrganization(organizationId, (tx) =>
    tx.apiKey.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  );

  if (result.count === 0) {
    throw ApiError.notFound("La API key no existe o ya estaba revocada");
  }
}

// Devuelve la organización dueña de la key o lanza 401. Es una operación
// de plataforma: todavía no sabemos de qué tenant es la petición.
export async function authenticateApiKey(rawKey) {
  const match = typeof rawKey === "string" ? rawKey.match(KEY_PATTERN) : null;

  if (!match) {
    throw ApiError.unauthorized("API key inválida");
  }

  const [, prefix, secret] = match;

  const key = await withPlatform((tx) =>
    tx.apiKey.findUnique({ where: { prefix }, include: { organization: true } })
  );

  const valid =
    key &&
    !key.revokedAt &&
    (!key.expiresAt || key.expiresAt > new Date()) &&
    key.organization.status === "active" &&
    safeCompare(hashSecret(secret), key.keyHash);

  if (!valid) {
    throw ApiError.unauthorized("API key inválida");
  }

  // Marca de último uso, sin bloquear la petición.
  withOrganization(key.organizationId, (tx) =>
    tx.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
  ).catch(() => {});

  return { apiKey: publicApiKey(key), organization: key.organization };
}
