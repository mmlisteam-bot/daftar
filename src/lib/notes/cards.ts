import type { Page } from "./types";

export type StudyCard = {
  id: string;
  pageId: string;
  pageTitle: string;
  front: string;
  back: string;
  kind: "heading" | "todo";
};

function nextAnswer(blocks: Page["blocks"], from: number): string {
  for (let j = from + 1; j < blocks.length; j++) {
    const n = blocks[j]!;
    if (n.type === "h1" || n.type === "h2" || n.type === "h3") break;
    const text = n.content.trim();
    if (
      text &&
      (n.type === "p" ||
        n.type === "ul" ||
        n.type === "ol" ||
        n.type === "quote" ||
        n.type === "callout" ||
        n.type === "code" ||
        n.type === "todo")
    ) {
      return text;
    }
  }
  return "";
}

export function cardsFromPage(page: Page): StudyCard[] {
  const cards: StudyCard[] = [];
  const blocks = page.blocks;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    if ((b.type === "h2" || b.type === "h3" || b.type === "h1") && b.content.trim()) {
      const back = nextAnswer(blocks, i);
      if (back) {
        cards.push({
          id: `${page.id}:${b.id}`,
          pageId: page.id,
          pageTitle: page.title || "بدون عنوان",
          front: b.content.trim(),
          back,
          kind: "heading",
        });
      }
    }
    if (b.type === "todo" && b.content.trim()) {
      const follow = nextAnswer(blocks, i);
      cards.push({
        id: `${page.id}:${b.id}`,
        pageId: page.id,
        pageTitle: page.title || "بدون عنوان",
        front: b.content.trim(),
        back: follow || (b.checked ? "تیک خورده — مرور کن چرا." : "هنوز باز است. جواب را بلند بگو."),
        kind: "todo",
      });
    }
  }
  return cards;
}

export function cardsFromScope(
  pages: Record<string, Page>,
  currentId: string,
  scope: "page" | "all",
): StudyCard[] {
  if (scope === "page") {
    const page = pages[currentId];
    return page ? cardsFromPage(page) : [];
  }
  return Object.values(pages).flatMap(cardsFromPage);
}

export function todoStats(
  page: Page,
  pages: Record<string, Page>,
): { done: number; total: number } {
  let done = 0;
  let total = 0;
  const walk = (p: Page) => {
    for (const b of p.blocks) {
      if (b.type === "todo") {
        total += 1;
        if (b.checked) done += 1;
      }
    }
    for (const child of Object.values(pages).filter((c) => c.parentId === p.id)) walk(child);
  };
  walk(page);
  return { done, total };
}
