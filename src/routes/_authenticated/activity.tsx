import { createFileRoute } from "@tanstack/react-router";
import { useActivity } from "@/lib/activity";
import { format, formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "Activity — Family Notes" }] }),
  component: ActivityPage,
});

function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function describe(action: string) {
  return (
    {
      note_created: "created",
      note_updated: "edited",
      note_deleted: "deleted",
      note_pinned: "pinned",
      note_unpinned: "unpinned",
      note_archived: "archived",
      note_restored: "restored",
      note_favorited: "favorited",
      note_unfavorited: "removed from favorites",
      note_duplicated: "duplicated",

      user_logged_in: "signed in",
      user_logged_out: "signed out",
      user_deleted: "deleted",
      role_changed: "changed a member's role",
    } as Record<string, string>
  )[action] ?? action.replace(/_/g, " ");
}

function ActivityPage() {
  const q = useActivity();

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <h1 className="font-display text-3xl font-bold mb-6">Activity</h1>

      <Card className="shadow-soft">
        <CardContent className="p-0 divide-y">
          {(q.data ?? []).map((a) => (
            <div key={a.id} className="flex items-start gap-4 p-4">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={a.actor?.avatar_url ?? undefined} />
                <AvatarFallback>
                  {initials(a.actor?.display_name ?? "?")}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <p className="text-sm leading-6">
                  <span className="font-semibold text-foreground">
                    {a.actor?.display_name ?? "Someone"}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {describe(a.action)}
                  </span>{" "}
                  {a.metadata?.title && (
                    <span className="font-medium text-foreground">
                      "{a.metadata.title}"
                    </span>
                  )}
                </p>

                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(a.created_at), "dd MMM yyyy • hh:mm a")}
                  {" • "}
                  {formatDistanceToNow(new Date(a.created_at), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
          ))}

          {q.data && q.data.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No activity yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}