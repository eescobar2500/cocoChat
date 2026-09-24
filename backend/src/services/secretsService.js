import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import env from "../config/env.js";

// Cifrado por sobre (P12).
//
//   clave maestra (entorno hoy; KMS mañana)
//     └─ envuelve → clave de datos de la organización (organizations.data_key_*)
//                     └─ cifra → cada secreto (provider_credentials.ciphertext)
//
// Rotar la clave maestra es re-envolver claves de datos; rotar la clave de
// una organización es re-cifrar solo sus secretos. En la base solo queda
// ciphertext y versión, nunca material en claro. Pasar a KMS cambia
// `wrapDataKey`/`unwrapDataKey`, no el esquema.

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

// Formato: base64( iv | tag | ciphertext ). Lo mismo para sobres y datos.
function seal(key, plaintext, aad) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  if (aad) {
    cipher.setAAD(Buffer.from(aad, "utf8"));
  }

  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

function open(key, sealed, aad) {
  const buffer = Buffer.from(sealed, "base64");
  const iv = buffer.subarray(0, IV_BYTES);
  const tag = buffer.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const encrypted = buffer.subarray(IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key, iv);

  decipher.setAuthTag(tag);

  if (aad) {
    decipher.setAAD(Buffer.from(aad, "utf8"));
  }

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

function masterKeyFor(version) {
  if (version === env.secrets.masterKeyVersion) {
    return env.secrets.masterKey;
  }

  const previous = env.secrets.previousMasterKeys.get(version);

  if (!previous) {
    throw new Error(
      `No hay clave maestra para la versión ${version}: definí ` +
        "SECRETS_PREVIOUS_MASTER_KEYS para poder descifrar secretos antiguos"
    );
  }

  return previous;
}

// Genera la clave de datos de una organización nueva y la devuelve ya
// envuelta, lista para guardar. El `organizationId` va como dato asociado:
// un sobre copiado a otra fila no se abre.
export function createWrappedDataKey(organizationId) {
  const dataKey = randomBytes(32);

  return {
    dataKeyCiphertext: seal(env.secrets.masterKey, dataKey, organizationId),
    dataKeyVersion: env.secrets.masterKeyVersion,
  };
}

function unwrapDataKey(organization) {
  return open(
    masterKeyFor(organization.dataKeyVersion),
    organization.dataKeyCiphertext,
    organization.id
  );
}

// `organization` debe traer id, dataKeyCiphertext y dataKeyVersion.
export function encryptSecret(organization, plaintext) {
  const dataKey = unwrapDataKey(organization);

  return {
    ciphertext: seal(dataKey, Buffer.from(plaintext, "utf8"), organization.id),
    keyVersion: organization.dataKeyVersion,
  };
}

export function decryptSecret(organization, ciphertext) {
  const dataKey = unwrapDataKey(organization);

  return open(dataKey, ciphertext, organization.id).toString("utf8");
}

// Re-envuelve la clave de datos con la clave maestra vigente. No toca los
// secretos: la clave de datos es la misma.
export function rewrapDataKey(organization) {
  const dataKey = unwrapDataKey(organization);

  return {
    dataKeyCiphertext: seal(env.secrets.masterKey, dataKey, organization.id),
    dataKeyVersion: env.secrets.masterKeyVersion,
  };
}
