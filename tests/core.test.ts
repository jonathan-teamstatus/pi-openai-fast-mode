import assert from "node:assert/strict";
import test from "node:test";
import {
  applyFastServiceTier,
  describeFastMode,
  fastModeFooter,
  getFastModeStrategy,
  isFastCapableModel,
  parseSettings,
} from "../src/core.ts";

test("recognizes only the exact supported provider/API/model strategies", () => {
  const cases = [
    ["OpenAI Responses", { provider: "openai", id: "gpt-5.5", api: "openai-responses" }, true],
    ["OpenAI Codex Responses", { provider: "openai-codex", id: "gpt-5.4", api: "openai-codex-responses" }, true],
    ["Anthropic Messages", { provider: "anthropic", id: "claude", api: "anthropic-messages" }, true],
    ["Google Generative AI", { provider: "google", id: "gemini", api: "google-generative-ai" }, true],
    ["Moonshot Kimi code", { provider: "moonshotai", id: "kimi-k2.7-code", api: "openai-completions" }, true],
    ["Moonshot CN Kimi highspeed", { provider: "moonshotai-cn", id: "kimi-k2.7-code-highspeed", api: "openai-completions" }, true],
    ["OpenRouter", { provider: "openrouter", id: "gpt-5.5", api: "openai-responses" }, false],
    ["custom compatible provider", { provider: "custom", id: "kimi-k2.7-code", api: "openai-completions" }, false],
    ["Google Vertex", { provider: "google-vertex", id: "gemini", api: "google-generative-ai" }, false],
    ["Kimi coding", { provider: "kimi-coding", id: "kimi-k2.7-code", api: "openai-completions" }, false],
    ["unsupported Kimi model", { provider: "moonshotai", id: "kimi-k2.5", api: "openai-completions" }, false],
    ["wrong API", { provider: "moonshotai", id: "kimi-k2.7-code", api: "anthropic-messages" }, false],
  ] as const;

  for (const [name, model, expected] of cases) {
    assert.equal(isFastCapableModel(model), expected, name);
  }
});

test("applies exact strategies without mutating payloads", () => {
  const cases = [
    {
      name: "OpenAI priority",
      model: { provider: "openai", api: "openai-responses" },
      payload: { model: "gpt-5.5", service_tier: "default" },
      expected: { model: "gpt-5.5", service_tier: "priority" },
    },
    {
      name: "Anthropic opt in",
      model: { provider: "anthropic", api: "anthropic-messages" },
      payload: { model: "claude", service_tier: "standard_only" },
      expected: { model: "claude", service_tier: "auto" },
    },
    {
      name: "Anthropic opt out",
      model: { provider: "anthropic", api: "anthropic-messages" },
      payload: { model: "claude", service_tier: "auto" },
      enabled: false,
      expected: { model: "claude", service_tier: "standard_only" },
    },
    {
      name: "Google nested priority",
      model: { provider: "google", api: "google-generative-ai" },
      payload: { model: "gemini", config: { temperature: 0.2, serviceTier: "standard" } },
      expected: { model: "gemini", config: { temperature: 0.2, serviceTier: "priority" } },
    },
    {
      name: "Moonshot highspeed rewrite",
      model: { provider: "moonshotai-cn", id: "kimi-k2.7-code", api: "openai-completions" },
      payload: { model: "kimi-k2.7-code", stream: true },
      expected: { model: "kimi-k2.7-code-highspeed", stream: true },
    },
  ];

  for (const entry of cases) {
    const payload = structuredClone(entry.payload);
    const replacement = applyFastServiceTier(entry.model, payload, entry.enabled ?? true);
    assert.deepEqual(replacement, entry.expected, entry.name);
    assert.deepEqual(payload, entry.payload, `${entry.name} must not mutate the payload`);
    if (entry.name === "Google nested priority") {
      assert.notEqual((replacement as Record<string, unknown>).config, payload.config);
    }
  }
});

test("fails closed for malformed payloads and Google config", () => {
  assert.equal(
    applyFastServiceTier({ provider: "google", api: "google-generative-ai" }, null, true),
    undefined,
  );
  assert.equal(
    applyFastServiceTier(
      { provider: "google", api: "google-generative-ai" },
      { model: "gemini", config: "invalid" },
      true,
    ),
    undefined,
  );
});

test("does not overwrite a Kimi model changed by another payload hook", () => {
  const model = { provider: "moonshotai", id: "kimi-k2.7-code", api: "openai-completions" };
  assert.equal(applyFastServiceTier(model, { stream: true }, true), undefined);
  assert.equal(
    applyFastServiceTier(model, { model: "another-model", stream: true }, true),
    undefined,
  );
});

test("leaves disabled non-Anthropic requests and already-highspeed Kimi unchanged", () => {
  const cases = [
    [{ provider: "openai", api: "openai-responses" }, { model: "gpt" }],
    [{ provider: "google", api: "google-generative-ai" }, { model: "gemini", config: {} }],
    [{ provider: "moonshotai", id: "kimi-k2.7-code", api: "openai-completions" }, { model: "kimi-k2.7-code" }],
    [{ provider: "moonshotai-cn", id: "kimi-k2.7-code-highspeed", api: "openai-completions" }, { model: "kimi-k2.7-code-highspeed" }],
    [{ provider: "openrouter", api: "openai-responses" }, { model: "gpt" }],
  ] as const;

  for (const [model, payload] of cases) {
    assert.equal(applyFastServiceTier(model, payload, false), undefined);
  }
});

test("settings fail closed unless enabled is explicitly boolean", () => {
  assert.deepEqual(parseSettings({ enabled: true }), { enabled: true });
  assert.deepEqual(parseSettings({ enabled: false }), { enabled: false });
  assert.deepEqual(parseSettings({ enabled: "yes" }), { enabled: false });
  assert.deepEqual(parseSettings(null), { enabled: false });
});

test("footer is provider-specific while Fast mode is enabled", () => {
  const cases = [
    [{ provider: "openai-codex", api: "openai-codex-responses" }, "[openai: fast]"],
    [{ provider: "anthropic", api: "anthropic-messages" }, "[claude: fast]"],
    [{ provider: "google", api: "google-generative-ai" }, "[gemini: fast]"],
    [{ provider: "moonshotai", id: "kimi-k2.7-code-highspeed", api: "openai-completions" }, "[kimi: highspeed]"],
    [{ provider: "openrouter", api: "openai-responses" }, undefined],
  ] as const;

  for (const [model, expected] of cases) {
    assert.equal(fastModeFooter(model, true), expected);
  }
  assert.equal(fastModeFooter({ provider: "openai", api: "openai-responses" }, false), undefined);
});

test("status names the selected provider strategy and wire behavior", () => {
  assert.equal(getFastModeStrategy({ provider: "anthropic", api: "anthropic-messages" }), "anthropic-messages");
  const status = describeFastMode(
    { provider: "anthropic", id: "claude", api: "anthropic-messages" },
    false,
    "/tmp/settings.json",
  );

  assert.match(status, /Fast mode: off/);
  assert.match(status, /Current model: anthropic\/claude/);
  assert.match(status, /Provider strategy: Claude API/);
  assert.match(status, /service_tier=standard_only/);
});
