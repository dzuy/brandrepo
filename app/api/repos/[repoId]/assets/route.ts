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

    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");
    const context = getRepoContext(workspace, { includeAssets: true });
    const assets = kind ? context.assets.filter((asset) => asset.kind === kind) : context.assets;

    return Response.json({ assets });
  } catch (error) {
    return repoAccessErrorResponse(error);
  }
}

