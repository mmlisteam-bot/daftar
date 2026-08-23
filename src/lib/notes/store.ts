import { create } from "zustand";
import { persist } from "zustand/middleware";
import { markdownToBlocks } from "./parse";
import { createSeed } from "./seed";
import {
  emptyBlock,
  emptyPage,
  nid,
  type Block,
  type BlockType,
  type NotesSnapshot,
  type Page,
  type PageIcon,
} from "./types";

const seed = createSeed();

type NotesState = NotesSnapshot & {
  filterTag: string | null;
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
  setTheme: (t: "dark" | "light") => void;
  setCurrent: (id: string) => void;
  setFilterTag: (tag: string | null) => void;
  toggleExpanded: (id: string) => void;
  createPage: (opts?: { parentId?: string | null; title?: string; icon?: PageIcon }) => string;
  deletePage: (id: string) => void;
  updatePage: (id: string, patch: Partial<Pick<Page, "title" | "icon" | "tags">>) => void;
  addTag: (id: string, tag: string) => void;
  removeTag: (id: string, tag: string) => void;
  insertBlock: (pageId: string, afterId: string | null, type?: BlockType) => string;
  insertBlocks: (pageId: string, afterId: string | null, incoming: Block[]) => void;
  replaceWithBlocks: (pageId: string, blockId: string, incoming: Block[]) => void;
  updateBlock: (pageId: string, blockId: string, patch: Partial<Block>) => void;
  replaceBlock: (pageId: string, blockId: string, next: Block) => void;
  removeBlock: (pageId: string, blockId: string) => void;
  moveBlock: (pageId: string, blockId: string, dir: -1 | 1) => void;
  importSnapshot: (data: NotesSnapshot) => void;
  importMarkdown: (pageId: string, md: string) => void;
  resetDemo: () => void;
};

