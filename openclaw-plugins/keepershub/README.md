# `@keepershub/openclaw-keepershub`

KeeperHub workflow automation plugin for [OpenClaw](https://docs.openclaw.ai). Wraps the full KeeperHub MCP API as native OpenClaw agent tools so your OpenClaw agent can create, manage, and execute on-chain workflows, monitor smart contracts, and interact with DeFi protocols through natural language.

**Registry:** This package is published on **[ClawHub](https://docs.openclaw.ai/tools/clawhub)** as **`@keepershub/openclaw-keepershub`**. Installing by name pulls from ClawHub first (then npm fallback), which is usually all you need to add KeeperHub tools to OpenClaw.

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

## Installation (recommended)

Install from **[ClawHub](https://docs.openclaw.ai/tools/clawhub)** via the scoped package name. OpenClaw resolves bare specs against ClawHub first, then npm ([Plugins doc](https://docs.openclaw.ai/tools/plugin)):

```bash
openclaw plugins install @keepershub/openclaw-keepershub
```

Force a specific resolver when you want only one registry:

```bash
openclaw plugins install clawhub:@keepershub/openclaw-keepershub
openclaw plugins install npm:@keepershub/openclaw-keepershub
```

Restart the Gateway:

```bash
openclaw gateway restart
```

## Installation from source (contributors)

If you maintain the plugin locally or forked [this repo](https://github.com/Bleyle823/Keepers-Eliza-Plugin), install from the directory path (**from your OpenClaw environment** — adapt the path to where `openclaw-plugins/keepershub` lives on disk):

```bash
openclaw plugins install ./openclaw-plugins/keepershub
openclaw gateway restart
```

See [Development](#development) for build and tests.

### Hook packs vs plugins

If OpenClaw reports **“not a valid hook pack”**, you are pointing a **hooks/skill pack** resolver at this package. Native OpenClaw plugins install with **`openclaw plugins install …`**, not the hooks installer.

## Configuration

Set your KeeperHub organization API key (starts with `kh_`) in your OpenClaw config. After changes, **`openclaw gateway restart`** is required.

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

### Via OpenClaw CLI (optional)

Use [`openclaw config set`](https://docs.openclaw.ai/cli/config):

```bash
openclaw config set plugins.entries.keepershub.config.apiKey "kh_your_key_here"
```

Alternatively, reference an env-backed secret ([config docs](https://docs.openclaw.ai/cli/config)):

```bash
export KH_API_KEY=kh_your_key_here
openclaw config set plugins.entries.keepershub.config.apiKey \
  --ref-provider default \
  --ref-source env \
  --ref-id KH_API_KEY
```

On Windows PowerShell, put `--ref-*` flags on one line or use PowerShell continuations (`\` is Bash-style).

Validate if you want:

```bash
openclaw config validate
```

### Environment variables only

The plugin also checks these in order (no `openclaw.json` key strictly required):

```env
KH_API_KEY=kh_your_key_here
KEEPERHUB_API_KEY=kh_your_key_here
KEEPERSHUB_API_KEY=kh_your_key_here
```

Get an API key at [app.keeperhub.com](https://app.keeperhub.com) → **Avatar → API Keys → Organisation → New API Key**.

## Verifying the install

```bash
openclaw plugins inspect keepershub --runtime --json
```

Then ask your OpenClaw agent to call **`kh_status`** — it reports whether the API key is detected, the active organisation id, and the cached workflow count.

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

Contributors cloning this monorepo use [TypeBox](https://github.com/sinclairzx81/typebox) for parameter schemas (`api.registerTool({ parameters })`). The `"files"` field in `package.json` excludes tests from publish tarballs.

```bash
# From openclaw-plugins/keepershub
bun install
bun test
bun run build   # generates dist/
```

For manifest and SDK compatibility notes, see the [OpenClaw plugin building guide](https://docs.openclaw.ai/plugins/building-plugins).

Release history: [`CHANGELOG.md`](./CHANGELOG.md).

## Related

- [`openclaw.plugin.json`](./openclaw.plugin.json) — plugin manifest with the full `contracts.tools` list
- [KeeperHub Eliza plugin](../../packages/plugin-keepershub) — ElizaOS port this plugin mirrors

## License

MIT
