# BrandRepo Integration Docs Index

Use these docs as the source of truth for integrations.

## Strategy

- `docs/integration-architecture.md`
  - Overall technical architecture.
  - Provider strategy for ChatGPT, Claude, Figma, Canva, and future clients.
  - MCP tool policy and read/write safety model.

- `docs/integration-todo.md`
  - Working backlog and completion tracker.

## Auth and Tokens

- `docs/oauth-connectors.md`
  - Production OAuth connector architecture.
  - Claude custom connector setup.
  - OAuth discovery, dynamic registration, token, and revocation endpoints.

- `docs/auth-setup.md`
  - Supabase auth setup.
  - Google OAuth setup.
  - Reset-password redirect setup.
  - Vercel auth environment variables.
  - Integration-token setup sequence.

- `docs/integration-token-architecture.md`
  - Token format.
  - Hashing and storage model.
  - Scopes.
  - Validation path.
  - Developer-testing limitations.

## MCP Testing and Connection

- `docs/mcp-testing.md`
  - Curl-based API and MCP test loop.
  - Local and production bearer-token checks.

- `docs/chatgpt-mcp-connection.md`
  - External MCP client connection guide.
  - Canonical endpoint: `https://www.brandrepo.dev/api/mcp`.
  - Expected tool flow.
  - Troubleshooting.

## Create Workflows

- `docs/gamma-integration.md`
  - Direct Gamma Generate API integration.
  - Current per-user Gamma API-key beta connection.
  - Future Gamma OAuth setup notes.
  - BrandRepo Create -> Gamma presentation workflow.

- `docs/public-repo-sharing.md`
  - Canonical public repo URLs.
  - Copy for AI prompt behavior.
  - AI-readable public markdown route.
  - Public visibility groundwork.
