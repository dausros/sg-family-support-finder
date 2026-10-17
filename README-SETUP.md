# Install into OpenCode project (Windows)

1. Extract this ZIP into `C:\Users\dausr\Documents\GovTech-Assessment` (merge folders; do not overwrite the original PDF).
2. Confirm `AGENTS.md`, `SKILLS.md`, `.opencode/skills/` and `.opencode/agents/` exist at project root.
3. Keep the original JD at `docs/Low Code Engineer JD.pdf`.
4. Restart OpenCode from that project folder. Ask it to read AGENTS.md and SKILLS.md, list discovered project skills/agents, and inspect the target O11 module without modifying it.

OpenCode version-specific agent/skill discovery and model support must be verified in your installation. If agents are not discovered, follow their Markdown instructions directly.

## Connect the OutSystems 11 Service Studio MCP

1. Install the official skill and MCP server setup from https://github.com/OutSystems/outsystems11-mcp (the skill is vendored in `.opencode/skills/servicestudio-mcp-oml/` and the repo is pinned as the `outsystems11-mcp-official` submodule: `git submodule update --init`).
2. Copy `opencode.example.json` to `opencode.json` (git-ignored) and set `url` to your Service Studio MCP endpoint. Use the local endpoint, or the HTTPS URL of a tunnel such as `cloudflared tunnel --url …` if the agent runs on another machine. Quick-tunnel URLs change on every restart.
3. Open the target module in Service Studio, restart OpenCode, and confirm the `outsystems-studio` server lists its tools.

Never commit a live tunnel URL.
