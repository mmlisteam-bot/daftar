import { Star } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { DocView } from "@/components/doc-view";
import { PageGlyph, PAGE_ICON_KEYS } from "@/components/page-icon";
import { todoStats } from "@/lib/notes/cards";
import { compressImageFile, saveImageBlob } from "@/lib/notes/images";
import { guessDocDir, pageBody, blockToMarkdown } from "@/lib/notes/markdown";
import { htmlToBlocks, looksLikeMarkdown } from "@/lib/notes/parse";
import { breadcrumbs, getChildren, useNotes } from "@/lib/notes/store";
import { nid, type Page } from "@/lib/notes/types";
import { cn } from "@/lib/utils";

function htmlClipboardToMarkdown(html: string): string | null {
  const blocks = htmlToBlocks(html);
  if (!blocks.length) return null;
  return blocks.map(blockToMarkdown).filter(Boolean).join("\n\n");
}

function PageToc({ page }: { page: Page }) {
  const heads = page.blocks.filter(
    (b) => (b.type === "h1" || b.type === "h2" || b.type === "h3") && b.content.trim(),
  );
  if (heads.length < 3) return null;
  return (
    <nav className="no-print mb-6 rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="mb-1.5 text-[13px] font-medium text-subtle">فهرست مطالب</div>
      <div className="flex flex-col gap-0.5">
        {heads.map((h) => (
          <button
            key={h.id}
            type="button"
            className={cn(
              "truncate text-start text-[15px] text-muted hover:text-fg",
              h.type === "h2" && "ps-3",
              h.type === "h3" && "ps-6 text-[12px]",
            )}
            onClick={() =>
              document.querySelector(`[data-block="${h.id}"]`)?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            }
          >
            {h.content}
          </button>
        ))}
      </div>
    </nav>
  );
}

