# AI CLI MCP — Development Guide

**Generated**: 2026-03-27 | **Scan level**: Deep (Serena-assisted)

## Prerequisites

- **Node.js** (ES2022 compatible, v18+)
- **npm** (for dependency management)
- At least one AI CLI tool installed:
  - Claude Code (`claude` on PATH, or `~/.claude/local/claude`)
  - Codex CLI (`codex` on PATH)
  - Gemini CLI (`gemini` on PATH)

## Setup

```bash
# Clone and install
git clone <your-fork-url>
cd ai-cli-mcp
npm install

# Build
npm run build

# Verify
npm run test:unit
```

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run dev` | Run MCP server with tsx (hot reload) |
| `npm start` | Run compiled MCP server |
| `npm run test` | Build + run all tests |
| `npm run test:unit` | Unit tests only |
| `npm run test:e2e` | Build + E2E tests (requires real CLIs) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:coverage` | Unit tests with coverage |
| `npm run cli.run` | Run legacy CLI entry |
| `npm run cli.run.parse` | Run parse CLI entry |

## Project Layout

```
src/
├── app/mcp.ts          # MCP server (edit tools here)
├── app/cli.ts           # CLI subcommands
├── process-service.ts   # In-memory process management
├── cli-process-service.ts # Filesystem process management
├── cli-builder.ts       # Command construction
├── model-catalog.ts     # Model definitions
├── parsers.ts           # Output parsers
├── cli-utils.ts         # Binary discovery
└── __tests__/           # All tests
```

## Testing Strategy

- **Unit tests** (`vitest.config.unit.ts`): Test individual functions and classes with mocks. No real CLI binaries needed.
- **E2E tests** (`vitest.config.e2e.ts`): Integration tests that spawn real CLI processes. Require installed AI CLIs.
- **Test helpers**: `src/__tests__/utils/` provides MCP client helpers, Claude mocks, and persistent mocks.

### Running Tests

```bash
# Fast feedback loop (unit only)
npm run test:unit

# Full test suite (builds first)
npm run test

# E2E (requires claude/codex/gemini installed)
npm run test:e2e
```

## Build & Output

- TypeScript compiles to `dist/` via `tsc`
- Entry points: `dist/bin/ai-cli-mcp.js` (MCP server), `dist/bin/ai-cli.js` (CLI)
- Module system: ESM (`"type": "module"` in package.json)
- Must use `.js` extensions in import paths (NodeNext resolution)

## Running Locally as MCP Server

After building, you can test the MCP server locally by configuring your MCP client to use the local build:

```json
{
  "mcpServers": {
    "ai-cli-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/ai-cli-mcp/dist/bin/ai-cli-mcp.js"]
    }
  }
}
```

This replaces the `npx -y ai-cli-mcp@latest` approach for local development.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `CLAUDE_CLI_NAME` | Override Claude binary name/path |
| `CODEX_CLI_NAME` | Override Codex binary name/path |
| `GEMINI_CLI_NAME` | Override Gemini binary name/path |
| `DEBUG` | Enable debug logging |

## CI/CD

- **GitHub Actions**: `.github/workflows/ci.yml` (CI), `test.yml` (tests), `publish.yml` (npm publish)
- **Semantic Release**: Automated versioning and changelog via `.releaserc.json`
- **Husky**: Pre-commit hooks configured in `.husky/`

## Release Process

See `docs/RELEASE_CHECKLIST.md` for the full release process. Uses semantic-release for automated npm publishing on merge to main.
