import {
  Check,
  ChevronDown,
  Code2,
  Copy,
  GripVertical,
  Highlighter,
  ImagePlus,
  Plus,
  Star,
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
import { clipboardToBlocks, clipboardToGrid, CODE_LANGS, normalizeLang } from "@/lib/notes/parse";
import { breadcrumbs, getChildren, useNotes } from "@/lib/notes/store";
import { todoStats } from "@/lib/notes/cards";
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

const CONVERT: { type: BlockType; label: string }[] = [
  { type: "p", label: "متن" },
  { type: "h1", label: "تیتر ۱" },
  { type: "h2", label: "تیتر ۲" },
  { type: "h3", label: "تیتر ۳" },
  { type: "code", label: "کد" },
  { type: "ul", label: "لیست" },
  { type: "todo", label: "تودو" },
  { type: "quote", label: "نقل‌قول" },
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
  const store = useNotes.getState();
  const needle = headingAnchor(target);
  const byTitle = Object.values(store.pages).find((p) => {
    const t = headingAnchor(p.title);
    return t === needle || t.includes(needle) || needle.includes(t);
  });
  if (byTitle) {
    store.setCurrent(byTitle.id);
    return;
  }
  const page = store.pages[pageId];
  if (!page) return;
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
): Promise<boolean> {
  const file = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"))?.getAsFile();
  if (file) {
    e.preventDefault();
    const blob = await compressImageFile(file);
    const id = nid();
    await saveImageBlob(id, blob);
    const next = emptyBlock("image");
    next.imageId = id;
    useNotes.getState().replaceBlock(pageId, block.id, { ...next, id: block.id });
    return true;
  }
  if (opts?.allowStructured === false) return false;
  const incoming = clipboardToBlocks(e.clipboardData);
  if (!incoming) return false;
  e.preventDefault();
  applyIncoming(pageId, block, incoming);
  return true;
}

function applyIncoming(pageId: string, block: Block | null, incoming: Block[]) {
  if (!incoming.length) return;
  const store = useNotes.getState();
  const page = store.pages[pageId];
  if (!page) return;
  if (!block) {
    const last = page.blocks.at(-1);
    const empty =
      last &&
      !last.content.trim() &&
      last.type !== "table" &&
      last.type !== "image" &&
      last.type !== "divider";
    if (empty) store.replaceWithBlocks(pageId, last.id, incoming);
    else store.insertBlocks(pageId, last?.id ?? null, incoming);
  } else {
    const empty =
      !block.content.trim() && block.type !== "table" && block.type !== "image" && block.type !== "divider";
    if (empty) store.replaceWithBlocks(pageId, block.id, incoming);
    else store.insertBlocks(pageId, block.id, incoming);
  }
  const next = store.pages[pageId];
  if (next && /^(صفحه جدید|بدون عنوان)?$/.test(next.title.trim())) {
    const first = incoming[0];
    if (first?.type === "h1" && first.content.trim()) {
      store.updatePage(pageId, { title: first.content.trim() });
    } else {
      const bold = first?.content.trim().match(/^\*\*(.+)\*\*$/);
      if (bold?.[1]) store.updatePage(pageId, { title: bold[1] });
    }
  }
}

function guessDir(text: string): "ltr" | "rtl" | undefined {
  const m = text.match(/\p{L}/u);
  if (!m) return undefined;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(m[0]!)
    ? "rtl"
    : "ltr";
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
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "h") {
            e.preventDefault();
            const el = e.currentTarget;
            const s = el.selectionStart;
            const end = el.selectionEnd;
            if (s !== end) {
              onChange(value.slice(0, s) + "==" + value.slice(s, end) + "==" + value.slice(end));
            } else if (value.startsWith("==") && value.endsWith("==") && value.length >= 4) {
              onChange(value.slice(2, -2));
            } else {
              onChange(`==${value}==`);
            }
            return;
          }
          onKeyDown?.(e);
        }}
        onPaste={(e) => {
          onPaste?.(e);
          queueMicrotask(() => {
            if (e.defaultPrevented) setEditing(false);
          });
        }}
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
  const [lite, setLite] = useState(false);
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

  useEffect(() => {
    if (!lite) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLite(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lite]);

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
        <button type="button" className="lightbox block w-full" onClick={() => setLite(true)}>
          <img src={url} alt="" className="max-h-[480px] w-full object-contain" />
        </button>
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
      {lite && url ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLite(false)}
        >
          <img src={url} alt="" className="max-h-full max-w-full object-contain" />
        </div>
      ) : null}
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
  const [copied, setCopied] = useState(false);
  const lang = normalizeLang(block.lang);
  const langs: string[] = (CODE_LANGS as readonly string[]).includes(lang)
    ? [...CODE_LANGS]
    : [lang, ...CODE_LANGS];

  return (
    <div className="code-block overflow-hidden rounded-md" dir="ltr">
      <div className="relative flex items-center justify-end gap-2 px-3 pt-2">
        <button
          type="button"
          className="flex items-center gap-1 font-mono text-[11px] text-muted hover:text-fg"
          title="کپی"
          onClick={(e) => {
            e.stopPropagation();
            void navigator.clipboard.writeText(block.content).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            });
          }}
        >
          {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
        </button>
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
          className="min-h-24 w-full resize-y bg-transparent px-3 pb-3 font-mono text-[14px] leading-relaxed text-fg outline-none"
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

  function pasteGrid(e: ClipboardEvent<HTMLInputElement>, startR: number, startC: number, header: boolean) {
    const grid = clipboardToGrid(e.clipboardData);
    if (!grid?.length) return;
    e.preventDefault();
    let h = [...headers];
    let body = rows.map((row) => [...row]);
    const origin = header ? -1 : startR;
    for (let i = 0; i < grid.length; i++) {
      const rr = origin + i;
      const line = grid[i]!;
      for (let j = 0; j < line.length; j++) {
        const cc = startC + j;
        while (h.length <= cc) {
          h.push(`ستون ${h.length + 1}`);
          body = body.map((row) => [...row, ""]);
        }
        if (rr < 0) h[cc] = line[j]!;
        else {
          while (body.length <= rr) body.push(h.map(() => ""));
          while (body[rr]!.length < h.length) body[rr]!.push("");
          body[rr]![cc] = line[j]!;
        }
      }
    }
    body = body.map((row) => {
      const n = [...row];
      while (n.length < h.length) n.push("");
      return n.slice(0, h.length);
    });
    updateBlock(pageId, block.id, { headers: h, rows: body });
  }
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="note-table w-full min-w-[280px] text-[15px] leading-7">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="border-b border-border bg-surface-2 p-0 font-medium">
                <input
                  dir="auto"
                  value={h}
                  onChange={(e) => setCell(0, i, e.target.value, true)}
                  onPaste={(e) => pasteGrid(e, 0, i, true)}
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
                    onPaste={(e) => pasteGrid(e, r, c, false)}
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
  const [convertOpen, setConvertOpen] = useState(false);

  const canConvert = CONVERT.some((c) => c.type === block.type) || block.type === "callout" || block.type === "ol";
  const canHighlight =
    block.type === "p" ||
    block.type === "h1" ||
    block.type === "h2" ||
    block.type === "h3" ||
    block.type === "ul" ||
    block.type === "ol" ||
    block.type === "todo" ||
    block.type === "quote" ||
    block.type === "callout";

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
    const isList = block.type === "ul" || block.type === "ol" || block.type === "todo";
    if (e.key === "Tab" && isList) {
      e.preventDefault();
      const cur = block.indent ?? 0;
      updateBlock(pageId, block.id, {
        indent: e.shiftKey ? Math.max(0, cur - 1) : Math.min(8, cur + 1),
      });
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && block.type !== "code" && block.type !== "toggle") {
      e.preventDefault();
      if (isList && block.content.trim() === "") {
        if ((block.indent ?? 0) > 0) {
          updateBlock(pageId, block.id, { indent: (block.indent ?? 0) - 1 });
          return;
        }
        replaceBlock(pageId, block.id, { ...block, type: "p", content: "", indent: 0 });
        return;
      }
      insertBlock(pageId, block.id, isList ? block.type : "p", isList ? { indent: block.indent ?? 0 } : undefined);
    }
    if (e.key === "Backspace" && block.content === "") {
      if (isList && (block.indent ?? 0) > 0) {
        e.preventDefault();
        updateBlock(pageId, block.id, { indent: (block.indent ?? 0) - 1 });
        return;
      }
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
          "no-print relative mt-1 flex w-7 shrink-0 flex-col items-center gap-0.5 transition-opacity",
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
        {canConvert ? (
          <button
            type="button"
            className="flex size-6 items-center justify-center rounded text-subtle hover:bg-surface-2"
            title="تبدیل بلاک"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setConvertOpen((v) => !v)}
          >
            <Type className="size-3.5" />
          </button>
        ) : null}
        {convertOpen ? (
          <div className="absolute start-full top-0 z-30 ms-1 w-36 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
            {CONVERT.map((item) => (
              <button
                key={item.type}
                type="button"
                className={cn(
                  "flex w-full px-3 py-1.5 text-start text-[12px] hover:bg-surface-2",
                  item.type === block.type ? "text-fg" : "text-muted",
                )}
                onClick={() => {
                  const next = { ...block, type: item.type };
                  if (item.type === "code") next.lang = block.lang || "text";
                  if (item.type === "todo") next.checked = block.checked ?? false;
                  replaceBlock(pageId, block.id, next);
                  setConvertOpen(false);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="min-w-0 flex-1 py-0.5">{child}</div>
      <div className="no-print mt-1 flex w-6 shrink-0 flex-col items-center">
        {canHighlight ? (
          <button
            type="button"
            className="flex size-6 items-center justify-center rounded text-subtle opacity-0 hover:text-warn group-hover:opacity-100"
            title="هایلایت (Ctrl+H)"
            onClick={() => {
              const t = block.content;
              if (t.startsWith("==") && t.endsWith("==") && t.length >= 4) {
                updateBlock(pageId, block.id, { content: t.slice(2, -2) });
              } else if (t.trim()) {
                updateBlock(pageId, block.id, { content: `==${t}==` });
              }
            }}
          >
            <Highlighter className="size-3.5" />
          </button>
        ) : null}
        <button
          type="button"
          className="flex size-6 items-center justify-center rounded text-subtle opacity-0 hover:text-danger group-hover:opacity-100"
          onClick={() => removeBlock(pageId, block.id)}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
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
        ? "text-[24px] font-semibold leading-snug"
        : block.type === "h3"
          ? "text-[18px] font-semibold"
          : block.type === "quote"
            ? "border-s-2 border-fg/30 ps-3 text-[16px] leading-[1.75] text-muted italic"
            : block.type === "callout"
              ? cn(
                  "rounded-md border px-3 py-2.5 text-[16px] leading-[1.75]",
                  block.callout === "warning"
                    ? "border-warn/40 bg-warn/8"
                    : block.callout === "tip" || block.callout === "example"
                      ? "border-ok/40 bg-ok/8"
                      : block.callout === "danger"
                        ? "border-danger/40 bg-danger/8"
                        : "border-info/40 bg-info/8",
                )
              : "text-[16px] leading-[1.75]";

  const prefix =
    block.type === "ul" ? (
      <span className="mt-2 w-4 shrink-0 text-muted">•</span>
    ) : block.type === "ol" ? (
      <span className="mt-2 w-4 shrink-0 text-muted">1.</span>
    ) : block.type === "todo" ? (
      <input
        type="checkbox"
        checked={!!block.checked}
        onChange={(e) => updateBlock(pageId, block.id, { checked: e.target.checked })}
        className="mt-2 size-4 shrink-0 accent-accent"
      />
    ) : null;

  const headingAttr =
    block.type === "h1" || block.type === "h2" || block.type === "h3"
      ? headingAnchor(block.content)
      : undefined;

  const indent = Math.max(0, block.indent ?? 0);
  const isList = block.type === "ul" || block.type === "ol" || block.type === "todo";
  const listDir = isList ? guessDir(block.content) : undefined;

  return shell(
    <div className={cn("flex gap-2", typeClass)} data-heading={headingAttr} dir={listDir}>
      {isList && indent > 0
        ? Array.from({ length: indent }, (_, i) => (
            <span key={i} aria-hidden className="list-guide mt-0.5 w-5 shrink-0" />
          ))
        : null}
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
  const toggleStar = useNotes((s) => s.toggleStar);
  const scrollToBlock = useNotes((s) => s.scrollToBlock);
  const page = pages[currentId];
  const [tagInput, setTagInput] = useState("");
  const [slashFor, setSlashFor] = useState<string | null>(null);
  const [iconOpen, setIconOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

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

  useEffect(() => {
    const onWinPaste = (e: globalThis.ClipboardEvent) => {
      if (e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("textarea, input, [contenteditable='true'], [role='dialog']")) return;
      if (!e.clipboardData) return;
      const incoming = clipboardToBlocks(e.clipboardData);
      if (!incoming) return;
      e.preventDefault();
      applyIncoming(currentId, null, incoming);
    };
    window.addEventListener("paste", onWinPaste);
    return () => window.removeEventListener("paste", onWinPaste);
  }, [currentId]);

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

  function onPagePaste(e: ClipboardEvent<HTMLElement>) {
    const t = e.target as HTMLElement | null;
    if (t?.closest("textarea, input, [contenteditable='true']")) return;
    const incoming = clipboardToBlocks(e.clipboardData);
    if (!incoming) return;
    e.preventDefault();
    applyIncoming(page.id, null, incoming);
  }

  return (
    <article
      className="print-wide mx-auto w-full max-w-3xl px-4 pt-8 pb-28 sm:px-8"
      onDragOver={(e) => {
        if ([...e.dataTransfer.items].some((i) => i.kind === "file")) e.preventDefault();
      }}
      onDrop={onDropMd}
      onPaste={onPagePaste}
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
