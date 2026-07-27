import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type NoteColor =
  | "default"
  | "butter"
  | "peach"
  | "rose"
  | "sage"
  | "sky"
  | "lavender";

export interface Note {
  id: string;
  author_id: string;
  title: string;
  content: string;
  color: NoteColor;
  pinned: boolean;
  archived: boolean;
  tags: string[];
  edited: boolean;
  created_at: string;
  updated_at: string;
}

export interface NoteWithAuthor extends Note {
  author?: {
    display_name: string;
    avatar_url: string | null;
  } | null;
  is_favorite?: boolean;
}

export const NOTE_COLORS = [
  { value: "default", label: "Paper", className: "bg-card" },
  { value: "butter", label: "Butter", className: "bg-note-butter" },
  { value: "peach", label: "Peach", className: "bg-note-peach" },
  { value: "rose", label: "Rose", className: "bg-note-rose" },
  { value: "sage", label: "Sage", className: "bg-note-sage" },
  { value: "sky", label: "Sky", className: "bg-note-sky" },
  { value: "lavender", label: "Lavender", className: "bg-note-lavender" },
] as const;

export function useNotes(userId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    enabled: !!userId,
    queryKey: ["notes"],

    queryFn: async (): Promise<NoteWithAuthor[]> => {
      const [{ data: notes, error }, { data: favs }] = await Promise.all([
        supabase
          .from("notes")
          .select("*")
          .order("pinned", { ascending: false })
          .order("updated_at", { ascending: false }),

        userId
          ? supabase.from("note_favorites").select("note_id").eq("user_id", userId)
          : Promise.resolve({ data: [] }),
      ]);

      if (error) throw error;

      const authorIds = [...new Set((notes ?? []).map((n) => n.author_id))];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", authorIds);

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

      const favSet = new Set((favs ?? []).map((f: any) => f.note_id));

      return (notes ?? []).map((n: any) => ({
        ...n,
        author: profileMap.get(n.author_id) ?? null,
        is_favorite: favSet.has(n.id),
      }));
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("notes-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notes",
        },
        () => {
          qc.invalidateQueries({ queryKey: ["notes"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "note_favorites",
        },
        () => {
          qc.invalidateQueries({ queryKey: ["notes"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return query;
}

async function logActivity(
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

export function useCreateNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<Note> & { author_id: string }) => {
      const { data, error } = await supabase
        .from("notes")
        .insert({
          author_id: input.author_id,
          title: input.title ?? "",
          content: input.content ?? "",
          color: input.color ?? "default",
          tags: input.tags ?? [],
          pinned: input.pinned ?? false,
        })
        .select()
        .single();

      if (error) {
        console.error("CREATE NOTE ERROR", error);
        throw error;
      }

      await logActivity("note_duplicated", "note", data.id, {
  title: data.title,
});

      return data;
    },

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["notes"],
      });
    },

    onError: (e: any) => {
      console.error(e);
      toast.error(e.message ?? "Couldn't create note");
    },
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();

  return useMutation({
   mutationFn: async ({
  id,
  patch,
}: {
  id: string;
  patch: Partial<Note>;
}) => {
  const { data, error } = await supabase
    .from("notes")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("UPDATE NOTE ERROR", error);
    throw error;
  }

  if (patch.pinned !== undefined) {
    await logActivity(
      patch.pinned ? "note_pinned" : "note_unpinned",
      "note",
      id,
      {
        title: data.title,
      }
    );
  } else if (patch.archived !== undefined) {
    await logActivity(
      patch.archived ? "note_archived" : "note_restored",
      "note",
      id,
      {
        title: data.title,
      }
    );
  } else {
    await logActivity("note_updated", "note", id, {
      title: data.title,
    });
  }

  return data;
},onSuccess: () => {
  qc.invalidateQueries({
    queryKey: ["notes"],
  });
},

onError: (e: any) => {
  console.error(e);
  toast.error(e.message ?? "Couldn't save note");
},
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // grab the title before the row is gone, or the activity log
      // would have nothing to show but "deleted a note"
      const { data: note } = await supabase
        .from("notes")
        .select("title")
        .eq("id", id)
        .single();

      const { error } = await supabase
        .from("notes")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("DELETE NOTE ERROR", error);
        throw error;
      }

      await logActivity("note_deleted", "note", id, {
        title: note?.title,
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["notes"],
      });
    },

    onError: (e: any) => {
      console.error(e);
      toast.error(e.message ?? "Couldn't delete note");
    },
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      noteId,
      userId,
      value,
    }: {
      noteId: string;
      userId: string;
      value: boolean;
    }) => {
      const { data: note } = await supabase
        .from("notes")
        .select("title")
        .eq("id", noteId)
        .single();

      if (value) {
        const { error } = await supabase
          .from("note_favorites")
          .insert({
            note_id: noteId,
            user_id: userId,
          });

        if (error && !error.message.includes("duplicate")) {
          console.error(error);
          throw error;
        }

        await logActivity("note_favorited", "note", noteId, {
          title: note?.title,
        });
      } else {
        const { error } = await supabase
          .from("note_favorites")
          .delete()
          .eq("note_id", noteId)
          .eq("user_id", userId);

        if (error) {
          console.error(error);
          throw error;
        }

        await logActivity("note_unfavorited", "note", noteId, {
          title: note?.title,
        });
      }
    },

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["notes"],
      });
    },
  });
}

export function useDuplicateNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (note: Note) => {
      const { data: userRes } = await supabase.auth.getUser();

      if (!userRes.user) {
        throw new Error("Not signed in");
      }

      const { data, error } = await supabase
        .from("notes")
        .insert({
          author_id: userRes.user.id,
          title: note.title ? `${note.title} (copy)` : "",
          content: note.content,
          color: note.color,
          tags: note.tags,
        })
        .select()
        .single();

      if (error) {
        console.error("DUPLICATE NOTE ERROR", error);
        throw error;
      }

      await logActivity("note_created", "note", data.id, {
        title: data.title,
      });

      return data;
    },

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["notes"],
      });

      toast.success("Note duplicated");
    },
  });
}
