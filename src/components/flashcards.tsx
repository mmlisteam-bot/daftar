import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cardsFromScope, type StudyCard } from "@/lib/notes/cards";
import { useNotes } from "@/lib/notes/store";
import { cn } from "@/lib/utils";

export function Flashcards({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pages = useNotes((s) => s.pages);
  const currentId = useNotes((s) => s.currentId);
  const setCurrent = useNotes((s) => s.setCurrent);
  const [scope, setScope] = useState<"page" | "all">("page");
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const cards = useMemo(
    () => cardsFromScope(pages, currentId, scope),
    [pages, currentId, scope],
  );

  if (!open) return null;

  const card: StudyCard | undefined = cards[i] ?? cards[0];
  const index = cards.length ? Math.min(i, cards.length - 1) : 0;

  function go(delta: number) {
    if (!cards.length) return;
    setFlipped(false);
    setI((v) => (v + delta + cards.length) % cards.length);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/75 px-4 backdrop-blur-[2px]">
      <div className="flex w-full max-w-lg flex-col rounded-xl border border-border bg-surface p-4 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.5)]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-[15px] font-semibold">فلش‌کارت</div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="بستن">
            <X className="size-4" />
          </Button>
        </div>
        <div className="mb-3 flex gap-1">
          {(["page", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={cn(
                "h-8 rounded-md px-3 text-[12px]",
                scope === s ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted",
              )}
              onClick={() => {
                setScope(s);
                setI(0);
                setFlipped(false);
              }}
            >
              {s === "page" ? "همین صفحه" : "همهٔ جزوه"}
            </button>
          ))}
        </div>
        {cards.length === 0 ? (
          <p className="py-10 text-center text-[13px] leading-6 text-muted">
            کارتی نیست. تیتر بگذار و زیرش توضیح بنویس، یا تودو بساز.
          </p>
        ) : (
          <>
            <div className="mb-2 text-[11px] text-subtle">
              {index + 1} از {cards.length}
              {card ? ` · ${card.pageTitle}` : ""}
            </div>
            <button
              type="button"
              className="min-h-44 rounded-lg border border-border bg-bg px-4 py-6 text-center"
              onClick={() => setFlipped((v) => !v)}
            >
              <div className="text-[11px] text-subtle">{flipped ? "جواب" : "سؤال — برای دیدن جواب بزن"}</div>
              <div className="mt-3 whitespace-pre-wrap text-[17px] font-medium leading-7">
                {flipped ? card?.back : card?.front}
              </div>
            </button>
            <div className="mt-3 flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => go(-1)}>
                <ChevronRight className="size-4" />
                قبلی
              </Button>
              <button
                type="button"
                className="text-[12px] text-muted hover:text-fg"
                onClick={() => {
                  if (card) {
                    setCurrent(card.pageId, card.id.split(":")[1]);
                    onClose();
                  }
                }}
              >
                رفتن به جزوه
              </button>
              <Button variant="ghost" size="sm" onClick={() => go(1)}>
                بعدی
                <ChevronLeft className="size-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
