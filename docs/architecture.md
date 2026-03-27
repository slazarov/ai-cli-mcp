# AI CLI MCP — Architecture

**Generated**: 2026-03-27 | **Scan level**: Deep (Serena-assisted)

## Executive Summary

The server is a single-process Node.js application that acts as an MCP tool provider. It receives tool calls over stdio, spawns AI CLI subprocesses, tracks their lifecycle, and returns structured results. There are two parallel service implementations: in-memory (`ProcessService`) for the MCP server, and filesystem-persisted (`CliProcessService`) for the standalone CLI.

## High-Level Architecture

```
MCP Client (Cursor, Claude Code, etc.)
    │
    │ stdio (JSON-RPC over MCP protocol)
    ▼
┌─────────────────────────────┐
│  ClaudeCodeServer           │  src/app/mcp.ts
│  (MCP tool handler layer)   │
│                             │
│  Tools: run, list_processes,│
│  get_result, wait,          │
│  kill_process, cleanup      │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  ProcessService             │  src/process-service.ts
│  (in-memory process mgmt)   │
│                             │
│  Map<pid, TrackedProcess>   │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  buildCliCommand()          │  src/cli-builder.ts
│  (command construction)     │
│                             │
│  Model resolution, agent    │
│  detection, arg building    │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  child_process.spawn()      │  Node.js
│                             │
│  Claude / Codex / Gemini    │
│  CLI subprocess             │
└─────────────────────────────┘
```

## Core Components

### ClaudeCodeServer (`src/app/mcp.ts`)

The MCP server class. Responsibilities:
- Registers 6 MCP tools via `setupToolHandlers()`
- Routes `CallToolRequest` to handler methods (`handleRun`, `handleListProcesses`, etc.)
- Manages server lifecycle (connect, cleanup, SIGINT handling)
- Uses `StdioServerTransport` for communication

Key fields:
- `server` — MCP Server instance
- `processService` — ProcessService instance
- `claudeCliPath`, `codexCliPath`, `geminiCliPath` — Resolved CLI binary paths

### ProcessService (`src/process-service.ts`)

In-memory process management for the MCP server. Uses a `Map<number, TrackedProcess>` to track spawned processes.

Methods:
- `startProcess()` — Builds command via `buildCliCommand()`, spawns child process, streams stdout/stderr to memory
- `listProcesses()` — Returns `ProcessListItem[]` summary
- `getProcessResult()` — Returns full output with parsed result (calls parsers)
- `waitForProcesses()` — Polls until PIDs complete or timeout
- `killProcess()` — Sends SIGTERM to process
- `cleanupProcesses()` — Removes completed/failed entries from map

### CliProcessService (`src/cli-process-service.ts`)

Filesystem-persisted process management for the standalone CLI. Stores process state under `~/.ai-cli-mcp/` (or `$XDG_STATE_HOME`). Same interface as ProcessService but survives process restarts.

Storage structure:
- One directory per working directory (normalized)
- Process metadata in JSON files
- stdout/stderr captured to files on disk

### buildCliCommand (`src/cli-builder.ts`)

Pure function that constructs the CLI command for any agent. Responsibilities:
- Validates `workFolder`, `prompt`/`prompt_file`
- Resolves model aliases via `resolveModelAlias()`
- Determines agent type via `getAgentForModel()`
- Builds agent-specific CLI args (flags, permissions, output format)
- Returns `CliCommand` object: `{ cliPath, args, cwd, agent, prompt, resolvedModel }`

### Model Catalog (`src/model-catalog.ts`)

Static model definitions:
- `CLAUDE_MODELS` — Array of Claude model names
- `CODEX_MODELS` — Array of Codex/GPT model names
- `GEMINI_MODELS` — Array of Gemini model names
- `MODEL_ALIASES` — Shortcut aliases (`claude-ultra` -> `claude-sonnet-4-6`, etc.)
- `MODEL_ALIAS_DETAILS` — Extended alias info with default reasoning effort

### Output Parsers (`src/parsers.ts`)

Three parser functions:
- `parseClaudeOutput()` — Handles both single JSON and NDJSON stream-json format. Extracts: final result message, session_id, tool usage history
- `parseCodexOutput()` — Extracts: exit_code, message, token_count, session_id, tools
- `parseGeminiOutput()` — Extracts Gemini CLI JSON output

### CLI Utils (`src/cli-utils.ts`)

Binary discovery layer:
- `findClaudeCli()`, `findCodexCli()`, `findGeminiCli()` — Locate CLI binaries
- Resolution order: env var (`CLAUDE_CLI_NAME`) → local install (`~/.claude/local/claude`) → PATH lookup
- `getCliDoctorStatus()` — Returns availability status for all three CLIs
- `inspectCliBinary()` — Detailed binary inspection with validation

### CLI App (`src/app/cli.ts`)

Human-facing CLI with subcommands:
- `run` — Start a process (flags: `--cwd`, `--prompt`, `--model`, `--session-id`, `--reasoning-effort`)
- `ps` — List processes
- `result <pid>` — Get process output
- `wait <pid...>` — Wait for processes
- `kill <pid>` — Kill a process
- `cleanup` — Remove completed processes
- `models` — List supported models
- `doctor` — Check CLI availability
- `mcp` — Start MCP server

Uses dependency injection (`CliDeps`) for testability.

## Data Flow

### MCP `run` Tool Flow

1. Client sends `CallToolRequest` with tool name `run`
2. `ClaudeCodeServer.handleRun()` receives arguments
3. Calls `ProcessService.startProcess()` with options
4. `startProcess()` calls `buildCliCommand()` to construct the command
5. Spawns child process via `child_process.spawn()`
6. Registers stdout/stderr data handlers to accumulate output
7. Returns `{ pid, status: 'started', agent, message }` immediately
8. Client later calls `get_result` or `wait` to retrieve output

### Output Retrieval Flow

1. Client calls `get_result` with PID
2. `ProcessService.getProcessResult()` looks up TrackedProcess
3. If completed, routes stdout through appropriate parser (`parseClaudeOutput`, `parseCodexOutput`, `parseGeminiOutput`)
4. Returns parsed structured output with metadata

## Design Decisions

- **No database** — Process state is either in-memory (MCP) or flat files (CLI). Simple and portable.
- **Detached: false** — Child processes are NOT detached; they die with the parent. This is intentional for the MCP use case.
- **Permission bypassing** — All agents run with maximum permissions (`--dangerously-skip-permissions`, `--full-auto`, `-y`). The server is designed for trusted, automated use.
- **Model routing** — Agent type is determined from model name, not specified separately. This simplifies the API.
- **Dual service implementations** — `ProcessService` (in-memory) and `CliProcessService` (filesystem) share the same logical interface but differ in persistence.
