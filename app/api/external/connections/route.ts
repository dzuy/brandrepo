import { authenticateSupabaseRequest, repoAccessErrorResponse } from "../../../../lib/repo-access";

type ExternalConnectionViewRow = {
  provider: string;
  provider_account_label: string | null;
  scopes: string[];
  connected_at: string;
  updated_at: string;
  expires_at: string | null;
};

export async function GET(request: Request) {
  try {
    const { authenticatedSupabase, user } = await authenticateSupabaseRequest(request);
    const { data, error } = await authenticatedSupabase
      .from("brandrepo_external_connections")
      .select("provider,provider_account_label,scopes,connected_at,updated_at,expires_at")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .order("connected_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const connections = ((data ?? []) as ExternalConnectionViewRow[]).map((connection) => ({
      provider: connection.provider,
      name: connection.provider_account_label ?? connection.provider,
      scopes: connection.scopes,
      connectedAt: connection.connected_at,
      updatedAt: connection.updated_at,
      expiresAt: connection.expires_at,
    }));

    return Response.json({ connections });
  } catch (error) {
    return repoAccessErrorResponse(error);
  }
}
