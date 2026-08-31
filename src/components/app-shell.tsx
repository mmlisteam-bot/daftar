import {
  Download,
  FileArchive,
  FileJson,
  FileText,
  Layers,
  Menu,
  Moon,
  Printer,
  Redo2,
  RotateCcw,
  Sun,
  Tag,
  Trash2,
  Undo2,
  Upload,
  Wand2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { BackupPrompt } from "@/components/backup-prompt";
import { Editor } from "@/components/editor";
import { Flashcards } from "@/components/flashcards";
import { HadisWelcome } from "@/components/hadis-welcome";
import { LoginScreen } from "@/components/login-screen";
import { PayloadPanel } from "@/components/payload-panel";
import { PageGlyph } from "@/components/page-icon";
import { SearchDialog } from "@/components/search-dialog";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { applyBackupImages, downloadAllZip, downloadJsonBackup, parseBackupFile } from "@/lib/notes/backup";
import { SQLI_REF_FLAG, applySqliRef } from "@/lib/notes/sqli-ref";
import { downloadText, pageToMarkdown } from "@/lib/notes/markdown";
import { getSession, logout, markHadisHelloSeen, notesStorageKey, setActiveUserId, shouldShowHadisHello, type SessionUser } from "@/lib/notes/session";
import { allTags, trashDaysLeft, useNotes } from "@/lib/notes/store";
import type { NotesSnapshot } from "@/lib/notes/types";

export function AppShell() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (s) setActiveUserId(s.id);
    setUser(s);
    setReady(true);
    if ("serviceWorker" in navigator) {
      const sw = `${import.meta.env.BASE_URL}sw.js`.replace(/\/{2,}/g, "/");
      void navigator.serviceWorker.register(sw).catch(() => {});
    }
  }, []);

  if (!ready) return <div className="h-dvh bg-bg" />;
  if (!user) return <LoginScreen onSuccess={setUser} />;
  return (
    <NotesWorkspace
      user={user}
      onLogout={() => {
        logout();
        setUser(null);
      }}
    />
  );
}

