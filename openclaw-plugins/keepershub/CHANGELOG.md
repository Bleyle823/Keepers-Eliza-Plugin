# Changelog

All notable changes to the OpenClaw KeeperHub plugin (`openclaw-plugins/keepershub`) are documented here.

---

## ClawHub — source provenance (copy for publish)

Use these when [publishing to ClawHub](https://docs.openclaw.ai/tools/clawhub) (update the **commit** to the exact revision you are shipping):

| Field | Value |
| ----- | ----- |
| **Source repo** (owner/repo) | **`Bleyle823/Keepers-Eliza-Plugin`** |
| **Source commit** (full SHA) | **`7504425ad423952966a025869961f100d3f065c5`** |
| **Source ref** (branch or tag) | **`develop`** |

Git URL (HTTPS): `https://github.com/Bleyle823/Keepers-Eliza-Plugin.git`  
Subpath in repo: `openclaw-plugins/keepershub`

Before each release, refresh the commit:

```bash
git checkout develop
git pull
git rev-parse HEAD
```

---

## [1.0.1] - 2026-05-03

### Changed

- README: **documentation-first** installation from [ClawHub](https://docs.openclaw.ai/tools/clawhub) using scoped package **`@keepershub/openclaw-keepershub`** (`openclaw plugins install @keepershub/openclaw-keepershub`); optional `clawhub:` / `npm:` resolver examples.
- README: **Local development** moved under “Installation from source (contributors)” with OpenClaw-vs-hooks clarification retained.
- Removed long **Publishing** appendix from README in favour of this CHANGELOG + registry story.

[1.0.1]: https://github.com/Bleyle823/Keepers-Eliza-Plugin/tree/7504425ad423952966a025869961f100d3f065c5/openclaw-plugins/keepershub

---

## [1.0.0] - 2026-05-02

### Added

- Initial OpenClaw plugin release mirroring the Eliza `plugin-keepershub` surface.
- **28 `kh_*` tools:** workflows, executions, templates, plugins, integrations, protocol actions, direct execution, marketplace, AI workflow generation, docs, and `kh_status`.
- MCP client with session re-init on 401 / 404.
- Config via `plugins.entries.keepershub.config.apiKey` or `KH_API_KEY` / `KEEPERHUB_API_KEY` / `KEEPERSHUB_API_KEY`.

[1.0.0]: https://github.com/Bleyle823/Keepers-Eliza-Plugin/tree/ab96c89/openclaw-plugins/keepershub
