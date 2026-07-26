# pi-openai-fast-mode

A small [Pi](https://pi.dev) extension that adds provider-aware Fast mode controls through Pi's public provider-extension API. The `/fast` command and the existing settings location are preserved.

## Features

- `/fast`, `/fast on`, `/fast off`, `/fast toggle`, and `/fast status` control one persisted Fast mode setting.
- The footer and status message identify the active provider strategy.
- Fast mode defaults to off and unsupported providers are left alone.

## Installation

```bash
pi install git:github.com/jonathan-teamstatus/pi-openai-fast-mode@v0.1.0
```

Restart Pi or run `/reload`, then enable Fast mode:

```text
/fast on
```

For local development:

```bash
pi install "$PWD"
```

## Commands

| Command | Behavior |
|---|---|
| `/fast` | Open the TUI selector |
| `/fast on` | Enable and persist Fast mode |
| `/fast off` | Disable and persist Fast mode |
| `/fast toggle` | Toggle and persist the preference |
| `/fast status` | Show the preference, current model, provider strategy, request behavior, and settings path |

## Configuration

The extension writes:

```text
~/.pi/agent/openai-fast-mode/settings.json
```

When `PI_CODING_AGENT_DIR` is set, the file is stored beneath that directory instead. The schema is unchanged:

```json
{
  "enabled": true
}
```

Invalid or missing settings fail closed to disabled.

## Supported provider strategies

Only these exact provider/API/model combinations are modified:

| Provider/API | Fast on | Fast off |
|---|---|---|
| `openai` + `openai-responses` | top-level `service_tier: "priority"` | unchanged |
| `openai-codex` + `openai-codex-responses` | top-level `service_tier: "priority"` | unchanged |
| `anthropic` + `anthropic-messages` | top-level `service_tier: "auto"` | top-level `service_tier: "standard_only"` |
| `google` + `google-generative-ai` | cloned `payload.config.serviceTier: "priority"` | unchanged |
| `moonshotai` or `moonshotai-cn` + `openai-completions`, model `kimi-k2.7-code` | request model becomes `kimi-k2.7-code-highspeed` | unchanged |

The `kimi-k2.7-code-highspeed` Moonshot model ID is supported and is not rewritten again. Payloads are cloned; neither the top-level payload nor nested Google config is mutated.

OpenRouter, custom compatible providers, `google-vertex`, `kimi-coding`, and unsupported Kimi models are intentionally not modified.

## Important limits

- Fast availability is controlled by each provider, model, account, and plan. The footer means the extension requested the provider strategy; it is not proof that the provider served the request on a faster tier.
- Kimi's highspeed rewrite is a local request-payload change. Pi's local model/cost metadata may still describe the selected `kimi-k2.7-code` model rather than the rewritten highspeed request, so billing and effective availability should be checked with Moonshot.
- Provider responses and account billing are authoritative. Local cost displays may not reflect provider-specific priority-tier pricing.

## Development

```bash
npm install
npm run verify
```

## License

MIT
