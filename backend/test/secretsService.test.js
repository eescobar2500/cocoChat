import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";

import "./helpers/env.js";

process.env.SECRETS_MASTER_KEY ??= randomBytes(32).toString("base64");

const {
  createWrappedDataKey,
  decryptSecret,
  encryptSecret,
  rewrapDataKey,
} = await import("../src/services/secretsService.js");

const fakeOrganization = () => {
  const id = randomUUID();

  return { id, ...createWrappedDataKey(id) };
};

test("cifra y descifra un secreto con la clave de la organización", () => {
  const org = fakeOrganization();
  const { ciphertext, keyVersion } = encryptSecret(org, "sk-super-secreta");

  assert.notEqual(ciphertext, "sk-super-secreta");
  assert.equal(keyVersion, org.dataKeyVersion);
  assert.equal(decryptSecret(org, ciphertext), "sk-super-secreta");
});

test("un secreto de una organización no se abre con la clave de otra", () => {
  const a = fakeOrganization();
  const b = fakeOrganization();
  const { ciphertext } = encryptSecret(a, "sk-de-a");

  assert.throws(() => decryptSecret(b, ciphertext));
});

test("un sobre copiado a otra organización no se abre", () => {
  const a = fakeOrganization();
  const impostor = { ...a, id: randomUUID() };

  assert.throws(() => encryptSecret(impostor, "lo que sea"));
});

test("re-envolver la clave de datos no invalida los secretos", () => {
  const org = fakeOrganization();
  const { ciphertext } = encryptSecret(org, "sk-estable");

  const rewrapped = { ...org, ...rewrapDataKey(org) };

  assert.notEqual(rewrapped.dataKeyCiphertext, org.dataKeyCiphertext);
  assert.equal(decryptSecret(rewrapped, ciphertext), "sk-estable");
});
