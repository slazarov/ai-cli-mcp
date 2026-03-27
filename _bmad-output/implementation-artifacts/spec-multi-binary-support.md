---
title: 'Add multi-binary support for CLI agent types'
type: 'feature'
created: '2026-03-27T12:15:00Z'
status: 'done'
baseline_commit: 'd5d4435'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The MCP server supports one binary per agent type (claude/codex/gemini) via `CLAUDE_CLI_NAME` etc. Users with multiple CLI wrappers (e.g., `claude-zhipu` for GLM, `claude-deepseek` for DeepSeek) cannot spawn agents through different wrappers in the same session.

**Approach:** Add `EXTRA_CLAUDE_BINARIES`, `EXTRA_CODEX_BINARIES`, `EXTRA_GEMINI_BINARIES` env vars that accept `name:path` pairs. Add an optional `binary` parameter to the `run` tool so callers can select which wrapper to spawn. The binary's agent type (claude/codex/gemini) determines CLI args format and output parser. Fully backwards compatible — omitting `binary` uses the existing default.

## Boundaries & Constraints

**Always:**
- Apply the same security validation (no relative paths) to extra binaries
- Use the agent type from the binary's registration group (EXTRA_CLAUDE_* → claude) for CLI arg building and output parsing
- Pass the `model` parameter through to the selected binary as-is
- Show extra binaries in doctor output and startup logs

**Ask First:**
- Changes to the `list_processes` response shape (currently returns `agent` field)

**Never:**
- Duplicate parser logic — all claude-type binaries use `parseClaudeOutput`, etc.
- Break existing behavior when `binary` is not specified
- Allow binary names that collide with the built-in names (`claude`, `codex`, `gemini`)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Extra binary happy path | `EXTRA_CLAUDE_BINARIES=claude-zhipu:/usr/local/bin/claude-zhipu`, `run` with `binary: "claude-zhipu"` | Spawns using `/usr/local/bin/claude-zhipu` with claude CLI args | N/A |
| No binary param | `run` without `binary` | Uses default binary (existing behavior) | N/A |
| Unknown binary name | `run` with `binary: "nonexistent"` | Error response | `Unknown binary "nonexistent". Available: claude, codex, gemini, claude-zhipu, ...` |
| Name collision with built-in | `EXTRA_CLAUDE_BINARIES=claude:/path` | Rejected at parse time | `Extra binary name "claude" conflicts with built-in` |
| Invalid path in env var | `EXTRA_CLAUDE_BINARIES=foo:./relative/path` | Rejected at parse time, logged to stderr | Same validation error as existing `CLAUDE_CLI_NAME` |
| Malformed env var | `EXTRA_CLAUDE_BINARIES=nocolon` | Entry skipped, warning logged | Startup continues with valid entries |
| Multiple extras | `EXTRA_CLAUDE_BINARIES=a:/bin/a,b:/bin/b` | Both registered and available | N/A |
| Empty env var | `EXTRA_CLAUDE_BINARIES=` | No extras registered (no-op) | N/A |

</frozen-after-approval>

## Code Map

- `src/cli-utils.ts` -- Binary discovery, validation, env var parsing. Add `parseExtraBinaries()` and `getExtraBinariesConfig()`
- `src/cli-builder.ts` -- CLI command construction. Extend `BuildCliCommandOptions` with `binary?`, resolve binary path from extras map
- `src/process-service.ts` -- Process lifecycle. Thread `binary` param through to `buildCliCommand`, store binary name in `TrackedProcess`
- `src/app/mcp.ts` -- MCP tool registration. Add `binary` param to `run` tool schema, discover extras at startup, pass extras to ProcessService
- `src/model-catalog.ts` -- Model descriptions. Update `getModelParameterDescription` to mention binary override

## Tasks & Acceptance

