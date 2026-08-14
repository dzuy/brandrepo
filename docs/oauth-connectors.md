# BrandRepo OAuth Connectors

This document is the source of truth for production external connections to BrandRepo.

BrandRepo now supports OAuth-based remote MCP access for tools such as Claude, and the same foundation should be reused for future integrations such as ChatGPT, Canva, Gamma, and Figma.

## Why OAuth

Manually copied `brp_` integration tokens are useful for developer testing, but they are not the right production connection model for external tools.

Production connectors need:

- user consent
- scoped access
- short-lived access tokens
- refresh tokens
- revocation
- auditability
- a standard connection flow that platforms can discover automatically

## Current Production OAuth Scope

The first OAuth connector surface is read-only.

Supported scopes:

- `repo:read`
- `assets:read`

Do not expose write scopes to external tools until BrandRepo has a draft/review workflow.

## Endpoints

Use the canonical MCP endpoint:

```txt
https://www.brandrepo.dev/api/mcp
```

OAuth discovery:

```txt
https://www.brandrepo.dev/.well-known/oauth-protected-resource
https://www.brandrepo.dev/.well-known/oauth-authorization-server
https://www.brandrepo.dev/.well-known/openid-configuration
```

OAuth flow endpoints:

```txt
https://www.brandrepo.dev/oauth/authorize
https://www.brandrepo.dev/api/oauth/register
https://www.brandrepo.dev/api/oauth/token
https://www.brandrepo.dev/api/oauth/revoke
```

## Supported OAuth Flow

BrandRepo supports:

- OAuth authorization code flow
- PKCE with `S256`
- dynamic client registration
- public clients using `token_endpoint_auth_method: none`
- refresh tokens
- token revocation

The MCP endpoint returns a `401` with `WWW-Authenticate` metadata when a connector calls it without a bearer token. Claude uses that metadata to discover the OAuth server.

## Claude Connection Path

Claude custom connectors are the first real production target. This path was validated successfully against the production BrandRepo endpoint after the OAuth schema update and Vercel redeploy.

In Claude:

1. Open `Settings`.
2. Open `Connectors`.
3. Click `Add custom connector`.
4. Enter:

```txt
https://www.brandrepo.dev/api/mcp
```

5. Let Claude discover OAuth metadata.
6. Sign in to BrandRepo on the consent screen.
7. Approve read-only access.
8. Enable the connector in a Claude conversation.

Expected tools:

- `list_repos`
- `get_repo_overview`
- `get_repo_context`
- `get_section_markdown`
- `search_repo`
- `list_assets`
- `get_asset`

## Database Tables

Run `supabase/schema.sql` before testing OAuth connectors in production.

OAuth tables:

- `public.brandrepo_oauth_clients`
- `public.brandrepo_oauth_authorization_codes`
- `public.brandrepo_oauth_access_tokens`

The Settings UI reads and revokes connected apps through user-scoped RLS policies on `brandrepo_oauth_access_tokens`. Re-run `supabase/schema.sql` after pulling connected-apps changes so local and production Settings can revoke OAuth connector access without requiring a service key in the browser-facing route.

Developer-token tables remain:

- `public.brandrepo_integration_tokens`
- `public.brandrepo_integration_access_logs`

## Connected Apps Management

BrandRepo Settings includes a Connected apps section for OAuth connector access.

Users can:

- view active OAuth connector clients
- see granted scopes
- see when a connector was connected and last used
- revoke a connector's active OAuth tokens

Developer-only tokens remain available in Advanced developer settings for curl, MCP Inspector, and debugging.

## Environment Variables

Required in production:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

`SUPABASE_SERVICE_ROLE_KEY` can be used instead of `SUPABASE_SECRET_KEY`.

Optional:

```txt
BRANDREPO_OAUTH_ISSUER_URL
```

Normally leave this unset so OAuth metadata uses the exact host the connector calls, such as `https://www.brandrepo.dev`. Set it only if BrandRepo later moves OAuth to a dedicated issuer domain.

## Acceptance Criteria

- An unauthenticated MCP request returns `401` plus `WWW-Authenticate` with protected-resource metadata.
- OAuth discovery metadata advertises authorization, token, registration, and revocation endpoints.
- Dynamic client registration creates a client with registered redirect URIs.
- Authorization creates a short-lived code after a signed-in BrandRepo user approves access.
- Token exchange validates PKCE and returns an access token plus refresh token.
- MCP accepts OAuth access tokens.
- MCP still accepts existing `brp_` integration tokens for developer testing.
- OAuth access remains read-only.
