import { storeExternalApiKeyConnection } from "../../../../../lib/external-oauth";
import { authenticateSupabaseRequest, repoAccessErrorResponse } from "../../../../../lib/repo-access";

export async function POST(request: Request) {
  try {
    const { user } = await authenticateSupabaseRequest(request);
    const body = (await request.json().catch(() => ({}))) as { apiKey?: string };
    const apiKey = body.apiKey?.trim() ?? "";

    if (!apiKey) {
      return Response.json({ error: "Missing Gamma API key." }, { status: 400 });
    }

    if (!apiKey.startsWith("sk-gamma-")) {
      return Response.json({ error: "Gamma API keys should start with sk-gamma-." }, { status: 400 });
    }

    await storeExternalApiKeyConnection({
      apiKey,
      provider: "gamma",
      userId: user.id,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return repoAccessErrorResponse(error);
  }
}
