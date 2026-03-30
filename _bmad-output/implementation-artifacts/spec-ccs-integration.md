---
title: 'Add CCS (Claude Code Switcher) profile integration'
type: 'feature'
created: '2026-03-30'
status: 'done'
baseline_commit: '5bae86f'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users who manage multiple providers via [ccs](https://github.com/kaitranntt/ccs) cannot use their ccs profiles through ai-cli-mcp. The existing `EXTRA_*_BINARIES` system requires a dedicated binary per provider, but ccs uses a single binary with profile names as arguments (`ccs glm`, `ccs qwen`).

**Approach:** Extend `ExtraBinaryEntry` with an optional `prefixArgs` field and add a `CCS_PROFILES` env var. When a ccs profile is selected as the binary, the profile name is prepended to the CLI args: `ccs glm --dangerously-skip-permissions ...`. ccs handles loading settings/env vars and forwarding to claude.

## Boundaries & Constraints

**Always:**
- Existing `EXTRA_*_BINARIES` behavior must remain unchanged
- Extra binaries take precedence over CCS profiles when names collide
- CCS profiles always use agent type `claude` (ccs wraps claude)
- `ccs` binary is resolved via PATH or `CCS_CLI_NAME` env var

**Ask First:**
- Supporting ccs profiles with non-claude target agents (codex/gemini)

**Never:**
- Parse or depend on ccs internal config format (settings.json, cliproxy)
- Modify the ccs binary itself

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Single profile | `CCS_PROFILES=glm`, ccs on PATH | Entry: `{name:"glm", path:"/path/to/ccs", agent:"claude", prefixArgs:["glm"]}` | N/A |
| Multiple profiles | `CCS_PROFILES=glm,qwen,mm` | 3 entries, each with correct prefixArgs | N/A |
| ccs not on PATH | `CCS_PROFILES=glm`, no ccs binary | Empty entries, warning to stderr | Warning logged, no crash |
| Name collision with extra binary | `EXTRA_CLAUDE_BINARIES=glm:/x`, `CCS_PROFILES=glm` | Extra binary wins, ccs entry skipped | Debug log |
| Name collision with built-in | `CCS_PROFILES=claude` | Entry skipped | Warning logged |
| Empty/whitespace profiles | `CCS_PROFILES=","` or `"  "` | Empty entries | N/A |
| prefixArgs in buildCliCommand | `binary:"glm"` with prefixArgs `["glm"]` | Args: `["glm", "--dangerously-skip-permissions", ...]` | N/A |
| Custom ccs path | `CCS_CLI_NAME=/custom/ccs` | Uses custom path for all profile entries | N/A |

</frozen-after-approval>

## Code Map

- `src/cli-utils.ts` -- Binary discovery, extra binaries config, ExtraBinaryEntry interface
- `src/cli-builder.ts` -- Transforms user params into CLI-specific command arguments
- `src/__tests__/cli-utils.test.ts` -- Tests for binary config and parsing
- `src/__tests__/cli-builder.test.ts` -- Tests for command building
- `README.md` -- Documents env vars and usage

## Tasks & Acceptance

**Execution:**
- [x] `src/cli-utils.ts` -- Add `prefixArgs?: string[]` to `ExtraBinaryEntry`, add `findCcsCli()` and `parseCcsProfiles()` functions, update `getExtraBinariesConfig()` to include ccs profile entries
- [x] `src/cli-builder.ts` -- Store `prefixArgs` from extra binary entry during resolution, prepend to args array before returning
- [x] `src/__tests__/cli-utils.test.ts` -- Add `parseCcsProfiles` tests (empty, single, multiple, collisions, ccs-not-found) and `getExtraBinariesConfig` precedence test
- [x] `src/__tests__/cli-builder.test.ts` -- Add prefixArgs tests (profile prepended, works with model/session)
- [x] `README.md` -- Add CCS Profiles section documenting `CCS_PROFILES` and `CCS_CLI_NAME` env vars

**Acceptance Criteria:**
- Given `CCS_PROFILES=glm` and ccs on PATH, when MCP `run` tool is called with `binary: "glm"`, then process spawns as `ccs glm --dangerously-skip-permissions --output-format stream-json --verbose -p <prompt>`
- Given `EXTRA_CLAUDE_BINARIES=glm:/x` and `CCS_PROFILES=glm`, when config is loaded, then the extra binary entry wins and ccs profile is silently skipped
- Given `CCS_PROFILES=glm` but no ccs on PATH, when config is loaded, then a warning is logged and no entries are added

## Verification

**Commands:**
- `npx vitest run src/__tests__/cli-builder.test.ts src/__tests__/cli-utils.test.ts` -- expected: all tests pass
- `npx vitest run` -- expected: no regressions (pre-existing e2e.test.ts failure excluded)

## Suggested Review Order

**Core data model + discovery**

- New `prefixArgs` field on `ExtraBinaryEntry` — the key extension point
  [`cli-utils.ts:157`](../../src/cli-utils.ts#L157)

- `findCcsCli()` — locates ccs binary via `CCS_CLI_NAME` or PATH, with relative path validation
  [`cli-utils.ts:212`](../../src/cli-utils.ts#L212)

- `parseCcsProfiles()` — parses `CCS_PROFILES`, validates names, creates entries with prefixArgs
  [`cli-utils.ts:227`](../../src/cli-utils.ts#L227)

- `getExtraBinariesConfig()` — CCS entries appended after extra binaries, collisions handled
  [`cli-utils.ts:253`](../../src/cli-utils.ts#L253)

**Command building**

- `prefixArgs` stored during binary resolution
  [`cli-builder.ts:134`](../../src/cli-builder.ts#L134)

- Prepended to args before return — the single line that makes it all work
  [`cli-builder.ts:234`](../../src/cli-builder.ts#L234)

**Tests**

- `parseCcsProfiles` tests — 9 cases covering happy path, edge cases, and validation
  [`cli-utils.test.ts:203`](../../src/__tests__/cli-utils.test.ts#L203)

- `prefixArgs` builder tests — verifies profile prepending with various arg combos
  [`cli-builder.test.ts:508`](../../src/__tests__/cli-builder.test.ts#L508)

- Precedence test — extra binaries win over CCS profiles
  [`cli-utils.test.ts:320`](../../src/__tests__/cli-utils.test.ts#L320)

**Documentation**

- README CCS Profiles section
  [`README.md:353`](../../README.md#L353)
