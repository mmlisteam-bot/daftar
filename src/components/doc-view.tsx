import { ChevronDown } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { CodeCard } from "@/lib/notes/highlight";
import { headingAnchor, InlineMd } from "@/lib/notes/inline";
import { markdownToBlocks, promoteLooseCode } from "@/lib/notes/parse";
import { getImageBlob } from "@/lib/notes/images";
import { useNotes } from "@/lib/notes/store";
import { blockToMarkdown, pageBody } from "@/lib/notes/markdown";
import type { Block, CalloutKind, Page } from "@/lib/notes/types";
import { cn } from "@/lib/utils";

const CALLOUT_LABEL: Record<CalloutKind, string> = {
  abstract: "خلاصه",
  info: "نکته",
  note: "یادداشت",
  tip: "تیپ",
  warning: "هشدار",
  danger: "خطر",
  example: "مثال",
};

const FOLD_STORE = "daftar-folds";

function loadFolds(pageId: string): Set<string> {
  try {
    const all = JSON.parse(localStorage.getItem(FOLD_STORE) || "{}") as Record<string, string[]>;
    return new Set(all[pageId] ?? []);
  } catch {
    return new Set();
  }
}

function saveFolds(pageId: string, folded: Set<string>) {
  try {
    const all = JSON.parse(localStorage.getItem(FOLD_STORE) || "{}") as Record<string, string[]>;
    if (folded.size) all[pageId] = [...folded];
    else delete all[pageId];
    localStorage.setItem(FOLD_STORE, JSON.stringify(all));
  } catch {
    /* ignore quota */
  }
}

const FoldCtx = createContext<{
  folded: Set<string>;
  toggle: (key: string) => void;
}>({ folded: new Set(), toggle: () => {} });

function usePageFold(pageId: string) {
  const [folded, setFolded] = useState(() => loadFolds(pageId));
  useEffect(() => {
    setFolded(loadFolds(pageId));
  }, [pageId]);
  function toggle(key: string) {
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveFolds(pageId, next);
      return next;
    });
  }
  return { folded, toggle };
}

