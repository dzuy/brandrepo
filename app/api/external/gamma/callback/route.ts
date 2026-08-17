import {
  assertGammaOAuthConfigured,
  gammaTokenRequestBody,
  gammaTokenRequestHeaders,
  storeExternalConnection,
} from "../../../../../lib/external-oauth";
import { createServiceSupabase } from "../../../../../lib/oauth";

type ExternalOAuthStateRow = {
  id: string;
  user_id: string;
  provider: "gamma";
  code_verifier: string;
  redirect_uri: string;
  expires_at: string;
  consumed_at: string | null;
};

function appRedirect(request: Request, params: Record<string, string>) {
  const url = new URL(request.url);
  const redirect = new URL("/", url.origin);
  Object.entries(params).forEach(([key, value]) => redirect.searchParams.set(key, value));
  return Response.redirect(redirect.toString(), 302);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const oauthError = url.searchParams.get("error") ?? "";

  if (oauthError) {
    return appRedirect(request, { connected: "gamma", status: "error", error: oauthError });
  }

  if (!code || !state) {
    return appRedirect(request, { connected: "gamma", status: "error", error: "missing_callback_details" });
  }

  try {
    const config = assertGammaOAuthConfigured(request);
    const serviceSupabase = createServiceSupabase();
    const { data, error } = await serviceSupabase
      .from("brandrepo_external_oauth_states")
      .select("id,user_id,provider,code_verifier,redirect_uri,expires_at,consumed_at")
      .eq("state", state)
      .maybeSingle();

    const storedState = data as ExternalOAuthStateRow | null;
    if (error || !storedState || storedState.provider !== "gamma" || storedState.consumed_at) {
      return appRedirect(request, { connected: "gamma", status: "error", error: "invalid_state" });
    }

    if (new Date(storedState.expires_at).getTime() < Date.now()) {
      return appRedirect(request, { connected: "gamma", status: "error", error: "expired_state" });
    }

    const tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: gammaTokenRequestHeaders(config),
      body: gammaTokenRequestBody(config, {
        grant_type: "authorization_code",
        code,
        redirect_uri: storedState.redirect_uri,
        code_verifier: storedState.code_verifier,
      }),
    });

    const tokenPayload = await tokenResponse.json().catch(() => ({}));

    if (!tokenResponse.ok) {
      const message =
        typeof tokenPayload === "object" && tokenPayload && "error_description" in tokenPayload
          ? String((tokenPayload as { error_description: string }).error_description)
          : "token_exchange_failed";
      return appRedirect(request, { connected: "gamma", status: "error", error: message });
    }

    await storeExternalConnection({
      provider: "gamma",
      token: tokenPayload,
      userId: storedState.user_id,
    });

    await serviceSupabase
      .from("brandrepo_external_oauth_states")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", storedState.id);

    return appRedirect(request, { connected: "gamma", status: "success" });
  } catch (error) {
    return appRedirect(request, {
      connected: "gamma",
      status: "error",
      error: error instanceof Error ? error.message : "gamma_connection_failed",
    });
  }
}
