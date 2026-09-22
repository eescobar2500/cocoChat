import assert from "node:assert/strict";
import test from "node:test";

import "./helpers/env.js";

import requireAdminToken, {
  safeCompare,
} from "../src/middleware/requireAdminToken.js";

const run = (token) =>
  new Promise((resolve) => {
    const req = { get: () => token };

    requireAdminToken(req, {}, (error) => resolve(error));
  });

test("safeCompare distingue iguales de distintos", () => {
  assert.equal(safeCompare("abc", "abc"), true);
  assert.equal(safeCompare("abc", "abd"), false);

  // Longitudes distintas: no debe lanzar, aunque timingSafeEqual sí lo haga.
  assert.equal(safeCompare("abc", "abcdef"), false);
  assert.equal(safeCompare(undefined, "abc"), false);
});

test("acepta el token correcto y rechaza el incorrecto", async () => {
  assert.equal(await run("token-de-prueba"), undefined);
  assert.equal((await run("otro-token"))?.statusCode, 401);
  assert.equal((await run(undefined))?.statusCode, 401);
});
