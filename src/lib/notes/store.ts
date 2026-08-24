import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { markdownToBlocks } from "./parse";
import { createSeed } from "./seed";
import { getActiveUserId } from "./session";
import { SQLI_EXPAND } from "./sqli-ref";
import { pageFromTemplate, type PageTemplate } from "./templates";
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

function blankWorkspace(): { pages: Record<string, Page>; order: string[] } {
  const page = emptyPage({ title: "", icon: "file" });
  return { pages: { [page.id]: page }, order: [page.id] };
}

function workspaceForUser() {
  return getActiveUserId() === "hadis" ? blankWorkspace() : createSeed();
}

type Slice = Pick<NotesSnapshot, "pages" | "order" | "currentId" | "expanded" | "trash">;

const TRASH_MS = 7 * 24 * 60 * 60 * 1000;

const past: Slice[] = [];
const future: Slice[] = [];
let muted = false;
let typingBurst = false;
let typingTimer: ReturnType<typeof setTimeout> | null = null;

function cloneSlice(s: Slice): Slice {
  return JSON.parse(
    JSON.stringify({
      pages: s.pages,
      order: s.order,
      currentId: s.currentId,
      expanded: s.expanded,
      trash: s.trash ?? {},
    }),
  ) as Slice;
}

function clearHistory() {
  past.length = 0;
  future.length = 0;
  typingBurst = false;
  if (typingTimer) clearTimeout(typingTimer);
}

type NotesState = NotesSnapshot & {
  filterTag: string | null;
  hydrated: boolean;
  histRev: number;
  scrollToBlock: string | null;
  trash: Record<string, Page>;
  recentIds: string[];
  setHydrated: (v: boolean) => void;
  setTheme: (t: "dark" | "light") => void;
  setCurrent: (id: string, blockId?: string | null) => void;
  setFilterTag: (tag: string | null) => void;
  toggleExpanded: (id: string) => void;
  toggleStar: (id: string) => void;
  createPage: (opts?: { parentId?: string | null; title?: string; icon?: PageIcon }) => string;
  createFromTemplate: (tpl: PageTemplate, parentId?: string | null) => string;
  duplicatePage: (id: string) => string | null;
  deletePage: (id: string) => void;
  restorePage: (id: string) => void;
  purgeTrash: () => void;
  dropForever: (id: string) => void;
  movePage: (dragId: string, targetId: string, pos: "before" | "after" | "inside") => void;
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
  reorderBlocks: (pageId: string, fromId: string, toId: string) => void;
  importSnapshot: (data: NotesSnapshot) => void;
  importMarkdown: (pageId: string, md: string) => void;
  resetDemo: () => void;
  primeWorkspace: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
};

function childrenOf(pages: Record<string, Page>, parentId: string): Page[] {
  return Object.values(pages)
    .filter((p) => p.parentId === parentId)
    .sort((a, b) => (a.sort ?? a.createdAt) - (b.sort ?? b.createdAt));
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
    .sort((a, b) => (a.sort ?? a.createdAt) - (b.sort ?? b.createdAt));
}

function clonePageRecord(page: Page, titleSuffix = " (کپی)"): Page {
  const now = Date.now();
  return {
    ...page,
    id: nid(),
    title: page.title ? `${page.title}${titleSuffix}` : "کپی",
    starred: false,
    createdAt: now,
    updatedAt: now,
    sort: now,
    blocks: page.blocks.map((b) => ({
      ...b,
      id: nid(),
      headers: b.headers ? [...b.headers] : undefined,
      rows: b.rows ? b.rows.map((r) => [...r]) : undefined,
    })),
  };
}

