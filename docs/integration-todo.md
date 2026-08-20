# BrandRepo Integration To-Do

This is the working backlog for BrandRepo integrations, auth, and external tool access. The source-of-truth architecture is in `docs/integration-architecture.md`.

## Current Direction

- [x] Use the public "Copy for AI" markdown URL as the current external-tool workflow.
- [x] Test the public AI-readable markdown URL with ChatGPT.
- [ ] Keep the public AI-readable markdown output polished, complete, and easy for external AI tools to use.
- [ ] Make sure public AI-readable markdown includes direct public asset URLs for logos, icons, elements, imagery, and generated assets.
- [ ] Revisit direct integrations only after the core public repo and AI-readable markdown workflow are strong.

## Next

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
- [ ] Test Google OAuth account creation and returning-user sign-in end to end.
  - New users can create a BrandRepo account with Google.
  - Required account name is captured and saved during or immediately after Google signup.
  - Returning Google users sign in without recreating account details.
  - Repos created after Google signup are tied to the authenticated user.
  - Localhost, Vercel preview, and production redirect URLs all return users to BrandRepo successfully.
  - Canceled or failed Google OAuth attempts show a clear, recoverable error state.
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
- [x] Add OAuth foundation for production external connectors.
- [x] Add OAuth discovery metadata for remote MCP clients.
- [x] Add OAuth dynamic client registration.
- [x] Add OAuth authorization-code with PKCE token exchange.
- [x] Add OAuth refresh-token and revocation endpoints.
- [x] Re-run updated `supabase/schema.sql` in Supabase SQL Editor to create OAuth connector storage.
- [x] Deploy OAuth connector routes to Vercel.
- [x] Validate Claude custom connector against `https://www.brandrepo.dev/api/mcp`.
- [x] Add connected-apps management UI for viewing and revoking OAuth connector access.

## ChatGPT MCP

- [ ] Paused: direct ChatGPT MCP integration is not the current path.
- [ ] Confirm hosted MCP endpoint path: `/api/mcp` or `mcp.brandrepo.dev`.
- [ ] Validate read-only MCP behavior with an external MCP client.
- [x] Add production-safe error responses for MCP tool calls.
- [x] Add response size limits per MCP tool.
- [x] Add repo selection behavior for users with multiple repos.
- [x] Add documentation for connecting BrandRepo to ChatGPT once the connection flow is available.

## Later Integrations

- [ ] Paused: direct integrations are deferred while BrandRepo uses the public "Copy for AI" markdown workflow.
- [x] Claude MCP support using the same Repo Context Service.
- [ ] Figma integration for logos, colors, typography, and identity rules.
- [ ] Canva integration for approved assets and brand-kit workflows.
- [x] Add initial direct Gamma Generate API route for Create -> presentation.
- [x] Add Connect Gamma OAuth flow and encrypted outbound provider token storage.
- [ ] Register BrandRepo as a Gamma OAuth app and confirm production OAuth endpoint values.
- [x] Support Gamma public PKCE OAuth clients with `token_endpoint_auth_method=none`.
- [x] Add Gamma API-key beta connection flow using encrypted per-user keys.
- [ ] Add `EXTERNAL_TOKEN_ENCRYPTION_KEY` to local and Vercel environments.
- [ ] Add future OAuth vars only after Gamma accepts BrandRepo redirect URIs: `GAMMA_CLIENT_ID`, `GAMMA_AUTHORIZATION_URL`, `GAMMA_TOKEN_URL`, `GAMMA_OAUTH_SCOPES`, and `GAMMA_TOKEN_ENDPOINT_AUTH_METHOD`.
- [ ] Run updated `supabase/schema.sql` in Supabase SQL Editor to create external connection storage.
- [ ] Test Connect Gamma API-key flow against a real Gamma account.
- [ ] Test Create -> Gamma against a connected user-owned Gamma API key.
- [ ] Decide whether to support Gamma themes through stored `themeId` values.
- [ ] Save generated Gamma links back into BrandRepo Assets or Create history.
- [ ] Draft workflow for external tools to propose repo updates without directly overwriting sections.
- [ ] Save generated external assets back into BrandRepo after explicit user approval.
