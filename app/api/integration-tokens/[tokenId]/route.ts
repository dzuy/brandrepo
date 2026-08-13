import { authenticateSupabaseRequest, repoAccessErrorResponse } from "../../../../lib/repo-access";

export async function DELETE(request: Request, { params }: { params: Promise<{ tokenId: string }> }) {
  try {
    const { tokenId } = await params;
    const { authenticatedSupabase, user } = await authenticateSupabaseRequest(request);
    const { error } = await authenticatedSupabase
      .from("brandrepo_integration_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", decodeURIComponent(tokenId))
      .eq("user_id", user.id);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return repoAccessErrorResponse(error);
  }
}
