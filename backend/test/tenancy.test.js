import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test, { after, before } from "node:test";

import "./helpers/env.js";

// Prueba de aislamiento entre organizaciones (ADR-0007, condición 3).
//
// Necesita una base real con las migraciones aplicadas y el rol de la
// aplicación: ver `pnpm test:db`. Sin TEST_DATABASE_URL se omite entera.

const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  test("aislamiento entre organizaciones", { skip: "sin TEST_DATABASE_URL" }, () => {});
} else {
  process.env.DATABASE_URL = databaseUrl;
  process.env.SECRETS_MASTER_KEY ??= randomBytes(32).toString("base64");

  const { default: app } = await import("../src/app.js");
  const { assertRlsEnforced, disconnectDatabase, withOrganization } =
    await import("../src/db/prisma.js");
  const { resolveOpenAIKey, setOpenAIKey } =
    await import("../src/services/providerCredentialService.js");

  let server;
  let baseUrl;

  const suffix = randomBytes(4).toString("hex");
  const orgs = {};

  const api = async (method, path, { body, token, headers = {} } = {}) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token && { authorization: `Bearer ${token}` }),
        ...headers,
      },
      body: body && JSON.stringify(body),
    });

    const text = await res.text();

    return { status: res.status, body: text ? JSON.parse(text) : null };
  };

  const admin = { "x-admin-token": process.env.ADMIN_TOKEN };

  before(async () => {
    await assertRlsEnforced();

    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    for (const name of ["a", "b"]) {
      const slug = `org-${name}-${suffix}`;
      const email = `owner-${name}-${suffix}@ejemplo.com`;
      const password = `contrasena-${name}-larga`;

      const created = await api("POST", "/api/organizations", {
        headers: admin,
        body: { name: `Org ${name}`, slug, owner: { email, password } },
      });

      assert.equal(created.status, 201, JSON.stringify(created.body));

      const login = await api("POST", "/api/auth/login", {
        body: { email, password, organization: slug },
      });

      assert.equal(login.status, 200, JSON.stringify(login.body));

      orgs[name] = { id: created.body.organization.id, slug, token: login.body.token };
    }
  });

  after(async () => {
    server?.close();
    await disconnectDatabase();
  });

  test("el rol de la aplicación no puede saltarse RLS", async () => {
    await assertRlsEnforced();
  });

  test("crear organizaciones exige el token de administración", async () => {
    const res = await api("POST", "/api/organizations", {
      body: { name: "x", slug: `x-${suffix}`, owner: { email: "x@x.com", password: "0123456789" } },
    });

    assert.equal(res.status, 401);
  });

  test("cada organización ve solo sus API keys, aunque se omita el where", async () => {
    const keyA = await api("POST", "/api/organization/api-keys", {
      token: orgs.a.token,
      body: { name: "backend de A" },
    });

    assert.equal(keyA.status, 201);
    assert.match(keyA.body.apiKey.key, /^cck_/);

    const listedByB = await api("GET", "/api/organization/api-keys", { token: orgs.b.token });

    assert.equal(listedByB.status, 200);
    assert.deepEqual(listedByB.body.apiKeys, []);

    // Directo contra la base y sin filtro: es RLS quien filtra.
    const rowsForB = await withOrganization(orgs.b.id, (tx) => tx.apiKey.findMany());
    const rowsForA = await withOrganization(orgs.a.id, (tx) => tx.apiKey.findMany());

    assert.equal(rowsForB.length, 0);
    assert.equal(rowsForA.length, 1);
    assert.equal(rowsForA[0].organizationId, orgs.a.id);

    orgs.a.apiKey = keyA.body.apiKey.key;
  });

  test("no se puede insertar en nombre de otra organización", async () => {
    await assert.rejects(
      withOrganization(orgs.a.id, (tx) =>
        tx.apiKey.create({
          data: { organizationId: orgs.b.id, name: "colada", prefix: `p${suffix}`, keyHash: "x" },
        })
      ),
      /row-level security/
    );
  });

  test("la API key autentica a su organización y solo a ella", async () => {
    // Sin clave de OpenAI todavía: el chat responde con un error accionable
    // en vez de llamar al proveedor.
    const res = await api("POST", "/api/chat", {
      headers: { "x-api-key": orgs.a.apiKey },
      body: { message: "hola" },
    });

    assert.equal(res.status, 422);
    assert.match(res.body.message, /clave de OpenAI/);

    const invalida = await api("POST", "/api/chat", {
      headers: { "x-api-key": "cck_00000000_0000000000000000000000000000000000000000" },
      body: { message: "hola" },
    });

    assert.equal(invalida.status, 401);
  });

  test("la clave de OpenAI se guarda cifrada y nunca vuelve por la API", async () => {
    const plaintext = `sk-${randomBytes(24).toString("hex")}`;

    const credential = await setOpenAIKey(orgs.a.id, {
      apiKey: plaintext,
      label: "prueba",
      verify: async () => {},
    });

    assert.equal(credential.provider, "openai");
    assert.equal(Object.hasOwn(credential, "ciphertext"), false);

    const listed = await api("GET", "/api/organization/provider-credentials", {
      token: orgs.a.token,
    });

    assert.equal(listed.status, 200);
    assert.equal(listed.body.credentials.length, 1);
    assert.equal(JSON.stringify(listed.body).includes(plaintext), false);

    const stored = await withOrganization(orgs.a.id, (tx) => tx.providerCredential.findMany());

    assert.notEqual(stored[0].ciphertext, plaintext);

    const resolved = await resolveOpenAIKey(orgs.a.id);

    assert.equal(resolved.apiKey, plaintext);

    await assert.rejects(resolveOpenAIKey(orgs.b.id), /no tiene una clave/);
  });

  test("un token de una organización no abre la otra", async () => {
    const me = await api("GET", "/api/organization", { token: orgs.b.token });

    assert.equal(me.status, 200);
    assert.equal(me.body.organization.slug, orgs.b.slug);

    const members = await api("GET", "/api/organization/members", { token: orgs.b.token });

    assert.equal(members.status, 200);
    assert.equal(members.body.members.length, 1);
    assert.match(members.body.members[0].email, /owner-b/);
  });

  test("un member no gestiona claves", async () => {
    const email = `member-${suffix}@ejemplo.com`;
    const password = "clave-de-member-larga";

    const added = await api("POST", "/api/organization/members", {
      token: orgs.a.token,
      body: { email, password, role: "member" },
    });

    assert.equal(added.status, 201);

    const login = await api("POST", "/api/auth/login", {
      body: { email, password, organization: orgs.a.slug },
    });

    assert.equal(login.status, 200);

    const denied = await api("GET", "/api/organization/api-keys", { token: login.body.token });

    assert.equal(denied.status, 403);

    const wrongOrg = await api("POST", "/api/auth/login", {
      body: { email, password, organization: orgs.b.slug },
    });

    assert.equal(wrongOrg.status, 401);
  });
}
