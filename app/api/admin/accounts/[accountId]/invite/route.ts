import { authenticatePlatformAdminRequest } from "../../../../../../lib/admin";
import { repoAccessErrorResponse } from "../../../../../../lib/repo-access";

export async function POST(request: Request, { params }: { params: Promise<{ accountId: string }> }) {
  try {
    const { accountId } = await params;
    const { user, serviceSupabase } = await authenticatePlatformAdminRequest(request);
    const body = (await request.json().catch(() => ({}))) as { email?: string; role?: string };
    const email = body.email?.trim().toLowerCase() ?? "";
    const role = body.role === "owner" || body.role === "editor" || body.role === "viewer" ? body.role : "admin";

    if (!email) {
      return Response.json({ error: "Invite email is required." }, { status: 400 });
    }

    const { data: account, error: accountError } = await serviceSupabase
      .from("brandrepo_accounts")
      .select("id,name,slug")
      .eq("id", accountId)
      .maybeSingle();

    if (accountError) {
      return Response.json({ error: accountError.message }, { status: 500 });
    }

    if (!account) {
      return Response.json({ error: "Account not found." }, { status: 404 });
    }

    const origin = new URL(request.url).origin;
    const { data: inviteData, error: inviteError } = await serviceSupabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: origin,
      data: {
        invited_account_id: account.id,
        invited_account_name: account.name,
        invited_account_slug: account.slug,
        invited_account_role: role,
      },
    });

    if (inviteError || !inviteData.user) {
      return Response.json({ error: inviteError?.message ?? "Unable to invite user." }, { status: 500 });
    }

    const membershipResult = await serviceSupabase.from("brandrepo_account_memberships").upsert(
      {
        account_id: account.id,
        user_id: inviteData.user.id,
        role,
      },
      { onConflict: "account_id,user_id" },
    );

    if (membershipResult.error) {
      return Response.json({ error: membershipResult.error.message }, { status: 500 });
    }

    const { data: invite, error: recordError } = await serviceSupabase
      .from("brandrepo_account_invites")
      .insert({
        account_id: account.id,
        email,
        role,
        invited_by: user.id,
        invited_user_id: inviteData.user.id,
        status: "sent",
      })
      .select("id,email,role,status,created_at")
      .single();

    if (recordError) {
      return Response.json({ error: recordError.message }, { status: 500 });
    }

    return Response.json({ invite });
  } catch (error) {
    return repoAccessErrorResponse(error);
  }
}

