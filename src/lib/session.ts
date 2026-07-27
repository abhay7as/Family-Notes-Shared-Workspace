import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "admin" | "member";

export interface SessionProfile {
  user: User;
  profile: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    disabled: boolean;
  };
  roles: AppRole[];
}

export function useAuthUser() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return user;
}

export function useSession() {
  const user = useAuthUser();
  return useQuery({
    enabled: !!user,
    queryKey: ["session", user?.id],
    queryFn: async (): Promise<SessionProfile | null> => {
      if (!user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      return {
        user,
        profile: profile ?? {
          id: user.id,
          display_name: user.email ?? "Member",
          avatar_url: null,
          disabled: false,
        },
        roles: (roles ?? []).map((r) => r.role as AppRole),
      };
    },
  });
}

export function hasRole(roles: AppRole[] | undefined, ...want: AppRole[]) {
  if (!roles) return false;
  return roles.some((r) => want.includes(r));
}

export function isAdmin(roles: AppRole[] | undefined) {
  return hasRole(roles, "admin", "super_admin");
}