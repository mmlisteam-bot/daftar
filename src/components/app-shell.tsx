import {
  Download,
  FileJson,
  FileText,
  Menu,
  Moon,
  Printer,
  RotateCcw,
  Sun,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Editor } from "@/components/editor";
import { SearchDialog } from "@/components/search-dialog";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { downloadText, pageToMarkdown } from "@/lib/notes/markdown";
import { useNotes } from "@/lib/notes/store";
import type { NotesSnapshot } from "@/lib/notes/types";

export function AppShell() {
  const setHydrated = useNotes((s) => s.setHydrated);
  const theme = useNotes((s) => s.theme);
  const setTheme = useNotes((s) => s.setTheme);
  const pages = useNotes((s) => s.pages);
  const currentId = useNotes((s) => s.currentId);
  const order = useNotes((s) => s.order);
  const expanded = useNotes((s) => s.expanded);
  const importSnapshot = useNotes((s) => s.importSnapshot);
  const importMarkdown = useNotes((s) => s.importMarkdown);
  const resetDemo = useNotes((s) => s.resetDemo);
  const [search, setSearch] = useState(false);
  const [menu, setMenu] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const done = () => setHydrated(true);
    const maybe = useNotes.persist.rehydrate();
    if (maybe && typeof (maybe as Promise<void>).then === "function") {
      void (maybe as Promise<void>).then(done, done);
    } else {
      done();
    }
  }, [setHydrated]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
  }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const page = pages[currentId];

  function exportMd() {
    if (!page) return;
    downloadText(`${page.title || "note"}.md`, pageToMarkdown(page), "text/markdown");
  }

  function exportJson() {
    const snap: NotesSnapshot = { pages, order, currentId, theme, expanded };
    downloadText("daftar-backup.json", JSON.stringify(snap, null, 2), "application/json");
  }

  function onImport(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result);
      if (/\.(md|markdown|txt)$/i.test(file.name) || (!file.name.endsWith(".json") && !raw.trim().startsWith("{"))) {
        if (page) importMarkdown(page.id, raw);
        return;
      }
      try {
        const data = JSON.parse(raw) as NotesSnapshot;
        importSnapshot(data);
      } catch {
        if (page) importMarkdown(page.id, raw);
        else alert("فایل پشتیبان معتبر نیست.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex h-dvh min-h-0 bg-bg text-fg">
      <div className="no-print hidden h-full w-[272px] shrink-0 border-e border-border md:block">
        <Sidebar onOpenSearch={() => setSearch(true)} />
      </div>

      {mobileNav ? (
        <div className="no-print fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-bg/70"
            aria-label="بستن"
            onClick={() => setMobileNav(false)}
          />
          <div className="absolute inset-y-0 start-0 w-[min(100%,280px)] border-e border-border">
            <Sidebar
              onOpenSearch={() => {
                setSearch(true);
                setMobileNav(false);
              }}
              onClose={() => setMobileNav(false)}
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
          <div className="min-w-0 flex-1 truncate px-2 text-[13px] text-muted">
            {page?.title ?? ""}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="تغییر پوسته"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <div className="relative">
            <Button variant="ghost" size="icon-sm" onClick={() => setMenu((v) => !v)} aria-label="خروجی">
              <Download className="size-4" />
            </Button>
            {menu ? (
              <div className="absolute end-0 z-20 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-start text-[13px] hover:bg-surface-2"
                  onClick={() => {
                    exportMd();
                    setMenu(false);
                  }}
                >
                  <Download className="size-3.5" />
                  خروجی Markdown
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
              </div>
            ) : null}
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Editor />
        </main>
      </div>

      <SearchDialog open={search} onOpenChange={setSearch} />
    </div>
  );
}
