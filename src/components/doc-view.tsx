import { useEffect, useState, type ReactNode } from "react";
import { HighlightedCode } from "@/lib/notes/highlight";
import { headingAnchor, InlineMd } from "@/lib/notes/inline";
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

function isList(b: Block) {
  return b.type === "ul" || b.type === "ol" || b.type === "todo";
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

function ListTree({ pageId, nodes }: { pageId: string; nodes: ListNode[] }) {
  const updateBody = useNotes((s) => s.updateBody);
  const pages = useNotes((s) => s.pages);
  const page = pages[pageId];

  const kind = nodes[0]?.block.type === "ol" ? "ol" : "ul";
  const Tag = kind as "ul" | "ol";

  function toggle(block: Block) {
    if (!page) return;
    const blocks = page.blocks.map((b) =>
      b.id === block.id ? { ...b, checked: !b.checked } : b,
    );
    updateBody(pageId, blocks.map(blockToMarkdown).filter(Boolean).join("\n\n"));
  }

  return (
    <Tag className="note-list">
      {nodes.map((n) => (
        <li key={n.block.id} data-block={n.block.id} className={n.block.checked ? "text-muted line-through" : undefined}>
          {n.block.type === "todo" ? (
            <label className="inline-flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1.5 size-4 accent-accent"
                checked={!!n.block.checked}
                onChange={() => toggle(n.block)}
              />
              <span>
                <Inline pageId={pageId} text={n.block.content} />
              </span>
            </label>
          ) : (
            <Inline pageId={pageId} text={n.block.content} />
          )}
          {n.children.length ? <ListTree pageId={pageId} nodes={n.children} /> : null}
        </li>
      ))}
    </Tag>
  );
}

function FlowBlock({ pageId, block }: { pageId: string; block: Block }) {
  if (block.type === "h1") {
    return (
      <h1 data-block={block.id} data-heading={headingAnchor(block.content)} className="note-h1">
        <Inline pageId={pageId} text={block.content} />
      </h1>
    );
  }
  if (block.type === "h2") {
    return (
      <h2 data-block={block.id} data-heading={headingAnchor(block.content)} className="note-h2">
        <Inline pageId={pageId} text={block.content} />
      </h2>
    );
  }
  if (block.type === "h3") {
    return (
      <h3 data-block={block.id} data-heading={headingAnchor(block.content)} className="note-h3">
        <Inline pageId={pageId} text={block.content} />
      </h3>
    );
  }
  if (block.type === "divider") return <hr className="my-5 border-border" />;
  if (block.type === "code") {
    return (
      <div data-block={block.id} className="code-block my-3 overflow-hidden rounded-md" dir="ltr">
        <HighlightedCode code={block.content} lang={block.lang} />
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

export function DocView({ page }: { page: Page }) {
  const blocks = page.blocks;
  const nodes: ReactNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i]!;
    if (isList(b)) {
      let j = i;
      while (j < blocks.length && isList(blocks[j]!)) j += 1;
      const id = blocks[i]!.id;
      nodes.push(<ListTree key={id} pageId={page.id} nodes={nestList(blocks.slice(i, j))} />);
      i = j;
      continue;
    }
    nodes.push(<FlowBlock key={b.id} pageId={page.id} block={b} />);
    i += 1;
  }
  if (!pageBody(page).trim() && !blocks.some((b) => b.content.trim() || b.type === "image" || b.type === "table")) {
    return <p className="text-subtle">برای نوشتن کلیک کن یا از ابسیدین پیست کن…</p>;
  }
  return <>{nodes}</>;
}
