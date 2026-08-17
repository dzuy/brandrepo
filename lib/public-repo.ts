import { createClient } from "@supabase/supabase-js";
import { WorkspaceRow, WorkspaceState } from "./repo-model";
import { getRepoSlug, isReservedAccountSlug, RepoVisibility, slugify } from "./repo-share";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

export type PublicRepo = {
  accountSlug: string;
  repoSlug: string;
  updatedAt: string | null;
  visibility: RepoVisibility;
  workspace: WorkspaceState;
};

function createPublicSupabase() {
  const key = supabaseSecretKey ?? supabasePublishableKey;
  if (!supabaseUrl || !key) {
    throw new Error("Supabase public access is not configured.");
  }

  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeWorkspaceRow(
  row: WorkspaceRow & {
    account_slug?: string | null;
    repo_slug?: string | null;
    updated_at?: string | null;
    visibility?: RepoVisibility | null;
  },
  accountSlug: string,
) {
  const workspace = { ...row.data, id: row.id, name: row.name } as WorkspaceState;
  const visibility = row.visibility ?? workspace.visibility ?? "public";
  if (visibility !== "public") return null;

  return {
    accountSlug: row.account_slug ?? accountSlug,
    repoSlug: row.repo_slug ?? getRepoSlug(workspace),
    updatedAt: row.updated_at ?? null,
    visibility,
    workspace: {
      ...workspace,
      visibility,
    },
  };
}

async function loadPublicRepoFromSlugColumns(supabase: ReturnType<typeof createPublicSupabase>, accountSlug: string, repoSlug: string) {
  const { data, error } = await supabase
    .from("brandhub_workspaces")
    .select("id,name,data,updated_at,account_slug,repo_slug,visibility")
    .eq("account_slug", accountSlug)
    .eq("repo_slug", repoSlug)
    .eq("visibility", "public")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  if (!data) return null;

  return normalizeWorkspaceRow(data as WorkspaceRow, accountSlug);
}

async function findUserIdByAccountSlug(supabase: ReturnType<typeof createPublicSupabase>, accountSlug: string) {
  if (!supabaseSecretKey) return "";

  let page = 1;

  while (page < 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(error.message);

    const user = data.users.find((candidate) => candidate.user_metadata?.account_name === accountSlug);
    if (user) return user.id;
    if (data.users.length < 100) return "";
    page += 1;
  }

  return "";
}

async function loadPublicRepoFromComputedSlug(supabase: ReturnType<typeof createPublicSupabase>, accountSlug: string, repoSlug: string) {
  const userId = await findUserIdByAccountSlug(supabase, accountSlug);
  if (!userId) return null;

  const { data, error } = await supabase
    .from("brandhub_workspaces")
    .select("id,name,data,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  const row = ((data ?? []) as WorkspaceRow[]).find((workspaceRow) => {
    const workspace = { ...workspaceRow.data, id: workspaceRow.id, name: workspaceRow.name } as WorkspaceState;
    return getRepoSlug(workspace) === repoSlug && (workspace.visibility ?? "public") === "public";
  });

  return row ? normalizeWorkspaceRow(row, accountSlug) : null;
}

export async function loadPublicRepo(accountSlug: string, repoSlug: string): Promise<PublicRepo | null> {
  const normalizedAccountSlug = slugify(accountSlug, "");
  const normalizedRepoSlug = slugify(repoSlug, "");
  if (!normalizedAccountSlug || !normalizedRepoSlug || isReservedAccountSlug(normalizedAccountSlug)) return null;

  const supabase = createPublicSupabase();
  return (
    (await loadPublicRepoFromSlugColumns(supabase, normalizedAccountSlug, normalizedRepoSlug)) ??
    (await loadPublicRepoFromComputedSlug(supabase, normalizedAccountSlug, normalizedRepoSlug))
  );
}
