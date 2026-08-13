import { getRepoContext } from "../../../lib/repo-context";
import { loadAuthenticatedWorkspaces, repoAccessErrorResponse } from "../../../lib/repo-access";

export async function GET(request: Request) {
  try {
    const workspaces = await loadAuthenticatedWorkspaces(request);

    return Response.json({
      repos: workspaces.map((workspace) => {
        const context = getRepoContext(workspace, { includeAssets: false, maxMarkdownLength: 1 });
        return {
          id: workspace.id,
          name: context.repo.name,
          slug: context.repo.slug,
          websiteUrl: context.repo.websiteUrl,
        };
      }),
    });
  } catch (error) {
    return repoAccessErrorResponse(error);
  }
}

