import { authenticateSupabaseRequest, repoAccessErrorResponse } from "../../../../../lib/repo-access";

export async function DELETE(request: Request, { params }: { params: Promise<{ clientId: string }> }) {
  try {
    const { clientId } = await params;
    const { authenticatedSupabase, user } = await authenticateSupabaseRequest(request);
    const { error } = await authenticatedSupabase
      .from("brandrepo_oauth_access_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("client_id", decodeURIComponent(clientId))
      .is("revoked_at", null);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return repoAccessErrorResponse(error);
  }
}