export function trashDaysLeft(deletedAt: number): number {
  return Math.max(0, Math.ceil((deletedAt + TRASH_MS - Date.now()) / 86_400_000));
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
    (set, get) => {
      const capture = () => {
        if (muted) return;
        past.push(cloneSlice(get()));
        if (past.length > 50) past.shift();
        future.length = 0;
        set({ histRev: get().histRev + 1 });
      };

      const captureTyping = () => {
        if (muted) return;
        if (!typingBurst) {
          capture();
          typingBurst = true;
        }
        if (typingTimer) clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
          typingBurst = false;
        }, 800);
      };

      return {
        pages: seed.pages,
        order: seed.order,
        currentId: seed.order[0]!,
        theme: "dark",
        expanded: { ...SQLI_EXPAND },
        filterTag: null,
        hydrated: false,
        histRev: 0,
        scrollToBlock: null,
        trash: {},
        recentIds: [],
        setHydrated: (v) => set({ hydrated: v }),
        setTheme: (theme) => set({ theme }),
        setCurrent: (id, blockId) => {
          const recents = [id, ...get().recentIds.filter((x) => x !== id && get().pages[x])].slice(0, 5);
          set({
            currentId: id,
            filterTag: get().filterTag,
            scrollToBlock: blockId ?? null,
            recentIds: recents,
          });
        },
        setFilterTag: (filterTag) => set({ filterTag }),
        toggleExpanded: (id) =>
          set((s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),
        toggleStar: (id) =>
          set((s) => {
            const page = s.pages[id];
            if (!page) return s;
            return {
              pages: {
                ...s.pages,
                [id]: { ...page, starred: !page.starred, updatedAt: Date.now() },
              },
            };
          }),
        createPage: (opts) => {
          capture();
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
        createFromTemplate: (tpl, parentId = null) => {
          capture();
          const page = pageFromTemplate(tpl, parentId);
          set((s) => {
            const pages = { ...s.pages, [page.id]: page };
            const order = parentId ? s.order : [...s.order, page.id];
            const expanded = parentId ? { ...s.expanded, [parentId]: true } : s.expanded;
            return { pages, order, expanded, currentId: page.id };
          });
          return page.id;
        },
        deletePage: (id) => {
          const { pages, order, currentId, trash } = get();
          if (!pages[id] || Object.keys(pages).length <= 1) return;
          capture();
          const ids = [id, ...descendants(pages, id)];
          const now = Date.now();
          const nextPages = { ...pages };
          const nextTrash = { ...trash };
          for (const d of ids) {
            const p = nextPages[d];
            if (!p) continue;
            nextTrash[d] = { ...p, deletedAt: now };
            delete nextPages[d];
          }
          const nextOrder = order.filter((x) => !ids.includes(x));
          let nextCurrent = currentId;
          if (ids.includes(currentId)) {
            nextCurrent = nextOrder[0] ?? Object.keys(nextPages)[0]!;
          }
          set({
            pages: nextPages,
            order: nextOrder,
            currentId: nextCurrent,
            trash: nextTrash,
            recentIds: get().recentIds.filter((x) => !ids.includes(x)),
          });
        },
        restorePage: (id) => {
          const { pages, order, trash } = get();
          const item = trash[id];
          if (!item) return;
          capture();
          const now = Date.now();
          const nextTrash = { ...trash };
          delete nextTrash[id];
          const parentOk = item.parentId && pages[item.parentId];
          const restored: Page = {
            ...item,
            deletedAt: undefined,
            parentId: parentOk ? item.parentId : null,
            updatedAt: now,
          };
          const nextOrder = restored.parentId ? order : [...order, restored.id];
          set({
            pages: { ...pages, [restored.id]: restored },
            order: nextOrder,
            trash: nextTrash,
            currentId: restored.id,
            expanded: restored.parentId
              ? { ...get().expanded, [restored.parentId]: true }
              : get().expanded,
          });
        },
        dropForever: (id) => {
          const { trash } = get();
          if (!trash[id]) return;
          capture();
          const next = { ...trash };
          delete next[id];
          set({ trash: next });
        },
        purgeTrash: () => {
          const { trash } = get();
          const cutoff = Date.now() - TRASH_MS;
          const next: Record<string, Page> = {};
          let changed = false;
          for (const [id, p] of Object.entries(trash)) {
            if ((p.deletedAt ?? 0) >= cutoff) next[id] = p;
            else changed = true;
          }
          if (changed) set({ trash: next });
        },
        duplicatePage: (id) => {
          const { pages, order } = get();
          const src = pages[id];
          if (!src) return null;
          capture();
          const copy = clonePageRecord(src);
          copy.parentId = src.parentId;
          if (src.parentId === null) {
            const nextOrder = [...order];
            const i = nextOrder.indexOf(id);
            nextOrder.splice(i < 0 ? nextOrder.length : i + 1, 0, copy.id);
            set({ pages: { ...pages, [copy.id]: copy }, order: nextOrder, currentId: copy.id });
          } else {
            copy.sort = (src.sort ?? src.createdAt) + 1;
            set({
              pages: { ...pages, [copy.id]: copy },
              currentId: copy.id,
              expanded: { ...get().expanded, [src.parentId]: true },
            });
          }
          return copy.id;
        },
        movePage: (dragId, targetId, pos) => {
          if (dragId === targetId) return;
          const { pages, order } = get();
          const drag = pages[dragId];
          const target = pages[targetId];
          if (!drag || !target) return;
          const desc = descendants(pages, dragId);
          if (desc.includes(targetId)) return;
          if (pos === "inside" && (dragId === targetId || desc.includes(targetId))) return;
          const nextParent = pos === "inside" ? targetId : target.parentId;
          if (nextParent && (nextParent === dragId || desc.includes(nextParent))) return;
          capture();
          const nextPages: Record<string, Page> = { ...pages };
          let nextOrder = order.filter((id) => id !== dragId);
          const now = Date.now();
          nextPages[dragId] = { ...drag, parentId: nextParent, updatedAt: now, sort: now };

          if (nextParent === null) {
            const ti = nextOrder.indexOf(targetId);
            if (ti < 0) nextOrder.push(dragId);
            else nextOrder.splice(pos === "before" ? ti : ti + 1, 0, dragId);
          } else if (pos === "inside") {
            const kids = Object.values(nextPages).filter(
              (p) => p.parentId === nextParent && p.id !== dragId,
            );
            nextPages[dragId] = {
              ...nextPages[dragId]!,
              sort: Math.max(0, ...kids.map((k) => k.sort ?? k.createdAt)) + 1000,
            };
          } else {
            const siblings = Object.values(nextPages)
              .filter((p) => p.parentId === nextParent && p.id !== dragId)
              .sort((a, b) => (a.sort ?? a.createdAt) - (b.sort ?? b.createdAt));
            const ti = siblings.findIndex((p) => p.id === targetId);
            const arranged = [...siblings];
            arranged.splice(Math.max(0, pos === "before" ? ti : ti + 1), 0, nextPages[dragId]!);
            arranged.forEach((p, i) => {
              nextPages[p.id] = { ...nextPages[p.id]!, sort: (i + 1) * 1000 };
            });
          }

          set({
            pages: nextPages,
            order: nextOrder,
            expanded: pos === "inside" ? { ...get().expanded, [targetId]: true } : get().expanded,
          });
        },
        updatePage: (id, patch) => {
          captureTyping();
          set((s) => {
            const page = s.pages[id];
            if (!page) return s;
            return {
              pages: {
                ...s.pages,
                [id]: { ...page, ...patch, updatedAt: Date.now() },
              },
            };
          });
        },
        addTag: (id, tag) => {
          const t = tag.trim();
          if (!t) return;
          const page = get().pages[id];
          if (!page || page.tags.includes(t)) return;
          capture();
          get().updatePage(id, { tags: [...page.tags, t] });
        },
        removeTag: (id, tag) => {
          const page = get().pages[id];
          if (!page) return;
          capture();
          get().updatePage(id, { tags: page.tags.filter((x) => x !== tag) });
        },
        insertBlock: (pageId, afterId, type = "p") => {
          capture();
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
          capture();
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
          capture();
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
        updateBlock: (pageId, blockId, patch) => {
          captureTyping();
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
          });
        },
        replaceBlock: (pageId, blockId, next) => {
          capture();
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
          });
        },
        removeBlock: (pageId, blockId) => {
          capture();
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
          });
        },
        moveBlock: (pageId, blockId, dir) => {
          capture();
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
          });
        },
        reorderBlocks: (pageId, fromId, toId) => {
          if (fromId === toId) return;
          capture();
          set((s) => {
            const page = s.pages[pageId];
            if (!page) return s;
            const blocks = [...page.blocks];
            const from = blocks.findIndex((b) => b.id === fromId);
            const to = blocks.findIndex((b) => b.id === toId);
            if (from < 0 || to < 0) return s;
            const [item] = blocks.splice(from, 1);
            blocks.splice(to, 0, item!);
            return {
              pages: {
                ...s.pages,
                [pageId]: { ...page, blocks, updatedAt: Date.now() },
              },
            };
          });
        },
        importSnapshot: (data) => {
          if (!data?.pages || !data.order?.length) return;
          capture();
          set({
            pages: data.pages,
            order: data.order,
            currentId: data.currentId && data.pages[data.currentId] ? data.currentId : data.order[0]!,
            theme: data.theme === "light" ? "light" : "dark",
            expanded: data.expanded ?? {},
            trash: data.trash ?? {},
            recentIds: data.recentIds ?? get().recentIds,
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
          capture();
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
          capture();
          const fresh = workspaceForUser();
          set({
            pages: fresh.pages,
            order: fresh.order,
            currentId: fresh.order[0]!,
            expanded: getActiveUserId() === "hadis" ? {} : { ...SQLI_EXPAND },
            filterTag: null,
            trash: {},
          });
        },
        primeWorkspace: () => {
          clearHistory();
          const fresh = workspaceForUser();
          set({
            pages: fresh.pages,
            order: fresh.order,
            currentId: fresh.order[0]!,
            theme: "dark",
            expanded: getActiveUserId() === "hadis" ? {} : { ...SQLI_EXPAND },
            filterTag: null,
            hydrated: false,
            histRev: 0,
            trash: {},
            scrollToBlock: null,
            recentIds: [],
          });
        },
        undo: () => {
          if (!past.length) return;
          muted = true;
          future.push(cloneSlice(get()));
          const prev = past.pop()!;
          set({ ...prev, histRev: get().histRev + 1 });
          muted = false;
        },
        redo: () => {
          if (!future.length) return;
          muted = true;
          past.push(cloneSlice(get()));
          const next = future.pop()!;
          set({ ...next, histRev: get().histRev + 1 });
          muted = false;
        },
        canUndo: () => past.length > 0,
        canRedo: () => future.length > 0,
      };
    },
    {
      name: "daftar-notes-v2",
      skipHydration: true,
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          if (typeof localStorage === "undefined") return null;
          return localStorage.getItem(`${name}:${getActiveUserId()}`);
        },
        setItem: (name, value) => {
          localStorage.setItem(`${name}:${getActiveUserId()}`, value);
        },
        removeItem: (name) => {
          localStorage.removeItem(`${name}:${getActiveUserId()}`);
        },
      })),
      partialize: (s) => ({
        pages: s.pages,
        order: s.order,
        currentId: s.currentId,
        theme: s.theme,
        expanded: s.expanded,
        trash: s.trash ?? {},
        recentIds: s.recentIds ?? [],
      }),
    },
  ),
);

export { nid };