function LabProgress({ page }: { page: Page }) {
  const pages = useNotes((s) => s.pages);
  const { done, total } = todoStats(page, pages);
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="no-print mb-5">
      <div className="mb-1 flex justify-between text-[13px] text-muted">
        <span>پیشرفت لاب</span>
        <span>
          {done} از {total} · {pct}٪
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-ok transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ChildCards({ page }: { page: Page }) {
  const pages = useNotes((s) => s.pages);
  const setCurrent = useNotes((s) => s.setCurrent);
  const kids = getChildren(pages, page.id);
  if (!kids.length) return null;
  return (
    <div className="mb-8 grid gap-2 sm:grid-cols-2">
      {kids.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => setCurrent(c.id)}
          className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3 text-start transition-colors hover:bg-surface-2"
        >
          <PageGlyph name={c.icon} className="mt-0.5 text-muted" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{c.title}</div>
            <div className="mt-0.5 truncate text-[12px] text-muted">
              {c.tags.join(" · ") || "زیرصفحه"}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function insertAtCursor(el: HTMLTextAreaElement, snippet: string) {
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const next = el.value.slice(0, start) + snippet + el.value.slice(end);
  const caret = start + snippet.length;
  return { next, caret };
}

function DocWriter({ page }: { page: Page }) {
  const updateBody = useNotes((s) => s.updateBody);
  const updatePage = useNotes((s) => s.updatePage);
  const importMarkdown = useNotes((s) => s.importMarkdown);
  const body = pageBody(page);
  const empty = !body.trim();
  const [editing, setEditing] = useState(empty);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditing(!pageBody(page).trim());
  }, [page.id]);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      const el = ref.current;
      if (el && !pageBody(page).trim()) return;
    }
  }, [editing, page.id]);

  useEffect(() => {
    if (!editing) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setEditing(false);
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [editing]);

  const dir = guessDocDir(`${page.title}\n${body}`);

  async function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    const file = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"))?.getAsFile();
    if (file) {
      e.preventDefault();
      const blob = await compressImageFile(file);
      const id = nid();
      await saveImageBlob(id, blob);
      const { next, caret } = insertAtCursor(el, `![screenshot](attachment:${id})`);
      updateBody(page.id, next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = caret;
      });
      return;
    }
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    if (text && looksLikeMarkdown(text) && text.includes("\n")) {
      e.preventDefault();
      const { next } = insertAtCursor(el, text.replace(/\r\n/g, "\n"));
      updateBody(page.id, next);
      if (/^(صفحه جدید|بدون عنوان)?$/.test(page.title.trim())) {
        const m = text.trim().match(/^\*\*(.+?)\*\*/) || text.trim().match(/^#\s+(.+)/);
        if (m?.[1]) updatePage(page.id, { title: m[1].trim() });
      }
      setEditing(false);
      return;
    }
    if (!text.trim() && html) {
      const md = htmlClipboardToMarkdown(html);
      if (md) {
        e.preventDefault();
        const { next } = insertAtCursor(el, md);
        updateBody(page.id, next);
        setEditing(false);
      }
    }
  }

  function onKey(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const el = e.currentTarget;
    const { next, caret } = insertAtCursor(el, e.shiftKey ? "" : "  ");
    if (e.shiftKey) {
      const start = el.selectionStart;
      const lineStart = el.value.lastIndexOf("\n", start - 1) + 1;
      if (el.value.slice(lineStart, lineStart + 2) === "  ") {
        const v = el.value.slice(0, lineStart) + el.value.slice(lineStart + 2);
        updateBody(page.id, v);
        requestAnimationFrame(() => {
          el.selectionStart = el.selectionEnd = Math.max(lineStart, start - 2);
        });
      }
      return;
    }
    updateBody(page.id, next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = caret;
    });
  }

  if (!editing) {
    return (
      <div
        className="note-doc note-doc-read min-h-[40vh] cursor-text"
        dir={dir}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a, button, input, summary, label")) return;
          setEditing(true);
        }}
      >
        <DocView page={page} />
        <p className="no-print mt-8 text-[12px] text-subtle">کلیک کن تا بنویسی · Esc پیش‌نمایش</p>
      </div>
    );
  }

  return (
    <div className="note-doc">
      <textarea
        ref={ref}
        dir={dir}
        value={body}
        rows={12}
        placeholder={"بنویس یا از ابسیدین پیست کن…\n\n# عنوان\n- لیست\n  - تو‌در‌تو\n**بولد**  `کد`  ```sql"}
        className="doc-edit w-full resize-none border-0 bg-transparent p-0 text-[16px] leading-[1.8] outline-none placeholder:text-subtle"
        onChange={(e) => updateBody(page.id, e.target.value.replace(/\u00a0/g, " "))}
        onPaste={(e) => void onPaste(e)}
        onKeyDown={onKey}
        onDrop={(e: DragEvent<HTMLTextAreaElement>) => {
          const file = e.dataTransfer.files[0];
          if (!file) return;
          if (/\.(md|markdown|txt)$/i.test(file.name)) {
            e.preventDefault();
            void file.text().then((md) => importMarkdown(page.id, md));
          }
        }}
      />
      <div className="no-print mt-3 flex items-center justify-between gap-3 text-[12px] text-subtle">
        <span>Tab تورفتگی لیست · پیست از ابسیدین همان‌طور می‌ماند</span>
        <button type="button" className="rounded-md px-2 py-1 hover:bg-surface-2 hover:text-fg" onClick={() => setEditing(false)}>
          پیش‌نمایش
        </button>
      </div>
    </div>
  );
}

