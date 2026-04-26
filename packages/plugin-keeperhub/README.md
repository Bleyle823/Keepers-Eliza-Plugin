# @elizaos/plugin-keeperhub

KeeperHub workflow automation plugin for ElizaOS. Wraps the full KeeperHub MCP API as native agent actions so your ElizaOS agent can create, manage, and execute blockchain automation workflows through natural language.

## Features

- **26 actions** covering every KeeperHub MCP tool
- **Workflow management** — list, get, create, update, delete, execute
- **Template browser** — search, inspect, and deploy pre-built workflow templates
- **DeFi protocol actions** — read Aave, Chainlink, Morpho, Uniswap, Compound positions directly
- **On-chain execution** — transfer tokens and call contracts via your KeeperHub wallet
- **Plugin/integration discovery** — explore available action schemas and configured credentials
- **AI workflow generation** — describe a workflow in natural language and let KeeperHub AI build it
- **Org context provider** — injects KeeperHub connection status into the agent's system prompt

## Installation

```bash
bun add @elizaos/plugin-keeperhub
```

## Configuration

Set your KeeperHub organization API key (starts with `kh_`):

```env
KH_API_KEY=kh_your_key_here
```

Get an API key at [app.keeperhub.com](https://app.keeperhub.com) → Avatar → API Keys → Organisation → New API Key.

## Usage

Add the plugin to your agent:

```typescript
import keeperhubPlugin from '@elizaos/plugin-keeperhub';

const agent = new AgentRuntime({
  plugins: [keeperhubPlugin],
  // ...
});
```

### Example prompts

```
List all my KeeperHub workflows
Get workflow abc123
Create a workflow called "ETH Monitor" with a manual trigger
Execute workflow abc123
Search templates for monitoring
Deploy template abc123 as "My Monitor"
Search protocol actions for aave
Execute protocol action {"actionType":"aave/get-user-account-data","params":{"network":"1","user":"0x..."}}
List my integrations
What web3 plugins are available in KeeperHub?
Generate a workflow that monitors USDC transfers over $10k and sends a Discord alert
Show KeeperHub documentation
```

## Actions

| Action | Description |
|--------|-------------|
| `LIST_WORKFLOWS` | List all workflows in the org |
| `GET_WORKFLOW` | Get workflow details by ID |
| `CREATE_WORKFLOW` | Create a new workflow |
| `UPDATE_WORKFLOW` | Update an existing workflow |
| `DELETE_WORKFLOW` | Permanently delete a workflow |
| `EXECUTE_WORKFLOW` | Manually trigger a workflow |
| `SEARCH_ORG_WORKFLOWS` | Search workflows by name/description |
| `GET_EXECUTION_STATUS` | Check workflow execution status |
| `GET_EXECUTION_LOGS` | Get step-by-step execution logs |
| `SEARCH_TEMPLATES` | Browse pre-built workflow templates |
| `GET_TEMPLATE` | Get template details |
| `DEPLOY_TEMPLATE` | Clone a template into your org |
| `SEARCH_PLUGINS` | List available action schemas by category |
| `GET_PLUGIN` | Get plugin/integration schema |
| `LIST_ACTION_SCHEMAS` | List all available actions and chains |
| `LIST_INTEGRATIONS` | List configured integrations |
| `GET_WALLET_INTEGRATION` | Get wallet integration details |
| `SEARCH_PROTOCOL_ACTIONS` | Search DeFi protocol actions |
| `EXECUTE_PROTOCOL_ACTION` | Execute a protocol action (read) |
| `EXECUTE_TRANSFER` | Transfer tokens via wallet |
| `EXECUTE_CONTRACT_CALL` | Call a smart contract function |
| `EXECUTE_CHECK_AND_EXECUTE` | Conditional on-chain execution |
| `GET_DIRECT_EXECUTION_STATUS` | Check direct execution status |
| `SEARCH_WORKFLOWS_MARKETPLACE` | Search public marketplace workflows |
| `CALL_WORKFLOW` | Invoke a listed marketplace workflow |
| `AI_GENERATE_WORKFLOW` | Generate workflow from description |
| `TOOLS_DOCUMENTATION` | Get KeeperHub MCP documentation |

## License

MIT
