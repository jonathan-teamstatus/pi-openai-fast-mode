import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  getAgentDir,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  applyFastModePayload,
  describeFastMode,
  fastModeFooter,
  isRecord,
  parseSettings,
  type FastModeSettings,
} from "./core.ts";

const STATUS_KEY = "openai-fast-mode";
const SETTINGS_FILE = join(getAgentDir(), "openai-fast-mode", "settings.json");

interface LoadedSettings {
  settings: FastModeSettings;
  warning?: string;
}

function loadSettings(settingsFile: string): LoadedSettings {
  if (!existsSync(settingsFile)) return { settings: { enabled: false } };

  try {
    const parsed: unknown = JSON.parse(readFileSync(settingsFile, "utf8"));
    if (!isRecord(parsed) || typeof parsed.enabled !== "boolean") {
      return {
        settings: { enabled: false },
        warning: `Invalid settings in ${settingsFile}; expected { "enabled": boolean }. Fast mode was disabled.`,
      };
    }
    return { settings: parseSettings(parsed) };
  } catch (error) {
    return {
      settings: { enabled: false },
      warning: `Could not read ${settingsFile}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function saveSettings(settingsFile: string, settings: FastModeSettings): void {
  mkdirSync(dirname(settingsFile), { recursive: true });
  const temporaryPath = `${settingsFile}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, settingsFile);
}

export function registerFastMode(pi: ExtensionAPI, settingsFile = SETTINGS_FILE): void {
  let enabled = false;

  function updateStatus(ctx: ExtensionContext): void {
    ctx.ui.setStatus(STATUS_KEY, fastModeFooter(ctx.model, enabled));
  }

  function showStatus(ctx: ExtensionContext): void {
    ctx.ui.notify(describeFastMode(ctx.model, enabled, settingsFile), "info");
  }

  function setEnabled(nextEnabled: boolean, ctx: ExtensionContext): void {
    enabled = nextEnabled;

    try {
      saveSettings(settingsFile, { enabled });
      ctx.ui.notify(`Fast mode ${enabled ? "enabled" : "disabled"}`, "info");
    } catch (error) {
      ctx.ui.notify(
        `Fast mode ${enabled ? "enabled" : "disabled"} for this process, but the preference could not be saved: ${
          error instanceof Error ? error.message : String(error)
        }`,
        "warning",
      );
    }

    updateStatus(ctx);
  }

  async function showSelector(ctx: ExtensionContext): Promise<void> {
    if (!ctx.hasUI) {
      showStatus(ctx);
      return;
    }

    const toggleLabel = enabled ? "Turn Fast mode off" : "Turn Fast mode on";
    const selection = await ctx.ui.select("Fast mode", [toggleLabel, "Show status"]);

    if (selection === toggleLabel) setEnabled(!enabled, ctx);
    else if (selection === "Show status") showStatus(ctx);
  }

  pi.registerCommand("fast", {
    description: "Control provider-specific Fast mode behavior",
    getArgumentCompletions(prefix) {
      const options = ["on", "off", "toggle", "status"];
      const normalizedPrefix = prefix.trim().toLowerCase();
      const matches = options.filter((option) => option.startsWith(normalizedPrefix));
      return matches.length > 0 ? matches.map((value) => ({ value, label: value })) : null;
    },
    async handler(args, ctx) {
      const action = args.trim().toLowerCase();

      if (!action) {
        await showSelector(ctx);
        return;
      }

      if (action === "on") setEnabled(true, ctx);
      else if (action === "off") setEnabled(false, ctx);
      else if (action === "toggle") setEnabled(!enabled, ctx);
      else if (action === "status") showStatus(ctx);
      else ctx.ui.notify("Usage: /fast [on|off|toggle|status]", "warning");
    },
  });

  pi.on("session_start", (_event, ctx) => {
    const loaded = loadSettings(settingsFile);
    enabled = loaded.settings.enabled;
    if (loaded.warning) ctx.ui.notify(loaded.warning, "warning");
    updateStatus(ctx);
  });

  pi.on("model_select", (_event, ctx) => {
    updateStatus(ctx);
  });

  pi.on("before_provider_request", (event, ctx) => {
    return applyFastModePayload(ctx.model, event.payload, enabled);
  });
}

export const registerOpenAIFastMode = registerFastMode;

export default function fastModeExtension(pi: ExtensionAPI): void {
  registerFastMode(pi);
}
