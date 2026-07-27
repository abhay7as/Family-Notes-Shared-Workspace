import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useSession, isAdmin, hasRole, type AppRole } from "@/lib/session";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/members")({
  head: () => ({ meta: [{ title: "Members — Family Notes" }] }),
  component: MembersPage,
});

function initials(name: string) {
  return name.split(" ").map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function MembersPage() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const admin = isAdmin(session?.roles);
  const isSuper = hasRole(session?.roles, "super_admin");

  const members = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }, { data: counts }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("*"),
        supabase.rpc as any // no rpc, we'll count client-side
          ? Promise.resolve({ data: [] })
          : Promise.resolve({ data: [] }),
      ]);
      const noteCounts: Record<string, number> = {};
      const { data: notesCount } = await supabase.from("notes").select("author_id");
      (notesCount ?? []).forEach((n: any) => {
        noteCounts[n.author_id] = (noteCounts[n.author_id] ?? 0) + 1;
      });
      return (profiles ?? []).map((p: any) => ({
        ...p,
        role: (roles ?? []).find((r: any) => r.user_id === p.id)?.role as AppRole | undefined,
        note_count: noteCounts[p.id] ?? 0,
      }));
    },
  });

  const changeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
      await supabase.from("activity_log").insert({
        actor_id: session!.user.id,
        action: "role_changed",
        target_type: "user",
        target_id: userId,
        metadata: { new_role: role } as any,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      toast.success("Role updated");
    },
    onError: (e: any) => toast.error(e.message),
  });
const checkSession = async () => {
  const { data } = await supabase.auth.getSession();

  console.log("Session:", data.session);

  if (!data.session) {
    toast.error("No active session");
    throw new Error("No session");
  }

  return data.session;
};
const deleteUser = useMutation({
  mutationFn: async (userId: string) => {
    const {
      data: sessionData,
    } = await supabase.auth.getSession();

    const token = sessionData.session?.access_token;

    const { data, error } = await supabase.functions.invoke(
      "delete-user",
      {
        body: { userId },
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {},
      }
    );

    console.log("Function Response:", data);
    console.log("Function Error:", error);

    if (error) throw error;

    await supabase.from("activity_log").insert({
      actor_id: session!.user.id,
      action: "user_deleted",
      target_type: "user",
      target_id: userId,
    });
  },

  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["members"] });
    toast.success("Member deleted successfully.");
  },

  onError: (err: any) => {
    console.error(err);
    toast.error(err.message);
  },
});

  if (!admin) {
    return (
      <div className="p-8">
        <h1 className="font-display text-2xl">Members</h1>
        <p className="text-muted-foreground mt-2">Only admins can manage the family.</p>
      </div>
    );
  }

  const list = (members.data ?? []).filter((m: any) =>
    m.display_name?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <h1 className="font-display text-3xl font-bold mb-1">Family members</h1>
      <p className="text-muted-foreground mb-6">Manage who's in the family and what they can do.</p>
      <Input
        placeholder="Search members…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 max-w-sm"
      />
      <div className="space-y-2">
        {list.map((m: any) => {
          const isSelf = m.id === session?.user.id;
          const canEditThisRole = isSuper && !isSelf;
          return (
            <Card key={m.id} className="shadow-soft">
              <CardContent className="p-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={m.avatar_url ?? undefined} />
                  <AvatarFallback>{initials(m.display_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {m.display_name}{" "}
                    {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                    {m.disabled && (
                      <Badge variant="destructive" className="ml-2 text-xs">
                        Disabled
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {m.note_count} notes · joined{" "}
                    {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canEditThisRole ? (
                    <Select
                      value={m.role ?? "member"}
                      onValueChange={(v) => changeRole.mutate({ userId: m.id, role: v as AppRole })}
                    >
                      <SelectTrigger className="w-[130px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      {m.role === "super_admin"
                        ? "Super Admin"
                        : m.role === "admin"
                          ? "Admin"
                          : "Member"}
                    </Badge>
                  )}
                  {isSuper && !isSelf && (
                  <Button
  variant="destructive"
  size="sm"
  onClick={async () => {
    const confirmed = window.confirm(
      `Delete ${m.display_name}? This action cannot be undone.`
    );

    if (!confirmed) return;

    await checkSession();

    deleteUser.mutate(m.id);
  }}
>
  Delete
</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}