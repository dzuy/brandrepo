import { handleBrandRepoMcpRequest } from "../../../lib/mcp";
import { loadAuthenticatedWorkspaces, repoAccessErrorResponse } from "../../../lib/repo-access";

export async function POST(request: Request) {
  try {
    const message = await request.json();
    const workspaces = await loadAuthenticatedWorkspaces(request);

    return Response.json(handleBrandRepoMcpRequest(message, workspaces));
  } catch (error) {
    return repoAccessErrorResponse(error);
  }
}

