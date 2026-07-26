export const FAST_SERVICE_TIER = "priority" as const;
export const OPENAI_PROVIDER_IDS = new Set(["openai", "openai-codex"]);

export interface FastModeSettings {
  enabled: boolean;
}

export interface ModelLike {
  provider?: unknown;
  id?: unknown;
  api?: unknown;
}

export type FastModeStrategy =
  | "openai-responses"
  | "anthropic-messages"
  | "google-generative-ai"
  | "moonshot-kimi-k2.7-code"
  | "moonshot-kimi-k2.7-code-highspeed";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isOpenAIProvider(provider: unknown): provider is "openai" | "openai-codex" {
  return typeof provider === "string" && OPENAI_PROVIDER_IDS.has(provider);
}

export function getFastModeStrategy(model: ModelLike | undefined): FastModeStrategy | undefined {
  if (model?.provider === "openai" && model.api === "openai-responses") {
    return "openai-responses";
  }
  if (model?.provider === "openai-codex" && model.api === "openai-codex-responses") {
    return "openai-responses";
  }
  if (model?.provider === "anthropic" && model.api === "anthropic-messages") {
    return "anthropic-messages";
  }
  if (model?.provider === "google" && model.api === "google-generative-ai") {
    return "google-generative-ai";
  }
  if (
    (model?.provider === "moonshotai" || model?.provider === "moonshotai-cn") &&
    model.api === "openai-completions" &&
    model.id === "kimi-k2.7-code"
  ) {
    return "moonshot-kimi-k2.7-code";
  }
  if (
    (model?.provider === "moonshotai" || model?.provider === "moonshotai-cn") &&
    model.api === "openai-completions" &&
    model.id === "kimi-k2.7-code-highspeed"
  ) {
    return "moonshot-kimi-k2.7-code-highspeed";
  }
  return undefined;
}

export function isFastCapableModel(model: ModelLike | undefined): boolean {
  return getFastModeStrategy(model) !== undefined;
}

export function parseSettings(value: unknown): FastModeSettings {
  if (!isRecord(value) || typeof value.enabled !== "boolean") {
    return { enabled: false };
  }
  return { enabled: value.enabled };
}

/**
 * Return a replacement provider payload when a supported strategy applies.
 * Returning undefined tells Pi to keep the original payload unchanged.
 */
export function applyFastModePayload(
  model: ModelLike | undefined,
  payload: unknown,
  enabled: boolean,
): Record<string, unknown> | undefined {
  if (!isRecord(payload)) return undefined;

  const strategy = getFastModeStrategy(model);
  if (strategy === undefined) return undefined;

  switch (strategy) {
    case "openai-responses":
      return enabled ? { ...payload, service_tier: FAST_SERVICE_TIER } : undefined;

    case "anthropic-messages":
      return { ...payload, service_tier: enabled ? "auto" : "standard_only" };

    case "google-generative-ai": {
      if (!enabled) return undefined;
      if (payload.config !== undefined && !isRecord(payload.config)) return undefined;
      const config = payload.config ?? {};
      return {
        ...payload,
        config: { ...config, serviceTier: FAST_SERVICE_TIER },
      };
    }

    case "moonshot-kimi-k2.7-code":
      return enabled && payload.model === "kimi-k2.7-code"
        ? { ...payload, model: "kimi-k2.7-code-highspeed" }
        : undefined;

    case "moonshot-kimi-k2.7-code-highspeed":
      return undefined;
  }
}

export const applyFastServiceTier = applyFastModePayload;

function strategyLabel(strategy: FastModeStrategy | undefined): string {
  switch (strategy) {
    case "openai-responses":
      return "OpenAI Responses/Codex";
    case "anthropic-messages":
      return "Claude API";
    case "google-generative-ai":
      return "Gemini API";
    case "moonshot-kimi-k2.7-code":
      return "Kimi K2.7 Code";
    case "moonshot-kimi-k2.7-code-highspeed":
      return "Kimi K2.7 Code HighSpeed";
    default:
      return "unsupported provider/API";
  }
}

function requestDescription(strategy: FastModeStrategy | undefined, enabled: boolean): string {
  switch (strategy) {
    case "openai-responses":
      return enabled ? "service_tier=priority" : "unchanged";
    case "anthropic-messages":
      return `service_tier=${enabled ? "auto" : "standard_only"}`;
    case "google-generative-ai":
      return enabled ? "payload.config.serviceTier=priority" : "unchanged";
    case "moonshot-kimi-k2.7-code":
      return enabled ? "model=kimi-k2.7-code-highspeed" : "unchanged";
    case "moonshot-kimi-k2.7-code-highspeed":
      return "unchanged (already highspeed)";
    default:
      return "unchanged";
  }
}

export function fastModeFooter(model: ModelLike | undefined, enabled: boolean): string | undefined {
  if (!enabled) return undefined;

  switch (getFastModeStrategy(model)) {
    case "openai-responses":
      return "[openai: fast]";
    case "anthropic-messages":
      return "[claude: fast]";
    case "google-generative-ai":
      return "[gemini: fast]";
    case "moonshot-kimi-k2.7-code":
    case "moonshot-kimi-k2.7-code-highspeed":
      return "[kimi: highspeed]";
    default:
      return undefined;
  }
}

export function describeFastMode(model: ModelLike | undefined, enabled: boolean, settingsPath: string): string {
  const provider = typeof model?.provider === "string" ? model.provider : "none";
  const id = typeof model?.id === "string" ? model.id : "none";
  const strategy = getFastModeStrategy(model);

  return [
    `Fast mode: ${enabled ? "on" : "off"}`,
    `Current model: ${provider}/${id}`,
    `Provider strategy: ${strategyLabel(strategy)}`,
    `Current request tier: ${requestDescription(strategy, enabled)}`,
    `Settings: ${settingsPath}`,
  ].join("\n");
}
