import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NOTE_COLORS, type NoteColor, type NoteWithAuthor } from "@/lib/notes";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

export interface NoteDraft {
  title: string;
  content: string;
  color: NoteColor;
  tags: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: NoteWithAuthor;
  onSave: (draft: NoteDraft) => Promise<void> | void;
  readOnly?: boolean;
}

export function NoteEditorDialog({ open, onOpenChange, initial, onSave, readOnly }: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState<NoteColor>("default");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setContent(initial?.content ?? "");
      setColor((initial?.color ?? "default") as NoteColor);
      setTags(initial?.tags ?? []);
      setTagInput("");
    }
  }, [open, initial]);

  function addTag() {
    const t = tagInput.trim().toLowerCase().replace(/^#/, "").slice(0, 24);
    if (!t) return;
    if (!tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  }

  async function handleSave() {
    if (!title.trim() && !content.trim()) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    await onSave({ title: title.trim().slice(0, 200), content: content.slice(0, 20000), color, tags });
    setSaving(false);
    onOpenChange(false);
  }

  const colorClass = NOTE_COLORS.find((c) => c.value === color)?.className ?? "bg-card";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-2xl", colorClass)}>
        <DialogHeader>
          <DialogTitle className="font-display">
            {initial ? "Edit note" : "New note"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg font-display bg-transparent border-none focus-visible:ring-0 px-0"
            maxLength={200}
            disabled={readOnly}
          />
          <Textarea
            placeholder="Write something for the family…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[240px] bg-transparent border-none focus-visible:ring-0 px-0 resize-none"
            maxLength={20000}
            disabled={readOnly}
          />
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <Badge key={t} variant="secondary" className="text-xs gap-1">
                  #{t}
                  {!readOnly && (
                    <button onClick={() => setTags(tags.filter((x) => x !== t))} aria-label="Remove tag">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          )}
          {!readOnly && (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Add a tag and press Enter"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                className="h-8 text-sm max-w-xs"
              />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground mr-1">Color:</span>
            {NOTE_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setColor(c.value)}
                aria-label={c.label}
                className={cn(
                  "h-6 w-6 rounded-full border-2 transition",
                  c.className,
                  color === c.value ? "border-primary scale-110" : "border-border/50",
                )}
                disabled={readOnly}
              />
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {!readOnly && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}