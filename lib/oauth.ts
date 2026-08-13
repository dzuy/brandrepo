import { createClient } from "@supabase/supabase-js";
import { RepoAccessError } from "./access-errors";
import { hashIntegrationToken, tokenPrefix } from "./integration-tokens";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

export const oauthAccessTokenPrefix = "bra_";
export const oauthRefreshTokenPrefix = "brr_";
export const oauthAuthorizationCodePrefix = "brc_";
export const oauthDefaultScopes = ["repo:read", "assets:read"] as const;
export const oauthAllowedScopes = [...oauthDefaultScopes] as const;

export type OAuthScope = (typeof oauthAllowedScopes)[number];

export type OAuthClientRow = {
  id: string;
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  created_at: string;
};

export type OAuthAccessTokenRow = {
  id: string;
  user_id: string;
  client_id: string;
  access_token_hash: string;
  token_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string;
  revoked_at: string | null;
  refresh_token_hash: string | null;
  refresh_token_expires_at: string | null;
};

export type OAuthAuthorizePayload = {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  code_challenge: string;
  code_challenge_method: string;
};

export function createServiceSupabase() {
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new RepoAccessError("Supabase service key is not configured.", 500);
  }

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function base64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

export function createOpaqueSecret(prefix: string) {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `${prefix}${base64Url(bytes)}`;
}

export function isOAuthAccessToken(token: string) {
  return token.startsWith(oauthAccessTokenPrefix);
}

export function normalizeScopes(scope: string | string[] | null | undefined) {
  const requested = Array.isArray(scope) ? scope : (scope ?? "").split(/\s+/);
  const clean = requested.map((value) => value.trim()).filter(Boolean);
  const scopes = clean.length ? clean : [...oauthDefaultScopes];
  const allowed = scopes.filter((value): value is OAuthScope => oauthAllowedScopes.includes(value as OAuthScope));
  return Array.from(new Set(allowed.length ? allowed : [...oauthDefaultScopes]));
}

export function assertValidRedirectUri(client: Pick<OAuthClientRow, "redirect_uris">, redirectUri: string) {
  if (!client.redirect_uris.includes(redirectUri)) {
    throw new RepoAccessError("Invalid OAuth redirect_uri.", 400);
  }
}

export async function pkceChallengeForVerifier(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return Buffer.from(new Uint8Array(digest)).toString("base64url");
}

export async function verifyPkce(verifier: string, challenge: string, method: string) {
  if (method !== "S256") return false;
  const computed = await pkceChallengeForVerifier(verifier);
  return timingSafeEqual(computed, challenge);
}

export function timingSafeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;

  let mismatch = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    mismatch |= leftBytes[index] ^ rightBytes[index];
  }
  return mismatch === 0;
}

export async function hashOAuthSecret(secret: string) {
  return hashIntegrationToken(secret);
}

export function publicBaseUrl(request: Request) {
  const configured = process.env.BRANDREPO_OAUTH_ISSUER_URL;
  if (configured) return configured.replace(/\/$/, "");

  const url = new URL(request.url);
  return url.origin;
}

export function oauthMetadata(baseUrl: string) {
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/api/oauth/token`,
    registration_endpoint: `${baseUrl}/api/oauth/register`,
    revocation_endpoint: `${baseUrl}/api/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: oauthAllowedScopes,
  };
}

export function protectedResourceMetadata(baseUrl: string) {
  return {
    resource: `${baseUrl}/api/mcp`,
    authorization_servers: [baseUrl],
    bearer_methods_supported: ["header"],
    scopes_supported: oauthAllowedScopes,
    resource_documentation: `${baseUrl}/docs/integration-architecture`,
  };
}

export function oauthUnauthorizedResponse(request: Request, message = "Missing bearer token.") {
  const baseUrl = publicBaseUrl(request);
  return Response.json(
    { error: message },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource", scope="${oauthDefaultScopes.join(" ")}"`,
      },
    },
  );
}

export async function loadOAuthAccessToken(token: string) {
  const serviceSupabase = createServiceSupabase();
  const tokenHash = await hashOAuthSecret(token);
  const { data, error } = await serviceSupabase
    .from("brandrepo_oauth_access_tokens")
    .select(
      "id,user_id,client_id,access_token_hash,token_prefix,scopes,created_at,last_used_at,expires_at,revoked_at,refresh_token_hash,refresh_token_expires_at",
    )
    .eq("access_token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw new RepoAccessError("Unable to validate OAuth access token.", 500);
  }

  const accessToken = data as OAuthAccessTokenRow | null;
  if (!accessToken || accessToken.revoked_at) {
    throw new RepoAccessError("Invalid OAuth access token.", 401);
  }

  if (new Date(accessToken.expires_at).getTime() < Date.now()) {
    throw new RepoAccessError("OAuth access token expired.", 401);
  }

  if (!accessToken.scopes.includes("repo:read")) {
    throw new RepoAccessError("OAuth access token is missing repo:read scope.", 403);
  }

  await serviceSupabase
    .from("brandrepo_oauth_access_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", accessToken.id);

  return { accessToken, serviceSupabase };
}

export function serializeClient(row: OAuthClientRow) {
  return {
    client_id: row.client_id,
    client_name: row.client_name,
    redirect_uris: row.redirect_uris,
    grant_types: row.grant_types,
    response_types: row.response_types,
    token_endpoint_auth_method: row.token_endpoint_auth_method,
  };
}

export async function createAccessTokenRecord({
  userId,
  clientId,
  scopes,
}: {
  userId: string;
  clientId: string;
  scopes: string[];
}) {
  const serviceSupabase = createServiceSupabase();
  const accessToken = createOpaqueSecret(oauthAccessTokenPrefix);
  const refreshToken = createOpaqueSecret(oauthRefreshTokenPrefix);
  const now = Date.now();
  const expiresAt = new Date(now + 60 * 60 * 1000).toISOString();
  const refreshExpiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await serviceSupabase.from("brandrepo_oauth_access_tokens").insert({
    user_id: userId,
    client_id: clientId,
    access_token_hash: await hashOAuthSecret(accessToken),
    token_prefix: tokenPrefix(accessToken),
    scopes,
    expires_at: expiresAt,
    refresh_token_hash: await hashOAuthSecret(refreshToken),
    refresh_token_expires_at: refreshExpiresAt,
  });

  if (error) {
    throw new RepoAccessError("Unable to issue OAuth access token.", 500);
  }

  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: refreshToken,
    scope: scopes.join(" "),
  };
}
