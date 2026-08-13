import {
  createIntegrationTokenSecret,
  defaultIntegrationTokenScopes,
  hashIntegrationToken,
  tokenPrefix,
} from "../../../lib/integration-tokens";
import { authenticateSupabaseRequest, repoAccessErrorResponse } from "../../../lib/repo-access";

function cleanName(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : "BrandRepo integration token";
}

function serializeToken(row: {
  id: string;
  name: string;
  token_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}) {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.token_prefix,
    scopes: row.scopes,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

export async function GET(request: Request) {
  try {
    const { authenticatedSupabase, user } = await authenticateSupabaseRequest(request);
    const { data, error } = await authenticatedSupabase
      .from("brandrepo_integration_tokens")
      .select("id,name,token_prefix,scopes,created_at,last_used_at,expires_at,revoked_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ tokens: (data ?? []).map(serializeToken) });
  } catch (error) {
    return repoAccessErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { authenticatedSupabase, user } = await authenticateSupabaseRequest(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const secret = createIntegrationTokenSecret();
    const tokenHash = await hashIntegrationToken(secret);
    const { data, error } = await authenticatedSupabase
      .from("brandrepo_integration_tokens")
      .insert({
        user_id: user.id,
        name: cleanName(body.name),
        token_hash: tokenHash,
        token_prefix: tokenPrefix(secret),
        scopes: [...defaultIntegrationTokenScopes],
      })
      .select("id,name,token_prefix,scopes,created_at,last_used_at,expires_at,revoked_at")
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      token: serializeToken(data),
      secret,
      message: "Copy this token now. BrandRepo will not show it again.",
    });
  } catch (error) {
    return repoAccessErrorResponse(error);
  }
}
