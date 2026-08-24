import {
  ChevronDown,
  ChevronLeft,
  Copy,
  Heart,
  History,
  LayoutTemplate,
  LogOut,
  Plus,
  RotateCcw,
  Search,
  Share,
  Star,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { PageGlyph } from "@/components/page-icon";
import { Button } from "@/components/ui/button";
import { allTags, getChildren, trashDaysLeft, useNotes } from "@/lib/notes/store";
import { PAGE_TEMPLATES } from "@/lib/notes/templates";
import type { Page } from "@/lib/notes/types";
import { cn } from "@/lib/utils";

const PAGE_MIME = "application/x-daftar-page";

function writePageDrag(e: DragEvent, id: string) {
  e.dataTransfer.setData(PAGE_MIME, id);
  e.dataTransfer.setData("text/plain", `daftar-page:${id}`);
  e.dataTransfer.effectAllowed = "move";
}

function hasPageDrag(e: DragEvent): boolean {
  const types = Array.from(e.dataTransfer.types);
  return types.includes(PAGE_MIME) || types.includes("text/plain");
}

function readPageDrag(e: DragEvent): string | null {
  const custom = e.dataTransfer.getData(PAGE_MIME);
  if (custom) return custom;
  const raw = e.dataTransfer.getData("text/plain");
  if (raw.startsWith("daftar-page:")) return raw.slice("daftar-page:".length);
  return null;
}

function PageRow({
  page,
  depth,
  compact,
  onNavigate,
}: {
  page: Page;
  depth: number;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const pages = useNotes((s) => s.pages);
  const currentId = useNotes((s) => s.currentId);
  const expanded = useNotes((s) => s.expanded);
  const setCurrent = useNotes((s) => s.setCurrent);
  const toggleExpanded = useNotes((s) => s.toggleExpanded);
  const createPage = useNotes((s) => s.createPage);
  const deletePage = useNotes((s) => s.deletePage);
  const duplicatePage = useNotes((s) => s.duplicatePage);
  const toggleStar = useNotes((s) => s.toggleStar);
  const movePage = useNotes((s) => s.movePage);
  const kids = getChildren(pages, page.id);
  const open = expanded[page.id] ?? false;
  const active = currentId === page.id;
  const [over, setOver] = useState<"before" | "after" | "inside" | null>(null);
  const [dragging, setDragging] = useState(false);

  function onDragStart(e: DragEvent) {
    e.stopPropagation();
    writePageDrag(e, page.id);
    setDragging(true);
  }

  function zoneFor(e: DragEvent): "before" | "after" | "inside" {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (y < 7) return "before";
    if (y > rect.height - 7) return "after";
    return "inside";
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setOver(zoneFor(e));
  }

  function onDragLeave(e: DragEvent) {
    const next = e.relatedTarget as Node | null;
    if (next && (e.currentTarget as HTMLElement).contains(next)) return;
    setOver(null);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const id = readPageDrag(e);
    setOver(null);
    if (!id || id === page.id) return;
    movePage(id, page.id, zoneFor(e));
  }

  const actions = cn(
    "flex size-6 items-center justify-center rounded",
    compact ? "opacity-100" : "opacity-0 group-hover:opacity-100",
  );

  return (
    <div>
      <div
        draggable={!compact}
        data-page-id={page.id}
        title={compact ? undefined : "بکش و روی صفحهٔ دیگر رها کن تا زیرمجموعه‌اش شود"}
        onDragStart={onDragStart}
        onDragEnd={() => {
          setDragging(false);
          setOver(null);
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "group relative flex items-center rounded-md pe-0.5 text-[13px] transition-colors",
          !compact && "cursor-grab active:cursor-grabbing",
          compact ? "h-9" : "h-8",
          active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2/70 hover:text-fg",
          dragging && "opacity-40",
          over === "inside" && "bg-accent/15 ring-1 ring-accent/60",
          over && "[&_button]:pointer-events-none",
        )}
        style={{ paddingInlineStart: 6 + depth * (compact ? 8 : 12) }}
      >
        {over === "before" ? (
          <span className="pointer-events-none absolute inset-x-2 top-0 h-0.5 rounded-full bg-accent" />
        ) : null}
        {over === "after" ? (
          <span className="pointer-events-none absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />
        ) : null}
        {over === "inside" ? (
          <span className="pointer-events-none absolute inset-y-0 start-0 w-0.5 rounded-full bg-accent" />
        ) : null}
        {kids.length > 0 ? (
          <button
            type="button"
            className="flex size-6 shrink-0 items-center justify-center rounded text-subtle"
            onClick={() => toggleExpanded(page.id)}
            aria-label={open ? "بستن" : "باز کردن"}
          >
            {open ? <ChevronDown className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
          </button>
        ) : (
          <span className="size-6 shrink-0" />
        )}
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-start"
          onClick={() => {
            setCurrent(page.id);
            onNavigate?.();
          }}
        >
          <PageGlyph name={page.icon} className="size-3.5 opacity-80" />
          <span className="truncate">{page.title || "بدون عنوان"}</span>
        </button>
        <button
          type="button"
          className={cn(
            "flex size-6 items-center justify-center rounded",
            page.starred ? "text-warn opacity-100" : cn(actions, "hover:text-warn"),
          )}
          title={page.starred ? "حذف از محبوب‌ها" : "محبوب"}
          onClick={() => toggleStar(page.id)}
        >
          <Star className="size-3.5" fill={page.starred ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          className={cn(actions, "hover:bg-bg")}
          title="کپی صفحه"
          onClick={() => duplicatePage(page.id)}
        >
          <Copy className="size-3.5" />
        </button>
        <button
          type="button"
          className={cn(actions, "hover:bg-bg")}
          title="زیرصفحه"
          onClick={() => createPage({ parentId: page.id })}
        >
          <Plus className="size-3.5" />
        </button>
        <button
          type="button"
          className={cn(actions, "hover:bg-bg hover:text-danger")}
          title="حذف"
          onClick={() => {
            if (confirm(`«${page.title || "بدون عنوان"}» به سطل زباله برود؟ تا ۷ روز قابل برگشت است.`)) {
              deletePage(page.id);
            }
          }}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {open
        ? kids.map((c) => (
            <PageRow key={c.id} page={c} depth={depth + 1} compact={compact} onNavigate={onNavigate} />
          ))
        : null}
    </div>
  );
}

function InstallHint() {
  const [deferred, setDeferred] = useState<{ prompt: () => Promise<void> } | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const standalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as { standalone?: boolean }).standalone)));
  const ios = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const onPip = (e: Event) => {
      e.preventDefault();
      const ev = e as Event & { prompt: () => Promise<void> };
      setDeferred(ev);
    };
    window.addEventListener("beforeinstallprompt", onPip);
    return () => window.removeEventListener("beforeinstallprompt", onPip);
  }, []);

  if (standalone) return null;
  if (!deferred && !ios) return null;

  return (
    <div className="px-2 pb-1">
      <button
        type="button"
        className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[12px] text-muted hover:bg-surface-2 hover:text-fg"
        onClick={() => {
          if (deferred) void deferred.prompt();
          else setIosHint((v) => !v);
        }}
      >
        <Share className="size-3.5" />
        افزودن به صفحهٔ اصلی
      </button>
      {iosHint ? (
        <p className="px-2 pb-1 text-[11px] leading-5 text-subtle">
          در Safari دکمه Share را بزن، بعد Add to Home Screen.
        </p>
      ) : null}
    </div>
  );
}

