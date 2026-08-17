import { loadPublicRepo } from "../../../../lib/public-repo";
import { serializeRepoForAI } from "../../../../lib/repo-share";

type PublicRepoAiParams = {
  accountSlug: string;
  repoSlug: string;
};

export async function GET(_request: Request, { params }: { params: Promise<PublicRepoAiParams> }) {
  const { accountSlug, repoSlug } = await params;
  const publicRepo = await loadPublicRepo(accountSlug, repoSlug).catch(() => null);

  if (!publicRepo) {
    return new Response("BrandRepo not found.", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  return new Response(serializeRepoForAI(publicRepo), {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}
