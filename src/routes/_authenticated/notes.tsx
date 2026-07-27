import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Plus, Search } from "lucide-react";
import { useSession, isAdmin } from "@/lib/session";
import {
  useCreateNote,
  useDeleteNote,
  useDuplicateNote,
  useNotes,
  useToggleFavorite,
  useUpdateNote,
  type NoteWithAuthor,
} from "@/lib/notes";
import { NoteCard } from "@/components/note-card";
import { NoteEditorDialog, type NoteDraft } from "@/components/note-editor-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "motion/react";

const searchSchema = z.object({
  view: z.enum(["pinned", "favorites", "archived"]).optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({ meta: [{ title: "Notes — Family Notes" }] }),
  validateSearch: searchSchema,
  component: NotesPage,
});

function NotesPage() {
  const { view } = Route.useSearch();

  console.log("Current View:", view);
  const { data: session } = useSession();
  const userId = session?.user.id;
  const admin = isAdmin(session?.roles);
  const notesQ = useNotes(userId);
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const toggleFav = useToggleFavorite();
  const duplicate = useDuplicateNote();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<NoteWithAuthor | undefined>();
  const [creating, setCreating] = useState(false);

  const notes = useMemo(() => {
    const all = notesQ.data ?? [];
    let list = all;
    if (view === "archived") list = list.filter((n) => n.archived);
    else list = list.filter((n) => !n.archived);
    if (view === "pinned") list = list.filter((n) => n.pinned);
    if (view === "favorites") list = list.filter((n) => n.is_favorite);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(needle) ||
          n.content.toLowerCase().includes(needle) ||
          n.tags.some((t) => t.toLowerCase().includes(needle)),
      );
    }
    return list;
  }, [notesQ.data, view, q]);

  const title =
    view === "pinned" ? "Pinned notes"
    : view === "favorites" ? "Your favorites"
    : view === "archived" ? "Archived notes"
    : "All notes";

  async function handleSave(draft: NoteDraft) {
    if (!userId) return;
    if (editing) {
      await updateNote.mutateAsync({ id: editing.id, patch: draft });
    } else {
      await createNote.mutateAsync({ author_id: userId, ...draft });
    }
    setEditing(undefined);
    setCreating(false);
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:items-center sm:justify-between mb-6">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold truncate">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {notes.length} {notes.length === 1 ? "note" : "notes"}
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">New note</span>
        </Button>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search notes, tags, content…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {notesQ.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading notes…</div>
      ) : notes.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-dashed">
          <div className="text-5xl mb-3">🗒️</div>
          <p className="font-display text-xl font-semibold">No notes here yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            {view === "archived" ? "You haven't archived anything." : "Start your first family note."}
          </p>
          {view !== "archived" && (
            <Button className="mt-4" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-1" /> New note
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {notes.map((n) => (
              <motion.div key={n.id} layout>
                <NoteCard
                  note={n}
                  currentUserId={userId ?? ""}
                  isAdmin={admin}
                  onOpen={() => setEditing(n)}
                  onTogglePin={() => updateNote.mutate({ id: n.id, patch: { pinned: !n.pinned } })}
                  onToggleFavorite={() =>
                    userId && toggleFav.mutate({ noteId: n.id, userId, value: !n.is_favorite })
                  }
                  onArchive={() => updateNote.mutate({ id: n.id, patch: { archived: !n.archived } })}
                  onDuplicate={() => duplicate.mutate(n)}
                onDelete={() => {
  if (view === "favorites") {
    if (userId) {
      toggleFav.mutate({
        noteId: n.id,
        userId,
        value: false,
      });
    }
  } else {
    if (confirm("Delete this note? This cannot be undone.")) {
      deleteNote.mutate(n.id);
    }
  }
}}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <NoteEditorDialog
        open={creating || !!editing}
        onOpenChange={(v) => {
          if (!v) {
            setCreating(false);
            setEditing(undefined);
          }
        }}
        initial={editing}
        readOnly={!!editing && editing.author_id !== userId && !admin}
        onSave={handleSave}
      />
    </div>
  );
}