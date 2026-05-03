<div align="center">
  <h1>Keepers Eliza Plugin</h1>
  <p><strong>ElizaOS monorepo shipping the KeeperHub Eliza plugin — plus OpenClaw and Hermes plugin <em>sources</em></strong></p>
  <p>Use <a href="https://app.keeperhub.com">KeeperHub</a> from agents via MCP. The <strong>Eliza</strong> integration is what this repo is built to run; OpenClaw and Hermes plugins are maintained here for you to install into <strong>their own</strong> projects.</p>
</div>

<div align="center">
  <a href="https://github.com/Bleyle823/Keepers-Eliza-Plugin/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Bleyle823/Keepers-Eliza-Plugin?style=for-the-badge" alt="License"></a>
  <a href="https://docs.elizaos.ai/"><img src="https://img.shields.io/badge/ElizaOS-Docs-blue?style=for-the-badge" alt="ElizaOS Documentation"></a>
  <a href="https://docs.openclaw.ai/"><img src="https://img.shields.io/badge/OpenClaw-Docs-purple?style=for-the-badge" alt="OpenClaw Documentation"></a>
</div>

---

## What this repository is

This project is an **[ElizaOS](https://github.com/elizaos/eliza)-based monorepo** that includes **KeeperHub** integrations for three agent ecosystems. Those integrations share the same MCP behaviour, but they **do not all run inside this Eliza setup**.

### Where each piece is meant to run

| What | Paths in this repo | Where you actually use it |
| --- | --- | --- |
| **KeeperHub + ElizaOS** | [`packages/plugin-keepershub`](packages/plugin-keepershub) | **Here.** This monorepo’s normal `bun install` / `elizaos` / agent workflow. Package name: **`@elizaos/plugin-keeperhub`**. |
| **KeeperHub + OpenClaw** | [`openclaw-plugins/keepershub`](openclaw-plugins/keepershub) | **Your OpenClaw project / machine** — Gateway, CLI config, and OpenClaw docs apply. Copy or clone these files **out of this repo** (or reference a path after clone) and install with OpenClaw’s plugin commands from **that environment**. Nothing in this Eliza stack loads OpenClaw plugins. |
| **KeeperHub + Hermes** | [`hermes-plugins/keepershub`](hermes-plugins/keepershub) | **Your Hermes Agent setup** — Hermes plugins directory, virtualenv, TUI/Telegram, etc. Copy or symlink this folder into **`~/.hermes/plugins/`** (or equivalent) on the host where Hermes runs. Do **not** expect Bun/Eliza in this repo to run Hermes. |

**Summary:** Treat `openclaw-plugins/` and `hermes-plugins/` as **standalone plugin sources** bundled in this repo for distribution and versioning. Only **`@elizaos/plugin-keeperhub`** is first-class inside this ElizaOS monorepo.

### Capability overview

| Surface | Purpose |
| --- | --- |
| **ElizaOS** | KeeperHub MCP as **Eliza actions** + service + context provider |
| **OpenClaw** | **`openclaw-keepershub`** — **28 typed `kh_*` tools** (TypeBox), Gateway-friendly |
| **Hermes** | Python plugin — **28 `kh_*` tools** aligned with OpenClaw (TUI / Telegram / other Hermes channels) |

All three talk to KeeperHub over **HTTPS MCP** at `https://app.keeperhub.com/mcp` using an organisation API key (`kh_…`).

### Try the plugins (hosted demos)

These links are an **easy on-ramp** to see each integration in action—no local install required for a first chat or click-through.

| Surface | Try it |
| --- | --- |
| **Eliza** (web client) | [ElizaOS client on Phala dstack](https://59ac278dbb08744b118f4f9c382ade7cfd0f508e-3000.dstack-pha-prod5.phala.network/) |
| **Hermes** (Telegram) | [@keeperhermes2_bot](https://t.me/keeperhermes2_bot) |
| **OpenClaw** (Telegram) | [@keeperHub2_bot](https://t.me/keeperHub2_bot) (**Keeps**) |

**Personalised or production use** (your org, API keys, characters, Gateway, and infra) still means **setting up your own** Eliza, Hermes, or OpenClaw stack using the integration sections below—you cannot rely on shared demo hosts for customised workflows, credentials, or uptime.

---

## Features (KeeperHub)

- **Workflows** — list, create, update, delete, execute, search; AI-assisted generation where supported
- **Execution** — status and logs for workflow runs
- **Templates** — search, inspect, deploy into your org
- **DeFi & protocols** — discover and run protocol-oriented actions (e.g. Aave, Chainlink, Morpho, Uniswap, and others supported by KeeperHub)
- **Direct on-chain** — transfers, contract calls, conditional flows via configured wallet integrations
- **Marketplace** — search and invoke listed workflows (with sensible org fallbacks where applicable)
- **Integrations & schemas** — list integrations, wallet details, and action/plugin metadata

Detailed tool and action tables live in each plugin’s README (linked below).

---

## Case study: salary distribution on Base Sepolia from Eliza

![KeeperHub visual workflow — scheduled trigger, five parallel transfers, and notification](./docs/readme/keeperhub-salary-workflow-base-sepolia.png)

This example shows a **[KeeperHub](https://app.keeperhub.com) workflow** used together with **`@elizaos/plugin-keeperhub`**. The automation was designed in KeeperHub’s node editor: a **scheduled trigger** (runs at the start of each month) fans out into **five parallel native transfers**—one per contractor—and finishes with **Send Notification** once distribution completes. The **Runs** pane records each step so you get timing and outcomes without touching an explorer until you want receipts.

Five successful **Base Sepolia** transfers from that pattern are visible on [BaseScan Sepolia](https://sepolia.basescan.org/), for example:

| Transfer | Explorer |
| --- | --- |
| 1 | [Transaction `0xd289…fee8c`](https://sepolia.basescan.org/tx/0xd289ee29ef350fd3d30c0d180bb25b615b5b3f2b67783b60e8bb4702073fee8c) |
| 2 | [Transaction `0x037e…c2a7`](https://sepolia.basescan.org/tx/0x037efa2d26cc1c392bffc333a5b5cae0e9040aa2c9bd0bda0cbfade1c437c2a7) |
| 3 | [Transaction `0xce42…31e9`](https://sepolia.basescan.org/tx/0xce4296f4d46b07de59f7292c0186a3f7165c3d347f43f279980ab78cbc5f31e9) |
| 4 | [Transaction `0xe6f1…b1b7`](https://sepolia.basescan.org/tx/0xe6f1964e15f89988abbb37b075c1fde68ba027ec70a3184b335bf0f6f727b1b7) |
| 5 | [Transaction `0x1332…4bb`](https://sepolia.basescan.org/tx/0x133228870b4e001771bf7ab3e8908bf64a69a1fa7c4514ec760b6271a26d24bb) |

**Where Eliza fits.** You keep design, scheduling, and custody in KeeperHub (visual graph, organisation wallet integration, execution logs). From chat, Eliza invokes **KeeperHub actions**: list workflows, inspect runs, trigger execution when needed, and troubleshoot—instead of owning raw RPC wiring, nonce management across parallel sends, retries, or bespoke scripts for each payout lane.

**Why not “plain Eliza”?** Delivering five concurrent testnet payouts on a cadence—with verified hashes, sane error handling, and reproducible orchestration—is slow and brittle if you bolt **EVM wallets, multicall choreography, receipt polling, and human-readable status** entirely into Eliza prompts and custom code. The plugin routes that surface area through **KeeperHub’s MCP-backed workflow engine**, so the agent stays in natural language while execution stays deterministic and observable.

---

## Repository layout

```
├── packages/
│   └── plugin-keepershub/     # @elizaos/plugin-keeperhub — USE WITH ELIZA (this repo / NPM)
├── openclaw-plugins/
│   └── keepershub/            # SOURCE: copy/install into YOUR OpenClaw project
├── hermes-plugins/
│   └── keepershub/            # SOURCE: copy/install into YOUR Hermes plugins path
├── index.ts                   # Optional sample “Keeper” character wiring the Eliza plugin (repo root)
├── docker-compose.phala.yaml  # Optional Phala-oriented compose (see file comments)
└── scripts/
    └── deploy-phala.ps1       # Example Phala deploy helper (PowerShell)
```

The rest of `packages/` is standard ElizaOS platform code (CLI, server, client, core, etc.). Upstream behaviour is documented at [docs.elizaos.ai](https://docs.elizaos.ai/).

---

## Prerequisites

**This monorepo (Eliza + `@elizaos/plugin-keeperhub`):**

- **[Bun](https://bun.sh/docs/installation)** (this repo pins a `packageManager`; see root `package.json`)
- **Node.js** compatible with the version in root `package.json` `engines` (currently **23.x**)

**Elsewhere — not fulfilled by `bun install` here:**

- **OpenClaw:** an OpenClaw Gateway/CLI installation and project/config as described in [OpenClaw documentation](https://docs.openclaw.ai/). Install the KeeperHub plugin **from those instructions and paths**, using the **`openclaw-plugins/keepershub`** sources from this repository.
- **Hermes:** Hermes Agent, Python **3.9+** (check your Hermes version), and a plugins directory — see [`hermes-plugins/keepershub/README.md`](hermes-plugins/keepershub/README.md).

> **Windows:** Upstream ElizaOS often recommends **WSL 2** for the full CLI/dev experience. Native Windows may work for parts of the stack; use WSL if you hit tooling issues.

---

## Developers: clone and run the monorepo

From the repository root:

```bash
git clone https://github.com/Bleyle823/Keepers-Eliza-Plugin.git
cd Keepers-Eliza-Plugin

bun install
bun run build
```

Useful commands:

```bash
# Run tests (Turbo; excludes some heavy starters per root script)
bun run test

# Focus tests on the KeeperHub Eliza package
cd packages/plugin-keepershub && bun test && cd ../..

# Format / lint (as configured in the monorepo)
bun run format
bun run lint
```

KeeperHub Eliza plugin developer notes and manual test ideas: [`packages/plugin-keepershub/TESTING_GUIDE.md`](packages/plugin-keepershub/TESTING_GUIDE.md).

Developing the OpenClaw or Hermes plugins (TypeScript build / `pytest`) is optional; run those tooling commands **inside the copied plugin directory** when you iterate, or wire them into CI in a checkout of this repo. Day-to-day **OpenClaw** and **Hermes** operators should still configure plugins in **their** OpenClaw and Hermes projects as described below.

---

## KeeperHub API key

Create an organisation API key in the KeeperHub app: [app.keeperhub.com](https://app.keeperhub.com) → **Avatar → API Keys → Organisation → New API Key**.

Set one of (the Eliza plugin and both portable plugins accept these names in their respective environments):

```env
KH_API_KEY=kh_your_key_here
# aliases also supported:
# KEEPERHUB_API_KEY=...
# KEEPERSHUB_API_KEY=...
```

Never commit real keys. Use `.env` / your host’s secret store. Root `.gitignore` excludes `.env` and similar patterns.

---

## Integrating the ElizaOS plugin (`@elizaos/plugin-keeperhub`)

**Use this path if you run agents from this repo (or consume the package on NPM):** `@elizaos/plugin-keeperhub` is the **only** KeeperHub plugin intended to plug into Eliza inside this ElizaOS monorepo. OpenClaw and Hermes sources are unrelated to `elizaos start` unless you deliberately write custom bridging code (not shipped here).

**1. Workspace / path dependency (this repo)**

The package already lives at `packages/plugin-keepershub`. In another package or app in the same workspace, depend on it via `workspace:*` or your monorepo’s linking rules.

**2. Published NPM (consumers outside this repo)**

```bash
bun add @elizaos/plugin-keeperhub
```

**3. Register the plugin and secrets**

- Add **`KH_API_KEY`** to the agent environment (or your deployment secrets manager).
- Register the plugin on your agent runtime / character `plugins` array.

Minimal pattern:

```typescript
import keeperhubPlugin from '@elizaos/plugin-keeperhub';

// When building AgentRuntime / character config:
plugins: [
  // ...other plugins
  keeperhubPlugin,
],
```

**4. Character strings**

Point the model at KeeperHub for workflow and on-chain tasks in `system` / `bio` if you want consistent routing (see root [`index.ts`](index.ts) for a sample **“Keeper”** character that adds `@elizaos/plugin-keeperhub` and KeeperHub-oriented prompts).

Full action list and examples: [`packages/plugin-keepershub/README.md`](packages/plugin-keepershub/README.md).

---

## Integrating the OpenClaw plugin (`openclaw-keepershub`)

**Do not run this inside the Eliza monorepo as part of Eliza.** OpenClaw is a separate stack (Gateway, `openclaw` CLI, `openclaw.json`, etc.). This repository only hosts the plugin **source**.

1. Clone or download this repo (or copy the folder) so you have **`openclaw-plugins/keepershub`** on disk.
2. On the **machine and working directory where you manage OpenClaw** (your OpenClaw project / install), install the plugin by pointing OpenClaw at that directory. Example — adjust `PATH_TO_REPO` to where you cloned **this** repo (or move the folder next to your OpenClaw config):

```bash
# Run from YOUR OpenClaw context; PATH_TO_REPO/openclaw-plugins/keepershub must exist on that machine.
openclaw plugins install PATH_TO_REPO/openclaw-plugins/keepershub
openclaw gateway restart
```

**Configure the API key** in **that** OpenClaw environment (OpenClaw config or env — see plugin doc):

```bash
openclaw config set plugins.entries.keepershub.config.apiKey "kh_your_key_here"
# or rely on KH_API_KEY / KEEPERHUB_API_KEY / KEEPERSHUB_API_KEY
```

**Verify:**

```bash
openclaw plugins inspect keepershub --runtime --json
```

Then have the agent call **`kh_status`**.

Complete install options (npm / ClawHub), tool table, architecture, and publishing: [`openclaw-plugins/keepershub/README.md`](openclaw-plugins/keepershub/README.md) and [OpenClaw plugin docs](https://docs.openclaw.ai/tools/plugin).

---

## Integrating the Hermes plugin

**Hermes is not part of this Eliza app.** Agent channels (TUI, Telegram, etc.) and plugin loading belong to **your Hermes Agent installation**. This repo only ships the **`hermes-plugins/keepershub`** source tree.

1. Obtain **`hermes-plugins/keepershub`** from a clone or archive of **this repository**.
2. On the host where Hermes runs, install into Hermes’s plugin location (adapt paths if your distro uses another plugins root):

**Directory install (typical):**

```bash
# PATH_TO_REPO = where you cloned this repo on the Hermes machine
cp -r PATH_TO_REPO/hermes-plugins/keepershub ~/.hermes/plugins/keepershub
hermes plugins enable keepershub
```

**Editable pip install** (optional — for hacking on the plugin; still use Python/Hermes on **that** side):

```bash
cd PATH_TO_REPO/hermes-plugins/keepershub
pip install -e ".[dev]"
```

**Environment:** `plugin.yaml` declares **`KH_API_KEY`**. Hermes can prompt on `hermes plugins install` and store values in Hermes’s **`.env`** (not Eliza’s).

**Tests** (developers, from a checkout of this repo):

```bash
cd hermes-plugins/keepershub
pytest
```

Details: [`hermes-plugins/keepershub/README.md`](hermes-plugins/keepershub/README.md).

---

## Optional: Phala and Docker

- **`docker-compose.phala.yaml`** — compose stack oriented toward Phala deployment; adjust images and secrets for your environment.
- **`scripts/deploy-phala.ps1`** — PowerShell helper to drive a deploy flow; review and edit paths and remotes before use.
- **`Dockerfile`** / **`bun run docker:*`** — follow root `package.json` scripts and upstream ElizaOS Docker patterns where applicable.

---

## Contributing and issues

- Use the templates under [`.github/ISSUE_TEMPLATE`](.github/ISSUE_TEMPLATE) for bugs and features.
- For **KeeperHub plugin** changes, prefer focused PRs scoped to `packages/plugin-keepershub`, `openclaw-plugins/keepershub`, or `hermes-plugins/keepershub` with tests when possible.

---

## Upstream and credits

This repository **builds on [ElizaOS](https://github.com/elizaos/eliza)** (monorepo layout, CLI, server, client, and ecosystem packages). The **KeeperHub Eliza plugin** lives in **`packages/plugin-keepershub`**; **OpenClaw** and **Hermes** KeeperHub plugins are included as portable sources intended for separate OpenClaw and Hermes projects.

If you cite Eliza in research, see the upstream [README](https://github.com/elizaos/eliza) for the recommended BibTeX entry.

---

## License

This project is licensed under the **MIT License**. See the [`LICENSE`](LICENSE) file for details.
