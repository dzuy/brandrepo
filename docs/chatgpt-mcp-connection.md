# ChatGPT MCP Connection Guide

This document is the source of truth for connecting ChatGPT or another MCP-capable client to BrandRepo.

## Current Endpoint

Use the production MCP endpoint:

```txt
https://www.brandrepo.dev/api/mcp
```

The endpoint is read-only in V1.

Use the final, non-redirecting URL. Some MCP clients and HTTP clients may not preserve `Authorization` headers across redirects.

## What This Enables

An external client can:

- List repos available to the authenticated user.
- Choose the correct repo by id.
- Read repo overview and section completeness.
- Read generated markdown for each repo section.
- Search repo context.
- List and fetch asset metadata.

An external client cannot:

- Create repos.
- Edit repo sections.
- Upload assets.
- Delete assets.
- Save generated outputs back into BrandRepo.

Write behavior should be added later through draft/review workflows, not direct overwrites.

## Required Setup Before Testing

### Supabase

Run the latest `supabase/schema.sql` in the Supabase SQL Editor. This creates:

- `public.brandrepo_integration_tokens`
- indexes for user/token lookup
- RLS policies for users to create, view, and revoke their own tokens

### Vercel

Add one of these server-only environment variables in Vercel:

```txt
SUPABASE_SECRET_KEY
```

or:

```txt
SUPABASE_SERVICE_ROLE_KEY
```

This is required because integration-token validation must look up hashed tokens server-side. Do not expose this value with a `NEXT_PUBLIC_` prefix.

Redeploy after adding the env var.

## Create an Integration Token

1. Open `https://brandrepo.dev`.
2. Sign in.
3. Open Settings.
4. Find Integration tokens.
5. Enter a name, such as `ChatGPT MCP`.
6. Click Create token.
7. Copy the token immediately.

BrandRepo only shows the raw token once. After that, only the token prefix is visible.

Token format:

```txt
brp_...
```

V1 scopes:

```txt
repo:read
assets:read
```

## Configure an MCP Client

Use:

```txt
URL: https://www.brandrepo.dev/api/mcp
Authorization: Bearer brp_...
```

Exact UI varies by MCP client. The important requirement is that every request includes:

```txt
Authorization: Bearer <integration-token>
```

## Expected Tool Flow

External clients should use this order:

1. `initialize`
2. `tools/list`
3. `tools/call` -> `list_repos`
4. Choose one returned repo `id`
5. `tools/call` -> `get_repo_overview`
6. `tools/call` -> `get_repo_context`, `get_section_markdown`, `search_repo`, or `list_assets`

The client should not guess repo ids. It should call `list_repos` first.

## Available V1 Tools

### `list_repos`

Returns repos available to the token owner.

Includes:

- id
- name
- slug
- website URL
- section completeness
- asset counts

### `get_repo_overview`

Returns metadata, section completeness, and asset counts for one repo.

Arguments:

```json
{
  "repo_id": "repo-id"
}
```

### `get_repo_context`

Returns agent-ready repo context for one repo, including section markdown and asset metadata.

Arguments:

```json
{
  "repo_id": "repo-id"
}
```

### `get_section_markdown`

Returns one section as markdown.

Arguments:

```json
{
  "repo_id": "repo-id",
  "section": "messaging"
}
```

Section can be a section key or name, such as:

- `brand-basics`
- `identity`
- `colors`
- `voice-tone`
- `typography`
- `messaging`
- `audiences`
- `channel-seo`
- `imagery`

### `search_repo`

Searches section markdown and asset metadata.

Arguments:

```json
{
  "repo_id": "repo-id",
  "query": "logo"
}
```

### `list_assets`

Lists asset metadata for a repo.

Arguments:

```json
{
  "repo_id": "repo-id",
  "kind": "logo"
}
```

`kind` is optional. Supported kinds:

- `logo`
- `icon`
- `element`
- `imagery`
- `generated`
- `document`
- `other`

### `get_asset`

Fetches metadata for one asset.

Arguments:

```json
{
  "repo_id": "repo-id",
  "asset_id": "asset-id"
}
```

## Safety Rules

V1 is intentionally read-only.

The MCP server:

- Does not expose write tools.
- Does not expose destructive tools.
- Caps response sizes.
- Avoids raw base64 asset data in text context.
- Returns generic JSON-RPC errors instead of internal stack traces.
- Tells clients to call `list_repos` when a repo cannot be found.

## Troubleshooting

### `401 Missing bearer token`

The MCP client did not send an `Authorization` header.

Expected:

```txt
Authorization: Bearer brp_...
```

### `401 Invalid integration token`

The token is wrong, revoked, or not in the database.

Create a new token in Settings and try again.

### `500 Supabase service key is not configured`

Vercel is missing `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`.

Add the env var and redeploy.

### `relation "brandrepo_integration_tokens" does not exist`

The latest `supabase/schema.sql` has not been run.

Run it in Supabase SQL Editor.

### Repo not found

Call `list_repos` first and use one of the returned repo ids.

## Next Evolution

Production external connectors should use the OAuth flow documented in `docs/oauth-connectors.md`. Manually copied integration tokens remain available for developer testing.

Future write behavior should use:

- draft creation
- explicit user review
- explicit approval
- audit logs
