import { FileJson, Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { applyBackupImages, downloadJsonBackup, parseBackupFile } from "@/lib/notes/backup";
import { useNotes } from "@/lib/notes/store";
import type { NotesSnapshot } from "@/lib/notes/types";

export function BackupPrompt({
  userName,
  open,
  onClose,
}: {
  userName: string;
  open: boolean;
  onClose: () => void;
}) {
  const pages = useNotes((s) => s.pages);
  const order = useNotes((s) => s.order);
  const currentId = useNotes((s) => s.currentId);
  const theme = useNotes((s) => s.theme);
  const expanded = useNotes((s) => s.expanded);
  const importSnapshot = useNotes((s) => s.importSnapshot);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  if (!open) return null;

  const snapshot: NotesSnapshot = { pages, order, currentId, theme, expanded };

  async function saveBackup() {
    setBusy(true);
    setMsg("");
    try {
      await downloadJsonBackup(snapshot, userName);
      setMsg("فایل ذخیره شد. جای امن نگهش دار.");
      setTimeout(onClose, 900);
    } catch {
      setMsg("ذخیره نشد. دوباره تلاش کن.");
    } finally {
      setBusy(false);
    }
  }

  async function restore(file: File) {
    setBusy(true);
    setMsg("");
    try {
      const parsed = parseBackupFile(await file.text());
      if (!parsed) {
        setMsg("این فایل پشتیبان معتبر نیست.");
        return;
      }
      if (parsed.images) {
        await applyBackupImages({
          kind: "daftar-backup",
          version: 2,
          savedAt: Date.now(),
          user: userName,
          snapshot: parsed.snapshot,
          images: parsed.images,
        });
      }
      importSnapshot(parsed.snapshot);
      setMsg("بازیابی شد.");
      setTimeout(onClose, 700);
    } catch {
      setMsg("بازیابی نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[420px] rounded-xl border border-border bg-surface p-5 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.5)]">
        <div className="text-[16px] font-semibold">پشتیبان جزوه</div>
        <p className="mt-2 text-[13px] leading-6 text-muted">
          نوت‌های <span className="text-fg">{userName}</span> فقط روی همین مرورگر است. همین الان یک
          فایل JSON ذخیره کن. اگر لپ‌تاپ عوض شد یا کش پاک شد، همان فایل را از اینجا آپلود می‌کنی.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Button onClick={() => void saveBackup()} disabled={busy} className="w-full">
            <FileJson className="size-3.5" />
            {busy ? "در حال ذخیره…" : "دانلود فایل JSON"}
          </Button>
          <label className="flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-border text-sm hover:bg-surface-2">
            <Upload className="size-3.5" />
            بازیابی از فایل ذخیره‌شده
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void restore(f);
              }}
            />
          </label>
          <button
            type="button"
            className="h-9 text-[13px] text-muted hover:text-fg"
            onClick={onClose}
          >
            الان نه — بعداً از منوی خروجی
          </button>
        </div>
        {msg ? <p className="mt-3 text-[12px] text-ok">{msg}</p> : null}
        <p className="mt-3 text-[11px] leading-5 text-subtle">
          میانبر: Ctrl+S برای ذخیرهٔ پشتیبان · Ctrl+Z برگشت از پیست اشتباه
        </p>
      </div>
    </div>
  );
}
