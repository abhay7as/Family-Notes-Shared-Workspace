import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { Resend } from "npm:resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

export default {
  fetch: withSupabase(
    { auth: ["publishable", "secret"] },
    async (req, ctx) => {
      try {
        const {
          data: { user },
        } = await ctx.supabase.auth.getUser(
          req.headers.get("Authorization")?.replace("Bearer ", "")
        );

        if (!user) {
          return Response.json(
            { error: "Unauthorized" },
            { status: 401 }
          );
        }

        const { email, role } = await req.json();

        if (!email) {
          return Response.json(
            { error: "Email required" },
            { status: 400 }
          );
        }

        // Get sender profile
        const { data: profile } = await ctx.supabaseAdmin
          .from("profiles")
          .select("family_id,display_name")
          .eq("id", user.id)
          .single();

        if (!profile?.family_id) {
          return Response.json(
            { error: "No family found" },
            { status: 400 }
          );
        }

        // Verify admin
        const { data: userRole } = await ctx.supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        if (
          !userRole ||
          !["admin", "super_admin"].includes(userRole.role)
        ) {
          return Response.json(
            { error: "Not allowed" },
            { status: 403 }
          );
        }

        const token = crypto.randomUUID();

        const expires = new Date();
        expires.setDate(expires.getDate() + 7);

        const { error } = await ctx.supabaseAdmin
          .from("family_invites")
          .insert({
            family_id: profile.family_id,
            email,
            role: role ?? "member",
            invited_by: user.id,
            token,
            accepted: false,
            expires_at: expires.toISOString(),
          });

        if (error) {
          return Response.json(
            { error: error.message },
            { status: 400 }
          );
        }

        const inviteUrl =
          "https://family-notes-shared-workspace.vercel.app/accept-invite?token=" +
          token;

        const { error: emailError } = await resend.emails.send({
        from: "Family Notes <noreply@familynotes.app>"
          to: email,
          subject: "You've been invited!",
          html: `
            <h2>Family Notes</h2>

            <p>${profile.display_name} invited you to join their family.</p>

            <a
              href="${inviteUrl}"
              style="
                display:inline-block;
                background:#000;
                color:white;
                padding:12px 20px;
                text-decoration:none;
                border-radius:8px;
              "
            >
              Accept Invite
            </a>

            <p>This invitation expires in 7 days.</p>
          `,
        });

        if (emailError) {
          return Response.json(
            { error: emailError.message },
            { status: 400 }
          );
        }

        return Response.json({
          success: true,
        });
      } catch (e) {
        return Response.json(
          {
            error: e instanceof Error ? e.message : String(e),
          },
          { status: 500 }
        );
      }
    }
  ),
};