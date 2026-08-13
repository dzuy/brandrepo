# Integration Token Architecture

This document defines BrandRepo's V1 integration-token approach for external API and MCP access.

## Purpose

Integration tokens bridge the gap between:

- temporary Supabase session bearer tokens used for local debugging
- future OAuth account-connection flows

They give external clients a stable bearer token without exposing Supabase anon keys or raw user sessions.

## Token Format

Raw tokens use the `brp_` prefix:

```txt
brp_<random-secret>
```

The prefix makes token handling explicit in code. BrandRepo can distinguish integration tokens from Supabase session access tokens.

## Storage Model

Raw tokens are shown once during creation and are never stored.

BrandRepo stores:

- token hash
- token prefix
- token name
- user id
- scopes
- created timestamp
- last-used timestamp
- optional expiration timestamp
- optional revoked timestamp

Token hashes use SHA-256.

Table:

```txt
public.brandrepo_integration_tokens
```

The table definition and RLS policies live in `supabase/schema.sql`.

## V1 Scopes

Default scopes:

```txt
repo:read
assets:read
```

Planned scopes:

```txt
repo:write
assets:write
drafts:write
```

V1 read-only MCP requires `repo:read`.

## Server Validation

Integration-token validation happens server-side:

1. Read `Authorization: Bearer ...`.
2. Detect `brp_` prefix.
3. Hash the token.
4. Look up the hash in `public.brandrepo_integration_tokens`.
5. Reject revoked or expired tokens.
6. Confirm required scopes.
7. Load repos for the token owner.
8. Update `last_used_at`.

The server needs one of these environment variables:

```txt
SUPABASE_SECRET_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Do not expose either key to the browser.

## Session Token Fallback

Supabase session bearer tokens still work for local debugging.

The Settings page includes a temporary Developer token view that exposes the current Supabase session access token. This should not be treated as the production integration path.

## Revocation

Revoking a token sets `revoked_at`.

Revoked tokens remain in the database for auditability and UI history, but they no longer authenticate.

## Current Limitations

- No token expiration UI yet.
- No per-repo scoping yet.
- No audit log table yet.
- No OAuth connection flow yet.
- No write scopes are active.

## Acceptance

This system is acceptable for V1 when:

- Users can create an integration token from Settings.
- The raw token is shown once.
- The stored database row contains only a hash, not the raw token.
- Users can revoke tokens.
- MCP/API endpoints accept valid `brp_` tokens.
- MCP/API endpoints reject revoked, expired, missing, or malformed tokens.
- Read-only MCP tools remain the only exposed tools.
