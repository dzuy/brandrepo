import { getRepoContext } from "../../../../../lib/repo-context";
import { findWorkspace, loadAuthenticatedWorkspaces, repoAccessErrorResponse } from "../../../../../lib/repo-access";

export async function GET(request: Request, { params }: { params: Promise<{ repoId: string }> }) {
  try {
    const { repoId } = await params;
    const workspaces = await loadAuthenticatedWorkspaces(request);
    const workspace = findWorkspace(workspaces, decodeURIComponent(repoId));

    if (!workspace) {
      return Response.json({ error: "Repo not found." }, { status: 404 });
    }

    return Response.json(getRepoContext(workspace, { includeAssets: true }));
  } catch (error) {
    return repoAccessErrorResponse(error);
  }
}