export function Editor() {
  const pages = useNotes((s) => s.pages);
  const currentId = useNotes((s) => s.currentId);
  const updatePage = useNotes((s) => s.updatePage);
  const addTag = useNotes((s) => s.addTag);
  const removeTag = useNotes((s) => s.removeTag);
  const importMarkdown = useNotes((s) => s.importMarkdown);
  const updateBody = useNotes((s) => s.updateBody);
  const setCurrent = useNotes((s) => s.setCurrent);
  const toggleStar = useNotes((s) => s.toggleStar);
  const scrollToBlock = useNotes((s) => s.scrollToBlock);
  const page = pages[currentId];
  const [tagInput, setTagInput] = useState("");
  const [iconOpen, setIconOpen] = useState(false);

  useEffect(() => {
    if (!scrollToBlock) return;
    const id = scrollToBlock;
    const t = window.setTimeout(() => {
      const el = document.querySelector(`[data-block="${id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("block-flash");
        window.setTimeout(() => el.classList.remove("block-flash"), 1400);
      }
      useNotes.setState({ scrollToBlock: null });
    }, 40);
    return () => window.clearTimeout(t);
  }, [scrollToBlock, currentId]);

  if (!page) {
    return <div className="p-10 text-muted">صفحه‌ای انتخاب نشده.</div>;
  }

  const crumbs = breadcrumbs(pages, page.id);

  function onDropMd(e: DragEvent) {
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.type.startsWith("image/")) {
      e.preventDefault();
      void (async () => {
        const blob = await compressImageFile(file);
        const id = nid();
        await saveImageBlob(id, blob);
        updateBody(page.id, `${pageBody(page).replace(/\s+$/, "")}\n\n![screenshot](attachment:${id})\n`);
      })();
      return;
    }
    if (!/\.(md|markdown|txt)$/i.test(file.name)) return;
    e.preventDefault();
    void file.text().then((md) => importMarkdown(page.id, md));
  }

  return (
    <article
      className="print-wide mx-auto w-full max-w-3xl px-4 pt-8 pb-28 sm:px-8"
      onDragOver={(e) => {
        if ([...e.dataTransfer.items].some((i) => i.kind === "file")) e.preventDefault();
      }}
      onDrop={onDropMd}
    >
      <div className="no-print mb-4 flex flex-wrap items-center gap-1 text-[14px] text-muted">
        {crumbs.map((c, i) => (
          <span key={c.id} className="flex items-center gap-1">
            {i > 0 ? <span className="text-subtle">/</span> : null}
            <button type="button" className="hover:text-fg" onClick={() => setCurrent(c.id)}>
              {c.title}
            </button>
          </span>
        ))}
      </div>

      <div className="relative mb-2">
        <button
          type="button"
          className="mb-3 flex size-11 items-center justify-center rounded-md bg-surface-2 text-fg"
          onClick={() => setIconOpen((v) => !v)}
          aria-label="آیکون صفحه"
        >
          <PageGlyph name={page.icon} className="size-5" />
        </button>
        {iconOpen ? (
          <div className="absolute z-10 grid grid-cols-5 gap-1 rounded-lg border border-border bg-surface p-2 shadow-lg">
            {PAGE_ICON_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                className="flex size-8 items-center justify-center rounded-md hover:bg-surface-2"
                onClick={() => {
                  updatePage(page.id, { icon: k });
                  setIconOpen(false);
                }}
              >
                <PageGlyph name={k} />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mb-3 flex items-start gap-2">
        <input
          dir="auto"
          value={page.title}
          onChange={(e) => updatePage(page.id, { title: e.target.value })}
          className="min-w-0 flex-1 bg-transparent text-[34px] font-semibold leading-tight tracking-tight outline-none placeholder:text-subtle [unicode-bidi:plaintext]"
          placeholder="عنوان صفحه"
        />
        <button
          type="button"
          className={cn(
            "no-print mt-2 flex size-9 shrink-0 items-center justify-center rounded-md hover:bg-surface-2",
            page.starred ? "text-warn" : "text-subtle",
          )}
          title={page.starred ? "حذف از محبوب‌ها" : "محبوب"}
          onClick={() => toggleStar(page.id)}
        >
          <Star className="size-4" fill={page.starred ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="no-print mb-6 flex flex-wrap items-center gap-1.5">
        {page.tags.map((t) => (
          <button
            key={t}
            type="button"
            className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] text-muted hover:text-fg"
            onClick={() => removeTag(page.id, t)}
            title="حذف تگ"
          >
            {t}
          </button>
        ))}
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(page.id, tagInput);
              setTagInput("");
            }
          }}
          placeholder="تگ + Enter"
          className="h-7 w-28 bg-transparent text-[12px] outline-none placeholder:text-subtle"
        />
      </div>

      <LabProgress page={page} />
      <PageToc page={page} />
      <ChildCards page={page} />
      <DocWriter page={page} />
    </article>
  );
}
