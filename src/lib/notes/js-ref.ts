import { PAGE } from "./ids";
import { markdownToBlocks } from "./parse";
import type { Block, Page, PageIcon } from "./types";

export const JS_REF_FLAG = "daftar-js-ref-v1";

const BASE = 1_724_500_100_000;

function slugPart(title: string): string {
  const map: Record<string, string> = {
    "بخش ۱": "s1",
    "بخش 1": "s1",
    "بخش ۲": "s2",
    "بخش 2": "s2",
    "بخش ۳": "s3",
    "بخش 3": "s3",
    "بخش ۴": "s4",
    "بخش 4": "s4",
    "بخش ۵": "s5",
    "بخش 5": "s5",
    "بخش ۶": "s6",
    "بخش 6": "s6",
    "بخش ۷": "s7",
    "بخش 7": "s7",
    "بخش ۸": "s8",
    "بخش 8": "s8",
    "بخش ۹": "s9",
    "بخش 9": "s9",
    "بخش ۱۰": "s10",
    "بخش 10": "s10",
    "بخش ۱۱": "s11",
    "بخش 11": "s11",
    "بخش ۱۲": "s12",
    "بخش 12": "s12",
    "بخش ۱۳": "s13",
    "بخش 13": "s13",
    "بخش ۱۴": "s14",
    "بخش 14": "s14",
  };
  for (const [k, v] of Object.entries(map)) {
    if (title.startsWith(k)) return v;
  }
  if (title.includes("جمع‌بندی")) return "sum";
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return ascii || "x";
}

function subSlug(title: string, idx: number): string {
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 36);
  return ascii || `h${idx + 1}`;
}

function iconFor(title: string): PageIcon {
  const t = title.toLowerCase();
  if (/dom|bom|http|web/.test(t)) return "globe";
  if (/ajax|fetch|cors|postmessage|recon|ابزار/.test(t)) return "network";
  if (/csrf|auth|session|cookie|samesite/.test(t)) return "lock";
  if (/sop|unicode|normalization|defense|دفاع|protection/.test(t)) return "shield";
  if (/xss|inject|آلود|تزریق|hijack|bypass|waf|pollution/.test(t)) return "bug";
  if (/sql|دیتابیس/.test(t)) return "database";
  if (/ابزار|tool|sqlmap|terminal|practice|تمرین/.test(t)) return "terminal";
  if (/جمع|خلاصه|مبنا|چیست/.test(t)) return "book";
  return "code";
}

function pageOf(
  id: string,
  title: string,
  icon: PageIcon,
  tags: string[],
  parentId: string | null,
  sort: number,
  body: string,
  extra?: Partial<Page>,
): Page {
  const blocks = markdownToBlocks(body.trim() ? body : title);
  const withIds: Block[] = blocks.map((b, i) => ({ ...b, id: `js-b-${id}-${i + 1}` }));
  return {
    id,
    title,
    icon,
    tags,
    parentId,
    blocks: withIds,
    body: body.trim(),
    createdAt: BASE + sort,
    updatedAt: BASE + sort,
    sort,
    ...extra,
  };
}

type Chunk = { title: string; body: string };

function splitByHeading(src: string, level: 1 | 2): Chunk[] {
  const re = level === 1 ? /^# (?!#)(.*)$/gm : /^## (?!#)(.*)$/gm;
  const hits: { title: string; start: number; bodyStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    hits.push({ title: m[1]!.trim(), start: m.index, bodyStart: m.index + m[0].length });
  }
  if (!hits.length) return [];
  const out: Chunk[] = [];
  for (let i = 0; i < hits.length; i++) {
    const end = i + 1 < hits.length ? hits[i + 1]!.start : src.length;
    out.push({ title: hits[i]!.title, body: src.slice(hits[i]!.bodyStart, end).replace(/^\n+/, "") });
  }
  return out;
}

function wikiList(titles: string[]): string {
  return titles.map((t) => `- [[${t}]]`).join("\n");
}

const TAGS = ["JavaScript", "Client-Side", "جزوه"];

export function createJsRefPages(rawMarkdown: string): Record<string, Page> {
  const pages: Record<string, Page> = {};
  const raw = String(rawMarkdown ?? "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const h1 = splitByHeading(raw, 1);
  if (!h1.length) return pages;

  const intro = h1[0]!;
  const chapters = h1.slice(1);
  const chapterMeta = chapters.map((ch, i) => ({
    id: `${PAGE.js}-${slugPart(ch.title)}`,
    title: ch.title,
    sort: (i + 1) * 100,
    body: ch.body,
  }));

  const rootBody = [
    intro.body.trim(),
    "",
    "## فهرست بخش‌ها",
    "",
    wikiList(chapterMeta.map((c) => c.title)),
    "",
    "> [!tip]",
    "> روی هر عنوان در سایدبار یا کارت زیرصفحه بزن. زیرشاخه‌ها همان تیترهای جزوه هستند.",
    "",
    "لب تعاملی همین جزوه: [خانه چراغک](https://mmlisteam-bot.github.io/js-lab/)",
  ].join("\n");

  pages[PAGE.js] = pageOf(PAGE.js, "جاوااسکریپت", "code", [...TAGS, "مرجع"], null, 40, rootBody, {
    starred: true,
  });

  for (const ch of chapterMeta) {
    const subs = splitByHeading(ch.body, 2);
    const beforeFirstH2 = ch.body.split(/^## /m)[0]?.trim() ?? "";
    if (subs.length >= 2) {
      const sectionBody = [beforeFirstH2, "", "## زیرشاخه‌ها", "", wikiList(subs.map((s) => s.title))]
        .join("\n")
        .trim();
      pages[ch.id] = pageOf(ch.id, ch.title, iconFor(ch.title), [...TAGS], PAGE.js, ch.sort, sectionBody);
      subs.forEach((sub, si) => {
        const sid = `${ch.id}-${subSlug(sub.title, si)}`;
        const body = `## ${sub.title}\n\n${sub.body}`.trim();
        pages[sid] = pageOf(sid, sub.title, iconFor(sub.title), [...TAGS], ch.id, (si + 1) * 10, body);
      });
    } else {
      const body = ch.body.trim() ? `# ${ch.title}\n\n${ch.body}` : `# ${ch.title}`;
      pages[ch.id] = pageOf(ch.id, ch.title, iconFor(ch.title), [...TAGS], PAGE.js, ch.sort, body);
    }
  }

  return pages;
}

export const JS_EXPAND: Record<string, boolean> = {
  [PAGE.js]: true,
};

export function applyJsRef(
  pages: Record<string, Page>,
  order: string[],
  expanded: Record<string, boolean>,
  rawMarkdown: string,
): { pages: Record<string, Page>; order: string[]; expanded: Record<string, boolean> } {
  const ref = createJsRefPages(rawMarkdown);
  const nextPages = { ...pages, ...ref };
  const nextOrder = [...order];
  if (!nextOrder.includes(PAGE.js)) {
    const after = nextOrder.indexOf(PAGE.xss);
    if (after >= 0) nextOrder.splice(after, 0, PAGE.js);
    else {
      const sqli = nextOrder.indexOf(PAGE.sqli);
      nextOrder.splice(sqli >= 0 ? sqli + 1 : nextOrder.length, 0, PAGE.js);
    }
  }
  return {
    pages: nextPages,
    order: nextOrder,
    expanded: { ...expanded, ...JS_EXPAND },
  };
}

export async function loadJsNotesMarkdown(): Promise<string | null> {
  try {
    const res = await fetch("./js-notes.md");
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}
