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
import { Loader2 } from "lucide-react";

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

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("member");
  const [isInviting, setIsInviting] = useState(false);

  const members = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const [
        { data: profiles, error: profilesError },
        { data: roles, error: rolesError },
      ] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("*"),
      ]);

      if (profilesError) throw profilesError;
      if (rolesError) throw rolesError;

      const noteCounts: Record<string, number> = {};
      const { data: notesCount } = await supabase.from("notes").select("author_id");
      (notesCount ?? []).forEach((n: any) => {
        noteCounts[n.author_id] = (noteCounts[n.author_id] ?? 0) + 1;
      });

      return (profiles ?? []).map((p: any) => {
        const roleRow = (roles ?? []).find((r: any) => r.user_id === p.id);
        return {
          ...p,
          role: roleRow?.role as AppRole | undefined,
          family_id: roleRow?.family_id ?? p.family_id,
          note_count: noteCounts[p.id] ?? 0,
        };
      });
    },
  });

  // send-family-invite already picks up the caller's session automatically
  // via supabase-js — no manual Authorization header needed here.
  const inviteMember = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: AppRole }) => {
      const { error } = await supabase.functions.invoke("send-family-invite", {
        body: { email, role },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invitation sent!");
      qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const changeRole = useMutation({
    mutationFn: async ({
      userId,
      role,
      familyId,
    }: {
      userId: string;
      role: AppRole;
      familyId: string;
    }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);

      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role, family_id: familyId });
      if (error) throw error;

      if (!session) throw new Error("No session");

      await supabase.from("activity_log").insert({
        actor_id: session.user.id,
        action: "role_changed",
        target_type: "user",
        target_id: userId,
        metadata: { new_role: role },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      toast.success("Role updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.functions.invoke("delete-user", {
        body: { userId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      toast.success("Member deleted successfully.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (!admin) {
    return (
      <div className="p-8">
        <h1 className="font-display text-2xl">Members</h1>
        <p className="text-muted-foreground mt-2">Only admins can manage the family.</p>
      </div>
    );
  }

  if (members.isLoading) {
    return (
      <div className="p-8 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading members…
      </div>
    );
  }

  if (members.error) {
    return (
      <div className="p-8 text-destructive">
        Failed to load members.{" "}
        <button
          className="underline"
          onClick={() => qc.invalidateQueries({ queryKey: ["members"] })}
        >
          Retry
        </button>
      </div>
    );
  }

  const list = (members.data ?? []).filter((m: any) =>
    m.display_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <h1 className="font-display text-3xl font-bold mb-1">Family members</h1>
      <p className="text-muted-foreground mb-6">Manage who's in the family and what they can do.</p>

      <div className="flex gap-2 mb-6">
        <Input
          placeholder="family@email.com"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
        />
        <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            {isSuper && <SelectItem value="super_admin">Super Admin</SelectItem>}
          </SelectContent>
        </Select>
        <Button
          disabled={isInviting}
          onClick={async () => {
            if (!inviteEmail) {
              toast.error("Enter an email");
              return;
            }
            setIsInviting(true);
            await inviteMember.mutateAsync({ email: inviteEmail, role: inviteRole });
            setIsInviting(false);
            setInviteEmail("");
            setInviteRole("member");
          }}
        >
          {isInviting ? "Sending…" : "Invite"}
        </Button>
      </div>

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
                      onValueChange={(v) =>
                        changeRole.mutate({
                          userId: m.id,
                          role: v as AppRole,
                          familyId: m.family_id,
                        })
                      }
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
                      disabled={deleteUser.isPending}
                      onClick={() => {
                        const confirmed = window.confirm(
                          `Delete ${m.display_name}? This action cannot be undone.`
                        );
                        if (!confirmed) return;
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