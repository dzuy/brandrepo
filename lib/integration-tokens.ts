export const integrationTokenPrefix = "brp_";
export const defaultIntegrationTokenScopes = ["repo:read", "assets:read"] as const;

export type IntegrationTokenScope = (typeof defaultIntegrationTokenScopes)[number] | "repo:write" | "assets:write" | "drafts:write";

export type IntegrationTokenRow = {
  id: string;
  user_id: string;
  name: string;
  token_hash: string;
  token_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

function base64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

function toHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isIntegrationToken(token: string) {
  return token.startsWith(integrationTokenPrefix);
}

export function createIntegrationTokenSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `${integrationTokenPrefix}${base64Url(bytes)}`;
}

export function tokenPrefix(token: string) {
  return token.slice(0, 12);
}

export async function hashIntegrationToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(digest);
}
