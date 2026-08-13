# BrandRepo API and MCP Testing

This document captures the local test loop for BrandRepo's read-only API and MCP foundation.

## Preferred: Create an Integration Token

1. Open BrandRepo at `https://brandrepo.dev`.
2. Sign in.
3. Open Settings.
4. Use Integration tokens -> Create token.
5. Copy the token immediately. BrandRepo will not show it again.

Integration tokens are scoped for external clients and are the preferred way to test remote MCP access.

```bash
export BRANDREPO_TOKEN="paste-integration-token-here"
export BRANDREPO_BASE_URL="https://www.brandrepo.dev"
```

Server requirement: deployed integration-token validation requires `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in the hosting environment.

Use the final, non-redirecting base URL. If curl returns only `Redirecting...`, switch to the target domain shown in the `location` response header. MCP clients should not rely on redirects because auth headers may not be preserved.

## Fallback: Use a Temporary Developer Token

1. Run BrandRepo locally.
2. Sign in.
3. Open Settings.
4. Use Developer token -> Show token.
5. Copy the token.

This is the current Supabase session access token. Treat it like a password. It is only a temporary developer convenience for local testing.

```bash
export BRANDREPO_TOKEN="paste-token-here"
export BRANDREPO_BASE_URL="http://localhost:3000"
```

## Read-Only API Checks

List repos:

```bash
curl -s "$BRANDREPO_BASE_URL/api/repos" \
  -H "Authorization: Bearer $BRANDREPO_TOKEN"
```

Set the repo id returned by `/api/repos`:

```bash
export BRANDREPO_REPO_ID="repo-id-here"
```

Get full repo context:

```bash
curl -s "$BRANDREPO_BASE_URL/api/repos/$BRANDREPO_REPO_ID/context" \
  -H "Authorization: Bearer $BRANDREPO_TOKEN"
```

Get assets:

```bash
curl -s "$BRANDREPO_BASE_URL/api/repos/$BRANDREPO_REPO_ID/assets" \
  -H "Authorization: Bearer $BRANDREPO_TOKEN"
```

Search repo context:

```bash
curl -s "$BRANDREPO_BASE_URL/api/repos/$BRANDREPO_REPO_ID/search?q=logo" \
  -H "Authorization: Bearer $BRANDREPO_TOKEN"
```

Get one section markdown:

```bash
curl -s "$BRANDREPO_BASE_URL/api/repos/$BRANDREPO_REPO_ID/sections/messaging/markdown" \
  -H "Authorization: Bearer $BRANDREPO_TOKEN"
```

## MCP Checks

Initialize:

```bash
curl -s "$BRANDREPO_BASE_URL/api/mcp" \
  -H "Authorization: Bearer $BRANDREPO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"0.1.0"}}}'
```

List tools:

```bash
curl -s "$BRANDREPO_BASE_URL/api/mcp" \
  -H "Authorization: Bearer $BRANDREPO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

Call `list_repos`:

```bash
curl -s "$BRANDREPO_BASE_URL/api/mcp" \
  -H "Authorization: Bearer $BRANDREPO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_repos","arguments":{}}}'
```

Call `get_repo_context`:

```bash
curl -s "$BRANDREPO_BASE_URL/api/mcp" \
  -H "Authorization: Bearer $BRANDREPO_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":4,\"method\":\"tools/call\",\"params\":{\"name\":\"get_repo_context\",\"arguments\":{\"repo_id\":\"$BRANDREPO_REPO_ID\"}}}"
```

Call `get_section_markdown`:

```bash
curl -s "$BRANDREPO_BASE_URL/api/mcp" \
  -H "Authorization: Bearer $BRANDREPO_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":5,\"method\":\"tools/call\",\"params\":{\"name\":\"get_section_markdown\",\"arguments\":{\"repo_id\":\"$BRANDREPO_REPO_ID\",\"section\":\"messaging\"}}}"
```

Call `list_assets`:

```bash
curl -s "$BRANDREPO_BASE_URL/api/mcp" \
  -H "Authorization: Bearer $BRANDREPO_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":6,\"method\":\"tools/call\",\"params\":{\"name\":\"list_assets\",\"arguments\":{\"repo_id\":\"$BRANDREPO_REPO_ID\"}}}"
```

## Acceptance

This step is acceptable when:

- Settings can create a scoped integration token for external clients.
- Settings exposes a temporary developer token for debugging the signed-in session.
- Requests without a bearer token return `401`.
- Requests with the copied bearer token can list repos owned by the signed-in user.
- Read-only API endpoints return repo context, section markdown, assets, and search results.
- `/api/mcp` responds to `initialize`, `tools/list`, and read-only `tools/call` requests.
- MCP write tools are not exposed.
