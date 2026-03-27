# AI CLI MCP — Documentation Index

## Project Overview

- **Type**: Monolith (MCP server + CLI tool)
- **Primary Language**: TypeScript (ESM, strict mode)
- **Architecture**: Service-based — MCP tool handlers → ProcessService → child_process.spawn
- **Purpose**: Run AI CLI tools (Claude, Codex, Gemini) as background processes via MCP protocol

### Quick Reference

- **Tech Stack**: TypeScript, Node.js, MCP SDK, Zod, Vitest
- **Entry Points**: `dist/bin/ai-cli-mcp.js` (MCP server), `dist/bin/ai-cli.js` (CLI)
- **Architecture Pattern**: Service layer with in-memory and filesystem persistence variants

## Generated Documentation

- [Project Overview](./project-overview.md) — Purpose, tech stack, capabilities
- [Architecture](./architecture.md) — Component design, data flow, design decisions
- [Source Tree Analysis](./source-tree-analysis.md) — Annotated directory structure, critical files
- [API Contracts (MCP Tools)](./api-contracts.md) — All 6 MCP tools, CLI commands, model resolution
- [Development Guide](./development-guide.md) — Setup, commands, testing, local MCP config

## Existing Documentation

- [Product Requirements (PRD)](./prd.md) — Original product requirements
- [Concept](./concept.md) — Conceptual design
- [CLI Architecture](./cli-architecture.md) — CLI-specific architecture notes
- [Development](./development.md) — Original development guide
- [E2E Testing](./e2e-testing.md) — End-to-end testing guide
- [Session Stacking](./session-stacking.md) — Session resumption feature design
- [Release Checklist](./RELEASE_CHECKLIST.md) — Release process

## Getting Started

```bash
# Install dependencies
npm install

# Build
npm run build

# Run unit tests
npm run test:unit

# Run as local MCP server (replace npx -y ai-cli-mcp@latest)
node dist/bin/ai-cli-mcp.js
```

For local MCP client configuration, point to the built binary instead of npx:
```json
{
  "mcpServers": {
    "ai-cli-mcp": {
      "command": "node",
      "args": ["/path/to/ai-cli-mcp/dist/bin/ai-cli-mcp.js"]
    }
  }
}
```
