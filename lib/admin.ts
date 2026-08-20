import { createClient } from "@supabase/supabase-js";
import { RepoAccessError } from "./access-errors";
import { getBearerToken } from "./repo-access";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

export const platformAdminEmails = new Set(["dzuylinh@gmail.com"]);

export function isPlatformAdminEmail(email: string | undefined | null) {
  return Boolean(email && platformAdminEmails.has(email.toLowerCase()));
}

export function createAdminServiceSupabase() {
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

export async function authenticatePlatformAdminRequest(request: Request) {
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
    error,
  } = await authenticatedSupabase.auth.getUser(token);

  if (error || !user) {
    throw new RepoAccessError("Invalid bearer token.", 401);
  }

  if (!isPlatformAdminEmail(user.email)) {
    throw new RepoAccessError("Platform admin access required.", 403);
  }

  return { user, token, serviceSupabase: createAdminServiceSupabase() };
}

