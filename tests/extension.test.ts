import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerOpenAIFastMode } from "../src/index.ts";

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

  registerOpenAIFastMode(pi, settingsFile);
  return { commands, events };
}

function createContext() {
  const statuses = new Map<string, string | undefined>();
  const notifications: Array<{ message: string; level: string }> = [];
  const context = {
    hasUI: true,
    model: {
      provider: "openai-codex",
      id: "gpt-5.5",
      api: "openai-codex-responses",
    },
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

test("registers Fast mode command and lifecycle hooks", () => {
  const directory = mkdtempSync(join(tmpdir(), "pi-fast-mode-test-"));
  try {
    const { commands, events } = createHarness(join(directory, "settings.json"));
    assert.equal(typeof commands.get("fast")?.handler, "function");
    assert.deepEqual([...events.keys()].sort(), ["before_provider_request", "model_select", "session_start"]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("command persists state and provider hook follows the persisted preference", async () => {
  const directory = mkdtempSync(join(tmpdir(), "pi-fast-mode-test-"));
  const settingsFile = join(directory, "settings.json");

  try {
    const { commands, events } = createHarness(settingsFile);
    const { context, statuses } = createContext();
    const sessionStart = events.get("session_start");
    const providerHook = events.get("before_provider_request");
    const command = commands.get("fast")?.handler;
    assert.ok(sessionStart && providerHook && command);

    sessionStart({}, context);
    assert.equal(statuses.get("openai-fast-mode"), undefined);
    assert.equal(providerHook({ payload: { model: "gpt-5.5" } }, context), undefined);

    await command("on", context);
    assert.deepEqual(JSON.parse(readFileSync(settingsFile, "utf8")), { enabled: true });
    assert.equal(statuses.get("openai-fast-mode"), "[OpenAI: fast]");
    assert.deepEqual(providerHook({ payload: { model: "gpt-5.5" } }, context), {
      model: "gpt-5.5",
      service_tier: "priority",
    });

    await command("off", context);
    assert.deepEqual(JSON.parse(readFileSync(settingsFile, "utf8")), { enabled: false });
    assert.equal(providerHook({ payload: { model: "gpt-5.5" } }, context), undefined);
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
    const { context, statuses, notifications } = createContext();
    events.get("session_start")?.({}, context);

    assert.equal(statuses.get("openai-fast-mode"), undefined);
    assert.equal(notifications.at(-1)?.level, "warning");
    assert.match(notifications.at(-1)?.message ?? "", /Invalid settings/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
