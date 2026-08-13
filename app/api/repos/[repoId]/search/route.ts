import { getRepoContext, searchRepoContext } from "../../../../../lib/repo-context";
import { findWorkspace, loadAuthenticatedWorkspaces, repoAccessErrorResponse } from "../../../../../lib/repo-access";

export async function GET(request: Request, { params }: { params: Promise<{ repoId: string }> }) {
  try {
    const { repoId } = await params;
    const workspaces = await loadAuthenticatedWorkspaces(request);
    const workspace = findWorkspace(workspaces, decodeURIComponent(repoId));

    if (!workspace) {
      return Response.json({ error: "Repo not found." }, { status: 404 });
    }

    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    const context = getRepoContext(workspace, { includeAssets: true });

    return Response.json({ query, results: searchRepoContext(context, query) });
  } catch (error) {
    return repoAccessErrorResponse(error);
  }
}

