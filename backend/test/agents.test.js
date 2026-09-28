import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test, { after, before } from "node:test";

import "./helpers/env.js";

// Etapa 2: agentes propios, versiones, publicación/rollback y
// conversaciones persistidas, con aislamiento entre organizaciones.
//
// El proveedor se sustituye por un runtime doble registrado en el puerto
// `AgentRuntime`: así se prueba el orquestador entero sin llamar a OpenAI.

const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  test("agentes y conversaciones", { skip: "sin TEST_DATABASE_URL" }, () => {});
} else {
  process.env.DATABASE_URL = databaseUrl;
  process.env.SECRETS_MASTER_KEY ??= randomBytes(32).toString("base64");

  const { default: app } = await import("../src/app.js");
  const { disconnectDatabase, withOrganization } = await import("../src/db/prisma.js");
  const { registerRuntime } = await import("../src/runtime/agentRuntime.js");
  const { setOpenAIKey } = await import("../src/services/providerCredentialService.js");

  // Runtime doble: devuelve las instrucciones que recibió y cuántos turnos
  // le llegaron, que es justo lo que hay que comprobar del orquestador.
  const calls = [];

  registerRuntime({
    id: "fake_echo",
    provider: "openai",
    async run({ configuration, apiKey, messages }) {
      calls.push({ configuration, apiKey, messages });

      return {
        reply: `[${configuration.instructions}] ${messages.at(-1).content}`,
        usage: { input_tokens: messages.length, output_tokens: 1, total_tokens: messages.length + 1 },
        providerRef: `resp_${calls.length}`,
      };
    },
  });

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
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    for (const name of ["a", "b"]) {
      const slug = `agents-${name}-${suffix}`;
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

      const apiKey = await api("POST", "/api/organization/api-keys", {
        token: login.body.token,
        body: { name: "backend" },
      });

      await setOpenAIKey(created.body.organization.id, {
        apiKey: `sk-${name}-${randomBytes(20).toString("hex")}`,
        verify: async () => {},
      });

      orgs[name] = {
        id: created.body.organization.id,
        token: login.body.token,
        apiKey: apiKey.body.apiKey.key,
      };
    }
  });

  after(async () => {
    server?.close();
    await disconnectDatabase();
  });

  let agent;
  let v1;
  let v2;

  test("crear un agente deja la versión 1 como borrador", async () => {
    const res = await api("POST", "/api/organization/agents", {
      token: orgs.a.token,
      body: {
        name: "Recepción",
        instructions: "v1",
        runtime: "fake_echo",
        params: { temperature: 0.2 },
      },
    });

    assert.equal(res.status, 201, JSON.stringify(res.body));
    agent = res.body.agent;
    assert.equal(agent.status, "draft");
    assert.equal(agent.activeConfigurationId, null);

    const versions = await api("GET", `/api/organization/agents/${agent.id}/configurations`, {
      token: orgs.a.token,
    });

    assert.equal(versions.body.configurations.length, 1);
    [v1] = versions.body.configurations;
    assert.equal(v1.version, 1);
    assert.equal(v1.params.temperature, 0.2);
  });

  test("los parámetros fuera de rango se rechazan", async () => {
    const res = await api("POST", "/api/organization/agents", {
      token: orgs.a.token,
      body: { name: "x", instructions: "y", params: { temperature: 5 } },
    });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /temperature/);
  });

  test("sin agente publicado, el chat con API key devuelve un error accionable", async () => {
    const res = await api("POST", "/api/chat", {
      headers: { "x-api-key": orgs.a.apiKey },
      body: { message: "hola" },
    });

    assert.equal(res.status, 422);
    assert.match(res.body.message, /agente publicado/);
  });

  test("editar crea la versión 2 heredando lo que no cambia", async () => {
    const res = await api("POST", `/api/organization/agents/${agent.id}/configurations`, {
      token: orgs.a.token,
      body: { instructions: "v2" },
    });

    assert.equal(res.status, 201, JSON.stringify(res.body));
    v2 = res.body.configuration;
    assert.equal(v2.version, 2);
    assert.equal(v2.runtime, "fake_echo");
    assert.equal(v2.params.temperature, 0.2);
    assert.equal(v2.model, v1.model);
  });

  test("publicar la versión 2 la hace la activa", async () => {
    const res = await api(
      "POST",
      `/api/organization/agents/${agent.id}/configurations/${v2.id}/publish`,
      { token: orgs.a.token }
    );

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.agent.status, "published");
    assert.equal(res.body.agent.activeConfigurationId, v2.id);
    assert.equal(res.body.agent.activeConfiguration.version, 2);
  });

  let conversationId;

  test("el chat con API key resuelve el agente publicado y persiste la conversación", async () => {
    const first = await api("POST", "/api/chat", {
      headers: { "x-api-key": orgs.a.apiKey },
      body: { message: "hola", endUserRef: "cliente-1" },
    });

    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.mode, "agent");
    assert.equal(first.body.reply, "[v2] hola");
    assert.equal(first.body.agentId, agent.id);
    assert.equal(first.body.configurationVersion, 2);
    assert.ok(first.body.conversationId);
    conversationId = first.body.conversationId;

    const second = await api("POST", "/api/chat", {
      headers: { "x-api-key": orgs.a.apiKey },
      body: { message: "sigo", conversationId },
    });

    assert.equal(second.status, 200, JSON.stringify(second.body));
    assert.equal(second.body.conversationId, conversationId);

    // El historial lo lleva CocoChat: el runtime recibe los turnos previos.
    const last = calls.at(-1);
    assert.deepEqual(
      last.messages.map((m) => m.content),
      ["hola", "[v2] hola", "sigo"]
    );
    assert.match(last.apiKey, /^sk-a-/);

    const stored = await api("GET", `/api/organization/conversations/${conversationId}`, {
      token: orgs.a.token,
    });

    assert.equal(stored.status, 200);
    assert.equal(stored.body.conversation.messages.length, 4);
    assert.equal(stored.body.conversation.endUserRef, "cliente-1");
    assert.equal(stored.body.conversation.messages[1].configurationId, v2.id);
    assert.equal(stored.body.conversation.messages[1].tokenUsage.total_tokens, 2);
  });

  test("volver a la versión 1 cambia lo que responde el agente", async () => {
    const res = await api(
      "POST",
      `/api/organization/agents/${agent.id}/configurations/${v1.id}/publish`,
      { token: orgs.a.token }
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.agent.activeConfigurationId, v1.id);

    const chat = await api("POST", "/api/chat", {
      headers: { "x-api-key": orgs.a.apiKey },
      body: { message: "otra", conversationId },
    });

    assert.equal(chat.body.reply, "[v1] otra");
    assert.equal(chat.body.configurationVersion, 1);
  });

  test("desde el panel se prueba un borrador sin publicarlo", async () => {
    const draft = await api("POST", `/api/organization/agents/${agent.id}/configurations`, {
      token: orgs.a.token,
      body: { instructions: "v3-borrador" },
    });

    const res = await api("POST", `/api/organization/agents/${agent.id}/chat`, {
      token: orgs.a.token,
      body: { message: "prueba", configurationId: draft.body.configuration.id },
    });

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.reply, "[v3-borrador] prueba");

    const current = await api("GET", `/api/organization/agents/${agent.id}`, {
      token: orgs.a.token,
    });

    assert.equal(current.body.agent.activeConfigurationId, v1.id);
  });

  test("la otra organización no ve ni usa el agente ni sus conversaciones", async () => {
    const list = await api("GET", "/api/organization/agents", { token: orgs.b.token });

    assert.equal(list.status, 200);
    assert.equal(list.body.agents.length, 0);

    const byId = await api("GET", `/api/organization/agents/${agent.id}`, {
      token: orgs.b.token,
    });

    assert.equal(byId.status, 404);

    const conversation = await api(
      "GET",
      `/api/organization/conversations/${conversationId}`,
      { token: orgs.b.token }
    );

    assert.equal(conversation.status, 404);

    const chat = await api("POST", "/api/chat", {
      headers: { "x-api-key": orgs.b.apiKey },
      body: { message: "hola", agentId: agent.id },
    });

    assert.equal(chat.status, 404);

    // Sin `where`, RLS filtra igual.
    const rows = await withOrganization(orgs.b.id, (tx) => tx.message.findMany());

    assert.equal(rows.length, 0);

    const own = await withOrganization(orgs.a.id, (tx) => tx.message.count());

    assert.ok(own >= 6);
  });

  test("un member puede probar el agente pero no editarlo", async () => {
    const email = `member-${suffix}@ejemplo.com`;
    const password = "clave-de-member-larga";

    await api("POST", "/api/organization/members", {
      token: orgs.a.token,
      body: { email, password, role: "member" },
    });

    const login = await api("POST", "/api/auth/login", {
      body: { email, password, organization: `agents-a-${suffix}` },
    });

    const denied = await api("POST", `/api/organization/agents/${agent.id}/configurations`, {
      token: login.body.token,
      body: { instructions: "no" },
    });

    assert.equal(denied.status, 403);

    const allowed = await api("POST", `/api/organization/agents/${agent.id}/chat`, {
      token: login.body.token,
      body: { message: "hola" },
    });

    assert.equal(allowed.status, 200, JSON.stringify(allowed.body));
  });

  test("archivar saca al agente del chat sin borrar sus conversaciones", async () => {
    const archived = await api("DELETE", `/api/organization/agents/${agent.id}`, {
      token: orgs.a.token,
    });

    assert.equal(archived.status, 200);
    assert.equal(archived.body.agent.status, "archived");

    const chat = await api("POST", "/api/chat", {
      headers: { "x-api-key": orgs.a.apiKey },
      body: { message: "hola" },
    });

    assert.equal(chat.status, 422);

    const explicit = await api("POST", "/api/chat", {
      headers: { "x-api-key": orgs.a.apiKey },
      body: { message: "hola", agentId: agent.id },
    });

    assert.equal(explicit.status, 422);
    assert.match(explicit.body.message, /archivado/);

    const conversations = await api("GET", "/api/organization/conversations", {
      token: orgs.a.token,
    });

    assert.equal(conversations.status, 200);
    assert.ok(conversations.body.conversations.length >= 2);
  });
}
