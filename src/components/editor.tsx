import {
  ChevronDown,
  GripVertical,
  ImagePlus,
  Plus,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { PageGlyph, PAGE_ICON_KEYS } from "@/components/page-icon";
import { Button } from "@/components/ui/button";
import { compressImageFile, deleteImageBlob, getImageBlob, saveImageBlob } from "@/lib/notes/images";
import { breadcrumbs, getChildren, useNotes } from "@/lib/notes/store";
import {
  emptyBlock,
  nid,
  type Block,
  type BlockType,
  type CalloutKind,
  type Page,
} from "@/lib/notes/types";
import { cn } from "@/lib/utils";

const SLASH: { type: BlockType; label: string; hint: string; callout?: CalloutKind }[] = [
  { type: "p", label: "متن", hint: "پاراگراف" },
  { type: "h1", label: "تیتر ۱", hint: "#" },
  { type: "h2", label: "تیتر ۲", hint: "##" },
  { type: "h3", label: "تیتر ۳", hint: "###" },
  { type: "ul", label: "لیست", hint: "-" },
  { type: "ol", label: "لیست شماره‌دار", hint: "1." },
  { type: "todo", label: "تودو", hint: "[]" },
  { type: "code", label: "کد", hint: "```" },
  { type: "quote", label: "نقل‌قول", hint: ">" },
  { type: "callout", label: "نکته", hint: "info", callout: "info" },
  { type: "callout", label: "هشدار", hint: "warning", callout: "warning" },
  { type: "callout", label: "تیپ", hint: "tip", callout: "tip" },
  { type: "image", label: "تصویر / اسکرین‌شات", hint: "img" },
  { type: "table", label: "جدول", hint: "table" },
  { type: "toggle", label: "تاگل", hint: "toggle" },
  { type: "divider", label: "خط جداکننده", hint: "---" },
];

function applyMarkdownShortcut(text: string): Partial<Block> | null {
  if (text === "# " || text === "#") return { type: "h1", content: "" };
  if (text === "## " || text === "##") return { type: "h2", content: "" };
  if (text === "### " || text === "###") return { type: "h3", content: "" };
  if (text === "- " || text === "* ") return { type: "ul", content: "" };
  if (text === "1. ") return { type: "ol", content: "" };
  if (text === "[] " || text === "[ ] ") return { type: "todo", content: "", checked: false };
  if (text === "> ") return { type: "quote", content: "" };
  if (text === "```") return { type: "code", content: "", lang: "text" };
  if (text === "---") return { type: "divider", content: "" };
  return null;
}

function Editable({
  value,
  placeholder,
  className,
  dir,
  onChange,
  onKeyDown,
  onPaste,
}: {
  value: string;
  placeholder?: string;
  className?: string;
  dir?: "rtl" | "ltr";
  onChange: (v: string) => void;
  onKeyDown?: (e: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: ClipboardEvent<HTMLTextAreaElement>) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      dir={dir}
      placeholder={placeholder}
      className={cn(
        "block-edit w-full resize-none border-0 bg-transparent p-0 leading-inherit outline-none",
        className,
      )}
      onChange={(e) => onChange(e.target.value.replace(/\u00a0/g, " "))}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
    />
  );
}

function ImageBlock({
  block,
  onUploaded,
}: {
  block: Block;
  onUploaded: (imageId: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let revoke: string | null = null;
    if (!block.imageId) {
      setUrl(null);
      return;
    }
    getImageBlob(block.imageId).then((blob) => {
      if (!blob) return;
      revoke = URL.createObjectURL(blob);
      setUrl(revoke);
    });
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [block.imageId]);

  async function handleFile(file: File) {
    const blob = await compressImageFile(file);
    const id = nid();
    await saveImageBlob(id, blob);
    if (block.imageId) await deleteImageBlob(block.imageId).catch(() => {});
    onUploaded(id);
  }

  return (
    <div
      className="overflow-hidden rounded-md border border-dashed border-border bg-surface-2/40"
      onDragOver={(e: DragEvent) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file?.type.startsWith("image/")) void handleFile(file);
      }}
    >
      {url ? (
        <img src={url} alt="" className="max-h-[480px] w-full object-contain" />
      ) : (
        <button
          type="button"
          className="flex w-full flex-col items-center gap-2 px-4 py-10 text-sm text-muted"
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="size-6" />
          اسکرین‌شات را رها کنید یا کلیک کنید
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}

function BlockView({
  pageId,
  block,
  onFocusSlash,
}: {
  pageId: string;
  block: Block;
  onFocusSlash: (blockId: string, el: HTMLElement) => void;
}) {
  const insertBlock = useNotes((s) => s.insertBlock);
  const updateBlock = useNotes((s) => s.updateBlock);
  const replaceBlock = useNotes((s) => s.replaceBlock);
  const removeBlock = useNotes((s) => s.removeBlock);
  const moveBlock = useNotes((s) => s.moveBlock);

  function onText(content: string) {
    if (block.type === "p") {
      const sc = applyMarkdownShortcut(content);
      if (sc) {
        replaceBlock(pageId, block.id, { ...emptyBlock(sc.type ?? "p"), id: block.id, ...sc });
        return;
      }
    }
    if (content === "/") {
      updateBlock(pageId, block.id, { content });
      return;
    }
    updateBlock(pageId, block.id, { content });
  }

  function key(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "/" && block.content === "") {
      onFocusSlash(block.id, e.currentTarget);
    }
    if (e.key === "Enter" && !e.shiftKey && block.type !== "code" && block.type !== "toggle") {
      e.preventDefault();
      const cont = block.type === "ul" || block.type === "ol" || block.type === "todo";
      if (cont && block.content.trim() === "") {
        replaceBlock(pageId, block.id, { ...block, type: "p", content: "" });
        return;
      }
      insertBlock(pageId, block.id, cont ? block.type : "p");
    }
    if (e.key === "Backspace" && block.content === "") {
      e.preventDefault();
      removeBlock(pageId, block.id);
    }
    if (e.key === "ArrowUp" && e.altKey) {
      e.preventDefault();
      moveBlock(pageId, block.id, -1);
    }
    if (e.key === "ArrowDown" && e.altKey) {
      e.preventDefault();
      moveBlock(pageId, block.id, 1);
    }
  }

  async function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const file = [...e.clipboardData.items]
      .find((i) => i.type.startsWith("image/"))
      ?.getAsFile();
    if (file) {
      e.preventDefault();
      const blob = await compressImageFile(file);
      const id = nid();
      await saveImageBlob(id, blob);
      const next = emptyBlock("image");
      next.imageId = id;
      replaceBlock(pageId, block.id, { ...next, id: block.id });
    }
  }

  const ph =
    block.type === "h1"
      ? "تیتر"
      : block.type === "p"
        ? "بنویس یا / بزن"
        : " ";

  const shell = (child: ReactNode) => (
    <div className="group relative flex items-start gap-1">
      <div className="no-print mt-1 flex w-8 shrink-0 justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          className="flex size-6 items-center justify-center rounded text-subtle hover:bg-surface-2"
          onClick={() => insertBlock(pageId, block.id, "p")}
          title="بلاک جدید"
        >
          <Plus className="size-3.5" />
        </button>
        <button
          type="button"
          className="flex size-6 items-center justify-center rounded text-subtle hover:bg-surface-2"
          onClick={() => moveBlock(pageId, block.id, -1)}
          title="جابه‌جایی"
        >
          <GripVertical className="size-3.5" />
        </button>
      </div>
      <div className="min-w-0 flex-1 py-0.5">{child}</div>
      <button
        type="button"
        className="no-print mt-1 flex size-6 shrink-0 items-center justify-center rounded text-subtle opacity-0 hover:text-danger group-hover:opacity-100"
        onClick={() => removeBlock(pageId, block.id)}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );

  if (block.type === "divider") {
    return shell(<hr className="my-4 border-border" />);
  }

  if (block.type === "image") {
    return shell(
      <ImageBlock
        block={block}
        onUploaded={(imageId) => updateBlock(pageId, block.id, { imageId })}
      />,
    );
  }

  if (block.type === "code") {
    return shell(
      <div className="overflow-hidden rounded-md bg-surface-2" dir="ltr">
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-[11px] text-muted">
          <input
            value={block.lang ?? ""}
            onChange={(e) => updateBlock(pageId, block.id, { lang: e.target.value })}
            className="w-24 bg-transparent font-mono outline-none"
          />
        </div>
        <textarea
          value={block.content}
          onChange={(e) => updateBlock(pageId, block.id, { content: e.target.value })}
          onKeyDown={key}
          spellCheck={false}
          className="min-h-24 w-full resize-y bg-transparent p-3 font-mono text-[13px] leading-relaxed text-fg outline-none"
        />
      </div>,
    );
  }

  if (block.type === "table") {
    const headers = block.headers ?? ["", ""];
    const rows = block.rows ?? [["", ""]];
    const setCell = (r: number, c: number, v: string, header: boolean) => {
      if (header) {
        const next = [...headers];
        next[c] = v;
        updateBlock(pageId, block.id, { headers: next });
      } else {
        const next = rows.map((row) => [...row]);
        next[r]![c] = v;
        updateBlock(pageId, block.id, { rows: next });
      }
    };
    return shell(
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[320px] text-[13px]">
          <thead className="bg-surface-2">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="border-b border-border p-0 font-medium">
                  <input
                    value={h}
                    onChange={(e) => setCell(0, i, e.target.value, true)}
                    className="h-9 w-full bg-transparent px-2 outline-none"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {headers.map((_, c) => (
                  <td key={c} className="border-b border-border p-0">
                    <input
                      value={row[c] ?? ""}
                      onChange={(e) => setCell(r, c, e.target.value, false)}
                      className="h-9 w-full bg-transparent px-2 outline-none"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex gap-2 p-2 text-[11px]">
          <button
            type="button"
            className="text-muted hover:text-fg"
            onClick={() =>
              updateBlock(pageId, block.id, {
                rows: [...rows, headers.map(() => "")],
              })
            }
          >
            + ردیف
          </button>
          <button
            type="button"
            className="text-muted hover:text-fg"
            onClick={() =>
              updateBlock(pageId, block.id, {
                headers: [...headers, `ستون ${headers.length + 1}`],
                rows: rows.map((row) => [...row, ""]),
              })
            }
          >
            + ستون
          </button>
        </div>
      </div>,
    );
  }

  if (block.type === "toggle") {
    return shell(
      <div className="rounded-md border border-border bg-surface">
        <button
          type="button"
          className="flex w-full items-center gap-2 px-2 py-2 text-start"
          onClick={() => updateBlock(pageId, block.id, { open: !block.open })}
        >
          <ChevronDown
            className={cn("size-4 text-muted transition-transform", !block.open && "-rotate-90")}
          />
          <div
            className="flex-1"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Editable
              value={block.content}
              placeholder="عنوان تاگل"
              className="font-medium"
              onChange={(v) => updateBlock(pageId, block.id, { content: v })}
            />
          </div>
        </button>
        {block.open ? (
          <div className="border-t border-border px-3 py-2">
            <Editable
              value={block.inner ?? ""}
              placeholder="محتوای داخل تاگل"
              className="text-sm text-muted"
              onChange={(v) => updateBlock(pageId, block.id, { inner: v })}
            />
          </div>
        ) : null}
      </div>,
    );
  }

  const typeClass =
    block.type === "h1"
      ? "text-[32px] font-semibold leading-tight tracking-tight"
      : block.type === "h2"
        ? "text-[22px] font-semibold leading-snug"
        : block.type === "h3"
          ? "text-[17px] font-semibold"
          : block.type === "quote"
            ? "border-s-2 border-fg/30 ps-3 text-muted italic"
            : block.type === "callout"
              ? cn(
                  "rounded-md border px-3 py-2 text-sm",
                  block.callout === "warning"
                    ? "border-warn/40 bg-warn/8"
                    : block.callout === "tip"
                      ? "border-ok/40 bg-ok/8"
                      : "border-info/40 bg-info/8",
                )
              : "text-[15px] leading-7";

  const prefix =
    block.type === "ul" ? (
      <span className="mt-2 w-4 text-muted">•</span>
    ) : block.type === "ol" ? (
      <span className="mt-2 w-4 text-muted">1.</span>
    ) : block.type === "todo" ? (
      <input
        type="checkbox"
        checked={!!block.checked}
        onChange={(e) => updateBlock(pageId, block.id, { checked: e.target.checked })}
        className="mt-2 size-4 accent-accent"
      />
    ) : null;

  return shell(
    <div className={cn("flex gap-2", typeClass)}>
      {prefix}
      <Editable
        value={block.content}
        placeholder={ph}
        className={cn("flex-1", block.checked && "text-muted line-through")}
        onChange={onText}
        onKeyDown={key}
        onPaste={onPaste}
      />
    </div>,
  );
}

function SlashMenu({
  query,
  onPick,
  onClose,
}: {
  query: string;
  onPick: (item: (typeof SLASH)[number]) => void;
  onClose: () => void;
}) {
  const q = query.replace(/^\//, "").toLowerCase();
  const items = SLASH.filter(
    (i) => i.label.includes(q) || i.hint.includes(q) || i.type.includes(q),
  );
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);
  return (
    <div className="absolute z-20 mt-1 w-64 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
      {items.length === 0 ? (
        <div className="px-3 py-2 text-xs text-muted">چیزی پیدا نشد</div>
      ) : (
        items.map((item) => (
          <button
            key={`${item.type}-${item.label}`}
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-start text-[13px] hover:bg-surface-2"
            onClick={() => onPick(item)}
          >
            <span>{item.label}</span>
            <span className="font-mono text-[10px] text-subtle">{item.hint}</span>
          </button>
        ))
      )}
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

export function Editor() {
  const pages = useNotes((s) => s.pages);
  const currentId = useNotes((s) => s.currentId);
  const updatePage = useNotes((s) => s.updatePage);
  const addTag = useNotes((s) => s.addTag);
  const removeTag = useNotes((s) => s.removeTag);
  const insertBlock = useNotes((s) => s.insertBlock);
  const replaceBlock = useNotes((s) => s.replaceBlock);
  const setCurrent = useNotes((s) => s.setCurrent);
  const page = pages[currentId];
  const [tagInput, setTagInput] = useState("");
  const [slashFor, setSlashFor] = useState<string | null>(null);
  const [iconOpen, setIconOpen] = useState(false);

  if (!page) {
    return <div className="p-10 text-muted">صفحه‌ای انتخاب نشده.</div>;
  }

  const crumbs = breadcrumbs(pages, page.id);

  return (
    <article className="print-wide mx-auto w-full max-w-3xl px-4 pt-8 pb-28 sm:px-8">
      <div className="no-print mb-4 flex flex-wrap items-center gap-1 text-[12px] text-muted">
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

      <input
        value={page.title}
        onChange={(e) => updatePage(page.id, { title: e.target.value })}
        className="mb-3 w-full bg-transparent text-[34px] font-semibold leading-tight tracking-tight outline-none placeholder:text-subtle"
        placeholder="عنوان صفحه"
      />

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

      <ChildCards page={page} />

      <div className="relative space-y-0.5">
        {page.blocks.map((block) => (
          <div key={block.id} className="relative">
            <BlockView
              pageId={page.id}
              block={block}
              onFocusSlash={(id) => setSlashFor(id)}
            />
            {slashFor === block.id && block.content.startsWith("/") ? (
              <div className="ps-10">
                <SlashMenu
                  query={block.content}
                  onClose={() => setSlashFor(null)}
                  onPick={(item) => {
                    const next = emptyBlock(item.type);
                    if (item.callout) next.callout = item.callout;
                    replaceBlock(page.id, block.id, { ...next, id: block.id });
                    setSlashFor(null);
                  }}
                />
              </div>
            ) : null}
          </div>
        ))}
        <div className="no-print pt-4">
          <Button variant="ghost" size="sm" onClick={() => insertBlock(page.id, page.blocks.at(-1)?.id ?? null)}>
            <Plus className="size-3.5" />
            بلاک جدید
          </Button>
        </div>
      </div>
    </article>
  );
}
