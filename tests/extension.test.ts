import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerFastMode } from "../src/index.ts";

function createHarness(settingsFile: string) {
  const commands = new Map<string, any>();
  const events = new Map<string, (...args: any[]) => unknown>();

  const pi = {
    registerCommand(name: string, config: Record<string, unknown>) {
      commands.set(name, config);
    },
    on(name: string, handler: (...args: any[]) => unknown) {
      events.set(name, handler);
    },
  } as unknown as ExtensionAPI;

  registerFastMode(pi, settingsFile);
  return { commands, events };
}

function createContext(model: Record<string, unknown>) {
  const statuses = new Map<string, string | undefined>();
  const notifications: Array<{ message: string; level: string }> = [];
  const context = {
    hasUI: true,
    model,
    ui: {
      setStatus(key: string, value: string | undefined) {
        statuses.set(key, value);
      },
      notify(message: string, level: string) {
        notifications.push({ message, level });
      },
      async select() {
        return undefined;
      },
    },
  };
  return { context, statuses, notifications };
}

test("registers the preserved /fast command and lifecycle hooks", () => {
  const directory = mkdtempSync(join(tmpdir(), "pi-fast-mode-test-"));
  try {
    const { commands, events } = createHarness(join(directory, "settings.json"));
    assert.equal(typeof commands.get("fast")?.handler, "function");
    assert.deepEqual([...events.keys()].sort(), ["before_provider_request", "model_select", "session_start"]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("command persists state and provider hook applies a table of strategies", async () => {
  const cases = [
    {
      name: "OpenAI",
      model: { provider: "openai", id: "gpt", api: "openai-responses" },
      payload: { model: "gpt" },
      expected: { model: "gpt", service_tier: "priority" },
      footer: "[openai: fast]",
    },
    {
      name: "Anthropic",
      model: { provider: "anthropic", id: "claude", api: "anthropic-messages" },
      payload: { model: "claude" },
      expected: { model: "claude", service_tier: "auto" },
      footer: "[claude: fast]",
    },
    {
      name: "Google",
      model: { provider: "google", id: "gemini", api: "google-generative-ai" },
      payload: { model: "gemini", config: { temperature: 0.2 } },
      expected: { model: "gemini", config: { temperature: 0.2, serviceTier: "priority" } },
      footer: "[gemini: fast]",
    },
    {
      name: "Moonshot",
      model: { provider: "moonshotai-cn", id: "kimi-k2.7-code", api: "openai-completions" },
      payload: { model: "kimi-k2.7-code" },
      expected: { model: "kimi-k2.7-code-highspeed" },
      footer: "[kimi: highspeed]",
    },
  ];

  for (const entry of cases) {
    const directory = mkdtempSync(join(tmpdir(), "pi-fast-mode-test-"));
    try {
      const settingsFile = join(directory, "settings.json");
      const { commands, events } = createHarness(settingsFile);
      const { context, statuses } = createContext(entry.model);
      const sessionStart = events.get("session_start");
      const providerHook = events.get("before_provider_request");
      const command = commands.get("fast")?.handler;
      assert.ok(sessionStart && providerHook && command, entry.name);

      sessionStart({}, context);
      await command("on", context);
      assert.deepEqual(JSON.parse(readFileSync(settingsFile, "utf8")), { enabled: true }, entry.name);
      assert.equal(statuses.get("openai-fast-mode"), entry.footer, entry.name);
      assert.deepEqual(providerHook({ payload: entry.payload }, context), entry.expected, entry.name);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

test("disabling keeps the setting schema and opts Anthropic out of Priority Tier", async () => {
  const directory = mkdtempSync(join(tmpdir(), "pi-fast-mode-test-"));
  try {
    const settingsFile = join(directory, "settings.json");
    const { commands, events } = createHarness(settingsFile);
    const { context } = createContext({ provider: "anthropic", id: "claude", api: "anthropic-messages" });
    const command = commands.get("fast")?.handler;
    const providerHook = events.get("before_provider_request");
    assert.ok(command && providerHook);

    await command("off", context);
    assert.deepEqual(providerHook({ payload: { model: "claude", service_tier: "auto" } }, context), {
      model: "claude",
      service_tier: "standard_only",
    });
    assert.deepEqual(JSON.parse(readFileSync(settingsFile, "utf8")), { enabled: false });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("session start warns and disables Fast mode for invalid settings", () => {
  const directory = mkdtempSync(join(tmpdir(), "pi-fast-mode-test-"));
  const settingsFile = join(directory, "settings.json");

  try {
    writeFileSync(settingsFile, '{"enabled":"yes"}\n');
    const { events } = createHarness(settingsFile);
    const { context, statuses, notifications } = createContext({
      provider: "openai",
      api: "openai-responses",
    });
    events.get("session_start")?.({}, context);

    assert.equal(statuses.get("openai-fast-mode"), undefined);
    assert.equal(notifications.at(-1)?.level, "warning");
    assert.match(notifications.at(-1)?.message ?? "", /Invalid settings/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
