import { buildGammaGenerationPayload, type PresentationCreationRequest } from "../../../../lib/create/gamma";
import { loadExternalBearerToken } from "../../../../lib/external-oauth";

const gammaApiBaseUrl = "https://public-api.gamma.app/v1.0";

function getErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const body = payload as { error?: string | { message?: string }; message?: string };
  if (typeof body.error === "string") return body.error;
  if (body.error?.message) return body.error.message;
  if (body.message) return body.message;
  return fallback;
}

function gammaAuthHeaders(tokenType: string, token: string) {
  if (tokenType === "ApiKey") {
    return { "X-API-KEY": token };
  }

  return { Authorization: `${tokenType} ${token}` };
}

export async function POST(request: Request) {
  try {
    const { accessToken, tokenType } = await loadExternalBearerToken(request, "gamma");

    const body = (await request.json()) as Partial<PresentationCreationRequest>;
    const prompt = body.prompt?.trim();

    if (body.type !== "presentation" || body.provider !== "gamma" || !prompt || !body.brandContext || !body.brandId) {
      return Response.json({ error: "Missing Gamma presentation request details." }, { status: 400 });
    }

    const gammaPayload = buildGammaGenerationPayload({
      type: "presentation",
      provider: "gamma",
      prompt,
      brandId: body.brandId,
      brandContext: body.brandContext,
    });

    const response = await fetch(`${gammaApiBaseUrl}/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...gammaAuthHeaders(tokenType, accessToken),
      },
      body: JSON.stringify(gammaPayload),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return Response.json(
        { error: getErrorMessage(payload, "Gamma generation request failed.") },
        { status: response.status },
      );
    }

    const generationId =
      payload && typeof payload === "object" && "generationId" in payload
        ? String((payload as { generationId: string }).generationId)
        : "";

    if (!generationId) {
      return Response.json({ error: "Gamma did not return a generation ID." }, { status: 502 });
    }

    return Response.json({ id: generationId, status: "queued" });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to create Gamma presentation." },
      { status: 500 },
    );
  }
}
