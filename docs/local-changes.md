# Fork-Specific Changes

This document tracks changes made in this fork on top of the upstream [mkXultra/ai-cli-mcp](https://github.com/mkXultra/ai-cli-mcp) package.

---

## 2026-05-09 — Upstream integration: v2.12.0 → v2.21.0

Rebased all local commits onto upstream `develop` (v2.21.0).

### What's new from upstream

**New agent backends**

- **Forge CLI** — `model: "forge"` routes to `forge -C <workFolder> -p <prompt>`. Session resume via `--conversation-id`.
- **OpenCode** — `model: "opencode"` or `model: "oc-<provider/model>"` (e.g. `oc-openai/gpt-5.4`) routes to `opencode run --format json`. Session resume via `--session`.

**New MCP tools**

- **`peek`** — one-shot observation window for a running agent. Returns natural-language message events (and optionally tool-call events) seen during the window. Not a history API; does not tail raw stdout.
- **`doctor`** — MCP-accessible binary health check (same as `ai-cli doctor`).
- **`models`** — MCP-accessible model/alias listing (same as `ai-cli models`).

**Compact result shape (breaking for `get_result` / `wait`)**

The default result shape is now compact: `pid`, `agent`, `status`, `exitCode`, `model`, `agentOutput`, `session_id`. Metadata fields (`startTime`, `workFolder`, `prompt`) are hidden unless `verbose: true` is passed. The local `output_only` parameter continues to work alongside this — see below.

**Extended reasoning efforts**

Claude now accepts `xhigh` and `max` in addition to `low`/`medium`/`high`. Codex supports `low`/`medium`/`high`/`xhigh`. Forge and OpenCode reject `reasoning_effort`. `claude-ultra` alias now defaults to `max` effort.

**Gemini output format**

Gemini now uses `--output-format stream-json` (was `json`), matching new parser support.

**New Codex models**

`gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini` added. `gpt-5.4` is the new default for `codex`. `codex-ultra` alias updated to `gpt-5.5`.

**CLI hardening**

- Exit status written atomically to prevent torn reads.
- Stale detached wrapper processes cleaned on restart.
- CLI termination handling hardened (SIGTERM exit code 143 tracked).
- `doctor` reachable even when CLI env is misconfigured.

---

## 2026-03-30 — CCS (Claude Code Switcher) profile integration

**New env vars:** `CCS_PROFILES`, `CCS_CLI_NAME`

Lets ccs profiles appear as selectable binaries in the `run` tool without needing a dedicated binary per provider. Each profile name listed in `CCS_PROFILES` becomes a `binary` option that prepends the profile name to the claude CLI args: `ccs <profile> --dangerously-skip-permissions ...`.

```json
{ "env": { "CCS_PROFILES": "glm,qwen,mm" } }
```

```json
{ "prompt": "...", "workFolder": "/project", "binary": "glm" }
```

**Rules:**
- Extra binaries (`EXTRA_*_BINARIES`) take precedence over CCS profiles when names collide.
- CCS profiles always use the `claude` agent type.
- If `ccs` is not on PATH and `CCS_CLI_NAME` is not set, profiles are skipped with a warning.
- Profile names must not collide with built-in names (`claude`, `codex`, `gemini`, `forge`, `opencode`).

---

## 2026-03-27 — Multi-binary CLI support

**New env vars:** `EXTRA_CLAUDE_BINARIES`, `EXTRA_CODEX_BINARIES`, `EXTRA_GEMINI_BINARIES`

Register additional CLI wrappers per agent type. Useful for wrappers that speak the same CLI interface but route to different providers.

**Format:** `name:path` pairs, comma-separated.

```json
{ "env": { "EXTRA_CLAUDE_BINARIES": "claude-zhipu:/usr/local/bin/claude-zhipu,claude-deepseek:claude-deepseek" } }
```

**New `binary` parameter on the `run` tool**

```json
{ "prompt": "...", "workFolder": "/project", "model": "sonnet", "binary": "claude-zhipu" }
```

The `binary`'s registered agent type determines the CLI argument format and output parser. The `model` param is forwarded to the wrapper as-is.

**`prefixArgs` support (internal)**

Extra binary entries can carry `prefixArgs` (used by CCS profiles) to prepend arguments before the standard CLI flags.

**`binary` field on `list_processes` results**

When a non-default binary was used, the `binary` name is included in the process list entry.

---

## 2026-03-26 — `output_only` parameter for `get_result` and `wait`

**New parameter:** `output_only: boolean` on `get_result` and `wait` (MCP and CLI `--output-only` flag).

When `true`, returns only the agent result fields (`status`, `message`, `session_id`, `usage`, etc.) with no process metadata (`pid`, `agent`, `prompt`, `workFolder`, `model`, `exitCode`). Useful when the prompt is large and token count matters.

This is distinct from `verbose: false` (compact mode) — compact mode still includes `pid`/`agent`/`status`/`exitCode`/`model`. `output_only` strips all of those.

```json
{ "pid": 12345, "output_only": true }
```

```bash
ai-cli result 12345 --output-only
ai-cli wait 12345 --output-only
```
