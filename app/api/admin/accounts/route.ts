import { authenticatePlatformAdminRequest } from "../../../../lib/admin";
import { repoAccessErrorResponse } from "../../../../lib/repo-access";
import { initialRepo, WorkspaceState } from "../../../../lib/repo-model";
import { getRepoSlug, slugify } from "../../../../lib/repo-share";

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${crypto.randomUUID()}`;
}

function createStarterWorkspace(name: string): WorkspaceState {
  const repo = {
    ...initialRepo,
    company: {
      ...initialRepo.company,
      name,
    },
  };

  return {
    id: createId("workspace"),
    name,
    visibility: "public",
    repo,
    chatMessages: [
      {
        id: "welcome",
        role: "assistant",
        text: "Your repo is empty. Add company context or upload source material, then ask questions from the repo.",
      },
    ],
    generatedDraft: "",
    generationType: "social",
  };
}

export async function GET(request: Request) {
  try {
    const { serviceSupabase } = await authenticatePlatformAdminRequest(request);
    const { data, error } = await serviceSupabase
      .from("brandrepo_accounts")
      .select(
        "id,name,slug,created_at,updated_at,brandhub_workspaces(id,name,updated_at),brandrepo_account_memberships(id,user_id,role,created_at),brandrepo_account_invites(id,email,role,status,created_at,accepted_at)",
      )
      .order("created_at", { ascending: false });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ accounts: data ?? [] });
  } catch (error) {
    return repoAccessErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user, serviceSupabase } = await authenticatePlatformAdminRequest(request);
    const body = (await request.json().catch(() => ({}))) as { name?: string; slug?: string };
    const name = body.name?.trim() ?? "";
    const slug = slugify(body.slug?.trim() || name, "");

    if (!name || !slug) {
      return Response.json({ error: "Account name is required." }, { status: 400 });
    }

    const { data: account, error: accountError } = await serviceSupabase
      .from("brandrepo_accounts")
      .insert({
        name,
        slug,
        created_by: user.id,
      })
      .select("id,name,slug,created_at,updated_at")
      .single();

    if (accountError || !account) {
      return Response.json({ error: accountError?.message ?? "Unable to create account." }, { status: 500 });
    }

    const membershipResult = await serviceSupabase.from("brandrepo_account_memberships").insert({
      account_id: account.id,
      user_id: user.id,
      role: "admin",
    });

    if (membershipResult.error) {
      return Response.json({ error: membershipResult.error.message }, { status: 500 });
    }

    const workspace = createStarterWorkspace(name);
    const { error: repoError } = await serviceSupabase.from("brandhub_workspaces").insert({
      id: workspace.id,
      user_id: user.id,
      account_id: account.id,
      name: workspace.name,
      data: workspace,
      account_slug: slug,
      repo_slug: getRepoSlug(workspace),
      visibility: workspace.visibility ?? "public",
      updated_at: new Date().toISOString(),
    });

    if (repoError) {
      return Response.json({ error: repoError.message }, { status: 500 });
    }

    return Response.json({ account, workspace });
  } catch (error) {
    return repoAccessErrorResponse(error);
  }
}
