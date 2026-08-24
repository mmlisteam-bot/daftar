import { BookOpen, Lock } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { getRememberPref, getRememberedUsername, login, type SessionUser } from "@/lib/notes/session";
import { migrateOwnerImages } from "@/lib/notes/images";

export function LoginScreen({ onSuccess }: { onSuccess: (user: SessionUser) => void }) {
  const [username, setUsername] = useState(getRememberedUsername);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(getRememberPref);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await login(username, password, remember);
      if (!user) {
        setError("نام کاربری یا رمز اشتباه است.");
        return;
      }
      if (user.id === "mmli") await migrateOwnerImages().catch(() => {});
      onSuccess(user);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-dvh items-center justify-center bg-bg px-4">
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="w-full max-w-[380px] rounded-xl border border-border bg-surface p-6 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.45)]"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-surface-2">
            <BookOpen className="size-5" strokeWidth={1.75} />
          </div>
          <div>
            <div className="text-[20px] font-semibold tracking-tight">Daftar</div>
            <div className="text-[14px] text-muted">ورود به دفتر جزوه</div>
          </div>
        </div>

        <label className="mb-3 block">
          <span className="mb-1.5 block text-[14px] text-muted">نام کاربری</span>
          <input
            dir="ltr"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-11 w-full rounded-md border border-border bg-bg px-3 font-mono text-[15px] outline-none focus:ring-2 focus:ring-accent/40"
          />
        </label>

        <label className="mb-3 block">
          <span className="mb-1.5 block text-[14px] text-muted">رمز عبور</span>
          <input
            dir="ltr"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 w-full rounded-md border border-border bg-bg px-3 font-mono text-[15px] outline-none focus:ring-2 focus:ring-accent/40"
          />
        </label>

        <label className="mb-4 flex cursor-pointer select-none items-center gap-2 text-[15px] text-fg">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="size-4 accent-[var(--accent)]"
          />
          مرا به خاطر بسپار
        </label>

        {error ? <p className="mb-3 text-[15px] text-danger">{error}</p> : null}

        <Button type="submit" className="w-full" disabled={busy}>
          <Lock className="size-3.5" />
          {busy ? "در حال ورود…" : "ورود"}
        </Button>

        <p className="mt-4 text-[13px] leading-6 text-subtle">
          اگر تیک را بزنی، تا وقتی خروج نزنی دوباره لاگین نمی‌خواهد.
        </p>
      </form>
    </div>
  );
}
