# Gamma Integration

BrandRepo uses Gamma's Generate API for the Create -> Gamma presentation workflow. For early beta users, the production path is a per-user Gamma API key stored encrypted in BrandRepo. Gamma OAuth remains the preferred long-term UX, but Gamma's current OAuth app registration is not accepting BrandRepo redirect URIs through the self-serve dynamic registration flow.

## Current Scope

The current production beta path is:

1. User opens Create.
2. User chooses Create a presentation with Gamma.
3. If Gamma is not connected, user opens Connected Apps and saves their own Gamma API key.
4. BrandRepo encrypts the API key and stores it server-side in `brandrepo_external_connections`.
5. BrandRepo collects a short presentation request.
6. BrandRepo assembles repo context from Brand Basics, Messaging, Voice & Tone, Audiences, Identity, Colors, Typography, and public visual asset URLs.
7. BrandRepo calls Gamma from a server route using the user's connected Gamma API key.
8. BrandRepo polls Gamma until the generation completes.
9. User opens the generated presentation in Gamma.

This is a direct app-to-Gamma integration. It does not use Gamma MCP. MCP is useful when an AI client wants to call Gamma tools directly; BrandRepo needs to create a Gamma deck from inside the BrandRepo app.

## Environment

Required server-side environment variables for the API-key beta path:

```bash
EXTERNAL_TOKEN_ENCRYPTION_KEY=...
SUPABASE_SECRET_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` can be used instead of `SUPABASE_SECRET_KEY`.

Optional server-side environment variables for the future Gamma OAuth path:

```bash
GAMMA_CLIENT_ID=...
GAMMA_AUTHORIZATION_URL=...
GAMMA_TOKEN_URL=...
GAMMA_OAUTH_SCOPES=generate
GAMMA_TOKEN_ENDPOINT_AUTH_METHOD=none
```

These values must be set locally and in Vercel. They must not be exposed to the browser.

`GAMMA_CLIENT_SECRET` is optional. Do not set it for Gamma dynamic clients registered with:

```json
{ "token_endpoint_auth_method": "none" }
```

`EXTERNAL_TOKEN_ENCRYPTION_KEY` is used to encrypt third-party provider API keys, access tokens, and refresh tokens before storage. Use a long random secret and keep it stable across deployments.

The future Gamma OAuth redirect URI is:

```text
https://www.brandrepo.dev/api/external/gamma/callback
```

For local testing, also register:

```text
http://localhost:3000/api/external/gamma/callback
```

Gamma OAuth app credentials and endpoint values must come from Gamma's production OAuth setup. Self-serve OAuth dynamic client registration currently rejects BrandRepo redirect URIs, so this path is documented but not the active beta connection method.

## User Connection Flow

### Save Gamma API Key

`POST /api/external/gamma/api-key`

Behavior:

- Requires a signed-in BrandRepo bearer token.
- Accepts a Gamma API key that starts with `sk-gamma-`.
- Encrypts and stores the key in `brandrepo_external_connections`.
- Marks the provider as `gamma` with token type `ApiKey`.

### Start Gamma OAuth

`POST /api/external/gamma/connect`

Behavior:

- Requires a signed-in BrandRepo bearer token.
- Creates a short-lived OAuth state and PKCE verifier.
- Returns a Gamma authorization URL.
- The browser redirects the user to Gamma.

### Gamma Callback

`GET /api/external/gamma/callback`

Behavior:

- Validates OAuth state.
- Exchanges the authorization code for Gamma tokens.
- Encrypts and stores the user's Gamma access and refresh tokens in `brandrepo_external_connections`.
- Redirects back to BrandRepo Connected Apps.

## Routes

### Start Generation

`POST /api/create/gamma`

Input:

```json
{
  "type": "presentation",
  "provider": "gamma",
  "prompt": "Create an investor deck for...",
  "brandId": "repo-id",
  "brandContext": {}
}
```

Behavior:

- Validates the request.
- Requires the signed-in user's connected Gamma account.
- Builds Gamma `inputText` from the user's request and BrandRepo context.
- Sends `POST https://public-api.gamma.app/v1.0/generations`.
- Authenticates with the user's Gamma API key using the `X-API-KEY` header.
- Still supports OAuth bearer tokens if Gamma OAuth is enabled later.
- Returns the Gamma generation ID.

### Poll Generation

`GET /api/create/gamma/:generationId`

Behavior:

- Sends `GET https://public-api.gamma.app/v1.0/generations/:generationId`.
- Authenticates with the user's Gamma API key using the `X-API-KEY` header.
- Still supports OAuth bearer tokens if Gamma OAuth is enabled later.
- Maps Gamma `completed` to BrandRepo `complete`.
- Returns the generated `gammaUrl` when available.
- Maps Gamma `failed` into a user-visible error.

## Prompt Assembly

Gamma expects `inputText` to contain actual content, not only instructions. BrandRepo therefore sends the user's request plus condensed repo context:

- Brand name and website.
- Messaging.
- Voice and tone.
- Audiences.
- Identity rules.
- Colors.
- Typography.
- Public logo, icon, element, and imagery URLs when available.

Short instructions are sent through `additionalInstructions`.

## Acceptance Criteria

- If the user has not connected Gamma, Connected Apps lets them save a Gamma API key.
- If the user has not connected Gamma, the Create drawer asks them to connect Gamma first.
- If Gamma accepts the request, BrandRepo shows a creating state and polls for completion.
- If Gamma completes, BrandRepo displays an Open in Gamma link.
- If Gamma fails, BrandRepo displays the Gamma error.
- Gamma API keys and tokens are encrypted before storage.
- Gamma API keys and tokens never appear in client code or network requests from the browser after saving.

## References

- Gamma developer docs: `https://developers.gamma.app/`
- Gamma Generate API: `https://developers.gamma.app/generations`
- Gamma API help article: `https://help.gamma.app/en/articles/11962420-does-gamma-have-an-api`