function NotesWorkspace({
  user,
  onLogout,
}: {
  user: SessionUser;
  onLogout: () => void;
}) {
  const setHydrated = useNotes((s) => s.setHydrated);
  const hydrated = useNotes((s) => s.hydrated);
  const theme = useNotes((s) => s.theme);
  const setTheme = useNotes((s) => s.setTheme);
  const pages = useNotes((s) => s.pages);
  const currentId = useNotes((s) => s.currentId);
  const order = useNotes((s) => s.order);
  const expanded = useNotes((s) => s.expanded);
  const trash = useNotes((s) => s.trash);
  const importSnapshot = useNotes((s) => s.importSnapshot);
  const importMarkdown = useNotes((s) => s.importMarkdown);
  const resetDemo = useNotes((s) => s.resetDemo);
  const primeWorkspace = useNotes((s) => s.primeWorkspace);
  const undo = useNotes((s) => s.undo);
  const redo = useNotes((s) => s.redo);
  const histRev = useNotes((s) => s.histRev);
  const filterTag = useNotes((s) => s.filterTag);
  const setFilterTag = useNotes((s) => s.setFilterTag);
  const restorePage = useNotes((s) => s.restorePage);
  const dropForever = useNotes((s) => s.dropForever);
  const addTag = useNotes((s) => s.addTag);
  const [search, setSearch] = useState(false);
  const [menu, setMenu] = useState(false);
  const [tagMenu, setTagMenu] = useState(false);
  const [trashMenu, setTrashMenu] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [payloads, setPayloads] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [cards, setCards] = useState(false);
  const [hadisHi, setHadisHi] = useState(() => shouldShowHadisHello(user.id));

  useEffect(() => {
    let live = true;
    async function boot() {
      setActiveUserId(user.id);
      const stored = typeof localStorage !== "undefined" ? localStorage.getItem(notesStorageKey(user.id)) : null;
      if (stored) {
        await useNotes.persist.rehydrate();
      } else {
        primeWorkspace();
      }
      useNotes.getState().purgeTrash();
      if (user.id === "mmli" && !localStorage.getItem(SQLI_REF_FLAG)) {
        const s = useNotes.getState();
        const next = applySqliRef(s.pages, s.order, s.expanded);
        useNotes.setState({
          pages: next.pages,
          order: next.order,
          expanded: next.expanded,
        });
        localStorage.setItem(SQLI_REF_FLAG, "1");
      }
      if (live) setHydrated(true);
    }
    void boot();
    return () => {
      live = false;
    };
  }, [setHydrated, primeWorkspace, user.id]);

  useEffect(() => {
    if (!hydrated) return;
    if (hadisHi) return;
    const key = `daftar-backup-nag:${user.id}`;
    if (sessionStorage.getItem(key)) return;
    setBackupOpen(true);
  }, [hydrated, user.id, hadisHi]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
    const color = theme === "light" ? "#efe8dc" : "#131210";
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", color);
  }, [theme]);

  const snapshot: NotesSnapshot = { pages, order, currentId, theme, expanded, trash, recentIds: useNotes.getState().recentIds };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const k = e.key.toLowerCase();
      if (k === "k") {
        e.preventDefault();
        setSearch(true);
        return;
      }
      const s = useNotes.getState();
      const snap: NotesSnapshot = {
        pages: s.pages,
        order: s.order,
        currentId: s.currentId,
        theme: s.theme,
        expanded: s.expanded,
        trash: s.trash,
      };
      if (k === "s") {
        e.preventDefault();
        void downloadJsonBackup(snap, user.username);
      }
      if (k === "p") {
        e.preventDefault();
        window.print();
      }
      if (k === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      }
      if (k === "y") {
        e.preventDefault();
        s.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [user.username]);

  const page = pages[currentId];
  const canUndo = histRev >= 0 && useNotes.getState().canUndo();
  const canRedo = histRev >= 0 && useNotes.getState().canRedo();
  const tags = allTags(pages);
  const trashList = Object.values(trash ?? {}).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));

  function convertMarkdownOnPage() {
    if (!page) return;
    importMarkdown(page.id, pageToMarkdown(page));
  }

  function exportMd() {
    if (!page) return;
    downloadText(`${page.title || "note"}.md`, pageToMarkdown(page), "text/markdown");
  }

  function exportJson() {
    void downloadJsonBackup(snapshot, user.username);
  }

  function onImport(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result);
      if (/\.(md|markdown|txt)$/i.test(file.name) || (!file.name.endsWith(".json") && !raw.trim().startsWith("{"))) {
        if (page) importMarkdown(page.id, raw);
        return;
      }
      const parsed = parseBackupFile(raw);
      if (!parsed) {
        if (page) importMarkdown(page.id, raw);
        else alert("فایل پشتیبان معتبر نیست.");
        return;
      }
      void (async () => {
        if (parsed.images) {
          await applyBackupImages({
            kind: "daftar-backup",
            version: 2,
            savedAt: Date.now(),
            user: user.username,
            snapshot: parsed.snapshot,
            images: parsed.images,
          });
        }
        importSnapshot(parsed.snapshot);
      })();
    };
    reader.readAsText(file);
  }

  function closeBackup() {
    sessionStorage.setItem(`daftar-backup-nag:${user.id}`, "1");
    setBackupOpen(false);
  }

  if (!hydrated) {
    return (
      <div className="flex h-dvh items-center justify-center bg-bg text-[14px] text-muted">
        در حال خواندن دفتر…
      </div>
    );
  }

  return (
    <div className="flex h-dvh min-h-0 bg-bg text-fg">
      <div className="no-print hidden h-full w-[300px] shrink-0 border-e border-border md:block">
        <Sidebar
          onOpenSearch={() => setSearch(true)}
          userName={user.name}
          heart={user.id === "hadis"}
          onLogout={onLogout}
          onOpenPayloads={() => setPayloads(true)}
        />
      </div>

      {mobileNav ? (
        <div className="no-print fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-bg/70"
            aria-label="بستن"
            onClick={() => setMobileNav(false)}
          />
          <div className="absolute inset-y-0 start-0 w-[min(100%,320px)] border-e border-border">
            <Sidebar
              compact
              onOpenSearch={() => {
                setSearch(true);
                setMobileNav(false);
              }}
              onClose={() => setMobileNav(false)}
              userName={user.name}
              heart={user.id === "hadis"}
              onLogout={onLogout}
              onOpenPayloads={() => {
                setPayloads(true);
                setMobileNav(false);
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex h-12 shrink-0 items-center gap-1 border-b border-border px-2">
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setMobileNav(true)}
            aria-label="منو"
          >
            <Menu className="size-4" />
          </Button>
          <div className="min-w-0 flex-1 truncate px-2 text-[15px] text-muted">
            {page?.title ?? ""}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCards(true)}
            aria-label="فلش‌کارت"
            title="فلش‌کارت"
          >
            <Layers className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => undo()}
            disabled={!canUndo}
            aria-label="واگرد"
            title="Ctrl+Z"
          >
            <Undo2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => redo()}
            disabled={!canRedo}
            aria-label="از نو"
            title="Ctrl+Shift+Z"
          >
            <Redo2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="تغییر پوسته"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setMenu((v) => !v);
                setTagMenu(false);
                setTrashMenu(false);
              }}
              aria-label="خروجی"
            >
              <Download className="size-4" />
            </Button>
            {menu ? (
              <div className="absolute end-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-start text-[13px] hover:bg-surface-2"
                  onClick={() => {
                    exportMd();
                    setMenu(false);
                  }}
                >
                  <Download className="size-3.5" />
                  خروجی Markdown این صفحه
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-start text-[13px] hover:bg-surface-2"
                  onClick={() => {
                    window.print();
                    setMenu(false);
                  }}
                >
                  <Printer className="size-3.5" />
                  چاپ / PDF
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-start text-[13px] hover:bg-surface-2"
                  onClick={() => {
                    exportJson();
                    setMenu(false);
                  }}
                >
                  <FileJson className="size-3.5" />
                  پشتیبان JSON
                  <kbd className="ms-auto font-mono text-[10px] text-subtle">Ctrl S</kbd>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-start text-[13px] hover:bg-surface-2"
                  onClick={() => {
                    void downloadAllZip(snapshot, user.username);
                    setMenu(false);
                  }}
                >
                  <FileArchive className="size-3.5" />
                  ZIP همهٔ صفحات
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-start text-[13px] hover:bg-surface-2"
                  onClick={() => {
                    convertMarkdownOnPage();
                    setMenu(false);
                  }}
                >
                  <Wand2 className="size-3.5" />
                  تبدیل Markdown همین صفحه
                </button>
                <label className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-[13px] hover:bg-surface-2">
                  <FileText className="size-3.5" />
                  ورود Markdown
                  <input
                    type="file"
                    accept=".md,.markdown,.txt,text/markdown,text/plain"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f && page) {
                        void f.text().then((md) => importMarkdown(page.id, md));
                      }
                      setMenu(false);
                    }}
                  />
                </label>
                <label className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-[13px] hover:bg-surface-2">
                  <Upload className="size-3.5" />
                  بازیابی پشتیبان
                  <input
                    type="file"
                    accept="application/json,.md,.markdown,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onImport(f);
                      setMenu(false);
                    }}
                  />
                </label>
                {user.id === "mmli" ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-start text-[13px] text-danger hover:bg-surface-2"
                    onClick={() => {
                      if (confirm("بازگشت به جزوه نمونه؟ نوت‌های فعلی جایگزین می‌شوند.")) resetDemo();
                      setMenu(false);
                    }}
                  >
                    <RotateCcw className="size-3.5" />
                    جزوه نمونه
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setTagMenu((v) => !v);
                setMenu(false);
                setTrashMenu(false);
              }}
              aria-label="تگ‌ها"
              title="تگ‌ها"
              className={filterTag ? "text-accent" : undefined}
            >
              <Tag className="size-4" />
            </Button>
            {tagMenu ? (
              <div className="absolute end-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
                <div className="px-3 py-1.5 text-[11px] font-medium text-subtle">تگ‌ها</div>
                {tags.length === 0 ? (
                  <div className="px-3 py-2 text-[12px] text-subtle">هنوز تگی نیست. زیر عنوان صفحه بساز.</div>
                ) : (
                  tags.map(({ tag, count }) => {
                    const on = filterTag === tag;
                    return (
                      <button
                        key={tag}
                        type="button"
                        className={`flex w-full items-center gap-2 px-3 py-2 text-start text-[13px] hover:bg-surface-2 ${on ? "bg-surface-2 text-fg" : ""}`}
                        onClick={() => {
                          setFilterTag(on ? null : tag);
                          setTagMenu(false);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "copy";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const raw = e.dataTransfer.getData("text/plain");
                          const id = raw.startsWith("daftar-page:") ? raw.slice("daftar-page:".length) : raw;
                          if (id) addTag(id, tag);
                        }}
                      >
                        <Tag className="size-3.5 shrink-0 opacity-70" />
                        <span className="min-w-0 flex-1 truncate">{tag}</span>
                        <span className="text-[11px] text-subtle">{count}</span>
                      </button>
                    );
                  })
                )}
                {filterTag ? (
                  <button
                    type="button"
                    className="flex w-full px-3 py-2 text-start text-[12px] text-muted hover:bg-surface-2 hover:text-fg"
                    onClick={() => {
                      setFilterTag(null);
                      setTagMenu(false);
                    }}
                  >
                    پاک کردن فیلتر
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setTrashMenu((v) => !v);
                setMenu(false);
                setTagMenu(false);
              }}
              aria-label="سطل زباله"
              title="سطل زباله"
              className="relative"
            >
              <Trash2 className="size-4" />
              {trashList.length ? (
                <span className="absolute -end-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-danger text-[9px] text-white">
                  {trashList.length > 9 ? "9+" : trashList.length}
                </span>
              ) : null}
            </Button>
            {trashMenu ? (
              <div className="absolute end-0 z-20 mt-1 w-64 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
                <div className="px-3 py-1.5 text-[11px] font-medium text-subtle">سطل زباله · ۷ روز</div>
                {trashList.length === 0 ? (
                  <div className="px-3 py-2 text-[12px] text-subtle">خالی است.</div>
                ) : (
                  trashList.map((p) => (
                    <div key={p.id} className="flex items-center gap-1 px-2 py-1.5 text-[13px] text-muted">
                      <PageGlyph name={p.icon} className="size-3.5 shrink-0 opacity-70" />
                      <span className="min-w-0 flex-1 truncate">{p.title || "بدون عنوان"}</span>
                      <span className="text-[10px] text-subtle">{trashDaysLeft(p.deletedAt ?? 0)}ر</span>
                      <button
                        type="button"
                        className="flex size-6 items-center justify-center rounded hover:bg-surface-2 hover:text-fg"
                        title="برگرداندن"
                        onClick={() => restorePage(p.id)}
                      >
                        <RotateCcw className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="flex size-6 items-center justify-center rounded hover:bg-surface-2 hover:text-danger"
                        title="حذف دائمی"
                        onClick={() => {
                          if (confirm("برای همیشه حذف شود؟")) dropForever(p.id);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Editor />
        </main>
      </div>

      <SearchDialog open={search} onOpenChange={setSearch} />
      <PayloadPanel open={payloads} onClose={() => setPayloads(false)} />
      <Flashcards open={cards} onClose={() => setCards(false)} />
      {hadisHi ? (
        <HadisWelcome
          onContinue={() => {
            markHadisHelloSeen();
            setHadisHi(false);
          }}
        />
      ) : null}
      <BackupPrompt userName={user.username} open={backupOpen} onClose={closeBackup} />
    </div>
  );
}
