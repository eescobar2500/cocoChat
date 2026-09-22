import assert from "node:assert/strict";
import test from "node:test";

import { createRateLimit } from "../src/middleware/rateLimit.js";

const fakeRes = () => ({
  headers: {},
  set(name, value) {
    this.headers[name] = value;
  },
});

const run = (middleware, ip = "1.2.3.4") =>
  new Promise((resolve) => {
    middleware({ ip }, fakeRes(), (error) => resolve(error));
  });

test("deja pasar hasta el máximo de la ventana", async () => {
  const limit = createRateLimit({ windowMs: 60_000, max: 3 });

  for (let i = 0; i < 3; i++) {
    assert.equal(await run(limit), undefined, `la petición ${i + 1} debería pasar`);
  }
});

test("rechaza con 429 al superar el máximo", async () => {
  const limit = createRateLimit({ windowMs: 60_000, max: 2 });

  await run(limit);
  await run(limit);

  const error = await run(limit);

  assert.equal(error?.statusCode, 429);
});

test("cuenta por IP: un abusador no bloquea al resto", async () => {
  const limit = createRateLimit({ windowMs: 60_000, max: 1 });

  await run(limit, "10.0.0.1");

  assert.equal((await run(limit, "10.0.0.1"))?.statusCode, 429);
  assert.equal(await run(limit, "10.0.0.2"), undefined);
});

test("el cupo se renueva al expirar la ventana", async () => {
  const limit = createRateLimit({ windowMs: 10, max: 1 });

  await run(limit);
  assert.equal((await run(limit))?.statusCode, 429);

  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(await run(limit), undefined);
});
