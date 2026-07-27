import { supabase } from "@/integrations/supabase/client";

export async function logActivity(
  action: string,
  targetType: string,
  targetId?: string,
  metadata: Record<string, any> = {}
) {
  const { data } = await supabase.auth.getUser();

  if (!data.user) return;

  await supabase.from("activity_log").insert({
    actor_id: data.user.id,
    action,
    target_type: targetType,
    target_id: targetId ?? null,
    metadata,
  });
}