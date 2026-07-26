# Security Policy

Report security issues privately through GitHub's security advisory flow for this repository.

The extension reads and writes one local boolean preference beneath Pi's agent directory. It does not read credentials, make network calls, execute shell commands, or send additional prompt content. When enabled, it only clones and adjusts payloads for the exact provider/API/model strategies documented in the README. Anthropic requests explicitly use `service_tier: "standard_only"` when Fast mode is disabled so the toggle opts out of Priority Tier.
