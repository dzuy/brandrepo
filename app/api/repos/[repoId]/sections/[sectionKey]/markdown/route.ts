import { generateSectionMarkdown, getSectionByKey, sectionMarkdownFileName } from "../../../../../../../lib/repo-context";
import { findWorkspace, loadAuthenticatedWorkspaces, repoAccessErrorResponse } from "../../../../../../../lib/repo-access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ repoId: string; sectionKey: string }> },
) {
  try {
    const { repoId, sectionKey } = await params;
    const section = getSectionByKey(decodeURIComponent(sectionKey));

    if (!section) {
      return Response.json({ error: "Section not found." }, { status: 404 });
    }

    const workspaces = await loadAuthenticatedWorkspaces(request);
    const workspace = findWorkspace(workspaces, decodeURIComponent(repoId));

    if (!workspace) {
      return Response.json({ error: "Repo not found." }, { status: 404 });
    }

    return Response.json({
      section,
      markdownFileName: sectionMarkdownFileName(section),
      markdown: generateSectionMarkdown(workspace.repo, section),
    });
  } catch (error) {
    return repoAccessErrorResponse(error);
  }
}

