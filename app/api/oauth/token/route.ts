import {
  assertValidRedirectUri,
  createAccessTokenRecord,
  createServiceSupabase,
  hashOAuthSecret,
  OAuthAccessTokenRow,
  OAuthClientRow,
  verifyPkce,
} from "../../../../lib/oauth";

async function loadClient(clientId: string) {
  const serviceSupabase = createServiceSupabase();
  const { data, error } = await serviceSupabase
    .from("brandrepo_oauth_clients")
    .select("id,client_id,client_name,redirect_uris,grant_types,response_types,token_endpoint_auth_method,created_at")
    .eq("client_id", clientId)
    .maybeSingle();

  if (error || !data) return null;
  return data as OAuthClientRow;
}

function tokenError(error: string, status = 400) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return tokenError("invalid_request");

  const grantType = String(form.get("grant_type") ?? "");
  const clientId = String(form.get("client_id") ?? "");
  const client = await loadClient(clientId);
  if (!client) return tokenError("invalid_client", 401);

  if (grantType === "authorization_code") {
    const code = String(form.get("code") ?? "");
    const redirectUri = String(form.get("redirect_uri") ?? "");
    const codeVerifier = String(form.get("code_verifier") ?? "");
    if (!code || !redirectUri || !codeVerifier) return tokenError("invalid_request");

    assertValidRedirectUri(client, redirectUri);

    const serviceSupabase = createServiceSupabase();
    const { data, error } = await serviceSupabase
      .from("brandrepo_oauth_authorization_codes")
      .select("id,code_hash,user_id,client_id,redirect_uri,scopes,code_challenge,code_challenge_method,expires_at,consumed_at")
      .eq("code_hash", await hashOAuthSecret(code))
      .maybeSingle();

    if (error || !data || data.consumed_at) return tokenError("invalid_grant");
    if (data.client_id !== clientId || data.redirect_uri !== redirectUri) return tokenError("invalid_grant");
    if (new Date(data.expires_at).getTime() < Date.now()) return tokenError("invalid_grant");
    if (!(await verifyPkce(codeVerifier, data.code_challenge, data.code_challenge_method))) return tokenError("invalid_grant");

    await serviceSupabase
      .from("brandrepo_oauth_authorization_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", data.id);

    return Response.json(
      await createAccessTokenRecord({
        userId: data.user_id,
        clientId,
        scopes: data.scopes,
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (grantType === "refresh_token") {
    const refreshToken = String(form.get("refresh_token") ?? "");
    if (!refreshToken) return tokenError("invalid_request");

    const serviceSupabase = createServiceSupabase();
    const { data, error } = await serviceSupabase
      .from("brandrepo_oauth_access_tokens")
      .select(
        "id,user_id,client_id,access_token_hash,token_prefix,scopes,created_at,last_used_at,expires_at,revoked_at,refresh_token_hash,refresh_token_expires_at",
      )
      .eq("refresh_token_hash", await hashOAuthSecret(refreshToken))
      .maybeSingle();

    const existing = data as OAuthAccessTokenRow | null;
    if (error || !existing || existing.revoked_at || existing.client_id !== clientId) return tokenError("invalid_grant");
    if (!existing.refresh_token_expires_at || new Date(existing.refresh_token_expires_at).getTime() < Date.now()) {
      return tokenError("invalid_grant");
    }

    await serviceSupabase
      .from("brandrepo_oauth_access_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", existing.id);

    return Response.json(
      await createAccessTokenRecord({
        userId: existing.user_id,
        clientId,
        scopes: existing.scopes,
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return tokenError("unsupported_grant_type");
}
