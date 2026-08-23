import { Command } from "cmdk";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageGlyph } from "@/components/page-icon";
import { useNotes } from "@/lib/notes/store";
import { cn } from "@/lib/utils";

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const pages = useNotes((s) => s.pages);
  const setCurrent = useNotes((s) => s.setCurrent);
  const createPage = useNotes((s) => s.createPage);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = Object.values(pages);
    if (!query) return list.slice(0, 12);
    return list
      .map((p) => {
        const hay = `${p.title} ${p.tags.join(" ")} ${p.blocks.map((b) => b.content).join(" ")}`.toLowerCase();
        return { p, hit: hay.includes(query) };
      })
      .filter((x) => x.hit)
      .map((x) => x.p)
      .slice(0, 20);
  }, [pages, q]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg/70 px-3 pt-[12vh] backdrop-blur-[2px]"
      onClick={() => onOpenChange(false)}
    >
      <Command
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-[0_24px_80px_-24px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
        label="جستجو"
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 text-subtle" />
          <Command.Input
            value={q}
            onValueChange={setQ}
            placeholder="جستجو در عنوان، تگ و متن…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-subtle"
          />
        </div>
        <Command.List className="max-h-80 overflow-y-auto p-1.5">
          <Command.Empty className="px-3 py-6 text-center text-sm text-muted">
            نتیجه‌ای نیست
          </Command.Empty>
          {results.map((p) => (
            <Command.Item
              key={p.id}
              value={`${p.title} ${p.tags.join(" ")} ${p.id}`}
              onSelect={() => {
                setCurrent(p.id);
                onOpenChange(false);
              }}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm",
                "data-[selected=true]:bg-surface-2",
              )}
            >
              <PageGlyph name={p.icon} className="text-muted" />
              <span className="flex-1 truncate">{p.title}</span>
              {p.tags[0] ? (
                <span className="text-[11px] text-subtle">{p.tags[0]}</span>
              ) : null}
            </Command.Item>
          ))}
          {q.trim() ? (
            <Command.Item
              value={`create ${q}`}
              onSelect={() => {
                createPage({ title: q.trim() });
                onOpenChange(false);
              }}
              className="mt-1 flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-muted data-[selected=true]:bg-surface-2"
            >
              ساخت صفحه «{q.trim()}»
            </Command.Item>
          ) : null}
        </Command.List>
      </Command>
    </div>
  );
}
