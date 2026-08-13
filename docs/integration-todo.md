# BrandRepo Integration To-Do

This is the working backlog for BrandRepo integrations, auth, and external tool access. The source-of-truth architecture is in `docs/integration-architecture.md`.

## Next

- [ ] Add a temporary developer token view in Settings for local API/MCP testing.
- [ ] Document authenticated curl examples for read-only API endpoints.
- [ ] Document authenticated curl examples for `/api/mcp`.
- [ ] Test `/api/repos` with a real signed-in Supabase bearer token.
- [ ] Test `/api/repos/:repoId/context` with a real signed-in Supabase bearer token.
- [ ] Test `/api/repos/:repoId/assets` with a real signed-in Supabase bearer token.
- [ ] Test `/api/repos/:repoId/search?q=logo` with a real signed-in Supabase bearer token.
- [ ] Test MCP `initialize`.
- [ ] Test MCP `tools/list`.
- [ ] Test MCP `tools/call` for `list_repos`.
- [ ] Test MCP `tools/call` for `get_repo_context`.
- [ ] Test MCP `tools/call` for `get_section_markdown`.
- [ ] Test MCP `tools/call` for `list_assets`.

## Auth

- [ ] Add Google login through Supabase Auth.
- [ ] Keep email/password login available unless there is a product reason to remove it.
- [ ] Add account linking expectations for users who sign up with email and later use Google.
- [ ] Define production integration auth strategy.
- [ ] Decide whether early external integrations use developer tokens, personal access tokens, or OAuth.
- [ ] Add token scopes such as `repo:read`, `assets:read`, `drafts:write`, and `repo:write`.
- [ ] Add audit logging for external API/MCP access.

## ChatGPT MCP

- [ ] Confirm hosted MCP endpoint path: `/api/mcp` or `mcp.brandrepo.dev`.
- [ ] Validate read-only MCP behavior with an external MCP client.
- [ ] Add production-safe error responses for MCP tool calls.
- [ ] Add response size limits per MCP tool.
- [ ] Add repo selection behavior for users with multiple repos.
- [ ] Add documentation for connecting BrandRepo to ChatGPT once the connection flow is available.

## Later Integrations

- [ ] Claude MCP support using the same Repo Context Service.
- [ ] Figma integration for logos, colors, typography, and identity rules.
- [ ] Canva integration for approved assets and brand-kit workflows.
- [ ] Draft workflow for external tools to propose repo updates without directly overwriting sections.
- [ ] Save generated external assets back into BrandRepo after explicit user approval.

