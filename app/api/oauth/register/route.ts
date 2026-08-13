import { createOpaqueSecret, createServiceSupabase, oauthAllowedScopes, serializeClient } from "../../../../lib/oauth";

function asStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const clean = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return clean.length ? clean : fallback;
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : fallback;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const redirectUris = asStringArray(body.redirect_uris, []);
    if (!redirectUris.length) {
      return Response.json({ error: "redirect_uris is required." }, { status: 400 });
    }

    const clientId = createOpaqueSecret("brc_client_");
    const serviceSupabase = createServiceSupabase();
    const { data, error } = await serviceSupabase
      .from("brandrepo_oauth_clients")
      .insert({
        client_id: clientId,
        client_name: asString(body.client_name, "External MCP client"),
        redirect_uris: redirectUris,
        grant_types: asStringArray(body.grant_types, ["authorization_code", "refresh_token"]),
        response_types: asStringArray(body.response_types, ["code"]),
        token_endpoint_auth_method: "none",
      })
      .select("id,client_id,client_name,redirect_uris,grant_types,response_types,token_endpoint_auth_method,created_at")
      .single();

    if (error) {
      return Response.json({ error: "Unable to register OAuth client." }, { status: 500 });
    }

    return Response.json({
      ...serializeClient(data),
      client_id_issued_at: Math.floor(new Date(data.created_at).getTime() / 1000),
      scope: oauthAllowedScopes.join(" "),
    });
  } catch {
    return Response.json({ error: "Invalid OAuth client registration request." }, { status: 400 });
  }
}
