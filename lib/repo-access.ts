import { createClient } from "@supabase/supabase-js";
import { RepoAccessError } from "./access-errors";
import { hashIntegrationToken, IntegrationTokenRow, isIntegrationToken } from "./integration-tokens";
import { isOAuthAccessToken, loadOAuthAccessToken } from "./oauth";
import { WorkspaceRow, WorkspaceState } from "./repo-model";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? "";
}

export function createAuthenticatedSupabase(token: string) {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new RepoAccessError("Supabase is not configured.", 500);
  }

  return createClient(supabaseUrl, supabasePublishableKey, {
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
}

function createServiceSupabase() {
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new RepoAccessError("Supabase service key is not configured.", 500);
  }

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function authenticateSupabaseRequest(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    throw new RepoAccessError("Missing bearer token.", 401);
  }

  const authenticatedSupabase = createAuthenticatedSupabase(token);
  const {
    data: { user },
    error: userError,
  } = await authenticatedSupabase.auth.getUser(token);

  if (userError || !user) {
    throw new RepoAccessError("Invalid bearer token.", 401);
  }

  return { authenticatedSupabase, user, token };
}

async function loadWorkspacesByUserId(userId: string) {
  const serviceSupabase = createServiceSupabase();
  const { data, error } = await serviceSupabase
    .from("brandhub_workspaces")
    .select("id,user_id,name,data,account_id,account_slug,repo_slug,visibility")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new RepoAccessError(error.message, 500);
  }

  return ((data ?? []) as WorkspaceRow[]).map((row) => ({
    ...row.data,
    id: row.id,
    name: row.name,
    ownerUserId: row.user_id ?? row.data.ownerUserId,
    accountId: row.account_id ?? row.data.accountId,
    accountSlug: row.account_slug ?? row.data.accountSlug,
    visibility: row.visibility ?? row.data.visibility,
  }));
}

async function logIntegrationAccess(
  serviceSupabase: ReturnType<typeof createServiceSupabase>,
  integrationToken: IntegrationTokenRow,
  request: Request,
) {
  try {
    const url = new URL(request.url);
    await serviceSupabase.from("brandrepo_integration_access_logs").insert({
      user_id: integrationToken.user_id,
      integration_token_id: integrationToken.id,
      method: request.method,
      path: url.pathname,
      user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    });
  } catch {
    // Audit logs should not break otherwise valid read-only integration calls.
  }
}

async function loadWorkspacesByIntegrationToken(token: string, request: Request) {
  const serviceSupabase = createServiceSupabase();
  const tokenHash = await hashIntegrationToken(token);
  const { data, error } = await serviceSupabase
    .from("brandrepo_integration_tokens")
    .select("id,user_id,name,token_hash,token_prefix,scopes,created_at,last_used_at,expires_at,revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw new RepoAccessError("Unable to validate integration token.", 500);
  }

  const integrationToken = data as IntegrationTokenRow | null;
  if (!integrationToken || integrationToken.revoked_at) {
    throw new RepoAccessError("Invalid integration token.", 401);
  }

  if (integrationToken.expires_at && new Date(integrationToken.expires_at).getTime() < Date.now()) {
    throw new RepoAccessError("Integration token expired.", 401);
  }

  if (!integrationToken.scopes.includes("repo:read")) {
    throw new RepoAccessError("Integration token is missing repo:read scope.", 403);
  }

  await serviceSupabase
    .from("brandrepo_integration_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", integrationToken.id);
  await logIntegrationAccess(serviceSupabase, integrationToken, request);

  return loadWorkspacesByUserId(integrationToken.user_id);
}

async function loadWorkspacesByOAuthAccessToken(token: string, request: Request) {
  const { accessToken, serviceSupabase } = await loadOAuthAccessToken(token);

  try {
    const url = new URL(request.url);
    await serviceSupabase.from("brandrepo_integration_access_logs").insert({
      user_id: accessToken.user_id,
      integration_token_id: null,
      method: request.method,
      path: url.pathname,
      user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    });
  } catch {
    // Audit logs should not break otherwise valid read-only OAuth calls.
  }

  return loadWorkspacesByUserId(accessToken.user_id);
}

export async function loadAuthenticatedWorkspaces(request: Request): Promise<WorkspaceState[]> {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new RepoAccessError("Supabase is not configured.", 500);
  }

  const token = getBearerToken(request);
  if (!token) {
    throw new RepoAccessError("Missing bearer token.", 401);
  }

  if (isIntegrationToken(token)) {
    return loadWorkspacesByIntegrationToken(token, request);
  }

  if (isOAuthAccessToken(token)) {
    return loadWorkspacesByOAuthAccessToken(token, request);
  }

  const { authenticatedSupabase } = await authenticateSupabaseRequest(request);
  const { data, error } = await authenticatedSupabase
    .from("brandhub_workspaces")
    .select("id,user_id,name,data,account_id,account_slug,repo_slug,visibility")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new RepoAccessError(error.message, 500);
  }

  return ((data ?? []) as WorkspaceRow[]).map((row) => ({
    ...row.data,
    id: row.id,
    name: row.name,
    ownerUserId: row.user_id ?? row.data.ownerUserId,
    accountId: row.account_id ?? row.data.accountId,
    accountSlug: row.account_slug ?? row.data.accountSlug,
    visibility: row.visibility ?? row.data.visibility,
  }));
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
