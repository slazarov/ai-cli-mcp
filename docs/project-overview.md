# AI CLI MCP — Project Overview

**Generated**: 2026-03-27 | **Scan level**: Deep (Serena-assisted)

## Purpose

MCP (Model Context Protocol) server that spawns AI CLI tools (Claude Code, OpenAI Codex, Google Gemini) as background processes with automatic permission handling. Designed for **agent-in-agent orchestration** — an MCP client can dispatch sub-agents to perform coding tasks in parallel, collect results, and resume sessions.

Two entry points:
- **`ai-cli-mcp`** — MCP server (stdio transport), consumed by MCP clients (Cursor, Claude Code, etc.)
- **`ai-cli`** — Human-facing CLI for the same process management, persisted to filesystem

## Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Language | TypeScript | ^5.8.3 |
| Runtime | Node.js (ESM) | ES2022 target |
| Core Protocol | @modelcontextprotocol/sdk | ^1.11.2 |
| Validation | Zod | ^3.24.4 |
| Testing | Vitest | ^2.1.8 |
| Build | tsc | TypeScript compiler |
| Dev Runner | tsx | ^4.19.4 |
| Git Hooks | Husky | ^9.1.7 |
| Release | semantic-release | ^25.0.2 |

## Architecture Type

**Service-based monolith** — single Node.js process exposing MCP tools over stdio. No database, no external services. Processes are tracked either in-memory (MCP mode) or on filesystem (CLI mode).

## Repository Structure

- **Type**: Monolith
- **Primary Language**: TypeScript
- **Module System**: ESM (`"type": "module"`)
- **Source**: `src/` (flat with `app/` and `bin/` subdirs)
- **Tests**: `src/__tests__/`
- **Output**: `dist/`

## Supported AI Agents

| Agent | CLI Tool | Permission Flag | Output Format |
|-------|----------|----------------|---------------|
| Claude | `claude` | `--dangerously-skip-permissions` | stream-json (NDJSON) |
| Codex | codex | `--full-auto` | JSON |
| Gemini | gemini | `-y` | JSON |

## Key Capabilities

1. **Async process spawning** — `run` tool returns PID immediately
2. **Multi-model support** — Route to Claude/Codex/Gemini by model name
3. **Model aliases** — `claude-ultra`, `codex-ultra`, `gemini-ultra` with default reasoning
4. **Session resumption** — Pass `session_id` to continue context
5. **Process lifecycle** — list, get_result, wait, kill, cleanup
6. **Structured output parsing** — Each agent's output is parsed into normalized JSON
