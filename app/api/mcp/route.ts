import { handleBrandRepoMcpRequest } from "../../../lib/mcp";
import { oauthUnauthorizedResponse } from "../../../lib/oauth";
import { loadAuthenticatedWorkspaces, repoAccessErrorResponse } from "../../../lib/repo-access";

export async function GET(request: Request) {
  return oauthUnauthorizedResponse(request);
}

export async function POST(request: Request) {
  try {
    const message = await request.json();
    const workspaces = await loadAuthenticatedWorkspaces(request);

    return Response.json(handleBrandRepoMcpRequest(message, workspaces));
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("bearer token")) {
      return oauthUnauthorizedResponse(request, error.message);
    }

    return repoAccessErrorResponse(error);
  }
}
