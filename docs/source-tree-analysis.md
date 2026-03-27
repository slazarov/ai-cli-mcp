# AI CLI MCP — Source Tree Analysis

**Generated**: 2026-03-27 | **Scan level**: Deep (Serena-assisted)

## Directory Structure

```
ai-cli-mcp/
├── src/                          # All source code
│   ├── server.ts                 # Re-exports: debugLog, findCli*, resolveModelAlias, ClaudeCodeServer, runMcpServer, spawnAsync
│   ├── app/
│   │   ├── mcp.ts                # ClaudeCodeServer class — MCP server with 6 tool handlers
│   │   └── cli.ts                # CLI app — subcommands: run, ps, result, wait, kill, cleanup, models, doctor, mcp
│   ├── bin/
│   │   ├── ai-cli-mcp.ts         # MCP server bin entry point (→ runMcpServer)
│   │   └── ai-cli.ts             # CLI bin entry point (→ runCli)
│   ├── process-service.ts        # ProcessService — in-memory process management (Map<pid, TrackedProcess>)
│   ├── cli-process-service.ts    # CliProcessService — filesystem-persisted process management (~/.ai-cli-mcp/)
│   ├── cli-builder.ts            # buildCliCommand() — constructs agent-specific CLI commands
│   ├── model-catalog.ts          # Model lists, aliases, and descriptions for Claude/Codex/Gemini
│   ├── parsers.ts                # Output parsers: parseClaudeOutput, parseCodexOutput, parseGeminiOutput
│   ├── cli-utils.ts              # CLI binary discovery, PATH resolution, doctor status
│   ├── cli.ts                    # Alternative CLI entry point (legacy)
│   └── cli-parse.ts              # Parse CLI entry point with agent type selection
│
├── src/__tests__/                # Test suite
│   ├── server.test.ts            # Server integration tests
│   ├── mcp-contract.test.ts      # MCP protocol contract tests
│   ├── process-management.test.ts # Process lifecycle tests
│   ├── cli-process-service.test.ts # CliProcessService tests
│   ├── cli-builder.test.ts       # CLI command building tests
│   ├── parsers.test.ts           # Output parser tests
│   ├── cli-utils.test.ts         # CLI binary discovery tests
│   ├── app-cli.test.ts           # CLI app subcommand tests
│   ├── cli-bin-smoke.test.ts     # Bin entry point smoke tests
│   ├── model-alias.test.ts       # Model alias resolution tests
│   ├── version-print.test.ts     # Version output tests
│   ├── validation.test.ts        # Input validation tests
│   ├── error-cases.test.ts       # Error handling tests
│   ├── edge-cases.test.ts        # Edge case tests
│   ├── wait.test.ts              # Wait tool tests
│   ├── e2e.test.ts               # End-to-end tests (requires real CLIs)
│   ├── mocks.ts                  # Shared mock definitions
│   ├── setup.ts                  # Test setup/teardown
│   └── utils/
│       ├── test-helpers.ts       # Test utility functions
│       ├── mcp-client.ts         # MCP client test helper
│       ├── claude-mock.ts        # Claude CLI mock
│       └── persistent-mock.ts    # Persistent process mock
│
├── docs/                         # Documentation (generated + manual)
│   ├── prd.md                    # Product Requirements Document
│   ├── concept.md                # Concept documentation
│   ├── cli-architecture.md       # CLI architecture notes
│   ├── development.md            # Development guide
│   ├── e2e-testing.md            # E2E testing guide
│   ├── session-stacking.md       # Session stacking feature
│   ├── RELEASE_CHECKLIST.md      # Release process
│   └── assets/                   # Demo GIFs and videos
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                # CI pipeline
│   │   ├── test.yml              # Test workflow
│   │   ├── publish.yml           # npm publish workflow
│   │   └── watch-session-prs.yml # PR watching automation
│   └── pull_request_template.md  # PR template
│
├── .husky/                       # Git hooks (Husky)
├── package.json                  # npm manifest (v2.12.0)
├── tsconfig.json                 # TypeScript config (ES2022, NodeNext, strict)
├── vitest.config.ts              # Default vitest config
├── vitest.config.unit.ts         # Unit test config
├── vitest.config.e2e.ts          # E2E test config
├── .releaserc.json               # Semantic release config
├── server.json                   # MCP server descriptor
└── CONTRIBUTING.md               # Contribution guidelines
```

## Critical Files

| File | Role | Why Critical |
|------|------|-------------|
| `src/app/mcp.ts` | MCP server | All tool definitions and request routing |
| `src/process-service.ts` | Process management | Core spawn/track/kill logic |
| `src/cli-builder.ts` | Command building | Agent-specific CLI arg construction |
| `src/model-catalog.ts` | Model registry | Defines supported models and aliases |
| `src/parsers.ts` | Output parsing | Normalizes agent output to structured JSON |
| `src/cli-utils.ts` | Binary discovery | Finds CLI executables on the system |

## Entry Points

| Entry Point | File | Purpose |
|------------|------|---------|
| MCP Server | `src/bin/ai-cli-mcp.ts` → `src/app/mcp.ts` | stdio MCP server |
| CLI | `src/bin/ai-cli.ts` → `src/app/cli.ts` | Human CLI |
| Dev Server | `src/server.ts` | Re-export hub + dev entry |