function FoldBtn({ k, label }: { k: string; label: string }) {
  const { folded, toggle } = useContext(FoldCtx);
  const isFolded = folded.has(k);
  return (
    <button
      type="button"
      className="fold-btn no-print"
      data-folded={isFolded ? "true" : "false"}
      aria-expanded={!isFolded}
      aria-label={isFolded ? `باز کردن ${label}` : `جمع کردن ${label}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(k);
      }}
    >
      <ChevronDown className="size-3.5" strokeWidth={2.2} />
    </button>
  );
}

function isList(b: Block) {
  return b.type === "ul" || b.type === "ol" || b.type === "todo";
}

function headingLevel(type: Block["type"]): number {
  if (type === "h1") return 1;
  if (type === "h2") return 2;
  if (type === "h3") return 3;
  return 0;
}

type ListNode = { block: Block; children: ListNode[] };

function nestList(items: Block[]): ListNode[] {
  const root: ListNode[] = [];
  const stack: { indent: number; node: ListNode }[] = [];
  for (const block of items) {
    const indent = block.indent ?? 0;
    const node: ListNode = { block, children: [] };
    while (stack.length && stack[stack.length - 1]!.indent >= indent) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent) parent.node.children.push(node);
    else root.push(node);
    stack.push({ indent, node });
  }
  return root;
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

function AttachmentImg({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoke: string | null = null;
    getImageBlob(id).then((blob) => {
      if (!blob) return;
      revoke = URL.createObjectURL(blob);
      setUrl(revoke);
    });
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [id]);
  if (!url) return <span className="text-subtle">تصویر</span>;
  return <img src={url} alt="" className="my-3 max-h-[480px] w-full rounded-md object-contain" />;
}

function Inline({ pageId, text }: { pageId: string; text: string }) {
  return <InlineMd text={text} onWiki={(t) => jumpWiki(pageId, t)} />;
}

function ListTree({ pageId, nodes, path }: { pageId: string; nodes: ListNode[]; path: string }) {
  const updateBody = useNotes((s) => s.updateBody);
  const pages = useNotes((s) => s.pages);
  const page = pages[pageId];
  const { folded } = useContext(FoldCtx);

  const kind = nodes[0]?.block.type === "ol" ? "ol" : "ul";
  const Tag = kind as "ul" | "ol";

  function toggleTodo(block: Block) {
    if (!page) return;
    const blocks = page.blocks.map((b) =>
      b.id === block.id ? { ...b, checked: !b.checked } : b,
    );
    updateBody(pageId, blocks.map(blockToMarkdown).filter(Boolean).join("\n\n"));
  }

  return (
    <Tag className="note-list">
      {nodes.map((n, i) => {
        const key = `l:${path}/${i}:${n.block.content.trim().toLowerCase()}`;
        const hasKids = n.children.length > 0;
        const isFolded = hasKids && folded.has(key);
        return (
          <li
            key={n.block.id}
            data-block={n.block.id}
            data-fold-key={hasKids ? key : undefined}
            className={cn("note-li", n.block.checked && "text-muted line-through", hasKids && "has-fold")}
          >
            {hasKids ? <FoldBtn k={key} label={n.block.content || "لیست"} /> : null}
            {n.block.type === "todo" ? (
              <label className="inline-flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1.5 size-4 accent-accent"
                  checked={!!n.block.checked}
                  onChange={() => toggleTodo(n.block)}
                />
                <span>
                  <Inline pageId={pageId} text={n.block.content} />
                </span>
              </label>
            ) : (
              <Inline pageId={pageId} text={n.block.content} />
            )}
            {hasKids && !isFolded ? (
              <ListTree pageId={pageId} nodes={n.children} path={`${path}/${i}`} />
            ) : null}
          </li>
        );
      })}
    </Tag>
  );
}

function FlowBlock({ pageId, block }: { pageId: string; block: Block }) {
  if (block.type === "divider") return <hr className="my-5 border-border" />;
  if (block.type === "code") {
    return (
      <div data-block={block.id} className="code-block my-3 overflow-hidden rounded-md" dir="ltr">
        <CodeCard code={block.content} lang={block.lang} />
      </div>
    );
  }
  if (block.type === "quote") {
    return (
      <blockquote data-block={block.id} className="note-quote">
        <Inline pageId={pageId} text={block.content} />
      </blockquote>
    );
  }
  if (block.type === "callout") {
    const k = block.callout ?? "info";
    return (
      <aside
        data-block={block.id}
        className={cn(
          "note-callout",
          k === "warning" && "border-warn/40 bg-warn/8",
          (k === "tip" || k === "example") && "border-ok/40 bg-ok/8",
          k === "danger" && "border-danger/40 bg-danger/8",
          (k === "info" || k === "note" || k === "abstract") && "border-info/40 bg-info/8",
        )}
      >
        <div className="mb-1 text-[11px] font-medium text-muted">{CALLOUT_LABEL[k] ?? k}</div>
        <Inline pageId={pageId} text={block.content} />
      </aside>
    );
  }
  if (block.type === "image" && block.imageId) {
    return (
      <div data-block={block.id}>
        <AttachmentImg id={block.imageId} />
      </div>
    );
  }
  if (block.type === "table") {
    const headers = block.headers ?? [];
    const rows = block.rows ?? [];
    return (
      <div data-block={block.id} className="my-3 overflow-x-auto">
        <table className="note-table w-full min-w-[240px] text-[15px]">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="border border-border bg-surface-2 px-3 py-2 text-start font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {headers.map((_, c) => (
                  <td key={c} className="border border-border px-3 py-2">
                    {row[c] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (block.type === "toggle") {
    return (
      <details data-block={block.id} className="my-2 rounded-md border border-border px-3 py-2" open={block.open}>
        <summary className="cursor-pointer font-medium">
          <Inline pageId={pageId} text={block.content} />
        </summary>
        <div className="mt-2 text-muted">
          <Inline pageId={pageId} text={block.inner ?? ""} />
        </div>
      </details>
    );
  }
  const att = block.content.match(/^!\[([^\]]*)\]\(attachment:([^)]+)\)$/);
  if (att) {
    return (
      <div data-block={block.id}>
        <AttachmentImg id={att[2]!} />
      </div>
    );
  }
  if (!block.content.trim()) return null;
  return (
    <p data-block={block.id} className="note-p">
      <Inline pageId={pageId} text={block.content} />
    </p>
  );
}

function HeadingBlock({ pageId, block, foldKey, foldable }: { pageId: string; block: Block; foldKey: string; foldable: boolean }) {
  const Tag = block.type === "h1" ? "h1" : block.type === "h3" ? "h3" : "h2";
  const cls = block.type === "h1" ? "note-h1" : block.type === "h3" ? "note-h3" : "note-h2";
  return (
    <Tag
      data-block={block.id}
      data-heading={headingAnchor(block.content)}
      data-fold-key={foldable ? foldKey : undefined}
      className={cn(cls, "note-heading", foldable && "has-fold")}
    >
      {foldable ? <FoldBtn k={foldKey} label={block.content || "تیتر"} /> : null}
      <Inline pageId={pageId} text={block.content} />
    </Tag>
  );
}

function Flow({ pageId, blocks }: { pageId: string; blocks: Block[] }) {
  const { folded } = useContext(FoldCtx);
  const nodes: ReactNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i]!;
    const lvl = headingLevel(b.type);
    if (lvl) {
      let j = i + 1;
      while (j < blocks.length) {
        const n = headingLevel(blocks[j]!.type);
        if (n && n <= lvl) break;
        j += 1;
      }
      const rest = blocks.slice(i + 1, j);
      const key = `h:${headingAnchor(b.content)}:${lvl}`;
      const foldable = rest.length > 0;
      const isFolded = foldable && folded.has(key);
      nodes.push(
        <section key={b.id} className="note-section">
          <HeadingBlock pageId={pageId} block={b} foldKey={key} foldable={foldable} />
          {foldable && !isFolded ? <Flow pageId={pageId} blocks={rest} /> : null}
        </section>,
      );
      i = j;
      continue;
    }
    if (isList(b)) {
      let j = i;
      while (j < blocks.length && isList(blocks[j]!)) j += 1;
      const id = blocks[i]!.id;
      nodes.push(<ListTree key={id} pageId={pageId} nodes={nestList(blocks.slice(i, j))} path={id.slice(0, 8)} />);
      i = j;
      continue;
    }
    nodes.push(<FlowBlock key={b.id} pageId={pageId} block={b} />);
    i += 1;
  }
  return <>{nodes}</>;
}

export function DocView({ page }: { page: Page }) {
  const fold = usePageFold(page.id);
  if (!pageBody(page).trim() && !page.blocks.some((b) => b.content.trim() || b.type === "image" || b.type === "table")) {
    return <p className="text-subtle">برای نوشتن کلیک کن یا از ابسیدین پیست کن…</p>;
  }
  return (
    <FoldCtx.Provider value={fold}>
      <Flow pageId={page.id} blocks={promoteLooseCode(page.blocks)} />
    </FoldCtx.Provider>
  );
}
