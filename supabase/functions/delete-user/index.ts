import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

console.log("DELETE FUNCTION V3");

export default {
  fetch: withSupabase(
    { auth: ["publishable", "secret"] },
    async (req, ctx) => {
      try {
        console.log("========== DELETE USER ==========");

        console.log(
          "Authorization Header:",
          req.headers.get("Authorization")
        );

        const { userId } = await req.json();

        if (!userId) {
          return Response.json(
            { error: "Missing userId" },
            { status: 400 }
          );
        }

        // Get logged in user
      const authHeader = req.headers.get("Authorization");

console.log("Authorization Header:", authHeader);

const {
  data: { user },
  error: userError,
} = await ctx.supabase.auth.getUser(authHeader?.replace("Bearer ", ""));

console.log("USER:", user);
console.log("USER ERROR:", userError);
        console.log("USER:", user);
        console.log("USER ERROR:", userError);

        if (userError) {
          return Response.json(
            {
              step: "getUser",
              error: userError.message,
            },
            { status: 401 }
          );
        }

        if (!user) {
          return Response.json(
            {
              step: "getUser",
              error: "No authenticated user",
            },
            { status: 401 }
          );
        }

        // Prevent deleting yourself
        if (user.id === userId) {
          return Response.json(
            { error: "You cannot delete yourself." },
            { status: 400 }
          );
        }

        console.log("Deleting user_roles...");
        const { error: roleError } = await ctx.supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", userId);

        console.log("ROLE ERROR:", roleError);

        console.log("Deleting profile...");
        const { error: profileError } = await ctx.supabaseAdmin
          .from("profiles")
          .delete()
          .eq("id", userId);

        console.log("PROFILE ERROR:", profileError);

        console.log("Deleting auth user...");
        const { error: deleteError } =
          await ctx.supabaseAdmin.auth.admin.deleteUser(userId);

        console.log("DELETE ERROR:", deleteError);

        if (deleteError) {
          return Response.json(
            {
              step: "deleteUser",
              error: deleteError.message,
            },
            { status: 400 }
          );
        }

        console.log("SUCCESS");

        return Response.json({
          success: true,
        });
      } catch (err) {
        console.log("CATCH:", err);

        return Response.json(
          {
            error: err instanceof Error ? err.message : String(err),
          },
          { status: 500 }
        );
      }
    }
  ),
};