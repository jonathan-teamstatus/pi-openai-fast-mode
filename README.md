# pi-openai-fast-mode

A small [Pi](https://pi.dev) extension that adds TUI controls for OpenAI's Fast service tier. It uses Pi's public provider-extension API and does not fork or patch Pi.

OpenAI calls the user-facing mode **Fast**. On the wire, the corresponding Responses/Codex request value is `service_tier: "priority"`.

## Features

- `/fast` opens an interactive TUI selector.
- `/fast on`, `/fast off`, `/fast toggle`, and `/fast status` provide direct control.
- `[OpenAI: fast]` appears in Pi's footer while Fast mode is enabled and an `openai` or `openai-codex` model is selected.
- The preference persists across sessions.
- Non-OpenAI provider requests are never modified.
- Fast mode defaults to off.

## Installation

Install the pinned release:

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
| `/fast status` | Show the preference, current model, request tier, and settings path |

## Configuration

The extension writes:

```text
~/.pi/agent/openai-fast-mode/settings.json
```

When `PI_CODING_AGENT_DIR` is set, the file is stored beneath that directory instead.

```json
{
  "enabled": true
}
```

Invalid or missing settings fail closed to disabled.

## How it works

When enabled, the extension listens to Pi's public `before_provider_request` event. For exact provider/API pairs `openai`/`openai-responses` and `openai-codex`/`openai-codex-responses`, it returns a cloned payload with:

```json
{
  "service_tier": "priority"
}
```

All other payload fields remain unchanged. The original payload object is not mutated, and other provider IDs or API types remain untouched.

## Important limits

- Fast availability is controlled by OpenAI and depends on the selected model, account, and plan. The footer means Pi requested the priority tier; it is not independent proof that OpenAI served the request on that tier.
- Fast mode consumes ChatGPT credits or API spend faster than standard processing. Consult OpenAI's current speed and pricing documentation before enabling it.
- The public payload hook does not set Pi's internal typed `serviceTier` option. OpenAI account usage and billing are authoritative; Pi's local cost display may remain at standard-tier estimates when the response does not report the effective priority tier.
- The extension intentionally does not modify OpenAI-compatible third-party providers, even if they accept a similarly named field.

## Development

```bash
npm install
npm run verify
```

## License

MIT
