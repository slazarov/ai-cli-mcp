# AI CLI MCP — API Contracts (MCP Tools)

**Generated**: 2026-03-27 | **Scan level**: Deep (Serena-assisted)

## Transport

- **Protocol**: MCP (Model Context Protocol) over JSON-RPC
- **Transport**: stdio (StdioServerTransport)
- **Server name**: `ai-cli-mcp`

## MCP Tools

### `run`

Starts a Claude, Codex, or Gemini CLI process in the background.

**Input Schema**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workFolder` | string | **yes** | Absolute path to working directory |
| `prompt` | string | one of prompt/prompt_file | Natural language prompt |
| `prompt_file` | string | one of prompt/prompt_file | Path to file containing prompt |
| `model` | string | no | Model name or alias (default: Claude sonnet) |
| `reasoning_effort` | string | no | Reasoning level: low/medium/high (Claude), low/medium/high/xhigh (Codex) |
| `session_id` | string | no | Resume a previous session |

**Response**: `StartProcessResult`
```json
{
  "pid": 12345,
  "status": "started",
  "agent": "claude",
  "message": "claude process started successfully"
}
```

**Errors**:
- `InvalidParams` — Missing/invalid workFolder, prompt, or conflicting prompt+prompt_file
- `InternalError` — Failed to start CLI process (binary not found, spawn failure)

---

### `list_processes`

Lists all tracked processes.

**Input Schema**: No parameters.

**Response**: `ProcessListItem[]`
```json
[
  { "pid": 12345, "agent": "claude", "status": "running" },
  { "pid": 12346, "agent": "codex", "status": "completed" }
]
```

---

### `get_result`

Gets current output and status of a process.

**Input Schema**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pid` | number | **yes** | Process ID from `run` |
| `verbose` | boolean | no | Include tool usage history (default: false) |

**Response**: Process output with parsed results including `message`, `session_id`, `tools` (if verbose), and process metadata.

---

### `wait`

Blocks until specified processes complete or timeout.

**Input Schema**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pids` | number[] | **yes** | Process IDs to wait for |
| `timeout` | number | no | Max wait in seconds (default: 180) |

**Response**: Array of results for each PID.

---

### `kill_process`

Terminates a running process.

**Input Schema**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pid` | number | **yes** | Process ID to terminate |

**Response**: Kill confirmation with status.

---

### `cleanup_processes`

Removes all completed and failed processes from tracking.

**Input Schema**: No parameters.

**Response**: Cleanup summary.

---

## CLI Commands (ai-cli)

The CLI mirrors the MCP tools with filesystem persistence:

| Command | Equivalent MCP Tool | Key Flags |
|---------|---------------------|-----------|
| `ai-cli run` | `run` | `--cwd`, `--prompt`, `--prompt-file`, `--model`, `--session-id`, `--reasoning-effort` |
| `ai-cli ps` | `list_processes` | — |
| `ai-cli result <pid>` | `get_result` | `--verbose` |
| `ai-cli wait <pid...>` | `wait` | `--timeout` |
| `ai-cli kill <pid>` | `kill_process` | — |
| `ai-cli cleanup` | `cleanup_processes` | — |
| `ai-cli models` | *(no equivalent)* | — |
| `ai-cli doctor` | *(no equivalent)* | — |
| `ai-cli mcp` | *(starts MCP server)* | — |

## Model Resolution

Models are resolved in order:
1. Check `MODEL_ALIASES` (e.g., `claude-ultra` → `claude-sonnet-4-6`)
2. Check if model exists in `CLAUDE_MODELS`, `CODEX_MODELS`, or `GEMINI_MODELS`
3. Default: treat as Claude model

Agent type is inferred from the resolved model name — no separate `agent` parameter needed.
