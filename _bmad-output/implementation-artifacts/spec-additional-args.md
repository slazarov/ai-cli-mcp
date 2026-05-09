---
title: 'Safe per-run additional CLI arguments'
type: 'feature'
created: '2026-05-09'
status: 'done'
baseline_commit: 'f0c2f55'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Callers cannot pass ad-hoc CLI flags (e.g., Codex `-c` config overrides) to the underlying agent without editing global config or shell-string concatenation.

**Approach:** Add optional `additional_args: string[]` to the MCP `run` tool. Thread through types and append tokens to each CLI's argv after built-in control args but before the prompt, preserving argv boundaries exactly.

## Boundaries & Constraints

**Always:**
- `additional_args` is `string[]`; reject non-string items at MCP input parsing.
- Preserve argv token boundaries -- never join into a shell string.
- Block known cwd-conflicting flags: `-C` for forge, `--dir`/`-d` for opencode. Error with the flag name.
- Behavior unchanged when `additional_args` omitted or `[]`.

**Ask First:** Allowing `additional_args` for a new backend type not yet in the codebase.

**Never:**
- Shell-eval or spawn-shell mode for additional_args.
- Add additional_args to StoredProcess/TrackedProcess persistence.
- Deduplicate additional_args against built-in flags.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Codex `-c` overrides | `additional_args: ["-c", "key=val"]`, codex | argv: `exec [AA] --model m --skip... <prompt>` | N/A |
| Claude extra flags | `additional_args: ["--flag", "x"]` | argv: `...--verbose [AA] -p <prompt> --model m` | N/A |
| Omitted or `[]` | no additional_args | identical to current argv | N/A |
| Non-string items | `[123, null]` | rejected before CLI build | descriptive error |
| Forge cwd conflict | `["-C", "/other"]` on forge | rejected | error naming `-C` |
| Coexisting `-c` | additional_args has `-c` + reasoning_effort set | both `-c` flags in argv; CLI resolves | N/A (document) |

</frozen-after-approval>

## Code Map

- `src/app/mcp.ts` -- MCP tool schema & input extraction for `run`
- `src/cli-builder.ts` -- `BuildCliCommandOptions` & per-agent argv construction
- `src/process-service.ts` -- `StartProcessOptions` threading
- `src/cli-process-service.ts` -- `CliRunOptions` threading
- `src/__tests__/cli-builder.test.ts` -- arg construction tests
- `src/__tests__/mcp-contract.test.ts` -- tool schema property enumeration
- `README.md` -- tool docs & examples

## Tasks & Acceptance

**Execution:**
- [x] `src/cli-builder.ts` -- Add `additional_args?: string[]` to `BuildCliCommandOptions`. Insert after built-in control args, before prompt tokens per agent. Add blocked-flag validation for forge/opencode.
- [x] `src/process-service.ts` -- Add `additional_args?: string[]` to `StartProcessOptions`, pass through to `buildCliCommand`.
- [x] `src/cli-process-service.ts` -- Add `additional_args?: string[]` to `CliRunOptions`, pass through.
- [x] `src/app/mcp.ts` -- Add `additional_args` to run tool schema (`type: array, items: {type: string}`), extract from toolArguments, validate items are strings.
- [x] `src/__tests__/cli-builder.test.ts` -- Tests: codex args before prompt; order preserved; omitted unchanged; claude placement; forge/opencode blocked-flag rejection.
- [x] `src/__tests__/mcp-contract.test.ts` -- Add `additional_args` to property enumeration.
- [x] `README.md` -- Document `additional_args` with Codex `-c` override example.

**Acceptance Criteria:**
- Given `additional_args: ["-c", "key=val"]` with codex, when invoked, then argv contains `-c key=val` before prompt and after built-in args.
- Given `additional_args` omitted, when invoked, then argv matches pre-change behavior exactly.
- Given `additional_args: [123]`, when invoked, then error thrown before CLI build.
- Given `additional_args: ["-C", "/x"]` with forge, when invoked, then error thrown naming blocked flag.
- Given `npm run test:run`, then all tests pass with no regressions.

## Design Notes

**Per-backend argv placement (`[AA]` = additional_args):**

| Agent | Argv order |
|-------|-----------|
| Claude | `--dangerously... --output-format... --verbose [session] [--effort E] [AA] -p <prompt> [--model M]` |
| Codex | `exec [resume sess] [-c reasoning] [AA] [--model M] --skip... --json <prompt>` |
| Gemini | `-y --output-format... [session] [AA] [--model M] <prompt>` |
| Forge | `[-C cwd] [session] [AA] -p <prompt>` |
| OpenCode | `run --format json --dir <cwd> [session] [--model M] [AA] <prompt>` |

Claude's `--model` is always last (after prompt) -- existing behavior. Built-in and caller `-c` flags coexist; CLI determines precedence.

## Verification

**Commands:**
- `npm run build` -- expected: clean compilation
- `npm run test:run` -- expected: all tests pass

## Suggested Review Order

**Validation & safety**

- Core validation logic: type checking, blocked-flag detection with combined-form handling
  [`cli-builder.ts:161`](../../src/cli-builder.ts#L161)

- Blocked flags definition per agent (forge `-C`, opencode `--dir`/`-d`)
  [`cli-builder.ts:156`](../../src/cli-builder.ts#L156)

**Argv insertion points**

- Entry point: `additionalArgs` computed after agent resolution, before arg building
  [`cli-builder.ts:269`](../../src/cli-builder.ts#L269)

- Codex: after reasoning `-c`, before `--model`
  [`cli-builder.ts:286`](../../src/cli-builder.ts#L286)

- Claude: after `--effort`, before `-p <prompt>`
  [`cli-builder.ts:342`](../../src/cli-builder.ts#L342)

**Schema & threading**

- MCP tool schema: array of strings with description
  [`mcp.ts:203`](../../src/app/mcp.ts#L203)

- MCP handler: extraction from toolArguments
  [`mcp.ts:395`](../../src/app/mcp.ts#L395)

- CliRunOptions interface addition
  [`cli-process-service.ts:68`](../../src/cli-process-service.ts#L68)

**Tests & docs**

- 19-test suite covering all agents, validation, blocked flags, combined forms, coexistence
  [`cli-builder.test.ts:623`](../../src/__tests__/cli-builder.test.ts#L623)

- README documentation with Codex `-c` override example
  [`README.md:270`](../../README.md#L270)
