import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:3000";

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser();

    if (callerError || !caller) return json({ error: "Invalid or expired session" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerRoleRow, error: callerRoleError } = await admin
      .from("user_roles")
      .select("role, family_id")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (callerRoleError) return json({ error: callerRoleError.message }, 500);

    if (!callerRoleRow || !["admin", "super_admin"].includes(callerRoleRow.role)) {
      return json({ error: "Only admins can invite members" }, 403);
    }

    const body = await req.json().catch(() => null);
    const email = body?.email?.trim().toLowerCase();
    const role = body?.role ?? "member";

    if (!email) return json({ error: "Email is required" }, 400);
    if (!["member", "admin", "super_admin"].includes(role)) {
      return json({ error: "Invalid role" }, 400);
    }
    if (role === "super_admin" && callerRoleRow.role !== "super_admin") {
      return json({ error: "Only a super admin can invite another super admin" }, 403);
    }

    const { data: inviteData, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email, {
        data: {
          family_id: callerRoleRow.family_id,
          role,
          invited_by: caller.id,
        },
        redirectTo: `${siteUrl}/accept-invite`,
      });

    if (inviteError) return json({ error: inviteError.message }, 400);

    await admin.from("activity_log").insert({
      actor_id: caller.id,
      action: "invitation_sent",
      target_type: "user",
      target_id: inviteData.user?.id ?? null,
      metadata: { email, role },
    });

    return json({ success: true, user: inviteData.user }, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});