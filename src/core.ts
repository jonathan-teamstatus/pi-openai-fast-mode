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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isOpenAIProvider(provider: unknown): provider is "openai" | "openai-codex" {
  return typeof provider === "string" && OPENAI_PROVIDER_IDS.has(provider);
}

export function isFastCapableModel(model: ModelLike | undefined): boolean {
  return (
    (model?.provider === "openai" && model.api === "openai-responses") ||
    (model?.provider === "openai-codex" && model.api === "openai-codex-responses")
  );
}

export function parseSettings(value: unknown): FastModeSettings {
  if (!isRecord(value) || typeof value.enabled !== "boolean") {
    return { enabled: false };
  }
  return { enabled: value.enabled };
}

/**
 * Return a replacement provider payload when Fast mode applies. Returning
 * undefined tells Pi to keep the original payload unchanged.
 */
export function applyFastServiceTier(
  model: ModelLike | undefined,
  payload: unknown,
  enabled: boolean,
): Record<string, unknown> | undefined {
  if (!enabled || !isFastCapableModel(model) || !isRecord(payload)) {
    return undefined;
  }

  return {
    ...payload,
    service_tier: FAST_SERVICE_TIER,
  };
}

export function fastModeFooter(model: ModelLike | undefined, enabled: boolean): string | undefined {
  return enabled && isFastCapableModel(model) ? "[OpenAI: fast]" : undefined;
}

export function describeFastMode(model: ModelLike | undefined, enabled: boolean, settingsPath: string): string {
  const provider = typeof model?.provider === "string" ? model.provider : "none";
  const id = typeof model?.id === "string" ? model.id : "none";
  const appliesNow = enabled && isFastCapableModel(model);

  return [
    `OpenAI Fast mode: ${enabled ? "on" : "off"}`,
    `Current model: ${provider}/${id}`,
    `Current request tier: ${appliesNow ? FAST_SERVICE_TIER : "unchanged"}`,
    `Settings: ${settingsPath}`,
  ].join("\n");
}
