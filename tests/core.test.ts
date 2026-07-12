import assert from "node:assert/strict";
import test from "node:test";
import {
  applyFastServiceTier,
  describeFastMode,
  fastModeFooter,
  isFastCapableModel,
  parseSettings,
} from "../src/core.ts";

test("recognizes only direct OpenAI Responses and Codex Responses models", () => {
  assert.equal(
    isFastCapableModel({ provider: "openai", id: "gpt-5.5", api: "openai-responses" }),
    true,
  );
  assert.equal(
    isFastCapableModel({ provider: "openai-codex", id: "gpt-5.4", api: "openai-codex-responses" }),
    true,
  );
  assert.equal(
    isFastCapableModel({ provider: "anthropic", id: "claude", api: "anthropic-messages" }),
    false,
  );
  assert.equal(
    isFastCapableModel({ provider: "openrouter", id: "openai/gpt-5.5", api: "openai-completions" }),
    false,
  );
  assert.equal(
    isFastCapableModel({ provider: "openai", id: "legacy", api: "openai-completions" }),
    false,
  );
  assert.equal(
    isFastCapableModel({ provider: "openai", id: "mismatch", api: "openai-codex-responses" }),
    false,
  );
  assert.equal(
    isFastCapableModel({ provider: "openai-codex", id: "mismatch", api: "openai-responses" }),
    false,
  );
});

test("injects priority only for enabled, direct OpenAI Responses requests", () => {
  const payload = { model: "gpt-5.5", stream: true, service_tier: "default" };
  const replacement = applyFastServiceTier(
    { provider: "openai-codex", id: "gpt-5.5", api: "openai-codex-responses" },
    payload,
    true,
  );

  assert.deepEqual(replacement, {
    model: "gpt-5.5",
    stream: true,
    service_tier: "priority",
  });
  assert.equal(payload.service_tier, "default", "the original payload must not be mutated");

  assert.equal(
    applyFastServiceTier({ provider: "openai", api: "openai-responses" }, payload, false),
    undefined,
  );
  assert.equal(
    applyFastServiceTier({ provider: "openrouter", api: "openai-responses" }, payload, true),
    undefined,
  );
  assert.equal(
    applyFastServiceTier({ provider: "openai", api: "openai-completions" }, payload, true),
    undefined,
  );
  assert.equal(
    applyFastServiceTier({ provider: "openai", api: "openai-responses" }, null, true),
    undefined,
  );
});

test("settings fail closed unless enabled is explicitly boolean", () => {
  assert.deepEqual(parseSettings({ enabled: true }), { enabled: true });
  assert.deepEqual(parseSettings({ enabled: false }), { enabled: false });
  assert.deepEqual(parseSettings({ enabled: "yes" }), { enabled: false });
  assert.deepEqual(parseSettings(null), { enabled: false });
});

test("footer appears only while Fast mode applies to the selected model API", () => {
  assert.equal(
    fastModeFooter({ provider: "openai-codex", api: "openai-codex-responses" }, true),
    "[OpenAI: fast]",
  );
  assert.equal(fastModeFooter({ provider: "anthropic", api: "anthropic-messages" }, true), undefined);
  assert.equal(fastModeFooter({ provider: "openai", api: "openai-responses" }, false), undefined);
  assert.equal(fastModeFooter({ provider: "openai", api: "openai-completions" }, true), undefined);
});

test("status describes the requested wire tier", () => {
  const status = describeFastMode(
    { provider: "openai-codex", id: "gpt-5.5", api: "openai-codex-responses" },
    true,
    "/tmp/settings.json",
  );

  assert.match(status, /OpenAI Fast mode: on/);
  assert.match(status, /Current model: openai-codex\/gpt-5\.5/);
  assert.match(status, /Current request tier: priority/);
});
