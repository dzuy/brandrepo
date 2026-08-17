import { loadExternalBearerToken } from "../../../../../lib/external-oauth";

const gammaApiBaseUrl = "https://public-api.gamma.app/v1.0";

function getErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const body = payload as { error?: string | { message?: string }; message?: string };
  if (typeof body.error === "string") return body.error;
  if (body.error?.message) return body.error.message;
  if (body.message) return body.message;
  return fallback;
}

function getString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

function gammaAuthHeaders(tokenType: string, token: string) {
  if (tokenType === "ApiKey") {
    return { "X-API-KEY": token };
  }

  return { Authorization: `${tokenType} ${token}` };
}

export async function GET(_request: Request, { params }: { params: Promise<{ generationId: string }> }) {
  try {
    const { accessToken, tokenType } = await loadExternalBearerToken(_request, "gamma");

    const { generationId } = await params;
    const id = decodeURIComponent(generationId);

    if (!id) {
      return Response.json({ error: "Missing Gamma generation ID." }, { status: 400 });
    }

    const response = await fetch(`${gammaApiBaseUrl}/generations/${encodeURIComponent(id)}`, {
      headers: gammaAuthHeaders(tokenType, accessToken),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return Response.json(
        { error: getErrorMessage(payload, "Gamma generation status request failed.") },
        { status: response.status },
      );
    }

    if (!payload || typeof payload !== "object") {
      return Response.json({ error: "Gamma returned an empty generation status." }, { status: 502 });
    }

    const body = payload as Record<string, unknown>;
    const providerStatus = getString(body, "status");

    if (providerStatus === "completed") {
      const url = getString(body, "gammaUrl");

      if (!url) {
        return Response.json({ error: "Gamma marked the presentation complete but did not return a URL." }, { status: 502 });
      }

      const credits = body.credits;

      return Response.json({
        id,
        status: "complete",
        providerStatus,
        url,
        exportUrl: getString(body, "exportUrl") || undefined,
        credits: credits && typeof credits === "object" ? credits : undefined,
      });
    }

    if (providerStatus === "failed") {
      return Response.json({
        id,
        status: "failed",
        providerStatus,
        error: getErrorMessage(payload, "Gamma could not create this presentation."),
      });
    }

    return Response.json({
      id,
      status: "creating",
      providerStatus,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load Gamma presentation status." },
      { status: 500 },
    );
  }
}
