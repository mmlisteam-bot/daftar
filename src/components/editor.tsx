import {
  ChevronDown,
  Code2,
  GripVertical,
  ImagePlus,
  Plus,
  Trash2,
  Type,
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
import { HighlightedCode } from "@/lib/notes/highlight";
import { headingAnchor, InlineMd } from "@/lib/notes/inline";
import { compressImageFile, deleteImageBlob, getImageBlob, saveImageBlob } from "@/lib/notes/images";
import { clipboardToBlocks, CODE_LANGS, normalizeLang } from "@/lib/notes/parse";
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
  { type: "callout", label: "خلاصه", hint: "abstract", callout: "abstract" },
  { type: "callout", label: "نکته", hint: "info", callout: "info" },
  { type: "callout", label: "هشدار", hint: "warning", callout: "warning" },
  { type: "callout", label: "تیپ", hint: "tip", callout: "tip" },
  { type: "image", label: "تصویر / اسکرین‌شات", hint: "img" },
  { type: "table", label: "جدول", hint: "table" },
  { type: "toggle", label: "تاگل", hint: "toggle" },
  { type: "divider", label: "خط جداکننده", hint: "---" },
];

const CALLOUT_LABEL: Record<CalloutKind, string> = {
  abstract: "خلاصه",
  info: "نکته",
  note: "یادداشت",
  tip: "تیپ",
  warning: "هشدار",
  danger: "خطر",
  example: "مثال",
};

function NewBlockChooser({
  onPick,
  onClose,
  placement = "handle",
}: {
  onPick: (type: "p" | "code") => void;
  onClose: () => void;
  placement?: "handle" | "below";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onEsc);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onEsc);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      className={cn(
        "absolute z-30 w-52 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg",
        placement === "below" ? "start-0 top-full mt-1" : "start-full top-0 ms-1",
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2.5 px-3 py-2 text-start hover:bg-surface-2"
        onClick={() => onPick("code")}
      >
        <Code2 className="size-4 shrink-0 text-muted" />
        <span>
          <span className="block text-[13px]">کد است</span>
          <span className="block text-[11px] text-subtle">بلاک کد با تگ زبان</span>
        </span>
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-2.5 px-3 py-2 text-start hover:bg-surface-2"
        onClick={() => onPick("p")}
      >
        <Type className="size-4 shrink-0 text-muted" />
        <span>
          <span className="block text-[13px]">متن خالی</span>
          <span className="block text-[11px] text-subtle">پاراگراف معمولی</span>
        </span>
      </button>
    </div>
  );
}

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

function jumpWiki(pageId: string, target: string) {
  const page = useNotes.getState().pages[pageId];
  if (!page) return;
  const needle = headingAnchor(target);
  const hit = page.blocks.find(
    (b) =>
      (b.type === "h1" || b.type === "h2" || b.type === "h3") &&
      headingAnchor(b.content).includes(needle),
  );
  if (!hit) return;
  document.querySelector(`[data-block="${hit.id}"]`)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

async function pasteInto(
  e: ClipboardEvent,
  pageId: string,
  block: Block,
  opts?: { allowStructured?: boolean },
) {
  const file = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"))?.getAsFile();
  if (file) {
    e.preventDefault();
    const blob = await compressImageFile(file);
    const id = nid();
    await saveImageBlob(id, blob);
    const next = emptyBlock("image");
    next.imageId = id;
    useNotes.getState().replaceBlock(pageId, block.id, { ...next, id: block.id });
    return;
  }
  if (opts?.allowStructured === false) return;
  const incoming = clipboardToBlocks(e.clipboardData);
  if (!incoming) return;
  e.preventDefault();
  const empty =
    !block.content.trim() && block.type !== "table" && block.type !== "image" && block.type !== "divider";
  const store = useNotes.getState();
  if (empty) store.replaceWithBlocks(pageId, block.id, incoming);
  else store.insertBlocks(pageId, block.id, incoming);
  const page = store.pages[pageId];
  if (
    page &&
    /^(صفحه جدید|بدون عنوان)$/.test(page.title) &&
    incoming[0]?.type === "h1" &&
    incoming[0].content.trim()
  ) {
    store.updatePage(pageId, { title: incoming[0].content.trim() });
  }
}

function RichText({
  value,
  placeholder,
  className,
  onChange,
  onKeyDown,
  onPaste,
  forceEdit,
}: {
  value: string;
  placeholder?: string;
  className?: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: ClipboardEvent<HTMLTextAreaElement>) => void;
  forceEdit?: boolean;
}) {
  const [editing, setEditing] = useState(value.trim() === "" || value.startsWith("/"));
  const ref = useRef<HTMLTextAreaElement>(null);
  const showEdit = forceEdit || editing || value.trim() === "" || value.startsWith("/");

  useEffect(() => {
    if (showEdit) ref.current?.focus();
  }, [showEdit]);

  if (showEdit) {
    return (
      <textarea
        ref={ref}
        value={value}
        rows={1}
        dir="auto"
        placeholder={placeholder}
        className={cn(
          "block-edit w-full resize-none border-0 bg-transparent p-0 leading-inherit outline-none",
          className,
        )}
        onChange={(e) => onChange(e.target.value.replace(/\u00a0/g, " "))}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => {
          if (value.trim() && !value.startsWith("/")) setEditing(false);
        }}
      />
    );
  }

  return (
    <div
      dir="auto"
      role="textbox"
      tabIndex={0}
      className={cn("block-read min-h-[1.7em] w-full cursor-text", className)}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditing(true);
        }
      }}
    >
      <InlineMd text={value} onWiki={(t) => {
        const pageId = useNotes.getState().currentId;
        jumpWiki(pageId, t);
      }} />
    </div>
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