export function Sidebar({
  onOpenSearch,
  onClose,
  userName,
  onLogout,
  onOpenPayloads,
  compact,
  heart,
}: {
  onOpenSearch: () => void;
  onClose?: () => void;
  userName?: string;
  onLogout?: () => void;
  onOpenPayloads?: () => void;
  compact?: boolean;
  heart?: boolean;
}) {
  const pages = useNotes((s) => s.pages);
  const order = useNotes((s) => s.order);
  const trash = useNotes((s) => s.trash);
  const recentIds = useNotes((s) => s.recentIds);
  const filterTag = useNotes((s) => s.filterTag);
  const setFilterTag = useNotes((s) => s.setFilterTag);
  const createPage = useNotes((s) => s.createPage);
  const createFromTemplate = useNotes((s) => s.createFromTemplate);
  const restorePage = useNotes((s) => s.restorePage);
  const dropForever = useNotes((s) => s.dropForever);
  const setCurrent = useNotes((s) => s.setCurrent);
  const addTag = useNotes((s) => s.addTag);
  const movePage = useNotes((s) => s.movePage);
  const [tagQ, setTagQ] = useState("");
  const [tplOpen, setTplOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);

  const roots = useMemo(() => {
    const list = order.map((id) => pages[id]).filter(Boolean) as Page[];
    if (!filterTag) return list;
    const match = (p: Page): boolean =>
      p.tags.includes(filterTag) || getChildren(pages, p.id).some(match);
    return list.filter(match);
  }, [order, pages, filterTag]);

  const starred = useMemo(
    () => Object.values(pages).filter((p) => p.starred),
    [pages],
  );

  const recents = useMemo(
    () => (recentIds ?? []).map((id) => pages[id]).filter(Boolean) as Page[],
    [recentIds, pages],
  );

  const trashList = useMemo(
    () =>
      Object.values(trash ?? {}).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)),
    [trash],
  );

  const tags = allTags(pages).filter((t) =>
    tagQ.trim() ? t.tag.toLowerCase().includes(tagQ.trim().toLowerCase()) : true,
  );

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-surface">
      <div className={cn("flex items-center justify-between gap-2 px-3", compact ? "pt-3 pb-1" : "pt-4 pb-2")}>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold tracking-tight">Daftar</div>
          <div className="flex items-center gap-1.5">
            <div className="truncate text-[11px] text-muted">{userName ?? "جزوه پنتست وب"}</div>
            {heart ? (
              <Heart className="hadis-heart size-3.5 shrink-0" fill="currentColor" aria-hidden />
            ) : null}
          </div>
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
          <kbd className="ms-auto hidden rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-subtle sm:inline">
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
                    onClose?.();
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
        {starred.length > 0 ? (
          <div className="mb-3">
            <div className="mb-1 px-1 text-[11px] font-medium text-subtle">محبوب‌ها</div>
            {starred.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setCurrent(p.id);
                  onClose?.();
                }}
                className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[13px] text-muted hover:bg-surface-2 hover:text-fg"
              >
                <Star className="size-3.5 shrink-0 text-warn" fill="currentColor" />
                <PageGlyph name={p.icon} className="size-3.5 opacity-80" />
                <span className="truncate">{p.title || "بدون عنوان"}</span>
              </button>
            ))}
          </div>
        ) : null}

        {recents.length > 0 ? (
          <div className="mb-3">
            <div className="mb-1 px-1 text-[11px] font-medium text-subtle">اخیر</div>
            {recents.map((p) => (
              <button
                key={`r-${p.id}`}
                type="button"
                onClick={() => {
                  setCurrent(p.id);
                  onClose?.();
                }}
                className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[13px] text-muted hover:bg-surface-2 hover:text-fg"
              >
                <History className="size-3.5 shrink-0" />
                <PageGlyph name={p.icon} className="size-3.5 opacity-80" />
                <span className="truncate">{p.title || "بدون عنوان"}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div
          className="mb-1 flex items-center justify-between rounded-md px-1"
          onDragOver={(e) => {
            if (!hasPageDrag(e)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            e.currentTarget.classList.add("bg-accent/15");
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove("bg-accent/15");
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("bg-accent/15");
            const id = readPageDrag(e);
            if (id) movePage(id, null, "root");
          }}
        >
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
          <PageRow key={p.id} page={p} depth={0} compact={compact} onNavigate={onClose} />
        ))}

        <div className="mt-5 px-1 text-[11px] font-medium text-subtle">تگ‌ها</div>
        <input
          value={tagQ}
          onChange={(e) => setTagQ(e.target.value)}
          placeholder="فیلتر تگ · صفحه را روی تگ رها کن"
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
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const id = readPageDrag(e);
                  if (id) addTag(id, tag);
                }}
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

        <div className="mt-5">
          <button
            type="button"
            className="flex h-8 w-full items-center gap-2 rounded-md px-1 text-[11px] font-medium text-subtle hover:text-fg"
            onClick={() => setTrashOpen((v) => !v)}
          >
            <Trash2 className="size-3.5" />
            سطل زباله
            {trashList.length ? <span className="opacity-70">{trashList.length}</span> : null}
          </button>
          {trashOpen ? (
            trashList.length === 0 ? (
              <div className="px-2 py-2 text-[12px] text-subtle">خالی است. صفحات تا ۷ روز اینجا می‌مانند.</div>
            ) : (
              <div className="space-y-0.5">
                {trashList.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-1 rounded-md px-1 py-1 text-[12px] text-muted"
                  >
                    <PageGlyph name={p.icon} className="size-3.5 opacity-70" />
                    <span className="min-w-0 flex-1 truncate">{p.title || "بدون عنوان"}</span>
                    <span className="text-[10px] text-subtle">{trashDaysLeft(p.deletedAt ?? 0)}ر</span>
                    <button
                      type="button"
                      className="flex size-6 items-center justify-center rounded hover:bg-surface-2 hover:text-fg"
                      title="برگرداندن"
                      onClick={() => restorePage(p.id)}
                    >
                      <RotateCcw className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      className="flex size-6 items-center justify-center rounded hover:bg-surface-2 hover:text-danger"
                      title="حذف دائمی"
                      onClick={() => {
                        if (confirm("برای همیشه حذف شود؟")) dropForever(p.id);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : null}
        </div>
      </div>
      <InstallHint />
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
