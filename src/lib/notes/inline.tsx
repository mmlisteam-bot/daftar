import { cn } from "@/lib/utils";

type Seg =
  | { k: "text"; v: string }
  | { k: "b" | "i" | "s" | "code"; v: string }
  | { k: "a"; v: string; href: string }
  | { k: "wiki"; v: string; target: string }
  | { k: "mark"; v: string };

const TOKEN =
  /(\*\*[^*]+\*\*|==[^=]+==|__[^_]+__|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)]+\)|\[\[[^\]]+\]\]|\*[^*]+\*|_[^_]+_)/g;

function splitInline(src: string): Seg[] {
  const out: Seg[] = [];
  let last = 0;
  const re = new RegExp(TOKEN.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ k: "text", v: src.slice(last, m.index) });
    const t = m[0];
    if ((t.startsWith("**") && t.endsWith("**")) || (t.startsWith("__") && t.endsWith("__"))) {
      out.push({ k: "b", v: t.slice(2, -2) });
    } else if (t.startsWith("==") && t.endsWith("==")) {
      out.push({ k: "mark", v: t.slice(2, -2) });
    } else if (t.startsWith("~~") && t.endsWith("~~")) {
      out.push({ k: "s", v: t.slice(2, -2) });
    } else if (t.startsWith("`") && t.endsWith("`")) {
      out.push({ k: "code", v: t.slice(1, -1) });
    } else if (t.startsWith("[[") && t.endsWith("]]")) {
      const inner = t.slice(2, -2);
      const [hrefPart, alias] = inner.split("|");
      const target = (hrefPart ?? "").replace(/^#/, "").trim() || inner;
      const label = (alias ?? inner.replace(/^#/, "")).trim();
      out.push({ k: "wiki", v: label, target });
    } else if (t.startsWith("[")) {
      const mm = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (mm) out.push({ k: "a", v: mm[1] ?? "", href: mm[2] ?? "" });
      else out.push({ k: "text", v: t });
    } else if ((t.startsWith("*") && t.endsWith("*")) || (t.startsWith("_") && t.endsWith("_"))) {
      out.push({ k: "i", v: t.slice(1, -1) });
    } else {
      out.push({ k: "text", v: t });
    }
    last = m.index + t.length;
  }
  if (last < src.length) out.push({ k: "text", v: src.slice(last) });
  return out;
}

export function InlineMd({
  text,
  className,
  onWiki,
}: {
  text: string;
  className?: string;
  onWiki?: (target: string) => void;
}) {
  if (!text) return <span className={cn("text-subtle", className)}> </span>;
  const lines = text.split("\n");
  return (
    <span className={cn("whitespace-pre-wrap [unicode-bidi:plaintext]", className)} dir="auto">
      {lines.map((line, li) => (
        <span key={li}>
          {li > 0 ? <br /> : null}
          {splitInline(line).map((seg, i) => {
            const key = `${li}-${i}`;
            if (seg.k === "text") return <span key={key}>{seg.v}</span>;
            if (seg.k === "b") return <strong key={key}>{seg.v}</strong>;
            if (seg.k === "i") return <em key={key}>{seg.v}</em>;
            if (seg.k === "s") return <s key={key}>{seg.v}</s>;
            if (seg.k === "code") {
              return (
                <code
                  key={key}
                  dir="ltr"
                  className="rounded-sm bg-surface-2 px-1 py-0.5 font-mono text-[0.86em]"
                >
                  {seg.v}
                </code>
              );
            }
            if (seg.k === "a") {
              return (
                <a
                  key={key}
                  href={seg.href}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-border underline-offset-2 hover:text-info"
                  onClick={(e) => e.stopPropagation()}
                >
                  {seg.v}
                </a>
              );
            }
            if (seg.k === "mark") {
              return (
                <mark key={key} className="hl-mark">
                  {seg.v}
                </mark>
              );
            }
            if (seg.k === "wiki") {
              return (
                <button
                  key={key}
                  type="button"
                  className="wiki-link"
                  onClick={(e) => {
                    e.stopPropagation();
                    onWiki?.(seg.target);
                  }}
                >
                  {seg.v}
                </button>
              );
            }
            return <span key={key}>{seg.v}</span>;
          })}
        </span>
      ))}
    </span>
  );
}

export function headingAnchor(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}


