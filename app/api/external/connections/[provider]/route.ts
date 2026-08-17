import { authenticateSupabaseRequest, repoAccessErrorResponse } from "../../../../../lib/repo-access";

export async function DELETE(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const { provider } = await params;
    const { authenticatedSupabase, user } = await authenticateSupabaseRequest(request);

    if (decodeURIComponent(provider) !== "gamma") {
      return Response.json({ error: "Unsupported external provider." }, { status: 400 });
    }

    const { error } = await authenticatedSupabase
      .from("brandrepo_external_connections")
      .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("provider", "gamma")
      .is("revoked_at", null);

    if (error) {
      throw new Error(error.message);
    }

    return Response.json({ ok: true });
  } catch (error) {
    return repoAccessErrorResponse(error);
  }
}
