import { authenticateSupabaseRequest, repoAccessErrorResponse } from "../../../../../lib/repo-access";
import { assertGammaOAuthConfigured, createExternalState, createPkcePair } from "../../../../../lib/external-oauth";
import { createServiceSupabase } from "../../../../../lib/oauth";

export async function POST(request: Request) {
  try {
    const { user } = await authenticateSupabaseRequest(request);
    const config = assertGammaOAuthConfigured(request);
    const state = createExternalState();
    const pkce = await createPkcePair();
    const serviceSupabase = createServiceSupabase();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error } = await serviceSupabase.from("brandrepo_external_oauth_states").insert({
      state,
      user_id: user.id,
      provider: "gamma",
      code_verifier: pkce.verifier,
      redirect_uri: config.redirectUri,
      expires_at: expiresAt,
    });

    if (error) {
      throw new Error(error.message);
    }

    const authorizationUrl = new URL(config.authorizationUrl);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("client_id", config.clientId);
    authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
    authorizationUrl.searchParams.set("scope", config.scopes.join(" "));
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("code_challenge", pkce.challenge);
    authorizationUrl.searchParams.set("code_challenge_method", "S256");

    return Response.json({ authorizationUrl: authorizationUrl.toString() });
  } catch (error) {
    return repoAccessErrorResponse(error);
  }
}
