import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HadisWelcome({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-bg/80 px-4 backdrop-blur-[6px]">
      <div className="flex w-full max-w-sm flex-col items-center rounded-2xl border border-border bg-surface px-8 py-10 text-center shadow-[0_24px_80px_-32px_rgba(0,0,0,0.5)]">
        <Heart
          className="hadis-heart size-16"
          fill="currentColor"
          strokeWidth={1.5}
          aria-hidden
        />
        <h1 className="mt-6 text-[22px] font-semibold tracking-tight">حدیث</h1>
        <p className="mt-2 max-w-[16rem] text-[14px] leading-7 text-muted">
          خوش اومدی. این دفتر خودته.
          <br />
          هر وقت خواستی، جزوه‌ات را بنویس.
        </p>
        <Button className="mt-7" onClick={onContinue}>
          بریم سراغ جزوه
        </Button>
      </div>
    </div>
  );
}
