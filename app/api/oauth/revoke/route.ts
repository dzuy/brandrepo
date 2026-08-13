import { createServiceSupabase, hashOAuthSecret } from "../../../../lib/oauth";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({}, { status: 200 });

  const token = String(form.get("token") ?? "");
  if (!token) return Response.json({}, { status: 200 });

  const serviceSupabase = createServiceSupabase();
  const tokenHash = await hashOAuthSecret(token);
  await serviceSupabase
    .from("brandrepo_oauth_access_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .or(`access_token_hash.eq.${tokenHash},refresh_token_hash.eq.${tokenHash}`);

  return Response.json({}, { status: 200 });
}
