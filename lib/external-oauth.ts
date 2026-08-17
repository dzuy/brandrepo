import { createServiceSupabase } from "./oauth";
import { authenticateSupabaseRequest } from "./repo-access";

export type ExternalProvider = "gamma";

export type ExternalConnectionRow = {
  id: string;
  user_id: string;
  provider: ExternalProvider;
  provider_account_label: string | null;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string | null;
  token_type: string;
  scopes: string[];
  expires_at: string | null;
  connected_at: string;
  updated_at: string;
  revoked_at: string | null;
};

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
};

const encryptionKeyEnv = "EXTERNAL_TOKEN_ENCRYPTION_KEY";

function getEncryptionSecret() {
  const secret = process.env[encryptionKeyEnv] ?? process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error(`${encryptionKeyEnv} is not configured.`);
  }
  return secret;
}

async function getEncryptionKey() {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(getEncryptionSecret()));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function encodeBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

function decodeBase64Url(value: string) {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

export async function encryptExternalToken(token: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getEncryptionKey();
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token));
  return `${encodeBase64Url(iv)}.${encodeBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptExternalToken(encrypted: string) {
  const [ivValue, ciphertextValue] = encrypted.split(".");
  if (!ivValue || !ciphertextValue) throw new Error("Invalid encrypted token.");
  const key = await getEncryptionKey();
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBase64Url(ivValue) },
    key,
    decodeBase64Url(ciphertextValue),
  );
  return new TextDecoder().decode(plaintext);
}

export function gammaOAuthConfig(request?: Request) {
  const origin = request ? new URL(request.url).origin : (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.BRANDREPO_OAUTH_ISSUER_URL);
  return {
    clientId: process.env.GAMMA_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.GAMMA_CLIENT_SECRET?.trim() ?? "",
    authorizationUrl: process.env.GAMMA_AUTHORIZATION_URL?.trim() ?? "",
    tokenUrl: process.env.GAMMA_TOKEN_URL?.trim() ?? "",
    scopes: (process.env.GAMMA_OAUTH_SCOPES?.trim() || "generate").split(/\s+/).filter(Boolean),
    tokenEndpointAuthMethod: process.env.GAMMA_TOKEN_ENDPOINT_AUTH_METHOD?.trim() || "none",
    redirectUri: `${(origin || "http://localhost:3000").replace(/\/$/, "")}/api/external/gamma/callback`,
  };
}

export function assertGammaOAuthConfigured(request?: Request) {
  const config = gammaOAuthConfig(request);
  const missing = [
    ["GAMMA_CLIENT_ID", config.clientId],
    ["GAMMA_AUTHORIZATION_URL", config.authorizationUrl],
    ["GAMMA_TOKEN_URL", config.tokenUrl],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (config.tokenEndpointAuthMethod !== "none" && !config.clientSecret) {
    missing.push("GAMMA_CLIENT_SECRET");
  }

  if (missing.length) {
    throw new Error(`Gamma OAuth is not configured. Missing ${missing.join(", ")}.`);
  }

  return config;
}

export function gammaTokenRequestHeaders(config: ReturnType<typeof gammaOAuthConfig>) {
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (config.tokenEndpointAuthMethod !== "none") {
    headers.Authorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`;
  }

  return headers;
}

export function gammaTokenRequestBody(config: ReturnType<typeof gammaOAuthConfig>, values: Record<string, string>) {
  const body = new URLSearchParams(values);

  if (config.tokenEndpointAuthMethod === "none") {
    body.set("client_id", config.clientId);
  }

  return body;
}

export function createExternalState() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return encodeBase64Url(bytes);
}

export async function createPkcePair() {
  const verifier = createExternalState();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return {
    verifier,
    challenge: encodeBase64Url(new Uint8Array(digest)),
  };
}

export async function storeExternalConnection({
  provider,
  token,
  userId,
}: {
  provider: ExternalProvider;
  token: TokenResponse;
  userId: string;
}) {
  if (!token.access_token) {
    throw new Error("Gamma did not return an access token.");
  }

  const expiresAt =
    typeof token.expires_in === "number" && token.expires_in > 0
      ? new Date(Date.now() + token.expires_in * 1000).toISOString()
      : null;
  const scopes = (token.scope ?? "").split(/\s+/).filter(Boolean);
  const serviceSupabase = createServiceSupabase();

  const { error } = await serviceSupabase.from("brandrepo_external_connections").upsert(
    {
      user_id: userId,
      provider,
      provider_account_label: "Gamma",
      access_token_ciphertext: await encryptExternalToken(token.access_token),
      refresh_token_ciphertext: token.refresh_token ? await encryptExternalToken(token.refresh_token) : null,
      token_type: token.token_type ?? "Bearer",
      scopes,
      expires_at: expiresAt,
      revoked_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function storeExternalApiKeyConnection({
  apiKey,
  provider,
  userId,
}: {
  apiKey: string;
  provider: ExternalProvider;
  userId: string;
}) {
  const serviceSupabase = createServiceSupabase();
  const { error } = await serviceSupabase.from("brandrepo_external_connections").upsert(
    {
      user_id: userId,
      provider,
      provider_account_label: "Gamma API key",
      access_token_ciphertext: await encryptExternalToken(apiKey),
      refresh_token_ciphertext: null,
      token_type: "ApiKey",
      scopes: ["generate"],
      expires_at: null,
      revoked_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function refreshExternalConnection(row: ExternalConnectionRow) {
  if (!row.refresh_token_ciphertext) return row;

  const config = assertGammaOAuthConfigured();
  const refreshToken = await decryptExternalToken(row.refresh_token_ciphertext);
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: gammaTokenRequestHeaders(config),
    body: gammaTokenRequestBody(config, {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as TokenResponse & { error?: string; error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "Unable to refresh Gamma connection.");
  }

  await storeExternalConnection({
    provider: row.provider,
    token: {
      ...payload,
      refresh_token: payload.refresh_token ?? refreshToken,
    },
    userId: row.user_id,
  });

  return loadExternalConnection(row.user_id, row.provider);
}

export async function loadExternalConnection(userId: string, provider: ExternalProvider) {
  const serviceSupabase = createServiceSupabase();
  const { data, error } = await serviceSupabase
    .from("brandrepo_external_connections")
    .select(
      "id,user_id,provider,provider_account_label,access_token_ciphertext,refresh_token_ciphertext,token_type,scopes,expires_at,connected_at,updated_at,revoked_at",
    )
    .eq("user_id", userId)
    .eq("provider", provider)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as ExternalConnectionRow | null;
}

export async function loadExternalBearerToken(request: Request, provider: ExternalProvider) {
  const { user } = await authenticateSupabaseRequest(request);
  const row = await loadExternalConnection(user.id, provider);

  if (!row) {
    throw new Error("Connect your Gamma account before creating a Gamma presentation.");
  }

  const activeRow = row.expires_at && new Date(row.expires_at).getTime() < Date.now() + 60_000 ? await refreshExternalConnection(row) : row;
  if (!activeRow) {
    throw new Error("Connect your Gamma account before creating a Gamma presentation.");
  }

  return {
    accessToken: await decryptExternalToken(activeRow.access_token_ciphertext),
    tokenType: activeRow.token_type || "Bearer",
    user,
  };
}
