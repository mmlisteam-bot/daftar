import { emptyBlock, nid, type Block, type CalloutKind } from "./types";

const CALLOUT_MAP: Record<string, CalloutKind> = {
  abstract: "abstract",
  summary: "abstract",
  tldr: "abstract",
  info: "info",
  note: "note",
  tip: "tip",
  hint: "tip",
  success: "tip",
  warning: "warning",
  caution: "warning",
  attention: "warning",
  important: "warning",
  danger: "danger",
  error: "danger",
  bug: "danger",
  failure: "danger",
  example: "example",
  quote: "info",
};

export const CODE_LANGS = [
  "text",
  "sql",
  "http",
  "bash",
  "python",
  "javascript",
  "json",
  "html",
  "css",
  "php",
  "yaml",
  "xml",
  "go",
  "rust",
] as const;

const LANG_ALIAS: Record<string, string> = {
  js: "javascript",
  ts: "javascript",
  typescript: "javascript",
  py: "python",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  console: "bash",
  yml: "yaml",
  md: "text",
  txt: "text",
  plaintext: "text",
  plain: "text",
};

export function normalizeLang(raw?: string | null): string {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return "text";
  return LANG_ALIAS[v] ?? v;
}

function blk(type: Block["type"], content = "", extra: Partial<Block> = {}): Block {
  return { ...emptyBlock(type), id: nid(), content, ...extra };
}

