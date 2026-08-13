import { createClient } from "@supabase/supabase-js";
import { WorkspaceRow, WorkspaceState } from "./repo-model";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export class RepoAccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? "";
}

export async function loadAuthenticatedWorkspaces(request: Request): Promise<WorkspaceState[]> {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new RepoAccessError("Supabase is not configured.", 500);
  }

  const token = getBearerToken(request);
  if (!token) {
    throw new RepoAccessError("Missing bearer token.", 401);
  }

  const authenticatedSupabase = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
  const {
    data: { user },
    error: userError,
  } = await authenticatedSupabase.auth.getUser(token);

  if (userError || !user) {
    throw new RepoAccessError("Invalid bearer token.", 401);
  }

  const { data, error } = await authenticatedSupabase
    .from("brandhub_workspaces")
    .select("id,name,data")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new RepoAccessError(error.message, 500);
  }

  return ((data ?? []) as WorkspaceRow[]).map((row) => ({ ...row.data, id: row.id, name: row.name }));
}

export function findWorkspace(workspaces: WorkspaceState[], repoId: string) {
  return workspaces.find((workspace) => workspace.id === repoId || workspace.name.toLowerCase() === repoId.toLowerCase());
}

export function repoAccessErrorResponse(error: unknown) {
  if (error instanceof RepoAccessError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  return Response.json({ error: "Unable to load repos." }, { status: 500 });
}

