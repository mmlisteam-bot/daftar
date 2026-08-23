import { Check, Copy, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PAYLOAD_GROUPS, type PayloadItem } from "@/lib/notes/payloads";
import { emptyBlock, nid } from "@/lib/notes/types";
import { useNotes } from "@/lib/notes/store";

export function PayloadPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const currentId = useNotes((s) => s.currentId);
  const pages = useNotes((s) => s.pages);
  const insertBlocks = useNotes((s) => s.insertBlocks);
  const [copied, setCopied] = useState<string | null>(null);
  const page = pages[currentId];

  if (!open) return null;

  async function copyItem(item: PayloadItem) {
    await navigator.clipboard.writeText(item.code);
    setCopied(item.id);
    setTimeout(() => setCopied(null), 1200);
  }

  function insertItem(item: PayloadItem) {
    if (!page) return;
    const block = emptyBlock("code");
    block.id = nid();
    block.lang = item.lang;
    block.content = item.code;
    insertBlocks(page.id, page.blocks.at(-1)?.id ?? null, [block]);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" className="absolute inset-0 bg-bg/50" aria-label="بستن" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-[360px] flex-col border-s border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-3 py-3">
          <div>
            <div className="text-[14px] font-semibold">کتابخانه Payload</div>
            <div className="text-[11px] text-muted">کپی یک‌ضرب یا درج در همین صفحه</div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="بستن">
            <X className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {PAYLOAD_GROUPS.map((group) => (
            <div key={group.id} className="mb-4">
              <div className="mb-1.5 px-0.5 text-[11px] font-medium text-subtle">{group.title}</div>
              <div className="space-y-1.5">
                {group.items.map((item) => (
                  <div key={item.id} className="rounded-md border border-border bg-bg p-2">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[12px] font-medium">{item.title}</span>
                      <div className="flex gap-0.5">
                        <button
                          type="button"
                          className="flex size-7 items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg"
                          title="کپی"
                          onClick={() => void copyItem(item)}
                        >
                          {copied === item.id ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
                        </button>
                        <button
                          type="button"
                          className="flex size-7 items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg"
                          title="درج در صفحه"
                          onClick={() => insertItem(item)}
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                    </div>
                    <pre dir="ltr" className="overflow-x-auto font-mono text-[11px] leading-5 text-muted">
                      {item.code}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
