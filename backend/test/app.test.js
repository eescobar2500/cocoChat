import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import "./helpers/env.js";

// El límite por defecto (20) haría el test lento. Se ajusta antes de
// cargar la app, que lee la configuración una sola vez al importarse; de
// ahí que la importación sea dinámica y no estática (los `import` se
// evalúan antes que cualquier asignación de este archivo).
process.env.CHAT_RATE_LIMIT_MAX = "3";
process.env.CHAT_RATE_LIMIT_WINDOW_MS = "60000";

let server;
let baseUrl;

before(async () => {
  const { default: app } = await import("../src/app.js");

  server = app.listen(0);

  await new Promise((resolve) => server.once("listening", resolve));

  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const postChat = (body, headers = {}) =>
  fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

test("CORS: autoriza un origen de la lista y no el resto", async () => {
  const permitido = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: "https://app.ejemplo.com" },
  });

  assert.equal(
    permitido.headers.get("access-control-allow-origin"),
    "https://app.ejemplo.com"
  );

  const ajeno = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: "https://sitio-ajeno.com" },
  });

  // Sin la cabecera, el navegador descarta la respuesta: el sitio ajeno no
  // puede gastar nuestra cuota desde el navegador de sus visitantes.
  assert.equal(ajeno.headers.get("access-control-allow-origin"), null);
});

test("las rutas de mantenimiento exigen el token", async () => {
  const sinToken = await fetch(`${baseUrl}/api/sessions`);

  assert.equal(sinToken.status, 401);
});

test("/api/chat limita las peticiones por IP", async () => {
  // Cuerpo inválido a propósito: el límite se aplica antes del handler,
  // así que el test no llama a OpenAI.
  for (let i = 0; i < 3; i++) {
    const res = await postChat({ message: "" });

    assert.equal(res.status, 400, `la petición ${i + 1} debería dar 400`);
  }

  const bloqueada = await postChat({ message: "" });

  assert.equal(bloqueada.status, 429);
  assert.ok(bloqueada.headers.get("retry-after"));
});
