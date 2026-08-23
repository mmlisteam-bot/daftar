import {
  ChevronDown,
  ChevronLeft,
  LayoutTemplate,
  LogOut,
  Plus,
  Search,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState, type DragEvent } from "react";
import { PageGlyph } from "@/components/page-icon";
import { Button } from "@/components/ui/button";
import { allTags, getChildren, useNotes } from "@/lib/notes/store";
import { PAGE_TEMPLATES } from "@/lib/notes/templates";
import type { Page } from "@/lib/notes/types";
import { cn } from "@/lib/utils";

function PageRow({
  page,
  depth,
}: {
  page: Page;
  depth: number;
}) {
  const pages = useNotes((s) => s.pages);
  const currentId = useNotes((s) => s.currentId);
  const expanded = useNotes((s) => s.expanded);
  const setCurrent = useNotes((s) => s.setCurrent);
  const toggleExpanded = useNotes((s) => s.toggleExpanded);
  const createPage = useNotes((s) => s.createPage);
  const deletePage = useNotes((s) => s.deletePage);
  const movePage = useNotes((s) => s.movePage);
  const kids = getChildren(pages, page.id);
  const open = expanded[page.id] ?? false;
  const active = currentId === page.id;
  const [over, setOver] = useState<"before" | "after" | "inside" | null>(null);

  function onDragStart(e: DragEvent) {
    e.dataTransfer.setData("text/plain", `daftar-page:${page.id}`);
    e.dataTransfer.effectAllowed = "move";
  }

  function zoneFor(e: DragEvent): "before" | "after" | "inside" {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (y < rect.height * 0.28) return "before";
    if (y > rect.height * 0.72) return "after";
    return "inside";
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    setOver(zoneFor(e));
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("text/plain");
    setOver(null);
    if (!raw.startsWith("daftar-page:")) return;
    const id = raw.slice("daftar-page:".length);
    if (!id || id === page.id) return;
    movePage(id, page.id, zoneFor(e));
  }

  return (
    <div>
      <div
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={() => setOver(null)}
        onDrop={onDrop}
        className={cn(
          "group relative flex h-8 items-center rounded-md pe-1 text-[13px] transition-colors",
          active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2/70 hover:text-fg",
          over === "inside" && "ring-1 ring-accent/50",
        )}
        style={{ paddingInlineStart: 8 + depth * 12 }}
      >
        {over === "before" ? (
          <span className="pointer-events-none absolute inset-x-2 top-0 h-px bg-accent" />
        ) : null}
        {over === "after" ? (
          <span className="pointer-events-none absolute inset-x-2 bottom-0 h-px bg-accent" />
        ) : null}
        {kids.length > 0 ? (
          <button
            type="button"
            className="flex size-6 items-center justify-center rounded text-subtle"
            onClick={() => toggleExpanded(page.id)}
            aria-label={open ? "بستن" : "باز کردن"}
          >
            {open ? <ChevronDown className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
          </button>
        ) : (
          <span className="size-6" />
        )}
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-start"
          onClick={() => setCurrent(page.id)}
        >
          <PageGlyph name={page.icon} className="size-3.5 opacity-80" />
          <span className="truncate">{page.title || "بدون عنوان"}</span>
        </button>
        <button
          type="button"
          className="flex size-6 items-center justify-center rounded opacity-0 hover:bg-bg group-hover:opacity-100"
          title="زیرصفحه"
          onClick={() => createPage({ parentId: page.id })}
        >
          <Plus className="size-3.5" />
        </button>
        <button
          type="button"
          className="flex size-6 items-center justify-center rounded opacity-0 hover:bg-bg hover:text-danger group-hover:opacity-100"
          title="حذف"
          onClick={() => {
            if (confirm(`«${page.title}» و زیرصفحه‌هایش حذف شوند؟`)) deletePage(page.id);
          }}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {open
        ? kids.map((c) => <PageRow key={c.id} page={c} depth={depth + 1} />)
        : null}
    </div>
  );
}

export function Sidebar({
  onOpenSearch,
  onClose,
  userName,
  onLogout,
  onOpenPayloads,
}: {
  onOpenSearch: () => void;
  onClose?: () => void;
  userName?: string;
  onLogout?: () => void;
  onOpenPayloads?: () => void;
}) {
  const pages = useNotes((s) => s.pages);
  const order = useNotes((s) => s.order);
  const filterTag = useNotes((s) => s.filterTag);
  const setFilterTag = useNotes((s) => s.setFilterTag);
  const createPage = useNotes((s) => s.createPage);
  const createFromTemplate = useNotes((s) => s.createFromTemplate);
  const [tagQ, setTagQ] = useState("");
  const [tplOpen, setTplOpen] = useState(false);

  const roots = useMemo(() => {
    const list = order.map((id) => pages[id]).filter(Boolean) as Page[];
    if (!filterTag) return list;
    const match = (p: Page): boolean =>
      p.tags.includes(filterTag) || getChildren(pages, p.id).some(match);
    return list.filter(match);
  }, [order, pages, filterTag]);

  const tags = allTags(pages).filter((t) =>
    tagQ.trim() ? t.tag.toLowerCase().includes(tagQ.trim().toLowerCase()) : true,
  );

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-surface">
      <div className="flex items-center justify-between gap-2 px-3 pt-4 pb-2">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold tracking-tight">Daftar</div>
          <div className="truncate text-[11px] text-muted">{userName ?? "جزوه پنتست وب"}</div>
        </div>
        {onClose ? (
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="بستن منو">
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex h-9 w-full items-center gap-2 rounded-md border border-border bg-bg px-2.5 text-start text-[13px] text-muted"
        >
          <Search className="size-3.5" />
          جستجو
          <kbd className="ms-auto rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-subtle">
            Ctrl K
          </kbd>
        </button>
        <div className="relative mt-1.5 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setTplOpen((v) => !v)}
            className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-surface-2 text-[12px] text-muted hover:text-fg"
          >
            <LayoutTemplate className="size-3.5" />
            قالب‌ها
          </button>
          <button
            type="button"
            onClick={onOpenPayloads}
            className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-surface-2 text-[12px] text-muted hover:text-fg"
          >
            <Terminal className="size-3.5" />
            Payload
          </button>
          {tplOpen ? (
            <div className="absolute start-0 top-9 z-20 w-[240px] overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
              {PAGE_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className="flex w-full items-start gap-2 px-3 py-2 text-start hover:bg-surface-2"
                  onClick={() => {
                    createFromTemplate(tpl);
                    setTplOpen(false);
                  }}
                >
                  <PageGlyph name={tpl.icon} className="mt-0.5 size-3.5 text-muted" />
                  <span>
                    <span className="block text-[13px]">{tpl.title}</span>
                    <span className="block text-[11px] text-subtle">{tpl.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="text-[11px] font-medium text-subtle">صفحات</span>
          <button
            type="button"
            className="flex size-6 items-center justify-center rounded-md text-muted hover:bg-surface-2"
            onClick={() => createPage()}
            title="صفحه جدید"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
        {roots.map((p) => (
          <PageRow key={p.id} page={p} depth={0} />
        ))}

        <div className="mt-5 px-1 text-[11px] font-medium text-subtle">تگ‌ها</div>
        <input
          value={tagQ}
          onChange={(e) => setTagQ(e.target.value)}
          placeholder="فیلتر تگ"
          className="mt-1 mb-1.5 h-8 w-full rounded-md border border-border bg-bg px-2 text-[12px] outline-none placeholder:text-subtle"
        />
        <div className="flex flex-wrap gap-1 px-0.5">
          {tags.map(({ tag, count }) => {
            const on = filterTag === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setFilterTag(on ? null : tag)}
                className={cn(
                  "rounded-full px-2 py-1 text-[11px] transition-colors",
                  on ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted hover:text-fg",
                )}
              >
                {tag}
                <span className="ms-1 opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
        {filterTag ? (
          <button
            type="button"
            className="mt-2 text-[11px] text-muted hover:text-fg"
            onClick={() => setFilterTag(null)}
          >
            پاک کردن فیلتر
          </button>
        ) : null}
      </div>
      {onLogout ? (
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={onLogout}
            className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-[13px] text-muted hover:bg-surface-2 hover:text-fg"
          >
            <LogOut className="size-3.5" />
            خروج
          </button>
        </div>
      ) : null}
    </aside>
  );
}