**Execution:**
- [x] `src/cli-utils.ts` -- Add `parseExtraBinaries(envValue, agentType)` that parses `name:path` CSV, validates each entry, returns `Map<string, {path, agent}>`. Add `getExtraBinariesConfig()` that reads all 3 env vars and merges results. Export `ExtraBinary` type.
- [x] `src/cli-builder.ts` -- Add optional `binary?: string` and `extraBinaries?: Map<string, {path: string, agent: AgentType}>` to `BuildCliCommandOptions`. When `binary` is set, look it up in extras map, override `cliPath` and override agent type from the registration (not from model).
- [x] `src/process-service.ts` -- Thread `binary` and `extraBinaries` through `startProcess` → `buildCliCommand`. Store `binaryName` in `TrackedProcess` for visibility. Include `binary` field in `ProcessListItem` and responses when set.
- [x] `src/app/mcp.ts` -- Call `getExtraBinariesConfig()` at startup, log discovered extras. Add `binary` string param to `run` tool schema with description listing available binaries. Pass extras to ProcessService. Update doctor-like startup logging.
- [x] `src/__tests__/cli-builder.test.ts` -- Add tests: extra binary selection, unknown binary error, name collision rejection, fallback to default when no binary specified.
- [x] `src/__tests__/cli-utils.test.ts` or new test file -- Add tests: `parseExtraBinaries` happy path, malformed entries, relative path rejection, name collision detection.

**Acceptance Criteria:**
- Given `EXTRA_CLAUDE_BINARIES=claude-zhipu:/usr/local/bin/claude-zhipu` is set, when the MCP server starts, then `claude-zhipu` appears in startup logs and is available via the `binary` parameter.
- Given the `run` tool is called with `binary: "claude-zhipu"` and `model: "sonnet"`, when the process spawns, then it uses `/usr/local/bin/claude-zhipu` with claude CLI args format including `--model sonnet`.
- Given the `run` tool is called without `binary`, when the process spawns, then existing behavior is unchanged.
- Given an unknown `binary` name is passed, when the tool is called, then an error listing available binaries is returned.
- Given all existing tests, when the test suite runs, then all pass without modification (backwards compatibility).

## Verification

**Commands:**
- `npm run test:unit` -- expected: all tests pass including new ones
- `npm run build` -- expected: clean compile

## Suggested Review Order

**Env var parsing & binary discovery**

- Parses `name:path` CSV, validates with same security checks as built-in binaries
  [`cli-utils.ts:155`](../../src/cli-utils.ts#L155)

- Reads all 3 env vars, deduplicates, returns merged Map
  [`cli-utils.ts:213`](../../src/cli-utils.ts#L213)

**Binary resolution in command builder**

- Resolves binary override — looks up extras map, falls back to built-in
  [`cli-builder.ts:131`](../../src/cli-builder.ts#L131)

- Agent type from binary registration overrides model-inferred agent
  [`cli-builder.ts:158`](../../src/cli-builder.ts#L158)

- Reasoning effort validation now respects binary's agent type (review fix)
  [`cli-builder.ts:33`](../../src/cli-builder.ts#L33)

**Process lifecycle threading**

- Binary name stored in TrackedProcess, included in list/result responses
  [`process-service.ts:15`](../../src/process-service.ts#L15)

- extraBinaries passed through to buildCliCommand at service level
  [`process-service.ts:52`](../../src/process-service.ts#L52)

**MCP tool registration**

- Extras discovered at startup, logged, passed to ProcessService
  [`mcp.ts:81`](../../src/app/mcp.ts#L81)

- `binary` parameter added to `run` tool with dynamic available-binaries description
  [`mcp.ts:180`](../../src/app/mcp.ts#L180)

**Tests**

- Extra binary selection, unknown binary errors, built-in passthrough
  [`cli-builder.test.ts:405`](../../src/__tests__/cli-builder.test.ts#L405)

- parseExtraBinaries: happy path, malformed, collisions, relative path rejection
  [`cli-utils.test.ts:134`](../../src/__tests__/cli-utils.test.ts#L134)

- getExtraBinariesConfig: multi-env-var reading, deduplication
  [`cli-utils.test.ts:216`](../../src/__tests__/cli-utils.test.ts#L216)
