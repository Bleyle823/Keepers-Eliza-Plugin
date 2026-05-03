# openclaw-keepershub

KeeperHub workflow automation plugin for [OpenClaw](https://docs.openclaw.ai). Wraps the full KeeperHub MCP API as native OpenClaw agent tools so your OpenClaw agent can create, manage, and execute on-chain workflows, monitor smart contracts, and interact with DeFi protocols through natural language.

## Features

- **28 typed tools** covering every KeeperHub MCP operation
- **Workflow management** — list, get, create, update, delete, execute, search
- **Template browser** — search, inspect, and deploy pre-built workflow templates
- **DeFi protocol actions** — read Aave, Chainlink, Morpho, Uniswap, Compound, Lido, Maker positions directly
- **On-chain execution** — transfer tokens and call smart contracts via your KeeperHub wallet integration
- **Plugin / integration discovery** — explore available action schemas and configured credentials
- **AI workflow generation** — describe a workflow in natural language and let KeeperHub AI build the JSON definition for you
- **Marketplace integration** — search and invoke publicly listed workflows; transparent fallback to org workflows
- **Connection status tool** — `kh_status` reports the active org and workflow count
- **Auto-resuming MCP session** — handles 401 / 404 session expiry transparently

## Installation

After publishing (see **Publishing** below), install by package name. OpenClaw resolves bare specs against [ClawHub](https://docs.openclaw.ai/tools/clawhub) first, then npm ([Plugins doc](https://docs.openclaw.ai/tools/plugin)):

```bash
openclaw plugins install openclaw-keepershub
```

Force the resolver when you want only one registry:

```bash
openclaw plugins install clawhub:openclaw-keepershub
openclaw plugins install npm:openclaw-keepershub
```

Restart the Gateway:

```bash
openclaw gateway restart
```

### Developing from this repo (not published yet)

Install from the plugin directory path instead of the package name:

```bash
openclaw plugins install ./openclaw-plugins/keepershub
openclaw gateway restart
```

### Hook packs vs plugins

If OpenClaw reports **“not a valid hook pack”**, you are likely pointing a **hooks/skill pack** resolver at this package. Native OpenClaw plugins are installed with `openclaw plugins install …`, not the hooks installer.

## Configuration

Set your KeeperHub organization API key (starts with `kh_`). After any config change, restart the Gateway (`openclaw gateway restart`).

### From the CLI (recommended)

Use [`openclaw config set`](https://docs.openclaw.ai/cli/config) with the plugin id `keepershub`:

```bash
# Plain value (parsed as JSON5 / string)
openclaw config set plugins.entries.keepershub.config.apiKey "kh_your_key_here"

# Optional: store the key in an env var and reference it (avoids plaintext in openclaw.json)
export KH_API_KEY=kh_your_key_here
openclaw config set plugins.entries.keepershub.config.apiKey \
  --ref-provider default \
  --ref-source env \
  --ref-id KH_API_KEY
```

Validate before restart if you like:

```bash
openclaw config validate
```

On Windows PowerShell, use `` ` `` for line continuation instead of `\`, or put the `--ref-*` flags on one line.

If `keepershub` is not in `plugins.entries` yet, install the plugin first (`openclaw plugins install …`) so the entry exists, or add it with `openclaw config patch` / `openclaw config --section plugins`.

### Manual edit (`openclaw.json`)

```jsonc
{
  "plugins": {
    "entries": {
      "keepershub": {
        "config": {
          "apiKey": "kh_your_key_here"
        }
      }
    }
  }
}
```

### Environment variables only

Alternatively, set one of these environment variables (the plugin checks them in order; no `openclaw.json` key required):

```env
KH_API_KEY=kh_your_key_here
KEEPERHUB_API_KEY=kh_your_key_here
KEEPERSHUB_API_KEY=kh_your_key_here
```

Get an API key at [app.keeperhub.com](https://app.keeperhub.com) → Avatar → API Keys → Organisation → New API Key.

## Verifying the install

```bash
openclaw plugins inspect keepershub --runtime --json
```

Then ask your OpenClaw agent to call `kh_status` — it will report whether the API key is detected, the active organization id, and the cached workflow count.

## Usage

Once installed and configured, the agent can call any of the `kh_*` tools. Example prompts:

```
List all my KeeperHub workflows.
Get workflow abc123.
Create a workflow called "ETH Monitor" with a manual trigger.
Execute workflow abc123.
Search templates for monitoring.
Deploy template abc123 as "My Monitor".
Search protocol actions for aave.
Execute protocol action aave/get-user-account-data on network 1 for 0x123...
List my integrations.
What web3 plugins are available in KeeperHub?
Generate a workflow that monitors USDC transfers over $10k and sends a Discord alert.
Show KeeperHub documentation.
```

## Tool reference

| Tool | Description |
| --- | --- |
| `kh_list_workflows` | List all workflows in the org (optional `projectId`, `tagId`) |
| `kh_get_workflow` | Get workflow details by ID |
| `kh_create_workflow` | Create a new workflow |
| `kh_update_workflow` | Update an existing workflow |
| `kh_delete_workflow` | Permanently delete a workflow |
| `kh_execute_workflow` | Manually trigger a workflow |
| `kh_search_org_workflows` | Search workflows by name/description |
| `kh_get_execution_status` | Check workflow execution status |
| `kh_get_execution_logs` | Get step-by-step execution logs |
| `kh_search_templates` | Browse pre-built workflow templates |
| `kh_get_template` | Get template details |
| `kh_deploy_template` | Clone a template into your org |
| `kh_search_plugins` | List available action schemas by category |
| `kh_get_plugin` | Get plugin/integration schema |
| `kh_list_action_schemas` | List all available actions and chains |
| `kh_list_integrations` | List configured integrations |
| `kh_get_wallet_integration` | Get wallet integration details |
| `kh_search_protocol_actions` | Search DeFi protocol actions |
| `kh_execute_protocol_action` | Execute a protocol action (read) |
| `kh_execute_transfer` | Transfer tokens via wallet integration |
| `kh_execute_contract_call` | Call a smart contract function |
| `kh_execute_check_and_execute` | Conditional on-chain execution |
| `kh_get_direct_execution_status` | Check direct execution status |
| `kh_search_workflows_marketplace` | Search public marketplace workflows |
| `kh_call_workflow` | Invoke a marketplace workflow (with org-workflow fallback) |
| `kh_ai_generate_workflow` | Generate a workflow definition from a natural-language description |
| `kh_tools_documentation` | Get the KeeperHub MCP documentation |
| `kh_status` | Show plugin connection status and org context |

All tools are registered as required (always available). No allowlist entry is needed in `tools.allow`.

## Architecture

```
OpenClaw agent → kh_* tool → KeeperHubClient (singleton)
                              │
                              └─► HTTP POST + mcp-session-id → app.keeperhub.com/mcp
                                  ↑    (401/404 session ⇒ re-initialize and replay)
                                  └── Authorization: Bearer kh_...
```

The client lazy-initializes the MCP session on the first tool call and caches it per process. Session expiry (401, or 404 with a session-related body) triggers a transparent re-initialize and replay of the original call.

## Development

```bash
# Install dependencies
bun install
# or: pnpm install

# Run tests
bun test

# Build (generates dist/)
bun run build
```

The plugin uses [TypeBox](https://github.com/sinclairzx81/typebox) for parameter schemas (the schema format OpenClaw expects in `api.registerTool({ parameters })`).

The `"files"` field in `package.json` intentionally excludes `src/__tests__` so published tarballs stay lean.

## Publishing

Publishing requires credentials on **your** machine; nothing in this repo can publish without npm / ClawHub auth.

### 1. Prerequisites

- **npm account** logged in with permission to publish this package name (unscoped `openclaw-keepershub`; for a scoped name like `@yourorg/...` you must create or join that org on [npmjs.com](https://www.npmjs.com/)).
- **Built artifacts**: `dist/` must exist before publish (`prepublishOnly` runs `tsc`).
- Install the **ClawHub CLI** if you use ClawHub: `npm i -g clawhub` ([ClawHub](https://docs.openclaw.ai/tools/clawhub)).

### 2. Publish to npm

From `openclaw-plugins/keepershub/`:

```bash
npm login
npm publish --access public
```

Dry-run (contents only, no upload):

```bash
npm publish --dry-run
```

After npm lists the package, users can install with:

```bash
openclaw plugins install npm:openclaw-keepershub
# or bare spec (ClawHub first, then npm):
openclaw plugins install openclaw-keepershub
```

### 3. Publish to ClawHub (recommended discovery path)

Login once:

```bash
clawhub login
```

Publish from this folder or from GitHub ([ClawHub plugins](https://docs.openclaw.ai/tools/clawhub)). Provenance overrides (update **`--source-commit`** to your current `git rev-parse HEAD` when you cut a release):

| Field | Value |
| ----- | ----- |
| **Changelog** | See [`CHANGELOG.md`](./CHANGELOG.md) for `1.0.0`, or pass a one-line summary with `--changelog "…"`. |
| **Source repo** | `Bleyle823/Keepers-Eliza-Plugin` (or `https://github.com/Bleyle823/Keepers-Eliza-Plugin.git`) |
| **Source commit** | `557e60a0fc1d9123435c426c14c7e1ae22773a06` |
| **Source ref** | `plugin-keepersHub` |

Single line (any shell):

```bash
cd openclaw-plugins/keepershub
clawhub package publish . --dry-run --changelog "Initial release: 28 KeeperHub MCP tools for OpenClaw (workflows, templates, protocol actions, marketplace, kh_status)." --source-repo Bleyle823/Keepers-Eliza-Plugin --source-commit 557e60a0fc1d9123435c426c14c7e1ae22773a06 --source-ref plugin-keepersHub
clawhub package publish . --changelog "Initial release: 28 KeeperHub MCP tools for OpenClaw (workflows, templates, protocol actions, marketplace, kh_status)." --source-repo Bleyle823/Keepers-Eliza-Plugin --source-commit 557e60a0fc1d9123435c426c14c7e1ae22773a06 --source-ref plugin-keepersHub
```

Then install:

```bash
openclaw plugins install clawhub:openclaw-keepershub
```

See the [OpenClaw plugin building guide](https://docs.openclaw.ai/plugins/building-plugins) for manifest and compatibility notes.

## Related

- [`openclaw.plugin.json`](./openclaw.plugin.json) — plugin manifest with the full `contracts.tools` list
- [Eliza version](../../packages/plugin-keepershub) — the original ElizaOS port this plugin mirrors

## License

MIT
