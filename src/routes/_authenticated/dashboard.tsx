import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { StickyNote, Pin, Users, Activity as ActivityIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Family Notes" }] }),
  component: Dashboard,
});

function initials(name: string) {
  return name.split(" ").map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function Dashboard() {
  const { data: session } = useSession();
  const name = session?.profile.display_name?.split(" ")[0] ?? "there";

  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [notes, pinned, members, activity] = await Promise.all([
        supabase.from("notes").select("id", { count: "exact", head: true }).eq("archived", false),
        supabase.from("notes").select("id", { count: "exact", head: true }).eq("pinned", true),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase
          .from("activity_log")
          .select("*, actor:profiles!activity_log_actor_id_fkey(display_name, avatar_url)")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      return {
        notes: notes.count ?? 0,
        pinned: pinned.count ?? 0,
        members: members.count ?? 0,
        activity: (activity.data ?? []) as any[],
      };
    },
  });

  const recent = useQuery({
    queryKey: ["dashboard-recent-notes"],
    queryFn: async () => {
    const { data: notes } = await supabase
  .from("notes")
  .select("id, title, updated_at, author_id")
  .eq("archived", false)
  .order("updated_at", { ascending: false })
  .limit(6);

const authorIds = [...new Set((notes ?? []).map((n) => n.author_id))];

const { data: profiles } = await supabase
  .from("profiles")
  .select("id, display_name")
  .in("id", authorIds);

const profileMap = new Map(
  (profiles ?? []).map((p) => [p.id, p])
);

return (notes ?? []).map((n) => ({
  ...n,
  author: profileMap.get(n.author_id) ?? null,
}));
      return (data ?? []) as any[];
    },
  });

  const StatCard = ({ icon: Icon, label, value }: any) => (
    <Card className="shadow-soft">
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-display font-bold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold">Hi, {name} 👋</h1>
        <p className="text-muted-foreground mt-1">Here's what your family has been up to.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={StickyNote} label="Active notes" value={stats.data?.notes ?? "—"} />
        <StatCard icon={Pin} label="Pinned" value={stats.data?.pinned ?? "—"} />
        <StatCard icon={Users} label="Family members" value={stats.data?.members ?? "—"} />
        <StatCard icon={ActivityIcon} label="Recent actions" value={stats.data?.activity.length ?? "—"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="font-display">Recent notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(recent.data ?? []).map((n) => (
              <div key={n.id} className="flex items-center justify-between text-sm py-1">
                <div className="min-w-0">
                  <div className="font-medium truncate">{n.title || "Untitled"}</div>
                  <div className="text-xs text-muted-foreground">
                    {n.author?.display_name ?? "Someone"}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0 ml-2">
                  {formatDistanceToNow(new Date(n.updated_at), { addSuffix: true })}
                </div>
              </div>
            ))}
            {recent.data && recent.data.length === 0 && (
              <div className="text-sm text-muted-foreground">No notes yet. Create the first one!</div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="font-display">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(stats.data?.activity ?? []).map((a) => (
              <div key={a.id} className="flex items-center gap-3 text-sm">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={a.actor?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {initials(a.actor?.display_name ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate">
                    <span className="font-medium">{a.actor?.display_name ?? "Someone"}</span>{" "}
                    <span className="text-muted-foreground">{describeAction(a.action)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </div>
                </div>
              </div>
            ))}
            {stats.data && stats.data.activity.length === 0 && (
              <div className="text-sm text-muted-foreground">Nothing yet.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function describeAction(action: string) {
  switch (action) {
    case "note_created":
      return "created a note";
    case "note_updated":
      return "edited a note";
    case "note_deleted":
      return "deleted a note";
    case "role_changed":
      return "changed a member role";
    default:
      return action.replace(/_/g, " ");
  }
}