import { Command } from "cmdk";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageGlyph } from "@/components/page-icon";
import { pageBody } from "@/lib/notes/markdown";
import { useNotes } from "@/lib/notes/store";
import type { PageIcon } from "@/lib/notes/types";
import { cn } from "@/lib/utils";

type Hit = { pageId: string; blockId: string | null; title: string; snippet: string; icon: PageIcon };

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
    if (!query) {
      return list.slice(0, 12).map((p) => ({
        pageId: p.id,
        blockId: null,
        title: p.title || "بدون عنوان",
        snippet: p.tags.join(" · ") || "صفحه",
        icon: p.icon,
      })) satisfies Hit[];
    }
    const hits: Hit[] = [];
    const seen = new Set<string>();
    for (const p of list) {
      const titleHit = p.title.toLowerCase().includes(query) || p.tags.some((t) => t.toLowerCase().includes(query));
      if (titleHit) {
        const key = `${p.id}:title`;
        seen.add(key);
        hits.push({
          pageId: p.id,
          blockId: null,
          title: p.title || "بدون عنوان",
          snippet: p.tags.join(" · ") || "عنوان صفحه",
          icon: p.icon,
        });
      }
      const blob = pageBody(p) || p.blocks.map((b) => b.content).join("\n");
      const lower = blob.toLowerCase();
      if (!lower.includes(query)) continue;
      const at = lower.indexOf(query);
      const snippet = blob.slice(Math.max(0, at - 18), at + query.length + 28).slice(0, 80);
      const key = `${p.id}:body`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({
        pageId: p.id,
        blockId: null,
        title: p.title || "بدون عنوان",
        snippet: snippet.trim(),
        icon: p.icon,
      });
    }
    return hits.slice(0, 30);
  }, [pages, q]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg/70 px-3 pt-[10vh] backdrop-blur-[2px]"
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
            placeholder="جستجو؛ انتخاب نتیجه می‌پرد روی همان بلاک"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-subtle"
          />
        </div>
        <Command.List className="max-h-[min(24rem,60vh)] overflow-y-auto p-1.5">
          <Command.Empty className="px-3 py-6 text-center text-sm text-muted">
            نتیجه‌ای نیست
          </Command.Empty>
          {results.map((hit) => (
            <Command.Item
              key={`${hit.pageId}:${hit.blockId ?? "page"}`}
              value={`${hit.title} ${hit.snippet} ${hit.pageId} ${hit.blockId ?? ""}`}
              onSelect={() => {
                setCurrent(hit.pageId, hit.blockId);
                onOpenChange(false);
              }}
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm",
                "data-[selected=true]:bg-surface-2",
              )}
            >
              <PageGlyph name={hit.icon} className="mt-0.5 text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{hit.title}</span>
                <span className="block truncate text-[11px] text-subtle">{hit.snippet}</span>
              </span>
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