function CodeBlockView({
  pageId,
  block,
}: {
  pageId: string;
  block: Block;
}) {
  const updateBlock = useNotes((s) => s.updateBlock);
  const [editing, setEditing] = useState(!block.content);
  const [langOpen, setLangOpen] = useState(false);
  const lang = normalizeLang(block.lang);
  const langs: string[] = (CODE_LANGS as readonly string[]).includes(lang)
    ? [...CODE_LANGS]
    : [lang, ...CODE_LANGS];

  return (
    <div className="code-block overflow-hidden rounded-md" dir="ltr">
      <div className="relative flex items-center justify-end px-3 pt-2">
        <button
          type="button"
          className="font-mono text-[11px] uppercase tracking-wide text-muted hover:text-fg"
          onClick={() => setLangOpen((v) => !v)}
        >
          {lang}
        </button>
        {langOpen ? (
          <div className="absolute end-2 top-7 z-20 max-h-52 w-36 overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg">
            {langs.map((l) => (
              <button
                key={l}
                type="button"
                className={cn(
                  "block w-full px-3 py-1.5 text-start font-mono text-[11px] hover:bg-surface-2",
                  l === lang && "text-fg",
                  l !== lang && "text-muted",
                )}
                onClick={() => {
                  updateBlock(pageId, block.id, { lang: l });
                  setLangOpen(false);
                }}
              >
                {l}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {editing ? (
        <textarea
          value={block.content}
          autoFocus
          spellCheck={false}
          onChange={(e) => updateBlock(pageId, block.id, { content: e.target.value })}
          onBlur={() => {
            if (block.content.trim()) setEditing(false);
          }}
          onPaste={(e) => void pasteInto(e, pageId, block, { allowStructured: false })}
          className="min-h-24 w-full resize-y bg-transparent px-3 pb-3 font-mono text-[13px] leading-relaxed text-fg outline-none"
        />
      ) : (
        <button type="button" className="block w-full text-start" onClick={() => setEditing(true)}>
          <HighlightedCode code={block.content} lang={lang} />
        </button>
      )}
    </div>
  );
}

function TableBlockView({
  pageId,
  block,
}: {
  pageId: string;
  block: Block;
}) {
  const updateBlock = useNotes((s) => s.updateBlock);
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
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="note-table w-full min-w-[280px] text-[13px]">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="border-b border-border bg-surface-2 p-0 font-medium">
                <input
                  dir="auto"
                  value={h}
                  onChange={(e) => setCell(0, i, e.target.value, true)}
                  className="h-10 w-full bg-transparent px-3 outline-none"
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
                    dir="auto"
                    value={row[c] ?? ""}
                    onChange={(e) => setCell(r, c, e.target.value, false)}
                    className="h-10 w-full bg-transparent px-3 outline-none"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="no-print flex flex-wrap gap-3 p-2 text-[11px] text-muted">
        <button
          type="button"
          className="hover:text-fg"
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
          className="hover:text-fg"
          onClick={() =>
            updateBlock(pageId, block.id, {
              headers: [...headers, `ستون ${headers.length + 1}`],
              rows: rows.map((row) => [...row, ""]),
            })
          }
        >
          + ستون
        </button>
        {rows.length > 1 ? (
          <button
            type="button"
            className="hover:text-danger"
            onClick={() => updateBlock(pageId, block.id, { rows: rows.slice(0, -1) })}
          >
            − ردیف
          </button>
        ) : null}
        {headers.length > 1 ? (
          <button
            type="button"
            className="hover:text-danger"
            onClick={() =>
              updateBlock(pageId, block.id, {
                headers: headers.slice(0, -1),
                rows: rows.map((row) => row.slice(0, -1)),
              })
            }
          >
            − ستون
          </button>
        ) : null}
      </div>
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
  const reorderBlocks = useNotes((s) => s.reorderBlocks);
  const [dropOver, setDropOver] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  function onText(content: string) {
    if (block.type === "p") {
      const sc = applyMarkdownShortcut(content);
      if (sc) {
        replaceBlock(pageId, block.id, { ...emptyBlock(sc.type ?? "p"), id: block.id, ...sc });
        return;
      }
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

  const ph =
    block.type === "h1" ? "تیتر" : block.type === "p" ? "بنویس، پیست کن یا / بزن" : " ";

  const shell = (child: ReactNode) => (
    <div
      className={cn(
        "group relative flex items-start gap-1 rounded-md",
        dropOver && "bg-surface-2/80 ring-1 ring-accent/40",
      )}
      data-block={block.id}
      onDragOver={(e: DragEvent) => {
        if (!e.dataTransfer.types.includes("text/plain") && !e.dataTransfer.types.includes("text")) return;
        e.preventDefault();
        e.stopPropagation();
        setDropOver(true);
      }}
      onDragLeave={() => setDropOver(false)}
      onDrop={(e: DragEvent) => {
        const raw = e.dataTransfer.getData("text/plain");
        if (!raw.startsWith("daftar-block:")) return;
        e.preventDefault();
        e.stopPropagation();
        setDropOver(false);
        reorderBlocks(pageId, raw.slice("daftar-block:".length), block.id);
      }}
    >
      <div
        className={cn(
          "no-print relative mt-1 flex w-8 shrink-0 justify-end gap-0.5 transition-opacity",
          addOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <button
          type="button"
          className="flex size-6 items-center justify-center rounded text-subtle hover:bg-surface-2"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setAddOpen((v) => !v)}
          title="بلاک جدید"
        >
          <Plus className="size-3.5" />
        </button>
        {addOpen ? (
          <NewBlockChooser
            onPick={(type) => {
              insertBlock(pageId, block.id, type);
              setAddOpen(false);
            }}
            onClose={() => setAddOpen(false)}
          />
        ) : null}
        <button
          type="button"
          draggable
          className="flex size-6 cursor-grab items-center justify-center rounded text-subtle hover:bg-surface-2 active:cursor-grabbing"
          onClick={() => moveBlock(pageId, block.id, -1)}
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", `daftar-block:${block.id}`);
            e.dataTransfer.effectAllowed = "move";
          }}
          title="بکش برای جابه‌جایی · کلیک: یکی بالا"
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
    return shell(<CodeBlockView pageId={pageId} block={block} />);
  }

  if (block.type === "table") {
    return shell(<TableBlockView pageId={pageId} block={block} />);
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
            <RichText
              value={block.content}
              placeholder="عنوان تاگل"
              className="font-medium"
              onChange={(v) => updateBlock(pageId, block.id, { content: v })}
            />
          </div>
        </button>
        {block.open ? (
          <div className="border-t border-border px-3 py-2">
            <RichText
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
                    : block.callout === "tip" || block.callout === "example"
                      ? "border-ok/40 bg-ok/8"
                      : block.callout === "danger"
                        ? "border-danger/40 bg-danger/8"
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

  const headingAttr =
    block.type === "h1" || block.type === "h2" || block.type === "h3"
      ? headingAnchor(block.content)
      : undefined;

  return shell(
    <div className={cn("flex gap-2", typeClass)} data-heading={headingAttr}>
      {prefix}
      <div className="min-w-0 flex-1">
        {block.type === "callout" && block.callout ? (
          <div className="mb-1 text-[11px] font-medium tracking-wide text-muted">
            {CALLOUT_LABEL[block.callout] ?? block.callout}
          </div>
        ) : null}
        <RichText
          value={block.content}
          placeholder={ph}
          className={cn("flex-1", block.checked && "text-muted line-through")}
          onChange={onText}
          onKeyDown={key}
          onPaste={(e) => void pasteInto(e, pageId, block)}
          forceEdit={block.content.startsWith("/")}
        />
      </div>
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
  const importMarkdown = useNotes((s) => s.importMarkdown);
  const setCurrent = useNotes((s) => s.setCurrent);
  const page = pages[currentId];
  const [tagInput, setTagInput] = useState("");
  const [slashFor, setSlashFor] = useState<string | null>(null);
  const [iconOpen, setIconOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  if (!page) {
    return <div className="p-10 text-muted">صفحه‌ای انتخاب نشده.</div>;
  }

  const crumbs = breadcrumbs(pages, page.id);

  function onDropMd(e: DragEvent) {
    const file = e.dataTransfer.files[0];
    if (!file) return;
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
        dir="auto"
        value={page.title}
        onChange={(e) => updatePage(page.id, { title: e.target.value })}
        className="mb-3 w-full bg-transparent text-[34px] font-semibold leading-tight tracking-tight outline-none placeholder:text-subtle [unicode-bidi:plaintext]"
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
        <div className="no-print relative pt-4">
          <Button
            variant="ghost"
            size="sm"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setAddOpen((v) => !v)}
          >
            <Plus className="size-3.5" />
            بلاک جدید
          </Button>
          {addOpen ? (
            <NewBlockChooser
              placement="below"
              onPick={(type) => {
                insertBlock(page.id, page.blocks.at(-1)?.id ?? null, type);
                setAddOpen(false);
              }}
              onClose={() => setAddOpen(false)}
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}
