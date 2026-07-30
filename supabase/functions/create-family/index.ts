import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

export default {
  fetch: withSupabase(
    { auth: ["publishable", "secret"] },
    async (req, ctx) => {
      try {
        const {
          data: { user },
          error: userError,
        } = await ctx.supabase.auth.getUser(
          req.headers.get("Authorization")?.replace("Bearer ", "")
        );

        if (userError || !user) {
          return Response.json(
            { error: "Unauthorized" },
            { status: 401 }
          );
        }

        const { familyName, displayName } = await req.json();

        if (!familyName) {
          return Response.json(
            { error: "Family name required" },
            { status: 400 }
          );
        }

        const inviteCode = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();

        // Create family
        const { data: family, error: familyError } =
          await ctx.supabaseAdmin
            .from("families")
            .insert({
              name: familyName,
              owner_id: user.id,
              invite_code: inviteCode,
            })
            .select()
            .single();

        if (familyError) {
          return Response.json(
            { error: familyError.message },
            { status: 400 }
          );
        }

        // Create profile
        const { error: profileError } = await ctx.supabaseAdmin
  .from("profiles")
  .update({
    display_name: displayName,
    family_id: family.id,
  })
  .eq("id", user.id);

if (profileError) {
  return Response.json(
    { error: profileError.message },
    { status: 400 }
  );
}const { data: updatedProfile } = await ctx.supabaseAdmin
  .from("profiles")
  .select("*")
  .eq("id", user.id)
  .single();

console.log(updatedProfile);

        // Add family member
       const { error: memberError } = await ctx.supabaseAdmin
  .from("family_members")
  .insert({
    family_id: family.id,
    user_id: user.id,
    role: "super_admin",
  });

if (memberError) {
  return Response.json(
    { error: memberError.message },
    { status: 400 }
  );
}

 
// Assign role
const { error: roleError } = await ctx.supabaseAdmin
  .from("user_roles")
  .insert({
    family_id: family.id,
    user_id: user.id,
    role: "super_admin",
  });

if (roleError) {
  return Response.json(
    { error: roleError.message },
    { status: 400 }
  );
}
if (roleError) {
  return Response.json(
    { error: roleError.message },
    { status: 400 }
  );
}

        return Response.json({
          success: true,
          family,
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