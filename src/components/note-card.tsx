import { Pin, Star, MoreHorizontal, Copy, Trash2, Archive, ArchiveRestore } from "lucide-react";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { NoteWithAuthor } from "@/lib/notes";
import { NOTE_COLORS } from "@/lib/notes";

function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface Props {
  note: NoteWithAuthor;
  currentUserId: string;
  isAdmin: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
  onToggleFavorite: () => void;
  onArchive: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function NoteCard({
  note,
  currentUserId,
  isAdmin,
  onOpen,
  onTogglePin,
  onToggleFavorite,
  onArchive,
  onDuplicate,
  onDelete,
}: Props) {
  const colorClass =
    NOTE_COLORS.find((c) => c.value === note.color)?.className ?? "bg-card";

  const isOwn = note.author_id === currentUserId;
  const canEdit = isOwn || isAdmin;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card
      onMouseMove={(e)=>{

const rect=e.currentTarget.getBoundingClientRect();

e.currentTarget.style.setProperty(
"--x",
`${e.clientX-rect.left}px`
);

e.currentTarget.style.setProperty(
"--y",
`${e.clientY-rect.top}px`
);

}}
        className={cn(
          "shadow-card border-border/50 overflow-hidden cursor-pointer group",
          colorClass
        )}
        onClick={onOpen}
      >
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-lg font-semibold leading-tight line-clamp-2 flex-1 min-w-0">
              {note.title || (
                <span className="text-muted-foreground italic">
                  Untitled
                </span>
              )}
            </h3>

            <div
              className="flex items-center gap-0.5 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onToggleFavorite}
              >
             <Star
  className={cn(
    "h-4 w-4 transition-all duration-200",
    note.is_favorite
      ? "fill-yellow-400 text-yellow-400"
      : "text-muted-foreground hover:text-yellow-400"
  )}
/>
              </Button>

              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onTogglePin}
                >
               <Pin
  className={cn(
    "h-4 w-4 transition-all duration-200",
    note.pinned
      ? "fill-blue-500 text-blue-500"
      : "text-muted-foreground hover:text-blue-500"
  )}
/>
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
  side="top"
  align="end"
  sideOffset={8}
>
                  <DropdownMenuItem onSelect={onDuplicate}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>

                  {canEdit && (
                    <DropdownMenuItem onSelect={onArchive}>
                      {note.archived ? (
                        <>
                          <ArchiveRestore className="h-4 w-4 mr-2" />
                          Restore
                        </>
                      ) : (
                        <>
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </>
                      )}
                    </DropdownMenuItem>
                  )}

                  {canEdit && (
                    <DropdownMenuItem
                      onSelect={onDelete}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {note.content && (
            <p className="text-sm text-foreground/80 whitespace-pre-wrap line-clamp-6">
              {note.content}
            </p>
          )}

          {note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {note.tags.slice(0, 4).map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs"
                >
                  #{tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="border-t pt-3 mt-2 flex gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={note.author?.avatar_url ?? undefined} />
              <AvatarFallback>
                {initials(note.author?.display_name ?? "?")}
              </AvatarFallback>
            </Avatar>

            <div className="flex flex-col text-xs text-muted-foreground flex-1">
              <span className="font-semibold text-foreground">
                👤 {note.author?.display_name || "Unknown User"}
              </span>

              <span>
                📅 Created:
                {" "}
                {new Date(note.created_at).toLocaleString()}
              </span>

              <span>
                🕒 Updated:
                {" "}
                {new Date(note.updated_at).toLocaleString()}
              </span>

              {note.edited && (
                <Badge
                  variant="outline"
                  className="mt-1 w-fit text-[10px]"
                >
                  Edited
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}