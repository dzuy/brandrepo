import { authenticateSupabaseRequest, repoAccessErrorResponse } from "../../../../lib/repo-access";
import { OAuthClientRow } from "../../../../lib/oauth";

type OAuthConnectionTokenRow = {
  client_id: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string;
};

function newestDate(values: string[]) {
  return values.sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;
}

export async function GET(request: Request) {
  try {
    const { authenticatedSupabase, user } = await authenticateSupabaseRequest(request);
    const { data: tokenRows, error: tokenError } = await authenticatedSupabase
      .from("brandrepo_oauth_access_tokens")
      .select("client_id,scopes,created_at,last_used_at,expires_at")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .gt("refresh_token_expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (tokenError) {
      throw new Error(tokenError.message);
    }

    const tokens = (tokenRows ?? []) as OAuthConnectionTokenRow[];
    const clientIds = Array.from(new Set(tokens.map((token) => token.client_id)));

    if (!clientIds.length) {
      return Response.json({ connections: [] });
    }

    const { data: clientRows, error: clientError } = await authenticatedSupabase
      .from("brandrepo_oauth_clients")
      .select("id,client_id,client_name,redirect_uris,grant_types,response_types,token_endpoint_auth_method,created_at")
      .in("client_id", clientIds);

    if (clientError) {
      throw new Error(clientError.message);
    }

    const clients = new Map(((clientRows ?? []) as OAuthClientRow[]).map((client) => [client.client_id, client]));
    const connections = clientIds.map((clientId) => {
      const matchingTokens = tokens.filter((token) => token.client_id === clientId);
      const client = clients.get(clientId);
      return {
        clientId,
        name: client?.client_name ?? "External connector",
        redirectUris: client?.redirect_uris ?? [],
        scopes: Array.from(new Set(matchingTokens.flatMap((token) => token.scopes))),
        connectedAt: newestDate(matchingTokens.map((token) => token.created_at)),
        lastUsedAt: newestDate(matchingTokens.flatMap((token) => (token.last_used_at ? [token.last_used_at] : []))),
        expiresAt: newestDate(matchingTokens.map((token) => token.expires_at)),
      };
    });

    return Response.json({ connections });
  } catch (error) {
    return repoAccessErrorResponse(error);
  }
}