function isFence(line: string): { lang: string } | null {
  const m = line.trim().match(/^`{3,}\s*([a-zA-Z0-9_+-]*)\s*$/);
  if (!m) return null;
  return { lang: normalizeLang(m[1]) };
}

function isHr(line: string): boolean {
  return /^(---|\*\*\*|___)\s*$/.test(line.trim());
}

function isTableRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith("|") && t.includes("|", 1);
}

function isTableSep(line: string): boolean {
  const t = line.trim();
  if (!t.includes("-")) return false;
  return /^\|?[\s:|-]+\|?$/.test(t) && /---/.test(t.replaceAll(" ", ""));
}

function splitRow(line: string): string[] {
  let t = line.trim();
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|")) t = t.slice(0, -1);
  return t.split("|").map((c) => c.trim());
}

function headingOf(line: string): { level: 1 | 2 | 3; text: string } | null {
  const m = line.match(/^(#{1,6})\s+(.*)$/);
  if (!m) return null;
  const n = Math.min(3, m[1]!.length) as 1 | 2 | 3;
  return { level: n, text: m[2]!.trim() };
}

function listOf(line: string): { type: "ul" | "ol" | "todo"; text: string; checked?: boolean } | null {
  const todo = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/);
  if (todo) return { type: "todo", text: todo[2] ?? "", checked: todo[1] !== " " };
  const ul = line.match(/^\s*[-*+]\s+(.*)$/);
  if (ul) return { type: "ul", text: ul[1] ?? "" };
  const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
  if (ol) return { type: "ol", text: ol[1] ?? "" };
  return null;
}

function calloutOf(line: string): { kind: CalloutKind; rest: string } | null {
  const m = line.match(/^\s{0,3}>\s*\[!([a-zA-Z]+)\]\s*(.*)$/);
  if (!m) return null;
  const key = m[1]!.toLowerCase();
  const kind = CALLOUT_MAP[key] ?? "info";
  return { kind, rest: (m[2] ?? "").trim() };
}

function quoteText(line: string): string | null {
  const m = line.match(/^\s{0,3}>\s?(.*)$/);
  return m ? (m[1] ?? "") : null;
}

export function looksLikeMarkdown(text: string): boolean {
  const t = text.replace(/\r\n/g, "\n").trim();
  if (t.length < 2) return false;
  if (/```[\s\S]*```/.test(t)) return true;
  if (/^#{1,6}\s+\S/m.test(t)) return true;
  if (/^\|.+\|/m.test(t) && /\|?\s*:?-{3,}/m.test(t)) return true;
  if (/^>\s*\[!/m.test(t)) return true;
  if (/^---\s*$/m.test(t) && t.includes("\n")) return true;
  if (/^\s*[-*+]\s+\S/m.test(t) && (t.includes("\n") || t.includes("[["))) return true;
  if (/^\s*\d+[.)]\s+\S/m.test(t) && t.includes("\n")) return true;
  if (/\*\*[^*]+\*\*/.test(t) && t.includes("\n")) return true;
  return false;
}

export function looksLikeTsv(text: string): boolean {
  const lines = text.replace(/\r\n/g, "\n").trim().split("\n");
  if (lines.length < 2) return false;
  const cols = lines.map((l) => l.split("\t").length);
  return cols[0]! >= 2 && cols.every((n) => n === cols[0]);
}

export function tsvToBlock(text: string): Block {
  const lines = text.replace(/\r\n/g, "\n").trim().split("\n");
  const rows = lines.map((l) => l.split("\t").map((c) => c.trim()));
  return blk("table", "", { headers: rows[0], rows: rows.slice(1) });
}

export function markdownToBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "").split("\n");
  const out: Block[] = [];
  let i = 0;
  let para: string[] = [];

  const flushPara = () => {
    const text = para.join("\n").trim();
    para = [];
    if (text) out.push(blk("p", text));
  };

  while (i < lines.length) {
    const line = lines[i] ?? "";

    const fence = isFence(line);
    if (fence) {
      flushPara();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !isFence(lines[i] ?? "")) {
        body.push(lines[i] ?? "");
        i += 1;
      }
      if (i < lines.length) i += 1;
      out.push(blk("code", body.join("\n"), { lang: fence.lang }));
      continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1] ?? "")) {
      flushPara();
      const headers = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i] ?? "") && !isTableSep(lines[i] ?? "")) {
        const cells = splitRow(lines[i] ?? "");
        while (cells.length < headers.length) cells.push("");
        rows.push(cells.slice(0, Math.max(headers.length, cells.length)));
        i += 1;
      }
      out.push(blk("table", "", { headers, rows: rows.length ? rows : [headers.map(() => "")] }));
      continue;
    }

    const h = headingOf(line);
    if (h) {
      flushPara();
      const type = h.level === 1 ? "h1" : h.level === 2 ? "h2" : "h3";
      out.push(blk(type, h.text));
      i += 1;
      continue;
    }

    if (isHr(line)) {
      flushPara();
      out.push(blk("divider"));
      i += 1;
      continue;
    }

    const call = calloutOf(line);
    if (call) {
      flushPara();
      const body: string[] = [];
      if (call.rest) body.push(call.rest);
      i += 1;
      while (i < lines.length) {
        const q = quoteText(lines[i] ?? "");
        if (q === null) break;
        body.push(q);
        i += 1;
      }
      out.push(blk("callout", body.join("\n").trim(), { callout: call.kind }));
      continue;
    }

    const q = quoteText(line);
    if (q !== null) {
      flushPara();
      const body: string[] = [q];
      i += 1;
      while (i < lines.length) {
        const n = quoteText(lines[i] ?? "");
        if (n === null) break;
        body.push(n);
        i += 1;
      }
      out.push(blk("quote", body.join("\n").trim()));
      continue;
    }

    const li = listOf(line);
    if (li) {
      flushPara();
      out.push(blk(li.type, li.text, li.type === "todo" ? { checked: li.checked } : {}));
      i += 1;
      continue;
    }

    if (line.trim() === "") {
      flushPara();
      i += 1;
      continue;
    }

    para.push(line);
    i += 1;
  }
  flushPara();
  return out.length ? out : [blk("p")];
}

function looksLikeRichHtml(html: string): boolean {
  if (!html || html.length < 8) return false;
  if (/StartFragment/i.test(html)) return true;
  return /<(h[1-4]|table|pre|ul|ol|blockquote|hr)\b/i.test(html);
}

function inlineFromNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const inner = [...el.childNodes].map(inlineFromNode).join("");
  if (tag === "br") return "\n";
  if (tag === "strong" || tag === "b") return `**${inner}**`;
  if (tag === "em" || tag === "i") return `*${inner}*`;
  if (tag === "code" && el.parentElement?.tagName.toLowerCase() !== "pre") return `\`${inner}\``;
  if (tag === "s" || tag === "del") return `~~${inner}~~`;
  if (tag === "a") {
    const href = el.getAttribute("href") ?? "";
    return href ? `[${inner}](${href})` : inner;
  }
  return inner;
}

function langFromPre(el: HTMLElement): string {
  const cls = `${el.className} ${el.querySelector("code")?.className ?? ""}`;
  const m = cls.match(/language-([a-z0-9_+-]+)/i);
  if (m) return normalizeLang(m[1]);
  const data = el.getAttribute("data-language") || el.querySelector("code")?.getAttribute("data-language");
  if (data) return normalizeLang(data);
  return "text";
}

function tableFromEl(table: HTMLTableElement): Block {
  const rows: string[][] = [];
  for (const tr of table.querySelectorAll("tr")) {
    const cells = [...tr.querySelectorAll("th,td")].map((c) => (c.textContent ?? "").trim());
    if (cells.length) rows.push(cells);
  }
  const headers = rows[0] ?? ["", ""];
  const body = rows.slice(1);
  return blk("table", "", { headers, rows: body.length ? body : [headers.map(() => "")] });
}

export function htmlToBlocks(html: string): Block[] {
  if (typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out: Block[] = [];

  const pushText = (el: Element, type: Block["type"]) => {
    const text = inlineFromNode(el).trim();
    if (text) out.push(blk(type, text));
  };

  const walk = (node: Node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      const t = (node.textContent ?? "").trim();
      if (t) out.push(blk("p", t));
      return;
    }
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === "style" || tag === "script" || tag === "meta" || tag === "link") return;
    if (tag === "h1") return pushText(el, "h1");
    if (tag === "h2") return pushText(el, "h2");
    if (tag === "h3" || tag === "h4") return pushText(el, "h3");
    if (tag === "p") return pushText(el, "p");
    if (tag === "hr") {
      out.push(blk("divider"));
      return;
    }
    if (tag === "pre") {
      const code = el.textContent ?? "";
      out.push(blk("code", code.replace(/\n$/, ""), { lang: langFromPre(el) }));
      return;
    }
    if (tag === "table") {
      out.push(tableFromEl(el as HTMLTableElement));
      return;
    }
    if (tag === "blockquote") {
      const raw = (el.textContent ?? "").trim();
      const call = calloutOf(`> ${raw.split("\n")[0]}`);
      if (call) {
        out.push(blk("callout", raw.replace(/^\s*\[!\w+\]\s*/, ""), { callout: call.kind }));
      } else if (raw) {
        out.push(blk("quote", raw));
      }
      return;
    }
    if (tag === "ul" || tag === "ol") {
      const kind = tag === "ol" ? "ol" : "ul";
      for (const li of el.querySelectorAll(":scope > li")) {
        const raw = inlineFromNode(li).trim();
        const todo = raw.match(/^\[([ xX])\]\s*(.*)$/);
        if (todo) out.push(blk("todo", todo[2] ?? "", { checked: todo[1] !== " " }));
        else out.push(blk(kind, raw));
      }
      return;
    }
    if (tag === "img") {
      const alt = el.getAttribute("alt") ?? "";
      if (alt) out.push(blk("p", `![${alt}](${el.getAttribute("src") ?? ""})`));
      return;
    }
    for (const child of el.childNodes) walk(child);
  };

  walk(doc.body);
  return out.length ? out : [];
}

export function clipboardToBlocks(data: DataTransfer): Block[] | null {
  const text = data.getData("text/plain");
  const html = data.getData("text/html");

  if (text && looksLikeMarkdown(text)) return markdownToBlocks(text);
  if (html && looksLikeRichHtml(html)) {
    const blocks = htmlToBlocks(html);
    if (blocks.length) return blocks;
  }
  if (text && looksLikeTsv(text)) return [tsvToBlock(text)];
  if (text && text.includes("\n") && /^\|.+\|/m.test(text)) {
    return markdownToBlocks(text);
  }
  return null;
}

export function stripHeadingMarkup(title: string): string {
  return title.replace(/^#+\s+/, "").trim();
}
