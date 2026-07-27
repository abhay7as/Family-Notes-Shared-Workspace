import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";


export async function logActivity(
  action: string,
  targetType: string,
  targetId?: string,
  metadata: Record<string, any> = {}
) {
  const { data: userRes } = await supabase.auth.getUser();

  if (!userRes.user) return;

  await supabase.from("activity_log").insert({
    actor_id: userRes.user.id,
    action,
    target_type: targetType,
    target_id: targetId ?? null,
    metadata,
  });
}
export function useActivity() {
  return useQuery({
    queryKey: ["activity"],

    queryFn: async () => {
      const { data: activities, error } = await supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000); // only fetch latest 1000 activities

      if (error) throw error;

      const actorIds = [
        ...new Set(
          (activities ?? [])
            .map((a) => a.actor_id)
            .filter(Boolean)
        ),
      ];

      let profileMap = new Map();

      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", actorIds);

        profileMap = new Map(
          (profiles ?? []).map((p) => [p.id, p])
        );
      }

      return (activities ?? []).map((a) => ({
        ...a,
        actor: profileMap.get(a.actor_id) ?? null,
      }));
    },
  });
}