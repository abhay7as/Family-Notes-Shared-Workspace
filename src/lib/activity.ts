import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export async function logActivity(
  action: string,
  targetType: string,
  targetId?: string,
  metadata: Record<string, any> = {}
) {
  // Get logged-in user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("No authenticated user.", userError);
    return;
  }

  console.log("Current User:", user.id);

  // Get profile
 

 
const { data: member, error: memberError } = await supabase
  .from("family_members")
  .select("*")
  .eq("user_id", user.id)
  .single();

console.log("MEMBER:", member);
console.log("MEMBER ERROR:", memberError);

if (memberError || !member) {
  console.error("Family Member Error:", memberError);
  return;
}

const payload = {
  actor_id: user.id,
  family_id: member.family_id,
  action,
  target_type: targetType,
  target_id: targetId ?? null,
  metadata,
};

  console.log("INSERTING:", payload);

  const { data, error } = await supabase
    .from("activity_log")
    .insert(payload)
    .select();

  console.log("Inserted Row:", data);
  console.log("Insert Data:", data);
console.log("Insert Error:", error);

  if (error) {
    console.error("Activity Insert Error:", error);
  }
}

export function useActivity() {
  return useQuery({
    queryKey: ["activity"],

    queryFn: async () => {
      const { data: activities, error } = await supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) {
        console.error(error);
        throw error;
      }

      if (!activities || activities.length === 0) {
        return [];
      }

      const actorIds = [
        ...new Set(
          activities
            .map((a) => a.actor_id)
            .filter((id): id is string => !!id)
        ),
      ];

      let profileMap = new Map<
        string,
        {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
        }
      >();

      if (actorIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", actorIds);

        if (profileError) {
          console.error(profileError);
        } else {
          profileMap = new Map(
            (profiles ?? []).map((p) => [p.id, p])
          );
        }
      }

      return activities.map((activity) => ({
        ...activity,
        actor: profileMap.get(activity.actor_id ?? "") ?? null,
      }));
    },
  });
}