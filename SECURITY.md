# Security Policy

Report security issues privately through GitHub's security advisory flow for this repository.

The extension reads and writes one local boolean preference beneath Pi's agent directory. It does not read credentials, make network calls, execute shell commands, or send additional prompt content. When enabled, it adds only `service_tier: "priority"` to payloads for Pi's exact OpenAI provider/API pairs.