function childrenOf(pages: Record<string, Page>, parentId: string): Page[] {
  return Object.values(pages)
    .filter((p) => p.parentId === parentId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

function descendants(pages: Record<string, Page>, id: string): string[] {
  const out: string[] = [];
  for (const child of childrenOf(pages, id)) {
    out.push(child.id, ...descendants(pages, child.id));
  }
  return out;
}

export function getChildren(pages: Record<string, Page>, parentId: string | null): Page[] {
  return Object.values(pages)
    .filter((p) => p.parentId === parentId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function breadcrumbs(pages: Record<string, Page>, id: string): Page[] {
  const chain: Page[] = [];
  let cur: Page | undefined = pages[id];
  const guard = new Set<string>();
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    chain.unshift(cur);
    cur = cur.parentId ? pages[cur.parentId] : undefined;
  }
  return chain;
}

export function allTags(pages: Record<string, Page>): { tag: string; count: number }[] {
  const map = new Map<string, number>();
  for (const p of Object.values(pages)) {
    for (const t of p.tags) map.set(t, (map.get(t) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "fa"));
}

export const useNotes = create<NotesState>()(
  persist(
    (set, get) => ({
      pages: seed.pages,
      order: seed.order,
      currentId: seed.order[0]!,
      theme: "dark",
      expanded: { [seed.order[2] ?? ""]: true },
      filterTag: null,
      hydrated: false,
      setHydrated: (v) => set({ hydrated: v }),
      setTheme: (theme) => set({ theme }),
      setCurrent: (id) => set({ currentId: id, filterTag: get().filterTag }),
      setFilterTag: (filterTag) => set({ filterTag }),
      toggleExpanded: (id) =>
        set((s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),
      createPage: (opts) => {
        const page = emptyPage({
          parentId: opts?.parentId ?? null,
          title: opts?.title ?? "صفحه جدید",
          icon: opts?.icon ?? "file",
        });
        set((s) => {
          const pages = { ...s.pages, [page.id]: page };
          const order = page.parentId ? s.order : [...s.order, page.id];
          const expanded = page.parentId
            ? { ...s.expanded, [page.parentId]: true }
            : s.expanded;
          return { pages, order, expanded, currentId: page.id };
        });
        return page.id;
      },
      deletePage: (id) => {
        const { pages, order, currentId } = get();
        if (!pages[id] || Object.keys(pages).length <= 1) return;
        const ids = [id, ...descendants(pages, id)];
        const nextPages = { ...pages };
        for (const d of ids) delete nextPages[d];
        const nextOrder = order.filter((x) => !ids.includes(x));
        let nextCurrent = currentId;
        if (ids.includes(currentId)) {
          nextCurrent = nextOrder[0] ?? Object.keys(nextPages)[0]!;
        }
        set({ pages: nextPages, order: nextOrder, currentId: nextCurrent });
      },
      updatePage: (id, patch) =>
        set((s) => {
          const page = s.pages[id];
          if (!page) return s;
          return {
            pages: {
              ...s.pages,
              [id]: { ...page, ...patch, updatedAt: Date.now() },
            },
          };
        }),
      addTag: (id, tag) => {
        const t = tag.trim();
        if (!t) return;
        const page = get().pages[id];
        if (!page || page.tags.includes(t)) return;
        get().updatePage(id, { tags: [...page.tags, t] });
      },
      removeTag: (id, tag) => {
        const page = get().pages[id];
        if (!page) return;
        get().updatePage(id, { tags: page.tags.filter((x) => x !== tag) });
      },
      insertBlock: (pageId, afterId, type = "p") => {
        const block = emptyBlock(type);
        set((s) => {
          const page = s.pages[pageId];
          if (!page) return s;
          const blocks = [...page.blocks];
          const idx = afterId ? blocks.findIndex((b) => b.id === afterId) : -1;
          blocks.splice(idx + 1, 0, block);
          return {
            pages: {
              ...s.pages,
              [pageId]: { ...page, blocks, updatedAt: Date.now() },
            },
          };
        });
        return block.id;
      },
      insertBlocks: (pageId, afterId, incoming) => {
        if (!incoming.length) return;
        set((s) => {
          const page = s.pages[pageId];
          if (!page) return s;
          const blocks = [...page.blocks];
          const idx = afterId ? blocks.findIndex((b) => b.id === afterId) : -1;
          blocks.splice(idx + 1, 0, ...incoming);
          return {
            pages: {
              ...s.pages,
              [pageId]: { ...page, blocks, updatedAt: Date.now() },
            },
          };
        });
      },
      replaceWithBlocks: (pageId, blockId, incoming) => {
        if (!incoming.length) return;
        set((s) => {
          const page = s.pages[pageId];
          if (!page) return s;
          const blocks = [...page.blocks];
          const idx = blocks.findIndex((b) => b.id === blockId);
          if (idx < 0) return s;
          const first = { ...incoming[0]!, id: blockId };
          blocks.splice(idx, 1, first, ...incoming.slice(1));
          return {
            pages: {
              ...s.pages,
              [pageId]: { ...page, blocks, updatedAt: Date.now() },
            },
          };
        });
      },
      updateBlock: (pageId, blockId, patch) =>
        set((s) => {
          const page = s.pages[pageId];
          if (!page) return s;
          return {
            pages: {
              ...s.pages,
              [pageId]: {
                ...page,
                updatedAt: Date.now(),
                blocks: page.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
              },
            },
          };
        }),
      replaceBlock: (pageId, blockId, next) =>
        set((s) => {
          const page = s.pages[pageId];
          if (!page) return s;
          return {
            pages: {
              ...s.pages,
              [pageId]: {
                ...page,
                updatedAt: Date.now(),
                blocks: page.blocks.map((b) => (b.id === blockId ? next : b)),
              },
            },
          };
        }),
      removeBlock: (pageId, blockId) =>
        set((s) => {
          const page = s.pages[pageId];
          if (!page) return s;
          let blocks = page.blocks.filter((b) => b.id !== blockId);
          if (blocks.length === 0) blocks = [emptyBlock("p")];
          return {
            pages: {
              ...s.pages,
              [pageId]: { ...page, blocks, updatedAt: Date.now() },
            },
          };
        }),
      moveBlock: (pageId, blockId, dir) =>
        set((s) => {
          const page = s.pages[pageId];
          if (!page) return s;
          const blocks = [...page.blocks];
          const i = blocks.findIndex((b) => b.id === blockId);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= blocks.length) return s;
          const tmp = blocks[i]!;
          blocks[i] = blocks[j]!;
          blocks[j] = tmp;
          return {
            pages: {
              ...s.pages,
              [pageId]: { ...page, blocks, updatedAt: Date.now() },
            },
          };
        }),
      importSnapshot: (data) => {
        if (!data?.pages || !data.order?.length) return;
        set({
          pages: data.pages,
          order: data.order,
          currentId: data.currentId && data.pages[data.currentId] ? data.currentId : data.order[0]!,
          theme: data.theme === "light" ? "light" : "dark",
          expanded: data.expanded ?? {},
        });
      },
      importMarkdown: (pageId, md) => {
        const parsed = markdownToBlocks(md);
        let title: string | undefined;
        let blocks = parsed;
        if (parsed[0]?.type === "h1" && parsed[0].content.trim()) {
          title = parsed[0].content.trim();
          blocks = parsed.slice(1);
        }
        if (blocks.length === 0) blocks = [emptyBlock("p")];
        set((s) => {
          const page = s.pages[pageId];
          if (!page) return s;
          return {
            pages: {
              ...s.pages,
              [pageId]: {
                ...page,
                title: title ?? page.title,
                blocks,
                updatedAt: Date.now(),
              },
            },
          };
        });
      },
      resetDemo: () => {
        const fresh = createSeed();
        set({
          pages: fresh.pages,
          order: fresh.order,
          currentId: fresh.order[0]!,
          expanded: { [fresh.order[2] ?? ""]: true },
          filterTag: null,
        });
      },
    }),
    {
      name: "daftar-notes-v2",
      skipHydration: true,
      partialize: (s) => ({
        pages: s.pages,
        order: s.order,
        currentId: s.currentId,
        theme: s.theme,
        expanded: s.expanded,
      }),
    },
  ),
);

export { nid };
