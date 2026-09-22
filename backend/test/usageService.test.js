import assert from "node:assert/strict";
import test from "node:test";

import "./helpers/env.js";

import { buildUsageRecord } from "../src/services/usageService.js";

test("normaliza el consumo de la Responses API", () => {
  const record = buildUsageRecord({
    usage: { input_tokens: 120, output_tokens: 45, total_tokens: 165 },
    mode: "responses",
    sessionId: null,
    durationMs: 900,
  });

  assert.equal(record.inputTokens, 120);
  assert.equal(record.outputTokens, 45);
  assert.equal(record.totalTokens, 165);
  assert.equal(record.mode, "responses");
});

test("acepta también los nombres de la Agents API", () => {
  const record = buildUsageRecord({
    usage: { prompt_tokens: 10, completion_tokens: 5 },
    mode: "agents",
    sessionId: "sess_1",
    durationMs: 10,
  });

  assert.equal(record.inputTokens, 10);
  assert.equal(record.outputTokens, 5);
  assert.equal(record.totalTokens, null);
  assert.equal(record.sessionId, "sess_1");
});

test("un turno sin consumo no rompe el registro", () => {
  const record = buildUsageRecord({
    usage: null,
    mode: "agents",
    durationMs: 1,
  });

  assert.equal(record.inputTokens, null);
  assert.equal(record.sessionId, null);
  assert.equal(record.type, "usage");
});
