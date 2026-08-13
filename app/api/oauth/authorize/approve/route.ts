import { authenticateSupabaseRequest } from "../../../../../lib/repo-access";
import {
  assertValidRedirectUri,
  createOpaqueSecret,
  createServiceSupabase,
  hashOAuthSecret,
  normalizeScopes,
  oauthAuthorizationCodePrefix,
  OAuthAuthorizePayload,
} from "../../../../../lib/oauth";

function redirectWithError(redirectUri: string, error: string, state: string) {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  if (state) url.searchParams.set("state", state);
  return url.toString();
}

function validatePayload(value: unknown): OAuthAuthorizePayload | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Record<string, unknown>;
  const required = ["response_type", "client_id", "redirect_uri", "code_challenge", "code_challenge_method"];
  if (required.some((key) => typeof payload[key] !== "string" || !(payload[key] as string).trim())) return null;

  return {
    response_type: payload.response_type as string,
    client_id: payload.client_id as string,
    redirect_uri: payload.redirect_uri as string,
    scope: typeof payload.scope === "string" ? payload.scope : "",
    state: typeof payload.state === "string" ? payload.state : "",
    code_challenge: payload.code_challenge as string,
    code_challenge_method: payload.code_challenge_method as string,
  };
}

export async function POST(request: Request) {
  try {
    const payload = validatePayload(await request.json().catch(() => null));
    if (!payload) {
      return Response.json({ error: "Invalid OAuth authorization request." }, { status: 400 });
    }

    if (payload.response_type !== "code" || payload.code_challenge_method !== "S256") {
      return Response.json({ redirectUrl: redirectWithError(payload.redirect_uri, "unsupported_response_type", payload.state) }, { status: 400 });
    }

    const { user } = await authenticateSupabaseRequest(request);
    const serviceSupabase = createServiceSupabase();
    const { data: client, error: clientError } = await serviceSupabase
      .from("brandrepo_oauth_clients")
      .select("id,client_id,client_name,redirect_uris,grant_types,response_types,token_endpoint_auth_method,created_at")
      .eq("client_id", payload.client_id)
      .maybeSingle();

    if (clientError || !client) {
      return Response.json({ error: "Unknown OAuth client." }, { status: 400 });
    }

    assertValidRedirectUri(client, payload.redirect_uri);

    const code = createOpaqueSecret(oauthAuthorizationCodePrefix);
    const scopes = normalizeScopes(payload.scope);
    const { error: codeError } = await serviceSupabase.from("brandrepo_oauth_authorization_codes").insert({
      code_hash: await hashOAuthSecret(code),
      user_id: user.id,
      client_id: payload.client_id,
      redirect_uri: payload.redirect_uri,
      scopes,
      code_challenge: payload.code_challenge,
      code_challenge_method: payload.code_challenge_method,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    if (codeError) {
      return Response.json({ error: "Unable to create OAuth authorization code." }, { status: 500 });
    }

    const redirectUrl = new URL(payload.redirect_uri);
    redirectUrl.searchParams.set("code", code);
    if (payload.state) redirectUrl.searchParams.set("state", payload.state);

    return Response.json({ redirectUrl: redirectUrl.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to authorize connector.";
    return Response.json({ error: message }, { status: 400 });
  }
}
