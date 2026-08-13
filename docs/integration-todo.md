# BrandRepo Integration To-Do

This is the working backlog for BrandRepo integrations, auth, and external tool access. The source-of-truth architecture is in `docs/integration-architecture.md`.

## Next

- [ ] Configure Google provider in Supabase Auth and Google Cloud.
- [ ] Add `https://brandrepo.dev/**` to Supabase Auth redirect URLs after the production domain is connected.
- [ ] Add `https://brandrepo.dev` and `https://www.brandrepo.dev` to Google OAuth authorized JavaScript origins after the production domain is connected.
- [x] Add a temporary developer token view in Settings for local API/MCP testing.
- [x] Add scoped integration tokens for external API/MCP testing.
- [x] Document authenticated curl examples for read-only API endpoints.
- [x] Document authenticated curl examples for `/api/mcp`.
- [x] Document ChatGPT / external MCP connection flow.
- [x] Document integration-token architecture.
- [x] Test `/api/repos` with a real signed-in Supabase bearer token.
- [x] Test `/api/repos/:repoId/context` with a real signed-in Supabase bearer token.
- [x] Test `/api/repos/:repoId/assets` with a real signed-in Supabase bearer token.
- [x] Test `/api/repos/:repoId/search?q=logo` with a real signed-in Supabase bearer token.
- [x] Test MCP `initialize`.
- [x] Test MCP `tools/list`.
- [x] Test MCP `tools/call` for `list_repos`.
- [x] Test MCP `tools/call` for `get_repo_context`.
- [x] Test MCP `tools/call` for `get_section_markdown`.
- [x] Test MCP `tools/call` for `list_assets`.
- [x] Test deployed `/api/repos` and `/api/mcp` on Vercel with a real signed-in bearer token.

## Auth

- [x] Add reset password flow through Supabase Auth.
- [x] Add Google login through Supabase Auth in the BrandRepo app.
- [x] Keep email/password login available unless there is a product reason to remove it.
- [ ] Configure Supabase Google provider with the Google OAuth client ID and secret.
- [ ] Configure Supabase Auth URL settings for local, Vercel, and production domains.
- [ ] Configure Google OAuth consent screen branding for BrandRepo.
- [ ] Decide whether to add a Supabase custom auth domain such as `auth.brandrepo.dev`.
- [ ] Add account linking expectations for users who sign up with email and later use Google.
- [x] Define production integration auth strategy.
- [x] Decide whether early external integrations use developer tokens, personal access tokens, or OAuth.
- [x] Add token scopes such as `repo:read`, `assets:read`, `drafts:write`, and `repo:write`.
- [x] Add `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to Vercel for integration-token validation.
- [x] Run updated `supabase/schema.sql` in Supabase SQL Editor to create integration token storage.
- [x] Create a real integration token in production Settings.
- [x] Test `https://www.brandrepo.dev/api/mcp` with a real `brp_` integration token.
- [x] Add audit logging for external API/MCP access.
- [ ] Re-run updated `supabase/schema.sql` in Supabase SQL Editor to create integration access log storage.

## ChatGPT MCP

- [ ] Confirm hosted MCP endpoint path: `/api/mcp` or `mcp.brandrepo.dev`.
- [ ] Validate read-only MCP behavior with an external MCP client.
- [x] Add production-safe error responses for MCP tool calls.
- [x] Add response size limits per MCP tool.
- [x] Add repo selection behavior for users with multiple repos.
- [x] Add documentation for connecting BrandRepo to ChatGPT once the connection flow is available.

## Later Integrations

- [ ] Claude MCP support using the same Repo Context Service.
- [ ] Figma integration for logos, colors, typography, and identity rules.
- [ ] Canva integration for approved assets and brand-kit workflows.
- [ ] Draft workflow for external tools to propose repo updates without directly overwriting sections.
- [ ] Save generated external assets back into BrandRepo after explicit user approval.
