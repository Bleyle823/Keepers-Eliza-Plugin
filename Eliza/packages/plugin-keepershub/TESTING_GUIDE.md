# plugin-keeperhub — Comprehensive Testing Guide

This guide covers every action in the plugin, including exact prompts to use in the ElizaOS chat, what to prepare in KeeperHub first, what each action does internally, and what a successful response looks like. Follow the sections in order — later sections depend on IDs collected in earlier ones.

---

## Prerequisites

### 1. Environment
```env
KH_API_KEY=kh_your_key_here
```
Set this in your `.env` file or as a Windows user environment variable, then restart your agent.

### 2. Confirm the plugin is loaded
When the agent starts, you should see in the console:
```
[KeeperHub] MCP session established
```
If you see `KH_API_KEY is not configured`, the key is missing or not being picked up.

### 3. KeeperHub account setup
Log in to [app.keeperhub.com](https://app.keeperhub.com) and have the following ready:
- At least one **wallet integration** (Avatar → Integrations → Add wallet). You need the integration ID for write actions.
- A testnet wallet is strongly recommended for all on-chain write tests.

---

## ID Reference Sheet

Copy this and fill it in as you work through the guide:

```
WORKFLOW_ID_1=        (from CREATE_WORKFLOW)
WORKFLOW_ID_2=        (from DEPLOY_TEMPLATE, for destructive tests)
EXECUTION_ID=         (from EXECUTE_WORKFLOW)
TEMPLATE_ID=          (from SEARCH_TEMPLATES)
INTEGRATION_ID=       (from LIST_INTEGRATIONS)
MARKETPLACE_SLUG=     (from SEARCH_WORKFLOWS_MARKETPLACE)
DIRECT_EXEC_ID=       (from EXECUTE_TRANSFER or EXECUTE_CONTRACT_CALL)
```

---

## Group 1 — Read-Only Discovery (no setup needed)

These actions make no changes and are safe to run any time.

---

### 1. `LIST_WORKFLOWS`

**What it does:** Fetches all workflows in your organization and formats them as a numbered list.

**Prompt:**
```
List all my KeeperHub workflows
```

**Also works with:**
```
show workflows
get workflows
```

**Expected response:**
```
Found 2 workflow(s):

1. **Aave Guardian** (ID: `abc123`) — enabled
2. **ETH Filler** (ID: `def456`) — disabled
```

**If no workflows exist:**
```
No workflows found in your KeeperHub organization.
```

**Note down** one workflow ID from the response — you'll use it for `GET_WORKFLOW`, `EXECUTE_WORKFLOW`, `UPDATE_WORKFLOW`, and `DELETE_WORKFLOW`.

---

### 2. `SEARCH_ORG_WORKFLOWS`

**What it does:** Lists all workflows then filters client-side by a search term.

**Prompt:**
```
Search my workflows aave
```

**Also works with:**
```
Find workflows monitor
```

**Expected response:**
```
Found 1 workflow(s) matching "aave":

1. **Aave Guardian** (ID: `abc123`) — monitors health factor
```

**Edge case — no match:**
```
Search my workflows xyz_nonexistent
```
→ `No workflows found matching "xyz_nonexistent".`

---

### 3. `LIST_ACTION_SCHEMAS`

**What it does:** Calls `list_action_schemas` on KeeperHub MCP and returns all available workflow node types plus supported blockchain networks.

**Prompt:**
```
List all available KeeperHub action schemas
```

**Expected response format:**
```
**Available action schemas (14):**

- `web3/check-balance` — Get Native Token Balance
- `web3/send-native-token` — Send Native Token
- `discord/send-message` — Send Discord Message
...

**Supported chains (8):**
- Ethereum (chainId: 1)
- Base (chainId: 8453)
- Polygon (chainId: 137) [testnet]
...
```

**Useful shortcut — filter by category:**
```
List action schemas web3
```
```
List action schemas discord
```

---

### 4. `SEARCH_PLUGINS`

**What it does:** Lists available plugins filtered by category (`web3`, `discord`, `sendgrid`, `system`, `triggers`).

**Prompts to try:**
```
What web3 plugins are available in KeeperHub?
```
```
What discord plugins are available in KeeperHub?
```
```
What sendgrid plugins are available?
```

**Expected response:**
```
**Available web3 plugins (14):**

- `web3/check-balance` — Get Native Token Balance
- `web3/erc20-transfer` — ERC20 Transfer
...
```

---

### 5. `GET_PLUGIN`

**What it does:** Returns the full JSON schema for a specific plugin type, showing all available parameters and their types.

**Prompt:**
```
Get plugin schema for discord
```
```
Get plugin schema for web3
```

**Expected response:**
```
**Plugin Schema: discord**

```json
{
  "send-message": {
    "label": "Send Discord Message",
    "params": { ... }
  }
}
```
```

---

### 6. `SEARCH_TEMPLATES`

**What it does:** Searches KeeperHub's public template library.

**Prompts to try:**
```
Search templates for monitoring
```
```
Browse templates
```
```
Find templates wallet
```

**Expected response:**
```
Found 5 template(s):

1. **Wallet ETH Filler** (ID: `tmpl_abc`) — Fills a wallet with ETH...
2. **Aave Health Monitor** (ID: `tmpl_def`) — Monitors Aave health...
...

Use "get template <id>" for full details, or "deploy template <id>" to clone one.
```

**Note down** a template ID for `GET_TEMPLATE` and `DEPLOY_TEMPLATE`.

---

### 7. `GET_TEMPLATE`

**What it does:** Fetches the full workflow definition (nodes, edges, description) for one template.

**Prompt** (replace `tmpl_abc` with a real ID from step 6):
```
Get template tmpl_abc
```

**Expected response:**
```
**Template: Wallet ETH Filler**
ID: `tmpl_abc`
Description: Automatically fills a wallet when ETH drops below threshold
Nodes: 4

Use "deploy template tmpl_abc" to clone this template into your org.
```

**Error case — bad ID:**
```
Get template nonexistent_id_xyz
```
→ `KeeperHub tool error (get_template): ...`

---

### 8. `LIST_INTEGRATIONS`

**What it does:** Lists all configured integrations (wallets, Discord webhooks, etc.) in your org.

**Prompt:**
```
Show my KeeperHub integrations
```

**Expected response:**
```
Found 1 integration(s):

1. **0xf8e6...** (type: `web3`, ID: `vq09103mu`)
```

**If none configured:**
```
No integrations configured in your KeeperHub organization.
```

**Note down** the integration ID — required for `GET_WALLET_INTEGRATION` and all write actions.

---

### 9. `GET_WALLET_INTEGRATION`

**What it does:** Returns details for one wallet integration including the on-chain address.

**Prompt** (replace `vq09103mu` with your real integration ID):
```
Get wallet integration vq09103mu
```

**Expected response:**
```
**Wallet Integration: 0xf8e6...**
ID: `vq09103mu`
Type: web3
Address: `0xf8e6...`
Created: 2024-01-15T10:00:00Z
```

---

### 10. `SEARCH_PROTOCOL_ACTIONS`

**What it does:** Searches KeeperHub's library of DeFi protocol actions (Aave, Chainlink, Morpho, etc.).

**Prompts to try:**
```
Search protocol actions for aave
```
```
Find protocol actions chainlink price
```
```
Search protocol actions morpho
```

**Expected response:**
```
**Protocol Actions (3):**

- `aave/get-user-account-data` — Get overall account health [read-only]
- `aave/get-reserve-data` — Get reserve/asset details [read-only]
- `aave/supply` — Supply assets to Aave [requires wallet]
```

**Note** the `actionType` strings — you need them for `EXECUTE_PROTOCOL_ACTION`.

---

### 11. `SEARCH_WORKFLOWS_MARKETPLACE`

**What it does:** Searches KeeperHub's public marketplace of callable workflows (listed by other users/orgs).

**Prompts to try:**
```
Search marketplace workflows
```
```
Search public workflows defi
```
```
Search marketplace workflows aave
```

**Expected response:**
```
**Marketplace Workflows (2):**

1. **Aave Health Checker** (`aave-health-check`) — free
   Returns the Aave health factor for a given address

2. **ETH Price Feed** (`eth-price-usd`) — $0.01 USDC/call
   Returns the current ETH/USD price from Chainlink

Use "call workflow <slug>" to invoke one.
```

**Note down** a `slug` for `CALL_WORKFLOW`.

---

### 12. `TOOLS_DOCUMENTATION`

**What it does:** Returns the full KeeperHub MCP documentation including workflow creation guide, node type reference, and chain ID list.

**Prompt:**
```
Show KeeperHub documentation
```

**Expected response:** A long markdown document covering all workflow node types, the `op` command format, supported chains, and usage tips.

---

## Group 2 — Workflow Lifecycle (creates real data)

These actions create, modify, and delete workflows. Run them in order.

---

### 13. `CREATE_WORKFLOW`

**What to set up in KeeperHub:** Nothing — this creates from scratch.

**What the handler does:** Parses a `name` from the text (using `"called "name""` pattern or a JSON body), along with `nodes`, `edges`, and `description`.

**Simplest test — name only:**
```
Create a workflow called "Test Plugin Workflow"
```
This sends `{ name: "Test Plugin Workflow", nodes: [], edges: [] }` — creates a valid but empty workflow.

**Full test with a manual trigger node:**
```
Create workflow ```json
{
  "name": "Plugin Test Workflow",
  "description": "Created by plugin test",
  "nodes": [
    {
      "id": "trigger-1",
      "type": "trigger",
      "data": { "type": "manual" }
    }
  ],
  "edges": []
}
```
```

**Expected response:**
```
Workflow created successfully!

**Name:** Plugin Test Workflow
**ID:** `abc123xyz`
**Enabled:** false
```

**Note down** the new workflow ID as `WORKFLOW_ID_1`.

---

### 14. `GET_WORKFLOW`

**Prompt** (use your `WORKFLOW_ID_1`):
```
Get workflow WORKFLOW_ID_1
```

**Expected response:**
```
**Workflow: Plugin Test Workflow**
ID: `abc123xyz`
Enabled: false
Nodes: 1

```json
{
  "id": "abc123xyz",
  "name": "Plugin Test Workflow",
  "nodes": [...],
  "edges": [...],
  ...
}
```
```

**Error case — wrong ID:**
```
Get workflow id: nonexistent999
```
→ `KeeperHub tool error (get_workflow): ...`

---

### 15. `UPDATE_WORKFLOW`

**What it does:** Sends a PATCH update to the workflow. Only fields present in the JSON are updated.

**Prompt** (use your `WORKFLOW_ID_1`):
```
Update workflow ```json
{
  "workflowId": "WORKFLOW_ID_1",
  "name": "Plugin Test Workflow (Updated)"
}
```
```

**Expected response:**
```
Workflow updated successfully!

**Name:** Plugin Test Workflow (Updated)
**ID:** `abc123xyz`
```

**Verify the change** with `Get workflow WORKFLOW_ID_1`.

---

### 16. `EXECUTE_WORKFLOW`

**KeeperHub setup required:** The workflow needs a **manual trigger** node to be executable. If your test workflow has one, you can run it. Workflows without triggers will return an error from KeeperHub.

**What to set in the workflow:**
- Add a trigger node of type `manual` (available under Triggers in the workflow editor)
- The workflow does not need to be enabled to execute manually via the API

**Prompt** (use your `WORKFLOW_ID_1`):
```
Run workflow WORKFLOW_ID_1
```

**With input data:**
```
Execute workflow ```json
{
  "workflowId": "WORKFLOW_ID_1",
  "input": { "testParam": "hello" }
}
```
```

**Expected response:**
```
Workflow execution started!

**Execution ID:** `exec_abc123`

Use "get execution status exec_abc123" to check progress.
```

**Note down** the execution ID as `EXECUTION_ID`.

---

### 17. `GET_EXECUTION_STATUS`

**Prompt** (use your `EXECUTION_ID`):
```
Get execution status EXECUTION_ID
```

**Expected response:**
```
**Execution ID:** `exec_abc123`
**Status:** completed
**Started:** 2024-01-15T10:00:00Z
**Completed:** 2024-01-15T10:00:05Z
```

**Status values to expect:**
- `pending` — queued but not started
- `running` — currently executing
- `completed` — finished successfully
- `failed` — finished with error

**Poll until complete:**
```
Check execution status exec_abc123
```

---

### 18. `GET_EXECUTION_LOGS`

**Prompt** (use your `EXECUTION_ID`):
```
Get logs for execution EXECUTION_ID
```

**Expected response:**
```
**Execution Logs for `exec_abc123`:**

```json
[
  {
    "nodeId": "trigger-1",
    "status": "completed",
    "output": { ... },
    "startedAt": "2024-01-15T10:00:00Z"
  }
]
```
```

---

## Group 3 — Template Deployment

### 19. `DEPLOY_TEMPLATE`

**What it does:** Clones a public template into your org as a new workflow. The new workflow is **disabled by default** — you must manually enable it in the KeeperHub UI before it runs on schedule.

**What NOT to do:** Don't enable it immediately after deploying if it contains wallet actions — review the nodes first.

**Prompt** (use a `TEMPLATE_ID` from step 6):
```
Deploy template TEMPLATE_ID as "My Test Clone"
```

**Expected response:**
```
Template deployed as new workflow!

**Name:** My Test Clone
**ID:** `new_wf_xyz`

The workflow is disabled by default. Enable it when ready.
```

**Note down** this new workflow ID as `WORKFLOW_ID_2` — use it for `DELETE_WORKFLOW` cleanup.

---

## Group 4 — Protocol Actions (DeFi reads, no wallet needed)

### 20. `EXECUTE_PROTOCOL_ACTION`

These call live on-chain data. **No wallet or integration is needed for read-only actions.** Use any real Ethereum mainnet address.

**Network IDs reference:**
| Chain | ID |
|-------|----|
| Ethereum mainnet | `1` |
| Base | `8453` |
| Polygon | `137` |
| Arbitrum | `42161` |
| Sepolia (testnet) | `11155111` |

**Test A — Aave health factor** (read-only):
```
Execute protocol action {"actionType":"aave/get-user-account-data","params":{"network":"1","user":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"}}
```

**Expected response:**
```
**Protocol Action: `aave/get-user-account-data`**

Result:
```json
{
  "totalCollateralBase": "...",
  "totalDebtBase": "...",
  "healthFactor": "..."
}
```
```

**Test B — Chainlink ETH/USD price** (read-only):
```
Execute protocol action {"actionType":"chainlink/get-price","params":{"network":"1","feedAddress":"0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"}}
```

**Test C — Check an ERC20 balance** (read-only):
```
Execute protocol action {"actionType":"web3/erc20-balance","params":{"network":"1","tokenAddress":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","walletAddress":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"}}
```

**What NOT to pass:** Don't pass `walletIntegrationId` for read-only actions — it's only needed for write actions (`aave/supply`, `aave/borrow`, etc.).

---

## Group 5 — Marketplace Workflows

### 21. `CALL_WORKFLOW`

**Prompt** (use a slug from step 11):
```
Call workflow {"slug":"MARKETPLACE_SLUG","inputs":{}}
```

**With inputs** (check the workflow's inputSchema from `SEARCH_WORKFLOWS_MARKETPLACE`):
```
Call workflow {"slug":"aave-health-check","inputs":{"address":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045","network":"1"}}
```

**Expected response:**
```
**Workflow `aave-health-check` result:**

```json
{
  "healthFactor": "2.45",
  "totalCollateral": "..."
}
```
```

---

## Group 6 — AI Generation

### 22. `AI_GENERATE_WORKFLOW`

**What it does:** Sends your description to KeeperHub's AI and gets back a workflow definition in the `op` command format. It does **not** save the workflow — you must then use `CREATE_WORKFLOW` with the generated nodes/edges.

**Prompts to try:**
```
Generate a workflow that monitors an Aave health factor below 1.5 and sends a Discord alert
```
```
Generate a workflow that checks USDC balance every hour and sends an email if below 100
```
```
AI generate a workflow for Chainlink ETH price monitoring
```

**Expected response:**
```
**AI Generated Workflow Definition:**

```
{"op":"addNode","type":"trigger",...}
{"op":"addNode","type":"web3/check-balance",...}
{"op":"addEdge",...}
```

Review the definition above, then use "create workflow" with the assembled nodes and edges to save it.
```

**What to do after:** Copy the generated definition and feed it into `CREATE_WORKFLOW` with the `nodes` and `edges` extracted from the output.

---

## Group 7 — On-Chain Write Actions ⚠️

**READ BEFORE TESTING:**
- These submit **real transactions** to the blockchain.
- Always test on a **testnet first** (Sepolia, Base Sepolia, Mumbai).
- Your KeeperHub wallet integration must have funds for the test network.
- KeeperHub charges gas from the wallet configured in your integration.

**KeeperHub setup required for ALL write actions:**
1. Go to [app.keeperhub.com](https://app.keeperhub.com) → Integrations
2. Add a wallet integration (web3 type)
3. Fund the wallet on your chosen testnet with native token (for gas)
4. Copy the integration ID (you need it for the API; it's different from the wallet address)

**Note:** `execute_transfer`, `execute_contract_call` (write), and `execute_check_and_execute` all require a wallet integration to be set up in your KeeperHub org. The plugin sends the request to KeeperHub which then executes using that wallet.

---

### 23. `EXECUTE_CONTRACT_CALL` (read mode — safe)

Test the read-only path first. Calling a `view` function doesn't need a wallet.

**Test — WETH `totalSupply` on mainnet** (verified contract, no wallet needed):
```
Execute contract call {"contract_address":"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2","network":"1","function_name":"totalSupply"}
```

**Expected response:**
```
**Contract Call: `totalSupply`**
Contract: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`
Network: 1

Result:
```json
"3141592653589793238"
```
```

**Test — with function arguments** (`balanceOf` for an address):
```
Execute contract call {"contract_address":"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2","network":"1","function_name":"balanceOf","function_args":"[\"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045\"]"}
```

**Known error — unverified contracts:** If you call a contract that isn't verified on Etherscan, you'll get:
```
KeeperHub tool error (execute_contract_call): ABI is required. Could not auto-fetch ABI...
```
Fix: Either use a verified contract, or pass the `abi` parameter manually as a JSON string.

---

### 24. `EXECUTE_TRANSFER` ⚠️ (sends real transaction)

**KeeperHub setup:** Wallet integration with testnet funds required.

**Testnet test — send 0.00001 Sepolia ETH to yourself:**
```
Execute transfer {"network":"11155111","recipient_address":"YOUR_OWN_ADDRESS","amount":"0.00001"}
```

**ERC20 transfer** (pass `token_address`):
```
Execute transfer {"network":"11155111","recipient_address":"YOUR_OWN_ADDRESS","amount":"1","token_address":"0xERC20_CONTRACT_ADDRESS"}
```

**Expected response:**
```
**Transfer submitted!**
Recipient: `0xYOUR_ADDRESS`
Amount: 0.00001
Execution ID: `exec_transfer_abc`
```

**Note down** the execution ID as `DIRECT_EXEC_ID`.

---

### 25. `GET_DIRECT_EXECUTION_STATUS`

**Prompt** (use your `DIRECT_EXEC_ID`):
```
Get direct execution status DIRECT_EXEC_ID
```

**Expected response:**
```
**Direct Execution: `exec_transfer_abc`**
Status: completed
TX Hash: `0x...`
```

**Status values:**
- `pending` — submitted, waiting for network
- `submitted` — broadcast to chain
- `confirmed` — mined
- `completed` — fully confirmed
- `failed` — reverted or rejected

---

### 26. `EXECUTE_CHECK_AND_EXECUTE` ⚠️ (conditional on-chain action)

**What it does:** Read a value from a contract → evaluate a condition → if condition is true, execute a transaction. Useful for "top up wallet if balance drops below X" patterns.

**KeeperHub setup:** Wallet integration required.

**Test prompt — check WETH balance, execute if > 0:**
```
Execute check and execute {"contract_address":"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2","network":"1","function_name":"balanceOf","function_args":"[\"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045\"]","condition":{"operator":"gt","value":"0"},"action":{"contract_address":"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2","function_name":"totalSupply"}}
```

**Condition operators:**
| Operator | Meaning |
|----------|---------|
| `gt` | greater than |
| `lt` | less than |
| `gte` | greater than or equal |
| `lte` | less than or equal |
| `eq` | equal |
| `ne` | not equal |

**Expected response:**
```
**Check-and-Execute submitted!**
Execution ID: `exec_cne_abc`
Condition met: true
```

---

## Group 8 — Cleanup (delete test data)

### 27. `DELETE_WORKFLOW`

**⚠️ Irreversible — permanently deletes the workflow.**

**Delete the deployed template clone** (use `WORKFLOW_ID_2`):
```
Delete workflow WORKFLOW_ID_2
```

**Delete the originally created test workflow** (use `WORKFLOW_ID_1`):
```
Delete workflow WORKFLOW_ID_1
```

**Expected response:**
```
Workflow `abc123xyz` has been permanently deleted.
```

**Error case — trying to delete an already-deleted workflow:**
```
KeeperHub tool error (delete_workflow): Workflow not found
```

---

## Error Reference

| Error message | Cause | Fix |
|---------------|-------|-----|
| `KeeperHubService is not running` | Plugin not loaded | Ensure `keeperhubPlugin` is in your agent's `plugins` array |
| `KH_API_KEY is not configured` | Missing env var | Set `KH_API_KEY` in `.env` and restart |
| `KeeperHub MCP error (401)` | Invalid or expired API key | Regenerate your API key in KeeperHub |
| `KeeperHub tool error: Workflow not found` | Bad workflow ID for an org-owned workflow | Use `LIST_WORKFLOWS` to get valid IDs |
| `KeeperHub workflow ... was not found in the marketplace` | Slug isn't a published `listedSlug` | Run `SEARCH_WORKFLOWS_MARKETPLACE` to find valid slugs, or use `EXECUTE_WORKFLOW` with an org workflow id. The `CALL_WORKFLOW` action will auto-fall back to `EXECUTE_WORKFLOW` if the value looks like a 16+ char alphanumeric workflow id. |
| `ABI is required. Could not auto-fetch ABI` | Unverified contract | Use a verified contract or pass `abi` field manually |
| `Missing workflowId` | Agent couldn't parse the ID | Use exact format: `workflowId: clr1k2j3a0001x9pq7e2v3w4f` (or any of `workflowId=`, `workflow `cuid``, or include `"workflowId"` in JSON). The parser deliberately rejects English-word matches like `now`/`please`/`today` to avoid sending garbage IDs upstream. |
| `MCP server does not exist` | Cursor MCP config issue | Not a plugin error; check `~/.cursor/mcp.json` |
| `KeeperHub initialize failed (500)` | Transient server error | Retry; if persistent, check KeeperHub status page |

### Action result shape (for agent / log inspection)

Every failure now returns a fully JSON-safe `ActionResult`:

```json
{
  "success": false,
  "text": "KeeperHub error: Workflow not found",
  "error": "Workflow not found",
  "data": {
    "tool": "execute_workflow",
    "args": { "workflowId": "..." },
    "stage": "tool_call",
    "errorMessage": "Workflow not found"
  }
}
```

If you ever see a result like `{ "success": false, "error": {} }`, that's an
`Error` object that lost its `message`/`stack` during JSON serialization (those
properties are non-enumerable). The plugin no longer produces this shape — all
write actions (`EXECUTE_WORKFLOW`, `CREATE_WORKFLOW`, `UPDATE_WORKFLOW`,
`DELETE_WORKFLOW`, `EXECUTE_TRANSFER`, `EXECUTE_CONTRACT_CALL`,
`EXECUTE_CHECK_AND_EXECUTE`, `EXECUTE_PROTOCOL_ACTION`, `DEPLOY_TEMPLATE`,
`AI_GENERATE_WORKFLOW`, `CALL_WORKFLOW`, etc.) consistently return `error` as
a string. If you do see an empty error object in logs, that's a regression and
should be reported.

---

## Testing Order Summary

For a complete regression run, follow this sequence:

```
1.  List all my KeeperHub workflows
2.  Search my workflows [some term]
3.  List all available KeeperHub action schemas
4.  What web3 plugins are available in KeeperHub?
5.  Get plugin schema for discord
6.  Search templates for monitoring
7.  Get template [ID from step 6]
8.  Show my KeeperHub integrations
9.  Get wallet integration [ID from step 8]
10. Search protocol actions for aave
11. Execute protocol action {"actionType":"aave/get-user-account-data","params":{"network":"1","user":"0xd8dA..."}}
12. Search marketplace workflows
13. Call workflow {"slug":"[slug from step 12]","inputs":{}}
14. Show KeeperHub documentation
15. Create workflow called "Test Plugin Workflow"           ← saves WORKFLOW_ID_1
16. Get workflow [WORKFLOW_ID_1]
17. Update workflow {"workflowId":"[WORKFLOW_ID_1]","name":"Updated Test Workflow"}
18. Run workflow [WORKFLOW_ID_1]                             ← saves EXECUTION_ID
19. Get execution status [EXECUTION_ID]
20. Get logs for execution [EXECUTION_ID]
21. Deploy template [TEMPLATE_ID] as "Test Clone"           ← saves WORKFLOW_ID_2
22. Generate a workflow that monitors Aave health below 1.5 and sends Discord alert
23. Execute contract call {"contract_address":"0xC02a...","network":"1","function_name":"totalSupply"}
24. [TESTNET ONLY] Execute transfer {"network":"11155111","recipient_address":"0x...","amount":"0.00001"}
25. [TESTNET ONLY] Get direct execution status [DIRECT_EXEC_ID]
26. Delete workflow [WORKFLOW_ID_2]
27. Delete workflow [WORKFLOW_ID_1]
```

Steps 24–25 require a funded testnet wallet integration in KeeperHub. Steps 1–23 and 26–27 are safe to run on mainnet (reads only, or deleting test workflows you created).
